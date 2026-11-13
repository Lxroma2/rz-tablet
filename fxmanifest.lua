fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'rz-tablet'
description 'Tablette item (ESX) : navigateur, Services, App, Notes, Calculatrice, Carte, Vehicules, Banque, AirDrop, notifications, verrouillage'
version '0.1.0'

shared_scripts {
    '@es_extended/imports.lua',
    'config.lua',
}

client_scripts { 'client/dui.lua', 'client/main.lua', 'client/services.lua', 'client/lock.lua', 'client/notify.lua', 'client/notes.lua', 'client/map.lua', 'client/vehicles.lua', 'client/bank.lua', 'client/airdrop.lua', 'client/widgets.lua' }
server_scripts { '@oxmysql/lib/MySQL.lua', 'server/main.lua', 'server/admin.lua', 'server/services.lua', 'server/lock.lua', 'server/notes.lua', 'server/vehicles.lua', 'server/bank.lua', 'server/airdrop.lua' }

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/loading.html',
    'html/css/base.css',
    'html/css/home.css',
    'html/css/browser.css',
    'html/css/settings.css',
    'html/css/services.css',
    'html/css/window.css',
    'html/css/preferences.css',
    'html/css/lock.css',
    'html/css/notify.css',
    'html/css/store.css',
    'html/css/home-edit.css',
    'html/css/notes.css',
    'html/css/calc.css',
    'html/css/map.css',
    'html/css/vehicles.css',
    'html/css/bank.css',
    'html/css/airdrop.css',
    'html/css/cc.css',
    'html/css/widgets.css',
    'html/css/switcher.css',
    'html/css/search.css',
    'html/js/app/core.js',
    'html/js/app/browser.js',
    'html/js/app/window.js',
    'html/js/app/settings.js',
    'html/js/app/main.js',
    'html/js/services.js',
    'html/js/notify.js',
    'html/js/home.js',
    'html/js/store.js',
    'html/js/lock.js',
    'html/js/notes.js',
    'html/js/calc.js',
    'html/js/map.js',
    'html/js/vehicles.js',
    'html/js/bank.js',
    'html/js/airdrop.js',
    'html/js/cc.js',
    'html/js/widgets.js',
    'html/js/switcher.js',
    'html/js/search.js',
    'html/js/admin.js',
    'html/assets/leaflet/leaflet.js',
    'html/assets/leaflet/leaflet.css',
    'html/assets/map/**/*.webp',
    'html/assets/icons/duotone.json',
    'html/sound/notification.ogg',
    'html/assets/icons/*.png',
    'html/assets/icons/*.jpg',
    'html/assets/icons/*.jpeg',
    'html/assets/icons/*.webp',
}
