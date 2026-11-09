/* Ecran de verrouillage facon iOS : ecran verrouille (cadenas, date, horloge, balayer vers le haut)
   puis ecran de code (fond floute, points, pave rond). Modes : aucun / code a 4 chiffres / Face ID.
   Toutes les verifications sont faites par le serveur ; l'interface ne connait jamais le code. */
(() => {
  const $ = (id) => document.getElementById(id);
  const RZ = () => window.RZ;
  const el = $('lock'), ls = $('lock-ls'), pc = $('lock-pc'), pcIn = $('lock-pc-in');
  const glyph = $('lock-glyph'), hint = $('lock-hint');
  const screen = document.querySelector('.screen');
  const MODES = { none: 'Aucun', pin: 'Code', face: 'Face ID' };
  const LETTERS = { 2: 'ABC', 3: 'DEF', 4: 'GHI', 5: 'JKL', 6: 'MNO', 7: 'PQRS', 8: 'TUV', 9: 'WXYZ' };
  const SLIDE = 'transform 440ms var(--ease-drawer)';
  const HINT = 'Balaye vers le haut pour ouvrir';

  let mode = 'none';   // verrou actuel de la tablette en main
  let ctx = null;      // { kind: 'unlock' } ou { kind: 'create', target, steps, i, cur, next }
  let stage = 'ls';    // 'ls' ecran verrouille, 'pc' ecran de code
  let faceOk = false;
  let buf = '';
  let busy = false;
  let clockTimer = null, hintTimer = null, leaveTimer = null;

  /* ---------- Serveur (donnees de demo hors du jeu : code 1234) ---------- */
  function call(name, payload) {
    if (!RZ() || !RZ().isFiveM) {
      // banc d'essai (dev/) : window.RZDEV_FACE = 'ok' | 'mask' | 'fail'
      const dev = window.RZDEV_FACE;
      if (name === 'lockVerify' && payload.proof.face && (dev === 'mask' || dev === 'fail')) return Promise.resolve({ ok: false, mask: dev === 'mask', wait: 0 });
      if (name === 'lockVerify') return Promise.resolve({ ok: !!(payload.proof.face || payload.proof.pin === '1234'), wait: 0 });
      return Promise.resolve({ ok: true, mode: payload.mode });
    }
    return RZ().postJson(name, payload);
  }

  /* ---------- Horloge ---------- */
  function syncClock() {
    $('lock-time').textContent = $('clock').textContent;
    const d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    $('lock-date').textContent = d.charAt(0).toUpperCase() + d.slice(1);
  }

  /* ---------- Ecran de code ---------- */
  function dots() {
    $('lock-dots').querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < buf.length));
    $('lock-alt').textContent = buf.length ? 'Supprimer' : 'Annuler';
  }
  function msg(t) { $('lock-msg').textContent = t || ''; }
  function shake(node) { node.classList.remove('shake'); void node.offsetWidth; node.classList.add('shake'); }
  function title(t) { $('lock-title').textContent = t; buf = ''; dots(); }

  /* ---------- Glissement de l'ecran verrouille ---------- */
  const H = () => el.clientHeight || 600;
  function currentY() { return new DOMMatrix(getComputedStyle(ls).transform).m42 || 0; }
  function setY(y, animate) {
    const p = Math.min(1, Math.max(0, -y / H()));
    ls.style.transition = animate ? SLIDE : 'none';
    pcIn.style.transition = animate ? 'opacity 300ms ease, ' + SLIDE : 'none';
    ls.style.transform = 'translateY(' + y + 'px)';
    // le pave monte un peu et apparait pendant que l'ecran verrouille s'en va
    pcIn.style.opacity = String(p);
    pcIn.style.transform = 'translateY(' + Math.round(28 * (1 - p)) + 'px)';
  }
  function rubber(d) { const c = 0.55, dim = H(); return (d * dim * c) / (dim + c * Math.abs(d)); }

  // ecran verrouille -> ecran de code (ou bureau si Face ID a reconnu le visage)
  function commit() {
    setY(-H(), true);
    if (faceOk) { unlock(); return; }
    stage = 'pc';
    el.dataset.stage = 'pc';
    title('Saisis ton code'); msg('');
  }
  // ecran de code -> retour a l'ecran verrouille (meme chemin, en sens inverse)
  function backToLs() {
    stage = 'ls';
    el.dataset.stage = 'ls';
    buf = ''; dots(); msg('');
    setY(0, true);
  }

  let drag = null;
  ls.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || stage !== 'ls' || e.target.closest('button:not(#lock-swipe)')) return;
    ls.setPointerCapture(e.pointerId);
    const base = currentY();
    setY(base, false);
    drag = { id: e.pointerId, y0: e.clientY, base, moved: false, hist: [{ y: e.clientY, t: e.timeStamp }] };
  });
  ls.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) < 6) return;
    drag.moved = true;
    const y = drag.base + dy;
    setY(y < 0 ? y : rubber(y), false);
    drag.hist.push({ y: e.clientY, t: e.timeStamp });
    if (drag.hist.length > 6) drag.hist.shift();
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (!d.moved) {
      // simple clic : sur l'indication en bas, on ouvre comme sur iOS avec le bouton
      if (e.type === 'pointerup' && e.target.closest('#lock-swipe')) commit(); else setY(0, true);
      return;
    }
    const a = d.hist[0], b = d.hist[d.hist.length - 1];
    const v = b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0;            // px/ms, negatif = vers le haut
    const y = currentY();
    const projected = y + v * 1000 * 0.998 / (1 - 0.998) / 1000;  // projection de l'elan (deceleration iOS)
    if (v < 0.15 && projected < -H() * 0.35) commit(); else setY(0, true);
  }
  ls.addEventListener('pointerup', endDrag);
  ls.addEventListener('pointercancel', endDrag);

  /* ---------- Cadenas / Face ID ---------- */
  function glyphState(s) { glyph.className = 'lk-glyph' + (s ? ' ' + s : ''); }
  function setHint(t, ms) {
    clearTimeout(hintTimer);
    hint.textContent = t;
    if (ms) hintTimer = setTimeout(() => { hint.textContent = HINT; }, ms);
  }
  // Face ID se passe dans l'ilot, le cadenas s'ouvre en dessous
  const isl = (s) => { if (window.RZIsland) RZIsland.face(s); };
  function faceScan() {
    const c = ctx;
    glyphState('');
    isl('scan');
    el.classList.add('scanning');
    const done = () => setTimeout(() => el.classList.remove('scanning'), 900);
    setTimeout(async () => {
      if (ctx !== c) return;
      const r = await call('lockVerify', { proof: { face: true } });
      if (ctx !== c) return;
      done();
      if (r && r.ok) {
        faceOk = true;
        isl('ok');
        // deja sur l'ecran de code : Face ID deverrouille directement, comme sur iOS
        if (stage === 'pc') { unlock(); return; }
        el.classList.add('face-ok');
        glyphState('open');
      } else if (r && r.mask) {
        isl('mask');
        shake(glyph);
        setHint('Masque détecté : balaye pour saisir le code', 3200);
      } else {
        isl('fail');
        shake(glyph);
        setHint('Visage non reconnu', 1800);
      }
    }, 1000);
  }

  // notifications non lues sous l'horloge ; un clic propose de deverrouiller
  function renderNotifs() {
    if (window.RZNotif) RZNotif.renderLock($('lock-notifs'), el.classList.contains('short') ? 1 : 3, () => { if (stage === 'ls') commit(); });
  }

  /* ---------- Ouverture / fermeture ---------- */
  function show() {
    clearTimeout(leaveTimer);
    el.style.setProperty('--wall', screen.style.background || '#000');
    syncClock();
    clearInterval(clockTimer); clockTimer = setInterval(syncClock, 1000);
    el.classList.remove('hidden', 'leaving', 'face-ok', 'flow');
    el.classList.toggle('short', el.clientHeight < 540);
    screen.classList.add('locked');
    if (RZ()) RZ().setTyping(true);   // le clavier va a la tablette (chiffres)
  }
  function reset() {
    clearInterval(clockTimer); clockTimer = null;
    clearTimeout(hintTimer);
    el.classList.remove('scanning');
    ctx = null; buf = ''; busy = false; faceOk = false; drag = null;
    screen.classList.remove('locked');
    if (RZ()) RZ().setTyping(false);
  }
  function hideNow() {
    el.classList.add('hidden');
    el.classList.remove('leaving', 'face-ok', 'flow', 'preview');
    screen.classList.remove('unlocking');
  }
  // deverrouille : l'ecran s'efface et le bureau arrive en zoom, comme sur iOS
  function unlock() {
    reset();
    el.classList.add('leaving');
    screen.classList.remove('unlocking'); void screen.offsetWidth; screen.classList.add('unlocking');
    leaveTimer = setTimeout(hideNow, 560);
  }
  function cancelFlow() {
    reset();
    el.classList.add('leaving');
    leaveTimer = setTimeout(hideNow, 320);
  }

  /* ---------- Deverrouillage ---------- */
  function beginUnlock() {
    ctx = { kind: 'unlock' };
    stage = 'ls';
    el.dataset.stage = 'ls';
    show();
    setY(0, false);
    setHint(HINT);
    title('Saisis ton code'); msg('');
    renderNotifs();
    if (mode === 'face') faceScan(); else glyphState('');
  }

  /* ---------- Creation / modification (depuis les Reglages) ---------- */
  const TITLES = { cur: 'Saisis ton code actuel', new: 'Choisis un nouveau code', confirm: 'Confirme le nouveau code' };
  function beginFlow(target, needNew) {
    const steps = [];
    if (mode !== 'none') steps.push('cur');
    if (needNew) steps.push('new', 'confirm');
    ctx = { kind: 'create', target, steps, i: 0, cur: null, next: null };
    stage = 'pc';
    el.dataset.stage = 'pc';
    show();
    el.classList.add('flow');
    setY(-H(), false);
    msg('');
    if (!steps.length) { title(''); finishFlow(); return; }
    title(TITLES[steps[0]]);
  }

  async function finishFlow() {
    const c = ctx;
    busy = true;
    const payload = { mode: c.target };
    if (c.next) payload.pin = c.next;
    if (c.cur) payload.current = { pin: c.cur };
    const r = await call('lockSet', payload);
    busy = false;
    if (ctx !== c) return;
    if (r && r.ok) {
      mode = r.mode || c.target;
      renderSettings();
      cancelFlow();
    } else if (r && r.err === 'wrong') {
      c.i = 0; c.cur = null; c.next = null;
      title(TITLES[c.steps[0]]); shake($('lock-dots'));
      msg(r.wait ? 'Trop d\'essais. Réessaie dans ' + r.wait + ' s.' : 'Code incorrect');
    } else {
      title(TITLES[c.steps[c.i]] || TITLES.new);
      msg('Impossible d\'enregistrer le verrouillage.');
    }
  }

  /* ---------- Saisie ---------- */
  async function submit() {
    const code = buf;
    if (!ctx) return;
    if (ctx.kind === 'unlock') {
      busy = true;
      const c = ctx;
      const r = await call('lockVerify', { proof: { pin: code } });
      busy = false;
      if (ctx !== c) return;
      if (r && r.ok) { unlock(); return; }
      buf = ''; dots(); shake($('lock-dots'));
      msg(r && r.wait ? 'Trop d\'essais. Réessaie dans ' + r.wait + ' s.' : '');
      return;
    }
    const c = ctx, step = c.steps[c.i];
    if (step === 'cur') c.cur = code;
    if (step === 'new') c.next = code;
    if (step === 'confirm' && code !== c.next) {
      c.i = c.steps.indexOf('new'); c.next = null;
      title(TITLES.new); shake($('lock-dots')); msg('Les codes ne correspondent pas. Réessaie.');
      return;
    }
    c.i++;
    if (c.i >= c.steps.length) { finishFlow(); return; }
    msg(''); title(TITLES[c.steps[c.i]]);
  }

  function press(d) {
    if (!ctx || busy || stage !== 'pc' || buf.length >= 4) return;
    buf += d; dots();
    if (buf.length === 4) setTimeout(submit, 140);   // laisse voir le 4e point
  }
  function erase() { if (!busy && buf.length) { buf = buf.slice(0, -1); dots(); } }
  // bouton en bas a droite : Supprimer si des chiffres sont saisis, sinon Annuler
  function alt() {
    if (!ctx) return;
    if (buf.length) { erase(); return; }
    if (ctx.kind === 'unlock') backToLs(); else cancelFlow();
  }

  // pave numerique : chiffre + lettres, comme le clavier de code iOS
  const pad = $('lock-pad');
  const keys = {};
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''].forEach((k) => {
    const b = document.createElement('button');
    if (k === '') { b.className = 'key blank'; b.tabIndex = -1; b.disabled = true; pad.appendChild(b); return; }
    b.className = 'key';
    b.innerHTML = '<span class="d">' + k + '</span><span class="l">' + (LETTERS[k] || '') + '</span>';
    b.addEventListener('pointerdown', (e) => { if (e.button === 0) press(k); });   // reponse a l'appui, pas au relachement
    keys[k] = b;
    pad.appendChild(b);
  });
  $('lock-alt').onclick = alt;
  $('lock-power').onclick = () => { if (RZ()) RZ().post('close'); };

  function flash(k) {
    const b = keys[k]; if (!b) return;
    b.classList.add('lit');
    setTimeout(() => b.classList.remove('lit'), 90);
  }

  // en phase de capture : passe avant le raccourci Echap global de app.js
  window.addEventListener('keydown', (e) => {
    if (el.classList.contains('hidden') || el.classList.contains('leaving')) return;
    const k = e.key;
    let handled = true;
    if (/^[0-9]$/.test(k)) {
      if (stage === 'ls') { if (faceOk) handled = false; else commit(); }
      if (stage === 'pc') { flash(k); press(k); }
    } else if (k === 'Backspace') erase();
    else if (k === 'Escape') {
      if (stage === 'pc') alt(); else if (RZ()) RZ().post('close');
    } else if ((k === 'Enter' || k === ' ' || k === 'ArrowUp') && stage === 'ls') commit();
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  new ResizeObserver(() => { if (!el.classList.contains('hidden')) el.classList.toggle('short', el.clientHeight < 540); }).observe(el);

  /* ---------- Page Reglages > Verrouillage ---------- */
  function renderSettings() {
    $('v-lock').textContent = MODES[mode];
    document.querySelectorAll('.lk-opt').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
    $('lk-change').classList.toggle('hidden', mode === 'none');
  }
  document.querySelectorAll('.lk-opt').forEach((b) => {
    b.onclick = () => {
      const target = b.dataset.m;
      if (target === mode) return;
      // un code est necessaire pour activer un verrou s'il n'y en a pas encore (secours de Face ID)
      beginFlow(target, mode === 'none' && target !== 'none');
    };
  });
  $('lk-change-btn').onclick = () => beginFlow(mode, true);

  /* ---------- Points d'entree pour app.js ---------- */
  window.RZLock = {
    start(info) {
      mode = (info && MODES[info.mode]) ? info.mode : 'none';
      el.classList.remove('preview');
      renderSettings();
      if (mode === 'none') { reset(); hideNow(); } else beginUnlock();
    },
    hide() { clearTimeout(leaveTimer); reset(); hideNow(); if (window.RZIsland) RZIsland.idle(); },
    visible() { return !['hidden', 'leaving', 'flow', 'preview'].some((c) => el.classList.contains(c)); },
    getMode() { return mode; },
    // centre de controle : verrouiller tout de suite (sans effet si aucun verrou n'est choisi)
    lockNow() {
      if (mode === 'none' || this.visible() || el.classList.contains('flow')) return false;
      clearTimeout(leaveTimer);
      el.classList.remove('preview');
      beginUnlock();
      return true;
    },
    refresh() { if (this.visible()) renderNotifs(); },
    reveal() { if (this.visible() && stage === 'ls') commit(); },
    // tablette rangee : l'apercu d'une notification se fait sur l'ecran verrouille, rien n'y est cliquable
    preview(on) {
      if (on) {
        if (!el.classList.contains('hidden') && !el.classList.contains('preview')) return;
        clearTimeout(leaveTimer);
        el.style.setProperty('--wall', screen.style.background || '#000');
        syncClock();
        stage = 'ls'; el.dataset.stage = 'ls';
        el.classList.remove('hidden', 'leaving', 'face-ok', 'flow', 'scanning');
        el.classList.add('preview');
        glyphState(''); setHint(HINT); setY(0, false);
        screen.classList.add('locked');
      } else if (el.classList.contains('preview')) {
        el.classList.remove('preview'); el.classList.add('hidden');
        screen.classList.remove('locked');
      }
    },
  };
})();
