/* Application Banque : solde du compte et historique des entrees / sorties (aucun virement).
   L'historique vient de server/bank.lua (mouvements notes depuis l'installation).
   Hors du jeu (banc d'essai) : compte de demonstration. */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const RZ = () => window.RZ;
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const icon = (id, cls) => {
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
    const u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#' + id); s.appendChild(u); return s;
  };

  let info = { name: 'Banque', currency: '$', owner: '', balance: 0, income: 0, spent: 0 };
  let entries = [], more = false, filter = 'all', loaded = false, err = '';
  let timer = null, seq = 0, loadingMore = false;

  /* ---------- Serveur (demo hors du jeu) ---------- */
  function demo(before) {
    const t = Math.floor(Date.now() / 1000), H = 3600, D = 86400;
    const all = [
      { id: 12, amount: 2500, reason: 'Paycheck', ts: t - 2 * H },
      { id: 11, amount: -340, reason: 'Garage Benny', ts: t - 5 * H },
      { id: 10, amount: -45, reason: 'unknown', ts: t - 7 * H },
      { id: 9, amount: 1200, reason: 'Vente véhicule', ts: t - D - 3 * H },
      { id: 8, amount: -1800, reason: 'Loyer', ts: t - D - 6 * H },
      { id: 7, amount: 2500, reason: 'Paycheck', ts: t - 2 * D },
      { id: 6, amount: -120, reason: 'Amende', ts: t - 3 * D },
      { id: 5, amount: 500, reason: 'Government Grant', ts: t - 9 * D },
    ];
    let bal = 18450;
    all.forEach((e) => { e.balance = bal; bal -= e.amount; });
    const list = before ? all.filter((e) => e.id < before) : all;
    const week = all.filter((e) => e.ts >= t - 7 * D);
    return { ok: true, name: 'Banque', currency: '$', owner: 'Alex Martin', balance: 18450, entries: list, more: false,
      income: week.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0), spent: week.filter((e) => e.amount < 0).reduce((s, e) => s - e.amount, 0) };
  }
  const call = (before) => (RZ() && RZ().isFiveM ? RZ().postJson('bank', { before }) : Promise.resolve(demo(before)));

  /* ---------- Mise en forme ---------- */
  const money = (n, sign) => {
    const v = Math.abs(Math.round(Number(n) || 0)).toLocaleString('fr-FR');
    return (sign ? (n > 0 ? '+' : n < 0 ? '-' : '') : (n < 0 ? '-' : '')) + v + ' ' + info.currency;
  };
  // motifs d'ESX (en anglais) et motif vide
  const REASONS = {
    paycheck: 'Salaire', 'welfare check': 'Aide sociale', 'government grant': "Versement de l'État", 'government tax': "Prélèvement de l'État",
    'picked up': 'Ramassé', 'threw away': 'Jeté',
  };
  function reason(e) {
    const r = String(e.reason || '').trim();
    const k = r.toLowerCase();
    if (!r || k === 'unknown') return e.amount > 0 ? 'Virement reçu' : 'Paiement';
    if (REASONS[k]) return REASONS[k];
    let m = r.match(/^received from (.+)$/i); if (m) return 'Reçu de ' + m[1];
    m = r.match(/^gave to (.+)$/i); if (m) return 'Donné à ' + m[1];
    return r;
  }
  function dayLabel(ts) {
    const d = new Date(ts * 1000), n = new Date(), y = new Date(); y.setDate(n.getDate() - 1);
    if (d.toDateString() === n.toDateString()) return "Aujourd'hui";
    if (d.toDateString() === y.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  const hm = (ts) => new Date(ts * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  /* ---------- Affichage ---------- */
  function renderHead() {
    $('bk-bal').textContent = loaded ? money(info.balance) : '…';
    $('bk-owner').textContent = info.owner || '';
    $('bk-brand').textContent = info.name || 'Banque';
    $('bk-in').textContent = money(info.income, true);
    $('bk-out').textContent = money(-info.spent, true);
  }
  function row(e) {
    const r = h('div', 'st-row bk-row');
    const ic = h('span', 'bk-ic ' + (e.amount > 0 ? 'in' : 'out')); ic.append(icon(e.amount > 0 ? 'ic-arrow-in' : 'ic-arrow-out'));
    const tx = h('span', 'grow'); tx.append(h('b', null, reason(e)), h('small', null, hm(e.ts)));
    const am = h('span', 'bk-amt' + (e.amount > 0 ? ' in' : ''), money(e.amount, true));
    r.append(ic, tx, am);
    return r;
  }
  function renderList() {
    const box = $('bk-list'); box.textContent = '';
    const shown = entries.filter((e) => filter === 'all' || (filter === 'in' ? e.amount > 0 : e.amount < 0));
    let day = null, group = null;
    shown.forEach((e) => {
      const l = dayLabel(e.ts);
      if (l !== day) {
        day = l;
        const sec = h('div', 'st-sec');
        group = h('div', 'st-group');
        sec.append(h('div', 'st-label', l), group);
        box.append(sec);
      }
      group.append(row(e));
    });
    $('bk-more').classList.toggle('hidden', !more);
    const empty = $('bk-empty');
    empty.textContent = err || (!entries.length ? "Aucune opération pour l'instant. Les entrées et sorties s'afficheront ici." : filter === 'in' ? 'Aucune entrée.' : 'Aucune sortie.');
    empty.classList.toggle('hidden', !loaded || (!!shown.length && !err));
  }

  async function load() {
    const s = ++seq;
    const r = await call(null);
    if (s !== seq) return;
    if (!r || !r.ok) {
      if (r && r.err === 'rate') return;
      if (!loaded) { err = 'Impossible de charger le compte.'; loaded = true; renderHead(); renderList(); }
      return;
    }
    err = ''; loaded = true;
    info = { name: r.name || info.name, currency: r.currency || info.currency, owner: r.owner || '', balance: r.balance || 0, income: r.income || 0, spent: r.spent || 0 };
    entries = Array.isArray(r.entries) ? r.entries : [];
    more = !!r.more;
    renderHead(); renderList();
  }
  $('bk-more').onclick = async () => {
    if (loadingMore || !entries.length) return;
    loadingMore = true;
    const r = await call(entries[entries.length - 1].id);
    loadingMore = false;
    if (!r || !r.ok) return;
    const ids = new Set(entries.map((e) => e.id));
    entries = entries.concat((Array.isArray(r.entries) ? r.entries : []).filter((e) => !ids.has(e.id)));
    more = !!r.more;
    renderList();
  };
  $('bk-filter').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-f]');
    if (!b || b.dataset.f === filter) return;
    filter = b.dataset.f;
    $('bk-filter').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    renderList();
  });

  // solde change pendant que l'app est ouverte (message de client/bank.lua)
  window.addEventListener('message', (e) => {
    if (e.data && e.data.action === 'bankChanged' && timer) load();
  });

  function enter() {
    $('bk-scroll').scrollTop = 0;
    renderHead(); renderList(); load();
    clearInterval(timer); timer = setInterval(load, 15000);
  }
  function leave() { clearInterval(timer); timer = null; }
  window.RZBank = { summary: () => call(null) };   // widget de l'accueil
  if (RZ() && RZ().registerView) RZ().registerView('bank', { enter, leave });
})();
