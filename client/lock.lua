-- Verrouillage : pont entre l'interface et le serveur (la tablette en main est RzSlot)

-- Masque porte (composant 1 des personnages multijoueur) : Face ID ne peut pas reconnaitre le visage
local FREEMODE = { [GetHashKey('mp_m_freemode_01')] = true, [GetHashKey('mp_f_freemode_01')] = true }
local function wearsMask()
    local ped = PlayerPedId()
    return FREEMODE[GetEntityModel(ped)] == true and GetPedDrawableVariation(ped, 1) > 0
end

RegisterNUICallback('lockVerify', function(data, cb)
    if type(data) == 'table' and type(data.proof) == 'table' and data.proof.face and wearsMask() then
        return cb({ ok = false, mask = true })
    end
    ESX.TriggerServerCallback('rz-tablet:lock:verify', function(res)
        cb(res or { ok = false })
    end, RzSlot, type(data) == 'table' and data.proof or nil)
end)

RegisterNUICallback('lockSet', function(data, cb)
    if type(data) ~= 'table' then return cb({ ok = false }) end
    ESX.TriggerServerCallback('rz-tablet:lock:set', function(res)
        cb(res or { ok = false })
    end, RzSlot, { mode = data.mode, pin = data.pin, current = data.current })
end)
