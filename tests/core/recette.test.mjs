// Scénarios chiffrés de la recette (cahier des charges, section 9) : calcul seul.
//   node --test tests/core/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './load.mjs';

const { Schedule, Metrics, Dates } = loadCore();
// Les objets créés dans le contexte isolé ont d'autres prototypes : on compare des copies simples.
const plain = x => JSON.parse(JSON.stringify(x));

/** Projet de test : début lundi 05/01/2026, calendrier par défaut. */
function project({ start = '2026-01-05', tasks, resources = [], calendar } = {}) {
  return {
    projectStart: start,
    calendar: calendar || { workDays: [1, 1, 1, 1, 1, 0, 0], holidays: 'FR', daysOff: [], daysWorked: [] },
    resources: resources.map(r => ({ capacity: 100, absences: [], ...r })),
    categories: [], baselines: [],
    tasks: tasks.map(t => ({
      type: 'task', parent: '', dur: 5, deps: [], assign: [], pct: 0, forcedStart: '', notBefore: '', deadline: '',
      realStart: '', realEnd: '', ...t,
      deps: (t.deps || []).map(d => (typeof d === 'string' ? { id: d, type: 'FS', lag: 0 } : { type: 'FS', lag: 0, ...d })),
      assign: (t.assign || []).map(a => (typeof a === 'string' ? { res: a, units: 100 } : a)),
    })),
  };
}
const iso = dn => Dates.toISO(dn);
/** Dates planifiées « JJ/MM » d'une tâche. */
function span(s, id) {
  const r = s.tasks.get(id);
  const f = dn => iso(dn).slice(8, 10) + '/' + iso(dn).slice(5, 7);
  return `${f(r.startDn)}-${f(r.endDn)}`;
}
const run = p => Schedule.compute(p);

// ── 9.1 Calendrier et ordonnancement ───────────────────────────────────────────────────────
test('R-01 lien fin-début', () => {
  const s = run(project({ tasks: [{ id: 'A' }, { id: 'B', dur: 3, deps: ['A'] }] }));
  assert.equal(span(s, 'A'), '05/01-09/01');
  assert.equal(span(s, 'B'), '12/01-14/01');
});

test('R-02 début du projet un samedi', () => {
  const p = project({ start: '2026-01-03', tasks: [{ id: 'A', dur: 1 }] });
  assert.equal(span(run(p), 'A'), '05/01-05/01');
  assert.equal(p.projectStart, '2026-01-03');
});

const alice = { id: 'r1', name: 'Alice' }, bob = { id: 'r2', name: 'Bob' };

test("R-03 nivellement dans l'ordre de la liste", () => {
  const s = run(project({ resources: [alice, bob], tasks: [
    { id: 'A', dur: 3, assign: ['r1'] }, { id: 'B', dur: 2, assign: ['r1'] }, { id: 'C', dur: 2, assign: ['r2'] }] }));
  assert.equal(span(s, 'A'), '05/01-07/01');
  assert.equal(span(s, 'B'), '08/01-09/01');
  assert.equal(span(s, 'C'), '05/01-06/01');
});

test("R-04 l'ordre de la liste est la priorité", () => {
  const s = run(project({ resources: [alice, bob], tasks: [
    { id: 'B', dur: 2, assign: ['r1'] }, { id: 'A', dur: 3, assign: ['r1'] }, { id: 'C', dur: 2, assign: ['r2'] }] }));
  assert.equal(span(s, 'B'), '05/01-06/01');
  assert.equal(span(s, 'A'), '07/01-09/01');
});

test('R-05 date imposée avant la fin du prédécesseur : avertissement', () => {
  const s = run(project({ tasks: [{ id: 'A' }, { id: 'B', dur: 3, deps: ['A'], forcedStart: '2026-01-06' }] }));
  assert.equal(span(s, 'A'), '05/01-09/01');
  assert.equal(span(s, 'B'), '06/01-08/01');
  assert.deepEqual(plain(s.warnings.map(w => [w.kind, w.task, w.pred])), [['link', 'B', 'A']]);
});

test('R-06 date imposée un jour férié', () => {
  const s = run(project({ start: '2026-04-27', tasks: [{ id: 'A', dur: 2, forcedStart: '2026-05-01' }] }));
  assert.equal(span(s, 'A'), '04/05-05/05');
});

