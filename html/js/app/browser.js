/* Navigateur : onglets, chargement en iframe (Frame) ou en rendu DUI (Rendu), zoom, favoris,
   clavier (jeu ou page), et apps web ouvertes en plein ecran comme de vraies apps. */

/* ---------- URL ---------- */
function normalize(input) {
  const v = input.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(v) && !/\s/.test(v)) return 'https://' + v;
  return cfg.search.replace('%s', encodeURIComponent(v));
}

/* ---------- Onglets ---------- */
const T = () => tabs.find(t => t.id === activeTab);

function newTab(url) {
  const tab = { id: nextId++, title: 'Nouvel onglet', history: [], idx: -1 };
  tabs.push(tab);
  selectTab(tab.id);
  if (url) navigate(url);
}

function selectTab(id) { activeTab = id; renderTabs(); syncUI(); loadActive(); }

function closeTab(id) {
  const i = tabs.findIndex(t => t.id === id);
  if (i < 0) return;
  if (tabs[i].frame) tabs[i].frame.remove();
  tabs.splice(i, 1);
  const normal = tabs.filter(t => !t.app);
  if (!normal.length) { newTab(); return; }
  if (activeTab === id) activeTab = (tabs.slice(0, i).reverse().find(t => !t.app) || normal[0]).id;
  renderTabs(); syncUI(); loadActive();
}

function renderTabs() {
  const el = $('tabs'); el.innerHTML = '';
  tabs.filter(t => !t.app).forEach(t => {
    const d = document.createElement('div');
    d.className = 'tab' + (t.id === activeTab ? ' active' : '');
    const s = document.createElement('span'); s.textContent = t.title;
    const x = document.createElement('div'); x.className = 'x'; x.textContent = '×';
    x.onclick = (e) => { e.stopPropagation(); closeTab(t.id); };
    d.append(s, x); d.onclick = () => selectTab(t.id);
    el.appendChild(d);
  });
  const p = document.createElement('div'); p.className = 'tab plus'; p.textContent = '+';
  p.onclick = () => newTab(); el.appendChild(p);
}

/* ---------- Modes : iframe (par defaut) ou rendu DUI ---------- */
const framesEl = $('frames');
const hostOf = (u) => { try { return new URL(u).hostname; } catch (e) { return ''; } };

/* Liste blanche des sites (Config.Browser.allowedHosts) */
const isAllowed = (url) => {
  if (!cfg.restrictToAllowed) return true;
  const h = hostOf(url).toLowerCase();
  if (!h) return false;
  return (cfg.allowedHosts || []).some((a) => {
    a = String(a).toLowerCase();
    return h === a || h.endsWith('.' + a);
  });
};
let toastTimer = null;
function toast(msg) {
  const el = $('loading');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(loadingTimer);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.add('hidden'); el.textContent = 'Chargement\u2026'; }, 3500);
}
const modes = store.get('modes', {});               // { "site.fr": "dui" | "frame" }
const auto = {};                                  // detection serveur : host -> 'frame' | 'dui'
const checking = {};                              // host -> true pendant la verification
const modeOf = (url) => ((modes[hostOf(url)] || auto[hostOf(url)] || cfg.mode || 'frame') === 'dui' ? 'dui' : 'frame');
let duiActive = false;
let hintTimer = null;

/* Zoom : iframe = CSS scale (instantane) ; DUI = surface virtuelle plus grande */
const ZOOMS = [0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5];
let zoom = 0.6;
function updateZoomLabel() { $('b-zoom').textContent = Math.round(zoom * 100) + '%'; }
function applyFrameZoom() {
  framesEl.querySelectorAll('iframe').forEach(f => {
    f.style.width = (100 / zoom) + '%';
    f.style.height = (100 / zoom) + '%';
    f.style.transform = 'scale(' + zoom + ')';
  });
}
function setZoom(z) {
  zoom = z; store.set('zoom', z); updateZoomLabel(); applyFrameZoom();
  if (curMode() === 'dui') loadActive();
}
function stepZoom(dir) {
  let i = ZOOMS.reduce((best, v, k) => (Math.abs(v - zoom) < Math.abs(ZOOMS[best] - zoom) ? k : best), 0);
  i = Math.max(0, Math.min(ZOOMS.length - 1, i + dir));
  setZoom(ZOOMS[i]);
}

function curMode() {
  const t = T();
  return t && t.idx >= 0 ? modeOf(t.history[t.idx]) : 'frame';
}

function surfaceSize() {
  const r = surface.getBoundingClientRect();
  let w = r.width / zoom, h = r.height / zoom;
  const k = Math.min(1, cfg.maxW / w, cfg.maxH / h);   // plafond en gardant le ratio
  w *= k; h *= k;
  return { w: Math.max(320, Math.round(w)), h: Math.max(240, Math.round(h)) };
}

