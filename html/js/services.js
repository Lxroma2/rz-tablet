/* Application Services : annuaire des entreprises + conversations.
   Tout le texte venant des joueurs est insere via textContent, jamais innerHTML. */
(() => {
  const $ = (id) => document.getElementById(id);
  const RZ = () => window.RZ;
  const stack = $('sv-stack');

  let path = [];                       // pages ouvertes au-dessus de la liste
  let state = { services: [], threads: [], staff: false, job: '', filter: 'all', tab: 'dir' };
  let selId = null;                    // entreprise ouverte (fiche)
  let editId = null;                   // entreprise en cours de modification (null = nouvelle)
  let conv = null;                     // conversation ouverte : { tid, role, serviceId, service, title, open, lastId }
  let timer = null, tickN = 0;
  let sending = false, delArmed = false, attach = false;

  /* ---------- Outils ---------- */
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const NS = 'http://www.w3.org/2000/svg';
  const icon = (id, cls) => {
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
    const u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#' + id); s.appendChild(u); return s;
  };
  const hue = (str) => { let n = 0; for (let i = 0; i < str.length; i++) n = (n * 31 + str.charCodeAt(i)) % 360; return n; };
  const initials = (label) => {
    const w = label.trim().split(/\s+/).filter(Boolean);
    return (w.length > 1 ? w[0][0] + w[1][0] : label.trim().slice(0, 2)).toUpperCase();
  };
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
  const ago = (ts) => {
    const s = Math.max(0, Date.now() / 1000 - ts);
    if (s < 60) return "à l'instant";
    if (s < 3600) return Math.floor(s / 60) + ' min';
    if (s < 86400) return Math.floor(s / 3600) + ' h';
    return Math.floor(s / 86400) + ' j';
  };
  const clock = (ts) => new Date(ts * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  // pastille d'entreprise : initiales, remplacees par l'image si elle se charge
  const logo = (name, key, image) => {
    const l = h('span', 'sv-logo', initials(name)); l.style.setProperty('--h', hue(key || name));
    if (image) {
      const im = new Image(); im.alt = ''; im.referrerPolicy = 'no-referrer';
      im.onload = () => { l.textContent = ''; l.classList.add('has-img'); l.append(im); };
      im.src = image;
    }
    return l;
  };
  const cur = () => state.services.find((x) => x.id === selId);

  // messages deja vus (pastille "non lu"), propre a ce poste
  const seenGet = () => { try { return JSON.parse(localStorage.getItem('rztab_svc_seen') || '{}'); } catch (e) { return {}; } };
  const seenSet = (key, id) => { try { const s = seenGet(); if ((s[key] || 0) < id) { s[key] = id; localStorage.setItem('rztab_svc_seen', JSON.stringify(s)); } } catch (e) {} };
  const tkey = (t) => t.role + ':' + t.tid;
  const isUnread = (t) => !t.mine && t.lastId > (seenGet()[tkey(t)] || 0);

  /* ---------- Appels serveur (avec donnees de demo hors du jeu) ---------- */
  const now = () => Date.now() / 1000;
  const demo = {
    services: [
      { id: 1, label: 'Police', job: 'police', description: 'Commissariat central de Mission Row.', website: 'https://dynasty8wl.fr/', x: 425, y: -979, online: 3, open: true, mine: false },
      { id: 2, label: 'Ambulance', job: 'ambulance', description: 'Urgences et soins, 24h/24.', website: '', x: 298, y: -584, online: 0, open: false, mine: false },
      { id: 3, label: 'Mécano Los Santos', job: 'mechanic', description: 'Réparations et remorquage.', website: 'https://fr.wikipedia.org/', x: -347, y: -133, online: 1, open: true, mine: true },
    ],
    threads: [
      { tid: 1, lastId: 5, role: 'client', serviceId: 3, service: 'Mécano Los Santos', name: 'Mécano Los Santos', text: 'On arrive dans 5 minutes.', hasPos: false, ts: now() - 300, mine: false },
      { tid: 2, lastId: 9, role: 'company', serviceId: 3, service: 'Mécano Los Santos', name: 'Jean Dupont', text: 'Ma voiture est en panne devant la banque', hasPos: true, ts: now() - 3600, mine: false },
    ],
    messages: [
      { id: 1, from: 'Jean Dupont', text: 'Bonjour, ma voiture est en panne devant la banque.', mine: false, ts: now() - 900 },
      { id: 2, from: 'Jean Dupont', text: '', x: 150, y: -1030, mine: false, ts: now() - 890 },
      { id: 3, from: 'Paul Martin', text: 'On arrive dans 5 minutes.', mine: true, ts: now() - 300 },
    ],
  };
  function call(act, payload) {
    if (!RZ() || !RZ().isFiveM) {
      const map = {
        list: { ok: true, staff: true, job: 'mechanic', services: demo.services },
        threads: { ok: true, threads: demo.threads },
        thread: { ok: true, role: payload && payload.role, serviceId: 3, service: 'Mécano Los Santos', open: true, title: payload && payload.role === 'company' ? 'Jean Dupont' : 'Mécano Los Santos', messages: demo.messages },
        jobs: { ok: true, jobs: [{ name: 'taxi', label: 'Taxi' }, { name: 'police', label: 'Police' }] },
      };
      return Promise.resolve(map[act] || { ok: true, delivered: 1, tid: 1 });
    }
    return RZ().postJson('svc', { act, payload });
  }

  /* ---------- Navigation en pile ---------- */
  function go(id) {
    if (path[path.length - 1] === id) return;
    path.push(id);
    const p = $(id); p.scrollTop = 0; p.classList.add('open');
    stack.classList.add('pushed');
  }
  function back() {
    const id = path.pop();
    if (!id) return false;
    $(id).classList.remove('open');
    if (!path.length) stack.classList.remove('pushed');
    if (id === 'sv-thread') { conv = null; attachSet(false); }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    return true;
  }
  function reset() {
    path = []; delArmed = false; conv = null; attachSet(false);
    stack.classList.add('instant');
    stack.classList.remove('pushed');
    stack.querySelectorAll('.st-page.open').forEach((p) => p.classList.remove('open'));
    void stack.offsetWidth;
    stack.classList.remove('instant');
  }
  document.querySelectorAll('[data-svback]').forEach((b) => { b.onclick = () => back(); });

  /* ---------- Onglets : Entreprises / Messages ---------- */
  function setTab(t) {
    state.tab = t;
    document.querySelectorAll('#sv-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    $('sv-dir').classList.toggle('hidden', t !== 'dir');
    $('sv-msgs').classList.toggle('hidden', t !== 'msg');
    if (t === 'msg') loadThreads();
  }
  document.querySelectorAll('#sv-tabs button').forEach((b) => { b.onclick = () => setTab(b.dataset.t); });

  /* ---------- Annuaire ---------- */
  function renderList() {
    const box = $('sv-list'); box.textContent = '';
    const items = state.services
      .filter((s) => state.filter === 'all' || s.open)
      .sort((a, b) => (b.open - a.open) || a.label.localeCompare(b.label, 'fr'));
    items.forEach((s) => {
      const b = h('button', 'st-row sv-item');
      const mid = h('span', 'grow'); mid.append(h('b', null, s.label));
      if (s.description) mid.append(h('small', null, s.description));
      const st = h('span', 'sv-state' + (s.open ? ' open' : ''));
      st.append(h('i'), document.createTextNode(s.open ? 'Ouvert' : 'Fermé'));
      b.append(logo(s.label, s.job, s.image), mid, st, icon('ic-chev-r', 'st-chev'));
      b.onclick = () => openDetail(s.id);
      box.appendChild(b);
    });
    if (!items.length) {
      box.appendChild(h('div', 'sv-empty', state.services.length ? 'Aucune entreprise ouverte pour le moment.'
        : (state.staff ? 'Aucune entreprise. Ajoute-en une avec le bouton +.' : 'Aucune entreprise pour le moment.')));
    }
    const open = state.services.filter((s) => s.open).length;
    $('sv-sum').textContent = state.services.length ? open + ' ouverte' + (open > 1 ? 's' : '') + ' sur ' + state.services.length : '';
    $('sv-add').classList.toggle('hidden', !state.staff);
  }

  async function load() {
    const r = await call('list');
    if (r && r.ok) {
      state.services = r.services || []; state.staff = !!r.staff; state.job = r.job || '';
      renderList();
      if (path[path.length - 1] === 'sv-detail') {
        if (cur()) renderDetail(); else { while (back()) {} }
      }
    }
    await loadThreads();
  }

  document.querySelectorAll('#sv-filter button').forEach((b) => {
    b.onclick = () => {
      state.filter = b.dataset.f;
      document.querySelectorAll('#sv-filter button').forEach((x) => x.classList.toggle('on', x === b));
      renderList();
    };
  });

  /* ---------- Liste des conversations ---------- */
  async function loadThreads() {
    const r = await call('threads');
    if (!r || !r.ok) return;
    state.threads = r.threads || [];
    $('sv-unread').classList.toggle('hidden', !state.threads.some(isUnread));
    renderThreads();
  }

  function renderThreads() {
    const box = $('sv-threads'); box.textContent = '';
    state.threads.forEach((t) => {
      const unread = isUnread(t);
      const b = h('button', 'st-row sv-thread-row' + (unread ? ' unread' : ''));
      const mid = h('span', 'grow');
      const top = h('b'); top.append(document.createTextNode(t.name), h('span', null, ago(t.ts)));
      const preview = (t.mine ? 'Toi : ' : '') + (t.text || (t.hasPos ? 'Position partagée' : ''));
      mid.append(top, h('small', null, (t.role === 'company' ? t.service + ' · ' : '') + preview));
      b.append(logo(t.name, t.role === 'client' ? t.service : t.name, t.image), mid);
      if (unread) b.append(h('i', 'sv-dot'));
      b.onclick = () => openThread(t);
      box.appendChild(b);
    });
    if (!state.threads.length) box.appendChild(h('div', 'sv-empty', "Aucune conversation. Contacte une entreprise depuis l'annuaire."));
  }

  /* ---------- Fiche d'une entreprise ---------- */
  function row(cls, ico, label, value, onClick) {
    const b = h('button', 'st-row st-link');
    const i = h('span', 'st-ico ' + cls); i.appendChild(icon(ico));
    b.append(i, h('span', 'grow', label));
    if (value) b.append(h('span', 'st-val', value));
    b.append(icon('ic-chev-r', 'st-chev'));
    b.onclick = onClick;
    return b;
  }

  function openDetail(id) { selId = id; delArmed = false; renderDetail(); go('sv-detail'); }
  // fiche d'une entreprise, en repartant de la liste (retour depuis la Carte)
  function openService(id) { reset(); if (state.services.some((x) => x.id === id)) openDetail(id); }
  // ouvre la Carte sur un point ; son bouton retour revient ici (sans Carte : simple point GPS)
  function showOnMap(o, backTo) {
    if (!window.RZMap) { if (RZ()) RZ().post('svcWaypoint', { x: o.x, y: o.y }); return; }
    o.back = { label: 'Services', view: 'services', go: backTo };
    RZMap.show(o);
  }

  function renderDetail() {
    const s = cur(); if (!s) return;
    $('sv-detail-title').textContent = s.label;
    const body = $('sv-detail-body'); body.textContent = '';

    const hero = h('div', 'sv-hero');
    const txt = h('div');
    txt.append(h('h2', null, s.label));
    const st = h('div', 'sv-state' + (s.open ? ' open' : ''));
    st.append(h('i'), document.createTextNode(s.open ? 'Ouvert · ' + s.online + ' en service' : 'Fermé · personne en service'));
    txt.append(st);
    hero.append(logo(s.label, s.job, s.image), txt);
    body.append(hero);
    if (s.description) body.append(h('p', 'sv-desc', s.description));

    const g1 = h('div', 'st-group');
    g1.append(row('c-blue', 'ic-message', 'Envoyer un message', '', () => openThreadFor(s, false)));
    g1.append(row('c-orange', 'ic-pin', 'Envoyer ma position', '', () => openThreadFor(s, true)));
    if (s.website) g1.append(row('c-cyan', 'ic-globe', 'Site web', hostOf(s.website), () => RZ() && RZ().openUrl(s.website)));
    if (s.x != null && s.y != null) g1.append(row('c-green', 'ic-pin', "Voir l'emplacement", '', () => showOnMap({ x: s.x, y: s.y, svc: s }, () => openService(s.id))));
    body.append(g1);

    if (s.mine) {
      const g2 = h('div', 'st-group');
      g2.append(row('c-gray', 'ic-inbox', 'Conversations clients', '', () => { while (back()) {} setTab('msg'); }));
      body.append(g2);
    }
    if (state.staff) {
      const sec = h('div', 'st-sec');
      const g3 = h('div', 'st-group');
      const ed = h('button', 'st-row st-action', "Modifier l'entreprise"); ed.onclick = () => openEdit(s);
      const del = h('button', 'st-row st-action danger', "Supprimer l'entreprise");
      del.onclick = () => {
        if (!delArmed) {
          delArmed = true; del.textContent = 'Appuyer encore pour confirmer';
          setTimeout(() => { delArmed = false; del.textContent = "Supprimer l'entreprise"; }, 4000);
          return;
        }
        delArmed = false;
        call('delete', { id: s.id }).then(() => { while (back()) {} load(); });
      };
      g3.append(ed, del); sec.append(g3, h('div', 'st-foot', 'Réservé au staff. Supprimer efface aussi les conversations.'));
      body.append(sec);
    }
  }

  /* ---------- Conversation ---------- */
  function attachSet(v) {
    attach = v;
    const b = $('sv-attach');
    b.setAttribute('aria-pressed', v ? 'true' : 'false');
    b.title = v ? 'Position jointe (cliquer pour retirer)' : 'Joindre ma position';
  }
  $('sv-attach').onclick = () => attachSet(!attach);

  // ouvre ma conversation avec une entreprise (nouvelle si elle n'existe pas encore)
  function openThreadFor(s, withPos) {
    const t = state.threads.find((x) => x.role === 'client' && x.serviceId === s.id);
    openThread(t || { tid: null, role: 'client', serviceId: s.id, service: s.label, name: s.label, lastId: 0 }, withPos);
  }

  function openThread(t, withPos) {
    const s = state.services.find((x) => x.id === t.serviceId);
    conv = { tid: t.tid, role: t.role, serviceId: t.serviceId, service: t.service, title: t.name, open: s ? s.open : true, lastId: -1 };
    $('sv-thread-title').textContent = t.name;
    const av = $('sv-thread-av'); av.textContent = ''; av.append(logo(t.name, t.role === 'client' ? t.service : t.name, t.image));
    $('sv-chat').textContent = ''; $('sv-text').value = ''; $('sv-send-msg').textContent = '';
    $('sv-closed-note').classList.toggle('hidden', t.role !== 'client' || conv.open);
    attachSet(!!withPos);
    go('sv-thread');
    if (conv.tid) loadThread(true); else renderChat([], true);
  }

  async function loadThread(first) {
    const c = conv; if (!c || !c.tid) return;
    const r = await call('thread', { tid: c.tid, role: c.role });
    if (conv !== c) return;
    if (!r || !r.ok) { $('sv-chat').textContent = ''; $('sv-chat').append(h('div', 'sv-empty', 'Conversation introuvable.')); return; }
    c.open = r.open;
    $('sv-thread-title').textContent = r.title;
    $('sv-closed-note').classList.toggle('hidden', c.role !== 'client' || r.open);
    const last = r.messages.length ? r.messages[r.messages.length - 1].id : 0;
    if (last !== c.lastId) { renderChat(r.messages, first || c.lastId === -1); c.lastId = last; }
    seenSet(c.role + ':' + c.tid, last);
  }

  function renderChat(messages, toBottom) {
    const box = $('sv-chat');
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    box.textContent = '';
    if (!messages.length) { box.append(h('div', 'sv-empty', 'Aucun message. Écris le premier.')); return; }
    let prev = null;
    messages.forEach((m) => {
      const key = (m.mine ? 'me:' : 'th:') + m.from;
      if (key !== prev) box.append(h('div', 'bub-name' + (m.mine ? ' me' : ''), m.from));
      prev = key;
      const b = h('div', 'bub ' + (m.mine ? 'me' : 'them'));
      if (m.text) b.append(h('div', null, m.text));
      if (m.x != null && m.y != null) {
        const p = h('div', 'bub-pos');
        const ico = h('span', 'st-ico c-orange'); ico.append(icon('ic-pin'));
        const go2 = h('button', null, 'Itinéraire');
        go2.onclick = (e) => { e.stopPropagation(); if (RZ()) RZ().post('svcWaypoint', { x: m.x, y: m.y }); };
        p.append(ico, h('span', 't', 'Position partagée'), go2);
        // toucher la bulle : la position sur la Carte de la tablette
        const from = conv ? { tid: conv.tid, role: conv.role, serviceId: conv.serviceId, service: conv.service, name: conv.name, image: conv.image } : null;
        p.onclick = () => showOnMap({ x: m.x, y: m.y, label: m.mine ? 'Ma position' : 'Position de ' + m.from },
          () => { if (from && from.tid) window.RZSvc.openThread(from); });
        b.append(p);
      }
      b.append(h('time', null, clock(m.ts)));
      box.append(b);
    });
    if (toBottom || near) box.scrollTop = box.scrollHeight;
  }

  const SEND_ERR = {
    cooldown: 'Attends quelques secondes avant de renvoyer un message.',
    empty: 'Écris un message ou joins ta position.',
    missing: "Cette conversation n'existe plus.",
  };
  async function sendMsg() {
    const c = conv; if (!c || sending) return;
    const input = $('sv-text'), err = $('sv-send-msg');
    const text = input.value;
    if (!text.trim() && !attach) { err.textContent = SEND_ERR.empty; return; }
    sending = true;
    const r = c.tid
      ? await call('reply', { tid: c.tid, role: c.role, text, withPos: attach })
      : await call('send', { id: c.serviceId, text, withPos: attach });
    sending = false;
    if (r && r.ok) {
      err.textContent = '';
      input.value = ''; attachSet(false);
      if (!c.tid && r.tid) c.tid = r.tid;
      c.lastId = -1;
      await loadThread(true);
      loadThreads();
    } else {
      err.textContent = SEND_ERR[r && r.err] || 'Envoi impossible.';
    }
  }
  $('sv-send').onclick = sendMsg;
  $('sv-text').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendMsg(); } });
  $('sv-text').addEventListener('input', () => { $('sv-send-msg').textContent = ''; });

  /* ---------- Ajout / modification (staff) ---------- */
  const SAVE_ERR = {
    label: 'Le nom est trop court.', image: "Lien d'image invalide (https:// uniquement).", website: 'Adresse invalide (commence par http:// ou https://).',
    job: 'Choisis un métier.', exists: 'Ce métier a déjà une entreprise.', forbidden: 'Action réservée au staff.',
  };

  async function openEdit(s) {
    editId = s ? s.id : null;
    $('sv-edit-title').textContent = s ? 'Modifier' : 'Nouvelle entreprise';
    $('sv-e-label').value = s ? s.label : '';
    $('sv-e-desc').value = s ? s.description : '';
    $('sv-e-web').value = s ? s.website : '';
    $('sv-e-img').value = s ? (s.image || '') : '';
    updatePrev();
    $('sv-e-pos').checked = !s;
    $('sv-e-pos-hint').textContent = s ? (s.x != null ? 'Emplacement déjà défini. Coche pour le remplacer par ta position.' : 'Aucun emplacement défini.')
      : "Utilise l'endroit où tu te trouves comme emplacement.";
    $('sv-e-err').textContent = '';
    const sel = $('sv-e-job'); sel.textContent = '';
    if (s) {
      const o = h('option', null, s.job); o.value = s.job; sel.append(o); sel.disabled = true;
    } else {
      sel.disabled = false;
      const r = await call('jobs');
      const used = new Set(state.services.map((x) => x.job));
      const o0 = h('option', null, 'Choisir un métier…'); o0.value = ''; sel.append(o0);
      ((r && r.jobs) || []).filter((j) => !used.has(j.name)).forEach((j) => {
        const o = h('option', null, j.label); o.value = j.name; sel.append(o);
      });
    }
    go('sv-edit');
  }
  $('sv-add').onclick = () => openEdit(null);

  // apercu de l'image saisie
  let prevTimer = null;
  function updatePrev() {
    const holder = $('sv-e-prev');
    const fresh = logo($('sv-e-label').value || '?', $('sv-e-job').value || 'x', $('sv-e-img').value.trim());
    holder.replaceWith(fresh); fresh.id = 'sv-e-prev';
  }
  $('sv-e-img').addEventListener('input', () => { clearTimeout(prevTimer); prevTimer = setTimeout(updatePrev, 400); });
  $('sv-e-label').addEventListener('input', () => { clearTimeout(prevTimer); prevTimer = setTimeout(updatePrev, 400); });

  $('sv-save').onclick = async () => {
    const err = $('sv-e-err');
    const r = await call('save', {
      id: editId, label: $('sv-e-label').value, job: $('sv-e-job').value,
      description: $('sv-e-desc').value, website: $('sv-e-web').value, image: $('sv-e-img').value, useMyPos: $('sv-e-pos').checked,
    });
    if (r && r.ok) { back(); load(); } else { err.textContent = SAVE_ERR[r && r.err] || 'Enregistrement impossible.'; }
  };

  /* ---------- Clavier : on coupe les touches du jeu pendant la saisie ---------- */
  const isField = (e) => e && e.matches && e.matches('input[type=text], input:not([type]), textarea');
  stack.addEventListener('focusin', (e) => { if (isField(e.target) && RZ()) RZ().setTyping(true); });
  stack.addEventListener('focusout', (e) => { if (isField(e.target) && !isField(e.relatedTarget) && RZ()) RZ().setTyping(false); });
  stack.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isField(e.target)) { e.target.blur(); e.preventDefault(); e.stopPropagation(); } });

  /* ---------- Rafraichissement : conversation ouverte toutes les 3 s, le reste toutes les 9 s ---------- */
  function tick() {
    tickN++;
    if (path[path.length - 1] === 'sv-thread') loadThread(false);
    if (tickN % 3 === 0 && path[path.length - 1] !== 'sv-edit') load();
  }

  /* ---------- Widget de l'accueil : entreprises ouvertes ---------- */
  async function homeWidget() {
    const r = await call('list');
    const box = $('hw-services');
    if (!r || !r.ok) return;
    const open = (r.services || []).filter((x) => x.open).sort((a, b) => b.online - a.online);
    box.classList.toggle('hidden', !(r.services || []).length);
    $('hw-count').textContent = open.length + ' / ' + r.services.length;
    const list = $('hw-list'); list.textContent = '';
    open.slice(0, 4).forEach((x) => {
      const row = h('div', 'hw-row');
      row.append(logo(x.label, x.job, x.image), h('span', 'n', x.label), h('span', 'c', x.online + ' en service'));
      list.append(row);
    });
    if (!open.length) list.append(h('div', 'hw-empty', 'Aucune entreprise ouverte.'));
  }
  $('hw-services').onclick = () => RZ() && RZ().showView('services');

  /* ---------- Points d'entree pour app.js ---------- */
  window.RZSvc = {
    enter() { tickN = 0; load(); clearInterval(timer); timer = setInterval(tick, 3000); },
    leave() { clearInterval(timer); timer = null; reset(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); if (RZ()) RZ().setTyping(false); },
    back,
    homeWidget,
    // pour la Carte : la liste des entreprises (avec emplacement), sans toucher a l'affichage de Services
    async fetchList() { const r = await call('list'); return r && r.ok ? (r.services || []) : []; },
    // recherche : fiche d'une entreprise
    async open(id) { if (RZ().currentView() !== 'services') RZ().showView('services'); await load(); openService(id); },
    incoming() { load(); if (path[path.length - 1] === 'sv-thread') loadThread(false); },
    // depuis une notification : ouvre directement la conversation
    openThread(o) {
      if (!o || !o.tid || (o.role !== 'client' && o.role !== 'company')) return;
      if (conv && conv.tid === o.tid && conv.role === o.role) return;
      reset();
      openThread({ tid: o.tid, role: o.role, serviceId: o.serviceId, service: String(o.service || ''), name: String(o.name || o.service || ''), image: o.image, lastId: 0 });
    },
  };
})();