test('R-07 à R-10 jours fériés ignorés', () => {
  const end = (start, dur) => iso(run(project({ start, tasks: [{ id: 'A', dur }] })).tasks.get('A').endDn);
  assert.equal(end('2026-04-27', 5), '2026-05-04');
  assert.equal(end('2026-04-02', 3), '2026-04-07');
  assert.equal(end('2026-05-11', 4), '2026-05-15');
  assert.equal(end('2026-05-21', 5), '2026-05-28');
});

test('R-11 jours fériés 2026', async () => {
  const { Calendar } = loadCore();
  const days = [...Calendar.holidaysOf('FR', 2026).keys()].sort((a, b) => a - b).map(dn => iso(dn).slice(5));
  assert.deepEqual(plain(days), ['01-01', '04-06', '05-01', '05-08', '05-14', '05-25', '07-14', '08-15', '11-01', '11-11', '12-25']);
  assert.equal(days.filter(d => Dates.weekday(Dates.parse('2026-' + d)) < 5).length, 9);
});

test('R-12 jalon', () => {
  const s = run(project({ tasks: [{ id: 'A' }, { id: 'J', type: 'milestone', dur: 0, deps: ['A'] }, { id: 'B', dur: 2, deps: ['J'] }] }));
  assert.equal(iso(s.tasks.get('J').startDn), '2026-01-09');
  assert.equal(span(s, 'B'), '12/01-13/01');
});

test('R-14 chemin critique et marge', () => {
  const s = run(project({ tasks: [{ id: 'A' }, { id: 'B', dur: 3 }, { id: 'C', dur: 2, deps: ['A', 'B'] }] }));
  assert.equal(span(s, 'C'), '12/01-13/01');
  assert.deepEqual(plain(s.criticalPath), ['A', 'C']);
  assert.equal(s.tasks.get('B').slack, 2);
});

test('R-15 le nivellement entre dans le chemin critique', () => {
  const s = run(project({ resources: [alice], tasks: [
    { id: 'A', assign: ['r1'] }, { id: 'B', dur: 3, assign: ['r1'] }, { id: 'C', dur: 2, deps: ['A', 'B'] }] }));
  assert.equal(span(s, 'B'), '12/01-14/01');
  assert.equal(span(s, 'C'), '15/01-16/01');
  assert.deepEqual(plain(s.criticalPath), ['A', 'B', 'C']);
});

test('R-16 conflit de ressource dû à une date imposée', () => {
  const p = project({ resources: [alice], tasks: [{ id: 'A', assign: ['r1'] }, { id: 'B', dur: 3, assign: ['r1'], forcedStart: '2026-01-07' }] });
  let s = run(p);
  assert.equal(span(s, 'B'), '07/01-09/01');
  assert.equal(s.conflicts.length, 1);
  assert.deepEqual(plain(s.conflicts[0].tasks), ['A', 'B']);
  p.tasks[1].forcedStart = ''; // « Résoudre auto » : lever la date imposée
  s = run(p);
  assert.equal(span(s, 'B'), '12/01-14/01');
  assert.equal(s.conflicts.length, 0);
});

test('R-17 une date imposée tardive ne masque pas les autres tâches', () => {
  const s = run(project({ tasks: [{ id: 'A', forcedStart: '2026-03-02' }, { id: 'B' }] }));
  assert.equal(iso(s.tasks.get('B').startDn), '2026-01-05');
  assert.equal(iso(s.startDn), '2026-01-05');
});

// ── 9.2 Suivi, indicateurs et courbe en S (aujourd'hui : mercredi 14/01/2026) ───────────────
const TODAY = Dates.parse('2026-01-14');

test('R-18 statuts, compteurs, avancement global', () => {
  const p = project({ tasks: [
    { id: 'T1', pct: 100 }, { id: 'T2', pct: 40 }, { id: 'T3', pct: 60, forcedStart: '2026-01-12' },
    { id: 'T4', forcedStart: '2026-01-12' }, { id: 'T5', forcedStart: '2026-01-19' }, { id: 'T6' }] });
  const s = run(p);
  const st = p.tasks.map(t => Metrics.status(t, s, TODAY));
  assert.deepEqual(plain(st), ['done', 'late', 'ongoing', 'notStarted', 'upcoming', 'late']);
  const c = Metrics.counters(p, s, TODAY);
  assert.deepEqual([c.done, c.ongoing, c.late], [1, 1, 2]);
  assert.equal(Math.round(Metrics.globalProgress(p)), 33);
});

