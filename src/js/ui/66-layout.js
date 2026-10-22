/* Mise en page de la vue principale (EF-108 à EF-111) : séparateur réglable entre la liste et le Gantt,
 * colonnes figées, plein écran du Gantt. Aucune de ces réglages n'est enregistrée : ils valent pour la
 * session (stockage local seulement sur geste explicite, SECURITY.md). Tout se fait aussi au clavier. */
const LIST_MIN = 200, GANTT_MIN = 200, SPLIT_STEP = 20;
App.listW = null;   // largeur imposée de la liste en px ; null = automatique
App.freeze = 0;     // 0, 1 (identifiant) ou 2 (identifiant et nom)
App.full = false;   // plein écran du Gantt

function listBounds() {
  const total = $('planner').clientWidth - 10;
  return { min: LIST_MIN, max: Math.max(LIST_MIN, total - GANTT_MIN) };
}

function applyListWidth() {
  const planner = $('planner');
  if (App.listW == null) planner.style.removeProperty('--list-w'); else planner.style.setProperty('--list-w', App.listW + 'px');
}

/** Valeur annoncée par le séparateur : lue à la demande (focus, geste) pour ne pas forcer la mise en page à chaque rendu. */
function updateSplitterValue() {
  const sep = $('splitter');
  const b = listBounds();
  const w = Math.round($('list').getBoundingClientRect().width);
  sep.setAttribute('aria-valuemin', String(b.min));
  sep.setAttribute('aria-valuemax', String(b.max));
  sep.setAttribute('aria-valuenow', String(Math.max(b.min, Math.min(b.max, w))));
}

function setListWidth(w) {
  const b = listBounds();
  App.listW = w == null ? null : Math.max(b.min, Math.min(b.max, Math.round(w)));
  applyListWidth();
  updateSplitterValue();
}

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

/** À rappeler après chaque rendu ou changement de largeur : recalcule ce qui dépend des tailles réelles. */
/** Hauteur de la zone de planning : tout le reste de la fenêtre sous sa position dans la page (au moins 300 px),
 *  pour que le bas des deux colonnes, donc leurs barres de défilement horizontales, soit visible en haut de page. */
function applyPlannerHeight() {
  const pl = $('planner');
  const top = pl.getBoundingClientRect().top + window.scrollY;
  pl.style.setProperty('--planner-h', Math.max(300, Math.round(window.innerHeight - top - 12)) + 'px');
}

let plannerHeightPending = false;
/** Différé à l'image suivante : la mesure force une mise en page, trop coûteuse à chaque rendu d'un grand projet (EX-25). */
function schedulePlannerHeight() {
  if (plannerHeightPending) return;
  plannerHeightPending = true;
  requestAnimationFrame(() => { plannerHeightPending = false; applyPlannerHeight(); });
}

function refreshLayout() {
  schedulePlannerHeight();
  applyListWidth();
  applyFreeze();
}

action('freezeCols', (arg, el) => { App.freeze = Number(el.value) || 0; applyFreeze(); });
action('resetColumns', () => { App.colWidths = {}; applyColWidths(); applyFreeze(); announce(t('lay.colsResetDone')); });

const FULL_LOCKED = ['tabs', 'selbar', 'kpis', 'alerts', 'viewbar', 'legend'];
function setFull(on) {
  if (App.full === on) return;
  App.full = on;
  document.body.classList.toggle('planner-full', on);
  for (const id of FULL_LOCKED) $(id).inert = on;
  document.querySelector('header.topbar').inert = on;
  $('full-bar').hidden = !on;
  const btn = $('btn-full');
  btn.setAttribute('aria-pressed', String(on));
  announce(t(on ? 'lay.fullOn' : 'lay.fullOff'));
  refreshLayout();
  updateSplitterValue();
  (on ? $('btn-full-exit') : btn).focus();
}
action('toggleFull', () => setFull(!App.full));

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
  window.addEventListener('resize', () => { applyPlannerHeight(); if (App.listW != null) setListWidth(App.listW); else updateSplitterValue(); });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && App.full && !ev.defaultPrevented && !document.querySelector('dialog[open]') && !(typeof Editor !== 'undefined' && Editor.isOpen())) {
      ev.preventDefault(); setFull(false);
    }
  });
  refreshLayout();
  updateSplitterValue();
}
