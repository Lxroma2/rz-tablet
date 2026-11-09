/* AirDrop : partager une note ou une position avec une tablette proche.
   - RZDrop.share({ kind: 'note', text }) ou ({ kind: 'pos', x, y, label }) ouvre la feuille de partage :
     les tablettes a portee apparaissent (rafraichi toutes les 2 s), un clic envoie la demande.
   - En face : carte "X souhaite te partager..." avec Refuser / Accepter, affichee quand la tablette est
     ouverte et deverrouillee. Accepter ajoute la note dans Notes, ou ouvre la position sur la Carte.
   - Reception coupee dans Reglages > AirDrop : personne ne voit cette tablette.
   Hors du jeu : deux voisins de demonstration, RZDrop.demo('note'|'pos') simule une demande recue. */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const RZ = () => window.RZ;
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const icon = (id, cls) => {
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
    const u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#' + id); s.appendChild(u); return s;
  };
  const sheet = $('ad-sheet'), box = $('ad-people'), modal = $('ad-in');
  const KIND = { note: 'une note', pos: 'une position' };

  /* ---------- Serveur (demo hors du jeu) ---------- */
  const DEMO = [{ id: 7, name: 'Jean D.', dist: 3 }, { id: 9, name: 'Sofia R.', dist: 6 }];
  const demoPay = {};
  function call(act, a, b) {
    if (RZ() && RZ().isFiveM) return RZ().postJson('airdrop', { act, a, b });
    if (act === 'nearby') return Promise.resolve({ ok: true, list: DEMO });
    if (act === 'send') {
      const id = Date.now(), p = DEMO.find((x) => x.id === a);
      setTimeout(() => result({ id, state: a === 9 ? 'declined' : 'accepted', to: p && p.name }), 1500);
      return Promise.resolve({ ok: true, id });
    }
    if (act === 'answer') return Promise.resolve(b && demoPay[a] ? { ok: true, payload: demoPay[a], from: 'Jean D.' } : { ok: true });
    return Promise.resolve({ ok: false });
  }

  /* ---------- Feuille de partage ---------- */
  let item = null, people = [], pollTimer = null;
  const states = {};   // id joueur -> sending | waiting | accepted | declined | expired | error
  const sent = {};     // id demande -> id joueur
  const nodes = {};    // id joueur -> bouton
  const STATE_TXT = { sending: 'Envoi…', waiting: 'En attente', accepted: 'Envoyé', declined: 'Refusé', expired: 'Sans réponse', error: 'Hors de portée', rate: 'Patiente un instant' };
  const hue = (s) => { let n = 0; for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % 360; return n; };
  const initials = (s) => s.replace(/\./g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

  function share(it) {
    if (!it || (it.kind === 'note' && !String(it.text || '').trim()) || (it.kind === 'pos' && typeof it.x !== 'number')) return;
    item = it;
    Object.keys(states).forEach((k) => delete states[k]);
    const th = $('ad-thumb'); th.textContent = ''; th.className = 'ad-thumb ' + it.kind;
    th.append(icon(it.kind === 'note' ? 'ic-compose' : 'ic-pin'));
    const first = it.kind === 'note' ? (String(it.text).split('\n').map((l) => l.trim()).find(Boolean) || 'Note') : (it.label || 'Position');
    $('ad-title').textContent = first;
    $('ad-sub').textContent = it.kind === 'note' ? 'Note' : 'Position sur la carte';
    people = []; render();
    sheet.classList.remove('hidden'); void sheet.offsetWidth; sheet.classList.add('open');
    clearInterval(pollTimer); poll(); pollTimer = setInterval(poll, 2000);
  }
  function closeSheet() {
    if (!sheet.classList.contains('open')) return false;
    clearInterval(pollTimer); pollTimer = null;
    sheet.classList.remove('open');
    setTimeout(() => { if (!sheet.classList.contains('open')) sheet.classList.add('hidden'); }, 320);
    return true;
  }
  async function poll() {
    const r = await call('nearby');
    if (!pollTimer) return;
    if (r && r.err === 'rate') return;
    people = r && r.ok && Array.isArray(r.list) ? r.list : [];
    render();
  }
  // mise a jour sur place (pas de clignotement toutes les 2 s) ; ceux a qui on a envoye restent affiches
  function render() {
    const shown = people.slice();
    Object.keys(states).forEach((k) => {
      const id = Number(k);
      if (!shown.some((p) => p.id === id) && nodes[id]) shown.push({ id, name: nodes[id].dataset.name, dist: null });
    });
    const keep = {};
    shown.forEach((p, i) => {
      keep[p.id] = true;
      let b = nodes[p.id];
      if (!b) {
        b = h('button', 'ad-p'); b.dataset.name = p.name;
        const av = h('span', 'ad-av'); av.style.setProperty('--h', hue(p.name));
        av.append(h('b', null, initials(p.name)));
        const ring = document.createElementNS(NS, 'svg'); ring.setAttribute('class', 'ad-ring'); ring.setAttribute('viewBox', '0 0 64 64');
        const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', '32'); c.setAttribute('cy', '32'); c.setAttribute('r', '30'); ring.append(c);
        av.append(ring);
        b.append(av, h('span', 'ad-n', p.name), h('small', 'ad-s'));
        b.onclick = () => send(p.id);
        nodes[p.id] = b;
      }
      const st = states[p.id];
      b.className = 'ad-p' + (st ? ' ' + st : '');
      b.querySelector('.ad-s').textContent = st ? STATE_TXT[st] : p.dist != null ? p.dist + ' m' : '';
      if (box.children[i] !== b) box.insertBefore(b, box.children[i] || null);
    });
    Object.keys(nodes).forEach((k) => { if (!keep[k]) { nodes[k].remove(); delete nodes[k]; } });
    $('ad-empty').classList.toggle('hidden', !!shown.length);
    box.classList.toggle('hidden', !shown.length);
  }
  async function send(target) {
    const st = states[target];
    if (!item || st === 'sending' || st === 'waiting') return;
    states[target] = 'sending'; render();
    const r = await call('send', target, item);
    if (r && r.ok) { states[target] = 'waiting'; sent[r.id] = target; }
    else states[target] = r && r.err === 'rate' ? 'rate' : 'error';
    render();
    if (states[target] === 'rate') setTimeout(() => { if (states[target] === 'rate') { delete states[target]; render(); } }, 2500);
  }
  // reponse du destinataire (message de client/airdrop.lua)
  function result(res) {
    const target = sent[res.id];
    if (target == null) return;
    delete sent[res.id];
    states[target] = res.state;
    if (sheet.classList.contains('open')) render();
    else if (window.RZIsland && res.state === 'accepted') RZIsland.activity('check', 'Partagé avec ' + (res.to || 'la tablette'), 'ok', 2200);
    else if (window.RZIsland) RZIsland.activity('airdrop', res.state === 'declined' ? (res.to || 'La personne') + ' a refusé' : 'AirDrop sans réponse', 'warn', 2200);
  }
  $('ad-x').onclick = closeSheet;
  sheet.querySelector('.ad-scrim').onclick = closeSheet;

  /* ---------- Reception ---------- */
  let queue = [], showing = null, tick = null;
  const alive = (r) => Date.now() - r.t < (r.expire || 60) * 1000;
  const canShow = () => RZ() && RZ().isOpen() && !(window.RZLock && RZLock.visible());
  function incoming(req) {
    if (!req || req.id == null) return;
    req.t = Date.now();
    queue.push(req);
    check();
  }
  function check() {
    if (showing && (!alive(showing) || !canShow())) {
      const s = showing; hideModal();
      if (alive(s)) queue.unshift(s);                    // tablette rangee ou verrouillee : la demande attend
    }
    queue = queue.filter(alive);
    if (!showing && queue.length && canShow()) showModal(queue.shift());
    const need = !!showing || queue.length > 0;
    if (need && !tick) tick = setInterval(check, 600);
    if (!need && tick) { clearInterval(tick); tick = null; }
  }
  function showModal(req) {
    showing = req;
    $('ad-in-msg').textContent = req.from + ' souhaite te partager ' + (KIND[req.kind] || 'un élément') + '.';
    const pv = $('ad-in-prev'); pv.textContent = ''; pv.className = 'ad-in-prev ' + req.kind;
    const ic = h('span', 'ad-thumb ' + req.kind); ic.append(icon(req.kind === 'note' ? 'ic-compose' : 'ic-pin'));
    pv.append(ic, h('span', null, req.preview || (req.kind === 'note' ? 'Note' : 'Position')));
    $('ad-accept').disabled = $('ad-decline').disabled = false;
    modal.classList.remove('hidden'); void modal.offsetWidth; modal.classList.add('open');
  }
  function hideModal() {
    showing = null;
    modal.classList.remove('open');
    setTimeout(() => { if (!modal.classList.contains('open')) modal.classList.add('hidden'); }, 260);
  }
  async function answer(ok) {
    const req = showing; if (!req) return;
    $('ad-accept').disabled = $('ad-decline').disabled = true;
    const r = await call('answer', req.id, ok);
    hideModal();
    if (ok) {
      if (r && r.ok && r.payload) deliver(r.payload, r.from || req.from);
      else if (window.RZIsland) RZIsland.activity('airdrop', 'Demande expirée', 'warn', 2200);
    }
    check();
  }
  function deliver(p, from) {
    if (p.kind === 'note' && window.RZNotes) RZNotes.receive(p.text);
    else if (p.kind === 'pos' && window.RZMap) RZMap.show({ x: p.x, y: p.y, label: p.label || 'Position de ' + from });
    if (window.RZIsland) RZIsland.activity('check', 'Reçu de ' + from, 'ok', 2000);
  }
  function cancel(id) {
    queue = queue.filter((r) => r.id !== id);
    if (showing && showing.id === id) hideModal();
    check();
  }
  $('ad-accept').onclick = () => answer(true);
  $('ad-decline').onclick = () => answer(false);

  window.addEventListener('message', (e) => {
    const d = e.data || {};
    if (d.action === 'airdrop') incoming(d.req);
    else if (d.action === 'airdropResult' && d.res) result(d.res);
    else if (d.action === 'airdropCancel') cancel(d.id);
    else if (d.action === 'open') setTimeout(check, 400);
    else if (d.action === 'close') { closeSheet(); check(); }
  });
  // Echap ferme la feuille de partage avant la tablette
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet.classList.contains('open')) { closeSheet(); e.preventDefault(); e.stopPropagation(); }
  }, true);

  window.RZDrop = {
    share, close: closeSheet, check,
    demo(kind) {
      const id = Date.now();
      demoPay[id] = kind === 'pos' ? { kind: 'pos', x: 425, y: -979, label: 'Commissariat' } : { kind: 'note', text: 'Rendez-vous\nDevant le Bean Machine à 21 h' };
      incoming({ id, from: 'Jean D.', kind: demoPay[id].kind, preview: kind === 'pos' ? 'Commissariat' : 'Rendez-vous', expire: 60 });
    },
  };
})();
