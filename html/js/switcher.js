/* Selecteur d'apps (multitache) facon iPadOS.
   - Barre du bas : glisser vers le haut et marquer une pause (ou appui long) = apps recentes ;
     glisser vers le haut d'un coup = accueil ; glisser a gauche ou a droite = app precedente.
   - Une carte par app ouverte recemment, avec un instantane de l'ecran pris quand on l'a quittee.
     Clic = on y retourne ; glisser la carte vers le haut = on la ferme (une app web perd son onglet).
   core.js appelle RZSwitch.snap(cle) avant de quitter une vue et RZSwitch.visited(cle) apres. */
(() => {
  const $ = (id) => document.getElementById(id);
  const RZ = () => window.RZ;
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const sw = $('asw'), row = $('asw-row'), screen = document.querySelector('.screen');
  const MAX = 9;
  let recents = [];          // [{ key, snap }] du plus recent au plus ancien ; cle = vue ou 'app:<id>'
  let isOpen = false;

  const parse = (key) => (key.startsWith('app:') ? { app: key.slice(4), view: 'browser' } : { view: key });
  const curKey = () => { if (!RZ()) return 'home'; const a = RZ().appMode && RZ().appMode(); return a ? 'app:' + a : RZ().currentView(); };
  function meta(key) {
    const k = parse(key), a = window.RZHome && RZHome.byId(k.app || k.view);
    return { id: k.app || k.view, label: a ? a.label : k.view === 'browser' ? 'Navigateur' : k.view };
  }

  /* ---------- Instantanes ---------- */
  // copie figee de la vue : iframes remplacees, valeurs des champs et defilements recopies
  function makeSnap(key) {
    const k = parse(key);
    if (k.view === 'browser') return null;              // page dessinee par le jeu (DUI) ou iframe : carte simplifiee
    const v = $(k.view);
    if (!v) return null;
    const r = v.getBoundingClientRect();
    if (r.width < 50 || r.height < 50) return null;
    const node = v.cloneNode(true);
    node.classList.add('asw-snap', 'active');
    node.classList.remove('launch');
    node.querySelectorAll('iframe, video, audio').forEach((x) => x.replaceWith(h('div', 'asw-hole')));
    const src = v.querySelectorAll('input, textarea, select'), dst = node.querySelectorAll('input, textarea, select');
    dst.forEach((x, i) => { const o = src[i]; if (!o) return; if (x.type === 'checkbox' || x.type === 'radio') x.checked = o.checked; else x.value = o.value; x.tabIndex = -1; });
    const scrolls = [];
    v.querySelectorAll('*').forEach((x, i) => { if (x.scrollTop || x.scrollLeft) scrolls.push([i, x.scrollTop, x.scrollLeft]); });
    node.setAttribute('aria-hidden', 'true');
    node.inert = true;
    return { node, w: r.width, h: r.height, scrolls };
  }
  function snap(key) {
    if (!key || key === 'home') return;
    const it = recents.find((x) => x.key === key);
    if (it) it.snap = makeSnap(key) || it.snap;
  }
  function visited(key) {
    if (!key || key === 'home') return;
    const it = recents.find((x) => x.key === key) || { key, snap: null };
    recents = [it].concat(recents.filter((x) => x !== it)).slice(0, MAX);
  }
  function forget(key) { recents = recents.filter((x) => x.key !== key); }

  /* ---------- Cartes ---------- */
  function cardSize() {
    const s = screen.getBoundingClientRect();
    const vw = s.width, vh = Math.max(200, s.height - 46 - 40);   // zone des vues (sans barre d'etat ni barre du bas)
    const w = Math.round(Math.min(340, Math.max(180, vw * 0.34)));
    return { w, h: Math.round(w * vh / vw), vw, vh };
  }
  function synth(key) {
    const k = parse(key), box = h('div', 'asw-synth' + (k.app ? ' app' : ''));
    if (window.RZHome) box.append(RZHome.iconEl(k.app || 'browser'));
    if (!k.app) {
      const t = RZ() && RZ().tabTitle ? RZ().tabTitle() : '';
      box.append(h('span', null, t || 'Navigateur'));
    }
    return box;
  }
  function card(it, size) {
    const m = meta(it.key);
    const c = h('div', 'asw-card');
    c.dataset.key = it.key;
    const head = h('div', 'asw-head');
    if (window.RZHome) { const ic = RZHome.iconEl(m.id); ic.classList.add('ic-sm'); head.append(ic); }
    head.append(h('span', null, m.label));
    const fr = h('div', 'asw-frame');
    fr.style.width = size.w + 'px'; fr.style.height = size.h + 'px';
    const sn = it.snap;
    if (sn && sn.node) {
      const inner = h('div', 'asw-inner');
      inner.style.width = sn.w + 'px'; inner.style.height = sn.h + 'px';
      inner.style.transform = 'scale(' + (size.w / sn.w) + ')';
      inner.append(sn.node);
      fr.append(inner);
      fr.style.height = Math.round(size.w * sn.h / sn.w) + 'px';
    } else fr.append(synth(it.key));
    fr.style.setProperty('--wall', screen.style.background || '#000');
    c.append(head, fr);
    return c;
  }
  function render() {
    row.textContent = '';
    const size = cardSize();
    recents.forEach((it) => row.append(card(it, size)));
    // defilements recopies une fois les copies dans la page
    recents.forEach((it) => {
      const sn = it.snap; if (!sn || !sn.node || !sn.scrolls.length) return;
      const all = sn.node.querySelectorAll('*');
      sn.scrolls.forEach(([i, t, l]) => { if (all[i]) { all[i].scrollTop = t; all[i].scrollLeft = l; } });
    });
    $('asw-empty').classList.toggle('hidden', recents.length > 0);
    $('asw-hint').classList.toggle('hidden', recents.length === 0);
  }

  /* ---------- Ouvrir / fermer ---------- */
  function open() {
    if (isOpen || !RZ() || !RZ().isOpen()) return false;
    if (window.RZLock && RZLock.visible()) return false;
    if (window.RZCC) RZCC.close();
    if (window.RZSearch) RZSearch.close(true);
    if (window.RZNotif) RZNotif.closeCenter();
    if (window.RZHome) RZHome.stopEdit();
    snap(curKey());
    isOpen = true;
    if (RZ().suspendDui) RZ().suspendDui(true);
    sw.style.setProperty('--wall', screen.style.background || '#000');
    render();
    row.scrollLeft = 0;
    sw.classList.remove('hidden'); void sw.offsetWidth; sw.classList.add('open');
    return true;
  }
  function close(instant) {
    if (!isOpen) return false;
    isOpen = false;
    sw.classList.remove('open');
    const done = () => { if (!isOpen) { sw.classList.add('hidden'); row.textContent = ''; } };
    if (instant) done(); else setTimeout(done, 260);
    if (RZ() && RZ().suspendDui) RZ().suspendDui(false);
    // l'app affichee a ete fermee depuis le selecteur : retour a l'accueil
    const cur = curKey();
    if (cur !== 'home' && !recents.some((x) => x.key === cur) && RZ()) RZ().showView('home');
    return true;
  }
  function go(key, from) {
    const k = parse(key);
    close(true);
    if (key === curKey()) return;
    if (k.app) { const a = window.RZHome && RZHome.byId(k.app); if (a) RZ().openApp(a); else RZ().showView('home'); }
    else RZ().showView(k.view);
    if (from) {
      const v = document.querySelector('.view.active');
      if (v) v.animate([{ transform: 'translateX(' + from * 44 + 'px)', opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    }
  }
  function kill(key) {
    const k = parse(key);
    forget(key);
    if (k.app && RZ() && RZ().closeApp) RZ().closeApp(k.app);
    if (!recents.length) { $('asw-empty').classList.remove('hidden'); $('asw-hint').classList.add('hidden'); }
  }

  sw.addEventListener('click', (e) => { if (!e.target.closest('.asw-card')) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) { close(); e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  window.addEventListener('message', (e) => { if (e.data && e.data.action === 'close' && isOpen) close(true); });
  // molette : defilement horizontal de la rangee
  row.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { row.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });

  /* ---------- Gestes sur une carte : clic, glisser haut = fermer, glisser cote = defiler ---------- */
  let cg = null;
  row.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const c = e.target.closest('.asw-card'); if (!c) return;
    cg = { c, id: e.pointerId, x: e.clientX, y: e.clientY, sl: row.scrollLeft, mode: null, t: performance.now(), py: e.clientY, pt: performance.now(), vy: 0 };
    try { c.setPointerCapture(e.pointerId); } catch (err) { /* pointeur deja relache */ }
  });
  row.addEventListener('pointermove', (e) => {
    if (!cg || e.pointerId !== cg.id) return;
    const dx = e.clientX - cg.x, dy = e.clientY - cg.y;
    if (!cg.mode) {
      if (Math.hypot(dx, dy) < 7) return;
      cg.mode = Math.abs(dy) > Math.abs(dx) ? 'v' : 'h';
      if (cg.mode === 'v') cg.c.classList.add('dragging');
    }
    const now = performance.now();
    if (now - cg.pt > 0) { cg.vy = (e.clientY - cg.py) / (now - cg.pt); cg.py = e.clientY; cg.pt = now; }
    if (cg.mode === 'h') { row.scrollLeft = cg.sl - dx; return; }
    // vers le haut : suit le pointeur ; vers le bas : resistance
    const y = dy < 0 ? dy : dy * 0.25;
    cg.c.style.transform = 'translateY(' + y + 'px)';
    cg.c.style.opacity = String(Math.max(0.35, 1 + Math.min(0, dy) / 420));
  });
  const cardEnd = (e) => {
    if (!cg || e.pointerId !== cg.id) return;
    const g = cg; cg = null;
    const dy = e.clientY - g.y;
    if (!g.mode) { go(g.c.dataset.key); return; }
    if (g.mode !== 'v') return;
    g.c.classList.remove('dragging');
    if (dy < -110 || (dy < -30 && g.vy < -0.6)) {
      // la carte s'envole, les autres se resserrent
      g.c.style.transition = 'transform 260ms cubic-bezier(.4, 0, .9, .6), opacity 220ms ease';
      g.c.style.transform = 'translateY(-' + (g.c.offsetHeight + 160) + 'px)'; g.c.style.opacity = '0';
      const key = g.c.dataset.key;
      setTimeout(() => {
        const w = g.c.offsetWidth;
        g.c.style.transition = 'margin 240ms cubic-bezier(.2, .8, .2, 1), width 240ms cubic-bezier(.2, .8, .2, 1)';
        g.c.style.width = w + 'px'; void g.c.offsetWidth;
        g.c.style.width = '0px'; g.c.style.marginRight = '-28px';
        setTimeout(() => g.c.remove(), 250);
        kill(key);
      }, 230);
    } else {
      g.c.style.transition = 'transform 360ms cubic-bezier(.3, 1.25, .5, 1), opacity 200ms ease';
      g.c.style.transform = ''; g.c.style.opacity = '';
      setTimeout(() => { g.c.style.transition = ''; }, 360);
    }
  };
  row.addEventListener('pointerup', cardEnd);
  row.addEventListener('pointercancel', cardEnd);

  /* ---------- Barre du bas ---------- */
  const pill = $('n-home'), nav = document.querySelector('.navbar');
  let g = null, swallow = false;
  const activeView = () => document.querySelector('.view.active');
  function resetView(v, animate) {
    if (!v) return;
    v.style.transition = animate ? 'transform 320ms cubic-bezier(.3, 1.15, .5, 1), border-radius 320ms ease' : '';
    v.style.transform = ''; v.style.borderRadius = '';
    if (animate) setTimeout(() => { v.style.transition = ''; }, 330);
  }
  function endGesture() {
    if (!g) return null;
    clearTimeout(g.hold); clearTimeout(g.pause);
    const x = g; g = null;
    if (RZ() && RZ().suspendDui && !isOpen) RZ().suspendDui(false);
    return x;
  }
  pill.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || isOpen) return;
    const v = activeView();
    g = { id: e.pointerId, x: e.clientX, y: e.clientY, mode: null, v: v && v.id !== 'home' ? v : null, py: e.clientY, pt: performance.now(), vy: 0, hold: null, pause: null };
    try { pill.setPointerCapture(e.pointerId); } catch (err) { /* pointeur deja relache */ }
    // appui long sans bouger : apps recentes (pratique a la souris)
    g.hold = setTimeout(() => { if (g && !g.mode) { const x = endGesture(); swallow = true; resetView(x.v, false); open(); } }, 450);
  });
  pill.addEventListener('pointermove', (e) => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.mode) {
      if (Math.hypot(dx, dy) < 8) return;
      clearTimeout(g.hold);
      g.mode = -dy > Math.abs(dx) ? 'up' : Math.abs(dx) > Math.abs(dy) ? 'side' : 'none';
      if (g.mode !== 'none' && RZ() && RZ().suspendDui) RZ().suspendDui(true);
    }
    const now = performance.now();
    if (now - g.pt > 0) { g.vy = (e.clientY - g.py) / (now - g.pt); g.py = e.clientY; g.pt = now; }
    if (g.mode === 'up') {
      const up = Math.max(0, -dy), p = Math.min(1, up / 320);
      if (g.v) {
        g.v.style.transition = 'none';
        g.v.style.transform = 'translate(' + dx * 0.3 + 'px, ' + (-up * 0.45) + 'px) scale(' + (1 - p * 0.32) + ')';
        g.v.style.borderRadius = Math.round(28 * p) + 'px';
      }
      // on marque une pause assez haut : les apps recentes s'ouvrent sans relacher
      clearTimeout(g.pause);
      if (up > 70) g.pause = setTimeout(() => { if (g && g.mode === 'up') { const x = endGesture(); swallow = true; resetView(x.v, false); open(); } }, 200);
    } else if (g.mode === 'side' && g.v) {
      g.v.style.transition = 'none';
      g.v.style.transform = 'translateX(' + dx * 0.35 + 'px)';
    }
  });
  const pillEnd = (e) => {
    if (!g || e.pointerId !== g.id) return;
    const x = endGesture();
    if (!x.mode) return;                                   // simple clic : la barre ramene a l'accueil (main.js)
    swallow = true;
    const dx = e.clientX - x.x, dy = e.clientY - x.y;
    if (x.mode === 'up') {
      if (-dy > 70 && x.vy > -0.45) { resetView(x.v, false); open(); }
      else if (-dy > 36) { resetView(x.v, false); RZ().showView('home'); }
      else resetView(x.v, true);
    } else if (x.mode === 'side') {
      const cur = curKey();
      const prev = recents.find((it) => it.key !== cur);
      resetView(x.v, !(Math.abs(dx) > 70 && prev));
      if (Math.abs(dx) > 70 && prev) { snap(cur); go(prev.key, dx > 0 ? -1 : 1); }
    }
  };
  pill.addEventListener('pointerup', pillEnd);
  pill.addEventListener('pointercancel', (e) => { const x = g && e.pointerId === g.id ? endGesture() : null; if (x) resetView(x.v, true); });
  // le clic qui suit un geste ne doit pas ramener a l'accueil
  nav.addEventListener('click', (e) => { if (swallow && e.target.closest('#n-home')) { e.stopPropagation(); e.preventDefault(); } swallow = false; }, true);

  window.RZSwitch = { open, close, snap, visited, forget, keys: () => recents.map((x) => x.key), isOpen: () => isOpen };
})();