function frameFor(t) {
  if (!t.frame) {
    const f = document.createElement('iframe');
    f.setAttribute('referrerpolicy', 'no-referrer');
    if (t.app) f.addEventListener('load', () => hideSplash(t.app));
    // Page chargee : plus de pastille "Page vide ?" par dessus le site
    f.addEventListener('load', () => { if (t === T()) { clearTimeout(hintTimer); $('blocked').classList.add('hidden'); } });
    framesEl.appendChild(f);
    t.frame = f;
    applyFrameZoom();
  }
  return t.frame;
}

function stopDui() {
  if (!duiActive) return;
  duiActive = false;
  post('duiLayout', { visible: false, cx: 0.5, cy: 0.5, w: 0.1, h: 0.1 });
  post('duiStop', {});
  lastKey = '';
}

function startHint() {
  clearTimeout(hintTimer);
  $('blocked').classList.add('hidden');
  hintTimer = setTimeout(() => {
    if (curMode() !== 'frame') return;
    $('blocked').classList.remove('hidden');
    hintTimer = setTimeout(() => $('blocked').classList.add('hidden'), 12000);
  }, 7000);
}

function setHostMode(url, mode) {
  const h = hostOf(url); if (!h) return;
  modes[h] = mode; store.set('modes', modes);
  loadActive(true);
}

// Charge la page de l'onglet actif selon le mode du site
function loadActive(force) {
  tabs.forEach(x => { if (x.frame) x.frame.classList.remove('active'); });
  framesEl.style.display = 'none';   // le conteneur blanc des iframes ne doit jamais couvrir le rendu DUI
  const t = T();
  if (!t || t.idx < 0) { surface.style.display = 'none'; return; }
  const url = t.history[t.idx];
  const host = hostOf(url);

  // Site inconnu : on demande au serveur si l'iframe est autorisee, puis on charge dans le bon mode
  if (isFiveM && cfg.autoDetect !== false && host && !modes[host] && auto[host] === undefined) {
    if (!checking[host]) {
      checking[host] = true;
      $('loading').textContent = 'Vérification du site\u2026';
      $('loading').classList.remove('hidden');
      Promise.race([
        postJson('canFrame', { url }),
        new Promise(res => setTimeout(() => res(null), 3500)),
      ]).then(res => {
        checking[host] = false;
        if (res && res.ok === false) auto[host] = 'dui';
        else if (res && res.ok === true) auto[host] = 'frame';
        else auto[host] = 'frame-unknown';   // pas de reponse : on tente l'iframe sans memoriser
        if (auto[host] === 'frame-unknown') setTimeout(() => { delete auto[host]; }, 30000);
        $('loading').textContent = 'Chargement\u2026';
        $('loading').classList.add('hidden');
        const cur = T();
        if (cur && cur.idx >= 0 && hostOf(cur.history[cur.idx]) === host) loadActive(force);
      });
    }
    return;
  }

  const mode = modeOf(url) === 'dui' ? 'dui' : 'frame';
  $('b-mode').textContent = mode === 'dui' ? 'Rendu' : 'Frame';
  needsLoad = false;
  if (mode === 'frame') {
    surface.style.display = 'none';
    stopDui();
    framesEl.style.display = 'block';
    const f = frameFor(t);
    f.classList.add('active');
    if (force || t.frameUrl !== url) { f.src = url; t.frameUrl = url; }
    startHint();
  } else {
    clearTimeout(hintTimer); $('blocked').classList.add('hidden');
    surface.style.display = 'block';
    duiActive = true;
    loadedSize = surfaceSize();
    $('loading').classList.remove('hidden');
    clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => $('loading').classList.add('hidden'), 4000);
    post('duiLoad', { url, w: loadedSize.w, h: loadedSize.h });
    if (t.app) setTimeout(() => hideSplash(t.app), 1200);
  }
}

