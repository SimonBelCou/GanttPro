/* État de l'application : le projet, son planning calculé, l'historique d'annulation et
 * l'indicateur de modifications non exportées (EF-53, EF-55). */
const App = {
  project: null,
  sched: null,
  calcError: null,
  selected: null,
  zoom: 100,
  showAlerts: true,
  showLinks: true,
  // Recherche, filtres et regroupement (EF-84 à EF-86) : affichage seulement, jamais enregistrés.
  view: { query: '', highlight: false, filters: null, groupBy: '', collapsedGroups: new Set(), panel: false },
  undo: [],
  redo: [],
  dirty: false,
};
const UNDO_MAX = 50;

const clone = o => JSON.parse(JSON.stringify(o));

/** Remet les descendants de chaque récapitulative juste sous elle, en gardant l'ordre relatif. */
function normalizeOrder(project) {
  const kids = new Map();
  const ids = new Set(project.tasks.map(t => t.id));
  for (const t of project.tasks) {
    const p = t.parent && ids.has(t.parent) ? t.parent : '';
    (kids.get(p) || kids.set(p, []).get(p)).push(t);
  }
  const out = [], seen = new Set();
  const walk = t => { if (seen.has(t.id)) return; seen.add(t.id); out.push(t); for (const c of kids.get(t.id) || []) walk(c); };
  for (const t of kids.get('') || []) walk(t);
  for (const t of project.tasks) walk(t); // sûreté : rien ne se perd
  project.tasks = out;
}

function recompute() {
  try {
    App.sched = Schedule.compute(App.project);
    App.calcError = null;
  } catch {
    App.sched = null;
    App.calcError = 'calc.error'; // RangeError : date au-delà de 2199
  }
}

/**
 * Applique une modification de données en un seul pas d'annulation.
 * @param {(p:object) => void} mutate
 */
function commit(mutate) {
  const before = clone(App.project);
  mutate(App.project);
  normalizeOrder(App.project);
  App.undo.push(before);
  if (App.undo.length > UNDO_MAX) App.undo.shift();
  App.redo = [];
  App.dirty = true;
  recompute();
  render();
  Recovery.touch();
}

function loadProject(project) {
  App.project = project;
  normalizeOrder(App.project);
  App.undo = []; App.redo = [];
  App.selected = null;
  App.dirty = false;
  recompute();
}

function undoStep(from, to) {
  if (!from.length) return false;
  to.push(clone(App.project));
  App.project = from.pop();
  App.dirty = true;
  const editing = Editor.isOpen() ? App.selected : null;
  if (App.selected && !App.project.tasks.some(t => t.id === App.selected)) App.selected = null;
  recompute();
  // La fiche d'édition ouverte suit l'état rétabli : rechargée si la tâche existe encore, fermée sinon.
  if (editing) { if (App.selected === editing) Editor.open(editing); else Editor.close(); }
  render();
  Recovery.touch();
  return true;
}

/** Index id → tâche valable le temps d'un affichage (les données ne changent pas pendant render). */
const RenderIndex = (() => {
  let tasks = null, map = null;
  return {
    open(list) { tasks = list; map = new Map(list.map(x => [x.id, x])); },
    close() { tasks = null; map = null; },
    get(list, id) { return list === tasks && map ? map.get(id) : undefined; },
    active(list) { return list === tasks && !!map; },
  };
})();
const taskById = id => (RenderIndex.active(App.project.tasks) ? RenderIndex.get(App.project.tasks, id) : App.project.tasks.find(t => t.id === id));
const resById = id => App.project.resources.find(r => r.id === id);
const catById = id => App.project.categories.find(c => c.id === id);

/** Descendants d'une récapitulative. */
function descendants(id, tasks = App.project.tasks) {
  const out = [];
  const walk = pid => { for (const t of tasks) if (t.parent === pid) { out.push(t); walk(t.id); } };
  walk(id);
  return out;
}
function ancestorsOf(id, tasks = App.project.tasks) {
  const out = [];
  const find = RenderIndex.active(tasks) ? k => RenderIndex.get(tasks, k) : k => tasks.find(x => x.id === k);
  let t = find(id);
  while (t && t.parent && out.length <= Model.LIMITS.depth) { out.push(t.parent); t = find(t.parent); }
  return out;
}

/** Lignes visibles : une tâche dont un ancêtre est replié est masquée (RG-27 : sans effet sur le calcul). */
function visibleTasks() {
  const collapsed = new Set(App.project.tasks.filter(t => t.type === 'summary' && t.collapsed).map(t => t.id));
  return App.project.tasks.filter(t => !ancestorsOf(t.id).some(a => collapsed.has(a)));
}

/** Nombre d'étiquettes distinctes (casse ignorée) d'une liste de tâches : 200 au plus (3.7). */
function projectTagCount(tasks) { return new Set(tasks.flatMap(x => x.tags.map(g => g.toLowerCase()))).size; }
