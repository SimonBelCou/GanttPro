// Contrôles à l'import et format de fichier (cahier des charges, sections 8 et 9.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './load.mjs';

const { Model, Schedule } = loadCore();
const plain = x => JSON.parse(JSON.stringify(x));

/** Exécute fn et renvoie la clé d'erreur (ou null si accepté). */
function errorKey(fn) {
  try { fn(); return null; } catch (e) { if (e instanceof Model.Invalid) return e.key; throw e; }
}
const imp = obj => Model.parseFile(JSON.stringify(obj));
const keyOf = obj => errorKey(() => imp(obj));
const task = (id, o = {}) => ({ id, name: 'Tâche ' + id, dur: 5, ...o });

test('un projet minimal est accepté avec les valeurs par défaut', () => {
  const r = imp({ tasks: [task('A')] });
  assert.equal(r.project.tasks[0].type, 'task');
  assert.equal(r.project.calendar.holidays, 'FR');
  assert.equal(r.notices.unknown, 0);
});

test('fichier de la version 2.3 : liens par identifiant, ressource et catégorie par nom', () => {
  const r = imp({
    name: 'Démo', projectStart: '2026-01-05', color: '#fff',
    tasks: [task('A', { res: 'Alice', cat: 'Dev', pct: 100, realEnd: '2026-01-09' }), task('B', { deps: ['A'], res: 'Alice', cat: 'Dev', forcedStart: '' })],
    resources: [{ id: 'r1', name: 'Alice', role: 'Dév', color: '#4d9fff' }], categories: [{ id: 'c1', name: 'Dev', color: '#36d9a0' }],
  });
  const [a, b] = r.project.tasks;
  assert.deepEqual(plain(b.deps), [{ id: 'A', type: 'FS', lag: 0 }]);
  assert.deepEqual(plain(a.assign), [{ res: 'R1', units: 100 }]);
  assert.equal(a.cat, 'C1');
  assert.equal(r.notices.unknown, 1); // « color » de la 2.3 est ignoré et compté
});

test('R-27 refus : identifiant dangereux, fichier trop gros, trop de tâches, boucle', () => {
  assert.equal(keyOf({ tasks: [task('<img src=x>')] }), 'imp.badId');
  assert.equal(errorKey(() => Model.parseFile('{"tasks":[],"pad":"' + 'x'.repeat(5 * 1024 * 1024) + '"}')), 'imp.tooBig');
  assert.equal(keyOf({ tasks: Array.from({ length: 1001 }, (_, i) => task('T' + i)) }), 'imp.tooMany');
  assert.equal(keyOf({ tasks: [task('A', { deps: ['B'] }), task('B', { deps: ['A'] })] }), 'imp.cycle');
  try { imp({ tasks: [task('A', { deps: ['B'] }), task('B', { deps: ['A'] })] }); } catch (e) { assert.equal(e.params.path, 'A → B → A'); }
});

test('R-28 un texte qui ressemble à du code reste un texte', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const r = imp({ tasks: [task('A', { name: evil, notes: evil })], resources: [{ name: evil }] });
  assert.equal(r.project.tasks[0].name, evil);
  assert.equal(r.project.resources[0].name, evil);
});

test('contrôles de forme', () => {
  assert.equal(keyOf([]), 'imp.unreadable');
  assert.equal(errorKey(() => Model.parseFile('pas du json')), 'imp.unreadable');
  assert.equal(keyOf({}), 'imp.noTasks');
  assert.equal(keyOf({ format: 4, tasks: [] }), 'imp.newer');
  assert.equal(keyOf({ tasks: [task('A'), task('A')] }), 'imp.dupId');
  assert.equal(keyOf({ tasks: [task('a')] }), 'imp.badId');
  assert.equal(keyOf({ tasks: [task('A', { dur: 0 })] }), 'imp.field');
  assert.equal(keyOf({ tasks: [task('A', { dur: 3651 })] }), 'imp.field');
  assert.equal(keyOf({ tasks: [task('A', { dur: '5' })] }), 'imp.field');
  assert.equal(keyOf({ tasks: [task('A', { name: '' })] }), 'imp.field');
  assert.equal(keyOf({ tasks: [task('A', { forcedStart: '2026-02-30' })] }), 'imp.field');
  assert.equal(keyOf({ tasks: [task('A', { forcedStart: '9999-01-01' })] }), 'imp.field');
  assert.equal(keyOf({ emoji: '<b>x', tasks: [] }), 'imp.field');
  assert.equal(keyOf({ tasks: [], resources: [{ name: 'A', color: 'red" onmouseover="x' }] }), 'imp.field');
  assert.equal(keyOf({ tasks: [], resources: [{ name: 'Alice' }, { name: 'alice' }] }), 'imp.dupResource');
  assert.equal(keyOf({ tasks: [task('A', { pct: 50, realEnd: '2026-01-09' })] }), 'imp.realEndPct');
});

