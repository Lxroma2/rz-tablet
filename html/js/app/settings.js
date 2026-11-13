/* Application Reglages : fond d'ecran, horloge, notifications, marche, navigateur, reinitialisation. */

/* ---------- Application Reglages ---------- */
function saveSettings() { store.set('settings', settings); }
function pushSettings() {
  post('settings', { walkOpacity: settings.walkOpacity, allowWalk: settings.allowWalk, peek: settings.peek !== false, dnd: !!settings.dnd, airdrop: settings.airdrop !== 'off', sound: settings.sound !== false });
}
// luminosite : un voile noir au-dessus de tout l'ecran (le navigateur DUI compris)
function applyBrightness() {
  const b = Math.max(0.3, Math.min(1, Number(settings.brightness) || 1));
  $('dim').style.opacity = String(Math.round((1 - b) * 100) / 100);
  $('s-bright').value = String(Math.round(b * 100)); $('s-br-val').textContent = Math.round(b * 100) + ' %'; fillRange($('s-bright'));
}
// point d'entree du centre de controle : memes reglages que cette app
function setSetting(k, v) {
  if (k === 'dnd') return setDnd(v);
  if (k === 'allowWalk' && !walkAvailable) return;
  settings[k] = v; saveSettings();
  if (k === 'brightness') return applyBrightness();
  if (k === 'walkOpacity') {
    $('s-opacity').value = String(Math.round(v * 100)); $('s-op-val').textContent = Math.round(v * 100) + ' %'; fillRange($('s-opacity'));
    return pushSettings();
  }
  applySettings(); pushSettings();
}

const WP_NAMES = { aurore: 'Aurore', nuit: 'Nuit', ocean: 'Océan', coucher: 'Crépuscule', foret: 'Forêt', graphite: 'Graphite', custom: 'Ma photo' };
function renderWallpapers() {
  const el = $('wallpapers'); el.innerHTML = '';
  const keys = Object.keys(WALLPAPERS);
  if (okWallUrl(settings.wallUrl)) keys.unshift('custom');   // l'image en ligne garde sa vignette, meme si un degrade est choisi
  keys.forEach((k) => {
    const b = document.createElement('button');
    b.className = 'wp' + (settings.wallpaper === k ? ' on' : '');
    const sw = document.createElement('i');
    sw.style.background = k === 'custom' ? 'url("' + settings.wallUrl + '") center / cover no-repeat #000' : WALLPAPERS[k];
    const lb = document.createElement('span'); lb.textContent = WP_NAMES[k] || k;
    b.append(sw, lb);
    b.onclick = () => { settings.wallpaper = k; saveSettings(); applySettings(); };
    el.appendChild(b);
  });
}

// image en ligne : on verifie qu'elle se charge avant de l'appliquer
let wallTest = null;
function setWallMsg(t, bad) { const m = $('s-wall-msg'); m.textContent = t; m.classList.toggle('bad', !!bad); }
const WALL_HINT = "Colle le lien d'une image (https) : elle devient le fond de l'accueil et de l'écran verrouillé.";
function useWallUrl() {
  const u = $('s-wall-url').value.trim();
  if (!u) { setWallMsg(WALL_HINT); return; }
  if (!okWallUrl(u)) { setWallMsg("Le lien doit commencer par https:// et ne pas contenir d'espace ni de guillemet.", true); return; }
  setWallMsg("Chargement de l'image…");
  const im = new Image(); wallTest = im; im.referrerPolicy = 'no-referrer';
  const timer = setTimeout(() => { if (wallTest === im) { wallTest = null; setWallMsg("L'image ne répond pas. Vérifie le lien.", true); } }, 10000);
  im.onload = () => {
    if (wallTest !== im) return;
    clearTimeout(timer); wallTest = null;
    settings.wallUrl = u; settings.wallpaper = 'custom'; saveSettings(); applySettings();
    $('s-wall-url').value = ''; $('s-wall-url').blur();
    setWallMsg("Fond d'écran appliqué.");
  };
  im.onerror = () => { if (wallTest !== im) return; clearTimeout(timer); wallTest = null; setWallMsg("Impossible d'afficher cette image (lien invalide ou image protégée).", true); };
  im.src = u;
}
$('s-wall-set').onclick = useWallUrl;
$('s-wall-url').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); useWallUrl(); } });
$('s-wall-del').onclick = () => {
  settings.wallUrl = ''; if (settings.wallpaper === 'custom') settings.wallpaper = DEFAULTS.wallpaper;
  saveSettings(); applySettings(); setWallMsg(WALL_HINT);
};

