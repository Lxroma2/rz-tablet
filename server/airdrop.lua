-- AirDrop : partager une note ou une position avec une tablette proche.
-- L'envoyeur choisit parmi les joueurs a portee (Config.AirDrop.range) qui ont une tablette et la reception active ;
-- le destinataire accepte ou refuse. Le contenu ne part chez lui qu'une fois accepte.

local A = Config.AirDrop or {}
local RANGE = tonumber(A.range) or 8.0
local EXPIRE = tonumber(A.expire) or 60
local COOLDOWN = tonumber(A.cooldown) or 3000

local receiving = {} -- source -> false si la reception est coupee (Reglages > AirDrop)
local pending = {}   -- id -> { from, to, p, t }
local lastSend, lastNearby = {}, {}
local nextId = 0

local function coords(src)
    local ped = GetPlayerPed(src)
    if not ped or ped == 0 or not DoesEntityExist(ped) then return nil end
    return GetEntityCoords(ped)
end

local function hasTablet(src)
    local ok, n = pcall(function() return exports.ox_inventory:GetItemCount(src, Config.ItemName) end)
    return ok and (tonumber(n) or 0) > 0
end

-- "Prenom N." (ou "Tablette" si Config.AirDrop.showNames = false)
local function label(src)
    if A.showNames == false then return 'Tablette' end
    local xPlayer = ESX.GetPlayerFromId(src)
    local name = xPlayer and xPlayer.getName() or ''
    local first, rest = name:match('^%s*(%S+)%s*(.-)%s*$')
    if not first then return 'Tablette' end
    local okc, cp = pcall(utf8.codepoint, rest or '', 1)
    local initial = rest and rest ~= '' and okc and cp and utf8.char(cp) or nil
    return initial and (first .. ' ' .. initial .. '.') or first
end

-- deux joueurs assez proches, dans le meme monde (routing bucket)
local function near(a, b)
    if GetPlayerRoutingBucket(a) ~= GetPlayerRoutingBucket(b) then return nil end
    local pa, pb = coords(a), coords(b)
    if not pa or not pb then return nil end
    local d = #(pa - pb)
    return d <= RANGE and d or nil
end

local function clean(p)
    if type(p) ~= 'table' then return nil end
    if p.kind == 'note' then
        local max = Config.Notes and tonumber(Config.Notes.maxLength) or 4000
        if type(p.text) ~= 'string' or not p.text:find('%S') or #p.text > max then return nil end
        return { kind = 'note', text = p.text }
    elseif p.kind == 'pos' then
        local x, y = tonumber(p.x), tonumber(p.y)
        if not x or not y or math.abs(x) > 20000 or math.abs(y) > 20000 then return nil end
        local l = type(p.label) == 'string' and p.label:gsub('%c', ' '):sub(1, 80) or nil
        return { kind = 'pos', x = x, y = y, label = l }
    end
    return nil
end

local function preview(p)
    if p.kind == 'note' then
        local line = p.text:match('^%s*([^\n]+)') or ''
        return line:sub(1, 80)
    end
    return p.label or 'Position'
end

RegisterNetEvent('rz-tablet:ad:receiving', function(on)
    receiving[source] = on ~= false
end)

ESX.RegisterServerCallback('rz-tablet:ad:nearby', function(source, cb)
    local now = GetGameTimer()
    if lastNearby[source] and now - lastNearby[source] < 800 then return cb({ ok = false, err = 'rate' }) end
    lastNearby[source] = now
    if not hasTablet(source) then return cb({ ok = false, err = 'tablet' }) end
    local out = {}
    for _, sid in ipairs(GetPlayers()) do
        local id = tonumber(sid)
        if id and id ~= source and receiving[id] ~= false then
            local d = near(source, id)
            if d and hasTablet(id) then out[#out + 1] = { id = id, name = label(id), dist = math.floor(d + 0.5) } end
        end
    end
    table.sort(out, function(a, b) return a.dist < b.dist end)
    cb({ ok = true, list = out })
end)

ESX.RegisterServerCallback('rz-tablet:ad:send', function(source, cb, target, p)
    local now = GetGameTimer()
    if lastSend[source] and now - lastSend[source] < COOLDOWN then return cb({ ok = false, err = 'rate' }) end
    target = tonumber(target)
    local payload = clean(p)
    if not target or target == source or not payload then return cb({ ok = false, err = 'data' }) end
    if receiving[target] == false or not near(source, target) or not hasTablet(target) or not hasTablet(source) then
        return cb({ ok = false, err = 'gone' })
    end
    lastSend[source] = now

    nextId = nextId + 1
    local id = nextId
    pending[id] = { from = source, to = target, p = payload, t = os.time() }
    TriggerClientEvent('rz-tablet:ad:incoming', target, { id = id, from = label(source), kind = payload.kind, preview = preview(payload), expire = EXPIRE })
    cb({ ok = true, id = id })
end)

ESX.RegisterServerCallback('rz-tablet:ad:answer', function(source, cb, id, accept)
    id = tonumber(id)
    local r = id and pending[id]
    if not r or r.to ~= source then return cb({ ok = false, err = 'gone' }) end
    pending[id] = nil
    if os.time() - r.t > EXPIRE then
        TriggerClientEvent('rz-tablet:ad:result', r.from, { id = id, state = 'expired' })
        return cb({ ok = false, err = 'expired' })
    end
    TriggerClientEvent('rz-tablet:ad:result', r.from, { id = id, state = accept == true and 'accepted' or 'declined', to = label(source) })
    if accept == true then return cb({ ok = true, payload = r.p, from = label(r.from) }) end
    cb({ ok = true })
end)

-- demandes sans reponse : l'envoyeur l'apprend
CreateThread(function()
    while true do
        Wait(5000)
        local limit = os.time() - EXPIRE
        for id, r in pairs(pending) do
            if r.t < limit then
                pending[id] = nil
                TriggerClientEvent('rz-tablet:ad:result', r.from, { id = id, state = 'expired' })
                TriggerClientEvent('rz-tablet:ad:cancel', r.to, { id = id })
            end
        end
    end
end)

AddEventHandler('playerDropped', function()
    local src = source
    receiving[src], lastSend[src], lastNearby[src] = nil, nil, nil
    for id, r in pairs(pending) do
        if r.from == src or r.to == src then
            pending[id] = nil
            if r.from == src then TriggerClientEvent('rz-tablet:ad:cancel', r.to, { id = id }) end
            if r.to == src then TriggerClientEvent('rz-tablet:ad:result', r.from, { id = id, state = 'expired' }) end
        end
    end
end)
