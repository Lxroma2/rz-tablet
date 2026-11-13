-- Page Administration des Reglages : le staff autorise des sites et ajoute des apps web en jeu.
-- Ils s'ajoutent a ceux de config.lua (Config.Browser.allowedHosts, Config.Store), qui restent fixes
-- et ne se modifient que dans le fichier. Chaque changement est envoye tout de suite a tous les joueurs.

local Sites = {}   -- hosts autorises en jeu (rz_tablet_sites)
local Apps = {}    -- apps web ajoutees en jeu (rz_tablet_apps), meme format que Config.Store
local MAX_SITES, MAX_APPS = 200, 60
local BUILTIN = { settings = true, store = true, browser = true, services = true, notes = true,
    calculator = true, maps = true, vehicles = true, bank = true }

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

-- host couvert par la liste : identique ou sous-domaine
function RzHostCovered(host, list)
    host = tostring(host or ''):lower()
    if host == '' then return false end
    for _, a in ipairs(list or {}) do
        a = tostring(a):lower()
        if host == a or host:sub(-(#a + 1)) == '.' .. a then return true end
    end
    return false
end

-- "https://www.site.fr/page" ou "site.fr" -> "site.fr" ; nil si ce n'est pas un nom de domaine public
local function normHost(s)
    if type(s) ~= 'string' or #s > 300 then return nil end
    s = s:lower():gsub('%s', '')
    s = s:gsub('^%a+://', ''):gsub('[/%?#].*$', ''):gsub(':%d+$', ''):gsub('^%*%.', ''):gsub('^www%.', '')
    if #s < 4 or #s > 120 or s:find('@') or s:find('%.%.') or s:find('^[%.%-]') or s:find('[%.%-]$') then return nil end
    if not s:match('^[a-z0-9%-]+%.[a-z0-9%.%-]+$') then return nil end
    if RzIsPrivateHost(s) then return nil end
    return s
end

local function hostOfUrl(url)
    local h = type(url) == 'string' and url:match('^https://([^/%?#]+)')
    if not h or h:find('@') then return nil end
    return normHost(h)
end

local function configHosts()
    local list = {}
    for _, h in ipairs(Config.Browser.allowedHosts or {}) do list[#list + 1] = tostring(h):lower() end
    return list
end

function RzAllowedHosts()
    local list, seen = {}, {}
    for _, src in ipairs({ configHosts(), Sites }) do
        for _, h in ipairs(src) do
            if not seen[h] then seen[h] = true; list[#list + 1] = h end
        end
    end
    return list
end

function RzBrowserConfig()
    local b = {}
    for k, v in pairs(Config.Browser) do b[k] = v end
    b.allowedHosts = RzAllowedHosts()
    return b
end

function RzStoreList()
    local list = {}
    for _, a in ipairs(Config.Store or {}) do list[#list + 1] = a end
    for _, a in ipairs(Apps) do list[#list + 1] = a end
    return list
end

local function broadcast()
    TriggerClientEvent('rz-tablet:cfgUpdate', -1, { browser = RzBrowserConfig(), store = RzStoreList() })
end

-- initiales de l'icone quand il n'y a pas d'image : "Los Santos News" -> "LS", "Dynasty" -> "Dy"
local function initials(label)
    local words = {}
    for w in label:gmatch('[^%s%-%.]+') do words[#words + 1] = w end
    local function first(w, n)
        local stop = utf8.offset(w, n + 1)
        return stop and w:sub(1, stop - 1) or w
    end
    if #words == 0 then return '' end
    if #words == 1 then return first(words[1], 2) end
    return (first(words[1], 1) .. first(words[2], 1)):upper()
end

local function idTaken(id)
    if BUILTIN[id] then return true end
    for _, a in ipairs(Config.Store or {}) do if tostring(a.id):lower() == id then return true end end
    for _, a in ipairs(Apps) do if a.id == id then return true end end
    return false
end

local function newId(label)
    local base = label:lower():gsub('[^a-z0-9]+', '-'):gsub('^%-+', ''):gsub('%-+$', ''):sub(1, 24):gsub('%-+$', '')
    if base == '' then base = 'app' end
    local id, n = base, 1
    while idTaken(id) do n = n + 1; id = base .. '-' .. n end
    return id
end

local function findApp(id)
    for i, a in ipairs(Apps) do if a.id == id then return a, i end end
end

local function isConfigApp(id)
    for _, a in ipairs(Config.Store or {}) do if tostring(a.id):lower() == id then return true end end
    return false
end

local function rowToApp(r)
    local function opt(v) return (v ~= nil and v ~= '') and v or nil end
    return {
        id = r.id, label = r.label, subtitle = r.subtitle, category = r.category, url = r.url,
        image = opt(r.image), color = opt(r.color), icon = opt(r.icon), description = r.description,
        glyph = initials(r.label), custom = true,
    }
end

local function load()
    Sites = {}
    for _, r in ipairs(MySQL.query.await('SELECT host FROM rz_tablet_sites ORDER BY host') or {}) do Sites[#Sites + 1] = r.host end
    Apps = {}
    for _, r in ipairs(MySQL.query.await('SELECT * FROM rz_tablet_apps ORDER BY created_at, id') or {}) do Apps[#Apps + 1] = rowToApp(r) end
end

MySQL.ready(function()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS rz_tablet_sites (
            host VARCHAR(120) NOT NULL PRIMARY KEY,
            created_at INT NOT NULL
        )
    ]])
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS rz_tablet_apps (
            id VARCHAR(32) NOT NULL PRIMARY KEY,
            label VARCHAR(24) NOT NULL,
            subtitle VARCHAR(60) NOT NULL DEFAULT '',
            category VARCHAR(24) NOT NULL DEFAULT '',
            url VARCHAR(300) NOT NULL,
            image VARCHAR(300) NOT NULL DEFAULT '',
            color VARCHAR(9) NOT NULL DEFAULT '',
            icon VARCHAR(48) NOT NULL DEFAULT '',
            description VARCHAR(600) NOT NULL DEFAULT '',
            created_at INT NOT NULL
        )
    ]])
    load()
    broadcast()   -- redemarrage de la ressource : les tablettes deja ouvertes recuperent la liste
end)

local function addSite(host)
    if RzHostCovered(host, RzAllowedHosts()) then return false, 'exists' end
    if #Sites >= MAX_SITES then return false, 'max' end
    MySQL.insert.await('INSERT IGNORE INTO rz_tablet_sites (host, created_at) VALUES (?, ?)', { host, os.time() })
    Sites[#Sites + 1] = host
    table.sort(Sites)
    return true
end

-- ---------------------------------------------------------------------------
-- Callbacks (staff uniquement)
-- ---------------------------------------------------------------------------
local function state()
    local fixed, sites = {}, {}
    for _, h in ipairs(configHosts()) do
        if not fixed[h] then fixed[h] = true; sites[#sites + 1] = { host = h, fixed = true } end
    end
    for _, h in ipairs(Sites) do
        if not fixed[h] then sites[#sites + 1] = { host = h, fixed = false } end
    end
    local apps = {}
    for _, a in ipairs(Config.Store or {}) do apps[#apps + 1] = { id = tostring(a.id):lower(), fixed = true } end
    for _, a in ipairs(Apps) do apps[#apps + 1] = { id = a.id, fixed = false } end
    return { ok = true, restrict = Config.Browser.restrictToAllowed ~= false, sites = sites, apps = apps,
        browser = RzBrowserConfig(), store = RzStoreList() }
end

ESX.RegisterServerCallback('rz-tablet:admin:state', function(source, cb)
    if not RzIsStaff(source) then return cb({ ok = false, err = 'forbidden' }) end
    cb(state())
end)

ESX.RegisterServerCallback('rz-tablet:admin:addSite', function(source, cb, p)
    if not RzIsStaff(source) then return cb({ ok = false, err = 'forbidden' }) end
    local host = normHost(type(p) == 'table' and p.host)
    if not host then return cb({ ok = false, err = 'host' }) end
    local ok, err = addSite(host)
    if not ok then return cb({ ok = false, err = err }) end
    broadcast()
    local r = state(); r.host = host
    cb(r)
end)

ESX.RegisterServerCallback('rz-tablet:admin:delSite', function(source, cb, p)
    if not RzIsStaff(source) then return cb({ ok = false, err = 'forbidden' }) end
    local host = type(p) == 'table' and type(p.host) == 'string' and p.host:lower() or ''
    local idx
    for i, h in ipairs(Sites) do if h == host then idx = i end end
    if not idx then return cb({ ok = false, err = RzHostCovered(host, configHosts()) and 'fixed' or 'missing' }) end
    -- une app ajoutee en jeu sur ce site serait bloquee : il faut d'abord la supprimer
    local others = {}
    for i, h in ipairs(Sites) do if i ~= idx then others[#others + 1] = h end end
    for _, h in ipairs(configHosts()) do others[#others + 1] = h end
    for _, a in ipairs(Apps) do
        local ah = hostOfUrl(a.url)
        if ah and RzHostCovered(ah, { host }) and not RzHostCovered(ah, others) then
            return cb({ ok = false, err = 'used', app = a.label })
        end
    end
    MySQL.update.await('DELETE FROM rz_tablet_sites WHERE host = ?', { host })
    table.remove(Sites, idx)
    broadcast()
    cb(state())
end)

ESX.RegisterServerCallback('rz-tablet:admin:saveApp', function(source, cb, p)
    if not RzIsStaff(source) then return cb({ ok = false, err = 'forbidden' }) end
    if type(p) ~= 'table' then return cb({ ok = false, err = 'invalid' }) end

    local label = clean(p.label, 24)
    local subtitle = clean(p.subtitle, 60)
    local category = clean(p.category, 24)
    local description = clean(p.description, 600)
    local url = clean(p.url, 300)
    local image = clean(p.image, 300)
    local color = clean(p.color, 9)
    local icon = clean(p.icon, 48):lower()
    if utf8.len(label) == nil or utf8.len(label) < 2 then return cb({ ok = false, err = 'label' }) end
    if not url:match('^https://[^%s"\'<>]+$') or not hostOfUrl(url) then return cb({ ok = false, err = 'url' }) end
    if image ~= '' and not image:match('^https://[^%s"\'<>()\\]+$') then return cb({ ok = false, err = 'image' }) end
    if color ~= '' and not color:match('^#%x%x%x%x%x%x$') then color = '' end
    if icon ~= '' and not icon:match('^[a-z0-9%-]+$') then return cb({ ok = false, err = 'icon' }) end
    if category == '' then category = 'App web' end

    local id = type(p.id) == 'string' and p.id:lower() or nil
    if id and isConfigApp(id) then return cb({ ok = false, err = 'fixed' }) end
    local existing = id and findApp(id)
    if id and not existing then return cb({ ok = false, err = 'missing' }) end
    if not existing and #Apps >= MAX_APPS then return cb({ ok = false, err = 'max' }) end

    -- le site de l'app est autorise automatiquement (sinon elle ne s'ouvrirait pas)
    local host = hostOfUrl(url)
    local addedSite = false
    if Config.Browser.restrictToAllowed and not RzHostCovered(host, RzAllowedHosts()) then
        local ok, err = addSite(host)
        if not ok then return cb({ ok = false, err = err == 'max' and 'sitesMax' or err }) end
        addedSite = true
    end

    local row = { label = label, subtitle = subtitle, category = category, url = url, image = image,
        color = color, icon = icon, description = description }
    if existing then
        MySQL.update.await([[UPDATE rz_tablet_apps SET label = ?, subtitle = ?, category = ?, url = ?, image = ?,
            color = ?, icon = ?, description = ? WHERE id = ?]],
            { label, subtitle, category, url, image, color, icon, description, existing.id })
        row.id = existing.id
        local _, i = findApp(existing.id)
        Apps[i] = rowToApp(row)
    else
        row.id = newId(label)
        MySQL.insert.await([[INSERT INTO rz_tablet_apps (id, label, subtitle, category, url, image, color, icon, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)]],
            { row.id, label, subtitle, category, url, image, color, icon, description, os.time() })
        Apps[#Apps + 1] = rowToApp(row)
    end
    broadcast()
    local r = state(); r.id = row.id; r.addedSite = addedSite and host or nil
    cb(r)
end)

ESX.RegisterServerCallback('rz-tablet:admin:delApp', function(source, cb, p)
    if not RzIsStaff(source) then return cb({ ok = false, err = 'forbidden' }) end
    local id = type(p) == 'table' and type(p.id) == 'string' and p.id:lower() or ''
    local a, i = findApp(id)
    if not a then return cb({ ok = false, err = isConfigApp(id) and 'fixed' or 'missing' }) end
    MySQL.update.await('DELETE FROM rz_tablet_apps WHERE id = ?', { id })
    table.remove(Apps, i)
    broadcast()
    cb(state())
end)
