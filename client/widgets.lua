-- Widget Meteo de l'accueil : temps qu'il fait et heure du jeu.
-- Le temps vient de cd_easytime s'il tourne (exports.cd_easytime:GetWeather().weather),
-- sinon de la meteo du jeu comparee aux noms connus.

local NAMES = { 'EXTRASUNNY', 'CLEAR', 'NEUTRAL', 'SMOG', 'FOGGY', 'OVERCAST', 'CLOUDS', 'CLEARING', 'RAIN', 'THUNDER',
    'SNOW', 'BLIZZARD', 'SNOWLIGHT', 'XMAS', 'HALLOWEEN' }
local byHash = {}
for _, n in ipairs(NAMES) do byHash[GetHashKey(n)] = n end

local function weatherName()
    if GetResourceState('cd_easytime') == 'started' then
        local ok, w = pcall(function() return exports.cd_easytime:GetWeather() end)
        if ok and type(w) == 'table' and type(w.weather) == 'string' then return w.weather end
    end
    local ok, hash = pcall(GetPrevWeatherTypeHashName)
    if ok and hash then return byHash[hash] end
    return nil
end

RegisterNUICallback('gameInfo', function(_, cb)
    cb({ ok = true, weather = weatherName(), h = GetClockHours(), m = GetClockMinutes() })
end)
