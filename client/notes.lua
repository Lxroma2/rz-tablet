-- Application Notes : pont entre l'interface et le serveur (la tablette en main est RzSlot)

local ALLOWED = { list = true, save = true, delete = true }

RegisterNUICallback('notes', function(data, cb)
    local act = type(data) == 'table' and data.act
    if not act or not ALLOWED[act] then return cb({ ok = false }) end
    ESX.TriggerServerCallback('rz-tablet:notes:' .. act, function(res)
        cb(res or { ok = false })
    end, RzSlot, data.payload)
end)
