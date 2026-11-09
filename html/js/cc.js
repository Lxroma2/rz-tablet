/* Centre de controle : s'ouvre d'un clic sur le haut droit de la barre d'etat (wifi, batterie)
   ou en glissant vers le bas depuis la moitie droite de la barre d'etat.
   - AirDrop, marche avec la tablette, son des notifications, apercu tablette rangee
   - Ne pas deranger
   - luminosite (voile noir sur tout l'ecran, DUI compris) et transparence en marche (curseurs verticaux)
   - verrouiller maintenant, recentrer la fenetre, raccourcis Calculatrice / Notes / Carte
   Les reglages passent par RZ.setSetting (settings.js) : ce sont les memes que dans Reglages. */
(() => {
  const $ = (id) => document.getElementById(id);
  const RZ = () => window.RZ;
  const cc = $('cc');
  const get = (k) => (RZ() && RZ().getSetting ? RZ().getSetting(k) : undefined);
  const set = (k, v) => { if (RZ() && RZ().setSetting) RZ().setSetting(k, v); };
  const isOpen = () => cc.classList.contains('open');

  /* ---------- Etat des boutons ---------- */
  function tog(id, on, sub, disabled) {
    const b = $(id);
    b.classList.toggle('on', !!on);
    b.disabled = !!disabled;
    const s = b.parentElement.querySelector('small');
    if (s && sub != null) s.textContent = sub;
    if (sub != null) b.title = b.getAttribute('aria-label') + ' : ' + sub;
  }
  function render() {
    const canWalk = !!(RZ() && RZ().canWalk && RZ().canWalk());
    const ad = get('airdrop') !== 'off';
    tog('cc-airdrop', ad, ad ? 'Tout le monde' : 'Désactivé');
    tog('cc-walk', canWalk && !!get('allowWalk'), canWalk ? (get('allowWalk') ? 'Activée' : 'Désactivée') : 'Interdite', !canWalk);
    const snd = get('sound') !== false;
    tog('cc-sound', snd, snd ? 'Activé' : 'Coupé');
    $('cc-sound').querySelector('use').setAttribute('href', snd ? '#ic-sound' : '#ic-sound-off');
    const pk = get('peek') !== false;
    tog('cc-peek', pk, pk ? 'Activé' : 'Désactivé');

    const dnd = get('dnd') === true;
    $('cc-dnd').classList.toggle('on', dnd);
    $('cc-dnd-s').textContent = dnd ? 'Activé' : 'Désactivé';

    slider($('cc-bright'), Number(get('brightness')) || 1, 0.3, 1);
    slider($('cc-walkop'), Number(get('walkOpacity')) || 0.35, 0.1, 1);
    $('cc-walkop').classList.toggle('disabled', !canWalk);

    const locked = !!(window.RZLock && RZLock.visible());
    $('cc-lock').disabled = !(window.RZLock && RZLock.getMode && RZLock.getMode() !== 'none') || locked;
    cc.querySelectorAll('[data-app]').forEach((b) => { b.disabled = locked; });
  }

  /* ---------- Ouvrir / fermer ---------- */
  function open() {
    if (isOpen() || !RZ() || !RZ().isOpen()) return;
    if (window.RZNotif) RZNotif.closeCenter();
    render();
    cc.classList.remove('hidden'); void cc.offsetWidth;
    cc.classList.add('open');
  }
  function close() {
    if (!isOpen()) return false;
    cc.classList.remove('open');
    setTimeout(() => { if (!isOpen()) cc.classList.add('hidden'); }, 320);
    return true;
  }
  const toggle = () => (isOpen() ? close() : open());

  // clic sur le haut droit de la barre d'etat (sauf le bouton "recentrer")
  const right = document.querySelector('.status-right');
  let swiped = false;
  right.addEventListener('click', (e) => {
    if (swiped) { swiped = false; return; }
    if (e.target.closest('#reset-win')) return;
    toggle();
  });
  // glisser vers le bas depuis la moitie droite de la barre d'etat
  const bar = document.querySelector('.statusbar');
  let sw = null;
  bar.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('#island, #reset-win')) return;
    const r = bar.getBoundingClientRect();
    if (e.clientX < r.left + r.width / 2) return;
    sw = { id: e.pointerId, y: e.clientY };
  });
  bar.addEventListener('pointermove', (e) => {
    if (!sw || e.pointerId !== sw.id) return;
    if (e.clientY - sw.y > 24) { sw = null; swiped = true; open(); setTimeout(() => { swiped = false; }, 400); }
  });
  const swEnd = () => { sw = null; };
  bar.addEventListener('pointerup', swEnd);
  bar.addEventListener('pointercancel', swEnd);

  // clic dans le vide : on ferme
  cc.addEventListener('click', (e) => { if (!e.target.closest('.cc-grid > *')) close(); });
  // l'ilot ouvre le centre de notifications : le centre de controle se ferme
  $('island').addEventListener('click', () => close());
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) { close(); e.preventDefault(); e.stopPropagation(); }
  }, true);
  window.addEventListener('message', (e) => { if (e.data && e.data.action === 'close') { cc.classList.remove('open'); cc.classList.add('hidden'); } });

  /* ---------- Boutons ---------- */
  const act = (icon, text, tone) => { if (window.RZIsland) RZIsland.activity(icon, text, tone, 1600); };
  $('cc-airdrop').onclick = () => {
    const on = get('airdrop') === 'off';
    set('airdrop', on ? 'all' : 'off'); render();
    act('airdrop', on ? 'AirDrop : tout le monde' : 'AirDrop désactivé', on ? 'ok' : '');
  };
  $('cc-walk').onclick = () => { set('allowWalk', !get('allowWalk')); render(); };
  $('cc-sound').onclick = () => { set('sound', get('sound') === false); render(); };
  $('cc-peek').onclick = () => { set('peek', get('peek') === false); render(); };
  $('cc-dnd').onclick = () => { if (RZ() && RZ().setDnd) RZ().setDnd(get('dnd') !== true); render(); };
  $('cc-lock').onclick = () => { close(); if (window.RZLock && RZLock.lockNow) RZLock.lockNow(); };
  $('cc-center').onclick = () => { $('reset-win').click(); };
  cc.querySelectorAll('[data-app]').forEach((b) => {
    b.onclick = () => { close(); if (RZ()) RZ().showView(b.dataset.app); };
  });

  /* ---------- Curseurs verticaux : on tire depuis la valeur actuelle (pas de saut au clic) ---------- */
  function slider(el, v, min, max) {
    el.dataset.v = String(v);
    el.style.setProperty('--v', ((v - min) / (max - min) * 100) + '%');
  }
  function drag(el, min, max, apply) {
    let s = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || el.classList.contains('disabled')) return;
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* pointeur deja relache */ }
      s = { id: e.pointerId, y: e.clientY, v: Number(el.dataset.v) || max, h: el.offsetHeight };
      el.classList.add('active');
    });
    el.addEventListener('pointermove', (e) => {
      if (!s || e.pointerId !== s.id) return;
      const v = Math.max(min, Math.min(max, s.v + (s.y - e.clientY) / s.h * (max - min)));
      slider(el, v, min, max);
      apply(Math.round(v * 100) / 100);
    });
    const end = (e) => { if (s && e.pointerId === s.id) { s = null; el.classList.remove('active'); } };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    // molette : petits pas
    el.addEventListener('wheel', (e) => {
      if (el.classList.contains('disabled')) return;
      e.preventDefault();
      const v = Math.max(min, Math.min(max, (Number(el.dataset.v) || max) - Math.sign(e.deltaY) * 0.05));
      slider(el, v, min, max); apply(Math.round(v * 100) / 100);
    }, { passive: false });
  }
  drag($('cc-bright'), 0.3, 1, (v) => set('brightness', v));
  let opTimer = null;
  drag($('cc-walkop'), 0.1, 1, (v) => {
    set('walkOpacity', v);
    $('tablet').style.opacity = String(v);                 // apercu de la transparence
    clearTimeout(opTimer);
    opTimer = setTimeout(() => { $('tablet').style.opacity = '1'; }, 900);
  });

  window.RZCC = { open, close, toggle };
})();
