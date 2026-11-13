-- Notifications de la tablette.
-- Tablette ouverte : la notification sort de l'ilot en haut de l'ecran.
-- Tablette rangee : elle depasse un instant en bas de l'ecran, juste assez pour lire la notification.
--
-- Depuis une autre ressource :
--   client : exports['rz-tablet']:Notify({ app = 'system', title = 'Titre', body = 'Texte' })
--   serveur : TriggerClientEvent('rz-tablet:notify', source, { app = 'system', title = 'Titre', body = 'Texte' })

local function hasTablet()
    local ok, slot = pcall(function() return exports.ox_inventory:GetSlotWithItem(Config.ItemName) end)
    return ok and slot ~= nil
end

local function str(v, max)
    if v == nil then return '' end
    return tostring(v):sub(1, max)
end

-- Son de notification : html/sound/notification.ogg, lu par la page NUI (marche tablette rangee aussi)
function RzPlaySound()
    SendNUIMessage({ action = 'sound', volume = Config.Notify.volume or 0.6 })
end

function RzNotify(n)
    if type(n) ~= 'table' then return end
    local data = {
        app = str(n.app or 'system', 24),
        title = str(n.title, 80),
        body = str(n.body, 240),
        open = type(n.open) == 'table' and n.open or nil,
    }

    if RzIsOpen() then
        SendNUIMessage({ action = 'notify', notif = data })
    elseif hasTablet() then
        local ped = PlayerPedId()
        local peek = Config.Notify.peek and RzSettings.peek ~= false and not RzSettings.dnd and not IsEntityDead(ped) and not IsPauseMenuActive()
        SendNUIMessage({ action = 'notify', notif = data, peek = peek, peekTime = Config.Notify.peekTime })
    else
        -- pas de tablette sur soi : simple notification du jeu
        ESX.ShowNotification(('%s : %s'):format(data.title, data.body), 'info', 6000)
        return
    end

    if Config.Notify.sound and RzSettings.sound ~= false and not RzSettings.dnd then -- Ne pas deranger : en silence
        RzPlaySound()
    end
end

-- Commande de test (active seulement avec Config.DebugCommand) : notification + son, meme sans tablette
if Config.DebugCommand then
    RegisterCommand(Config.DebugCommand .. 'notif', function()
        SendNUIMessage({ action = 'notify', notif = { app = 'system', title = 'Test', body = 'Notification de test' }, peek = not RzIsOpen(), peekTime = Config.Notify.peekTime })
        RzPlaySound()
    end, false)
end

exports('Notify', RzNotify)
RegisterNetEvent('rz-tablet:notify', RzNotify)
