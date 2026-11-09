/* Recherche facon Spotlight : glisser vers le bas sur l'accueil, ou la pastille "Rechercher" au-dessus du dock.
   Cherche dans les apps, les notes, les vehicules, les entreprises, les reglages et quelques actions ;
   calcule aussi les operations tapees (12*3+4) et propose d'ouvrir un site autorise.
   Fleches haut / bas pour choisir, Entree pour ouvrir, Echap pour fermer. */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const RZ = () => window.RZ;
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const icon = (id, cls) => {
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
    const u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#' + id); s.appendChild(u); return s;
  };
  const sp = $('sp'), q = $('sp-q'), res = $('sp-res'), homeEl = $('home');
  const get = (k) => (RZ() && RZ().getSetting ? RZ().getSetting(k) : undefined);
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let isOpen = false, sel = 0, items = [];

  /* ---------- Donnees chargees a l'ouverture (gardees 20 s) ---------- */
  const data = { notes: [], veh: [], svc: [], at: 0 };
  function fetchAll() {
    if (Date.now() - data.at < 20000) return;
    data.at = Date.now();
    const done = () => { if (isOpen && q.value.trim()) render(); };
    if (window.RZNotes && RZNotes.list) RZNotes.list().then((r) => { data.notes = r && r.ok && Array.isArray(r.notes) ? r.notes : []; done(); }).catch(() => {});
    if (window.RZVeh && RZVeh.summary) RZVeh.summary().then((r) => { data.veh = r ? r.mine.concat(r.company ? r.company.list : []) : []; done(); }).catch(() => {});
    if (window.RZSvc && RZSvc.fetchList) RZSvc.fetchList().then((l) => { data.svc = Array.isArray(l) ? l : []; done(); }).catch(() => {});
  }

  /* ---------- Calcul : chiffres, + - * / x, parentheses, % ---------- */
  function calc(src) {
    const s = src.replace(/\s+/g, '').replace(/[x×]/gi, '*').replace(/÷/g, '/').replace(/,/g, '.');
    if (!/^[\d.+\-*/()%]+$/.test(s) || !/\d/.test(s) || !/[+\-*/%]/.test(s.replace(/^-/, ''))) return null;
    let i = 0;
    const peek = () => s[i];
    function num() {
      if (peek() === '(') { i++; const v = expr(); if (peek() !== ')') throw 0; i++; return v; }
      if (peek() === '-') { i++; return -factor(); }
      if (peek() === '+') { i++; return factor(); }
      const m = /^\d*\.?\d+|^\d+\./.exec(s.slice(i)); if (!m) throw 0;
      i += m[0].length; return parseFloat(m[0]);
    }
    function factor() { let v = num(); while (peek() === '%') { i++; v /= 100; } return v; }
    function term() { let v = factor(); while (peek() === '*' || peek() === '/') { const o = s[i++]; const r = factor(); v = o === '*' ? v * r : v / r; } return v; }
    function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const o = s[i++]; const r = term(); v = o === '+' ? v + r : v - r; } return v; }
    try { const v = expr(); if (i !== s.length || !isFinite(v)) return null; return v; } catch (e) { return null; }
  }

  /* ---------- Sources ---------- */
  function score(text, qn) {
    const t = norm(text);
    if (!qn) return 0;
    if (t.startsWith(qn)) return 3;
    if (t.split(/[\s'’\-()/]+/).some((w) => w.startsWith(qn))) return 2;
    return t.includes(qn) ? 1 : 0;
  }
  const SETTINGS = [
    { id: 'sp-display', title: 'Affichage', k: "fond d'ecran image luminosite horloge 24 h opacite", ic: 'ic-monitor' },
    { id: 'sp-controls', title: 'Contrôles', k: 'marcher marche deplacement clavier', ic: 'ic-gamepad', when: () => RZ().canWalk() },
    { id: 'sp-browser', title: 'Navigateur', k: 'zoom favoris sites internet', ic: 'ic-globe' },
    { id: 'sp-notifs', title: 'Notifications', k: 'son apercu ne pas deranger ecran verrouille banniere', ic: 'ic-bell' },
    { id: 'sp-airdrop', title: 'AirDrop', k: 'partage reception', ic: 'ic-airdrop' },
    { id: 'sp-lock', title: 'Verrouillage', k: 'code face id securite mot de passe', ic: 'ic-lock' },
    { id: 'sp-tablet', title: 'Tablette', k: 'reinitialiser reset informations', ic: 'ic-tablet' },
  ];
  const ACTIONS = [
    { k: 'ne pas deranger concentration silence', ic: 'ic-moon', title: () => (get('dnd') ? 'Désactiver Ne pas déranger' : 'Activer Ne pas déranger'), run: () => RZ().setDnd(get('dnd') !== true) },
    { k: 'verrouiller verrou bloquer', ic: 'ic-lock', title: () => 'Verrouiller la tablette', when: () => window.RZLock && RZLock.getMode() !== 'none', run: () => RZLock.lockNow() },
    { k: 'centre de controle luminosite reglages rapides', ic: 'ic-sliders', title: () => 'Centre de contrôle', run: () => window.RZCC && RZCC.open() },
    { k: 'apps recentes multitache selecteur', ic: 'ic-tablet', title: () => 'Apps récentes', run: () => window.RZSwitch && RZSwitch.open() },
    { k: 'son couper muet notifications', ic: 'ic-sound', title: () => (get('sound') === false ? 'Activer le son' : 'Couper le son'), run: () => RZ().setSetting('sound', get('sound') === false) },
    { k: 'airdrop partage reception', ic: 'ic-airdrop', title: () => (get('airdrop') === 'off' ? 'Activer la réception AirDrop' : 'Couper la réception AirDrop'), run: () => RZ().setSetting('airdrop', get('airdrop') === 'off' ? 'all' : 'off') },
    { k: 'nouvelle note ecrire', ic: 'ic-compose', title: () => 'Nouvelle note', run: () => window.RZNotes && RZNotes.create && RZNotes.create() },
    { k: 'recentrer fenetre centrer', ic: 'ic-center', title: () => 'Recentrer la fenêtre', run: () => $('reset-win').click() },
  ];
  const lines = (b) => String(b || '').split('\n').map((x) => x.trim()).filter(Boolean);

  function search(raw) {
    const qn = norm(raw.trim());
    const out = { apps: [], calc: null, actions: [], notes: [], veh: [], svc: [], settings: [], web: null };
    const v = calc(raw);
    if (v != null) out.calc = { expr: raw.trim(), value: v };
    if (!qn) return out;
    // chaque groupe garde sa meilleure note : les groupes s'affichent du plus pertinent au moins pertinent
    out.best = {};
    const take = (name, list, fn, n, tie) => {
      const l = list.map((x) => ({ x, s: fn(x) })).filter((x) => x.s).sort((a, b) => b.s - a.s || (tie ? tie(a.x, b.x) : 0)).slice(0, n);
      out.best[name] = l.length ? l[0].s : 0;
      out[name] = l.map((x) => x.x);
    };
    const apps = window.RZHome ? RZHome.catalog().filter((a) => RZHome.isInstalled(a.id)) : [];
    take('apps', apps, (a) => Math.max(score(a.label, qn) * 2, score(a.subtitle, qn)), 6);
    take('actions', ACTIONS.filter((x) => !x.when || x.when()), (x) => Math.max(score(x.title(), qn) * 2, score(x.k, qn)), 3);
    take('settings', SETTINGS.filter((x) => !x.when || x.when()), (x) => Math.max(score(x.title, qn) * 2, score(x.k, qn)), 3);
    take('notes', data.notes, (n) => score(lines(n.body)[0], qn) * 2 || score(n.body, qn), 4, (a, b) => b.updated - a.updated);
    take('veh', data.veh, (x) => Math.max(score(x.plate, qn) * 2, score(x.title, qn)), 4);
    take('svc', data.svc, (x) => Math.max(score(x.label, qn) * 2, score(x.job, qn)), 4, (a, b) => (b.open ? 1 : 0) - (a.open ? 1 : 0));
    const w = RZ() && RZ().webTarget ? RZ().webTarget(raw) : null;
    if (w && w.allowed && !out.calc) out.web = w;
    return out;
  }

  /* ---------- Affichage ---------- */
  // le texte cherche en gras dans le titre
  function mark(text, raw) {
    const el = h('span', 'sp-t');
    const qn = norm(raw.trim()), t = String(text || ''), tn = norm(t);
    const at = qn ? tn.indexOf(qn) : -1;
    if (at < 0) { el.textContent = t; return el; }
    el.append(document.createTextNode(t.slice(0, at)), h('b', null, t.slice(at, at + qn.length)), document.createTextNode(t.slice(at + qn.length)));
    return el;
  }
  function snippet(body, raw) {
    const b = String(body || '').replace(/\s+/g, ' ').trim(), qn = norm(raw.trim());
    const at = norm(b).indexOf(qn);
    if (at < 0) return lines(body)[1] || '';
    const start = Math.max(0, at - 24);
    return (start ? '…' : '') + b.slice(start, at + qn.length + 50);
  }
  function section(label) { const s = h('div', 'sp-sec'); s.append(h('div', 'sp-label', label)); res.append(s); return s; }
  function rowEl(box, o) {
    const b = h('button', 'sp-row');
    const ic = h('span', 'sp-ic t-' + (o.tone || 'gray'));
    if (o.iconEl) ic.append(o.iconEl); else ic.append(icon(o.ic));
    if (o.iconEl) ic.classList.add('app');
    const tx = h('span', 'grow');
    tx.append(o.titleEl || h('span', 'sp-t', o.title));
    if (o.sub) tx.append(h('small', null, o.sub));
    b.append(ic, tx);
    if (o.hint) b.append(h('span', 'sp-hint', o.hint));
    b.onclick = () => pick(o.run, o.stay);
    box.append(b);
    items.push({ el: b, run: o.run, stay: o.stay });
    return b;
  }
  function appsRow(box, list) {
    const wrap = h('div', 'sp-apps');
    list.forEach((a) => {
      const b = h('button', 'sp-app');
      b.append(RZHome.iconEl(a.id), h('span', null, a.label));
      const run = () => RZHome.open(a.id);
      b.onclick = () => pick(run);
      wrap.append(b);
      items.push({ el: b, run });
    });
    box.append(wrap);
  }
  const fmtNum = (v) => v.toLocaleString('fr-FR', { maximumFractionDigits: 8 });

  function render() {
    const raw = q.value;
    res.textContent = ''; items = [];
    $('sp-x').classList.toggle('hidden', !raw);
    if (!raw.trim()) {
      // sans texte : les apps recentes (sinon les premieres apps installees)
      const keys = window.RZSwitch ? RZSwitch.keys() : [];
      let list = keys.map((k) => RZHome.byId(k.startsWith('app:') ? k.slice(4) : k)).filter((a) => a && RZHome.isInstalled(a.id));
      if (list.length < 4) list = list.concat(RZHome.catalog().filter((a) => RZHome.isInstalled(a.id) && !list.includes(a) && a.id !== 'store'));
      appsRow(section(keys.length ? 'Apps récentes' : 'Suggestions'), list.slice(0, 6));
      sel = -1; paint(); return;
    }
    const r = search(raw);
    if (r.calc) {
      const s = section('Calcul');
      rowEl(s, { ic: 'ic-calc', tone: 'dark', titleEl: h('span', 'sp-t sp-calc', '= ' + fmtNum(r.calc.value)), sub: r.calc.expr, hint: 'Calculatrice',
        run: () => RZ().showView('calculator') });
    }
    const GROUPS = {
      apps: () => appsRow(section('Apps'), r.apps),
      actions: () => { const s = section('Actions'); r.actions.forEach((x) => rowEl(s, { ic: x.ic, tone: 'indigo', titleEl: mark(x.title(), raw), run: x.run, stay: x.ic === 'ic-moon' || x.ic === 'ic-sound' || x.ic === 'ic-airdrop' })); },
      veh: () => {
        const s = section('Véhicules');
        r.veh.forEach((v) => rowEl(s, { ic: 'ic-car', tone: 'blue', titleEl: mark(v.title, raw), sub: v.plate + ' · ' + v.status, run: () => RZVeh.open(v.plate, v.tab) }));
      },
      svc: () => {
        const s = section('Entreprises');
        r.svc.forEach((x) => rowEl(s, { ic: 'ic-briefcase', tone: 'purple', titleEl: mark(x.label, raw), sub: x.open ? 'Ouvert · ' + (x.online || 0) + ' en service' : 'Fermé', run: () => RZSvc.open(x.id) }));
      },
      notes: () => {
        const s = section('Notes');
        r.notes.forEach((n) => rowEl(s, { ic: 'ic-compose', tone: 'yellow', titleEl: mark(lines(n.body)[0] || 'Nouvelle note', raw), sub: snippet(n.body, raw), run: () => RZNotes.open(n.id) }));
      },
      settings: () => {
        const s = section('Réglages');
        r.settings.forEach((x) => rowEl(s, { ic: x.ic, tone: 'gray', titleEl: mark(x.title, raw), sub: 'Réglages', run: () => RZ().openSettings(x.id) }));
      },
    };
    // a pertinence egale, l'ordre ci-dessus
    Object.keys(GROUPS).filter((k) => r[k].length).sort((a, b) => r.best[b] - r.best[a]).forEach((k) => GROUPS[k]());
    if (r.web) {
      const s = section('Web');
      rowEl(s, { ic: 'ic-globe', tone: 'cyan', title: r.web.search ? 'Rechercher « ' + raw.trim() + ' »' : 'Ouvrir ' + r.web.host, sub: r.web.host, run: () => RZ().openUrl(r.web.url) });
    }
    if (!items.length) res.append(h('div', 'sp-none', 'Aucun résultat pour « ' + raw.trim() + ' »'));
    sel = items.length ? 0 : -1;
    paint();
  }
  function paint() {
    items.forEach((it, i) => it.el.classList.toggle('sel', i === sel));
    if (sel >= 0 && items[sel]) items[sel].el.scrollIntoView({ block: 'nearest' });
  }
  function pick(run, stay) {
    if (stay) { run(); render(); q.focus(); return; }
    close(true);
    setTimeout(run, 0);
  }

  q.addEventListener('input', render);
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      paint();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = items[sel >= 0 ? sel : 0];
      if (it) pick(it.run, it.stay);
    }
  });
  $('sp-x').onclick = () => { q.value = ''; render(); q.focus(); };

  /* ---------- Ouvrir / fermer ---------- */
  function open() {
    if (isOpen || !RZ() || !RZ().isOpen()) return false;
    if (window.RZLock && RZLock.visible()) return false;
    if (window.RZCC) RZCC.close();
    if (window.RZNotif) RZNotif.closeCenter();
    isOpen = true;
    q.value = '';
    fetchAll();
    render();
    sp.classList.remove('hidden'); void sp.offsetWidth; sp.classList.add('open');
    setTimeout(() => { if (isOpen) q.focus(); }, 60);
    return true;
  }
  function close(instant) {
    if (!isOpen) return false;
    isOpen = false;
    if (document.activeElement === q) q.blur();
    sp.classList.remove('open');
    if (instant) sp.classList.add('hidden');
    else setTimeout(() => { if (!isOpen) sp.classList.add('hidden'); }, 240);
    return true;
  }
  sp.addEventListener('click', (e) => { if (!e.target.closest('.sp-box')) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) { close(); e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  window.addEventListener('message', (e) => { if (e.data && e.data.action === 'close' && isOpen) close(true); });

  // pastille "Rechercher" et glisser vers le bas sur l'accueil
  $('home-search').addEventListener('click', (e) => { e.stopPropagation(); open(); });
  let sw = null;
  homeEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || homeEl.classList.contains('editing') || e.target.closest('.home-done, .home-add, .home-alert, .dock')) return;
    sw = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  homeEl.addEventListener('pointermove', (e) => {
    if (!sw || e.pointerId !== sw.id) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (homeEl.classList.contains('editing') || dy < -10 || Math.abs(dx) > 40) { sw = null; return; }
    if (dy > 46 && dy > Math.abs(dx) * 1.5) { sw = null; open(); }
  });
  const swEnd = () => { sw = null; };
  homeEl.addEventListener('pointerup', swEnd);
  homeEl.addEventListener('pointercancel', swEnd);

  window.RZSearch = { open, close, isOpen: () => isOpen };
})();
