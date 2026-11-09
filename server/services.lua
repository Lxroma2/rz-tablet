-- Application Services : annuaire des entreprises (jobs ESX) + conversations
-- Une entreprise = un job. Elle est "ouverte" si au moins un joueur de ce job est en service.
-- Une conversation = (entreprise, joueur client). Les employes de l'entreprise y repondent.

local S = Config.Services
local lastSend = {} -- source -> GetGameTimer()

-- ---------------------------------------------------------------------------
-- Base de donnees
-- ---------------------------------------------------------------------------
MySQL.ready(function()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS rz_tablet_services (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            label VARCHAR(40) NOT NULL,
            job VARCHAR(50) NOT NULL,
            description VARCHAR(160) NOT NULL DEFAULT '',
            website VARCHAR(200) NOT NULL DEFAULT '',
            x DOUBLE NULL,
            y DOUBLE NULL,
            UNIQUE KEY uq_job (job)
        )
    ]])
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS rz_tablet_service_messages (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            service_id INT UNSIGNED NOT NULL,
            sender_id VARCHAR(80) NOT NULL,
            sender_name VARCHAR(80) NOT NULL,
            message VARCHAR(300) NOT NULL,
            x DOUBLE NULL,
            y DOUBLE NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_service (service_id)
        )
    ]])
    -- conversations : colonnes ajoutees apres la premiere version (sans effet si deja presentes)
    MySQL.query.await("ALTER TABLE rz_tablet_service_messages ADD COLUMN IF NOT EXISTS player_id VARCHAR(80) NOT NULL DEFAULT ''")
    MySQL.query.await("ALTER TABLE rz_tablet_service_messages ADD COLUMN IF NOT EXISTS player_name VARCHAR(80) NOT NULL DEFAULT ''")
    MySQL.query.await('ALTER TABLE rz_tablet_service_messages ADD COLUMN IF NOT EXISTS from_service TINYINT(1) NOT NULL DEFAULT 0')
    MySQL.query.await('ALTER TABLE rz_tablet_service_messages ADD INDEX IF NOT EXISTS idx_thread (service_id, player_id)')
    MySQL.query.await("ALTER TABLE rz_tablet_services ADD COLUMN IF NOT EXISTS image VARCHAR(300) NOT NULL DEFAULT ''")
    MySQL.update.await("UPDATE rz_tablet_service_messages SET player_id = sender_id, player_name = sender_name WHERE player_id = ''")
    MySQL.update.await('DELETE FROM rz_tablet_service_messages WHERE created_at < (NOW() - INTERVAL ? DAY)', { S.keepMessagesDays })
end)

