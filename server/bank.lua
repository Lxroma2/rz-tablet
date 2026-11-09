-- Application Banque : solde du compte ESX et historique des entrees / sorties (pas de virement).
-- ESX previent a chaque mouvement d'argent (esx:addAccountMoney / removeAccountMoney / setAccountMoney,
-- evenements serveur) : on note ceux du compte suivi dans rz_tablet_bank_log. L'historique commence donc
-- a l'installation, et le motif est celui donne par le script qui a verse ou retire l'argent.

local B = Config.Bank or {}
local ACC = B.account or 'bank'
local lastBal = {}  -- identifiant -> solde apres la derniere operation notee
local lastGet = {}

MySQL.ready(function()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS rz_tablet_bank_log (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            identifier VARCHAR(60) NOT NULL,
            amount BIGINT NOT NULL,
            balance BIGINT NULL,
            reason VARCHAR(100) NOT NULL DEFAULT '',
            created_at INT NOT NULL,
            INDEX idx_rz_bank (identifier, id)
        )
    ]])
    local days = tonumber(B.keepDays) or 60
    if days > 0 then
        MySQL.update.await('DELETE FROM rz_tablet_bank_log WHERE created_at < ?', { os.time() - days * 86400 })
    end
end)

local function balanceOf(xPlayer)
    local acc = xPlayer.getAccount(ACC)
    return acc and tonumber(acc.money) or 0
end

local function log(src, delta, reason)
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer or not delta or delta == 0 then return end
    local bal = balanceOf(xPlayer)
    lastBal[xPlayer.identifier] = bal
    MySQL.insert('INSERT INTO rz_tablet_bank_log (identifier, amount, balance, reason, created_at) VALUES (?, ?, ?, ?, ?)',
        { xPlayer.identifier, math.floor(delta), bal, tostring(reason or ''):sub(1, 100), os.time() })
end

AddEventHandler('esx:addAccountMoney', function(src, account, money, reason)
    if account == ACC then log(src, tonumber(money), reason) end
end)

AddEventHandler('esx:removeAccountMoney', function(src, account, money, reason)
    if account == ACC then log(src, -(tonumber(money) or 0), reason) end
end)

-- setAccountMoney donne le nouveau solde : l'ecart se calcule avec le dernier solde connu.
-- Sans solde connu (premiere fois), on retient seulement le solde, sans ligne d'historique.
AddEventHandler('esx:setAccountMoney', function(src, account, money, reason)
    if account ~= ACC then return end
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end
    local id = xPlayer.identifier
    local prev = lastBal[id]
    if prev == nil then
        prev = MySQL.scalar.await('SELECT balance FROM rz_tablet_bank_log WHERE identifier = ? ORDER BY id DESC LIMIT 1', { id })
    end
    money = tonumber(money)
    if prev == nil or not money then lastBal[id] = money; return end
    log(src, money - prev, reason)
end)

-- before = id de la plus ancienne operation deja affichee (page suivante), nil pour la premiere page
ESX.RegisterServerCallback('rz-tablet:bank:get', function(source, cb, before)
    local now = GetGameTimer()
    if lastGet[source] and now - lastGet[source] < 300 then return cb({ ok = false, err = 'rate' }) end
    lastGet[source] = now
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return cb({ ok = false }) end

    local id, limit = xPlayer.identifier, 40
    before = tonumber(before)
    local rows
    if before then
        rows = MySQL.query.await('SELECT id, amount, balance, reason, created_at FROM rz_tablet_bank_log WHERE identifier = ? AND id < ? ORDER BY id DESC LIMIT ?', { id, before, limit + 1 })
    else
        rows = MySQL.query.await('SELECT id, amount, balance, reason, created_at FROM rz_tablet_bank_log WHERE identifier = ? ORDER BY id DESC LIMIT ?', { id, limit + 1 })
    end
    rows = rows or {}
    local entries = {}
    for i = 1, math.min(#rows, limit) do
        local r = rows[i]
        entries[i] = { id = r.id, amount = tonumber(r.amount), balance = tonumber(r.balance), reason = r.reason, ts = r.created_at }
    end

    local out = { ok = true, entries = entries, more = #rows > limit, balance = balanceOf(xPlayer) }
    if not before then
        local s = MySQL.single.await([[
            SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS income,
                   COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS spent
            FROM rz_tablet_bank_log WHERE identifier = ? AND created_at >= ?
        ]], { id, os.time() - 7 * 86400 }) or {}
        out.income, out.spent = tonumber(s.income) or 0, tonumber(s.spent) or 0
        out.owner = xPlayer.getName()
        out.name = B.name or 'Banque'
        out.currency = B.currency or '$'
    end
    cb(out)
end)

AddEventHandler('playerDropped', function()
    local xPlayer = ESX.GetPlayerFromId(source)
    if xPlayer then lastBal[xPlayer.identifier] = nil end
    lastGet[source] = nil
end)
