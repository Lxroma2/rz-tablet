/* Ecran d'accueil : icones, grille d'apps, dock, widgets (calendrier, horloge).
   Le catalogue sert aussi a l'app "App" (store.js) : apps integrees + apps web du serveur (Config.Store).
   Appui long sur une icone : mode edition (les icones tremblent), on les deplace entre la grille et le dock,
   le "-" supprime l'app. La disposition est gardee sur ce poste (rztab_layout). */
(() => {
  const $ = (id) => document.getElementById(id);
  const RZ = () => window.RZ;
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  /* ---------- Icones : Phosphor Duotone (MIT, html/assets/icons/) en blanc sur degrade, reflet en CSS ----------
     Les apps integrees ont leur pictogramme ici ; les apps web choisissent le leur par son nom
     (Config.Store icon = 'house-line', liste sur phosphoricons.com), charge depuis assets/icons/duotone.json. */
  const svgOf = (inner) => '<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">' + inner + '</svg>';
  const GLYPH = {
    settings: svgOf("<path d=\"M230.1,108.76,198.25,90.62c-.64-1.16-1.31-2.29-2-3.41l-.12-36A104.61,104.61,0,0,0,162,32L130,49.89c-1.34,0-2.69,0-4,0L94,32A104.58,104.58,0,0,0,59.89,51.25l-.16,36c-.7,1.12-1.37,2.26-2,3.41l-31.84,18.1a99.15,99.15,0,0,0,0,38.46l31.85,18.14c.64,1.16,1.31,2.29,2,3.41l.12,36A104.61,104.61,0,0,0,94,224l32-17.87c1.34,0,2.69,0,4,0L162,224a104.58,104.58,0,0,0,34.08-19.25l.16-36c.7-1.12,1.37-2.26,2-3.41l31.84-18.1A99.15,99.15,0,0,0,230.1,108.76ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z\" opacity=\"0.2\"/><path d=\"M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm109.94-52.79a8,8,0,0,0-3.89-5.4l-29.83-17-.12-33.62a8,8,0,0,0-2.83-6.08,111.91,111.91,0,0,0-36.72-20.67,8,8,0,0,0-6.46.59L128,41.85,97.88,25a8,8,0,0,0-6.47-.6A111.92,111.92,0,0,0,54.73,45.15a8,8,0,0,0-2.83,6.07l-.15,33.65-29.83,17a8,8,0,0,0-3.89,5.4,106.47,106.47,0,0,0,0,41.56,8,8,0,0,0,3.89,5.4l29.83,17,.12,33.63a8,8,0,0,0,2.83,6.08,111.91,111.91,0,0,0,36.72,20.67,8,8,0,0,0,6.46-.59L128,214.15,158.12,231a7.91,7.91,0,0,0,3.9,1,8.09,8.09,0,0,0,2.57-.42,112.1,112.1,0,0,0,36.68-20.73,8,8,0,0,0,2.83-6.07l.15-33.65,29.83-17a8,8,0,0,0,3.89-5.4A106.47,106.47,0,0,0,237.94,107.21Zm-15,34.91-28.57,16.25a8,8,0,0,0-3,3c-.58,1-1.19,2.06-1.81,3.06a7.94,7.94,0,0,0-1.22,4.21l-.15,32.25a95.89,95.89,0,0,1-25.37,14.3L134,199.13a8,8,0,0,0-3.91-1h-.19c-1.21,0-2.43,0-3.64,0a8.1,8.1,0,0,0-4.1,1l-28.84,16.1A96,96,0,0,1,67.88,201l-.11-32.2a8,8,0,0,0-1.22-4.22c-.62-1-1.23-2-1.8-3.06a8.09,8.09,0,0,0-3-3.06l-28.6-16.29a90.49,90.49,0,0,1,0-28.26L61.67,97.63a8,8,0,0,0,3-3c.58-1,1.19-2.06,1.81-3.06a7.94,7.94,0,0,0,1.22-4.21l.15-32.25a95.89,95.89,0,0,1,25.37-14.3L122,56.87a8,8,0,0,0,4.1,1c1.21,0,2.43,0,3.64,0a8,8,0,0,0,4.1-1l28.84-16.1A96,96,0,0,1,188.12,55l.11,32.2a8,8,0,0,0,1.22,4.22c.62,1,1.23,2,1.8,3.06a8.09,8.09,0,0,0,3,3.06l28.6,16.29A90.49,90.49,0,0,1,222.9,142.12Z\"/>"),   // gear-six
    browser: svgOf("<path d=\"M128,32a96,96,0,1,0,96,96A96,96,0,0,0,128,32Zm16,112L80,176l32-64,64-32Z\" opacity=\"0.2\"/><path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM172.42,72.84l-64,32a8.05,8.05,0,0,0-3.58,3.58l-32,64A8,8,0,0,0,80,184a8.1,8.1,0,0,0,3.58-.84l64-32a8.05,8.05,0,0,0,3.58-3.58l32-64a8,8,0,0,0-10.74-10.74ZM138,138,97.89,158.11,118,118l40.15-20.07Z\"/>"),   // compass
    services: svgOf("<path d=\"M224,118.31V200a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V118.31h0A191.14,191.14,0,0,0,128,144,191.08,191.08,0,0,0,224,118.31Z\" opacity=\"0.2\"/><path d=\"M104,112a8,8,0,0,1,8-8h32a8,8,0,0,1,0,16H112A8,8,0,0,1,104,112ZM232,72V200a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V72A16,16,0,0,1,40,56H80V48a24,24,0,0,1,24-24h48a24,24,0,0,1,24,24v8h40A16,16,0,0,1,232,72ZM96,56h64V48a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8ZM40,72v41.62A184.07,184.07,0,0,0,128,136a184,184,0,0,0,88-22.39V72ZM216,200V131.63A200.25,200.25,0,0,1,128,152a200.19,200.19,0,0,1-88-20.36V200H216Z\"/>"),   // briefcase
    store: svgOf("<path d=\"M112,56v48a8,8,0,0,1-8,8H56a8,8,0,0,1-8-8V56a8,8,0,0,1,8-8h48A8,8,0,0,1,112,56Zm88-8H152a8,8,0,0,0-8,8v48a8,8,0,0,0,8,8h48a8,8,0,0,0,8-8V56A8,8,0,0,0,200,48Zm-96,96H56a8,8,0,0,0-8,8v48a8,8,0,0,0,8,8h48a8,8,0,0,0,8-8V152A8,8,0,0,0,104,144Zm96,0H152a8,8,0,0,0-8,8v48a8,8,0,0,0,8,8h48a8,8,0,0,0,8-8V152A8,8,0,0,0,200,144Z\" opacity=\"0.2\"/><path d=\"M200,136H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48v48ZM104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48v48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48v48Z\"/>"),   // squares-four
    notes: svgOf("<path d=\"M200,88l-72,72H96V128l72-72Z\" opacity=\"0.2\"/><path d=\"M229.66,58.34l-32-32a8,8,0,0,0-11.32,0l-96,96A8,8,0,0,0,88,128v32a8,8,0,0,0,8,8h32a8,8,0,0,0,5.66-2.34l96-96A8,8,0,0,0,229.66,58.34ZM124.69,152H104V131.31l64-64L188.69,88ZM200,76.69,179.31,56,192,43.31,212.69,64ZM224,128v80a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32h80a8,8,0,0,1,0,16H48V208H208V128a8,8,0,0,1,16,0Z\"/>"),   // note-pencil
    calculator: svgOf("<path d=\"M176,64v48H80V64Z\" opacity=\"0.2\"/><path d=\"M80,120h96a8,8,0,0,0,8-8V64a8,8,0,0,0-8-8H80a8,8,0,0,0-8,8v48A8,8,0,0,0,80,120Zm8-48h80v32H88ZM200,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V40A16,16,0,0,0,200,24Zm0,192H56V40H200ZM100,148a12,12,0,1,1-12-12A12,12,0,0,1,100,148Zm40,0a12,12,0,1,1-12-12A12,12,0,0,1,140,148Zm40,0a12,12,0,1,1-12-12A12,12,0,0,1,180,148Zm-80,40a12,12,0,1,1-12-12A12,12,0,0,1,100,188Zm40,0a12,12,0,1,1-12-12A12,12,0,0,1,140,188Zm40,0a12,12,0,1,1-12-12A12,12,0,0,1,180,188Z\"/>"),   // calculator
    maps: svgOf("<path d=\"M160,72V216L96,184V40Z\" opacity=\"0.2\"/><path d=\"M228.92,49.69a8,8,0,0,0-6.86-1.45L160.93,63.52,99.58,32.84a8,8,0,0,0-5.52-.6l-64,16A8,8,0,0,0,24,56V200a8,8,0,0,0,9.94,7.76l61.13-15.28,61.35,30.68A8.15,8.15,0,0,0,160,224a8,8,0,0,0,1.94-.24l64-16A8,8,0,0,0,232,200V56A8,8,0,0,0,228.92,49.69ZM104,52.94l48,24V203.06l-48-24ZM40,62.25l48-12v127.5l-48,12Zm176,131.5-48,12V78.25l48-12Z\"/>"),   // map-trifold
    vehicles: svgOf("<path d=\"M184,176h40v24a8,8,0,0,1-8,8H192a8,8,0,0,1-8-8ZM32,200a8,8,0,0,0,8,8H64a8,8,0,0,0,8-8V176H32ZM194.11,44.75A8,8,0,0,0,186.8,40H69.2a8,8,0,0,0-7.31,4.75L32,112H224Z\" opacity=\"0.2\"/><path d=\"M240,104H229.2L201.42,41.5A16,16,0,0,0,186.8,32H69.2a16,16,0,0,0-14.62,9.5L26.8,104H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16V184h96v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V120h8a8,8,0,0,0,0-16ZM69.2,48H186.8l24.89,56H44.31ZM64,200H40V184H64Zm128,0V184h24v16Zm24-32H40V120H216ZM56,144a8,8,0,0,1,8-8H80a8,8,0,0,1,0,16H64A8,8,0,0,1,56,144Zm112,0a8,8,0,0,1,8-8h16a8,8,0,0,1,0,16H176A8,8,0,0,1,168,144Z\"/>"),   // car
    bank: svgOf("<path d=\"M232,96H24L128,32Z\" opacity=\"0.2\"/><path d=\"M24,104H48v64H32a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16H208V104h24a8,8,0,0,0,4.19-14.81l-104-64a8,8,0,0,0-8.38,0l-104,64A8,8,0,0,0,24,104Zm40,0H96v64H64Zm80,0v64H112V104Zm48,64H160V104h32ZM128,41.39,203.74,88H52.26ZM248,208a8,8,0,0,1-8,8H16a8,8,0,0,1,0-16H240A8,8,0,0,1,248,208Z\"/>"),   // bank
  };
  let phSet = null, phLoading = null;
  function loadPh() {
    if (!phLoading) {
      phLoading = fetch('assets/icons/duotone.json').then((r) => r.json())
        .then((j) => { phSet = j; fillPending(); })
        .catch(() => { phLoading = null; });
    }
    return phLoading;
  }
  // icones creees avant le chargement du pack (accueil, App, notifications) : on les complete
  function fillPending() {
    document.querySelectorAll('.icon[data-ph]').forEach((el) => {
      const name = phSet && el.dataset.ph.split(' ').find((n) => phSet[n]);
      const inner = name && phSet[name];
      el.removeAttribute('data-ph');
      if (!inner || el.classList.contains('has-img')) return;
      el.querySelectorAll('.icon-glyph, svg').forEach((x) => x.remove());
      el.insertAdjacentHTML('afterbegin', svgOf(inner));
    });
  }

  const BUILTIN = [
    { id: 'settings', label: 'Réglages', system: true, subtitle: 'Personnalise ta tablette', category: 'Utilitaires',
      description: 'Fond d\'écran, verrouillage, notifications, navigateur et contrôles.' },
    { id: 'store', label: 'App', system: true, subtitle: 'Toutes les apps de la tablette', category: 'Utilitaires',
      description: 'Découvre, installe et supprime les apps de ta tablette.' },
    { id: 'browser', label: 'Navigateur', subtitle: 'Les sites de la ville', category: 'Productivité',
      description: 'Onglets, favoris et zoom. Ouvre les sites autorisés sur le serveur.' },
    { id: 'services', label: 'Services', subtitle: 'Contacte les entreprises', category: 'Social',
      description: 'L\'annuaire des entreprises : qui est ouvert, leurs sites, et une messagerie avec position partagée.' },
    { id: 'notes', label: 'Notes', subtitle: 'Tes notes, gardées dans la tablette', category: 'Productivité',
      description: 'Écris, retrouve et supprime tes notes. Elles restent dans la tablette : si tu la donnes, ses notes partent avec.' },
    { id: 'calculator', label: 'Calculatrice', subtitle: 'Les quatre opérations, au doigt ou au clavier', category: 'Utilitaires',
      description: 'Une calculatrice simple : opérations, pourcentages, changement de signe. Le clavier du PC marche aussi.' },
    { id: 'maps', label: 'Carte', subtitle: 'Toute la ville, ta position et le GPS', category: 'Navigation',
      description: 'La carte de Los Santos et du comté de Blaine : ta position en direct, les entreprises, et un itinéraire GPS en un clic.' },
    { id: 'vehicles', label: 'Véhicules', subtitle: 'Carte grise et localisation', category: 'Navigation',
      description: 'Tes véhicules et ceux de ton entreprise : carte grise, état, et leur position sur la carte selon ton grade.' },
    { id: 'bank', label: 'Banque', subtitle: 'Ton solde et tes opérations', category: 'Finance',
      description: 'Le solde de ton compte et l\'historique de tes entrées et sorties, jour par jour.' },
  ];
  const DOCK_MAX = 6;

  /* ---------- Apps web envoyees par le serveur ---------- */
  let web = [];
  const okUrl = (u) => typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(u);
  const okColor = (c) => typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c);
  const okPh = (n) => typeof n === 'string' && /^[a-z0-9-]{1,48}$/.test(n);
  // image : lien https, ou fichier de html/assets/icons/ (ex. 'Apps.jpg')
  const imgSrc = (v) => okUrl(v) ? v : (typeof v === 'string' && /^[a-z0-9_-]{1,48}\.(png|jpe?g|webp)$/i.test(v) ? 'assets/icons/' + v : null);

  /* ---------- Icones choisies par le serveur (Config.AppIcons) ----------
     id -> 'https://...png' | 'fichier.png' | 'nom-phosphor' | { image, icon, color } */
  let skins = {};
  function setSkins(o) {
    skins = {};
    if (!o || typeof o !== 'object' || Array.isArray(o)) return;
    Object.keys(o).forEach((k) => {
      const id = String(k).toLowerCase();
      if (!/^[a-z0-9_-]{1,32}$/.test(id)) return;
      let v = o[k];
      if (typeof v === 'string') v = imgSrc(v) ? { image: v } : { icon: v };
      if (!v || typeof v !== 'object') return;
      const s = {};
      if (imgSrc(v.image)) s.image = imgSrc(v.image);
      if (okPh(v.icon)) s.icon = v.icon;
      if (okColor(v.color)) s.color = v.color;
      if (Object.keys(s).length) skins[id] = s;
    });
  }

  function config(list, icons) {
    setSkins(icons);
    web = (Array.isArray(list) ? list : []).map((a) => {
      if (!a || typeof a !== 'object') return null;
      const id = String(a.id || '').toLowerCase();
      if (!/^[a-z0-9_-]{1,32}$/.test(id) || BUILTIN.some((b) => b.id === id) || !okUrl(a.url)) return null;
      return {
        id, web: true, url: a.url,
        label: String(a.label || id).slice(0, 24),
        subtitle: String(a.subtitle || '').slice(0, 60),
        category: String(a.category || 'App web').slice(0, 24),
        description: String(a.description || '').slice(0, 600),
        color: okColor(a.color) ? a.color : '#3a3a3c',
        glyph: String(a.glyph || a.label || id).slice(0, 3),
        icon: okPh(a.icon) ? a.icon : null,
        image: imgSrc(a.image),
      };
    }).filter(Boolean);
    render();
  }
  const catalog = () => BUILTIN.concat(web);
  const byId = (id) => catalog().find((a) => a.id === id);

  /* ---------- Apps installees (sur ce poste) ---------- */
  const KEY = 'rztab_apps';
  let installed = (() => { try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : null; } catch (e) { return null; } })()
    || BUILTIN.filter((b) => !b.system).map((b) => b.id);
  const saveInstalled = () => { try { localStorage.setItem(KEY, JSON.stringify(installed)); } catch (e) {} };
  // nouvelles apps integrees (ajoutees par une mise a jour) : installees une fois, ensuite le joueur decide
  (() => {
    const KKEY = 'rztab_known';
    let known = null;
    try { known = JSON.parse(localStorage.getItem(KKEY)); } catch (e) {}
    if (!Array.isArray(known)) known = ['settings', 'store', 'browser', 'services'];
    BUILTIN.forEach((b) => { if (!b.system && !known.includes(b.id) && !installed.includes(b.id)) installed.push(b.id); });
    saveInstalled();
    try { localStorage.setItem(KKEY, JSON.stringify(BUILTIN.map((b) => b.id))); } catch (e) {}
  })();
  const isInstalled = (id) => { const a = byId(id); return !!a && (a.system || installed.includes(id)); };

  // disposition : ordre de la grille et du dock. Les ids inconnus (apps web pas encore recues) sont gardes.
  const LKEY = 'rztab_layout';
  let layout = (() => { try { const v = JSON.parse(localStorage.getItem(LKEY)); return v && Array.isArray(v.grid) && Array.isArray(v.dock) ? v : null; } catch (e) { return null; } })()
    || { grid: ['settings', 'store'], dock: ['services', 'browser'] };
  const saveLayout = () => { try { localStorage.setItem(LKEY, JSON.stringify(layout)); } catch (e) {} };
  function placed() {
    const vis = catalog().filter((a) => a.system || installed.includes(a.id)).map((a) => a.id);
    const seen = new Set();
    const pick = (arr) => arr.filter((id) => vis.includes(id) && !seen.has(id) && seen.add(id));
    const dock = pick(layout.dock).slice(0, DOCK_MAX), grid = pick(layout.grid);
    vis.forEach((id) => { if (!seen.has(id)) grid.push(id); });
    return { grid, dock };
  }

  function install(id) {
    if (!installed.includes(id)) { installed.push(id); saveInstalled(); }
    if (!layout.grid.includes(id) && !layout.dock.includes(id)) { layout.grid.push(id); saveLayout(); }
    render();
  }
  function uninstall(id) {
    const a = byId(id); if (!a || a.system) return;
    installed = installed.filter((x) => x !== id); saveInstalled();
    layout.grid = layout.grid.filter((x) => x !== id); layout.dock = layout.dock.filter((x) => x !== id); saveLayout();
    if (a.web && RZ() && RZ().closeApp) RZ().closeApp(id);
    render();
  }

  /* ---------- Element d'icone ---------- */
  // Config.AppIcons passe avant les reglages de l'app (Config.Store pour les apps web, GLYPH pour les integrees)
  function iconEl(id) {
    const a = byId(id);
    const el = h('span', 'icon');
    if (!a) { el.classList.add('i-system'); el.innerHTML = GLYPH.settings; return el; }
    const s = skins[a.id] || {};
    const color = s.color || (a.web ? a.color : null);
    // noms a essayer dans l'ordre : celui de Config.AppIcons, puis celui de l'app web (si le premier n'existe pas)
    const names = [s.icon, a.web ? a.icon : null].filter(Boolean);
    const icon = phSet ? names.find((n) => phSet[n]) : names.join(' ');
    const image = s.image || (a.web ? a.image : null);
    el.classList.add(a.web ? 'i-web' : 'i-' + a.id);
    if (color) {
      el.style.background = color;   // si color-mix n'est pas supporte, la ligne suivante est ignoree
      el.style.background = 'linear-gradient(180deg, color-mix(in srgb, ' + color + ' 78%, #fff), ' + color + ')';
    }
    // pictogramme de base : celui de l'app integree, ou les lettres de l'app web
    const base = () => { if (GLYPH[a.id]) el.innerHTML = GLYPH[a.id]; else el.append(h('b', 'icon-glyph', a.glyph || a.label.slice(0, 2))); };
    if (icon && phSet && phSet[icon]) el.insertAdjacentHTML('afterbegin', svgOf(phSet[icon]));
    else {
      base();                                           // en attendant le pack (ou si le nom est inconnu)
      if (icon) { el.dataset.ph = icon; loadPh(); }
    }
    if (image) {
      const im = new Image(); im.alt = ''; im.referrerPolicy = 'no-referrer'; im.draggable = false;
      im.onload = () => { el.querySelectorAll('.icon-glyph, svg, img').forEach((x) => x.remove()); el.prepend(im); el.classList.add('has-img'); };
      im.src = image;
    }
    return el;
  }

  /* ---------- Ouverture : la vue grandit depuis l'icone touchee ---------- */
  function open(id, from) {
    const a = byId(id); if (!a) return;
    if (a.web) RZ().openApp(a); else RZ().showView(a.id);
    if (from) launch(a.web ? 'browser' : a.id, from.getBoundingClientRect());
  }
  function launch(viewId, rect) {
    const v = $(viewId); if (!v) return;
    const r = v.getBoundingClientRect();
    v.style.setProperty('--ox', Math.round(rect.left + rect.width / 2 - r.left) + 'px');
    v.style.setProperty('--oy', Math.round(rect.top + rect.height / 2 - r.top) + 'px');
    v.classList.remove('launch'); void v.offsetWidth; v.classList.add('launch');
    setTimeout(() => v.classList.remove('launch'), 480);
  }

  function appButton(a, i) {
    const b = h('button', 'app');
    b.dataset.app = a.id;
    b.style.setProperty('--i', i);
    b.title = a.label;
    const ic = iconEl(a.id);
    if (!a.system) {
      const del = h('span', 'app-del');
      del.setAttribute('role', 'button'); del.setAttribute('aria-label', 'Supprimer ' + a.label);
      del.onclick = (e) => { e.stopPropagation(); askRemove(a, b); };
      ic.append(del);
    }
    b.append(ic, h('span', 'app-label', a.label));
    b.onclick = () => { if (!editing) open(a.id, ic); };
    return b;
  }

  let lastCounts = {};
  function render() {
    const grid = $('home-apps'), dock = $('dock');
    grid.textContent = ''; dock.textContent = '';
    const p = placed();
    p.grid.forEach((id, i) => grid.append(appButton(byId(id), i)));
    p.dock.forEach((id, i) => dock.append(appButton(byId(id), i)));
    dock.classList.toggle('empty', !p.dock.length);
    badges(lastCounts);
  }
  // apres un deplacement : l'ordre affiche devient la disposition (les ids inconnus restent a la fin)
  function saveFromDom() {
    const ids = (el) => [...el.querySelectorAll(':scope > .app')].map((b) => b.dataset.app);
    const dock = ids($('dock')), grid = ids($('home-apps'));
    const known = new Set(catalog().map((a) => a.id));
    layout = { grid: grid.concat(layout.grid.filter((id) => !known.has(id))), dock };
    saveLayout();
    $('dock').classList.toggle('empty', !dock.length);
  }

  function badges(counts) {
    lastCounts = counts || {};
    document.querySelectorAll('#home .app').forEach((b) => {
      const n = lastCounts[b.dataset.app] || 0;
      let bd = b.querySelector('.badge');
      if (!n) { if (bd) bd.remove(); return; }
      if (!bd) { bd = h('span', 'badge'); b.querySelector('.icon').append(bd); }
      bd.textContent = n > 99 ? '99+' : String(n);
    });
  }

  /* ---------- Mode edition (appui long) ---------- */
  const homeEl = $('home'), gridEl = $('home-apps'), dockEl = $('dock');
  let editing = false;
  const done = h('button', 'home-done', 'OK');
  done.onclick = (e) => { e.stopPropagation(); stopEdit(); };
  homeEl.append(done);
  function startEdit() {
    if (editing) return;
    editing = true; homeEl.classList.add('editing');
    const wc = $('home-widgets'); if (wc) wc.scrollTop = 0;
  }
  function stopEdit() {
    if (!editing) return;
    editing = false; homeEl.classList.remove('editing');
    closeAlert();
    if (window.RZWidgets) RZWidgets.closeGallery();
  }
  // un clic dans le vide ou Echap termine l'edition (Echap ne ferme alors pas la tablette)
  homeEl.addEventListener('click', (e) => { if (editing && !e.target.closest('.app, .home-done, .home-alert, .home-add')) stopEdit(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && editing) { e.preventDefault(); e.stopImmediatePropagation(); if (alertEl) closeAlert(); else stopEdit(); }
  }, true);

  let press = null;
  homeEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || press) return;
    const b = e.target.closest('.app');
    if (!b || e.target.closest('.app-del') || !(gridEl.contains(b) || dockEl.contains(b))) return;
    press = { b, id: e.pointerId, x: e.clientX, y: e.clientY, timer: null, drag: null };
    if (!editing) press.timer = setTimeout(() => { if (press) { press.timer = null; startEdit(); } }, 480);
  });
  homeEl.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.id) return;
    const dist = Math.hypot(e.clientX - press.x, e.clientY - press.y);
    if (press.timer) { if (dist > 8) { clearTimeout(press.timer); press = null; } return; }   // glissement, pas appui long
    if (!editing) return;
    if (!press.drag) { if (dist > 6) dragStart(e); else return; }
    dragMove(e);
  });
  const release = (e) => {
    if (!press || e.pointerId !== press.id) return;
    clearTimeout(press.timer);
    const p = press; press = null;
    if (p.drag) dragEnd(p);
  };
  homeEl.addEventListener('pointerup', release);
  homeEl.addEventListener('pointercancel', release);

  function dragStart(e) {
    const b = press.b, r = b.getBoundingClientRect();
    const ghost = b.cloneNode(true);
    ghost.classList.add('app-ghost');
    ghost.style.left = r.left + 'px'; ghost.style.top = r.top + 'px'; ghost.style.width = r.width + 'px';
    document.body.append(ghost);
    b.classList.add('placeholder');
    try { b.setPointerCapture(e.pointerId); } catch (err) { /* pointeur deja relache */ }
    press.drag = { ghost, r0: r };
  }
  function dragMove(e) {
    const d = press.drag, b = press.b;
    d.ghost.style.transform = 'translate(' + (e.clientX - press.x) + 'px, ' + (e.clientY - press.y) + 'px) scale(1.12)';
    // cible : le dock si on est a sa hauteur (et qu'il reste de la place), sinon la grille
    const dr = dockEl.getBoundingClientRect();
    const inDock = b.parentElement === dockEl;
    const dockCount = dockEl.querySelectorAll(':scope > .app').length - (inDock ? 1 : 0);
    const box = e.clientY > dr.top - 18 && dockCount < DOCK_MAX ? dockEl : gridEl;
    const others = [...box.querySelectorAll(':scope > .app')].filter((x) => x !== b);
    let ref = null;
    for (const x of others) {
      const r = x.getBoundingClientRect();
      const before = box === dockEl ? e.clientX < r.left + r.width / 2
        : e.clientY < r.top || (e.clientY <= r.bottom + 12 && e.clientX < r.left + r.width / 2);
      if (before) { ref = x; break; }
    }
    if (b.parentElement === box && (b.nextElementSibling === ref || (!ref && !b.nextElementSibling))) return;
    flip(() => box.insertBefore(b, ref));
    dockEl.classList.toggle('empty', !dockEl.querySelector(':scope > .app'));
  }
  // les autres icones glissent vers leur nouvelle place (FLIP)
  function flip(mutate) {
    const els = [...gridEl.children, ...dockEl.children];
    const before = new Map(els.map((x) => [x, x.getBoundingClientRect()]));
    mutate();
    els.forEach((x) => {
      if (x.classList.contains('placeholder')) return;
      const a = before.get(x), n = x.getBoundingClientRect();
      const dx = a.left - n.left, dy = a.top - n.top;
      if (dx || dy) x.animate([{ transform: 'translate(' + dx + 'px, ' + dy + 'px)' }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    });
  }
  function dragEnd(p) {
    const d = p.drag, b = p.b;
    const r = b.getBoundingClientRect();
    const tx = r.left + r.width / 2 - (d.r0.left + d.r0.width / 2), ty = r.top - d.r0.top;
    d.ghost.style.transition = 'transform 300ms cubic-bezier(.3, 1.22, .5, 1)';
    d.ghost.style.transform = 'translate(' + tx + 'px, ' + ty + 'px)';
    setTimeout(() => { d.ghost.remove(); b.classList.remove('placeholder'); }, 300);
    saveFromDom();
  }

  /* ---------- Suppression (bouton "-") ---------- */
  let alertEl = null;
  function closeAlert() {
    if (!alertEl) return;
    const el = alertEl; alertEl = null;
    el.classList.remove('open');
    setTimeout(() => el.remove(), 220);
  }
  function askRemove(a, btn) {
    closeAlert();
    const wrap = h('div', 'home-alert');
    const box = h('div', 'ha-box');
    const tx = h('div', 'ha-tx');
    tx.append(h('b', null, 'Supprimer « ' + a.label + ' » ?'),
      h('span', null, 'Elle sera retirée de l\'écran d\'accueil. Tu pourras la réinstaller depuis App.'));
    const row = h('div', 'ha-row');
    const no = h('button', null, 'Annuler'), yes = h('button', 'danger', 'Supprimer');
    no.onclick = (e) => { e.stopPropagation(); closeAlert(); };
    yes.onclick = (e) => {
      e.stopPropagation(); closeAlert();
      btn.classList.add('removing');
      setTimeout(() => {
        // les icones restantes glissent pour boucher le trou
        const before = new Map([...gridEl.children, ...dockEl.children].filter((x) => x !== btn)
          .map((x) => [x.dataset.app, x.getBoundingClientRect()]));
        uninstall(a.id);
        [...gridEl.children, ...dockEl.children].forEach((x) => {
          const r0 = before.get(x.dataset.app); if (!r0) return;
          const n = x.getBoundingClientRect(), dx = r0.left - n.left, dy = r0.top - n.top;
          if (dx || dy) x.animate([{ transform: 'translate(' + dx + 'px, ' + dy + 'px)' }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2, .8, .2, 1)' });
        });
      }, 200);
    };
    row.append(no, yes);
    box.append(tx, row);
    wrap.append(box);
    wrap.onclick = (e) => { e.stopPropagation(); if (e.target === wrap) closeAlert(); };
    homeEl.append(wrap);
    void wrap.offsetWidth; wrap.classList.add('open');
    alertEl = wrap;
  }

  /* ---------- Widgets ---------- */
  // cadran : graduations generees une fois
  const face = $('wg-face');
  (() => {
    const NS = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < 60; i++) {
      const l = document.createElementNS(NS, 'line');
      const big = i % 5 === 0;
      l.setAttribute('x1', '50'); l.setAttribute('x2', '50');
      l.setAttribute('y1', big ? '7' : '7.5'); l.setAttribute('y2', big ? '13' : '10');
      l.setAttribute('class', big ? 'tk big' : 'tk');
      l.setAttribute('transform', 'rotate(' + i * 6 + ' 50 50)');
      face.querySelector('.ticks').append(l);
    }
    [12, 3, 6, 9].forEach((n, k) => {
      const t = document.createElementNS(NS, 'text');
      const a = k * Math.PI / 2;
      t.setAttribute('x', String(50 + Math.sin(a) * 29)); t.setAttribute('y', String(50 - Math.cos(a) * 29 + 4.2));
      t.textContent = String(n);
      face.querySelector('.nums').append(t);
    });
  })();
  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
    return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
  }
  function tick(d) {
    d = d || new Date();
    $('wg-wd').textContent = d.toLocaleDateString('fr-FR', { weekday: 'long' });
    $('wg-day').textContent = String(d.getDate());
    $('wg-sub').textContent = 'Semaine ' + isoWeek(d);
    const s = d.getSeconds(), m = d.getMinutes() + s / 60, hr = (d.getHours() % 12) + m / 60;
    face.querySelector('.hh').setAttribute('transform', 'rotate(' + hr * 30 + ' 50 50)');
    face.querySelector('.mh').setAttribute('transform', 'rotate(' + m * 6 + ' 50 50)');
    face.querySelector('.sh').setAttribute('transform', 'rotate(' + s * 6 + ' 50 50)');
  }

  render();
  window.RZHome = { config, render, iconEl, isInstalled, install, uninstall, catalog, byId, open, badges, tick, stopEdit, startEdit, isEditing: () => editing };
})();