test('R-19 à R-21 écart en jours ouvrés', () => {
  const dev = t => { const p = project({ tasks: [{ id: 'A', ...t }] }); return plain(Metrics.deviation(p.tasks[0], run(p), TODAY)); };
  assert.deepEqual(dev({ pct: 100, realEnd: '2026-01-13' }), { days: 2, ongoing: false });
  assert.deepEqual(dev({ pct: 100, realEnd: '2026-01-07' }), { days: -2, ongoing: false });
  assert.deepEqual(dev({ pct: 40 }), { days: 3, ongoing: true });
});

test('R-22 avancement global pondéré par la durée', () => {
  assert.equal(Metrics.globalProgress(project({ tasks: [{ id: 'A', dur: 2, pct: 100 }, { id: 'B', dur: 8 }] })), 20);
});

test('R-23 courbe en S', () => {
  const p = project({ tasks: [{ id: 'T1', pct: 100, realEnd: '2026-01-09' }, { id: 'T2', pct: 40, deps: ['T1'] }] });
  const s = run(p);
  const w = Metrics.sCurve(p, s, TODAY, 'week');
  assert.deepEqual(plain(w.planned), [50, 100]);
  assert.deepEqual(plain(w.real), [50, 70]);
  const m = Metrics.sCurve(p, s, TODAY, 'month');
  assert.deepEqual(plain([m.planned, m.real]), [[100], [70]]);
});

// ── 9.4 Fonctions ajoutées : calcul ──────────────────────────────────────────────────────────
const link = (id, type, lag = 0) => ({ id, type, lag });

test('R-36 à R-38 liens début-début et fin-fin', () => {
  assert.equal(span(run(project({ tasks: [{ id: 'A' }, { id: 'B', dur: 3, deps: [link('A', 'SS')] }] })), 'B'), '05/01-07/01');
  assert.equal(span(run(project({ tasks: [{ id: 'A' }, { id: 'B', dur: 3, deps: [link('A', 'SS', 2)] }] })), 'B'), '07/01-09/01');
  assert.equal(span(run(project({ tasks: [{ id: 'A' }, { id: 'B', dur: 3, deps: [link('A', 'FF')] }] })), 'B'), '07/01-09/01');
});

test('R-39 lien début-fin', () => {
  const s = run(project({ tasks: [{ id: 'A', forcedStart: '2026-01-12' }, { id: 'B', dur: 2, deps: [link('A', 'SF')] }] }));
  assert.equal(span(s, 'B'), '08/01-09/01');
});

test('R-40 délai positif et négatif', () => {
  const start = lag => iso(run(project({ tasks: [{ id: 'A' }, { id: 'B', dur: 2, deps: [link('A', 'FS', lag)] }] })).tasks.get('B').startDn);
  assert.equal(start(2), '2026-01-14');
  assert.equal(start(-1), '2026-01-09');
});

test('R-41 tâche récapitulative', () => {
  const s = run(project({ tasks: [
    { id: 'P', type: 'summary', dur: 0 }, { id: 'C1', parent: 'P', pct: 100 }, { id: 'C2', parent: 'P', deps: ['C1'] }] }));
  assert.equal(span(s, 'C2'), '12/01-16/01');
  assert.equal(span(s, 'P'), '05/01-16/01');
  assert.equal(s.tasks.get('P').d, 10);
  assert.equal(s.tasks.get('P').pct, 50);
  assert.ok(!s.criticalPath.includes('P'));
});

test('R-43 ne pas commencer avant', () => {
  assert.equal(span(run(project({ tasks: [{ id: 'A', dur: 2, notBefore: '2026-01-12' }] })), 'A'), '12/01-13/01');
});

test('R-44 échéance dépassée', () => {
  const s = run(project({ tasks: [{ id: 'A', deadline: '2026-01-08' }] }));
  assert.equal(s.tasks.get('A').slack, -1);
  assert.ok(s.tasks.get('A').critical);
  assert.deepEqual(plain(s.warnings), [{ kind: 'deadline', task: 'A', days: 1 }]);
});

