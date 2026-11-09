/* Fenetre de la tablette : deplacement par la barre d'etat, redimensionnement par les bords. */

/* ---------- Fenetre deplacable / redimensionnable ---------- */
const win = document.querySelector('.screen');
const MINW = 520, MINH = 380;
let geo = null;
function applyGeo() {
  const vw = window.innerWidth, vh = window.innerHeight;
  geo.w = Math.max(MINW, Math.min(geo.w, vw)); geo.h = Math.max(MINH, Math.min(geo.h, vh));
  geo.x = Math.max(0, Math.min(geo.x, vw - geo.w)); geo.y = Math.max(0, Math.min(geo.y, vh - geo.h));
  win.style.width = geo.w + 'px'; win.style.height = geo.h + 'px';
  win.style.left = geo.x + 'px'; win.style.top = geo.y + 'px';
  win.classList.toggle('compact', geo.w < 760);
}
function defaultGeo() {
  const w = Math.min(1000, Math.round(window.innerWidth * 0.8)), h = Math.min(640, Math.round(window.innerHeight * 0.8));
  return { w, h, x: Math.round((window.innerWidth - w) / 2), y: Math.round((window.innerHeight - h) / 2) };
}
function initGeo() { geo = store.get('geo', null) || defaultGeo(); applyGeo(); }
function startDrag(e, dir) {
  if (e.button !== 0) return;
  e.preventDefault();
  const sx = e.clientX, sy = e.clientY, o = { ...geo };
  document.body.classList.add('dragging');
  const move = (ev) => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (!dir) { geo.x = o.x + dx; geo.y = o.y + dy; }
    else {
      if (dir.includes('r')) geo.w = o.w + dx;
      if (dir.includes('b')) geo.h = o.h + dy;
      if (dir.includes('l')) { const w = Math.max(MINW, o.w - dx); geo.x = o.x + (o.w - w); geo.w = w; }
      if (dir.includes('t')) { const h = Math.max(MINH, o.h - dy); geo.y = o.y + (o.h - h); geo.h = h; }
    }
    applyGeo();
  };
  const up = () => {
    document.body.classList.remove('dragging');
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    store.set('geo', geo);
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}
document.querySelector('.statusbar').addEventListener('pointerdown', (e) => { if (!e.target.closest('button, .island')) startDrag(e, null); });
document.querySelectorAll('.rs').forEach(h => h.addEventListener('pointerdown', (e) => startDrag(e, h.dataset.dir)));
$('reset-win').onclick = () => { geo = defaultGeo(); applyGeo(); store.set('geo', geo); };
window.addEventListener('resize', () => { if (geo) applyGeo(); });