// Boucle (mode DUI uniquement) : position de la zone pour le dessin en jeu + redimensionnement
let lastKey = '';
let duiHold = false;      // selecteur d'apps ouvert : la page dessinee par le jeu ne doit pas passer devant
function frame() {
  requestAnimationFrame(frame);
  if (!opened) return;
  const t = T();
  const show = !duiHold && currentView === 'browser' && !!t && t.idx >= 0;
  const r = surface.getBoundingClientRect();
  const key = [show, Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(',');
  if (key !== lastKey) {
    lastKey = key;
    post('duiLayout', {
      visible: show,
      cx: (r.left + r.width / 2) / window.innerWidth,
      cy: (r.top + r.height / 2) / window.innerHeight,
      w: r.width / window.innerWidth,
      h: r.height / window.innerHeight,
    });
  }
  if (show) {
    if (needsLoad) { loadActive(); return; }
    const s = surfaceSize();
    if (Math.abs(s.w - loadedSize.w) > 24 || Math.abs(s.h - loadedSize.h) > 24) {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(loadActive, 500);
    }
  }
}
requestAnimationFrame(frame);

/* ---------- Souris -> DUI ---------- */
const BTN = ['left', 'middle', 'right'];
function toDui(e) {
  const r = surface.getBoundingClientRect();
  return {
    x: Math.round((e.clientX - r.left) * loadedSize.w / r.width),
    y: Math.round((e.clientY - r.top) * loadedSize.h / r.height),
  };
}
let pendingMove = null;
function flushMove() {
  if (pendingMove) { post('duiMouse', { t: 'move', x: pendingMove.x, y: pendingMove.y }); pendingMove = null; }
}
surface.addEventListener('pointermove', (e) => {
  const first = pendingMove === null;
  pendingMove = toDui(e);
  if (first) requestAnimationFrame(flushMove);
});
surface.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  surface.setPointerCapture(e.pointerId);
  pendingMove = toDui(e); flushMove();
  post('duiMouse', { t: 'down', button: BTN[e.button] || 'left' });
  if (e.button === 0) $('kb').focus();
});
surface.addEventListener('pointerup', (e) => {
  pendingMove = toDui(e); flushMove();
  post('duiMouse', { t: 'up', button: BTN[e.button] || 'left' });
});
surface.addEventListener('wheel', (e) => {
  e.preventDefault();
  post('duiMouse', { t: 'wheel', dx: Math.round(e.deltaX), dy: Math.round(e.deltaY) });
}, { passive: false });
surface.addEventListener('contextmenu', (e) => e.preventDefault());

/* ---------- Navigation ---------- */
function navigate(input, push = true) {
  const url = normalize(input); const t = T();
  if (!url || !t) return;
  if (!isAllowed(url)) { toast('Site non autorisé : ' + (hostOf(url) || url)); return; }
  if (push) { t.history = t.history.slice(0, t.idx + 1); t.history.push(url); t.idx = t.history.length - 1; }
  try { t.title = new URL(url).hostname; } catch (e) { t.title = url; }
  renderTabs(); syncUI(); loadActive();
}

function syncUI() {
  const t = T(); if (!t) return;
  const hasPage = t.idx >= 0;
  $('newtab').classList.toggle('hidden', hasPage);
  $('url').value = hasPage ? t.history[t.idx] : '';
  $('b-back').disabled = t.idx <= 0;
  $('b-fwd').disabled = t.idx >= t.history.length - 1;
  const starred = isBookmarked(hasPage ? t.history[t.idx] : '');
  $('b-star').classList.toggle('on', starred);
  $('b-star').title = starred ? 'Retirer des favoris' : 'Ajouter aux favoris';
}

/* ---------- Favoris ---------- */
let bookmarks = [];
const isBookmarked = (u) => !!u && bookmarks.some(b => b.url === u);
function renderBookmarks() {
  const el = $('bookmarks'); el.innerHTML = '';
  if (!bookmarks.length) { el.innerHTML = '<span class=\"muted\">Aucun favori. Clique sur l\'étoile pour en ajouter.</span>'; return; }
  bookmarks.forEach((b, i) => {
    const d = document.createElement('div'); d.className = 'bm';
    const s = document.createElement('span'); s.textContent = b.title;
    const x = document.createElement('span'); x.className = 'x'; x.textContent = '×';
    x.onclick = (e) => { e.stopPropagation(); bookmarks.splice(i, 1); store.set('bookmarks', bookmarks); renderBookmarks(); syncUI(); };
    d.append(s, x); d.onclick = () => navigate(b.url); el.appendChild(d);
  });
}
function toggleBookmark() {
  const t = T(); if (!t || t.idx < 0) return;
  const u = t.history[t.idx];
  const i = bookmarks.findIndex(b => b.url === u);
  if (i >= 0) bookmarks.splice(i, 1); else bookmarks.push({ title: t.title, url: u });
  store.set('bookmarks', bookmarks); renderBookmarks(); syncUI();
}

