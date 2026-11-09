-- Application Carte : position du joueur, nom des rues, itineraire GPS

-- Position et cap du joueur, et le point GPS actuel s'il y en a un
RegisterNUICallback('mapPos', function(_, cb)
    local ped = PlayerPedId()
    local c = GetEntityCoords(ped)
    local out = { x = c.x, y = c.y, h = GetEntityHeading(ped) }
    local blip = GetFirstBlipInfoId(8) -- 8 = point de destination
    if DoesBlipExist(blip) then
        local w = GetBlipInfoIdCoord(blip)
        out.wx, out.wy = w.x, w.y
    end
    cb(out)
end)

local function label(key)
    if not key or key == '' then return nil end
    local t = GetLabelText(key)
    if not t or t == 'NULL' then return nil end
    return t
end

-- Rue et quartier d'un point de la carte
RegisterNUICallback('mapInfo', function(data, cb)
    if type(data) ~= 'table' or type(data.x) ~= 'number' or type(data.y) ~= 'number' then return cb({}) end
    local z = GetEntityCoords(PlayerPedId()).z
    local s1, s2 = GetStreetNameAtCoord(data.x + 0.0, data.y + 0.0, z)
    local street = s1 and s1 ~= 0 and GetStreetNameFromHashKey(s1) or nil
    local cross = s2 and s2 ~= 0 and GetStreetNameFromHashKey(s2) or nil
    if street == '' then street = nil end
    if cross == '' then cross = nil end
    cb({ street = street, cross = cross, zone = label(GetNameOfZone(data.x + 0.0, data.y + 0.0, z)) })
end)

-- Itineraire (ou suppression du point si clear = true)
RegisterNUICallback('mapWaypoint', function(data, cb)
    if type(data) == 'table' then
        if data.clear then
            SetWaypointOff()
        elseif type(data.x) == 'number' and type(data.y) == 'number' then
            SetNewWaypoint(data.x + 0.0, data.y + 0.0)
        end
    end
    cb('ok')
end)