test('liens : prédécesseur absent, soi-même, doublon, récapitulative, hiérarchie', () => {
  assert.equal(keyOf({ tasks: [task('A', { deps: ['Z'] })] }), 'imp.missingPred');
  assert.equal(keyOf({ tasks: [task('A', { deps: ['A'] })] }), 'imp.selfLink');
  assert.equal(keyOf({ tasks: [task('A'), task('B', { deps: ['A', { id: 'A', type: 'SS' }] })] }), 'imp.dupLink');
  assert.equal(keyOf({ tasks: [task('P', { type: 'summary' }), task('B', { deps: ['P'] })] }), 'imp.linkSummary');
  assert.equal(keyOf({ tasks: [task('A'), task('B', { deps: [{ id: 'A', type: 'XX' }] })] }), 'imp.field');
  assert.equal(keyOf({ tasks: [task('A'), task('B', { deps: [{ id: 'A', lag: 366 }] })] }), 'imp.field');
  assert.equal(keyOf({ tasks: [task('P', { type: 'summary' }), task('A', { parent: 'P' }), task('M', { type: 'milestone', dur: 0, parent: 'P', deps: ['A'] })] }), null);
});

test('hiérarchie : parent valide, 5 niveaux au plus, récapitulative sans lien ni affectation', () => {
  assert.equal(keyOf({ tasks: [task('A'), task('B', { parent: 'A' })] }), 'imp.badParent');
  const chain = n => Array.from({ length: n }, (_, i) => task('S' + i, { type: 'summary', parent: i ? 'S' + (i - 1) : '' }));
  assert.equal(keyOf({ tasks: [...chain(5), task('X', { parent: 'S4' })] }), null);
  assert.equal(keyOf({ tasks: [...chain(6), task('X', { parent: 'S5' })] }), 'imp.tooDeep');
  assert.equal(keyOf({ tasks: [task('P', { type: 'summary', parent: 'Q' }), task('Q', { type: 'summary', parent: 'P' })] }), 'imp.parentCycle');
  assert.equal(keyOf({ tasks: [task('P', { type: 'summary', res: 'Alice' })] }), 'imp.summaryField');
  assert.equal(keyOf({ tasks: [task('P', { type: 'summary', forcedStart: '2026-01-05' })] }), 'imp.summaryField');
});

test('affectations et capacité', () => {
  assert.equal(keyOf({ tasks: [task('A', { assign: [{ res: 'Alice', units: 100 }] })], resources: [{ name: 'Alice', capacity: 50 }] }), 'imp.overCapacity');
  assert.equal(keyOf({ tasks: [task('A', { assign: [{ res: 'Alice', units: 50 }, { res: 'alice', units: 20 }] })] }), 'imp.dupAssign');
  assert.equal(keyOf({ tasks: [task('J', { type: 'milestone', dur: 0, res: 'Alice' })] }), 'imp.milestoneRes');
  const r = imp({ tasks: [task('A', { assign: [{ res: 'Bob', units: 50 }] })] });
  assert.deepEqual(plain(r.notices.createdResources), ['Bob']);
});

test('calendrier', () => {
  assert.equal(keyOf({ tasks: [], calendar: { workDays: [0, 0, 0, 0, 0, 0, 0] } }), 'imp.noWorkday');
  assert.equal(keyOf({ tasks: [], calendar: { holidays: 'US' } }), 'imp.field');
  assert.equal(keyOf({ tasks: [], calendar: { daysOff: [{ start: '2026-01-07' }], daysWorked: [{ start: '2026-01-07', end: '2026-01-07' }] } }), 'imp.calendarClash');
  assert.equal(keyOf({ tasks: [], calendar: { daysOff: [{ start: '2026-01-01', end: '2027-12-31' }] } }), 'imp.tooMany');
});

