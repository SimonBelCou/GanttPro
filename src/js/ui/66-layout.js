/* Mise en page de la vue principale (EF-108 à EF-111, EF-151) : séparateur réglable entre la liste et le Gantt,
 * colonnes figées, plein écran du Gantt, légende repliable en plein écran. La hauteur de la zone de planning et la
 * légende fixée en bas de la fenêtre sont entièrement en CSS (10-base.css, « Écran fixe »). Aucun de ces réglages
 * n'est enregistré : ils valent pour la session (stockage local seulement sur geste explicite, SECURITY.md).
 * Tout se fait aussi au clavier. */
const LIST_MIN = 200, GANTT_MIN = 200, SPLIT_STEP = 20;
App.listW = null;   // largeur imposée de la liste en px ; null = automatique
App.freeze = 0;     // 0, 1 (identifiant) ou 2 (identifiant et nom)
App.full = false;   // plein écran du Gantt
App.legendOpen = true; // légende dépliée en plein écran (dans la vue normale, elle l'est toujours)

/**
 * Appelle : $()
 * Appelée par : setListWidth(), updateSplitterValue()
 */
function listBounds() {
  const total = $('planner').clientWidth - 10;
  return { min: LIST_MIN, max: Math.max(LIST_MIN, total - GANTT_MIN) };
}

/**
 * Appelle : $()
 * Appelée par : refreshLayout(), setListWidth()
 */
function applyListWidth() {
  const planner = $('planner');
  if (App.listW == null) planner.style.removeProperty('--list-w'); else planner.style.setProperty('--list-w', App.listW + 'px');
}

/**
 * Valeur annoncée par le séparateur : lue à la demande (focus, geste) pour ne pas forcer la mise en page à chaque rendu.
 * Appelle : $(), listBounds()
 * Appelée par : initLayout(), setFull(), setListWidth()
 */
function updateSplitterValue() {
  const sep = $('splitter');
  const b = listBounds();
  const w = Math.round($('list').getBoundingClientRect().width);
  sep.setAttribute('aria-valuemin', String(b.min));
  sep.setAttribute('aria-valuemax', String(b.max));
  sep.setAttribute('aria-valuenow', String(Math.max(b.min, Math.min(b.max, w))));
}

/**
 * Appelle : applyListWidth(), listBounds(), updateSplitterValue()
 * Appelée par : initLayout()
 */
function setListWidth(w) {
  const b = listBounds();
  App.listW = w == null ? null : Math.max(b.min, Math.min(b.max, Math.round(w)));
  applyListWidth();
  updateSplitterValue();
}

/**
 * Appelle : $()
 * Appelée par : action « freezeCols », action « resetColumns », applyColWidths(), bindColumnHandles(),
 *   refreshLayout()
 */
function applyFreeze() {
  const table = $('tasks-table');
  table.classList.toggle('frz-1', App.freeze === 1);
  table.classList.toggle('frz-2', App.freeze === 2);
  if (App.freeze === 2) {
    const first = table.querySelector('thead th');
    if (first) table.style.setProperty('--frz-w1', Math.round(first.getBoundingClientRect().width) + 'px');
  } else table.style.removeProperty('--frz-w1');
  $('freeze-cols').value = String(App.freeze);
}

/**
 * À rappeler après chaque rendu ou changement de largeur : recalcule ce qui dépend des tailles réelles.
 * Appelle : applyFreeze(), applyListWidth()
 * Appelée par : initLayout(), renderAll(), setFull()
 */
function refreshLayout() {
  applyListWidth();
  applyFreeze();
}

/**
 * Appelle : applyFreeze()
 * Appelée par : l'événement « freezeCols » (table ACTIONS)
 */
action('freezeCols', (arg, el) => { App.freeze = Number(el.value) || 0; applyFreeze(); });
/**
 * Appelle : announce(), applyColWidths(), applyFreeze(), t()
 * Appelée par : l'événement « resetColumns » (table ACTIONS)
 */
action('resetColumns', () => { App.colWidths = {}; applyColWidths(); applyFreeze(); announce(t('lay.colsResetDone')); });

/**
 * Légende repliée seulement en plein écran et sur demande ; dans la vue normale, elle est toujours dépliée.
 * Appelle : $()
 * Appelée par : action « toggleLegend », setFull()
 */