test('R-45 deux affectations à 50 % en parallèle', () => {
  const s = run(project({ resources: [alice], tasks: [
    { id: 'A', dur: 3, assign: [{ res: 'r1', units: 50 }] }, { id: 'B', dur: 2, assign: [{ res: 'r1', units: 50 }] }] }));
  assert.equal(span(s, 'A'), '05/01-07/01');
  assert.equal(span(s, 'B'), '05/01-06/01');
  assert.equal(s.conflicts.length, 0);
});

test('R-46 dépassement de capacité', () => {
  const s = run(project({ resources: [alice], tasks: [
    { id: 'A', dur: 3, assign: [{ res: 'r1', units: 100 }] }, { id: 'B', dur: 2, assign: [{ res: 'r1', units: 50 }] }] }));
  assert.equal(span(s, 'B'), '08/01-09/01');
});

test('R-47 absence', () => {
  const s = run(project({ resources: [{ ...alice, absences: [{ start: '2026-01-05', end: '2026-01-09', label: '' }] }],
    tasks: [{ id: 'A', dur: 3, assign: ['r1'] }] }));
  assert.equal(span(s, 'A'), '12/01-14/01');
});

const cal = (o = {}) => ({ workDays: [1, 1, 1, 1, 1, 0, 0], holidays: 'FR', daysOff: [], daysWorked: [], ...o });

test('R-48 et R-49 jours travaillés et chômés exceptionnels', () => {
  const sat = cal({ daysWorked: [{ start: '2026-01-10', end: '2026-01-10', label: '' }] });
  assert.equal(span(run(project({ calendar: sat, tasks: [{ id: 'A', dur: 6 }] })), 'A'), '05/01-10/01');
  const off = cal({ daysOff: [{ start: '2026-01-07', end: '2026-01-07', label: '' }] });
  assert.equal(span(run(project({ calendar: off, tasks: [{ id: 'A' }] })), 'A'), '05/01-12/01');
});

test('R-50 et R-51 Alsace-Moselle', () => {
  const end = (start, set) => iso(run(project({ start, calendar: cal({ holidays: set }), tasks: [{ id: 'A', dur: 3 }] })).tasks.get('A').endDn);
  assert.equal(end('2026-04-02', 'FR'), '2026-04-07');
  assert.equal(end('2026-04-02', 'FR-AM'), '2026-04-08');
  assert.equal(end('2025-12-24', 'FR'), '2025-12-29');
  assert.equal(end('2025-12-24', 'FR-AM'), '2025-12-30');
});

test('R-52 charge rapportée à la capacité', () => {
  const p = project({ resources: [{ ...alice, capacity: 50 }], tasks: [{ id: 'A', assign: [{ res: 'r1', units: 50 }] }] });
  const s = run(p);
  const occ = Metrics.occupation(s, 'r1', Dates.parse('2026-01-05'), Dates.parse('2026-01-09'));
  assert.equal(occ.ratio, 1);
  assert.equal(occ.state, 'ok');
  assert.equal(s.conflicts.length, 0);
});

test('R-56 voyant du rapport d\'état', () => {
  const base = (endIso) => ({ id: 'b', tasks: [{ id: 'A', dur: 5, start: '2026-01-05', end: endIso }] });
  const p = project({ tasks: [{ id: 'A', pct: 100 }, { id: 'B', dur: 12 }] }); // fin 20/01
  const s = run(p);
  const at = Dates.parse('2026-01-06');
  assert.equal(Metrics.statusLight(p, s, at, null).light, 'green');
  assert.equal(Metrics.statusLight(p, s, at, base('2026-01-12')).light, 'red');    // 6 jours ouvrés
  assert.equal(Metrics.statusLight(p, s, at, base('2026-01-15')).light, 'orange'); // 3 jours ouvrés
  const late = project({ tasks: [{ id: 'A' }, { id: 'B', dur: 12 }] });
  const sl = run(late);
  assert.equal(Metrics.statusLight(late, sl, TODAY, null).light, 'orange'); // A en retard, non critique
  const lateCrit = project({ tasks: [{ id: 'A' }, { id: 'B', dur: 3, deps: ['A'] }] });
  assert.equal(Metrics.statusLight(lateCrit, run(lateCrit), Dates.parse('2026-01-13'), null).light, 'red');
});

