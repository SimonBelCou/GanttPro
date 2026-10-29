// Étape B, lot baselines : scénarios R-85 et R-86 (cahier des charges, 9.7), calcul seul.
//   node --test tests/core/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './load.mjs';

const { Model, Evm } = loadCore();
const plain = x => JSON.parse(JSON.stringify(x));

const file = (o = {}) => ({ format: 3, name: 'T', projectStart: '2026-01-05', tasks: [{ id: 'A', name: 'a', type: 'task', dur: 5 }], ...o });
const bl = (i, extra = {}) => ({
  id: 'X' + i, name: 'Baseline ' + i, color: '#f0b429', createdAt: i, projectStart: '2026-01-05',
  tasks: [{ id: 'A', name: 'a', dur: 5, deps: [], cat: '', start: '2026-01-05', end: '2026-01-09', budget: 10000 }], ...extra,
});
const key = o => { try { Model.sanitize(file(o)); return null; } catch (e) { return e.params && e.params.field ? e.key + ':' + e.params.field : e.key; } };

test('R-85 dix baselines au plus, la onzième est refusée', () => {
  assert.equal(Model.LIMITS.baselines, 10);
  const ten = Array.from({ length: 10 }, (_, i) => bl(i + 1, { shownOnGantt: false, shownOnScurve: false }));
  assert.equal(Model.sanitize(file({ baselines: ten })).project.baselines.length, 10);
  const eleven = Array.from({ length: 11 }, (_, i) => bl(i + 1));
  assert.equal(key({ baselines: eleven }), 'imp.tooMany');
});

test('R-85 trois baselines affichées au plus par vue : un fichier plus généreux est ramené à ces bornes', () => {
  const five = Array.from({ length: 5 }, (_, i) => bl(i + 1, { shownOnGantt: true, shownOnScurve: i % 2 === 0 }));
  const p = Model.sanitize(file({ baselines: five })).project;
  assert.deepEqual(plain(p.baselines.map(b => b.shownOnGantt)), [true, true, true, false, false]);
  // Courbe en S : demandées sur les baselines 1, 3 et 5, toutes retenues (trois).
  assert.deepEqual(plain(p.baselines.map(b => b.shownOnScurve)), [true, false, true, false, true]);
  const six = Array.from({ length: 6 }, (_, i) => bl(i + 1, { shownOnGantt: false, shownOnScurve: true }));
  const q = Model.sanitize(file({ baselines: six })).project;
  assert.deepEqual(plain(q.baselines.map(b => b.shownOnScurve)), [true, true, true, false, false, false]);
  assert.equal(Model.LIMITS.baselinesShown, 3);
});

test('R-85 une seule baseline initiale', () => {
  const p = Model.sanitize(file({ baselines: [bl(1), bl(2, { initial: true }), bl(3, { initial: true })] })).project;
  assert.deepEqual(plain(p.baselines.map(b => b.initial)), [false, true, false]);
  assert.equal(key({ baselines: [bl(1, { initial: 'oui' })] }), 'imp.field:initial');
  // Absent, « initial » vaut faux.
  assert.equal(Model.sanitize(file({ baselines: [bl(1)] })).project.baselines[0].initial, false);
});

test('R-86 référence de la valeur acquise : choix du projet, sinon initiale, sinon première, sinon planning actuel', () => {
  const base = file({ baselines: [bl(1), bl(2, { initial: true }), bl(3)] });
  const ref = o => { const p = Model.sanitize({ ...base, ...o }).project; const r = Evm.reference(p); return r ? r.name : null; };
  assert.equal(ref({}), 'Baseline 2', 'par défaut : la baseline initiale');
  assert.equal(ref({ baselineRef: 'X3' }), 'Baseline 3', 'le choix enregistré dans le projet');
  assert.equal(ref({ baselineRef: 'inconnue' }), 'Baseline 2', 'une référence inconnue retombe sur la baseline initiale');
  const noInitial = file({ baselines: [bl(1), bl(2)] });
  assert.equal(Evm.reference(Model.sanitize(noInitial).project).name, 'Baseline 1', 'sans baseline initiale : la première');
  assert.equal(Evm.reference(Model.sanitize(file()).project), null, 'sans baseline : planning actuel');
});

test('R-86 la référence survit à l\'écriture, à la relecture et à l\'export sans montants', () => {
  const p = Model.sanitize(file({ baselines: [bl(1), bl(2), bl(3)], baselineRef: 'X3' })).project;
  assert.equal(p.baselineRef, 'B3', 'identifiants internes renumérotés, la référence suit');
  for (const amounts of [true, false]) {
    const back = Model.sanitize(JSON.parse(JSON.stringify(Model.serialize(p, { amounts })))).project;
    assert.equal(Evm.reference(back).name, 'Baseline 3');
  }
  assert.equal(key({ baselineRef: 12 }), 'imp.field:baselineRef');
  assert.equal(key({ baselineRef: 'x'.repeat(65) }), 'imp.field:baselineRef');
});

test('R-86 un fichier sans champ de l\'étape B s\'ouvre avec les valeurs par défaut', () => {
  const p = Model.sanitize(file()).project;
  assert.deepEqual(plain([p.evmGreen, p.evmRed, p.etc, p.baselineRef, p.statusPoints.length]), [100, 90, null, '', 0]);
  const s = Model.serialize(p);
  assert.deepEqual(plain([s.evmGreen, s.evmRed, 'etc' in s, s.baselineRef, s.statusPoints]), [100, 90, false, '', []]);
  assert.equal(Model.newProject('2026-01-05', 1).evmGreen, 100);
});