test('aucune pollution de prototype', () => {
  const r = Model.parseFile('{"tasks":[{"id":"A","name":"x","dur":1,"__proto__":{"polluted":1}}],"__proto__":{"polluted":1}}');
  assert.equal(r.project.polluted, undefined);
  assert.equal(r.project.tasks[0].polluted, undefined);
  assert.equal({}.polluted, undefined);
  assert.equal(r.notices.unknown, 2);
});

test('une version imbriquée est contrôlée comme un projet', () => {
  assert.equal(keyOf({ tasks: [], versions: [{ label: 'v1', ts: 1, state: { tasks: [task('<x>')] } }] }), 'imp.version');
  assert.equal(keyOf({ tasks: [], versions: [{ label: 'v1', ts: 1, state: { tasks: [], versions: [] } }] }), 'imp.version');
});

test('R-26 export puis réimport : projet identique', () => {
  const src = {
    format: 3, name: 'Projet test', projectStart: '2026-01-05', emoji: '🚀', desc: 'd', reportNote: 'n',
    calendar: { workDays: [1, 1, 1, 1, 1, 1, 0], holidays: 'FR-AM', daysOff: [{ start: '2026-01-07', end: '2026-01-07', label: 'pont' }], daysWorked: [] },
    tasks: [
      task('P', { type: 'summary', collapsed: true }),
      task('A', { parent: 'P', assign: [{ res: 'Alice', units: 50 }, { res: 'Bob', units: 100 }], cat: 'Dev', pct: 30, tags: ['urgent'], notes: 'note', comments: [{ ts: 5, text: 'ok' }], deadline: '2026-02-01' }),
      task('B', { deps: ['A', { id: 'P2', type: 'SS', lag: -2 }], forcedStart: '2026-01-20' }),
      task('P2', { type: 'milestone', dur: 0, notBefore: '2026-01-12' }),
    ],
    resources: [{ name: 'Alice', role: 'r', color: '#4d9fff', capacity: 80, absences: [{ start: '2026-01-15', end: '2026-01-16', label: 'congé' }] }, { name: 'Bob', color: '#ff5757' }],
    categories: [{ name: 'Dev', color: '#36d9a0' }],
    baselines: [{ name: 'Initiale', color: '#f0b429', createdAt: 1, projectStart: '2026-01-05', shownOnGantt: true, shownOnScurve: false, tasks: [{ id: 'A', name: 'a', dur: 5, deps: [], cat: 'Dev', start: '2026-01-05', end: '2026-01-09' }] }],
    versions: [{ label: 'v1', ts: 2, state: { tasks: [task('A')] } }],
  };
  const once = imp(src).project;
  const file1 = Model.serialize(once);
  const twice = imp(file1).project;
  assert.deepEqual(plain(Model.serialize(twice)), plain(file1));
  assert.equal(file1.tasks[2].deps[0], 'A');
  assert.deepEqual(plain(file1.tasks[2].deps[1]), { id: 'P2', type: 'SS', lag: -2 });
  assert.equal(file1.tasks[1].res, 'Alice');
});

test('R-29 export sans noms de personnes', () => {
  const p = imp({ tasks: [task('A', { res: 'Alice' }), task('B', { res: 'Bob' })], resources: [{ name: 'Alice', role: 'Cheffe' }, { name: 'Bob' }],
    versions: [{ label: 'v1', ts: 1, state: { tasks: [task('A', { res: 'Alice' })] } }] }).project;
  const f = Model.serialize(p, { anonymize: true });
  assert.deepEqual(plain(f.resources.map(r => [r.name, r.role])), [['Ressource 1', ''], ['Ressource 2', '']]);
  assert.deepEqual(plain(f.tasks.map(t => t.res)), ['Ressource 1', 'Ressource 2']);
  assert.ok(!JSON.stringify(f).includes('Alice'));
});

test('identifiants automatiques A … Z, AA (R-24)', () => {
  const ids = [];
  for (let i = 0; i < 27; i++) ids.push(Model.nextTaskId(ids));
  assert.equal(ids[25], 'Z');
  assert.equal(ids[26], 'AA');
});

test('projet initial valide et calculable', () => {
  const p = Model.newProject('2026-01-05');
  const r = imp(Model.serialize(p));
  assert.equal(r.project.tasks[0].dur, 10);
  assert.doesNotThrow(() => Schedule.compute(r.project));
});
