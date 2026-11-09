/* Application Calculatrice, facon iOS : AC/C, +/-, %, quatre operations avec priorite (2 + 3 x 4 = 14).
   Le clavier du PC marche aussi (chiffres, + - * / x, Entree ou =, virgule ou point, Retour arriere, C).
   Pendant que l'app est ouverte, le clavier va a la tablette et pas au jeu (pas de changement d'arme sur 1-9). */
(() => {
  const $ = (id) => document.getElementById(id);
  const RZ = () => window.RZ;
  const disp = $('ca-disp'), expr = $('ca-expr'), pad = $('ca-pad');
  const SYM = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  const MAX_DIGITS = 9;

  let toks = [];          // nombres et operateurs deja saisis : [12, '+', 3, '*']
  let cur = '0';          // nombre en cours de saisie (texte, point decimal)
  let fresh = true;       // le prochain chiffre remplace cur (apres un operateur ou un resultat)
  let done = false;       // on vient d'appuyer sur =
  let error = false;

  const round = (x) => Number(Number(x).toPrecision(12));
  function fmt(s) {
    if (error) return 'Erreur';
    const n = Number(s);
    if (!isFinite(n)) return 'Erreur';
    if (/e/i.test(s) || Math.abs(n) >= 1e15 || (n !== 0 && Math.abs(n) < 1e-9)) return n.toExponential(5).replace('.', ',').replace('e+', 'e');
    // en saisie : on garde la virgule et les zeros tapes
    const neg = s.startsWith('-'), raw = neg ? s.slice(1) : s;
    const [i, d] = raw.split('.');
    const int = Number(i || 0).toLocaleString('fr-FR');
    return (neg ? '−' : '') + int + (d != null ? ',' + d : '');
  }
  const numText = (n) => String(Number(round(n).toPrecision(10)));   // 10 chiffres significatifs a l'ecran

  function evaluate(list) {
    // priorite : d'abord x et ÷, puis + et −
    const a = list.slice();
    for (let i = 1; i < a.length; i += 2) {
      if (a[i] === '*' || a[i] === '/') {
        if (a[i] === '/' && a[i + 1] === 0) return NaN;
        const v = a[i] === '*' ? a[i - 1] * a[i + 1] : a[i - 1] / a[i + 1];
        a.splice(i - 1, 3, v); i -= 2;
      }
    }
    let v = a[0];
    for (let i = 1; i < a.length; i += 2) v = a[i] === '+' ? v + a[i + 1] : v - a[i + 1];
    return round(v);
  }

  function render() {
    disp.textContent = fmt(cur);
    // taille du texte : l'affichage tient toujours sur une ligne
    const len = disp.textContent.length;
    disp.style.fontSize = len > 11 ? '44px' : len > 9 ? '56px' : len > 7 ? '68px' : '';
    expr.textContent = toks.map((t) => typeof t === 'number' ? fmt(numText(t)) : SYM[t]).join(' ') + (done ? ' =' : '');
    const pending = !fresh || done ? null : toks[toks.length - 1];
    pad.querySelectorAll('[data-op]').forEach((b) => b.classList.toggle('on', b.dataset.op === pending && !done));
    $('ca-ac').textContent = (cur !== '0' && !fresh) || error ? 'C' : 'AC';
  }

  function digit(d) {
    if (error) clearAll();
    if (done) { toks = []; done = false; fresh = true; }
    if (fresh) { cur = d === '.' ? '0.' : d; fresh = false; render(); return; }
    if (d === '.') { if (!cur.includes('.')) cur += '.'; render(); return; }
    if (cur.replace(/[-.]/g, '').length >= MAX_DIGITS) return;
    cur = cur === '0' ? d : cur === '-0' ? '-' + d : cur + d;
    render();
  }
  function op(o) {
    if (error) return;
    if (done) { toks = [Number(cur)]; done = false; }
    else if (fresh && toks.length && typeof toks[toks.length - 1] === 'string') { toks[toks.length - 1] = o; render(); return; }   // change d'operateur
    else toks.push(Number(cur));
    toks.push(o);
    // resultat intermediaire affiche, comme sur iPhone
    const part = toks.slice(0, -1);
    if (part.length > 1) { const v = (o === '+' || o === '-') ? evaluate(part) : evaluateTail(part); if (isFinite(v)) cur = numText(v); }
    fresh = true;
    render();
  }
  // pour x et ÷, l'affichage montre le dernier produit en cours (3 + 4 x 5 x -> 20)
  function evaluateTail(part) {
    let i = part.length - 1;
    while (i >= 2 && (part[i - 1] === '*' || part[i - 1] === '/')) i -= 2;
    return evaluate(part.slice(i));
  }
  function equals() {
    if (error) return;
    if (done) return;
    toks.push(Number(cur));                                  // 5 + = -> 5 + 5 (le resultat partiel est repris)
    const v = evaluate(toks);
    if (!isFinite(v)) { error = true; cur = '0'; }
    else cur = numText(v);
    done = true; fresh = true;
    render();
  }
  function clearAll() { toks = []; cur = '0'; fresh = true; done = false; error = false; render(); }
  function clear() {
    if (error || fresh || cur === '0') { clearAll(); return; }
    cur = '0'; fresh = true; render();
  }
  function negate() {
    if (error) return;
    if (fresh && !done) { cur = '-0'; fresh = false; render(); return; }
    cur = cur.startsWith('-') ? cur.slice(1) : '-' + cur;
    if (done) { toks = []; done = false; fresh = false; }
    render();
  }
  function percent() {
    if (error) return;
    let v = Number(cur) / 100;
    const last = toks[toks.length - 1];
    // 200 + 10 % = 220 : le pourcentage porte sur le nombre d'avant
    if (!done && (last === '+' || last === '-') && toks.length >= 2) v = Number(evaluate(toks.slice(0, -1))) * Number(cur) / 100;
    cur = numText(v); fresh = false;
    if (done) { toks = []; done = false; }
    render();
  }
  function backspace() {
    if (error) { clearAll(); return; }
    if (fresh || done) return;
    cur = cur.length > 1 && cur !== '-0' ? cur.slice(0, -1) : '0';
    if (cur === '-') cur = '0';
    render();
  }

  /* ---------- Pave ---------- */
  const KEYS = [
    ['ac', 'fn'], ['±', 'fn'], ['%', 'fn'], ['/', 'op'],
    ['7'], ['8'], ['9'], ['*', 'op'],
    ['4'], ['5'], ['6'], ['-', 'op'],
    ['1'], ['2'], ['3'], ['+', 'op'],
    ['0', 'zero'], ['.'], ['=', 'op eq'],
  ];
  const flashKey = {};
  KEYS.forEach(([k, cls]) => {
    const b = document.createElement('button');
    b.className = 'ca-key' + (cls ? ' ' + cls.split(' ').map((c) => 'ca-' + c).join(' ') : '');
    if (k === 'ac') { b.id = 'ca-ac'; b.textContent = 'AC'; }
    else b.textContent = SYM[k] || (k === '.' ? ',' : k);
    if (cls && cls.startsWith('op') && k !== '=') b.dataset.op = k;
    const act = () => {
      if (k === 'ac') clear();
      else if (k === '±') negate();
      else if (k === '%') percent();
      else if (k === '=') equals();
      else if (SYM[k]) op(k);
      else digit(k);
    };
    b.addEventListener('pointerdown', (e) => { if (e.button === 0) act(); });   // reponse a l'appui
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') e.preventDefault(); });
    flashKey[k] = b;
    pad.append(b);
  });
  function flash(k) { const b = flashKey[k]; if (!b) return; b.classList.add('lit'); setTimeout(() => b.classList.remove('lit'), 110); }

  let active = false;
  window.addEventListener('keydown', (e) => {
    if (!active || e.ctrlKey || e.altKey || e.metaKey) return;
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
    let k = e.key;
    if (k === 'x' || k === 'X') k = '*';
    if (k === ',') k = '.';
    if (/^[0-9.]$/.test(k)) { digit(k); flash(k); }
    else if (SYM[k]) { op(k); flash(k); }
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

  // fenetre reduite : pave plus petit
  const view = $('calculator');
  new ResizeObserver(() => view.classList.toggle('short', view.clientHeight > 0 && view.clientHeight < 600)).observe(view);

  render();
  if (RZ() && RZ().registerView) {
    RZ().registerView('calculator', {
      keys: true,
      enter() { active = true; RZ().setTyping(true); },
      leave() { active = false; RZ().setTyping(false); },
    });
  }
})();
