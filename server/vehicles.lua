-- Application Vehicules : carte grise et localisation, a partir de la table owned_vehicles d'ESX.
--   Mes vehicules        : owner = identifiant du personnage
--   Vehicules entreprise : colonne job = mon job (ou owner = 'society:<job>'), selon le grade (Config.Vehicles.jobs)
-- Un vehicule n'a de position que s'il existe dans le monde (OneSync : GetAllVehicles). Sinon il est au garage
-- (stored = 1), ou on donne la derniere position ou il a ete vu depuis le demarrage de la ressource.

local V = Config.Vehicles or {}
local seen = {}               -- plaque -> { x, y, z, h, t } derniere position vue
local index, indexAt = {}, -1 -- plaque -> entite, reconstruit au plus toutes les 2 s
local lastList, lastPos = {}, {}
local cache = {}              -- source -> { t, rows } pour la Carte (evite une requete SQL toutes les 3 s)

local function norm(p)
    if type(p) ~= 'string' then return '' end
    local s = p:gsub('^%s+', ''):gsub('%s+$', '')
    return s:upper()
end

-- ---------------------------------------------------------------------------
-- Vehicules presents dans le monde
-- ---------------------------------------------------------------------------
local function worldIndex(force)
    local now = GetGameTimer()
    if not force and indexAt >= 0 and now - indexAt < 2000 then return index end
    indexAt = now
    local t, ts = {}, os.time()
    for _, veh in ipairs(GetAllVehicles()) do
        if DoesEntityExist(veh) then
            local plate = norm(GetVehicleNumberPlateText(veh))
            if plate ~= '' then
                t[plate] = veh
                local c = GetEntityCoords(veh)
                seen[plate] = { x = c.x, y = c.y, z = c.z, h = GetEntityHeading(veh), t = ts }
            end
        end
    end
    index = t
    return t
end

-- position actuelle (live = true) ou derniere position vue
local function locate(plate)
    local veh = worldIndex()[plate]
    if veh and DoesEntityExist(veh) then
        local c = GetEntityCoords(veh)
        local s = { x = c.x, y = c.y, z = c.z, h = GetEntityHeading(veh), t = os.time() }
        seen[plate] = s
        return s, true
    end
    return seen[plate], false
end

-- derniere position vue meme sans que personne ne regarde, et oubli apres 6 h
CreateThread(function()
    while true do
        Wait(30000)
        worldIndex(true)
        local limit = os.time() - 6 * 3600
        for plate, s in pairs(seen) do
            if s.t < limit then seen[plate] = nil end
        end
    end
end)

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------
local function jobRule(job)
    local r = V.jobs and V.jobs[job]
    if type(r) == 'number' then return { see = r, locate = r } end
    if type(r) == 'table' then
        local see = tonumber(r.see) or 0
        return { see = see, locate = tonumber(r.locate) or see }
    end
    return nil
end

local function gradeLabel(job, grade)
    local j = ESX.GetJobs()[job]
    local g = j and j.grades and j.grades[tostring(grade)]
    return g and g.label or ('grade ' .. grade)
end

-- onglet Entreprise : nil si le job n'a pas de regle
local function companyAccess(xPlayer)
    local job = xPlayer.getJob()
    local rule = job and jobRule(job.name)
    if not rule then return nil end
    local grade = tonumber(job.grade) or 0
    local c = { job = job.name, label = job.label or job.name, see = grade >= rule.see, locate = grade >= rule.locate }
    if not c.see then
        c.locate = false
        c.need = gradeLabel(job.name, rule.see)
    elseif not c.locate then
        c.needLocate = gradeLabel(job.name, rule.locate)
    elseif V.needDuty and job.onDuty == false then
        c.locate = false
        c.needDuty = true
    end
    return c
end

-- ---------------------------------------------------------------------------
-- Lecture des vehicules
-- ---------------------------------------------------------------------------
local function props(raw)
    if type(raw) ~= 'string' or raw == '' then return {} end
    local ok, d = pcall(json.decode, raw)
    return ok and type(d) == 'table' and d or {}
end

local function isStored(v) return v == true or v == 1 end

local function mineRows(xPlayer)
    return MySQL.query.await('SELECT plate, vehicle, stored FROM owned_vehicles WHERE owner = ? LIMIT 100', { xPlayer.identifier }) or {}
end

local function companyRows(xPlayer, job)
    return MySQL.query.await([[
        SELECT ov.plate, ov.vehicle, ov.stored, ov.owner, u.firstname, u.lastname
        FROM owned_vehicles ov LEFT JOIN users u ON u.identifier = ov.owner
        WHERE (ov.job = ? OR ov.owner = ?) AND ov.owner <> ?
        LIMIT 200
    ]], { job, 'society:' .. job, xPlayer.identifier }) or {}
end

