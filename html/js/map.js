/* Application Carte : atlas de GTA V en tuiles locales (html/assets/map), affiche avec Leaflet (assets/leaflet, BSD-2).
   - ta position en direct (point bleu + cap), suivie tant que tu ne deplaces pas la carte
   - les entreprises de Services qui ont un emplacement
   - tes vehicules et ceux de ton entreprise (app Vehicules, window.RZVeh), suivis en direct
   - un clic sur la carte : rue, quartier, distance, et bouton Itineraire (point GPS du jeu)
   Calage : pixel = origine + coordonnee du jeu x echelle, verifie sur Legion Square, Mission Row, Pillbox,
   Sandy Shores et Paleto Bay. Si un jour le point est decale, c'est CAL qu'il faut retoucher. */
(() => {
  const $ = (id) => document.getElementById(id);
  const RZ = () => window.RZ;
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  const SIZE = 8192;                                   // atlas complet (zoom 0 de la carte = 1 pixel de l'atlas)
  const CAL = { ox: 3756, oy: 5525, s: 1 / 1.51 };     // pixel de l'origine du monde, pixels par metre
  const toLL = (x, y) => L.latLng(-(CAL.oy - y * CAL.s), CAL.ox + x * CAL.s);
  const fromLL = (ll) => ({ x: (ll.lng - CAL.ox) / CAL.s, y: (CAL.oy + ll.lat) / CAL.s });

  let map = null, me = null, pin = null, wpMark = null, svcLayer = null;
  let pos = null, wp = null, follow = true, first = true, sel = null;
  let posTimer = null, svcTimer = null, vehTimer = null, infoSeq = 0;
  let vehLayer = null, vehMarks = {}, trackFollow = false;   // trackFollow : la carte suit le vehicule choisi

  /* ---------- Donnees du jeu (demo hors du jeu : on tourne autour de Legion Square) ---------- */
  function getPos() {
    if (RZ() && RZ().isFiveM) return RZ().postJson('mapPos');
    const t = Date.now() / 9000;
    return Promise.resolve({ x: 195 + Math.cos(t) * 70, y: -934 + Math.sin(t) * 70, h: (t * 180 / Math.PI) % 360, wx: wp && wp.x, wy: wp && wp.y });
  }
  function getInfo(p) {
    if (RZ() && RZ().isFiveM) return RZ().postJson('mapInfo', { x: p.x, y: p.y });
    return Promise.resolve({ street: 'Rue de démonstration', zone: "Banc d'essai" });
  }

  /* ---------- Carte ---------- */
  function init() {
    if (map || !window.L) return;
    map = L.map('mp-map', {
      crs: L.CRS.Simple, minZoom: -4, maxZoom: 1, zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 110,
      attributionControl: false, zoomControl: false, inertia: true,
      maxBounds: L.latLngBounds([[-SIZE - 800, -800], [800, SIZE + 800]]), maxBoundsViscosity: 0.9,
    });
    L.tileLayer('assets/map/{z}/{x}_{y}.webp', {
      tileSize: 512, zoomOffset: 4, minZoom: -4, maxZoom: 1, minNativeZoom: -4, maxNativeZoom: 0,
      noWrap: true, bounds: L.latLngBounds([[-SIZE, 0], [0, SIZE]]), keepBuffer: 3,
    }).addTo(map);
    svcLayer = L.layerGroup().addTo(map);
    vehLayer = L.layerGroup().addTo(map);
    map.setView(toLL(200, -900), -1.5);
    map.on('dragstart', () => { setFollow(false); trackFollow = false; });
    map.on('click', (e) => select(fromLL(e.latlng)));
    new ResizeObserver(() => map.invalidateSize()).observe($('mp-map'));
  }

  function setFollow(on) {
    follow = on;
    $('mp-me').classList.toggle('on', on);
  }

  // point bleu + cone du cap (le cap du jeu tourne dans le sens inverse des aiguilles)
  function drawMe(p) {
    const ll = toLL(p.x, p.y);
    if (!me) {
      me = L.marker(ll, { icon: L.divIcon({ className: 'mp-me', html: '<i class="mp-cone"></i><i class="mp-dot"></i>', iconSize: [24, 24] }), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(map);
    } else me.setLatLng(ll);
    const cone = me.getElement() && me.getElement().querySelector('.mp-cone');
    if (cone) cone.style.transform = 'rotate(' + (-(p.h || 0)) + 'deg)';
  }
  function drawWaypoint() {
    if (!wp) { if (wpMark) { wpMark.remove(); wpMark = null; } return; }
    const ll = toLL(wp.x, wp.y);
    if (!wpMark) wpMark = L.marker(ll, { icon: L.divIcon({ className: 'mp-wp', html: '<i></i>', iconSize: [30, 38], iconAnchor: [15, 36] }), interactive: false, keyboard: false, zIndexOffset: 500 }).addTo(map);
    else wpMark.setLatLng(ll);
  }

  async function poll() {
    const p = await getPos();
    if (!p || typeof p.x !== 'number' || !map) return;
    pos = p;
    drawMe(p);
    const nwp = typeof p.wx === 'number' ? { x: p.wx, y: p.wy } : null;
    if ((nwp && (!wp || Math.abs(nwp.x - wp.x) > 1 || Math.abs(nwp.y - wp.y) > 1)) || (!nwp && wp)) { wp = nwp; drawWaypoint(); refreshCard(); }
    if (first) { first = false; map.setView(toLL(p.x, p.y), -0.5, { animate: false }); }
    else if (follow) map.panTo(toLL(p.x, p.y), { animate: true, duration: 0.35, easeLinearity: 1, noMoveStart: true });
    if (sel) $('mp-card-d').textContent = dist(sel);
  }

  /* ---------- Entreprises (Services) ---------- */
  const initials = (s) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  async function loadServices() {
    if (!window.RZSvc || !RZSvc.fetchList || !map) return;
    const list = await RZSvc.fetchList();
    svcLayer.clearLayers();
    list.filter((s) => typeof s.x === 'number' && typeof s.y === 'number').forEach((s) => {
      const el = h('div', 'mp-svc-in' + (s.open ? ' open' : ''));
      el.append(h('b', null, initials(s.label || '?')));
      const m = L.marker(toLL(s.x, s.y), { icon: L.divIcon({ className: 'mp-svc', html: el.outerHTML, iconSize: [34, 34] }), keyboard: false, title: s.label });
      m.on('click', (e) => { L.DomEvent.stopPropagation(e); select({ x: s.x, y: s.y }, svcInfo(s)); });
      svcLayer.addLayer(m);
    });
  }

  /* ---------- Vehicules (app Vehicules) ---------- */
  const vehTitle = (v) => [v.make, v.name].filter(Boolean).join(' ') || 'Véhicule';
  const vehInfo = (v) => ({ title: vehTitle(v), sub: v.plate + (v.own === 'job' ? ' · Entreprise' : '') + (v.live ? '' : ' · dernière position connue'), noPin: true, track: v.plate });
  const vehHtml = (v) => '<div class="mp-veh-in ' + (v.own === 'job' ? 'job' : 'me') + (v.live ? '' : ' old') + '"><svg><use href="#ic-car"/></svg></div>';
  function markVeh() {
    Object.keys(vehMarks).forEach((p) => { const el = vehMarks[p].getElement(); if (el) el.classList.toggle('on', !!sel && sel.track === p); });
  }
  async function loadVehicles() {
    if (!window.RZVeh || !map) return;
    const r = await RZVeh.positions();
    if (!r || !r.ok || !map) return;
    const keep = {};
    (Array.isArray(r.list) ? r.list : []).forEach((v) => {
      if (typeof v.x !== 'number' || typeof v.y !== 'number' || !v.plate) return;
      keep[v.plate] = true;
      const ll = toLL(v.x, v.y), html = vehHtml(v);
      let m = vehMarks[v.plate];
      if (!m) {
        m = L.marker(ll, { icon: L.divIcon({ className: 'mp-veh', html, iconSize: [30, 30] }), keyboard: false, title: v.plate, zIndexOffset: 800 });
        m.on('click', (e) => { L.DomEvent.stopPropagation(e); trackFollow = false; const d = m.rzData; select({ x: d.x, y: d.y }, vehInfo(d)); });
        m.rzHtml = html;
        vehLayer.addLayer(m); vehMarks[v.plate] = m;
      } else {
        m.setLatLng(ll);
        if (m.rzHtml !== html) { m.setIcon(L.divIcon({ className: 'mp-veh', html, iconSize: [30, 30] })); m.rzHtml = html; }
      }
      m.rzData = v;
      if (sel && sel.track === v.plate) {
        sel.x = v.x; sel.y = v.y;
        $('mp-card-d').textContent = dist(sel);
        if (trackFollow) map.panTo(ll, { animate: true, duration: 0.6, noMoveStart: true });
      }
    });
    Object.keys(vehMarks).forEach((p) => { if (!keep[p]) { vehMarks[p].remove(); delete vehMarks[p]; } });
    markVeh();
  }

  /* ---------- Point choisi : carte du bas ---------- */
  function dist(p) {
    if (!pos) return '';
    const d = Math.hypot(p.x - pos.x, p.y - pos.y);
    return d < 1000 ? Math.round(d / 10) * 10 + ' m' : (d / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' km';
  }
  const isWp = (p) => wp && Math.hypot(wp.x - p.x, wp.y - p.y) < 3;
  function refreshCard() {
    if (!sel) return;
    const on = isWp(sel);
    $('mp-gps').textContent = on ? 'Retirer le GPS' : 'Itinéraire';
    $('mp-gps').classList.toggle('off', on);
  }
  // info : { title, sub, noPin, track, lookup } ; sans info, la rue et le quartier du point touche
  const svcInfo = (s) => ({ title: s.label, sub: s.open ? 'Ouvert · ' + s.online + ' en service' : 'Fermé', noPin: true });
  async function select(p, info) {
    info = info || { lookup: true };
    sel = { x: p.x, y: p.y, track: info.track || null };
    markVeh();
    if (pin) { pin.remove(); pin = null; }
    if (!info.noPin) pin = L.marker(toLL(p.x, p.y), { icon: L.divIcon({ className: 'mp-pin', html: '<i></i>', iconSize: [26, 34], iconAnchor: [13, 32] }), interactive: false, keyboard: false }).addTo(map);
    const card = $('mp-card');
    $('mp-card-t').textContent = info.title || 'Point sélectionné';
    $('mp-card-s').textContent = info.sub || '';
    $('mp-card-d').textContent = dist(sel);
    card.classList.remove('hidden'); void card.offsetWidth; card.classList.add('in');
    refreshCard();
    if (!info.lookup) return;
    const seq = ++infoSeq;
    const r = await getInfo(p);
    if (seq !== infoSeq || !r) return;
    const street = r.street ? (r.cross ? r.street + ' / ' + r.cross : r.street) : '';
    if (info.title) { $('mp-card-s').textContent = street || r.zone || ''; return; }   // titre impose (position partagee) : la rue passe dessous
    if (street) $('mp-card-t').textContent = street;
    $('mp-card-s').textContent = r.zone || '';
  }
  function unselect() {
    sel = null; infoSeq++; trackFollow = false;
    markVeh();
    if (pin) { pin.remove(); pin = null; }
    const card = $('mp-card'); card.classList.remove('in');
    setTimeout(() => { if (!sel) card.classList.add('hidden'); }, 220);
  }
  $('mp-card-x').onclick = unselect;
  $('mp-share').onclick = () => {
    if (!sel || !window.RZDrop) return;
    RZDrop.share({ kind: 'pos', x: sel.x, y: sel.y, label: $('mp-card-t').textContent });
  };
  $('mp-gps').onclick = () => {
    if (!sel || !RZ()) return;
    if (isWp(sel)) {
      RZ().post('mapWaypoint', { clear: true }); wp = null;
      if (window.RZIsland) RZIsland.activity('pin', 'GPS retiré', '', 1800);
    } else {
      RZ().post('mapWaypoint', { x: sel.x, y: sel.y }); wp = { x: sel.x, y: sel.y };
      if (window.RZIsland) RZIsland.activity('check', 'Itinéraire défini', 'ok', 2000);
    }
    drawWaypoint(); refreshCard();
  };

  /* ---------- Boutons ---------- */
  $('mp-me').onclick = () => { setFollow(true); trackFollow = false; if (pos) map.setView(toLL(pos.x, pos.y), Math.max(map.getZoom(), -0.5), { animate: true }); };
  $('mp-zin').onclick = () => map && map.zoomIn(0.5);
  $('mp-zout').onclick = () => map && map.zoomOut(0.5);

  function enter() {
    init();
    if (!map) return;
    requestAnimationFrame(() => map.invalidateSize());
    setFollow(follow);
    poll(); clearInterval(posTimer); posTimer = setInterval(poll, 300);
    loadServices(); clearInterval(svcTimer); svcTimer = setInterval(loadServices, 20000);
    loadVehicles(); clearInterval(vehTimer); vehTimer = setInterval(loadVehicles, 3000);
  }
  function leave() { clearInterval(posTimer); clearInterval(svcTimer); clearInterval(vehTimer); posTimer = svcTimer = vehTimer = null; trackFollow = false; setRet(null); }

  /* ---------- Ouverture depuis une autre app (Services : emplacement, position partagee) ----------
     o = { x, y, svc | vehicle: { plate, title, sub } | label, back }
     back = { label, view, go() } : bouton retour en haut a gauche (et barre du bas) qui ramene a l'app d'origine */
  let ret = null;
  function setRet(r) {
    ret = r;
    $('mp-ret-l').textContent = r ? r.label : '';
    $('mp-ret').classList.toggle('hidden', !r);
  }
  function goBack() {
    const r = ret; if (!r) return false;
    unselect(); RZ().showView(r.view); if (r.go) r.go();   // showView appelle leave(), qui efface ret
    return true;
  }
  $('mp-ret').onclick = goBack;

  function show(o) {
    if (!o || typeof o.x !== 'number' || typeof o.y !== 'number' || !RZ()) return;
    RZ().showView('maps');                           // enter() : init + suivi de position
    if (!map) return;
    setRet(o.back || null);
    first = false; setFollow(false);                 // le premier point recu ne doit pas recentrer sur le joueur
    map.invalidateSize();
    map.setView(toLL(o.x, o.y), Math.max(map.getZoom(), 0), { animate: false });
    const info = o.svc ? svcInfo(o.svc)
      : o.vehicle ? { title: o.vehicle.title, sub: o.vehicle.sub, noPin: true, track: o.vehicle.plate }
      : { title: o.label, lookup: true };
    select({ x: o.x, y: o.y }, info);
    trackFollow = !!o.vehicle;                       // un vehicule qui roule reste au centre tant qu'on ne bouge pas la carte
  }
  window.RZMap = { show };

  if (RZ() && RZ().registerView) RZ().registerView('maps', { enter, leave, back() { if (ret) return goBack(); if (sel) { unselect(); return true; } return false; } });
})();
