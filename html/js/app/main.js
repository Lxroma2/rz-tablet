/* Barre du bas, messages envoyes par Lua (SendNUIMessage) et point d'entree window.RZ pour les autres modules. */

/* ---------- Barre du bas ---------- */
document.querySelectorAll('.app:not(.disabled)').forEach(b => b.onclick = () => showView(b.dataset.app));
$('n-home').onclick = () => showView('home');
$('n-back').onclick = () => {
  if (currentView === 'settings' && stBack()) return;
  if (currentView === 'services' && window.RZSvc && RZSvc.back()) return;
  if (currentView === 'store' && window.RZStore && RZStore.back()) return;
  if (viewHook(currentView, 'back')) return;
  if (currentView === 'home') post('close'); else showView('home');
};
$('n-close').onclick = () => post('close');
// champ de texte : Echap quitte la saisie au lieu de fermer la tablette
const TEXT_TYPES = ['text', 'search', 'url', 'email', 'number', 'password', 'tel'];
const isTextField = (el) => !!el && el !== kb && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && TEXT_TYPES.includes(el.type)));
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || document.activeElement === kb) return;
  if (isTextField(document.activeElement)) document.activeElement.blur(); else post('close');
});
// tout champ de texte coupe le clavier du jeu pendant la saisie (la barre d'adresse et le clavier DUI ont deja le leur)
document.addEventListener('focusin', (e) => { if (isTextField(e.target) && e.target !== $('url')) setTyping(true); });
document.addEventListener('focusout', (e) => { if (isTextField(e.target) && e.target !== $('url') && !isTextField(e.relatedTarget)) setTyping(!!(viewHooks[currentView] && viewHooks[currentView].keys)); });

window.RZ = { post, postJson, isFiveM, setTyping, openUrl, openApp, closeApp, showView, registerView, setDnd, setSetting,
  canWalk: () => walkAvailable,
  appMode: () => appMode,
  suspendDui: (on) => { duiHold = !!on; },
  tabTitle: () => { const t = T(); return t && !t.app ? t.title || '' : ''; },
  // recherche : lien ou texte -> adresse (moteur de Config.Browser.search), et si le site est autorise
  webTarget: (q) => { const u = normalize(String(q || '')); if (!u) return null; const v = String(q).trim(); const typed = /^https?:\/\//i.test(v) || (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(v) && !/\s/.test(v)); return { url: u, host: hostOf(u), allowed: isAllowed(u), search: !typed }; },
  openSettings: (page) => { showView('settings'); if (stPath.length) stReset(); if (page && $(page)) stGo(page); },
  isOpen: () => opened, currentView: () => currentView, getSetting: (k) => settings[k] };

/* ---------- Messages Lua ---------- */
window.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.action === 'open') {
    if (d.browser) cfg = Object.assign(cfg, d.browser);
    loadSettings(d.defaults);
    bookmarks = (store.get('bookmarks', null) || (cfg.bookmarks || []).map(b => ({ title: b.title, url: b.url }))).filter(b => isAllowed(b.url));
    renderBookmarks();
    zoom = store.get('zoom', null) || cfg.zoom || 0.6; updateZoomLabel(); applyFrameZoom();
    if (window.RZNotif) RZNotif.cancelPeek();
    if (window.RZHome) RZHome.config(d.store, d.icons);
    $('tablet').classList.remove('hidden');
    initGeo();
    win.classList.remove('in'); void win.offsetWidth; win.classList.add('in');
    showView('home');
    needsLoad = true; lastKey = ''; opened = true;
    applySettings(); pushSettings();
    if (window.RZLock) RZLock.start(d.lock || { mode: 'none' });
  } else if (d.action === 'walking') {
    $('tablet').style.opacity = d.state ? String(d.opacity) : '1';
  } else if (d.action === 'notify') {
    if (window.RZNotif) RZNotif.push(d.notif, { peek: d.peek, time: d.peekTime });
  } else if (d.action === 'svcIncoming') {
    if (window.RZSvc) RZSvc.incoming();
  } else if (d.action === 'close') {
    viewHook(currentView, 'leave');
    if (window.RZSvc) RZSvc.leave();
    if (window.RZLock) RZLock.hide();
    if (window.RZNotif) RZNotif.closeCenter();
    $('tablet').style.opacity = '1';
    opened = false; typingState = false;
    post('duiLayout', { visible: false, cx: 0.5, cy: 0.5, w: 0.1, h: 0.1 });
    $('tablet').classList.add('hidden');
  }
});

// fond d'ecran des le chargement : l'apercu d'une notification (tablette rangee) l'affiche
loadSettings(); win.style.background = wallCss();
// Ne pas deranger et AirDrop doivent etre connus du jeu avant la premiere ouverture
document.querySelector('.screen').classList.toggle('dnd', !!settings.dnd); applyBrightness(); pushSettings();

/* Apercu hors FiveM : pas de rendu DUI, seulement l'interface */
// apres tous les scripts : home.js doit recevoir la liste des apps web
if (!isFiveM) document.addEventListener('DOMContentLoaded', () => window.dispatchEvent(new MessageEvent('message', { data: { action: 'open', browser: { bookmarks: [{ title: 'Wikipedia', url: 'https://fr.wikipedia.org/' }] },
  store: [{ id: 'wikipedia', label: 'Wikipédia', subtitle: "L'encyclopédie libre", category: 'Référence', url: 'https://fr.wikipedia.org/', color: '#3a3a3c', glyph: 'W', icon: 'book-open-text' },
    { id: 'dynasty8', label: 'Dynasty 8', subtitle: 'Immobilier à Los Santos', category: 'Immobilier', url: 'https://dynasty8wl.fr/', color: '#0f8a4b', glyph: 'D8', icon: 'house-line' }] } })));