local function vehicle(r, canLocate)
    local p = props(r.vehicle)
    local plate = norm(r.plate)
    local v = {
        plate = plate,
        model = tonumber(p.model),
        stored = isStored(r.stored),
        fuel = tonumber(p.fuelLevel),
        engine = tonumber(p.engineHealth),
        body = tonumber(p.bodyHealth),
    }
    local pos, live = locate(plate)
    v.live = live
    if live then v.stored = false end
    if canLocate and pos and (live or not v.stored) then
        v.x, v.y, v.z, v.h = pos.x, pos.y, pos.z, pos.h
        if not live then v.seen = os.time() - pos.t end
    end
    if r.firstname and r.firstname ~= '' then v.holder = (r.firstname .. ' ' .. (r.lastname or '')):gsub('%s+$', '') end
    return v
end

ESX.RegisterServerCallback('rz-tablet:veh:list', function(source, cb)
    local now = GetGameTimer()
    if lastList[source] and now - lastList[source] < 500 then return cb({ ok = false, err = 'rate' }) end
    lastList[source] = now
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return cb({ ok = false }) end

    local mine = {}
    for i, r in ipairs(mineRows(xPlayer)) do mine[i] = vehicle(r, true) end
    local out = { ok = true, mine = mine, owner = xPlayer.getName() }

    local c = companyAccess(xPlayer)
    if c then
        if c.see then
            c.list = {}
            for i, r in ipairs(companyRows(xPlayer, c.job)) do c.list[i] = vehicle(r, c.locate) end
        end
        out.company = c
    end
    cb(out)
end)

-- Pour la Carte : tous les vehicules localisables du joueur, avec leur position
ESX.RegisterServerCallback('rz-tablet:veh:positions', function(source, cb)
    local now = GetGameTimer()
    if lastPos[source] and now - lastPos[source] < 900 then return cb({ ok = false, err = 'rate' }) end
    lastPos[source] = now
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return cb({ ok = false }) end

    local cached = cache[source]
    if not cached or now - cached.t > 15000 then
        local rows = {}
        for _, r in ipairs(mineRows(xPlayer)) do r.own = 'me'; rows[#rows + 1] = r end
        local c = companyAccess(xPlayer)
        if c and c.locate then
            for _, r in ipairs(companyRows(xPlayer, c.job)) do r.own = 'job'; rows[#rows + 1] = r end
        end
        cached = { t = now, rows = rows }
        cache[source] = cached
    end

    local list = {}
    for _, r in ipairs(cached.rows) do
        local v = vehicle(r, true)
        if v.x then
            list[#list + 1] = { plate = v.plate, model = v.model, own = r.own, live = v.live, seen = v.seen, x = v.x, y = v.y, z = v.z, h = v.h }
        end
    end
    cb({ ok = true, list = list })
end)

-- ---------------------------------------------------------------------------
-- Commande staff d'immatriculation (tests sans concessionnaire ni garage)
-- ---------------------------------------------------------------------------
local function isStaff(src)
    if IsPlayerAceAllowed(src, 'command') then return true end
    local xPlayer = ESX.GetPlayerFromId(src)
    local groups = Config.Services and Config.Services.staffGroups or {}
    return xPlayer ~= nil and groups[xPlayer.getGroup()] == true
end

RegisterNetEvent('rz-tablet:veh:register', function(p, arg)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer or not V.registerCommand or not isStaff(src) then return end
    if type(p) ~= 'table' then return end
    local plate = norm(p.plate)
    if plate == '' or #plate > 12 then return xPlayer.showNotification('Plaque invalide.') end

    if arg == 'retirer' then
        local n = MySQL.update.await('DELETE FROM owned_vehicles WHERE plate = ?', { plate })
        cache = {}
        return xPlayer.showNotification(n and n > 0 and ('Plaque %s retirée.'):format(plate) or ('Plaque %s inconnue.'):format(plate))
    end

    local owner, job = xPlayer.identifier, nil
    if type(arg) == 'string' and arg ~= '' then
        if not ESX.GetJobs()[arg] then return xPlayer.showNotification(('Job inconnu : %s'):format(arg)) end
        owner, job = 'society:' .. arg, arg
    end
    p.plate = plate
    MySQL.insert.await([[
        INSERT INTO owned_vehicles (owner, plate, vehicle, type, job, stored) VALUES (?, ?, ?, 'car', ?, 0)
        ON DUPLICATE KEY UPDATE owner = VALUES(owner), vehicle = VALUES(vehicle), job = VALUES(job), stored = 0
    ]], { owner, plate, json.encode(p), job })
    cache = {}
    xPlayer.showNotification(job and ('Plaque %s enregistrée pour %s.'):format(plate, job) or ('Plaque %s enregistrée à ton nom.'):format(plate))
end)

AddEventHandler('playerDropped', function()
    lastList[source], lastPos[source], cache[source] = nil, nil, nil
end)
