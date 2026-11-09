-- Application Services : pont entre l'interface et le serveur

local ALLOWED = { list = true, jobs = true, save = true, delete = true, send = true, threads = true, thread = true, reply = true }

RegisterNUICallback('svc', function(data, cb)
    local act = type(data) == 'table' and data.act
    if not act or not ALLOWED[act] then return cb({ ok = false }) end
    ESX.TriggerServerCallback('rz-tablet:svc:' .. act, function(res)
        cb(res or { ok = false })
    end, data.payload)
end)

-- Itineraire vers une position (entreprise ou expediteur d'un message)
RegisterNUICallback('svcWaypoint', function(data, cb)
    if type(data) == 'table' and type(data.x) == 'number' and type(data.y) == 'number' then
        SetNewWaypoint(data.x + 0.0, data.y + 0.0)
        ESX.ShowNotification('Itineraire defini sur la carte.')
    end
    cb('ok')
end)

-- Nouveau message dans une conversation : notification de la tablette
RegisterNetEvent('rz-tablet:svc:incoming', function(m)
    if type(m) ~= 'table' then return end
    local body = m.text or ''
    if m.hasPos and body ~= 'Position partagee' then body = body .. ' (position jointe)' end
    RzNotify({
        app = 'services',
        title = ('%s · %s'):format(m.from or '?', m.service or '?'),
        body = body,
        open = { view = 'services', tid = m.tid, role = m.role, serviceId = m.serviceId, service = m.service, name = m.name, image = m.image },
    })
    SendNUIMessage({ action = 'svcIncoming' })
end)