// ── 9.6 Gestion de la charge et résolution des conflits (RG-08, RG-33, RG-34) ─────────────────
const { Resolve } = loadCore();
const withMode = (p, leveling) => ({ ...p, leveling });

test('R-65 lissage : décalage dans la marge, fin du projet inchangée', () => {
  const p = project({ resources: [alice], tasks: [
    { id: 'A', dur: 3, assign: ['r1'] }, { id: 'B', dur: 2, assign: ['r1'] }, { id: 'L', dur: 10 }] });
  const s = run(withMode(p, 'smooth'));
  assert.equal(span(s, 'B'), '08/01-09/01');
  assert.equal(iso(s.projectEndDn), '2026-01-16');
  assert.equal(s.conflicts.length, 0);
});

test('R-66 lissage impossible : le conflit reste, la fin ne bouge pas', () => {
  const p = project({ resources: [alice], tasks: [{ id: 'A', dur: 3, assign: ['r1'] }, { id: 'B', dur: 3, assign: ['r1'] }] });
  const smooth = run(withMode(p, 'smooth'));
  assert.equal(span(smooth, 'B'), '05/01-07/01');
  assert.equal(smooth.conflicts.length, 1);
  assert.deepEqual(plain(smooth.warnings.map(w => [w.kind, w.task])), [['smooth', 'B']]);
  const level = run(withMode(p, 'level'));
  assert.equal(span(level, 'B'), '08/01-12/01');
  assert.equal(level.conflicts.length, 0);
});

test('R-67 nivellement désactivé : chaque chevauchement est un conflit', () => {
  const s = run(withMode(project({ resources: [alice, bob], tasks: [
    { id: 'A', dur: 3, assign: ['r1'] }, { id: 'B', dur: 2, assign: ['r1'] }, { id: 'C', dur: 2, assign: ['r2'] }] }), 'off'));
  assert.equal(span(s, 'B'), '05/01-06/01');
  assert.equal(s.conflicts.length, 1);
  assert.deepEqual(plain(s.conflicts[0].tasks), ['A', 'B']);
});

test('R-68 décalage dû au nivellement tracé', () => {
  const s = run(project({ resources: [alice], tasks: [{ id: 'A', dur: 3, assign: ['r1'] }, { id: 'B', dur: 2, assign: ['r1'] }] }));
  assert.deepEqual(plain(s.tasks.get('B').shift), { days: 3, res: 'r1', kind: 'overload' });
  assert.equal(iso(s.tasks.get('B').earliestDn), '2026-01-05');
  assert.equal(s.tasks.get('A').shift, undefined);
  const abs = run(project({ resources: [{ ...alice, absences: [{ start: '2026-01-05', end: '2026-01-06', label: '' }] }], tasks: [{ id: 'A', dur: 2, assign: ['r1'] }] }));
  assert.deepEqual(plain(abs.tasks.get('A').shift), { days: 2, res: 'r1', kind: 'absence' });
});

test('R-69 propositions de résolution simulées et classées', () => {
  const p = project({ resources: [alice, bob], tasks: [{ id: 'A', assign: ['r1'] }, { id: 'B', dur: 3, assign: ['r1'], forcedStart: '2026-01-07' }] });
  const s = run(p);
  const res = Resolve.suggest(p, s);
  assert.equal(res.conflicts.length, 1);
  const opts = res.conflicts[0].options.map(o => [o.kind, o.task, o.to || o.date || '', o.after.conflicts, o.after.endShift]);
  assert.deepEqual(plain(opts), [
    ['reassign', 'A', 'r2', 0, 0],
    ['reassign', 'B', 'r2', 0, 0],
    ['moveForced', 'B', '2026-01-12', 0, 3],
    ['unforce', 'B', '', 0, 3],
    ['sequence', 'A', '', 0, 5], // arbitrage : B avant A
  ]);
  assert.deepEqual(plain(res.global), []);
  // Projet en lissage : la proposition globale « nivellement automatique » apparaît.
  const q = withMode(project({ resources: [alice], tasks: [{ id: 'A', dur: 3, assign: ['r1'] }, { id: 'B', dur: 3, assign: ['r1'] }] }), 'smooth');
  const g = Resolve.suggest(q, run(q)).global;
  assert.deepEqual(plain(g.map(o => [o.kind, o.after.conflicts, o.after.endShift])), [['level', 0, 3]]);
});

