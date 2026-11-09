-- Application Vehicules : pont vers le serveur, noms des modeles et quartiers (connus seulement du client),
-- et commande staff d'immatriculation.

local names = {} -- hash du modele -> { name, make, class }

local function text(key)
    if type(key) ~= 'string' or key == '' or key == 'CARNOTFOUND' then return nil end
    local t = GetLabelText(key)
    if t and t ~= 'NULL' then return t end
    return nil
end

local function modelInfo(model)
    model = tonumber(model)
    if not model then return {} end
    if names[model] then return names[model] end
    local info = {}
    if IsModelInCdimage(model) and IsModelAVehicle(model) then
        local disp = GetDisplayNameFromVehicleModel(model)
        info.name = text(disp) or (disp ~= 'CARNOTFOUND' and disp ~= '' and disp:sub(1, 1) .. disp:sub(2):lower() or nil)
        local make = GetMakeNameFromVehicleModel(model)
        info.make = text(make) or (make and make ~= '' and make ~= 'CARNOTFOUND' and make:sub(1, 1) .. make:sub(2):lower() or nil)
        info.class = text('VEH_CLASS_' .. GetVehicleClassFromName(model))
    end
    names[model] = info
    return info
end

local function zoneAt(v)
    if type(v.x) ~= 'number' or type(v.y) ~= 'number' then return nil end
    return text(GetNameOfZone(v.x + 0.0, v.y + 0.0, (tonumber(v.z) or 0.0) + 0.0))
end

local function enrich(list)
    if type(list) ~= 'table' then return end
    for _, v in ipairs(list) do
        local i = modelInfo(v.model)
        v.name, v.make, v.class = i.name, i.make, i.class
        v.zone = zoneAt(v)
    end
end

RegisterNUICallback('veh', function(data, cb)
    local act = type(data) == 'table' and data.act
    if act ~= 'list' and act ~= 'positions' then return cb({ ok = false }) end
    ESX.TriggerServerCallback('rz-tablet:veh:' .. act, function(res)
        if type(res) ~= 'table' or not res.ok then return cb(res or { ok = false }) end
        enrich(res.mine)
        enrich(res.list)
        if res.company then enrich(res.company.list) end
        local c = GetEntityCoords(PlayerPedId())
        res.me = { x = c.x, y = c.y }
        cb(res)
    end)
end)

-- /immatriculer [job|retirer] : le vehicule ou l'on est assis (staff seulement, verifie par le serveur)
local cmd = Config.Vehicles and Config.Vehicles.registerCommand
if cmd then
    RegisterCommand(cmd, function(_, args)
        local veh = GetVehiclePedIsIn(PlayerPedId(), false)
        if veh == 0 then return ESX.ShowNotification('Monte dans un véhicule.') end
        TriggerServerEvent('rz-tablet:veh:register', ESX.Game.GetVehicleProperties(veh), args[1])
    end, false)
end
