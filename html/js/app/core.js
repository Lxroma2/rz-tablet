/* Tablette : socle commun.
   Les fichiers js/app/*.js forment un seul programme decoupe par theme. Ils partagent la meme portee
   (variables declarees au premier niveau) : l'ordre de chargement dans index.html compte.
     core.js      appels vers Lua (post), stockage local, reglages, horloge, changement de vue
     browser.js   navigateur : onglets, iframe ou rendu DUI, favoris, clavier, apps web plein ecran
     window.js    fenetre deplacable et redimensionnable
     settings.js  application Reglages
     main.js      barre du bas, messages de Lua (open/close/notify...), point d'entree window.RZ
   Les autres modules (services, notify, home, store, lock) sont independants et passent par window.RZ. */

const $ = (id) => document.getElementById(id);
const isFiveM = typeof GetParentResourceName === 'function';
const post = (name, data = {}) => {
  if (!isFiveM) { if (typeof window.RZDEV_POST === 'function') window.RZDEV_POST(name, data); return; }   // banc d'essai (dev/)
  fetch(`https://${GetParentResourceName()}/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }).catch(() => {});
};

const postJson = (name, data = {}) => {
  // banc d'essai (dev/) : il peut jouer le serveur (ex. Reglages > Administration)
  if (!isFiveM) return Promise.resolve(typeof window.RZDEV_JSON === 'function' ? window.RZDEV_JSON(name, data) : null);
  return fetch(`https://${GetParentResourceName()}/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }).then(r => r.json()).catch(() => null);
};

const store = {
  get(k, d) { try { const v = localStorage.getItem('rztab_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('rztab_' + k, JSON.stringify(v)); } catch (e) {} },
};

let cfg = { home: 'https://fr.wikipedia.org/', search: 'https://fr.wikipedia.org/w/index.php?search=%s', bookmarks: [], maxW: 1920, maxH: 1080 };
let currentView = 'home';
let appMode = null;       // id de l'app web affichee en plein ecran (onglet cache, sans barre de navigateur)
let tabs = [];
let activeTab = null;
let nextId = 1;
let opened = false;
let needsLoad = true;     // le DUI est detruit a la fermeture : on recharge a la reouverture
let loadedSize = { w: 960, h: 540 };
let resizeTimer = null;
let loadingTimer = null;
const surface = $('surface');

/* ---------- Etat des reglages ---------- */
const WALLPAPERS = {
  aurore: 'radial-gradient(70% 80% at 12% 8%, #7a5cff 0%, transparent 60%), radial-gradient(60% 70% at 92% 18%, #ff5fa8 0%, transparent 62%), radial-gradient(80% 90% at 55% 105%, #1fa8ff 0%, transparent 62%), #15123a',
  nuit: 'radial-gradient(70% 70% at 80% 0%, #2a2f6b 0%, transparent 60%), radial-gradient(60% 70% at 10% 100%, #3a1f5c 0%, transparent 60%), #05060f',
  ocean: 'radial-gradient(70% 80% at 85% 0%, #19d2d2 0%, transparent 60%), radial-gradient(80% 90% at 10% 100%, #1368e8 0%, transparent 62%), #062a4a',
  coucher: 'radial-gradient(70% 80% at 15% 0%, #ff9a4d 0%, transparent 60%), radial-gradient(70% 80% at 90% 40%, #ff4d8d 0%, transparent 62%), radial-gradient(80% 90% at 50% 110%, #6a3df0 0%, transparent 62%), #2a1240',
  foret: 'radial-gradient(70% 80% at 20% 0%, #3ddc84 0%, transparent 58%), radial-gradient(80% 90% at 90% 100%, #0a8f7a 0%, transparent 62%), #062a1c',
  graphite: 'radial-gradient(70% 80% at 20% 0%, #6b7280 0%, transparent 60%), radial-gradient(80% 90% at 90% 100%, #3a3f4b 0%, transparent 62%), #111318',
};
const DEFAULTS = { wallpaper: 'aurore', wallUrl: '', clock24: true, walkOpacity: 0.35, allowWalk: true, peek: true, lockNotifs: true, dnd: false, airdrop: 'all', brightness: 1, sound: true };
// fond d'ecran : un des degrades ci-dessus, ou une image en ligne (wallpaper = 'custom', lien https dans wallUrl)
const okWallUrl = (u) => typeof u === 'string' && u.length <= 500 && /^https:\/\/[^\s"'<>()\\]+$/i.test(u);
function wallCss() {
  if (settings.wallpaper === 'custom' && okWallUrl(settings.wallUrl)) return 'url("' + settings.wallUrl + '") center / cover no-repeat #000';
  return WALLPAPERS[settings.wallpaper] || WALLPAPERS.aurore;
}
let settings = Object.assign({}, DEFAULTS);
let walkAvailable = true;      // false si le serveur interdit la marche (Config.AllowWalk = false)
let lastDefaults = null;
function loadSettings(defaults) {
  if (defaults) lastDefaults = defaults;
  const d = lastDefaults || {};
  walkAvailable = d.allowWalk !== false;
  settings = Object.assign({}, DEFAULTS,
    { walkOpacity: d.walkOpacity != null ? d.walkOpacity : DEFAULTS.walkOpacity, allowWalk: walkAvailable },
    store.get('settings', {}));
  if (!walkAvailable) settings.allowWalk = false;
  settings.walkOpacity = Math.max(0.1, Math.min(1, Number(settings.walkOpacity) || 0.35));
  settings.brightness = Math.max(0.3, Math.min(1, Number(settings.brightness) || 1));
}

/* ---------- Horloge ---------- */
function tick() {
  const d = new Date();
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: !settings.clock24 });
  $('clock').textContent = hm;
  if (window.RZHome) RZHome.tick(d);
  $('sdate').textContent = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}
setInterval(tick, 1000); tick();

/* ---------- Vues ----------
   Les apps en module (notes, calculatrice, carte) s'enregistrent avec RZ.registerView(nom, { enter, leave, back }).
   back() renvoie true s'il a gere le retour (page interne), sinon la barre du bas ramene a l'accueil. */
const viewHooks = {};
function registerView(name, hooks) { viewHooks[name] = hooks || {}; }
function viewHook(name, fn) { const h = viewHooks[name]; return h && typeof h[fn] === 'function' ? h[fn]() : undefined; }

function showView(name, opts) {
  const prev = currentView;
  // apps recentes : instantane de la vue qu'on quitte (avant que leave() ne la remette a zero)
  const prevKey = appMode ? 'app:' + appMode : prev;
  if (window.RZSwitch && opened) RZSwitch.snap(prevKey);
  if (prev !== name) viewHook(prev, 'leave');
  if (window.RZHome && RZHome.stopEdit) RZHome.stopEdit();
  if (name !== 'settings' && currentView === 'settings') stReset();
  if (window.RZSvc && name !== 'services' && currentView === 'services') RZSvc.leave();
  if (window.RZStore && name !== 'store' && currentView === 'store') RZStore.leave();
  appMode = name === 'browser' && opts && opts.app ? opts.app : null;
  if (window.RZNotif) { RZNotif.closeCenter(); RZNotif.readApp(appMode || name); }
  currentView = name;
  document.querySelector('.screen').dataset.view = name;
  $('browser').classList.toggle('appmode', !!appMode);
  if (!appMode) hideSplash();
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === name));
  if (name === 'browser' && !appMode) {
    // le navigateur ne montre jamais l'onglet d'une app : on revient au dernier onglet normal
    const cur = T();
    if (!cur || cur.app) { const n = tabs.filter(t => !t.app); if (n.length) selectTab(n[n.length - 1].id); else newTab(); }
  }
  if (name === 'services' && window.RZSvc) RZSvc.enter();
  if (name === 'store' && window.RZStore) RZStore.enter();
  if (name === 'home') { if (window.RZWidgets) RZWidgets.refresh(true); else if (window.RZSvc) RZSvc.homeWidget(); }
  if (prev !== name) viewHook(name, 'enter');
  if (window.RZSwitch) RZSwitch.visited(appMode ? 'app:' + appMode : name);
}