/* ---------- Boutons du navigateur ---------- */
$('b-back').onclick = () => { const t = T(); if (t && t.idx > 0) { t.idx--; navigate(t.history[t.idx], false); } };
$('b-fwd').onclick = () => { const t = T(); if (t && t.idx < t.history.length - 1) { t.idx++; navigate(t.history[t.idx], false); } };
$('b-reload').onclick = () => loadActive(true);
$('b-home').onclick = () => navigate(cfg.home);
$('b-star').onclick = toggleBookmark;
$('b-mode').onclick = () => {
  const t = T(); if (!t || t.idx < 0) return;
  const u = t.history[t.idx];
  setHostMode(u, modeOf(u) === 'dui' ? 'frame' : 'dui');
};
$('blocked-switch').onclick = () => { const t = T(); if (t && t.idx >= 0) setHostMode(t.history[t.idx], 'dui'); };
$('blocked-close').onclick = () => $('blocked').classList.add('hidden');
$('b-zoomin').onclick = () => stepZoom(1);
$('b-zoomout').onclick = () => stepZoom(-1);
$('b-zoom').onclick = () => setZoom(cfg.zoom || 0.6);
$('url').addEventListener('keydown', (e) => { if (e.key === 'Enter') { navigate($('url').value); $('url').blur(); } });
$('url').addEventListener('focus', (e) => e.target.select());

/* ---------- Clavier : marche vs saisie ---------- */
let typingState = false;
function updateDbg() {
  const m = (typeof curMode === 'function' && curMode() === 'dui') ? 'Rendu' : 'Frame';
  $('dbg').textContent = m + ' | clavier : ' + (typingState ? 'page' : 'jeu');
}
const setTyping = (v) => { if (v !== typingState) { typingState = v; post('typing', { state: v }); updateDbg(); } };
setInterval(updateDbg, 500);
$('url').addEventListener('focus', () => setTyping(true));
$('url').addEventListener('blur', () => setTyping(false));
// Clic dans une page affichee en iframe : la fenetre NUI perd le focus -> on coupe le clavier du jeu
window.addEventListener('blur', () => { if (curMode() === 'frame') setTyping(true); });
window.addEventListener('focus', () => { if (document.activeElement !== $('url') && document.activeElement !== kb) setTyping(false); });

/* ---------- Saisie dans les pages (injection JS cote jeu, experimental) ---------- */
const kb = $('kb');
const SPECIAL = ['Backspace', 'Delete', 'Enter', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
kb.addEventListener('focus', () => { setTyping(true); surface.classList.add('surface-typing'); });
kb.addEventListener('blur', () => { if (document.activeElement !== $('url')) setTyping(false); surface.classList.remove('surface-typing'); });
kb.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { kb.blur(); e.preventDefault(); e.stopPropagation(); return; }
  if (e.ctrlKey || e.metaKey) return; // laisse passer Ctrl+V (evenement paste)
  if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); post('duiKey', { key: 'ShiftTab' }); return; }
  if (SPECIAL.includes(e.key)) { e.preventDefault(); post('duiKey', { key: e.key }); return; }
  if (e.key.length === 1) { e.preventDefault(); post('duiKey', { text: e.key }); }
});
kb.addEventListener('paste', (e) => {
  e.preventDefault();
  const t = (e.clipboardData || window.clipboardData).getData('text');
  if (t) post('duiKey', { text: t.slice(0, 400) });
});

/* ---------- Points d'entree pour les autres modules (services.js) ---------- */
function openUrl(url) {
  showView('browser');
  const t = T();
  if (t && t.idx < 0) navigate(url); else newTab(url);
}
/* ---------- Apps web : le site s'ouvre comme une vraie app ----------
   Chaque app a son onglet cache (garde en memoire : on la retrouve ou on l'a laissee),
   sans onglets, barre d'adresse ni favoris. Ecran de lancement avec l'icone le temps du chargement. */
let splashFor = null, splashTimer = null;
function showSplash(a) {
  const sp = $('app-splash'); sp.textContent = '';
  if (window.RZHome) sp.append(RZHome.iconEl(a.id));
  sp.classList.remove('gone'); splashFor = a.id;
  clearTimeout(splashTimer); splashTimer = setTimeout(() => hideSplash(a.id), 6000);
}
function hideSplash(id) {
  if (id && id !== splashFor) return;
  splashFor = null; clearTimeout(splashTimer);
  $('app-splash').classList.add('gone');
}
function openApp(a) {
  if (!a || !a.url) return;
  let t = tabs.find(x => x.app === a.id);
  const fresh = !t;
  if (fresh) { t = { id: nextId++, title: a.label, history: [], idx: -1, app: a.id }; tabs.push(t); }
  showView('browser', { app: a.id });
  activeTab = t.id; syncUI();
  if (fresh) { showSplash(a); navigate(a.url); } else loadActive();
}
function closeApp(id) {
  const t = tabs.find(x => x.app === id); if (!t) return;
  if (t.frame) t.frame.remove();
  tabs.splice(tabs.indexOf(t), 1);
  if (appMode === id) showView('home');
  else if (activeTab === t.id) activeTab = null;
}
