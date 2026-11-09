-- Application Banque : pont vers le serveur, et rafraichissement quand le solde change

RegisterNUICallback('bank', function(data, cb)
    local before = type(data) == 'table' and tonumber(data.before) or nil
    ESX.TriggerServerCallback('rz-tablet:bank:get', function(res)
        cb(res or { ok = false })
    end, before)
end)

-- ESX envoie ce message au client a chaque changement d'un compte (evenement reseau : a declarer ici aussi)
RegisterNetEvent('esx:setAccountMoney', function(account)
    if type(account) == 'table' and account.name == ((Config.Bank or {}).account or 'bank') then
        SendNUIMessage({ action = 'bankChanged' })
    end
end)
