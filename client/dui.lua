-- Rendu des pages web via DUI : la page est dessinee en jeu (DrawSprite) derriere la NUI,
-- et la NUI nous renvoie la position de la zone "trou" + les evenements souris.
RzDui = {}

-- Preferences modifiables par le joueur depuis l'application Reglages (valeurs par defaut = Config)
RzSettings = { walkOpacity = Config.WalkOpacity, allowWalk = Config.AllowWalk, peek = true, dnd = false, airdrop = true, sound = true }

local dui, dict, tex, curW, curH
local counter = 0
local alpha, targetAlpha = 255.0, 255.0
local layout = { visible = false, cx = 0.5, cy = 0.5, w = 0.5, h = 0.5 }

local function create(w, h)
    counter = counter + 1
    dict = ('rz_tablet_dict_%d'):format(counter)
    tex = ('rz_tablet_tex_%d'):format(counter)
    dui = CreateDui(('nui://%s/html/loading.html'):format(GetCurrentResourceName()), w, h)
    local handle = GetDuiHandle(dui)
    local txd = CreateRuntimeTxd(dict)
    CreateRuntimeTextureFromDuiHandle(txd, tex, handle)
    curW, curH = w, h
end

function RzDui.setTranslucent(on)
    targetAlpha = on and (RzSettings.walkOpacity * 255.0) or 255.0
end

function RzDui.destroy()
    layout.visible = false
    alpha, targetAlpha = 255.0, 255.0
    if dui then
        SetDuiUrl(dui, 'about:blank')
        DestroyDui(dui)
        dui = nil
    end
end

function RzDui.load(url, w, h)
    local maxW, maxH = Config.Dui.maxWidth, Config.Dui.maxHeight
    w = math.max(320, math.min(math.floor(w), maxW))
    h = math.max(240, math.min(math.floor(h), maxH))
    if dui and (w ~= curW or h ~= curH) then RzDui.destroy() end
    if not dui then
        create(w, h)
        -- laisse la page "Chargement" s'afficher avant de lancer la vraie navigation
        local d = dui
        CreateThread(function()
            Wait(400)
            if dui == d then SetDuiUrl(d, url) end
        end)
        return
    end
    SetDuiUrl(dui, url)
end

RegisterNUICallback('duiLoad', function(data, cb)
    if data and type(data.url) == 'string' then
        RzDui.load(data.url, data.w or 960, data.h or 540)
    end
    cb('ok')
end)

RegisterNUICallback('duiStop', function(_, cb)
    RzDui.destroy()
    cb('ok')
end)

RegisterNUICallback('duiLayout', function(data, cb)
    layout.visible = data.visible == true
    layout.cx, layout.cy, layout.w, layout.h = data.cx, data.cy, data.w, data.h
    cb('ok')
end)

RegisterNUICallback('duiMouse', function(data, cb)
    cb('ok')
    if not dui then return end
    local t = data.t
    if t == 'move' then
        SendDuiMouseMove(dui, math.floor(data.x), math.floor(data.y))
    elseif t == 'down' then
        SendDuiMouseDown(dui, data.button)
    elseif t == 'up' then
        SendDuiMouseUp(dui, data.button)
    elseif t == 'wheel' then
        local k = Config.Dui.wheelScale
        SendDuiMouseWheel(dui, math.floor((data.dy or 0) * k), math.floor((data.dx or 0) * k))
    end
end)

-- ---------- Saisie clavier (EXPERIMENTAL) ----------
-- FiveM n'a pas de native clavier pour le DUI : on injecte du JavaScript dans la page
-- via une URL "javascript:". Peut etre bloque par certains sites (CSP).
local function urlencode(str)
    return (str:gsub('[^%w]', function(c) return ('%%%02X'):format(c:byte()) end))
end

local function runJs(js)
    if dui then SetDuiUrl(dui, 'javascript:' .. urlencode(js)) end
end

local JS_PREFIX = [[var e=document.activeElement;while(e&&e.shadowRoot&&e.shadowRoot.activeElement)e=e.shadowRoot.activeElement;
function ed(t,b,f){if(!e)return;if(e.tagName==='INPUT'||e.tagName==='TEXTAREA'){var v=e.value,s=e.selectionStart,n=e.selectionEnd;if(s==null){s=n=v.length;}if(s===n){s=Math.max(0,s-b);n=Math.min(v.length,n+f);}var nv=v.slice(0,s)+t+v.slice(n);var d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e),'value');if(d&&d.set){d.set.call(e,nv);}else{e.value=nv;}var p=s+t.length;try{e.setSelectionRange(p,p);}catch(x){}e.dispatchEvent(new Event('input',{bubbles:true}));}else if(e.isContentEditable){if(t){document.execCommand('insertText',false,t);}else if(b){document.execCommand('delete');}else if(f){document.execCommand('forwardDelete');}}}
]]

local KEYS = {
    Backspace = "ed('',1,0);",
    Delete = "ed('',0,1);",
    Enter = "if(e){if(e.tagName==='TEXTAREA'||e.isContentEditable){document.execCommand('insertText',false,'\\n');}else{var o={key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true};var d=e.dispatchEvent(new KeyboardEvent('keydown',o));e.dispatchEvent(new KeyboardEvent('keypress',o));e.dispatchEvent(new KeyboardEvent('keyup',o));if(d&&e.form){if(e.form.requestSubmit){e.form.requestSubmit();}else{e.form.submit();}}}}",
    Tab = "var l=[].slice.call(document.querySelectorAll('input:not([type=hidden]),textarea,select,button,a[href],[tabindex]')).filter(function(x){return !x.disabled&&x.offsetParent!==null&&x.tabIndex>=0;});var i=l.indexOf(e);var n=l[(i+1)%l.length];if(n)n.focus();",
    ShiftTab = "var l=[].slice.call(document.querySelectorAll('input:not([type=hidden]),textarea,select,button,a[href],[tabindex]')).filter(function(x){return !x.disabled&&x.offsetParent!==null&&x.tabIndex>=0;});var i=l.indexOf(e);var n=l[(i-1+l.length)%l.length];if(n)n.focus();",
    ArrowLeft = "if(e&&e.setSelectionRange&&e.selectionStart!=null){var p=Math.max(0,e.selectionStart-1);e.setSelectionRange(p,p);}",
    ArrowRight = "if(e&&e.setSelectionRange&&e.selectionStart!=null){var p=Math.min(e.value.length,e.selectionEnd+1);e.setSelectionRange(p,p);}",
    Home = "if(e&&e.setSelectionRange){e.setSelectionRange(0,0);}",
    End = "if(e&&e.setSelectionRange&&e.value!=null){e.setSelectionRange(e.value.length,e.value.length);}",
}

RegisterNUICallback('duiKey', function(data, cb)
    cb('ok')
    if not dui then return end
    if type(data.text) == 'string' and #data.text > 0 and #data.text < 500 then
        local t = json.encode(data.text)
        runJs(JS_PREFIX .. 'ed(' .. t .. ',0,0);')
    elseif type(data.key) == 'string' and KEYS[data.key] then
        runJs(JS_PREFIX .. KEYS[data.key])
    end
end)

CreateThread(function()
    while true do
        if dui and layout.visible then
            alpha = alpha + (targetAlpha - alpha) * 0.2
            local a = math.floor(alpha + 0.5)
            DrawSprite(dict, tex, layout.cx, layout.cy, layout.w, layout.h, 0.0, 255, 255, 255, a)
            Wait(0)
        else
            Wait(100)
        end
    end
end)