test('R-70 arbitrage : faire passer une tâche avant l\'autre', () => {
  const p = withMode(project({ resources: [alice], tasks: [{ id: 'A', dur: 3, assign: ['r1'] }, { id: 'B', dur: 3, assign: ['r1'] }] }), 'smooth');
  const s = run(p);
  const opts = Resolve.suggest(p, s).conflicts[0].options;
  const seq = opts.filter(o => o.kind === 'sequence').map(o => [o.first, o.task, o.after.conflicts, o.after.endShift]);
  assert.deepEqual(plain(seq), [['A', 'B', 0, 3], ['B', 'A', 0, 3]]);
  // Appliquer « A avant B » : un lien fin-début A → B, visible et retirable.
  const q = JSON.parse(JSON.stringify(p));
  opts.find(o => o.kind === 'sequence' && o.first === 'A').mutate(q);
  assert.deepEqual(plain(q.tasks[1].deps), [{ id: 'A', type: 'FS', lag: 0 }]);
  const after = run(q);
  assert.equal(span(after, 'B'), '08/01-12/01');
  assert.equal(after.conflicts.length, 0);
});

// ── Recherche, filtres et regroupements (RG-27, R-53) ─────────────────────────────────────────
const { View } = loadCore();
test('R-53 filtre par catégorie, regroupement par ressource, recherche', () => {
  const p = project({ resources: [alice, bob], tasks: [
    { id: 'P', type: 'summary', dur: 0 },
    { id: 'A', parent: 'P', cat: 'C1', assign: ['r1'] }, { id: 'B', parent: 'P', cat: 'C1', assign: ['r1', 'r2'] },
    { id: 'C', cat: 'C2', notes: 'Prévoir la réunion du comité' }, { id: 'D', cat: 'C2', assign: ['r2'] }, { id: 'E', cat: 'C2' }] });
  p.categories = [{ id: 'C1', name: 'Dév', color: '#4d9fff' }, { id: 'C2', name: 'Études', color: '#36d9a0' }];
  p.tasks.forEach(t => { t.tags = t.tags || []; t.notes = t.notes || ''; });
  const s = run(p);
  const f = { ...View.EMPTY, cat: ['C1'] };
  const sel = View.select(p, s, { filters: f }, TODAY);
  assert.deepEqual(plain([...sel.matched]), ['A', 'B']);
  assert.ok(sel.ids.has('P'), 'la récapitulative parente reste visible');
  const g = View.group(p, s, new Set(p.tasks.map(t => t.id)), 'res', TODAY);
  assert.deepEqual(plain(g.map(x => [x.label || '(sans)', x.ids])), [['Alice', ['A', 'B']], ['Bob', ['B', 'D']], ['(sans)', ['C', 'E']]]);
  assert.deepEqual(plain([g[0].count, g[0].dur]), [2, 10]);
  const q = View.select(p, s, { query: 'REUNION comite' }, TODAY);
  assert.deepEqual(plain([...q.matched]), ['C']);
  // Aucun calcul n'est modifié par l'affichage.
  assert.equal(iso(run(p).projectEndDn), iso(s.projectEndDn));
});

test('filtres combinés : ET entre critères, OU dans un critère, période, sans ressource', () => {
  const p = project({ resources: [alice], tasks: [{ id: 'A', assign: ['r1'] }, { id: 'B', deps: ['A'] }, { id: 'C', dur: 2 }] });
  p.tasks.forEach(t => { t.tags = []; t.notes = ''; t.cat = ''; });
  const s = run(p);
  const ids = f => plain([...View.select(p, s, { filters: { ...View.EMPTY, ...f } }, TODAY).matched]);
  assert.deepEqual(ids({ res: [''] }), ['B', 'C']);
  assert.deepEqual(ids({ res: ['', 'r1'] }), ['A', 'B', 'C']);
  assert.deepEqual(ids({ res: [''], critical: true }), ['B']);
  assert.deepEqual(ids({ from: '2026-01-12', to: '2026-01-12' }), ['B']);
  assert.deepEqual(ids({ status: ['late'] }), ['A', 'C']);
});
