-- AirDrop : pont entre l'interface et le serveur, reception des demandes

local ACTS = { nearby = true, send = true, answer = true }

RegisterNUICallback('airdrop', function(data, cb)
    local act = type(data) == 'table' and data.act
    if not act or not ACTS[act] then return cb({ ok = false }) end
    ESX.TriggerServerCallback('rz-tablet:ad:' .. act, function(res)
        cb(res or { ok = false })
    end, data.a, data.b)
end)

local KIND = { note = 'une note', pos = 'une position' }

RegisterNetEvent('rz-tablet:ad:incoming', function(req)
    if type(req) ~= 'table' then return end
    SendNUIMessage({ action = 'airdrop', req = req })
    if RzIsOpen() then
        if not RzSettings.dnd and RzSettings.sound ~= false then PlaySoundFrontend(-1, 'PICK_UP', 'HUD_FRONTEND_DEFAULT_SOUNDSET', false) end
    else
        -- tablette rangee : la demande attend dans la tablette, une notification previent
        RzNotify({ app = 'system', title = 'AirDrop', body = ('%s veut te partager %s. Sors ta tablette pour répondre.'):format(tostring(req.from), KIND[req.kind] or 'un élément') })
    end
end)

RegisterNetEvent('rz-tablet:ad:result', function(res)
    if type(res) == 'table' then SendNUIMessage({ action = 'airdropResult', res = res }) end
end)

RegisterNetEvent('rz-tablet:ad:cancel', function(res)
    if type(res) == 'table' then SendNUIMessage({ action = 'airdropCancel', id = res.id }) end
end)
