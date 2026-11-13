-- L'item 'tablet' est declare dans ox_inventory/data/items.lua
-- (client.event = 'rz-tablet:open'), plus besoin de SQL ni de RegisterUsableItem.

-- Staff : groupes ESX de Config.Services.staffGroups, ou acces console (ace 'command')
function RzIsStaff(src)
    if IsPlayerAceAllowed(src, 'command') then return true end
    local xPlayer = ESX.GetPlayerFromId(src)
    local groups = Config.Services and Config.Services.staffGroups or {}
    return xPlayer ~= nil and groups[xPlayer.getGroup()] == true
end

-- Le client demande la config a l'ouverture : navigateur (sites de config.lua + ceux ajoutes en jeu),
-- apps web (Config.Store + apps ajoutees en jeu) et acces a la page Administration
ESX.RegisterServerCallback('rz-tablet:getConfig', function(source, cb)
    cb({ browser = RzBrowserConfig(), store = RzStoreList(), staff = RzIsStaff(source) })
end)

-- ---------------------------------------------------------------------------
-- Detection : le site autorise-t-il l'affichage en iframe ?
-- Le serveur lit les en-tetes X-Frame-Options / Content-Security-Policy du site.
-- Reponse : true = iframe possible, false = a afficher en rendu DUI, nil = inconnu.
-- ---------------------------------------------------------------------------
local CACHE_MS = 10 * 60 * 1000
local cache = {}       -- host -> { t = GetGameTimer(), ok = bool }
local lastReq = {}     -- source -> GetGameTimer()

-- Refuse les adresses locales / privees (evite d'utiliser le serveur pour sonder le reseau interne)
function RzIsPrivateHost(host)
    if host == 'localhost' or host:find('%.local$') or host:find('%.internal$') then return true end
    if not host:find('%.') then return true end
    if host:find('^%[') or host:find(':') then return true end
    local a, b = host:match('^(%d+)%.(%d+)%.%d+%.%d+$')
    if a then
        a, b = tonumber(a), tonumber(b)
        if a == 0 or a == 10 or a == 127 or (a == 169 and b == 254) or (a == 192 and b == 168)
            or (a == 172 and b >= 16 and b <= 31) or a >= 224 then
            return true
        end
    end
    return false
end

-- Liste blanche (Config.Browser.allowedHosts + sites autorises en jeu) : le host doit etre listé
-- ou en etre un sous-domaine
local function hostAllowed(host)
    if not Config.Browser.restrictToAllowed then return true end
    return RzHostCovered(host, RzAllowedHosts())
end

local function getHeader(headers, name)
    if type(headers) ~= 'table' then return nil end
    name = name:lower()
    for k, v in pairs(headers) do
        if tostring(k):lower() == name then
            if type(v) == 'table' then return table.concat(v, ', ') end
            return tostring(v)
        end
    end
end

-- true si le CSP frame-ancestors autorise la tablette
local function cspAllows(csp)
    local directive = csp:lower():match('frame%-ancestors([^;]*)')
    if not directive then return true end
    for token in directive:gmatch('%S+') do
        if token == '*' or token == 'nui:' or token == 'nui://rz-tablet' or token == 'https://cfx-nui-rz-tablet' then
            return true
        end
    end
    return false
end

ESX.RegisterServerCallback('rz-tablet:canFrame', function(source, cb, url)
    if Config.Browser.autoDetect == false or type(url) ~= 'string' or #url > 2000 then return cb(nil) end

    local host = url:match('^https?://([^/%?#]+)')
    if not host or host:find('@') then return cb(false) end
    host = host:gsub(':%d+$', ''):lower()
    if RzIsPrivateHost(host) then return cb(false) end
    if not hostAllowed(host) then return cb(false) end

    local c = cache[host]
    if c and GetGameTimer() - c.t < CACHE_MS then return cb(c.ok) end

    -- limite : 1 verification par seconde et par joueur
    local now = GetGameTimer()
    if lastReq[source] and now - lastReq[source] < 1000 then return cb(nil) end
    lastReq[source] = now

    PerformHttpRequest(url, function(status, _, headers)
        if not status or status == 0 then return cb(nil) end
        local ok = true
        if getHeader(headers, 'x-frame-options') then ok = false end
        local csp = getHeader(headers, 'content-security-policy')
        if ok and csp and not cspAllows(csp) then ok = false end
        cache[host] = { t = GetGameTimer(), ok = ok }
        cb(ok)
    end, 'GET', '', { ['User-Agent'] = 'Mozilla/5.0 (rz-tablet)' })
end)

AddEventHandler('playerDropped', function()
    lastReq[source] = nil
end)

if Config.DebugCommand then
    RegisterCommand(Config.DebugCommand, function(source)
        if source > 0 then TriggerClientEvent('rz-tablet:open', source) end
    end, true)
end