function applyLegendState() {
  const open = !App.full || App.legendOpen;
  $('legend-body').hidden = !open;
  $('btn-legend').setAttribute('aria-expanded', String(open));
}
/**
 * Appelle : applyLegendState()
 * Appelée par : l'événement « toggleLegend » (table ACTIONS)
 */
action('toggleLegend', () => { if (!App.full) return; App.legendOpen = !App.legendOpen; applyLegendState(); });

// Masqués en plein écran (10-base.css) et rendus inertes : rien n'y est atteignable au clavier.
const FULL_LOCKED = ['tabs', 'selbar', 'kpis', 'alerts', 'viewbar'];
let fullScrollY = 0; // position de la page avant le plein écran, rendue à la sortie (petits écrans : la page défile)
/**
 * Appelle : $(), announce(), applyLegendState(), refreshLayout(), t(), updateSplitterValue()
 * Appelée par : action « toggleFull », initLayout()
 */
function setFull(on) {
  if (App.full === on) return;
  App.full = on;
  if (on) fullScrollY = window.scrollY;
  document.body.classList.toggle('planner-full', on);
  for (const id of FULL_LOCKED) $(id).inert = on;
  document.querySelector('header.topbar').inert = on;
  $('full-bar').hidden = !on;
  const btn = $('btn-full');
  btn.setAttribute('aria-pressed', String(on));
  applyLegendState();
  announce(t(on ? 'lay.fullOn' : 'lay.fullOff'));
  refreshLayout();
  updateSplitterValue();
  (on ? $('btn-full-exit') : btn).focus({ preventScroll: !on });
  if (!on) window.scrollTo(0, fullScrollY);
}
/**
 * Appelle : setFull()
 * Appelée par : l'événement « toggleFull » (table ACTIONS)
 */
action('toggleFull', () => setFull(!App.full));

/**
 * Appelle : $(), Editor.isOpen(), refreshLayout(), setFull(), setListWidth(), updateSplitterValue()
 * Appelée par : init()
 */
function initLayout() {
  const sep = $('splitter');
  sep.addEventListener('keydown', ev => {
    const cur = Math.round($('list').getBoundingClientRect().width);
    const step = ev.shiftKey ? SPLIT_STEP * 5 : SPLIT_STEP;
    if (ev.key === 'ArrowLeft') setListWidth(cur - step);
    else if (ev.key === 'ArrowRight') setListWidth(cur + step);
    else if (ev.key === 'Home') setListWidth(null);
    else return;
    ev.preventDefault();
  });
  sep.addEventListener('dblclick', () => setListWidth(null));
  sep.addEventListener('focus', updateSplitterValue);
  sep.addEventListener('pointerdown', ev => {
    if (ev.button !== 0 && ev.pointerType === 'mouse') return;
    ev.preventDefault();
    sep.setPointerCapture(ev.pointerId);
    const x0 = ev.clientX, w0 = $('list').getBoundingClientRect().width;
    const move = e => setListWidth(w0 + e.clientX - x0);
    const up = () => { sep.removeEventListener('pointermove', move); sep.removeEventListener('pointerup', up); sep.removeEventListener('pointercancel', up); };
    sep.addEventListener('pointermove', move);
    sep.addEventListener('pointerup', up);
    sep.addEventListener('pointercancel', up);
  });
  // Défilement vertical commun : la liste et le Gantt défilent chacun dans leur zone (barres horizontales toujours visibles).
  const list = $('list'), gantt = $('gantt');
  const mirror = (from, to) => from.addEventListener('scroll', () => { if (to.scrollTop !== from.scrollTop) to.scrollTop = from.scrollTop; }, { passive: true });
  mirror(list, gantt); mirror(gantt, list);
  window.addEventListener('resize', () => { if (App.listW != null) setListWidth(App.listW); else updateSplitterValue(); });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && App.full && !ev.defaultPrevented && !document.querySelector('dialog[open]') && !(typeof Editor !== 'undefined' && Editor.isOpen())) {
      ev.preventDefault(); setFull(false);
    }
  });
  refreshLayout();
  updateSplitterValue();
}
