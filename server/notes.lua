-- Application Notes : les notes sont liees a la TABLETTE (numero de serie de l'objet), comme le verrou.
-- Donner ou voler la tablette donne ses notes ; si elle est verrouillee, il faut d'abord la deverrouiller.

local saveTimes = {} -- source -> GetGameTimer() du dernier enregistrement

MySQL.ready(function()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS rz_tablet_notes (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            serial VARCHAR(40) NOT NULL,
            body TEXT NOT NULL,
            updated_at INT NOT NULL,
            INDEX idx_rz_notes_serial (serial)
        )
    ]])
end)

local function limits()
    local c = Config.Notes or {}
    return tonumber(c.maxNotes) or 100, tonumber(c.maxLength) or 4000
end

-- tablette du joueur + numero de serie + verrou passe ; err = 'tablet' | 'locked'
local function access(src, slot, create)
    local ok, serial = RzLock.serial(src, slot, create)
    if not ok then return nil, 'tablet' end
    if not RzLock.isUnlocked(src, serial) then return nil, 'locked' end
    return serial or false
end

ESX.RegisterServerCallback('rz-tablet:notes:list', function(source, cb, slot)
    local serial, err = access(source, slot, false)
    if serial == nil then return cb({ ok = false, err = err }) end
    if not serial then return cb({ ok = true, notes = {} }) end
    local maxNotes = limits()
    local rows = MySQL.query.await('SELECT id, body, updated_at FROM rz_tablet_notes WHERE serial = ? ORDER BY updated_at DESC LIMIT ?', { serial, maxNotes })
    local notes = {}
    for i, r in ipairs(rows or {}) do notes[i] = { id = r.id, body = r.body, updated = r.updated_at } end
    cb({ ok = true, notes = notes })
end)

-- p = { id = number?, body = string }
ESX.RegisterServerCallback('rz-tablet:notes:save', function(source, cb, slot, p)
    if type(p) ~= 'table' or type(p.body) ~= 'string' then return cb({ ok = false, err = 'data' }) end
    local now = GetGameTimer()
    if saveTimes[source] and now - saveTimes[source] < 250 then return cb({ ok = false, err = 'rate' }) end
    saveTimes[source] = now

    local maxNotes, maxLength = limits()
    local body = p.body
    if #body > maxLength then return cb({ ok = false, err = 'long', max = maxLength }) end

    local serial, err = access(source, slot, true)
    if not serial then return cb({ ok = false, err = err or 'tablet' }) end

    local ts = os.time()
    local id = tonumber(p.id)
    if id then
        local n = MySQL.update.await('UPDATE rz_tablet_notes SET body = ?, updated_at = ? WHERE id = ? AND serial = ?', { body, ts, id, serial })
        if n and n > 0 then return cb({ ok = true, id = id, updated = ts }) end
    end
    local count = MySQL.scalar.await('SELECT COUNT(*) FROM rz_tablet_notes WHERE serial = ?', { serial }) or 0
    if count >= maxNotes then return cb({ ok = false, err = 'full', max = maxNotes }) end
    local newId = MySQL.insert.await('INSERT INTO rz_tablet_notes (serial, body, updated_at) VALUES (?, ?, ?)', { serial, body, ts })
    cb({ ok = newId ~= nil, id = newId, updated = ts })
end)

-- p = { id = number }
ESX.RegisterServerCallback('rz-tablet:notes:delete', function(source, cb, slot, p)
    local id = type(p) == 'table' and tonumber(p.id)
    if not id then return cb({ ok = false, err = 'data' }) end
    local serial, err = access(source, slot, false)
    if not serial then return cb({ ok = serial == false, err = err }) end
    MySQL.update.await('DELETE FROM rz_tablet_notes WHERE id = ? AND serial = ?', { id, serial })
    cb({ ok = true })
end)

AddEventHandler('playerDropped', function()
    saveTimes[source] = nil
end)
