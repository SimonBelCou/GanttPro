// Scénarios chiffrés de la recette (cahier des charges, section 9) : calcul seul.
//   node --test tests/core/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './load.mjs';

const { Schedule, Metrics, Dates, Calendar } = loadCore();
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

// Jeux de jours fériés ajoutés le 15/10/2026 (arbitrage A.3 n° 9). Dates de référence : gov.uk/bank-holidays (Angleterre
// et pays de Galles), opm.gov (jours fédéraux, dates observées), seco.admin.ch (1er août) et jours cantonaux courants.
const holidayList = (set, y) => [...Calendar.holidaysOf(set, y).keys()].sort((a, b) => a - b).map(dn => iso(dn).slice(0, 10));

test('R-11 bis Royaume-Uni (Angleterre et pays de Galles) 2026 et 2027, avec jours de remplacement', () => {
  assert.deepEqual(plain(holidayList('GB', 2026)), ['2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28']);
  assert.deepEqual(plain(holidayList('GB', 2027)), ['2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28']);
  // Noël un dimanche et lendemain de Noël un lundi (2022) : Noël est remplacé le mardi ; le 1er janvier un samedi (2022) par le lundi 3.
  const y22 = holidayList('GB', 2022);
  assert.ok(y22.includes('2022-12-26') && y22.includes('2022-12-27') && y22.includes('2022-01-03'));
  assert.ok(!y22.includes('2022-12-25') && !y22.includes('2022-01-01'));
  assert.equal(Calendar.holidaysOf('GB', 2022).get(Dates.parse('2022-12-27')), 'hol.christmas');
});

test('R-11 ter États-Unis 2026 et 2027 : jours fédéraux en dates observées', () => {
  assert.deepEqual(plain(holidayList('US', 2026)), ['2026-01-01', '2026-01-19', '2026-02-16', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-10-12', '2026-11-11', '2026-11-26', '2026-12-25']);
  // 2027 : le 19 juin et Noël tombent un samedi (observés le vendredi), le 4 juillet un dimanche (observé le lundi) ;
  // le 1er janvier 2028 tombe un samedi : il est observé le vendredi 31 décembre 2027.
  assert.deepEqual(plain(holidayList('US', 2027)), ['2027-01-01', '2027-01-18', '2027-02-15', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-10-11', '2027-11-11', '2027-11-25', '2027-12-24', '2027-12-31']);
  // Le 1er janvier 2028 n'est plus férié (observé la veille) ; Juneteenth n'existe pas avant 2021.
  assert.ok(!holidayList('US', 2028).includes('2028-01-01') && !holidayList('US', 2028).includes('2027-12-31'));
  assert.ok(!holidayList('US', 2020).some(d => d.endsWith('-06-19')));
});

test('R-11 quater Suisse 2026 : 1er août et jours observés dans presque tous les cantons', () => {
  assert.deepEqual(plain(holidayList('CH', 2026)), ['2026-01-01', '2026-04-03', '2026-05-14', '2026-08-01', '2026-12-25']);
});

test('R-11 quinquies chaque jour férié des nouveaux jeux a un libellé français et anglais', () => {
  const { I18n } = loadCore();
  for (const set of ['GB', 'US', 'CH']) {
    assert.ok(Calendar.HOLIDAY_SETS.includes(set));
    for (const lang of ['fr', 'en']) {
      I18n.setLang(lang);
      assert.notEqual(I18n.t('cal.set.' + set), 'cal.set.' + set, `${set} ${lang} libellé du jeu`);
      for (let y = 2020; y <= 2035; y++) {
        for (const key of Calendar.holidaysOf(set, y).values()) assert.notEqual(I18n.t(key), key, `${set} ${y} ${key} ${lang}`);
      }
    }
  }
  I18n.setLang('fr');
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

test('R-22 avancement global : moyenne simple, poids 1 par tâche (arbitrage A.3 du 15/10/2026)', () => {
  // A (2 jours) terminée et B (8 jours) non commencée : 50 %, et non 20 % comme avec un poids égal à la durée.
  assert.equal(Metrics.globalProgress(project({ tasks: [{ id: 'A', dur: 2, pct: 100 }, { id: 'B', dur: 8 }] })), 50);
});

test('R-23 courbe en S : une tâche terminée vaut 1 point', () => {
  const p = project({ tasks: [{ id: 'T1', pct: 100, realEnd: '2026-01-09' }, { id: 'T2', pct: 40, deps: ['T1'] }] });
  const s = run(p);
  const w = Metrics.sCurve(p, s, TODAY, 'week');
  assert.deepEqual(plain(w.planned), [50, 100]);
  // T1 est terminée le 09/01 (semaine 1) ; T2 à 40 % ne compte pas : l'avancement partiel n'entre pas dans la courbe.
  assert.deepEqual(plain(w.real), [50, 50]);
  const m = Metrics.sCurve(p, s, TODAY, 'month');
  assert.deepEqual(plain([m.planned, m.real]), [[100], [50]]);
});

test('R-23 bis courbe en S : le poids ne dépend pas de la durée, une tâche à 100 % sans fin réelle compte dans la période en cours', () => {
  const p = project({ tasks: [{ id: 'A', dur: 1, pct: 100 }, { id: 'B', dur: 9, deps: ['A'] }] });
  const s = run(p);
  const w = Metrics.sCurve(p, s, TODAY, 'week');
  // A finit le 05/01 (semaine 1) : 1 tâche sur 2 = 50 %, et non 10 %. B finit le 16/01 (semaine 2).
  assert.deepEqual(plain(w.planned), [50, 100]);
  // Sans fin réelle, A n'est pas comptée dans la semaine passée ; elle l'est dans la semaine en cours.
  assert.deepEqual(plain(w.real), [0, 50]);
});

test('R-23 ter récapitulative : avancement = moyenne simple de ses tâches enfants', () => {
  const p = project({ tasks: [{ id: 'S', type: 'summary' }, { id: 'A', parent: 'S', dur: 2, pct: 100 }, { id: 'B', parent: 'S', dur: 8, pct: 0 }] });
  assert.equal(run(p).tasks.get('S').pct, 50);
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

test('RG-28 rapport : avancement prévu à ce jour, retards triés, échéances proches', () => {
  // Aujourd'hui 14/01 : A (05-09, 100 %), B (12-16, 0 %, dépend de A), C (05-07 imposée, 0 %), J jalon le 23/01.
  const p = project({ tasks: [{ id: 'A', pct: 100 }, { id: 'B', deps: ['A'] }, { id: 'C', dur: 3, pct: 0 },
    { id: 'D', dur: 2, forcedStart: '2026-01-26' }, { id: 'J', type: 'milestone', dur: 0, forcedStart: '2026-01-23' }] });
  const s = run(p);
  const r = Metrics.report(p, s, TODAY, null);
  // Prévu à ce jour, poids 1 par tâche : A 1 + B 3/5 (12, 13, 14) + C 1 + D 0 = 2,6 sur 4 tâches = 65 %.
  assert.equal(Math.round(r.planned * 100) / 100, 65);
  // Réel : une tâche sur quatre à 100 % (le jalon ne compte pas) = 25 %.
  assert.equal(Math.round(r.progress), 25);
  assert.deepEqual(plain(r.late.map(x => [x.id, x.dev])), [['C', 5]]);
  assert.deepEqual(plain(r.soon), ['J', 'D']);
  assert.deepEqual(plain(r.msNext), ['J']);
  assert.equal(r.light, 'orange');
});