function renderForcedModes() {
  const el = $('s-modes'); el.innerHTML = '';
  const hosts = Object.keys(modes);
  if (!hosts.length) { el.innerHTML = '<span class="muted">Aucun site forcé.</span>'; return; }
  hosts.forEach((h) => {
    const c = document.createElement('div'); c.className = 'chip';
    const s1 = document.createElement('span'); s1.textContent = h + ' : ' + (modes[h] === 'dui' ? 'Rendu' : 'Frame');
    const x = document.createElement('span'); x.className = 'x'; x.textContent = '\u00d7';
    x.onclick = () => {
      delete modes[h]; delete auto[h]; store.set('modes', modes); renderForcedModes();
      const t = T();
      if (t && t.idx >= 0 && hostOf(t.history[t.idx]) === h) loadActive(true);
    };
    c.append(s1, x); el.appendChild(c);
  });
}

function fillZoomSelect() {
  const sel = $('s-zoom');
  if (!sel.options.length) {
    ZOOMS.forEach((z) => { const o = document.createElement('option'); o.value = String(z); o.textContent = Math.round(z * 100) + ' %'; sel.appendChild(o); });
  }
  const nearest = ZOOMS.reduce((b, v) => (Math.abs(v - zoom) < Math.abs(b - zoom) ? v : b), ZOOMS[0]);
  sel.value = String(nearest);
}

function applySettings() {
  document.querySelector('.screen').style.background = wallCss();
  $('s-clock24').checked = !!settings.clock24;
  $('s-peek').checked = settings.peek !== false;
  $('s-sound').checked = settings.sound !== false;
  $('s-lockn').checked = settings.lockNotifs !== false;
  $('s-walk').checked = !!settings.allowWalk;
  $('row-walk').classList.toggle('hidden', !walkAvailable);
  $('tab-controls').classList.toggle('hidden', !walkAvailable);
  $('s-opacity').value = String(Math.round(settings.walkOpacity * 100));
  $('s-op-val').textContent = Math.round(settings.walkOpacity * 100) + ' %';
  fillRange($('s-opacity'));
  $('wp-preview').style.background = wallCss();
  $('s-wall-del').classList.toggle('hidden', !okWallUrl(settings.wallUrl));
  syncDnd(); syncAirdrop(); applyBrightness();
  fillZoomSelect(); renderWallpapers(); renderForcedModes(); tick();
  $('wp-time').textContent = $('clock').textContent;
  refreshValues();
}

// Navigation en pile (liste -> sous-page), interruptible : on ne fait que changer des classes
const stStack = $('st-stack');
let stPath = [];
function fillRange(el) { const p = (el.value - el.min) / (el.max - el.min) * 100; el.style.setProperty('--p', p + '%'); }
function refreshValues() {
  $('v-display').textContent = settings.wallpaper === 'custom' && !okWallUrl(settings.wallUrl) ? WP_NAMES[DEFAULTS.wallpaper] : (WP_NAMES[settings.wallpaper] || '');
  $('v-browser').textContent = Math.round(zoom * 100) + ' %';
}
// une sous-page peut en ouvrir une autre (Administration -> fiche d'une app) : la precedente glisse dessous
function stGo(id) {
  if (stPath.includes(id)) return;
  const prev = stPath[stPath.length - 1];
  stPath.push(id);
  refreshValues();
  if (prev) $(prev).classList.add('under');
  $(id).classList.add('open'); stStack.classList.add('pushed');
}
function stBack() {
  const id = stPath.pop();
  if (!id) return false;
  $(id).classList.remove('open');
  const prev = stPath[stPath.length - 1];
  if (prev) $(prev).classList.remove('under'); else stStack.classList.remove('pushed');
  refreshValues();
  return true;
}
function stReset() {
  stPath = [];
  stStack.classList.add('instant');
  stStack.classList.remove('pushed');
  stStack.querySelectorAll('.st-page.open').forEach(p => p.classList.remove('open', 'under'));
  void stStack.offsetWidth;
  stStack.classList.remove('instant');
}
// liste principale : une seule sous-page a la fois (deux clics rapides n'empilent pas deux pages)
document.querySelectorAll('[data-go]').forEach((b) => {
  b.onclick = () => { if (!stPath.length || !b.closest('.st-root')) stGo(b.dataset.go); };
});
document.querySelectorAll('[data-back]').forEach((b) => { b.onclick = () => stBack(); });

