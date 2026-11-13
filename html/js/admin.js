/* Reglages > Administration (staff seulement, verifie par le serveur) :
   - Applications : ajouter / modifier / supprimer les apps web de App (nom, lien, image, couleur...)
   - Sites autorises : la liste blanche du navigateur, en plus de Config.Browser.allowedHosts
   Les elements de config.lua sont affiches mais ne se modifient que dans le fichier. */
(() => {
  const $ = (id) => document.getElementById(id);
  const RZ = () => window.RZ;
  const H = () => window.RZHome;
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const svg = (name) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'i'); s.innerHTML = '<use href="#' + name + '"/>'; return s; };

  const COLORS = ['#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f', '#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#0f8a4b', '#64d2ff', '#8e8e93', '#3a3a3c'];
  const ERR = {
    forbidden: 'Action réservée au staff.',
    host: 'Nom de domaine invalide (ex. exemple.com).',
    exists: 'Ce site est déjà autorisé.',
    max: 'Limite atteinte.',
    sitesMax: 'Limite de sites autorisés atteinte : retires-en un.',
    fixed: 'Défini dans config.lua : à modifier dans le fichier.',
    missing: "Cet élément n'existe plus.",
    label: 'Le nom doit faire au moins 2 caractères.',
    url: 'Le lien du site doit commencer par https:// (nom de domaine public).',
    image: "Le lien de l'image doit commencer par https:// et ne pas contenir d'espace.",
    icon: 'Pictogramme : lettres minuscules, chiffres et tirets seulement.',
  };
  const errText = (r) => (r && r.err === 'used') ? "Utilisé par l'app « " + (r.app || '?') + " » : supprime-la d'abord." : (r && ERR[r.err]) || 'Le serveur ne répond pas. Réessaie.';
  const okHttps = (u) => /^https:\/\/[^\s"'<>()\\]+$/i.test(u);
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };

  let st = null;          // dernier etat recu : { restrict, sites: [{ host, fixed }], apps: [{ id, fixed }] }
  let editId = null;      // app en cours de modification (null = nouvelle)
  let color = COLORS[0];
  let busy = false;

  const call = (act, payload) => RZ().postJson('admin', { act, payload });
  function accept(r) {
    if (!r || !r.ok) return false;
    st = { restrict: r.restrict !== false, sites: r.sites || [], apps: r.apps || [] };
    if (r.browser || r.store) RZ().applyCfg(r.browser, r.store);
    render();
    return true;
  }
  function msg(id, text, kind) { const m = $(id); m.textContent = text || ''; m.classList.toggle('bad', kind === 'bad'); m.classList.toggle('good', kind === 'good'); }

  /* ---------- Page Administration ---------- */
  const APPS_HINT = 'Les apps ajoutées ici apparaissent dans App pour tous les joueurs. Celles de config.lua se modifient dans le fichier.';
  const SITES_HINT = 'Les sous-domaines sont inclus : exemple.com autorise aussi www.exemple.com.';
  function render() {
    const box = $('ad-apps'); box.textContent = '';
    const add = h('button', 'st-row st-action ad-add');
    add.append(svg('ic-plus'), h('span', 'grow', 'Ajouter une application'));
    add.onclick = () => openEditor(null);
    box.append(add);
    if (!st) { box.append(h('div', 'st-row muted', 'Chargement…')); return; }
    st.apps.forEach((x) => {
      const a = H().byId(x.id);
      if (!a) return;
      const row = h(x.fixed ? 'div' : 'button', 'st-row ad-app' + (x.fixed ? ' fixed' : ''));
      const ic = H().iconEl(a.id); ic.classList.add('ic-sm');
      const tx = h('span', 'grow');
      tx.append(h('b', null, a.label), h('small', null, [hostOf(a.url), a.category].filter(Boolean).join(' · ')));
      row.append(ic, tx);
      if (x.fixed) row.append(h('span', 'ad-tag', 'config.lua'));
      else { row.append(svg('ic-chev-r')); row.lastChild.classList.add('st-chev'); row.onclick = () => openEditor(a.id); }
      box.append(row);
    });

    const chips = $('ad-sites'); chips.textContent = '';
    if (!st.sites.length) chips.append(h('span', 'muted', 'Aucun site autorisé.'));
    st.sites.forEach((s) => {
      const c = h('div', 'chip' + (s.fixed ? ' fixed' : ''));
      c.append(h('span', null, s.host));
      if (s.fixed) c.append(h('small', null, 'config'));
      else {
        const x = h('span', 'x', '×'); x.title = 'Retirer'; x.setAttribute('role', 'button');
        x.onclick = () => delSite(s.host);
        c.append(x);
      }
      chips.append(c);
    });
    if (!st.restrict && !$('ad-sites-msg').textContent) msg('ad-sites-msg', 'Liste blanche désactivée (Config.Browser.restrictToAllowed = false) : tous les sites s\'ouvrent.');
  }

  function load() {
    if (!st) render();
    msg('ad-apps-msg', APPS_HINT); msg('ad-sites-msg', SITES_HINT);
    call('state').then((r) => { if (!accept(r)) msg('ad-apps-msg', errText(r), 'bad'); });
  }
  $('st-admin-row').addEventListener('click', load);

  function addSite() {
    const v = $('ad-host').value.trim();
    if (!v || busy) return;
    busy = true;
    call('addSite', { host: v }).then((r) => {
      busy = false;
      if (!accept(r)) { msg('ad-sites-msg', errText(r), 'bad'); return; }
      $('ad-host').value = ''; $('ad-host').blur();
      msg('ad-sites-msg', r.host + ' est autorisé.', 'good');
    });
  }
  $('ad-host-add').onclick = addSite;
  $('ad-host').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addSite(); } });

  function delSite(host) {
    if (busy) return;
    busy = true;
    call('delSite', { host }).then((r) => {
      busy = false;
      if (!accept(r)) { msg('ad-sites-msg', errText(r), 'bad'); return; }
      msg('ad-sites-msg', host + ' n\'est plus autorisé.', 'good');
    });
  }

  /* ---------- Fiche d'une app (ajout / modification) ---------- */
  const F = { label: $('ap-label'), subtitle: $('ap-subtitle'), category: $('ap-category'), url: $('ap-url'), image: $('ap-image'), icon: $('ap-icon-name'), description: $('ap-desc') };
  const colorBox = $('ap-colors');
  COLORS.forEach((c) => {
    const b = h('button', 'ap-color'); b.style.background = c; b.dataset.c = c; b.setAttribute('aria-label', 'Couleur ' + c);
    b.onclick = () => { color = c; paintColors(); preview(); };
    colorBox.append(b);
  });
  function paintColors() { colorBox.querySelectorAll('.ap-color').forEach((b) => b.classList.toggle('on', b.dataset.c === color)); }

  function initials(label) {
    const w = label.split(/[\s.-]+/).filter(Boolean);
    if (!w.length) return '?';
    return w.length === 1 ? Array.from(w[0]).slice(0, 2).join('') : (Array.from(w[0])[0] + Array.from(w[1])[0]).toUpperCase();
  }
  // apercu de l'icone : meme rendu que l'accueil
  let prevTimer = null;
  function preview() {
    const label = F.label.value.trim() || 'Nom';
    const img = F.image.value.trim();
    const icon = F.icon.value.trim().toLowerCase();
    const el = H().iconEl({ id: '_preview', web: true, label, glyph: initials(label), color,
      icon: /^[a-z0-9-]{1,48}$/.test(icon) ? icon : null, image: okHttps(img) ? img : null });
    el.id = 'ap-icon';
    $('ap-icon').replaceWith(el);
    $('ap-prev-label').textContent = label;
  }
  const schedulePreview = () => { clearTimeout(prevTimer); prevTimer = setTimeout(preview, 250); };
  [F.label, F.image, F.icon].forEach((i) => i.addEventListener('input', schedulePreview));
  F.image.addEventListener('change', () => {
    const v = F.image.value.trim();
    msg('ap-image-msg', v && !okHttps(v) ? ERR.image : 'Lien direct vers une image carrée (https). Sans image : initiales sur la couleur choisie.', v && !okHttps(v) ? 'bad' : '');
  });

  let delArmed = false, delTimer = null;
  function openEditor(id) {
    const a = id ? H().byId(id) : null;
    editId = a ? a.id : null;
    $('ap-title').textContent = a ? a.label : 'Nouvelle app';
    F.label.value = a ? a.label : '';
    F.subtitle.value = a ? a.subtitle || '' : '';
    F.category.value = a && a.category !== 'App web' ? a.category || '' : '';
    F.url.value = a ? a.url : 'https://';
    F.image.value = a && a.image && /^https:/i.test(a.image) ? a.image : '';
    F.icon.value = a && a.icon ? a.icon : '';
    F.description.value = a ? a.description || '' : '';
    color = a && a.color ? a.color : COLORS[0];
    paintColors(); preview();
    msg('ap-err', '');
    msg('ap-image-msg', 'Lien direct vers une image carrée (https). Sans image : initiales sur la couleur choisie.');
    delArmed = false; clearTimeout(delTimer);
    $('ap-del').textContent = "Supprimer l'app";
    $('ap-del').classList.toggle('hidden', !editId);
    const page = $('sp-app'); page.scrollTop = 0;
    stGo('sp-app');
  }

  $('ap-save').onclick = () => {
    if (busy) return;
    const p = { id: editId };
    Object.keys(F).forEach((k) => { p[k] = F[k].value.trim(); });
    p.color = color;
    if (p.label.length < 2) { msg('ap-err', ERR.label); F.label.focus(); return; }
    if (!okHttps(p.url) || !hostOf(p.url)) { msg('ap-err', ERR.url); F.url.focus(); return; }
    if (p.image && !okHttps(p.image)) { msg('ap-err', ERR.image); F.image.focus(); return; }
    busy = true; msg('ap-err', '');
    call('saveApp', p).then((r) => {
      busy = false;
      if (!accept(r)) { msg('ap-err', errText(r)); return; }
      const name = p.label;
      stBack();
      msg('ad-apps-msg', (editId ? name + ' est modifiée.' : name + ' est ajoutée à App.') + (r.addedSite ? ' Site autorisé : ' + r.addedSite + '.' : ''), 'good');
    });
  };

  $('ap-del').onclick = () => {
    if (!editId || busy) return;
    const b = $('ap-del');
    if (!delArmed) {
      delArmed = true; b.textContent = 'Confirmer la suppression';
      delTimer = setTimeout(() => { delArmed = false; b.textContent = "Supprimer l'app"; }, 3500);
      return;
    }
    clearTimeout(delTimer); delArmed = false;
    busy = true;
    const name = F.label.value.trim() || editId;
    call('delApp', { id: editId }).then((r) => {
      busy = false;
      if (!accept(r)) { msg('ap-err', errText(r)); return; }
      stBack();
      msg('ad-apps-msg', name + ' est supprimée de App.', 'good');
    });
  };

  window.RZAdmin = {
    // un admin (peut-etre un autre) a change la liste : on recharge si la page est ouverte
    refresh() { if (RZ().isStaff() && $('sp-admin').classList.contains('open')) call('state').then(accept); },
  };
})();
