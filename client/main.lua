local isOpen = false
local tabletProp = nil
local typing = false

local function loadDict(dict)
    RequestAnimDict(dict)
    local t = GetGameTimer() + 5000
    while not HasAnimDictLoaded(dict) and GetGameTimer() < t do Wait(0) end
end

local function attachProp()
    local model = Config.Prop.model
    RequestModel(model)
    local t = GetGameTimer() + 5000
    while not HasModelLoaded(model) and GetGameTimer() < t do Wait(0) end
    local ped = PlayerPedId()
    tabletProp = CreateObject(model, 0.0, 0.0, 0.0, true, true, false)
    local p, r = Config.Prop.pos, Config.Prop.rot
    AttachEntityToEntity(tabletProp, ped, GetPedBoneIndex(ped, Config.Prop.bone),
        p.x, p.y, p.z, r.x, r.y, r.z, true, true, false, true, 1, true)
    SetModelAsNoLongerNeeded(model)
end

local function cleanup()
    local ped = PlayerPedId()
    StopAnimTask(ped, Config.Anim.dict, Config.Anim.name, 1.0)
    if tabletProp and DoesEntityExist(tabletProp) then DeleteEntity(tabletProp) end
    tabletProp = nil
end

function RzIsOpen() return isOpen end

local function closeTablet()
    if not isOpen then return end
    isOpen = false
    typing = false
    RzDui.destroy()
    SetNuiFocusKeepInput(false)
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
    cleanup()
end

RegisterNetEvent('rz-tablet:open', function(_, info)
    if isOpen then return end
    local ped = PlayerPedId()
    if IsEntityDead(ped) or IsPedInAnyVehicle(ped, false) then
        ESX.ShowNotification('Tu ne peux pas utiliser la tablette maintenant.')
        return
    end

    -- ox_inventory passe l'emplacement de l'objet utilise : le verrou est lie a cette tablette
    RzSlot = type(info) == 'table' and tonumber(info.slot) or nil

    ESX.TriggerServerCallback('rz-tablet:getConfig', function(browser)
        ESX.TriggerServerCallback('rz-tablet:lock:state', function(lock)
            isOpen = true
            loadDict(Config.Anim.dict)
            TaskPlayAnim(ped, Config.Anim.dict, Config.Anim.name, 3.0, 3.0, -1, 49, 0, false, false, false)
            attachProp()
            typing = false
            SetNuiFocus(true, true)
            SetNuiFocusKeepInput(RzSettings.allowWalk)
            SendNUIMessage({
                action = 'open',
                browser = browser,
                defaults = { walkOpacity = Config.WalkOpacity, allowWalk = Config.AllowWalk },
                lock = lock,
                store = Config.Store,
                icons = Config.AppIcons,
            })
        end, RzSlot)
    end)
end)

-- Touche d'ouverture : ouvre la premiere tablette de l'inventaire (meme verrou que l'objet)
RegisterCommand('tablette', function()
    if isOpen then return closeTablet() end
    local slot = exports.ox_inventory:GetSlotWithItem(Config.ItemName)
    if not slot then
        ESX.ShowNotification("Tu n'as pas de tablette.")
        return
    end
    TriggerEvent('rz-tablet:open', nil, { slot = slot.slot })
end, false)
RegisterKeyMapping('tablette', 'Ouvrir la tablette', 'keyboard', Config.OpenKey or 'F3')

-- Le site autorise-t-il l'iframe ? (verifie cote serveur)
RegisterNUICallback('canFrame', function(data, cb)
    ESX.TriggerServerCallback('rz-tablet:canFrame', function(ok)
        cb({ ok = ok })
    end, data.url)
end)

-- Preferences envoyees par l'application Reglages
RegisterNUICallback('settings', function(data, cb)
    if type(data.walkOpacity) == 'number' then
        RzSettings.walkOpacity = math.max(0.1, math.min(1.0, data.walkOpacity))
    end
    if type(data.peek) == 'boolean' then RzSettings.peek = data.peek end
    if type(data.dnd) == 'boolean' then RzSettings.dnd = data.dnd end
    if type(data.sound) == 'boolean' then RzSettings.sound = data.sound end
    if type(data.airdrop) == 'boolean' and data.airdrop ~= RzSettings.airdrop then
        RzSettings.airdrop = data.airdrop
        TriggerServerEvent('rz-tablet:ad:receiving', data.airdrop)
    end
    if type(data.allowWalk) == 'boolean' then
        RzSettings.allowWalk = data.allowWalk and Config.AllowWalk -- le serveur peut verrouiller la marche
        if isOpen then SetNuiFocusKeepInput(RzSettings.allowWalk and not typing) end
    end
    cb('ok')
end)

RegisterNUICallback('close', function(_, cb)
    closeTablet()
    cb('ok')
end)

-- Le joueur tape dans la tablette (barre d'adresse ou page) : on coupe le clavier du jeu
RegisterNUICallback('typing', function(data, cb)
    typing = data and data.state == true
    if isOpen then SetNuiFocusKeepInput(RzSettings.allowWalk and not typing) end
    cb('ok')
end)

-- Marche autorisee : on bloque camera, combat, menu pause et vehicules
CreateThread(function()
    while true do
        if isOpen and RzSettings.allowWalk then
            DisableControlAction(0, 1, true)   -- regard X
            DisableControlAction(0, 2, true)   -- regard Y
            DisableControlAction(0, 24, true)  -- attaque
            DisableControlAction(0, 25, true)  -- viser
            DisableControlAction(0, 257, true)
            DisableControlAction(0, 140, true)
            DisableControlAction(0, 141, true)
            DisableControlAction(0, 142, true)
            DisableControlAction(0, 263, true)
            DisableControlAction(0, 264, true)
            DisableControlAction(0, 37, true)  -- roue des armes
            DisableControlAction(0, 23, true)  -- monter en vehicule
            DisableControlAction(0, 199, true) -- pause
            DisableControlAction(0, 200, true) -- pause (echap)
            DisableControlAction(0, 202, true)

            -- Echap : ferme seulement la tablette. Si le jeu a quand meme ouvert son menu pause
            -- (la carte), on le referme tout de suite.
            if IsPauseMenuActive() then SetPauseMenuActive(false) end
            if not typing and IsDisabledControlJustPressed(0, 200) then closeTablet() end
            Wait(0)
        else
            Wait(250)
        end
    end
end)

-- Translucide quand le joueur marche
CreateThread(function()
    local walking = false
    while true do
        if isOpen and RzSettings.allowWalk then
            local moving = GetEntitySpeed(PlayerPedId()) > 0.3
            if moving ~= walking then
                walking = moving
                SendNUIMessage({ action = 'walking', state = walking, opacity = RzSettings.walkOpacity })
                RzDui.setTranslucent(walking)
            end
            Wait(100)
        else
            if walking then
                walking = false
                RzDui.setTranslucent(false)
            end
            Wait(250)
        end
    end
end)

-- Securite : fermer si mort
CreateThread(function()
    while true do
        Wait(500)
        if isOpen and IsEntityDead(PlayerPedId()) then closeTablet() end
    end
end)

AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    RzDui.destroy()
    if isOpen then SetNuiFocusKeepInput(false) SetNuiFocus(false, false) end
    cleanup()
end)
