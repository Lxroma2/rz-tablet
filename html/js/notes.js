/* Application Notes : liste + editeur, enregistrement automatique pendant la frappe.
   Les notes sont gardees par le serveur avec le numero de serie de la tablette (server/notes.lua).
   La premiere ligne d'une note sert de titre, comme sur iOS. Une note videe est supprimee.
   Hors du jeu (banc d'essai) : notes de demo dans le stockage local. */
(() => {
  const $ = (id) => document.getElementById(id);
  const RZ = () => window.RZ;
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const stack = $('no-stack'), list = $('no-list'), text = $('no-text'), search = $('no-search');

  let notes = [];           // { id, body, updated }
  let cur = null;           // note ouverte : { id|null, body, updated }
  let saveTimer = null;
  let chain = Promise.resolve();   // les enregistrements partent un par un (l'id d'une nouvelle note arrive au premier)
  let errMsg = '';

  /* ---------- Serveur (demo locale hors du jeu) ---------- */
  const DEV = 'rztab_devnotes';
  const devGet = () => { try { const v = JSON.parse(localStorage.getItem(DEV)); if (Array.isArray(v)) return v; } catch (e) {} return null; };
  const devSet = (v) => { try { localStorage.setItem(DEV, JSON.stringify(v)); } catch (e) {} };
  function devNotes() {
    let v = devGet();
    if (!v) {
      const t = Math.floor(Date.now() / 1000);
      v = [
        { id: 2, body: 'Courses\nPain, lait, essence pour la Sultan\nPasser chez Benny\'s avant 20 h', updated: t - 3600 },
        { id: 1, body: 'Plaques à surveiller\n46EEK572\n12ABC345 (Baller noire)', updated: t - 86400 * 2 },
      ];
      devSet(v);
    }
    return v;
  }
  function call(act, payload) {
    if (RZ() && RZ().isFiveM) return RZ().postJson('notes', { act, payload });
    const v = devNotes(), t = Math.floor(Date.now() / 1000);
    if (act === 'list') return Promise.resolve({ ok: true, notes: v.slice().sort((a, b) => b.updated - a.updated) });
    if (act === 'save') {
      let n = payload.id && v.find((x) => x.id === payload.id);
      if (n) { n.body = payload.body; n.updated = t; } else { n = { id: Math.max(0, ...v.map((x) => x.id)) + 1, body: payload.body, updated: t }; v.push(n); }
      devSet(v); return Promise.resolve({ ok: true, id: n.id, updated: t });
    }
    if (act === 'delete') { devSet(v.filter((x) => x.id !== payload.id)); return Promise.resolve({ ok: true }); }
    return Promise.resolve({ ok: false });
  }
  const ERRS = {
    tablet: 'Notes indisponibles : sors la tablette depuis ton inventaire.',
    locked: 'Déverrouille la tablette pour voir ses notes.',
    full: 'Cette tablette est pleine : supprime une note pour en écrire une autre.',
    long: 'Note trop longue.',
  };

  /* ---------- Mise en forme ---------- */
  const title = (body) => { const l = (body || '').split('\n').map((x) => x.trim()).find(Boolean); return l || 'Nouvelle note'; };
  const preview = (body) => { const ls = (body || '').split('\n').map((x) => x.trim()).filter(Boolean); return ls[1] || 'Aucun texte supplémentaire'; };
  function when(ts, long) {
    const d = new Date(ts * 1000), n = new Date();
    const y = new Date(n); y.setDate(n.getDate() - 1);
    const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === n.toDateString()) return long ? "Aujourd'hui à " + hm : hm;
    if (d.toDateString() === y.toDateString()) return long ? 'Hier à ' + hm : 'Hier';
    const date = d.toLocaleDateString('fr-FR', long ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: '2-digit', month: '2-digit', year: '2-digit' });
    return long ? date + ' à ' + hm : date;
  }

  /* ---------- Liste ---------- */
  function render() {
    const q = search.value.trim().toLowerCase();
    const shown = q ? notes.filter((n) => n.body.toLowerCase().includes(q)) : notes;
    list.textContent = '';
    shown.forEach((n) => {
      const b = h('button', 'st-row no-item');
      const tx = h('span', 'grow');
      tx.append(h('b', null, title(n.body)));
      const sub = h('small');
      sub.append(h('time', null, when(n.updated)), document.createTextNode(preview(n.body)));
      tx.append(sub);
      b.append(tx);
      b.onclick = () => openNote(n);
      list.append(b);
    });
    list.classList.toggle('hidden', !shown.length);
    const empty = $('no-empty');
    empty.textContent = errMsg || (q ? 'Aucun résultat' : 'Aucune note');
    empty.classList.toggle('hidden', !!shown.length && !errMsg);
    $('no-count').textContent = notes.length ? notes.length + ' note' + (notes.length > 1 ? 's' : '') : '';
    $('no-new').disabled = errMsg === ERRS.tablet || errMsg === ERRS.locked;
  }
  async function load() {
    const r = await call('list');
    if (r && r.ok) { notes = r.notes || []; errMsg = ''; } else { notes = []; errMsg = ERRS[r && r.err] || 'Notes indisponibles pour le moment.'; }
    render();
  }
  search.addEventListener('input', render);

  /* ---------- Editeur ---------- */
  function openNote(n) {
    cur = n ? { id: n.id, body: n.body, saved: n.body, updated: n.updated } : { id: null, body: '', saved: '', updated: Math.floor(Date.now() / 1000) };
    text.value = cur.body;
    $('no-date').textContent = n ? when(cur.updated, true) : '';
    $('no-msg').textContent = '';
    $('no-edit').classList.add('open'); stack.classList.add('pushed');
    if (!n) setTimeout(() => text.focus(), 360);   // nouvelle note : on ecrit tout de suite
    else text.scrollTop = 0;
  }
  // envoie la note c telle qu'elle est (c.body) si elle a change depuis le dernier envoi
  async function persist(c) {
    const b = c.body;
    if (b === c.saved && c.id) return;
    if (!b.trim()) {                                     // note videe : on la retire
      if (c.id) { await call('delete', { id: c.id }); notes = notes.filter((x) => x.id !== c.id); c.id = null; }
      c.saved = b;
      return;
    }
    const r = await call('save', { id: c.id, body: b });
    if (r && r.ok) {
      c.id = r.id; c.updated = r.updated; c.saved = b;
      notes = notes.filter((x) => x.id !== r.id);
      notes.unshift({ id: r.id, body: b, updated: r.updated });
      if (cur === c) { $('no-date').textContent = when(r.updated, true); $('no-msg').textContent = ''; }
    } else if (r && r.err === 'rate') {
      setTimeout(() => queue(c), 400);
    } else if (cur === c) {
      $('no-msg').textContent = ERRS[r && r.err] || 'Note non enregistrée.';
    }
  }
  const queue = (c) => (chain = chain.then(() => persist(c)));
  text.addEventListener('input', () => {
    if (!cur) return;
    cur.body = text.value;
    clearTimeout(saveTimer);
    const c = cur;
    saveTimer = setTimeout(() => queue(c), 700);
  });
  async function closeNote() {
    if (!cur) return false;
    const c = cur; c.body = text.value; cur = null;
    clearTimeout(saveTimer);
    if (document.activeElement === text) text.blur();
    $('no-edit').classList.remove('open'); stack.classList.remove('pushed');
    await queue(c);
    render();
    return true;
  }
  $('no-back').onclick = () => closeNote();
  $('no-new').onclick = () => openNote(null);
  $('no-done').onclick = () => text.blur();
  $('no-share').onclick = () => {
    if (!cur || !text.value.trim() || !window.RZDrop) return;
    if (document.activeElement === text) text.blur();
    RZDrop.share({ kind: 'note', text: text.value });
  };

  // note recue par AirDrop : enregistree dans cette tablette puis ouverte
  async function receive(body) {
    if (!RZ() || typeof body !== 'string' || !body.trim()) return;
    RZ().showView('notes');
    const r = await call('save', { id: null, body });
    if (r && r.ok) {
      await load();
      openNote(notes.find((x) => x.id === r.id) || { id: r.id, body, updated: r.updated });
    } else {
      errMsg = ERRS[r && r.err] || 'Note reçue mais non enregistrée.';
      render();
    }
  }
  // widget et recherche : la liste, ouvrir une note, en ecrire une
  function openFromOutside(fn) {
    if (RZ().currentView() !== 'notes') RZ().showView('notes');
    return load().then(fn);
  }
  window.RZNotes = {
    receive,
    list: () => call('list'),
    open: (id) => openFromOutside(() => { const n = notes.find((x) => x.id === id); if (n) openNote(n); }),
    create: () => openFromOutside(() => { if (!errMsg) openNote(null); }),
  };
  text.addEventListener('focus', () => $('no-edit').classList.add('typing'));
  text.addEventListener('blur', () => $('no-edit').classList.remove('typing'));

  // suppression en deux temps : le bouton devient rouge, un second clic confirme
  let delArmed = null;
  $('no-del').onclick = async () => {
    if (!cur) return;
    const b = $('no-del');
    if (!delArmed) { b.classList.add('armed'); b.title = 'Cliquer encore pour supprimer'; delArmed = setTimeout(() => { delArmed = null; b.classList.remove('armed'); }, 3000); return; }
    clearTimeout(delArmed); delArmed = null; b.classList.remove('armed');
    clearTimeout(saveTimer);
    const c = cur; cur = null;
    if (document.activeElement === text) text.blur();
    $('no-edit').classList.remove('open'); stack.classList.remove('pushed');
    await chain;
    if (c.id) { await call('delete', { id: c.id }); notes = notes.filter((x) => x.id !== c.id); }
    render();
  };

  function reset() {
    stack.classList.add('instant');
    stack.classList.remove('pushed'); $('no-edit').classList.remove('open', 'typing');
    void stack.offsetWidth; stack.classList.remove('instant');
  }

  if (RZ() && RZ().registerView) {
    RZ().registerView('notes', {
      enter() { search.value = ''; reset(); load(); },
      leave() { if (cur) { closeNote(); } reset(); },
      back() { if (cur) { closeNote(); return true; } return false; },
    });
  }
})();