let opTimer = null;
$('s-clock24').onchange = (e) => { settings.clock24 = e.target.checked; saveSettings(); tick(); };
$('s-peek').onchange = (e) => { settings.peek = e.target.checked; saveSettings(); pushSettings(); };
$('s-lockn').onchange = (e) => { settings.lockNotifs = e.target.checked; saveSettings(); };
$('s-sound').onchange = (e) => { settings.sound = e.target.checked; saveSettings(); pushSettings(); };
$('s-bright').oninput = (e) => { settings.brightness = Number(e.target.value) / 100; saveSettings(); applyBrightness(); };

// Ne pas deranger : ce reglage, le bouton du centre de notifications et la lune de la barre d'etat
function syncDnd() {
  const on = !!settings.dnd;
  document.querySelector('.screen').classList.toggle('dnd', on);
  $('s-dnd').checked = on;
  $('nc-dnd').classList.toggle('on', on);
}
function setDnd(on) {
  settings.dnd = !!on; saveSettings(); pushSettings(); syncDnd();
  if (window.RZIsland) RZIsland.activity('moon', on ? 'Ne pas déranger' : 'Ne pas déranger désactivé', on ? 'dnd' : '', 1800);
}
$('s-dnd').onchange = (e) => setDnd(e.target.checked);

// AirDrop : reception pour tout le monde ou coupee
const AD_NAMES = { all: 'Tout le monde', off: 'Désactivé' };
function syncAirdrop() {
  const v = settings.airdrop === 'off' ? 'off' : 'all';
  $('v-airdrop').textContent = AD_NAMES[v];
  document.querySelectorAll('.ad-opt').forEach((b) => b.classList.toggle('on', b.dataset.a === v));
}
document.querySelectorAll('.ad-opt').forEach((b) => { b.onclick = () => { settings.airdrop = b.dataset.a; saveSettings(); pushSettings(); syncAirdrop(); }; });
$('s-notif-test').onclick = () => { if (window.RZNotif) RZNotif.push({ app: 'system', title: 'Tablette', body: 'Les notifications fonctionnent.' }); };
$('s-walk').onchange = (e) => { settings.allowWalk = e.target.checked; saveSettings(); pushSettings(); };
$('s-opacity').oninput = (e) => {
  settings.walkOpacity = Number(e.target.value) / 100;
  $('s-op-val').textContent = e.target.value + ' %';
  fillRange(e.target);
  saveSettings(); pushSettings();
  $('tablet').style.opacity = String(settings.walkOpacity);          // apercu
  clearTimeout(opTimer);
  opTimer = setTimeout(() => { $('tablet').style.opacity = '1'; }, 900);
};
$('s-zoom').onchange = (e) => setZoom(parseFloat(e.target.value));
function defaultBookmarks() { return (cfg.bookmarks || []).map(b => ({ title: b.title, url: b.url })).filter(b => isAllowed(b.url)); }
$('s-clear-bm').onclick = () => { store.set('bookmarks', null); bookmarks = defaultBookmarks(); renderBookmarks(); syncUI(); };
$('s-recenter').onclick = () => { geo = defaultGeo(); applyGeo(); store.set('geo', geo); };

let resetArmed = false;
$('s-reset').onclick = () => {
  const b = $('s-reset');
  if (!resetArmed) {
    resetArmed = true; b.textContent = 'Cliquer encore pour confirmer';
    setTimeout(() => { resetArmed = false; b.textContent = 'Tout réinitialiser'; }, 4000);
    return;
  }
  resetArmed = false; b.textContent = 'Tout réinitialiser';
  try { Object.keys(localStorage).filter(k => k.indexOf('rztab_') === 0).forEach(k => localStorage.removeItem(k)); } catch (e) {}
  Object.keys(modes).forEach(k => delete modes[k]);
  Object.keys(auto).forEach(k => delete auto[k]);
  loadSettings();
  zoom = cfg.zoom || 0.6; updateZoomLabel(); applyFrameZoom();
  geo = defaultGeo(); applyGeo();
  bookmarks = defaultBookmarks(); renderBookmarks();
  applySettings(); pushSettings();
  const t = T();
  if (t && t.idx >= 0) loadActive(true);
};
