/* Application Calculatrice, facon iOS : AC/C, +/-, %, quatre operations avec priorite (2 + 3 x 4 = 14).
   Le pave s'adapte a la taille de la fenetre. En paysage (fenetre plus large que haute), le mode
   scientifique s'affiche a gauche du pave, comme sur iPhone tourne : parentheses, memoire, puissances,
   racines, logarithmes, trigonometrie (degres ou radians), x!, pi, e, EE, Rand. Le bouton en haut a
   gauche repasse en mode standard (choix garde sur ce poste).
   Le clavier du PC marche aussi (chiffres, + - * / x ^ ( ), Entree ou =, virgule ou point, Retour arriere, C).
   Pendant que l'app est ouverte, le clavier va a la tablette et pas au jeu (pas de changement d'arme sur 1-9). */
(() => {
  const $ = (id) => document.getElementById(id);
  const RZ = () => window.RZ;
  const view = $('calculator'), disp = $('ca-disp'), expr = $('ca-expr'), pad = $('ca-pad'), screen = $('ca-screen');
  const modeBtn = $('ca-mode'), radInd = $('ca-rad');
  const SYM = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^', root: 'ʸ√', E: 'E' };
  const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3, root: 3, E: 3 };

  let wide = false;        // mode scientifique affiche
  let sciPref = (() => { try { return localStorage.getItem('rztab_calc_sci') !== '0'; } catch (e) { return true; } })();

  let toks = [];           // nombres et operateurs deja saisis : [12, '+', 3, '*']
  let stack = [];          // parentheses ouvertes : la saisie d'avant chaque "("
  let cur = '0';           // nombre affiche (texte, point decimal)
  let fresh = true;        // le prochain chiffre remplace cur
  let entered = false;     // cur est une valeur choisie (chiffre, resultat, constante) et pas un reste d'operation
  let done = false;        // on vient d'appuyer sur =
  let error = false;
  let mem = 0, second = false, rad = false;

  const sig = () => (wide ? 12 : 10);   // chiffres significatifs a l'ecran
  const round = (x) => Number(Number(x).toPrecision(12));
  const numText = (n) => String(Number(round(n).toPrecision(sig())));
  function fmt(s) {
    if (error) return 'Erreur';
    const n = Number(s);
    if (!isFinite(n)) return 'Erreur';
    const big = wide ? 1e16 : 1e15;
    if (/e/i.test(s) || Math.abs(n) >= big || (n !== 0 && Math.abs(n) < 1e-9)) return n.toExponential(wide ? 8 : 5).replace('.', ',').replace('e+', 'e');
    // en saisie : on garde la virgule et les zeros tapes
    const neg = s.startsWith('-'), raw = neg ? s.slice(1) : s;
    const [i, d] = raw.split('.');
    const int = Number(i || 0).toLocaleString('fr-FR');
    return (neg ? '−' : '') + int + (d != null ? ',' + d : '');
  }
  const pendingOp = () => !entered && toks.length > 0 && typeof toks[toks.length - 1] === 'string';

  /* ---------- Calcul ---------- */
  function apply(a, o, b) {
    switch (o) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? NaN : a / b;
      case '^': return Math.pow(a, b);
      case 'E': return a * Math.pow(10, b);
      case 'root':   // a ʸ√ b : racine b-ieme de a (racine impaire d'un negatif permise)
        if (b === 0) return NaN;
        if (a < 0 && Number.isInteger(b) && Math.abs(b % 2) === 1) return -Math.pow(-a, 1 / b);
        return Math.pow(a, 1 / b);
    }
    return NaN;
  }
  function evaluate(list) {
    // priorite : puissances et racines (de droite a gauche), puis x et ÷, puis + et −
    const a = list.slice();
    for (let i = a.length - 2; i >= 1; i -= 2) if (PREC[a[i]] === 3) a.splice(i - 1, 3, apply(a[i - 1], a[i], a[i + 1]));
    for (let i = 1; i < a.length; i += 2) if (PREC[a[i]] === 2) { a.splice(i - 1, 3, apply(a[i - 1], a[i], a[i + 1])); i -= 2; }
    let v = a[0];
    for (let i = 1; i < a.length; i += 2) v = apply(v, a[i], a[i + 1]);
    return round(v);
  }
  // resultat intermediaire affiche quand on tape un operateur : 3 + 4 x 5 x -> 20, 3 + 4 x 5 + -> 23
  function tail(part, o) {
    let i = part.length - 1;
    while (i >= 2 && PREC[part[i - 1]] >= PREC[o]) i -= 2;
    return evaluate(part.slice(i));
  }

  /* ---------- Affichage ---------- */
  const fmtList = (l) => l.map((t) => typeof t === 'number' ? fmt(numText(t)) : SYM[t]).join(' ');
  function render() {
    disp.textContent = fmt(cur);
    fitDisplay();
    const parts = [];
    stack.forEach((s) => { if (s.length) parts.push(fmtList(s)); parts.push('('); });
    if (toks.length) parts.push(fmtList(toks));
    expr.textContent = parts.join(' ') + (done ? ' =' : '');
    const pending = pendingOp() ? toks[toks.length - 1] : null;
    pad.querySelectorAll('[data-op]').forEach((b) => b.classList.toggle('on', b.dataset.op === pending));
    $('ca-ac').textContent = (cur !== '0' && !fresh) || error ? 'C' : 'AC';
    const mr = keyEls.mr; if (mr) mr.classList.toggle('mem', mem !== 0);
    const nd = keyEls['2nd']; if (nd) nd.classList.toggle('on', second);
    radInd.classList.toggle('hidden', !wide || !rad);
  }
  // l'affichage tient toujours sur une ligne : la police reduit avec la longueur
  let baseFont = 80;
  function fitDisplay() {
    disp.style.fontSize = baseFont + 'px';
    const avail = screen.clientWidth - 24;
    const w = disp.scrollWidth;
    if (avail > 0 && w > avail) disp.style.fontSize = Math.max(24, Math.floor(baseFont * avail / w)) + 'px';
  }

  /* ---------- Saisie ---------- */
  function newCalcIfDone() { if (done) { toks = []; stack = []; done = false; } }
  function digit(d) {
    if (error) clearAll();
    if (done) { newCalcIfDone(); fresh = true; }
    if (fresh) { cur = d === '.' ? '0.' : d; fresh = false; entered = true; render(); return; }
    if (d === '.') { if (!cur.includes('.')) cur += '.'; render(); return; }
    if (cur.replace(/[-.]/g, '').length >= (wide ? 16 : 9)) return;
    cur = cur === '0' ? d : cur === '-0' ? '-' + d : cur + d;
    render();
  }
  function op(o) {
    if (error) return;
    if (done) { toks = [Number(cur)]; done = false; }
    else if (pendingOp()) { toks[toks.length - 1] = o; render(); return; }   // change d'operateur
    else toks.push(Number(cur));
    toks.push(o);
    const part = toks.slice(0, -1);
    if (part.length > 1) { const v = tail(part, o); if (isFinite(v)) cur = numText(v); }
    fresh = true; entered = false;
    render();
  }
  function setValue(v) {
    if (!isFinite(v) || Number.isNaN(v)) { error = true; cur = '0'; }
    else cur = numText(Math.abs(v) < 1e-13 ? 0 : v);
    fresh = true; entered = true;
  }
  function openParen() {
    if (error) clearAll();
    if (stack.length >= 10) return;
    if (done) newCalcIfDone();
    else if (entered) toks.push(Number(cur), '*');         // 2 ( 3 + 4 ) -> 2 x (3 + 4)
    stack.push(toks); toks = [];
    cur = '0'; fresh = true; entered = false;
    render();
  }
  function closeParen(silent) {
    if (error || !stack.length || done) return;
    toks.push(Number(cur));
    const v = evaluate(toks);
    toks = stack.pop();
    setValue(v);
    if (!silent) render();
  }
  function equals() {
    if (error || done) return;
    while (stack.length && !error) closeParen(true);
    if (!error) {
      toks.push(Number(cur));                                // 5 + = -> 5 + 5 (le resultat partiel est repris)
      setValue(evaluate(toks));
    }
    done = true; fresh = true;
    render();
  }
  function clearAll() { toks = []; stack = []; cur = '0'; fresh = true; entered = false; done = false; error = false; render(); }
  function clear() {
    if (error || fresh || cur === '0') { clearAll(); return; }
    cur = '0'; fresh = true; entered = false; render();
  }
  function negate() {
    if (error) return;
    if (!entered && !done) { cur = '-0'; fresh = false; entered = true; render(); return; }
    cur = cur.startsWith('-') ? cur.slice(1) : '-' + cur;
    if (done) { toks = []; stack = []; done = false; fresh = false; }
    render();
  }
  function percent() {
    if (error) return;
    let v = Number(cur) / 100;
    const last = toks[toks.length - 1];
    // 200 + 10 % = 220 : le pourcentage porte sur le nombre d'avant
    if (!done && (last === '+' || last === '-') && toks.length >= 2) v = Number(evaluate(toks.slice(0, -1))) * Number(cur) / 100;
    cur = numText(v); fresh = false; entered = true;
    if (done) { toks = []; stack = []; done = false; }
    render();
  }
  function backspace() {
    if (error) { clearAll(); return; }
    if (fresh || done) return;
    cur = cur.length > 1 && cur !== '-0' ? cur.slice(0, -1) : '0';
    if (cur === '-') cur = '0';
    render();
  }
  // fonction d'une variable : s'applique au nombre affiche
  function unary(f) {
    if (error) return;
    const v = f(Number(cur));
    if (done) { toks = []; stack = []; done = false; }
    setValue(v);
    render();
  }
  function constant(v) {
    if (error) clearAll();
    if (done) newCalcIfDone();
    setValue(v);
    render();
  }

  /* ---------- Fonctions scientifiques ---------- */
  const toRad = (x) => rad ? x : x * Math.PI / 180;
  const fromRad = (x) => rad ? x : x * 180 / Math.PI;
  function fact(n) {
    if (n < 0 || !Number.isInteger(n) || n > 170) return NaN;
    let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
  }
  function tan(x) {
    if (!rad && Math.abs(((x % 180) + 180) % 180 - 90) < 1e-9) return NaN;   // tan 90° : pas de valeur
    return Math.tan(toRad(x));
  }
  const FN = {
    x2: (x) => x * x, x3: (x) => x * x * x,
    inv: (x) => x === 0 ? NaN : 1 / x,
    sqrt: (x) => x < 0 ? NaN : Math.sqrt(x), cbrt: (x) => Math.cbrt(x),
    ex: (x) => second ? Math.pow(2, x) : Math.exp(x),
    tenx: (x) => Math.pow(10, x),
    ln: (x) => x <= 0 ? NaN : (second ? Math.log2(x) : Math.log(x)),
    log: (x) => x <= 0 ? NaN : Math.log10(x),
    fact,
    sin: (x) => second ? (Math.abs(x) > 1 ? NaN : fromRad(Math.asin(x))) : Math.sin(toRad(x)),
    cos: (x) => second ? (Math.abs(x) > 1 ? NaN : fromRad(Math.acos(x))) : Math.cos(toRad(x)),
    tan: (x) => second ? fromRad(Math.atan(x)) : tan(x),
    sinh: (x) => second ? Math.asinh(x) : Math.sinh(x),
    cosh: (x) => second ? (x < 1 ? NaN : Math.acosh(x)) : Math.cosh(x),
    tanh: (x) => second ? (Math.abs(x) >= 1 ? NaN : Math.atanh(x)) : Math.tanh(x),
  };

  /* ---------- Pave ----------
     r, c = ligne et colonne dans le pave standard (4 colonnes) ; en paysage le pave standard passe
     dans les colonnes 7 a 10 et les touches scientifiques (sci) prennent les colonnes 1 a 6. */
  const sup = (b, s) => b + '<sup>' + s + '</sup>';
  const KEYS = [
    { k: 'ac', cls: 'fn', r: 1, c: 1 }, { k: '±', cls: 'fn', r: 1, c: 2 }, { k: '%', cls: 'fn', r: 1, c: 3 }, { k: '/', cls: 'op', r: 1, c: 4 },
    { k: '7', r: 2, c: 1 }, { k: '8', r: 2, c: 2 }, { k: '9', r: 2, c: 3 }, { k: '*', cls: 'op', r: 2, c: 4 },
    { k: '4', r: 3, c: 1 }, { k: '5', r: 3, c: 2 }, { k: '6', r: 3, c: 3 }, { k: '-', cls: 'op', r: 3, c: 4 },
    { k: '1', r: 4, c: 1 }, { k: '2', r: 4, c: 2 }, { k: '3', r: 4, c: 3 }, { k: '+', cls: 'op', r: 4, c: 4 },
    { k: '0', cls: 'zero', r: 5, c: 1, s: 2 }, { k: '.', r: 5, c: 3 }, { k: '=', cls: 'op eq', r: 5, c: 4 },

    { k: '(', sci: 1, r: 1, c: 1 }, { k: ')', sci: 1, r: 1, c: 2 },
    { k: 'mc', sci: 1, r: 1, c: 3, html: 'mc' }, { k: 'm+', sci: 1, r: 1, c: 4, html: 'm+' }, { k: 'm-', sci: 1, r: 1, c: 5, html: 'm−' }, { k: 'mr', sci: 1, r: 1, c: 6, html: 'mr' },
    { k: '2nd', sci: 1, r: 2, c: 1, html: sup('2', 'nd') }, { k: 'x2', sci: 1, r: 2, c: 2, html: sup('x', '2') }, { k: 'x3', sci: 1, r: 2, c: 3, html: sup('x', '3') },
    { k: '^', sci: 1, r: 2, c: 4, html: sup('x', 'y'), op: true }, { k: 'ex', sci: 1, r: 2, c: 5, html: sup('e', 'x'), html2: sup('2', 'x') }, { k: 'tenx', sci: 1, r: 2, c: 6, html: sup('10', 'x') },
    { k: 'inv', sci: 1, r: 3, c: 1, html: '<sup>1</sup>/x' }, { k: 'sqrt', sci: 1, r: 3, c: 2, html: '<sup>2</sup>√x' }, { k: 'cbrt', sci: 1, r: 3, c: 3, html: '<sup>3</sup>√x' },
    { k: 'root', sci: 1, r: 3, c: 4, html: '<sup>y</sup>√x', op: true }, { k: 'ln', sci: 1, r: 3, c: 5, html: 'ln', html2: 'log<sub>2</sub>' }, { k: 'log', sci: 1, r: 3, c: 6, html: 'log<sub>10</sub>' },
    { k: 'fact', sci: 1, r: 4, c: 1, html: 'x!' }, { k: 'sin', sci: 1, r: 4, c: 2, html: 'sin', html2: sup('sin', '−1') }, { k: 'cos', sci: 1, r: 4, c: 3, html: 'cos', html2: sup('cos', '−1') },
    { k: 'tan', sci: 1, r: 4, c: 4, html: 'tan', html2: sup('tan', '−1') }, { k: 'e', sci: 1, r: 4, c: 5, html: 'e' }, { k: 'E', sci: 1, r: 4, c: 6, html: 'EE', op: true },
    { k: 'rad', sci: 1, r: 5, c: 1, html: 'Rad' }, { k: 'sinh', sci: 1, r: 5, c: 2, html: 'sinh', html2: sup('sinh', '−1') }, { k: 'cosh', sci: 1, r: 5, c: 3, html: 'cosh', html2: sup('cosh', '−1') },
    { k: 'tanh', sci: 1, r: 5, c: 4, html: 'tanh', html2: sup('tanh', '−1') }, { k: 'pi', sci: 1, r: 5, c: 5, html: 'π' }, { k: 'rand', sci: 1, r: 5, c: 6, html: 'Rand' },
  ];
  const keyEls = {};
  function press(k) {
    if (k === 'ac') clear();
    else if (k === '±') negate();
    else if (k === '%') percent();
    else if (k === '=') equals();
    else if (k === '(') openParen();
    else if (k === ')') closeParen();
    else if (k === 'mc') { mem = 0; render(); }
    else if (k === 'm+' || k === 'm-') { if (!error) { mem = round(mem + (k === 'm+' ? 1 : -1) * Number(cur)); fresh = true; entered = true; render(); } }
    else if (k === 'mr') constant(mem);
    else if (k === '2nd') { second = !second; relabel(); render(); }
    else if (k === 'rad') { rad = !rad; relabel(); render(); }
    else if (k === 'pi') constant(Math.PI);
    else if (k === 'e') constant(Math.E);
    else if (k === 'rand') constant(Math.random());
    else if (FN[k]) unary(FN[k]);
    else if (SYM[k]) op(k);
    else digit(k);
  }
  function relabel() {
    KEYS.forEach((d) => {
      const b = keyEls[d.k];
      if (d.k === 'rad') b.textContent = rad ? 'Deg' : 'Rad';
      else if (d.html2) b.innerHTML = '<span>' + (second ? d.html2 : d.html) + '</span>';
    });
  }
  KEYS.forEach((d) => {
    const b = document.createElement('button');
    b.className = 'ca-key' + (d.cls ? ' ' + d.cls.split(' ').map((c) => 'ca-' + c).join(' ') : '') + (d.sci ? ' ca-sci' : '');
    if (d.k === 'ac') { b.id = 'ca-ac'; b.textContent = 'AC'; }
    else if (d.html) b.innerHTML = '<span>' + d.html + '</span>';   // un seul element : la touche est une grille
    else b.textContent = SYM[d.k] || (d.k === '.' ? ',' : d.k);
    if ((d.cls && d.cls.startsWith('op') && d.k !== '=') || d.op) b.dataset.op = d.k;
    b.style.gridRow = String(d.r);
    b.addEventListener('pointerdown', (e) => { if (e.button === 0) press(d.k); });   // reponse a l'appui
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') e.preventDefault(); });
    keyEls[d.k] = b;
    pad.append(b);
  });
  function place() {
    KEYS.forEach((d) => { keyEls[d.k].style.gridColumn = (d.sci ? d.c : wide ? d.c + 6 : d.c) + ' / span ' + (d.s || 1); });
  }
  function flash(k) { const b = keyEls[k]; if (!b) return; b.classList.add('lit'); setTimeout(() => b.classList.remove('lit'), 110); }

  let active = false;
  window.addEventListener('keydown', (e) => {
    if (!active || e.ctrlKey || e.altKey || e.metaKey) return;
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
    let k = e.key;
    if (k === 'x' || k === 'X') k = '*';
    if (k === ',') k = '.';
    if (/^[0-9.]$/.test(k)) { digit(k); flash(k); }
    else if (k === '+' || k === '-' || k === '*' || k === '/' || k === '^') { op(k); flash(k); }
    else if (k === '(' || k === ')') { press(k); flash(k); }
    else if (k === 'Enter' || k === '=') { equals(); flash('='); }
    else if (k === 'Backspace') backspace();
    else if (k === 'Delete' || k === 'c' || k === 'C') { clear(); flash('ac'); }
    else if (k === '%') { percent(); flash('%'); }
    else return;
    e.preventDefault();
  });

  // glisser sur l'affichage efface le dernier chiffre (geste iOS)
  let sx = null;
  disp.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  disp.addEventListener('pointerup', (e) => { if (sx != null && Math.abs(e.clientX - sx) > 30) backspace(); sx = null; });

  /* ---------- Mise en page : suit la taille de la fenetre ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function layout() {
    const W = view.clientWidth, H = view.clientHeight;
    if (!W || !H) return;
    const canSci = W >= 640 && W > H * 1.2;
    const next = canSci && sciPref;
    if (next !== wide) { wide = next; place(); }
    view.classList.toggle('wide', wide);
    modeBtn.classList.toggle('hidden', !canSci);
    modeBtn.textContent = wide ? 'Standard' : 'Scientifique';

    const cols = wide ? 10 : 4;
    const side = Math.round(clamp(W * 0.03, 12, 28));
    const gap = Math.round(clamp(Math.min(W, H) * (wide ? 0.016 : 0.022), 6, 14));
    const screenH = Math.max(wide ? 96 : 120, H * (wide ? 0.27 : 0.3));
    const bottom = Math.round(clamp(H * 0.03, 10, 20));
    let kh = (H - screenH - bottom - gap * 4) / 5;
    let kw = (W - side * 2 - gap * (cols - 1)) / cols;
    kh = Math.min(kh, wide ? 74 : 92);
    kw = Math.min(kw, kh * (wide ? 2 : W > H ? 1.7 : 1.3));   // standard en paysage : pilules plus larges
    if (kw < kh) kh = kw;                       // touches rondes quand la place manque en largeur
    kh = Math.max(28, Math.floor(kh)); kw = Math.max(28, Math.floor(kw));

    pad.style.gridTemplateColumns = 'repeat(' + cols + ', ' + kw + 'px)';
    pad.style.gridAutoRows = kh + 'px';
    pad.style.gap = gap + 'px';
    const wrap = view.querySelector('.ca-wrap');
    wrap.style.padding = '12px ' + side + 'px ' + bottom + 'px';
    view.style.setProperty('--kf', Math.round(kh * (wide ? 0.4 : 0.42)) + 'px');
    view.style.setProperty('--kfs', Math.round(Math.min(kh * 0.32, kw * 0.24)) + 'px');
    view.style.setProperty('--zp', Math.max(10, Math.round(kh / 2 - kh * 0.13)) + 'px');
    baseFont = Math.round(clamp(Math.min(H * 0.14, W * 0.12), 40, wide ? 76 : 88));
    expr.style.fontSize = Math.round(clamp(baseFont * 0.27, 15, 22)) + 'px';
    render();
  }
  modeBtn.onclick = () => {
    sciPref = !wide;
    try { localStorage.setItem('rztab_calc_sci', sciPref ? '1' : '0'); } catch (e) {}
    layout();
  };
  new ResizeObserver(layout).observe(view);

  place();
  render();
  if (RZ() && RZ().registerView) {
    RZ().registerView('calculator', {
      keys: true,
      enter() { active = true; RZ().setTyping(true); layout(); },
      leave() { active = false; RZ().setTyping(false); },
    });
  }
})();
