/* Ilot dynamique + notifications.
   - L'ilot (pastille noire en haut) s'agrandit pour Face ID, les notifications et les petites activites.
   - Les notifications sont gardees sur ce poste (40 max) : centre de notifications (clic sur l'ilot)
     et liste sur l'ecran verrouille.
   - Tablette rangee : elle depasse en bas de l'ecran le temps d'afficher la notification.
   Tout le texte recu est insere avec textContent. */
(() => {
  const $ = (id) => document.getElementById(id);
  const RZ = () => window.RZ;
  const island = $('island');
  const isC = $('island-c');
  const nc = $('nc');
  const KEY = 'rztab_notifs';
  const APP_NAMES = { services: 'Services', store: 'App', browser: 'Navigateur', settings: 'Réglages', system: 'Tablette', bank: 'Banque' };

  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  let list = load();
  const save = () => { list = list.slice(0, 40); try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} };

  function when(ts) {
    const s = (Date.now() - ts) / 1000;
    if (s < 60) return 'maintenant';
    if (s < 3600) return Math.floor(s / 60) + ' min';
    const d = new Date(ts), n = new Date();
    if (d.toDateString() === n.toDateString()) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  function appIcon(app, size) {
    const el = window.RZHome ? RZHome.iconEl(app) : h('span', 'icon');
    el.classList.add('ic-' + size);
    return el;
  }

  /* ---------- Carte de notification (ilot, centre, ecran verrouille) ---------- */
  function card(n, onClick) {
    const c = h('button', 'nt');
    const tx = h('span', 'nt-tx');
    const top = h('span', 'nt-top');
    top.append(h('b', null, n.title || APP_NAMES[n.app] || 'Notification'), h('time', null, when(n.ts)));
    tx.append(top);
    if (n.body) tx.append(h('span', 'nt-body', n.body));
    c.append(appIcon(n.app, 'sm'), tx);
    c.onclick = (e) => { e.stopPropagation(); onClick(n); };
    return c;
  }

  /* ---------- Ilot ---------- */
  let isTimer = null;
  let isState = 'idle';
  function islandTo(state, content, ms) {
    clearTimeout(isTimer);
    isState = state;
    island.style.transform = '';
    isC.textContent = '';
    if (content) isC.append(content);
    island.className = 'island' + (state === 'idle' ? '' : ' ' + state);
    if (ms) isTimer = setTimeout(() => islandTo('idle'), ms);
  }

  // petite activite : icone + texte, a gauche et a droite de la pastille
  const SVG = {
    face: '<svg viewBox="0 0 64 64" class="is-face"><path d="M8 22V13a5 5 0 0 1 5-5h9M42 8h9a5 5 0 0 1 5 5v9M56 42v9a5 5 0 0 1-5 5h-9M22 56h-9a5 5 0 0 1-5-5v-9"/><path class="ft" d="M24 25v5M40 25v5M32 25v12h-3M24 44c4.5 4 11.5 4 16 0"/><path class="fk" d="M20 33l8 8 16-17"/></svg>',
    mask: '<svg viewBox="0 0 24 24" class="is-glyph"><path d="M4 9.5c2.5-1.2 5.2-1.8 8-1.8s5.5.6 8 1.8v3.2c0 3.6-3.6 6.3-8 6.3s-8-2.7-8-6.3z"/><path d="M8 12.5h2M14 12.5h2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" class="is-glyph"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
    check: '<svg viewBox="0 0 24 24" class="is-glyph"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    moon: '<svg viewBox="0 0 24 24" class="is-glyph"><path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z"/></svg>',
    airdrop: '<svg viewBox="0 0 24 24" class="is-glyph"><path d="M8.5 17.5a5 5 0 1 1 7 0"/><path d="M5.6 20.4a9 9 0 1 1 12.8 0"/><circle cx="12" cy="12.5" r="1.6"/></svg>',
  };
  function activity(icon, text, tone, ms) {
    const w = h('span', 'is-act' + (tone ? ' ' + tone : ''));
    const ic = h('span', 'is-ic'); ic.innerHTML = SVG[icon] || '';
    w.append(ic, h('span', 'is-txt', text));
    islandTo('act', w, ms || 2600);
  }

  // Face ID dans l'ilot : scan -> reconnu / non reconnu / masque
  function face(state) {
    if (state === 'scan') {
      const w = h('span', 'is-facebox scanning'); w.innerHTML = SVG.face;
      islandTo('face', w);
    } else if (state === 'ok') {
      const w = h('span', 'is-facebox ok'); w.innerHTML = SVG.face;
      islandTo('face', w, 900);
    } else if (state === 'fail') {
      const w = h('span', 'is-facebox fail'); w.innerHTML = SVG.face;
      islandTo('face', w, 900);
    } else if (state === 'mask') {
      activity('mask', 'Retire ton masque', 'warn', 2600);
    } else islandTo('idle');
  }

  /* ---------- Glisser pour faire disparaitre ----------
     'island' : la banniere suit le doigt ; vers le haut (ou sur le cote) elle rentre dans l'ilot
                et reste dans le centre de notifications.
     'list'   : carte du centre ou de l'ecran verrouille ; a gauche ou a droite elle est effacee. */
  const PROJ = 0.998 / (1 - 0.998);                     // projection de l'elan (deceleration iOS), px/ms -> px
  const SPRING = 'cubic-bezier(.3, 1.22, .5, 1)';
  const ISL_T = 'width 480ms ' + SPRING + ', height 480ms ' + SPRING + ', border-radius 480ms ' + SPRING;
  const rub = (d, dim) => (d * dim * 0.55) / (dim + 0.55 * Math.abs(d));
  function swipe(el, kind, onDismiss) {
    const target = kind === 'island' ? island : el;
    let s = null, dragged = false;
    el.style.touchAction = kind === 'list' ? 'pan-y' : 'none';
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      dragged = false;
      s = { id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null, dx: 0, dy: 0, hist: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }] };
    });
    el.addEventListener('pointermove', (e) => {
      if (!s || e.pointerId !== s.id) return;
      s.hist.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
      if (s.hist.length > 6) s.hist.shift();
      if (!s.axis) {
        const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
        if (Math.hypot(dx, dy) < 8) return;              // petit seuil avant de choisir le sens
        s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (kind === 'list' && s.axis === 'y') { s = null; return; }   // laisse defiler la liste
        el.setPointerCapture(e.pointerId);
        s.x0 = e.clientX; s.y0 = e.clientY;              // part de la position actuelle : pas de saut
        target.style.transition = kind === 'island' ? ISL_T : 'none';
        if (kind === 'island') clearTimeout(isTimer);    // pas de fermeture auto pendant qu'on la tient
      }
      const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
      if (kind === 'list') {
        s.dx = dx;
        target.style.transform = 'translateX(' + dx + 'px)';
        target.style.opacity = String(1 - Math.min(0.6, Math.abs(dx) / el.offsetWidth * 0.6));
      } else {
        s.dx = rub(dx, 500); s.dy = dy < 0 ? dy : rub(dy, 160);
        target.style.transform = 'translateX(calc(-50% + ' + s.dx + 'px)) translateY(' + s.dy + 'px)';
      }
    });
    function end(e) {
      if (!s || e.pointerId !== s.id) return;
      const st = s; s = null;
      if (!st.axis) return;                              // simple clic
      dragged = true;
      const a = st.hist[0], b = st.hist[st.hist.length - 1], dt = Math.max(1, b.t - a.t);
      const px = st.dx + (b.x - a.x) / dt * PROJ, py = st.dy + (b.y - a.y) / dt * PROJ;
      if (kind === 'list') {
        const w = el.offsetWidth;
        if (Math.abs(px) > w * 0.45 && Math.sign(px) === Math.sign(st.dx || px)) {
          const dir = Math.sign(px);
          el.style.pointerEvents = 'none';
          el.style.transition = 'transform 260ms cubic-bezier(.2, .8, .3, 1), opacity 220ms ease';
          el.style.transform = 'translateX(' + dir * (w + 60) + 'px)'; el.style.opacity = '0';
          setTimeout(() => collapse(el, onDismiss), 200);
        } else {
          el.style.transition = 'transform 440ms ' + SPRING + ', opacity 240ms ease';
          el.style.transform = ''; el.style.opacity = '';
          setTimeout(() => { if (!el.style.transform) el.style.transition = ''; }, 460);
        }
      } else {
        island.style.transition = ISL_T + ', transform 420ms ' + SPRING;
        if (py < -30 || Math.abs(px) > 180) { islandTo('idle'); if (onDismiss) onDismiss(); }
        else { island.style.transform = ''; isTimer = setTimeout(() => islandTo('idle'), 3000); }
        setTimeout(() => { if (!s) island.style.transition = ''; }, 460);
      }
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    // apres un glissement, le relachement ne doit pas ouvrir la notification
    // (ecouteur en capture : il passe avant onclick sur la carte elle-meme)
    el.addEventListener('click', (e) => { if (dragged) { dragged = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  }
  // la carte partie, les suivantes remontent
  function collapse(el, done) {
    let fired = false;
    const fin = () => { if (!fired) { fired = true; if (done) done(); } };
    const cs = getComputedStyle(el);
    const next = !!el.nextElementSibling, prev = !next && !!el.previousElementSibling;
    el.style.overflow = 'hidden';
    try {
      el.animate([
        { height: el.offsetHeight + 'px', paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, marginTop: '0px', marginBottom: '0px' },
        { height: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: prev ? '-8px' : '0px', marginBottom: next ? '-8px' : '0px' },
      ], { duration: 260, easing: 'cubic-bezier(.2, .8, .3, 1)', fill: 'forwards' }).onfinish = fin;
    } catch (e) { /* sans animation */ }
    setTimeout(fin, 300);
  }
  function remove(n) {
    list = list.filter((x) => x.id !== n.id); save(); badges();
  }

  function banner(n, ms) {
    const c = card(n, activate);
    swipe(c, 'island');
    islandTo('notif', c, ms || 5200);
  }
  const peeking = () => tablet.classList.contains('peek');
  island.addEventListener('click', () => {
    if (peeking()) return;
    if (isState === 'notif' || isState === 'act') { islandTo('idle'); return; }
    if (isState === 'idle' && !(window.RZLock && RZLock.visible())) toggleCenter();
  });

  /* ---------- Ouvrir ce qu'une notification concerne ---------- */
  function activate(n) {
    if (peeking()) return;   // tablette rangee : il faut d'abord la sortir
    n.read = true; save(); badges();
    islandTo('idle');
    closeCenter();
    if (window.RZLock && RZLock.visible()) { RZLock.reveal(); return; }
    const o = n.open || {};
    if (n.app === 'services' || o.view === 'services') {
      RZ().showView('services');
      if (o.tid && window.RZSvc && RZSvc.openThread) RZSvc.openThread(o);
    } else if (n.app && window.RZHome && RZHome.isInstalled(n.app)) {
      RZHome.open(n.app);
    }
  }

  /* ---------- Centre de notifications ---------- */
  function renderCenter() {
    const box = $('nc-list'); box.textContent = '';
    $('nc-clear').classList.toggle('hidden', !list.length);
    if (!list.length) { box.append(h('div', 'nc-empty', 'Aucune notification')); return; }
    list.forEach((n) => {
      const c = card(n, activate);
      swipe(c, 'list', () => {
        remove(n);
        if (!list.length) renderCenter(); else c.remove();
        if (window.RZLock && RZLock.visible()) RZLock.refresh();
      });
      box.append(c);
    });
  }
  function toggleCenter() { if (nc.classList.contains('open')) closeCenter(); else openCenter(); }
  function openCenter() {
    renderCenter();
    nc.classList.remove('hidden'); void nc.offsetWidth;
    nc.classList.add('open');
    list.forEach((n) => { n.read = true; }); save(); badges();
  }
  function closeCenter() {
    if (!nc.classList.contains('open')) return;
    nc.classList.remove('open');
    setTimeout(() => { if (!nc.classList.contains('open')) nc.classList.add('hidden'); }, 380);
  }
  $('nc-dnd').onclick = (e) => { e.stopPropagation(); if (RZ() && RZ().setDnd) RZ().setDnd(RZ().getSetting('dnd') !== true); };
  $('nc-clear').onclick = (e) => { e.stopPropagation(); list = []; save(); renderCenter(); badges(); if (window.RZLock) RZLock.refresh(); };
  nc.addEventListener('click', (e) => { if (!e.target.closest('.nt, button')) closeCenter(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nc.classList.contains('open')) { closeCenter(); e.preventDefault(); e.stopPropagation(); }
  }, true);

  /* ---------- Pastilles rouges sur les icones ---------- */
  function badges() {
    const counts = {};
    list.forEach((n) => { if (!n.read) counts[n.app] = (counts[n.app] || 0) + 1; });
    if (window.RZHome) RZHome.badges(counts);
  }
  function readApp(app) {
    let changed = false;
    list.forEach((n) => { if (n.app === app && !n.read) { n.read = true; changed = true; } });
    if (changed) { save(); badges(); }
  }

  /* ---------- Tablette rangee : apercu en bas de l'ecran ----------
     Le haut de l'ecran verrouille depasse avec la notification dans l'ilot.
     Rien n'est cliquable tant que la tablette n'est pas sortie (CSS #tablet.peek + garde dans activate). */
  const tablet = $('tablet');
  let peekTimer = null, peekOutTimer = null, bannerTimer = null;
  function peek(n, ms) {
    clearTimeout(peekTimer); clearTimeout(peekOutTimer); clearTimeout(bannerTimer);
    const dur = Math.max(2500, ms || 5000);
    tablet.classList.remove('hidden', 'peek-out');
    tablet.classList.add('peek');
    if (window.RZLock) RZLock.preview(true);
    bannerTimer = setTimeout(() => banner(n, dur + 1000), 260);   // la tablette monte, puis l'ilot s'ouvre
    peekTimer = setTimeout(peekEnd, dur);
  }
  function peekEnd() {
    clearTimeout(peekTimer); clearTimeout(peekOutTimer); clearTimeout(bannerTimer);
    islandTo('idle');
    tablet.classList.add('peek-out');
    peekOutTimer = setTimeout(() => {
      tablet.classList.remove('peek', 'peek-out');
      if (window.RZLock) RZLock.preview(false);
      if (!RZ() || !RZ().isOpen()) tablet.classList.add('hidden');
    }, 460);
  }
  function cancelPeek() {
    clearTimeout(peekTimer); clearTimeout(peekOutTimer); clearTimeout(bannerTimer);
    tablet.classList.remove('peek', 'peek-out');
    if (window.RZLock) RZLock.preview(false);
  }

  /* ---------- Reception ---------- */
  function push(raw, opts) {
    if (!raw || typeof raw !== 'object') return;
    const n = {
      id: Date.now() + Math.random(),
      app: String(raw.app || 'system').slice(0, 24),
      title: String(raw.title || '').slice(0, 80),
      body: String(raw.body || '').slice(0, 240),
      open: raw.open && typeof raw.open === 'object' ? raw.open : null,
      ts: Date.now(), read: false,
    };
    list.unshift(n); save(); badges();
    const open = RZ() && RZ().isOpen();
    const dnd = !!(RZ() && RZ().getSetting && RZ().getSetting('dnd') === true);   // Ne pas deranger : en silence dans le centre
    if (open) {
      if (window.RZLock && RZLock.visible()) RZLock.refresh();
      if (nc.classList.contains('open')) renderCenter();
      if (RZ().currentView && RZ().currentView() === n.app) { n.read = true; save(); badges(); }
      if (!dnd) banner(n);
    } else if (opts && opts.peek && !dnd) {
      peek(n, opts.time);
    }
  }

  // liste sur l'ecran verrouille : notifications non lues, les plus recentes en haut
  function renderLock(box, max, onClick) {
    box.textContent = '';
    const show = RZ() && RZ().getSetting && RZ().getSetting('lockNotifs') === false ? [] : list.filter((n) => !n.read).slice(0, max);
    show.forEach((n) => {
      const c = card(n, onClick);
      swipe(c, 'list', () => { remove(n); if (window.RZLock) RZLock.refresh(); });
      box.append(c);
    });
    const more = list.filter((n) => !n.read).length - show.length;
    if (show.length && more > 0) box.append(h('div', 'nt-more', '+ ' + more + ' autre' + (more > 1 ? 's' : '')));
  }

  window.RZNotif = { push, cancelPeek, renderLock, readApp, badges, closeCenter };
  window.RZIsland = { face, activity, idle: () => islandTo('idle') };
})();
