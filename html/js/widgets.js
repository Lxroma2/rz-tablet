/* Widgets de l'accueil : calendrier, horloge, meteo, banque, notes, entreprises ouvertes, vehicules.
   La colonne se regle en mode edition (appui long sur une icone ou un widget) :
   "-" retire un widget, "+" ouvre la galerie, on les deplace en les faisant glisser.
   La liste est gardee sur ce poste (rztab_widgets). Petits widgets = 1 case, larges = 2 cases. */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const RZ = () => window.RZ;
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const icon = (id, cls) => {
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
    const u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#' + id); s.appendChild(u); return s;
  };
  const col = $('home-widgets'), homeEl = $('home');
  const editing = () => homeEl.classList.contains('editing');

  const CATALOG = {
    cal: { name: 'Calendrier', desc: 'Le jour et la semaine.', wide: false, ic: 'ic-note', tone: 'red' },
    clock: { name: 'Horloge', desc: "L'heure, en aiguilles.", wide: false, ic: 'ic-circle', tone: 'gray' },
    weather: { name: 'Météo', desc: "Le temps qu'il fait en ville et l'heure du jeu.", wide: false, ic: 'ic-sun', tone: 'blue' },
    bank: { name: 'Banque', desc: 'Ton solde et ta semaine.', wide: false, ic: 'ic-bank', tone: 'green' },
    notes: { name: 'Notes', desc: 'Ta dernière note, ouverte en un clic.', wide: false, ic: 'ic-compose', tone: 'yellow' },
    services: { name: 'Entreprises', desc: 'Les entreprises ouvertes en ce moment.', wide: true, ic: 'ic-briefcase', tone: 'purple' },
    vehicles: { name: 'Véhicules', desc: 'Où sont tes véhicules.', wide: true, ic: 'ic-car', tone: 'indigo' },
  };
  const DEFAULT = ['cal', 'clock', 'weather', 'bank', 'services'];
  const KEY = 'rztab_widgets';
  let layout = (() => {
    try { const v = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(v)) return v.filter((id) => CATALOG[id]); } catch (e) {}
    return DEFAULT.slice();
  })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(layout)); } catch (e) {} };

  /* ---------- Elements : ceux de l'accueil d'origine (calendrier, horloge, entreprises) + les nouveaux ---------- */
  const els = {};
  col.querySelectorAll('[data-w]').forEach((el) => { els[el.dataset.w] = el; });
  function make(id) {
    const el = h(CATALOG[id].wide ? 'button' : 'button', 'wg wg-' + id);
    el.dataset.w = id; el.type = 'button';
    el.setAttribute('aria-label', CATALOG[id].name);
    col.append(el);
    return el;
  }
  ['weather', 'bank', 'notes', 'vehicles'].forEach((id) => { if (!els[id]) els[id] = make(id); });
  Object.keys(els).forEach((id) => {
    const el = els[id];
    if (CATALOG[id].wide) el.classList.add('wide');
    const del = h('span', 'wg-del');
    del.setAttribute('role', 'button'); del.setAttribute('aria-label', 'Retirer le widget ' + CATALOG[id].name);
    del.addEventListener('click', (e) => { e.stopPropagation(); remove(id); });
    el.append(del);
  });

  function apply() {
    layout.forEach((id) => col.append(els[id]));
    col.prepend($('home-add'));                    // la case d'ajout, en tete (visible en mode edition)
    Object.keys(els).forEach((id) => {
      const on = layout.includes(id);
      els[id].classList.toggle('wg-off', !on);
      if (!on) col.append(els[id]);
    });
    $('home-add').classList.toggle('full', layout.length >= Object.keys(CATALOG).length);
  }

  /* ---------- Donnees ---------- */
  const last = {};
  const due = (id, ms) => { const t = Date.now(); if (last[id] && t - last[id] < ms) return false; last[id] = t; return true; };

  // Meteo : l'heure du jeu et le temps (client/widgets.lua) ; hors du jeu, une meteo de demonstration
  const WEATHER = {
    EXTRASUNNY: ['Grand soleil', 'sun', 'day'], CLEAR: ['Dégagé', 'sun', 'day'], NEUTRAL: ['Variable', 'partly', 'cloud'],
    SMOG: ['Brumeux', 'fog', 'cloud'], FOGGY: ['Brouillard', 'fog', 'cloud'], OVERCAST: ['Couvert', 'cloud', 'cloud'],
    CLOUDS: ['Nuageux', 'partly', 'cloud'], CLEARING: ['Éclaircies', 'partly', 'day'], RAIN: ['Pluie', 'rain', 'rain'],
    THUNDER: ['Orage', 'storm', 'storm'], SNOW: ['Neige', 'snow', 'snow'], BLIZZARD: ['Blizzard', 'snow', 'snow'],
    SNOWLIGHT: ['Quelques flocons', 'snow', 'snow'], XMAS: ['Neige', 'snow', 'snow'], HALLOWEEN: ['Nuit étrange', 'fog', 'storm'],
    SNOW_HALLOWEEN: ['Nuit étrange', 'snow', 'storm'],
  };
  const WICON = {
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
    moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
    cloud: '<path d="M7 18.5h10.2a4.3 4.3 0 0 0 .5-8.6A6 6 0 0 0 6.3 11.4 3.6 3.6 0 0 0 7 18.5z"/>',
    partly: '<path d="M8.2 6.3A4 4 0 0 1 14.4 8"/><path d="M5.2 4.6l.9.9M8.5 2.7v1.3M3 8.4h1.3"/><path d="M8 19.5h9.4a3.9 3.9 0 0 0 .4-7.8 5.4 5.4 0 0 0-10.3 1.4A3.2 3.2 0 0 0 8 19.5z"/>',
    rain: '<path d="M7 15.5h10.2a4.3 4.3 0 0 0 .5-8.6A6 6 0 0 0 6.3 8.4 3.6 3.6 0 0 0 7 15.5z"/><path d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5"/>',
    storm: '<path d="M7 15h10.2a4.3 4.3 0 0 0 .5-8.6A6 6 0 0 0 6.3 7.9 3.6 3.6 0 0 0 7 15z"/><path d="M12.5 15.5l-2 3.5h3l-2 3.5"/>',
    fog: '<path d="M7 13h10.2a4.3 4.3 0 0 0 .5-8.6A6 6 0 0 0 6.3 5.9 3.6 3.6 0 0 0 7 13z"/><path d="M4 16.5h16M6 20h12"/>',
    snow: '<path d="M7 14.5h10.2a4.3 4.3 0 0 0 .5-8.6A6 6 0 0 0 6.3 7.4 3.6 3.6 0 0 0 7 14.5z"/><path d="M8.5 18v.01M12 19.5v.01M15.5 18v.01M10 21.5v.01M14 21.5v.01" stroke-width="2.4"/>',
  };
  function gameInfo() {
    if (RZ() && RZ().isFiveM) return RZ().postJson('gameInfo');
    const d = new Date();
    return Promise.resolve({ ok: true, weather: 'CLEARING', h: d.getHours(), m: d.getMinutes() });
  }
  function renderWeather(r) {
    const el = els.weather;
    const w = WEATHER[String(r && r.weather || '').toUpperCase()] || ['Variable', 'partly', 'cloud'];
    const hr = Number(r && r.h), mn = Number(r && r.m);
    const known = isFinite(hr) && isFinite(mn) && r && r.h != null;
    const night = known && (hr < 6 || hr >= 21);
    let ic = w[1], sky = w[2], label = w[0];
    if (night && ic === 'sun') { ic = 'moon'; label = r.weather === 'EXTRASUNNY' || r.weather === 'CLEAR' ? 'Nuit claire' : label; }
    if (night && (sky === 'day' || sky === 'cloud')) sky = 'night';
    el.dataset.sky = sky;
    el.textContent = '';
    const top = h('div', 'ww-top');
    top.append(h('span', null, 'Los Santos'), h('b', null, known ? String(hr).padStart(2, '0') + ':' + String(mn).padStart(2, '0') : '--:--'));
    const pic = document.createElementNS(NS, 'svg');
    pic.setAttribute('viewBox', '0 0 24 24'); pic.setAttribute('class', 'ww-ic'); pic.innerHTML = WICON[ic] || WICON.partly;
    el.append(top, pic, h('b', 'ww-label', label), h('span', 'ww-sub', known ? 'Heure en ville' : 'Météo indisponible'));
    el.append(delOf('weather'));
  }
  async function loadWeather() {
    const r = await gameInfo();
    renderWeather(r && r.ok ? r : null);
  }

  // Banque : solde et 7 derniers jours (RZBank.summary, bank.js)
  const money = (n, cur, sign) => {
    const v = Math.abs(Math.round(Number(n) || 0)).toLocaleString('fr-FR');
    return (sign ? (n > 0 ? '+' : n < 0 ? '-' : '') : (n < 0 ? '-' : '')) + v + ' ' + (cur || '$');
  };
  async function loadBank() {
    const el = els.bank;
    const r = window.RZBank ? await RZBank.summary() : null;
    el.textContent = '';
    const top = h('div', 'wb-top'); top.append(icon('ic-bank'), h('span', null, (r && r.name) || 'Banque'));
    el.append(top);
    if (!r || !r.ok) { el.append(h('span', 'wg-msg', 'Compte indisponible.')); el.append(delOf('bank')); return; }
    const bal = h('b', 'wb-bal', money(r.balance, r.currency));
    if (bal.textContent.length > 11) bal.classList.add('long');
    const wk = h('div', 'wb-week');
    wk.append(h('span', 'in', money(r.income || 0, r.currency, true)), h('span', 'out', money(-(r.spent || 0), r.currency, true)));
    el.append(h('span', 'wb-lbl', 'Solde'), bal, wk, h('span', 'wb-sub', '7 derniers jours'));
    el.append(delOf('bank'));
  }

  // Notes : la plus recente (RZNotes.list, notes.js)
  let lastNote = null;
  async function loadNotes() {
    const el = els.notes;
    const r = window.RZNotes && RZNotes.list ? await RZNotes.list() : null;
    el.textContent = '';
    const top = h('div', 'wn-top'); top.append(icon('ic-compose'), h('span', null, 'Notes'));
    el.append(top);
    const list = r && r.ok && Array.isArray(r.notes) ? r.notes.slice().sort((a, b) => b.updated - a.updated) : null;
    lastNote = list && list[0] ? list[0] : null;
    if (!list) el.append(h('span', 'wg-msg', r && r.err === 'locked' ? 'Déverrouille la tablette.' : 'Notes indisponibles.'));
    else if (!lastNote) el.append(h('span', 'wg-msg', 'Aucune note. Touche pour en écrire une.'));
    else {
      const lines = String(lastNote.body || '').split('\n').map((x) => x.trim()).filter(Boolean);
      top.append(h('b', null, String(list.length)));
      el.append(h('b', 'wn-title', lines[0] || 'Nouvelle note'), h('span', 'wn-body', lines.slice(1).join(' ') || 'Aucun texte supplémentaire'));
    }
    el.append(delOf('notes'));
  }

  // Vehicules : jusqu'a 3, les sortis d'abord (RZVeh.summary, vehicles.js)
  async function loadVehicles() {
    const el = els.vehicles;
    const r = window.RZVeh && RZVeh.summary ? await RZVeh.summary() : null;
    el.textContent = '';
    const top = h('div', 'hw-head'); top.append(icon('ic-car'), h('span', null, 'Véhicules'));
    el.append(top);
    if (!r) { el.append(h('div', 'hw-empty', 'Véhicules indisponibles.')); el.append(delOf('vehicles')); return; }
    let rows = r.mine.slice(0, 3);
    if (!rows.length && r.company) rows = r.company.list.slice(0, 3);
    const out = r.mine.filter((v) => v.state === 'live').length;
    top.append(h('b', null, out ? out + ' sorti' + (out > 1 ? 's' : '') : String(r.mine.length)));
    const list = h('div', 'hw-list');
    rows.forEach((v) => {
      const row = h('span', 'hw-row wv-row');
      row.dataset.plate = v.plate; row.dataset.tab = v.tab;
      const dot = h('i', 'wv-dot ' + v.state);
      const name = h('span', 'n'); name.append(document.createTextNode(v.title + ' '), h('em', null, v.plate));
      row.append(dot, name, h('span', 'c', v.status));
      list.append(row);
    });
    if (!rows.length) list.append(h('div', 'hw-empty', 'Aucun véhicule à ton nom.'));
    el.append(list, delOf('vehicles'));
  }

  // le "-" est recree quand le contenu du widget est reconstruit
  function delOf(id) {
    const del = h('span', 'wg-del');
    del.setAttribute('role', 'button'); del.setAttribute('aria-label', 'Retirer le widget ' + CATALOG[id].name);
    del.addEventListener('click', (e) => { e.stopPropagation(); remove(id); });
    return del;
  }

  const LOADERS = {
    weather: [loadWeather, 20000], bank: [loadBank, 15000], notes: [loadNotes, 15000], vehicles: [loadVehicles, 12000],
    services: [() => window.RZSvc && RZSvc.homeWidget(), 9000],
  };
  // a l'arrivee sur l'accueil et toutes les 10 s tant qu'il est affiche
  function refresh(force) {
    if (!RZ() || RZ().currentView() !== 'home') return;
    layout.forEach((id) => {
      const L = LOADERS[id];
      if (L && (force || due(id, L[1]))) { last[id] = Date.now(); Promise.resolve(L[0]()).catch(() => {}); }
    });
  }
  setInterval(() => { if (RZ() && RZ().isOpen()) refresh(false); }, 10000);

  /* ---------- Clics : ouvrent l'app (sauf en mode edition) ---------- */
  col.addEventListener('click', (e) => {
    const w = e.target.closest('[data-w]');
    if (!w || e.target.closest('.wg-del')) return;
    if (editing() || suppress) { suppress = false; e.stopPropagation(); e.preventDefault(); return; }
    const id = w.dataset.w;
    if (id === 'bank') RZ().showView('bank');
    else if (id === 'notes') { if (lastNote && RZNotes.open) RZNotes.open(lastNote.id); else if (RZNotes.create) RZNotes.create(); else RZ().showView('notes'); }
    else if (id === 'vehicles') {
      const row = e.target.closest('.wv-row');
      if (row && RZVeh.open) RZVeh.open(row.dataset.plate, row.dataset.tab); else RZ().showView('vehicles');
    } else if (id === 'weather') { if (window.RZHome && RZHome.isInstalled('maps')) RZ().showView('maps'); }
  }, true);

  /* ---------- Mode edition : appui long, deplacement, retrait, galerie ---------- */
  let press = null, suppress = false;
  col.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || press) return;
    const w = e.target.closest('#home-widgets > [data-w]');
    if (!w || e.target.closest('.wg-del')) return;
    press = { w, id: e.pointerId, x: e.clientX, y: e.clientY, timer: null, drag: null };
    if (!editing()) press.timer = setTimeout(() => { if (press) { press.timer = null; suppress = true; if (window.RZHome) RZHome.startEdit(); } }, 480);
  });
  col.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.id) return;
    const dist = Math.hypot(e.clientX - press.x, e.clientY - press.y);
    if (press.timer) { if (dist > 8) { clearTimeout(press.timer); press = null; } return; }
    if (!editing()) return;
    if (!press.drag) { if (dist < 6) return; dragStart(e); }
    dragMove(e);
  });
  const release = (e) => {
    if (!press || e.pointerId !== press.id) return;
    clearTimeout(press.timer);
    const p = press; press = null;
    if (p.drag) dragEnd(p);
  };
  col.addEventListener('pointerup', release);
  col.addEventListener('pointercancel', release);

  function dragStart(e) {
    const w = press.w, r = w.getBoundingClientRect();
    try { w.setPointerCapture(e.pointerId); } catch (err) { /* pointeur deja relache */ }
    press.drag = { gx: e.clientX - r.left, gy: e.clientY - r.top };
    w.classList.add('dragging');
    suppress = true;
  }
  function visible() { return [...col.children].filter((x) => x.dataset.w && !x.classList.contains('wg-off') && !x.classList.contains('hidden')); }
  function flip(mutate, skip) {
    const list = visible().filter((x) => x !== skip);
    const before = new Map(list.map((x) => [x, x.getBoundingClientRect()]));
    mutate();
    list.forEach((x) => {
      const a = before.get(x), n = x.getBoundingClientRect();
      const dx = a.left - n.left, dy = a.top - n.top;
      if (dx || dy) x.animate([{ transform: 'translate(' + dx + 'px, ' + dy + 'px)' }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    });
  }
  function dragMove(e) {
    const w = press.w, d = press.drag;
    for (const o of visible()) {
      if (o === w) continue;
      const r = o.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) continue;
      const after = o.classList.contains('wide') ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2;
      const ref = after ? o.nextElementSibling : o;
      if (ref !== w && w.nextElementSibling !== ref) flip(() => col.insertBefore(w, ref), w);
      break;
    }
    w.style.transform = 'none';
    const n = w.getBoundingClientRect();
    w.style.transform = 'translate(' + (e.clientX - d.gx - n.left) + 'px, ' + (e.clientY - d.gy - n.top) + 'px) scale(1.05)';
  }
  function dragEnd(p) {
    const w = p.w;
    w.style.transition = 'transform 320ms cubic-bezier(.3, 1.2, .5, 1)';
    w.style.transform = '';
    setTimeout(() => { w.style.transition = ''; w.classList.remove('dragging'); }, 320);
    layout = [...col.children].filter((x) => x.dataset.w && layout.includes(x.dataset.w)).map((x) => x.dataset.w);
    save();
  }

  function remove(id) {
    const el = els[id];
    el.classList.add('removing');
    setTimeout(() => {
      el.classList.remove('removing');
      flip(() => { layout = layout.filter((x) => x !== id); save(); apply(); }, el);
    }, 180);
  }
  function add(id) {
    if (layout.includes(id)) return;
    layout.unshift(id); save(); apply();
    els[id].classList.remove('wg-in'); void els[id].offsetWidth; els[id].classList.add('wg-in');
    setTimeout(() => els[id].classList.remove('wg-in'), 500);
    last[id] = 0; refresh(false);
    col.scrollTop = 0;
  }

  // galerie : les widgets qu'on peut ajouter
  const gal = $('wgal'), galList = $('wgal-list');
  function openGallery() {
    galList.textContent = '';
    Object.keys(CATALOG).forEach((id) => {
      const c = CATALOG[id], on = layout.includes(id);
      const b = h('button', 'wgal-item' + (on ? ' on' : ''));
      b.disabled = on;
      const ic = h('span', 'wgal-ic t-' + c.tone); ic.append(icon(c.ic));
      const tx = h('span', 'grow'); tx.append(h('b', null, c.name), h('small', null, c.desc));
      b.append(ic, tx, h('span', 'wgal-size', on ? 'Ajouté' : c.wide ? 'Large' : 'Petit'));
      b.onclick = () => { closeGallery(); add(id); };
      galList.append(b);
    });
    gal.classList.remove('hidden'); void gal.offsetWidth; gal.classList.add('open');
  }
  function closeGallery() {
    if (!gal.classList.contains('open')) return false;
    gal.classList.remove('open');
    setTimeout(() => { if (!gal.classList.contains('open')) gal.classList.add('hidden'); }, 260);
    return true;
  }
  $('home-add').addEventListener('click', (e) => { e.stopPropagation(); openGallery(); });
  gal.addEventListener('click', (e) => { if (e.target === gal || e.target.closest('#wgal-close')) closeGallery(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && gal.classList.contains('open')) { closeGallery(); e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  window.addEventListener('message', (e) => { if (e.data && e.data.action === 'close') { gal.classList.remove('open'); gal.classList.add('hidden'); } });

  apply();
  window.RZWidgets = { refresh, add, remove, list: () => layout.slice(), closeGallery };
})();
