/* Application Vehicules : carte grise des vehicules (table owned_vehicles d'ESX) et localisation.
   Onglets : mes vehicules / ceux de mon entreprise, selon le grade (Config.Vehicles.jobs, verifie par le serveur).
   "Voir sur la carte" ouvre la Carte de la tablette (RZMap.show), qui suit le vehicule s'il roule.
   Expose window.RZVeh.positions() pour les reperes de la Carte.
   Hors du jeu (banc d'essai) : vehicules de demonstration. */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const RZ = () => window.RZ;
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const icon = (id, cls) => {
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
    const u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#' + id); s.appendChild(u); return s;
  };
  const arr = (x) => (Array.isArray(x) ? x : []);
  const stack = $('vh-stack');

  let data = null;          // { mine, company, me, owner }
  let tab = 'mine';         // onglet affiche
  let selPlate = null, selTab = 'mine', pushed = false;
  let timer = null, loadSeq = 0, err = '';

  /* ---------- Serveur (demo hors du jeu) ---------- */
  function demo() {
    const t = Date.now() / 14000;
    return {
      ok: true, owner: 'Alex Martin', me: { x: 195, y: -934 },
      mine: [
        { plate: '46EEK572', name: 'Sultan', make: 'Karin', class: 'Sportives', live: true, stored: false, x: 260 + Math.cos(t) * 140, y: -870 + Math.sin(t) * 100, zone: 'Pillbox Hill', fuel: 62, engine: 941, body: 868 },
        { plate: '88LSC001', name: 'Elegy RH8', make: 'Annis', class: 'Sportives', live: false, stored: false, x: -1037, y: -2730, seen: 1260, zone: 'Aéroport de Los Santos', fuel: 18, engine: 420, body: 612 },
        { plate: '12ABC345', name: 'Baller', make: 'Gallivanter', class: 'SUV', live: false, stored: true, fuel: 100, engine: 1000, body: 1000 },
      ],
      company: {
        job: 'police', label: 'Police', see: true, locate: true,
        list: [
          { plate: 'LSPD 01', name: 'Police Cruiser', make: 'Vapid', class: 'Urgences', live: true, stored: false, x: 425 + Math.sin(t * 1.3) * 220, y: -979 + Math.cos(t * 1.3) * 160, zone: 'Mission Row', holder: 'Jean Dupont', fuel: 80, engine: 1000, body: 990 },
          { plate: 'LSPD 02', name: 'Police Buffalo', make: 'Bravado', class: 'Urgences', live: false, stored: true, fuel: 100, engine: 1000, body: 1000 },
        ],
      },
    };
  }
  function call(act) {
    if (RZ() && RZ().isFiveM) return RZ().postJson('veh', { act });
    const d = demo();
    if (act === 'list') return Promise.resolve(d);
    const list = [];
    d.mine.forEach((v) => { if (v.x != null) list.push(Object.assign({ own: 'me' }, v)); });
    d.company.list.forEach((v) => { if (v.x != null) list.push(Object.assign({ own: 'job' }, v)); });
    return Promise.resolve({ ok: true, list });
  }

  /* ---------- Mise en forme ---------- */
  const title = (v) => [v.make, v.name].filter(Boolean).join(' ') || 'Véhicule';
  function ago(s) {
    s = Math.max(0, Number(s) || 0);
    if (s < 60) return "moins d'une minute";
    if (s < 3600) return Math.round(s / 60) + ' min';
    if (s < 86400) return Math.round(s / 3600) + ' h';
    return Math.round(s / 86400) + ' j';
  }
  function dist(v, meArg) {
    const me = meArg || (data && data.me);
    if (!me || typeof v.x !== 'number') return '';
    const d = Math.hypot(v.x - me.x, v.y - me.y);
    return d < 1000 ? Math.round(d / 10) * 10 + ' m' : (d / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' km';
  }
  // live : dans le monde ; lost : sorti mais introuvable, derniere position connue ; unknown : sorti, aucune position
  const state = (v) => (v.live ? 'live' : v.stored ? 'garage' : typeof v.x === 'number' ? 'lost' : 'unknown');
  const ORDER = { live: 0, lost: 1, unknown: 2, garage: 3 };
  function status(v, me) {
    const s = state(v);
    if (s === 'live') return ['Sorti', v.zone, dist(v, me)].filter(Boolean).join(' · ');
    if (s === 'garage') return 'Au garage';
    if (s === 'lost') return 'Vu il y a ' + ago(v.seen) + (v.zone ? ' · ' + v.zone : '');
    return 'Sorti · position inconnue';
  }
  const listOf = (t) => (t === 'company' ? arr(data && data.company && data.company.list) : arr(data && data.mine));
  const canLocate = (t) => t === 'mine' || !!(data && data.company && data.company.locate);
  function lockText(co) {
    if (!co.see) return 'Les véhicules ' + (co.label ? 'de ' + co.label + ' ' : '') + 'sont visibles à partir du grade ' + co.need + '.';
    if (co.needLocate) return 'Localisation à partir du grade ' + co.needLocate + '.';
    if (co.needDuty) return 'Prends ton service pour localiser ces véhicules.';
    return '';
  }

  /* ---------- Liste ---------- */
  function row(v) {
    const b = h('button', 'st-row vh-item');
    const ic = h('span', 'vh-ic ' + state(v)); ic.append(icon('ic-car', 'car'));
    const tx = h('span', 'grow');
    const sm = h('small'); sm.append(h('span', 'vh-tag', v.plate), h('span', 'vh-st', status(v)));
    tx.append(h('b', null, title(v)), sm);
    b.append(ic, tx, icon('ic-chev-r', 'st-chev'));
    b.onclick = () => openDetail(v.plate, tab);
    return b;
  }
  function renderList() {
    const co = data && data.company;
    if (!co && tab === 'company') tab = 'mine';
    $('vh-seg').classList.toggle('hidden', !co);
    if (co) $('vh-seg-co').textContent = co.label || 'Entreprise';
    $('vh-seg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));

    let note = '';
    if (!data) note = err || 'Chargement…';
    else if (tab === 'company') note = lockText(co);
    $('vh-note').textContent = note;
    $('vh-note').classList.toggle('hidden', !note);

    const items = data ? listOf(tab) : [];
    const box = $('vh-list'); box.textContent = '';
    items.forEach((v) => box.append(row(v)));
    box.classList.toggle('hidden', !items.length);

    const locked = tab === 'company' && co && !co.see;
    $('vh-empty').textContent = tab === 'company' ? "Aucun véhicule enregistré pour l'entreprise." : 'Aucun véhicule à ton nom.';
    $('vh-empty').classList.toggle('hidden', !data || !!items.length || locked);

    const out = items.filter((v) => v.live).length;
    $('vh-sum').textContent = items.length ? items.length + (items.length > 1 ? ' véhicules' : ' véhicule') + (out ? ' · ' + out + (out > 1 ? ' sortis' : ' sorti') : '') : '';
  }

  /* ---------- Fiche : carte grise, etat, position ---------- */
  function field(dl, label, value, wide) {
    const d = h('div', wide ? 'wide' : null);
    d.append(h('dt', null, label), h('dd', null, value));
    dl.append(d);
  }
  function meter(label, value, max) {
    const p = Math.max(0, Math.min(100, Math.round(value / max * 100)));
    const r = h('div', 'st-row vh-meter');
    const bar = h('i');
    bar.style.setProperty('--p', p + '%');
    bar.style.setProperty('--c', p < 25 ? 'var(--danger)' : p < 55 ? '#ff9f0a' : 'var(--ok)');
    r.append(h('span', null, label), bar, h('span', 'vh-pct', p + ' %'));
    return r;
  }
  function renderDetail() {
    const v = listOf(selTab).find((x) => x.plate === selPlate);
    if (!v) { back(); return; }
    const co = selTab === 'company' ? data.company : null;
    $('vh-title').textContent = v.plate;
    const body = $('vh-detail-body'); body.textContent = '';

    const doc = h('div', 'vh-doc');
    const top = h('div', 'vh-doc-top'); top.append(h('span', null, 'État de San Andreas'), h('b', null, "Certificat d'immatriculation"));
    const plate = h('div', 'vh-plate'); plate.append(h('small', null, 'San Andreas'), h('b', null, v.plate));
    const dl = h('dl', 'vh-fields');
    field(dl, 'Marque', v.make || 'Inconnue');
    field(dl, 'Modèle', v.name || 'Inconnu');
    field(dl, 'Catégorie', v.class || 'Inconnue');
    field(dl, 'Usage', co ? 'Entreprise' : 'Personnel');
    field(dl, 'Titulaire', co ? (co.label || 'Entreprise') + (v.holder ? ', confié à ' + v.holder : '') : (data.owner || 'Toi'), true);
    doc.append(top, plate, dl);
    body.append(doc);

    const ms = [['Carburant', v.fuel, 100], ['Moteur', v.engine, 1000], ['Carrosserie', v.body, 1000]].filter((m) => typeof m[1] === 'number');
    if (ms.length) {
      const sec = h('div', 'st-sec');
      const g = h('div', 'st-group');
      ms.forEach((m) => g.append(meter(m[0], m[1], m[2])));
      sec.append(h('div', 'st-label', 'État au dernier enregistrement'), g);
      body.append(sec);
    }

    const sec = h('div', 'st-sec');
    const g = h('div', 'st-group');
    const r = h('div', 'st-row vh-where');
    const ic = h('span', 'vh-ic sm ' + state(v)); ic.append(icon('ic-pin'));
    r.append(ic, h('span', 'grow', status(v)));
    g.append(r);
    sec.append(h('div', 'st-label', 'Position'), g);

    const can = canLocate(selTab);
    const has = can && typeof v.x === 'number';
    const acts = h('div', 'vh-actions');
    const bMap = h('button', 'vh-btn pri'); bMap.append(icon('ic-locate'), document.createTextNode('Voir sur la carte'));
    const bGps = h('button', 'vh-btn'); bGps.append(icon('ic-pin'), document.createTextNode('Itinéraire'));
    bMap.disabled = bGps.disabled = !has;
    bMap.onclick = () => showOnMap(v);
    bGps.onclick = () => {
      if (!RZ()) return;
      RZ().post('mapWaypoint', { x: v.x, y: v.y });
      if (window.RZIsland) RZIsland.activity('check', 'Itinéraire défini', 'ok', 2000);
    };
    const bShare = h('button', 'vh-btn sq'); bShare.append(icon('ic-share'));
    bShare.title = 'Partager la position avec AirDrop'; bShare.setAttribute('aria-label', 'Partager');
    bShare.disabled = !has;
    bShare.onclick = () => { if (window.RZDrop) RZDrop.share({ kind: 'pos', x: v.x, y: v.y, label: title(v) + ' · ' + v.plate }); };
    acts.append(bMap, bGps, bShare);
    sec.append(acts);
    let foot = '';
    if (!can && co) foot = lockText(co);
    else if (state(v) === 'garage') foot = 'Le véhicule est rangé : il apparaîtra sur la carte une fois sorti.';
    else if (state(v) === 'lost') foot = "Le véhicule n'est plus dans les parages : c'est l'endroit où il a été vu pour la dernière fois.";
    if (foot) sec.append(h('div', 'st-foot', foot));
    body.append(sec);
  }

  function showOnMap(v) {
    if (!window.RZMap || typeof v.x !== 'number') return;
    const plate = v.plate, from = selTab;
    const co = from === 'company' && data.company;
    RZMap.show({
      x: v.x, y: v.y,
      vehicle: { plate, title: title(v), sub: plate + (co ? ' · ' + (co.label || 'Entreprise') : '') },
      back: { label: 'Véhicules', view: 'vehicles', go: () => { tab = from; renderList(); openDetail(plate, from); } },
    });
  }

  /* ---------- Navigation ---------- */
  function openDetail(plate, from) {
    selPlate = plate; selTab = from || tab;
    if (!pushed) { pushed = true; $('vh-detail').scrollTop = 0; $('vh-detail').classList.add('open'); stack.classList.add('pushed'); }
    renderDetail();
  }
  function back() {
    if (!pushed) return false;
    pushed = false; selPlate = null;
    $('vh-detail').classList.remove('open'); stack.classList.remove('pushed');
    return true;
  }
  function reset() {
    pushed = false; selPlate = null;
    stack.classList.add('instant');
    stack.classList.remove('pushed'); $('vh-detail').classList.remove('open');
    void stack.offsetWidth;
    stack.classList.remove('instant');
  }
  $('vh-back').onclick = back;
  $('vh-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b || b.dataset.tab === tab) return;
    tab = b.dataset.tab; renderList();
  });

  async function load() {
    const seq = ++loadSeq;
    const r = await call('list');
    if (seq !== loadSeq) return;
    if (!r || !r.ok) {
      if (r && r.err === 'rate') return;
      err = 'Impossible de charger les véhicules.';
      if (!data) renderList();
      return;
    }
    err = '';
    const sort = (l) => arr(l).sort((a, b) => ORDER[state(a)] - ORDER[state(b)] || title(a).localeCompare(title(b), 'fr'));
    data = { mine: sort(r.mine), company: r.company || null, me: r.me, owner: r.owner };
    if (data.company) data.company.list = sort(data.company.list);
    renderList();
    if (pushed) renderDetail();
  }
  function enter() { renderList(); load(); clearInterval(timer); timer = setInterval(load, 8000); }
  function leave() { clearInterval(timer); timer = null; reset(); }

  // widget et recherche : liste resumee (sortis d'abord) et ouverture d'une carte grise
  async function summary() {
    const r = await call('list');
    if (!r || !r.ok) return null;
    const fmt = (l, t) => arr(l).slice().sort((a, b) => ORDER[state(a)] - ORDER[state(b)] || title(a).localeCompare(title(b), 'fr'))
      .map((v) => ({ plate: v.plate, title: title(v), state: state(v), status: status(v, r.me), tab: t }));
    const co = r.company && r.company.see ? { label: r.company.label, list: fmt(r.company.list, 'company') } : null;
    return { mine: fmt(r.mine, 'mine'), company: co };
  }
  async function openPlate(plate, t) {
    if (RZ().currentView() !== 'vehicles') RZ().showView('vehicles');
    await load();
    tab = t === 'company' ? 'company' : 'mine';
    document.querySelectorAll('#vh-seg button[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    renderList();
    if (listOf(tab).some((v) => v.plate === plate)) openDetail(plate, tab);
  }
  window.RZVeh = { positions: () => call('positions'), summary, open: openPlate };
  if (RZ() && RZ().registerView) RZ().registerView('vehicles', { enter, leave, back });
})();
