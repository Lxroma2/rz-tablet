/* App "App" : la boutique de la tablette. Installer / ouvrir / supprimer des apps.
   Le catalogue vient de home.js (apps integrees + apps web du serveur). */
(() => {
  const $ = (id) => document.getElementById(id);
  const RZ = () => window.RZ;
  const H = () => window.RZHome;
  const stack = $('as-stack');
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  let detailId = null;
  const installing = {};      // id -> true pendant l'animation d'installation

  /* ---------- Bouton Obtenir / Ouvrir (avec anneau de progression) ---------- */
  function actionBtn(a, big) {
    const b = h('button', 'as-get' + (big ? ' big' : ''));
    const paint = () => {
      b.textContent = '';
      b.classList.remove('loading');
      if (installing[a.id]) {
        b.classList.add('loading');
        b.setAttribute('aria-label', 'Installation');
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        ring.setAttribute('viewBox', '0 0 32 32'); ring.setAttribute('class', 'as-ring');
        ring.innerHTML = '<circle cx="16" cy="16" r="13" class="bg"/><circle cx="16" cy="16" r="13" class="fg"/><rect x="12.5" y="12.5" width="7" height="7" rx="1.5"/>';
        b.append(ring);
        return;
      }
      b.removeAttribute('aria-label');
      b.textContent = H().isInstalled(a.id) ? 'Ouvrir' : 'Obtenir';
    };
    paint();
    b.onclick = (e) => {
      e.stopPropagation();
      if (installing[a.id]) return;
      if (H().isInstalled(a.id)) { H().open(a.id); return; }
      installing[a.id] = true;
      refresh();
      setTimeout(() => {
        delete installing[a.id];
        H().install(a.id);
        refresh();
      }, 1100);
    };
    return b;
  }

  function refresh() {
    renderList();
    if (detailId) renderDetail(detailId);
  }

  /* ---------- Accueil de la boutique ---------- */
  function renderList() {
    const all = H().catalog();
    const d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    $('as-date').textContent = d;

    // a la une : la premiere app pas encore installee, sinon Services
    const feat = all.find((a) => !H().isInstalled(a.id)) || H().byId('services');
    const hero = $('as-hero'); hero.textContent = '';
    if (feat) {
      hero.className = 'as-hero' + (feat.web ? '' : ' hero-' + feat.id);
      if (feat.web) hero.style.setProperty('--hero', feat.color); else hero.style.removeProperty('--hero');
      const top = h('div', 'as-hero-top');
      top.append(h('span', 'as-kicker', H().isInstalled(feat.id) ? 'À découvrir' : 'À la une'), h('b', null, feat.label), h('span', null, feat.subtitle));
      const bar = h('div', 'as-hero-bar');
      const meta = h('span', 'as-hero-meta');
      meta.append(H().iconEl(feat.id), h('span', null, feat.category));
      bar.append(meta, actionBtn(feat));
      hero.append(top, bar);
      hero.onclick = () => openDetail(feat.id);
    }

    const box = $('as-list'); box.textContent = '';
    all.forEach((a) => {
      const row = h('div', 'as-row');
      row.tabIndex = 0;
      const tx = h('span', 'as-tx');
      tx.append(h('b', null, a.label), h('span', null, a.subtitle || a.category));
      row.append(H().iconEl(a.id), tx, actionBtn(a));
      row.onclick = () => openDetail(a.id);
      row.onkeydown = (e) => { if (e.key === 'Enter') openDetail(a.id); };
      box.append(row);
    });
  }

  /* ---------- Fiche d'une app ---------- */
  function renderDetail(id) {
    const a = H().byId(id); if (!a) return;
    $('as-d-title').textContent = a.label;
    const body = $('as-d-body'); body.textContent = '';

    const head = h('div', 'as-d-head');
    const tx = h('div', 'as-d-tx');
    tx.append(h('h2', null, a.label), h('span', null, a.subtitle));
    const acts = h('div', 'as-d-acts');
    acts.append(actionBtn(a, true));
    if (!a.system && H().isInstalled(a.id) && !installing[a.id]) {
      const del = h('button', 'as-del', 'Supprimer');
      let armed = false;
      del.onclick = () => {
        if (!armed) { armed = true; del.textContent = 'Confirmer la suppression'; setTimeout(() => { armed = false; del.textContent = 'Supprimer'; }, 3500); return; }
        H().uninstall(a.id);
        refresh();
      };
      acts.append(del);
    }
    tx.append(acts);
    head.append(H().iconEl(a.id), tx);

    const info = h('div', 'as-info');
    [
      ['Catégorie', a.category],
      ['Type', a.system ? 'App système' : a.web ? 'App web' : 'Intégrée'],
      ['Source', a.web ? (() => { try { return new URL(a.url).hostname.replace(/^www\./, ''); } catch (e) { return a.url; } })() : 'Tablette'],
    ].forEach(([k, v]) => { const c = h('div', 'as-info-c'); c.append(h('span', null, k), h('b', null, v)); info.append(c); });

    const desc = h('p', 'as-desc', a.description || a.subtitle || '');
    body.append(head, info, desc);
    if (a.system) body.append(h('div', 'st-foot', 'Cette app fait partie de la tablette et ne peut pas être supprimée.'));
  }

  /* ---------- Navigation en pile ---------- */
  function openDetail(id) {
    detailId = id;
    renderDetail(id);
    const p = $('as-detail'); p.scrollTop = 0; p.classList.add('open');
    stack.classList.add('pushed');
  }
  function back() {
    if (!detailId) return false;
    detailId = null;
    $('as-detail').classList.remove('open');
    stack.classList.remove('pushed');
    return true;
  }
  function reset() {
    detailId = null;
    stack.classList.add('instant');
    stack.classList.remove('pushed');
    $('as-detail').classList.remove('open');
    void stack.offsetWidth;
    stack.classList.remove('instant');
  }
  document.querySelectorAll('[data-asback]').forEach((b) => { b.onclick = () => back(); });

  window.RZStore = {
    enter() { reset(); renderList(); $('as-root').scrollTop = 0; },
    leave() { reset(); },
    back,
  };
})();