-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------
local function clean(s, max)
    if type(s) ~= 'string' then return '' end
    s = s:gsub('%c', ' '):gsub('%s+', ' '):match('^%s*(.-)%s*$')
    local len = utf8.len(s)
    if not len then return s:sub(1, max) end
    if len > max then s = s:sub(1, (utf8.offset(s, max + 1) or (#s + 1)) - 1) end
    return s
end

local function isStaff(src)
    if IsPlayerAceAllowed(src, 'command') then return true end
    local xPlayer = ESX.GetPlayerFromId(src)
    return xPlayer ~= nil and S.staffGroups[xPlayer.getGroup()] == true
end

-- nombre de joueurs en service, par job
local function dutyCounts()
    local counts = {}
    for _, xPlayer in pairs(ESX.GetExtendedPlayers()) do
        local job = xPlayer.job
        if job and job.name and job.onDuty ~= false then
            counts[job.name] = (counts[job.name] or 0) + 1
        end
    end
    return counts
end

local function getService(id)
    id = tonumber(id)
    if not id then return nil end
    return MySQL.single.await('SELECT * FROM rz_tablet_services WHERE id = ?', { id })
end

local function validImage(url)
    return url == '' or (#url <= 300 and url:match('^https://[^%s]+$') ~= nil)
end

local function validUrl(url)
    return url == '' or (#url <= 200 and url:match('^https?://[^%s]+$') ~= nil)
end

-- Retrouve une conversation a partir de l'id de son premier message et verifie les droits.
-- role = 'client' (le joueur lui-meme) ou 'company' (employe de l'entreprise)
local function threadRef(src, tid, role)
    tid = tonumber(tid)
    if not tid or (role ~= 'client' and role ~= 'company') then return nil end
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return nil end
    local first = MySQL.single.await('SELECT service_id, player_id, player_name FROM rz_tablet_service_messages WHERE id = ?', { tid })
    if not first then return nil end
    local service = getService(first.service_id)
    if not service then return nil end
    if role == 'client' and first.player_id ~= xPlayer.identifier then return nil end
    if role == 'company' and xPlayer.job.name ~= service.job then return nil end
    return { service = service, playerId = first.player_id, playerName = first.player_name, role = role, xPlayer = xPlayer, tid = tid }
end

local function threadId(serviceId, playerId)
    return MySQL.scalar.await('SELECT MIN(id) FROM rz_tablet_service_messages WHERE service_id = ? AND player_id = ?', { serviceId, playerId })
end

-- Ajoute un message dans une conversation et previent l'autre cote.
local function post(src, service, role, playerId, playerName, text, withPos)
    local xPlayer = ESX.GetPlayerFromId(src)
    local x, y
    if withPos then
        local c = GetEntityCoords(GetPlayerPed(src))
        x, y = c.x, c.y
    end
    local from = clean(xPlayer.getName(), 60)
    MySQL.insert.await(
        [[INSERT INTO rz_tablet_service_messages
          (service_id, sender_id, sender_name, message, x, y, player_id, player_name, from_service)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)]],
        { service.id, xPlayer.identifier, from, text, x, y, playerId, playerName, role == 'company' and 1 or 0 })
    -- plafond de messages par entreprise
    MySQL.update.await([[
        DELETE FROM rz_tablet_service_messages WHERE service_id = ? AND id NOT IN (
            SELECT id FROM (SELECT id FROM rz_tablet_service_messages WHERE service_id = ? ORDER BY id DESC LIMIT ?) t
        )
    ]], { service.id, service.id, S.maxMessagesPerService })

    local note = text ~= '' and text or 'Position partagee'
    local delivered = 0
    local tid = threadId(service.id, playerId)
    if role == 'client' then
        for _, target in pairs(ESX.GetExtendedPlayers()) do
            local job = target.job
            if job and job.name == service.job and job.onDuty ~= false then
                delivered = delivered + 1
                TriggerClientEvent('rz-tablet:svc:incoming', target.source, { service = service.label, from = from, text = note, hasPos = x ~= nil,
                    tid = tid, role = 'company', serviceId = service.id, name = playerName, image = service.image })
            end
        end
    else
        local target = ESX.GetPlayerFromIdentifier(playerId)
        if target then
            delivered = 1
            TriggerClientEvent('rz-tablet:svc:incoming', target.source, { service = service.label, from = from, text = note, hasPos = x ~= nil,
                tid = tid, role = 'client', serviceId = service.id, name = service.label, image = service.image })
        end
    end
    return delivered, tid
end

-- limite l'envoi (anti-spam). Renvoie false si le joueur doit attendre.
local function cooldownOk(src)
    local now = GetGameTimer()
    if lastSend[src] and now - lastSend[src] < S.messageCooldown then return false end
    lastSend[src] = now
    return true
end

-- ---------------------------------------------------------------------------
-- Liste des entreprises (tous les joueurs)
-- ---------------------------------------------------------------------------
ESX.RegisterServerCallback('rz-tablet:svc:list', function(source, cb)
    local xPlayer = ESX.GetPlayerFromId(source)
    local rows = MySQL.query.await('SELECT * FROM rz_tablet_services ORDER BY label') or {}
    local counts = dutyCounts()
    local myJob = xPlayer and xPlayer.job.name or ''
    local services = {}
    for _, r in ipairs(rows) do
        local online = counts[r.job] or 0
        services[#services + 1] = {
            id = r.id, label = r.label, job = r.job, description = r.description, website = r.website, image = r.image,
            x = r.x, y = r.y, online = online, open = online > 0, mine = r.job == myJob,
        }
    end
    cb({ ok = true, staff = isStaff(source), job = myJob, services = services })
end)

-- ---------------------------------------------------------------------------
-- Conversations
-- ---------------------------------------------------------------------------
local THREAD_SQL = [[
    SELECT t.tid, t.mid, m.service_id, m.player_name, m.sender_name, m.message, m.x, m.from_service,
           UNIX_TIMESTAMP(m.created_at) AS ts
    FROM (SELECT MIN(id) AS tid, MAX(id) AS mid FROM rz_tablet_service_messages WHERE %s GROUP BY service_id, player_id) t
    JOIN rz_tablet_service_messages m ON m.id = t.mid
    ORDER BY t.mid DESC LIMIT 60
]]

ESX.RegisterServerCallback('rz-tablet:svc:threads', function(source, cb)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return cb({ ok = false }) end

    local labels = {}
    for _, r in ipairs(MySQL.query.await('SELECT id, label, job, image FROM rz_tablet_services') or {}) do labels[r.id] = r end

    local list = {}
    local function add(rows, role)
        for _, r in ipairs(rows or {}) do
            local svc = labels[r.service_id]
            if svc then
                list[#list + 1] = {
                    tid = r.tid, lastId = r.mid, role = role, serviceId = r.service_id, service = svc.label,
                    name = role == 'client' and svc.label or r.player_name,
                    image = role == 'client' and svc.image or '',
                    text = r.message, hasPos = r.x ~= nil, ts = r.ts,
                    mine = (role == 'client' and r.from_service == 0) or (role == 'company' and r.from_service == 1),
                }
            end
        end
    end

    -- mes conversations en tant que client
    add(MySQL.query.await(THREAD_SQL:format('player_id = ?'), { xPlayer.identifier }), 'client')
    -- les conversations des clients de mon entreprise
    for id, svc in pairs(labels) do
        if svc.job == xPlayer.job.name then
            add(MySQL.query.await(THREAD_SQL:format('service_id = ?'), { id }), 'company')
        end
    end
    table.sort(list, function(a, b) return a.lastId > b.lastId end)
    cb({ ok = true, threads = list })
end)

ESX.RegisterServerCallback('rz-tablet:svc:thread', function(source, cb, p)
    local ref = type(p) == 'table' and threadRef(source, p.tid, p.role)
    if not ref then return cb({ ok = false }) end
    local rows = MySQL.query.await(
        [[SELECT id, sender_name, message, x, y, from_service, UNIX_TIMESTAMP(created_at) AS ts
          FROM rz_tablet_service_messages WHERE service_id = ? AND player_id = ? ORDER BY id DESC LIMIT 100]],
        { ref.service.id, ref.playerId }) or {}
    local messages = {}
    for i = #rows, 1, -1 do
        local r = rows[i]
        messages[#messages + 1] = {
            id = r.id, from = r.sender_name, text = r.message, x = r.x, y = r.y, ts = r.ts,
            mine = (ref.role == 'client' and r.from_service == 0) or (ref.role == 'company' and r.from_service == 1),
        }
    end
    local open = (dutyCounts()[ref.service.job] or 0) > 0
    cb({
        ok = true, role = ref.role, serviceId = ref.service.id, service = ref.service.label, open = open,
        title = ref.role == 'client' and ref.service.label or ref.playerName, messages = messages,
    })
end)

-- Reponse dans une conversation existante
ESX.RegisterServerCallback('rz-tablet:svc:reply', function(source, cb, p)
    if type(p) ~= 'table' then return cb({ ok = false, err = 'invalid' }) end
    local ref = threadRef(source, p.tid, p.role)
    if not ref then return cb({ ok = false, err = 'missing' }) end
    local withPos = p.withPos == true
    local text = clean(p.text, S.messageMaxLength)
    if text == '' and not withPos then return cb({ ok = false, err = 'empty' }) end
    if not cooldownOk(source) then return cb({ ok = false, err = 'cooldown' }) end
    local delivered, tid = post(source, ref.service, ref.role, ref.playerId, ref.playerName, text, withPos)
    cb({ ok = true, delivered = delivered, tid = tid })
end)

-- Premier message vers une entreprise (ou suite de ma conversation avec elle)
ESX.RegisterServerCallback('rz-tablet:svc:send', function(source, cb, p)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer or type(p) ~= 'table' then return cb({ ok = false, err = 'invalid' }) end
    local service = getService(p.id)
    if not service then return cb({ ok = false, err = 'missing' }) end
    local withPos = p.withPos == true
    local text = clean(p.text, S.messageMaxLength)
    if text == '' and not withPos then return cb({ ok = false, err = 'empty' }) end
    if not cooldownOk(source) then return cb({ ok = false, err = 'cooldown' }) end
    local name = clean(xPlayer.getName(), 60)
    local delivered, tid = post(source, service, 'client', xPlayer.identifier, name, text, withPos)
    cb({ ok = true, delivered = delivered, tid = tid })
end)

-- ---------------------------------------------------------------------------
-- Gestion (staff)
-- ---------------------------------------------------------------------------
ESX.RegisterServerCallback('rz-tablet:svc:jobs', function(source, cb)
    if not isStaff(source) then return cb({ ok = false }) end
    local list = {}
    for name, job in pairs(ESX.GetJobs()) do
        if name ~= 'unemployed' then list[#list + 1] = { name = name, label = job.label or name } end
    end
    table.sort(list, function(a, b) return a.label:lower() < b.label:lower() end)
    cb({ ok = true, jobs = list })
end)

ESX.RegisterServerCallback('rz-tablet:svc:save', function(source, cb, p)
    if not isStaff(source) then return cb({ ok = false, err = 'forbidden' }) end
    if type(p) ~= 'table' then return cb({ ok = false, err = 'invalid' }) end

    local label = clean(p.label, 40)
    local description = clean(p.description, 160)
    local website = clean(p.website, 200)
    local image = clean(p.image, 300)
    if #label < 2 then return cb({ ok = false, err = 'label' }) end
    if not validUrl(website) then return cb({ ok = false, err = 'website' }) end
    if not validImage(image) then return cb({ ok = false, err = 'image' }) end

    local x, y
    if p.useMyPos == true then
        local c = GetEntityCoords(GetPlayerPed(source))
        x, y = c.x, c.y
    end

    local existing = p.id and getService(p.id)
    if existing then
        if x then
            MySQL.update.await('UPDATE rz_tablet_services SET label = ?, description = ?, website = ?, image = ?, x = ?, y = ? WHERE id = ?',
                { label, description, website, image, x, y, existing.id })
        else
            MySQL.update.await('UPDATE rz_tablet_services SET label = ?, description = ?, website = ?, image = ? WHERE id = ?',
                { label, description, website, image, existing.id })
        end
        return cb({ ok = true })
    end

    local job = type(p.job) == 'string' and p.job or ''
    if job == '' or not ESX.GetJobs()[job] then return cb({ ok = false, err = 'job' }) end
    if MySQL.scalar.await('SELECT id FROM rz_tablet_services WHERE job = ?', { job }) then
        return cb({ ok = false, err = 'exists' })
    end
    MySQL.insert.await('INSERT INTO rz_tablet_services (label, job, description, website, image, x, y) VALUES (?, ?, ?, ?, ?, ?, ?)',
        { label, job, description, website, image, x, y })
    cb({ ok = true })
end)

ESX.RegisterServerCallback('rz-tablet:svc:delete', function(source, cb, p)
    if not isStaff(source) then return cb({ ok = false }) end
    local service = type(p) == 'table' and getService(p.id)
    if not service then return cb({ ok = false }) end
    MySQL.update.await('DELETE FROM rz_tablet_service_messages WHERE service_id = ?', { service.id })
    MySQL.update.await('DELETE FROM rz_tablet_services WHERE id = ?', { service.id })
    cb({ ok = true })
end)

AddEventHandler('playerDropped', function()
    lastSend[source] = nil
end)
