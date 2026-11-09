-- Verrouillage de la tablette : aucun / code a 4 chiffres / Face ID.
-- Le verrou est lie a l'OBJET (numero de serie dans les metadonnees ox_inventory), pas au personnage :
-- une tablette volee reste verrouillee. Face ID reconnait uniquement le personnage qui l'a enrole.
-- Le code est stocke sous forme de condense (GetHashKey sale avec le numero de serie), ce qui masque
-- le code dans la base mais ne remplace pas un vrai chiffrement : c'est un code de jeu.

RzLock = {}

local FAIL_MAX, FAIL_WAIT_MS = 5, 30000
local fails = {} -- "source:serial" -> { n, untilMs }

MySQL.ready(function()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS rz_tablet_locks (
            serial VARCHAR(40) NOT NULL PRIMARY KEY,
            owner VARCHAR(80) NOT NULL,
            mode VARCHAR(8) NOT NULL,
            pin_hash VARCHAR(20) NOT NULL DEFAULT ''
        )
    ]])
end)

local function validPin(p) return type(p) == 'string' and p:match('^%d%d%d%d$') ~= nil end
local function hashPin(serial, pin) return tostring(GetHashKey(('rz:%s:%s'):format(serial, pin))) end

-- l'objet doit etre une tablette presente dans l'inventaire du joueur
local function tablet(src, slot)
    slot = tonumber(slot)
    if not slot then return nil end
    local item = exports.ox_inventory:GetSlot(src, slot)
    if item and item.name == Config.ItemName then return item, slot end
end

local function rowFor(item)
    local serial = item.metadata and item.metadata.rz_serial
    if not serial then return nil, nil end
    return MySQL.single.await('SELECT * FROM rz_tablet_locks WHERE serial = ?', { serial }), serial
end

-- Verifie une preuve ({ face = true } ou { pin = '1234' }) avec limitation des essais
local function check(src, serial, row, proof)
    local key = src .. ':' .. serial
    local now = GetGameTimer()
    local f = fails[key]
    if f and f.untilMs and now < f.untilMs then return false, math.ceil((f.untilMs - now) / 1000) end

    local ok = false
    if type(proof) == 'table' then
        if proof.face == true then
            local xPlayer = ESX.GetPlayerFromId(src)
            ok = row.mode == 'face' and xPlayer ~= nil and row.owner == xPlayer.identifier
        elseif validPin(proof.pin) then
            ok = hashPin(serial, proof.pin) == row.pin_hash
        end
    end
    if ok then fails[key] = nil return true, 0 end

    f = f or { n = 0 }
    f.n = f.n + 1
    if f.n >= FAIL_MAX then
        f.n, f.untilMs = 0, now + FAIL_WAIT_MS
        fails[key] = f
        return false, math.ceil(FAIL_WAIT_MS / 1000)
    end
    fails[key] = f
    return false, 0
end

-- Tablettes deverrouillees depuis leur ouverture ("source:serial") : les donnees de la tablette
-- (notes...) ne sont envoyees qu'une fois le verrou passe, meme si l'interface est contournee.
local unlocked = {}

-- Numero de serie : cree a la premiere donnee enregistree dans la tablette (verrou, note...)
local function assignSerial(src, item, slotNum)
    local serial = ('RZT-%d-%d'):format(os.time(), math.random(100000, 999999))
    local meta = {}
    for k, v in pairs(item.metadata or {}) do meta[k] = v end
    meta.rz_serial = serial
    exports.ox_inventory:SetMetadata(src, slotNum, meta)
    return serial
end

-- Pour les autres modules (notes) : la tablette en main existe-t-elle, et son numero de serie
-- retourne false si l'objet n'est pas une tablette du joueur, sinon true + serial (nil si aucun et create = false)
function RzLock.serial(src, slot, create)
    local item, slotNum = tablet(src, slot)
    if not item then return false end
    local serial = item.metadata and item.metadata.rz_serial
    if not serial and create then serial = assignSerial(src, item, slotNum) end
    return true, serial
end

-- Acces aux donnees : pas de verrou sur cette tablette, ou verrou passe depuis l'ouverture
function RzLock.isUnlocked(src, serial)
    if not serial then return true end
    local row = MySQL.single.await('SELECT mode FROM rz_tablet_locks WHERE serial = ?', { serial })
    if not row then return true end
    return unlocked[src .. ':' .. serial] == true
end

-- Etat envoye a l'interface a l'ouverture : seulement le mode, jamais le code
function RzLock.state(src, slot)
    local item = tablet(src, slot)
    if not item then return { mode = 'none' } end
    local row, serial = rowFor(item)
    if serial then unlocked[src .. ':' .. serial] = nil end   -- chaque ouverture se refait deverrouiller
    return { mode = row and row.mode or 'none' }
end

ESX.RegisterServerCallback('rz-tablet:lock:state', function(source, cb, slot)
    cb(RzLock.state(source, slot))
end)

ESX.RegisterServerCallback('rz-tablet:lock:verify', function(source, cb, slot, proof)
    local item = tablet(source, slot)
    if not item then return cb({ ok = true }) end
    local row, serial = rowFor(item)
    if not row then return cb({ ok = true }) end
    local ok, wait = check(source, serial, row, proof)
    if ok then unlocked[source .. ':' .. serial] = true end
    cb({ ok = ok, wait = wait })
end)

-- p = { mode = 'none'|'pin'|'face', pin = '1234'?, current = { pin = '....' }? }
ESX.RegisterServerCallback('rz-tablet:lock:set', function(source, cb, slot, p)
    local xPlayer = ESX.GetPlayerFromId(source)
    local item, slotNum = tablet(source, slot)
    if not xPlayer or not item or type(p) ~= 'table' then return cb({ ok = false, err = 'item' }) end
    if p.mode ~= 'none' and p.mode ~= 'pin' and p.mode ~= 'face' then return cb({ ok = false, err = 'mode' }) end

    local row, serial = rowFor(item)

    -- modifier un verrou existant demande la preuve du code actuel
    if row then
        local ok, wait = check(source, serial, row, p.current)
        if not ok then return cb({ ok = false, err = 'wrong', wait = wait }) end
    end

    if p.mode == 'none' then
        if row then MySQL.update.await('DELETE FROM rz_tablet_locks WHERE serial = ?', { serial }) end
        return cb({ ok = true, mode = 'none' })
    end

    local pinHash = row and row.pin_hash or ''
    if p.pin ~= nil then
        if not validPin(p.pin) then return cb({ ok = false, err = 'pin' }) end
    elseif pinHash == '' then
        return cb({ ok = false, err = 'pin' })
    end

    if not serial then serial = assignSerial(source, item, slotNum) end
    if p.pin ~= nil then pinHash = hashPin(serial, p.pin) end

    MySQL.update.await(
        'INSERT INTO rz_tablet_locks (serial, owner, mode, pin_hash) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE owner = VALUES(owner), mode = VALUES(mode), pin_hash = VALUES(pin_hash)',
        { serial, xPlayer.identifier, p.mode, pinHash })
    unlocked[source .. ':' .. serial] = true   -- celui qui pose le verrou vient de prouver qu'il le connait
    cb({ ok = true, mode = p.mode })
end)

AddEventHandler('playerDropped', function()
    local prefix = tostring(source) .. ':'
    for k in pairs(fails) do
        if k:sub(1, #prefix) == prefix then fails[k] = nil end
    end
    for k in pairs(unlocked) do
        if k:sub(1, #prefix) == prefix then unlocked[k] = nil end
    end
end)
