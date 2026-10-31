// Étape B, valeur acquise : scénarios R-80 à R-82 (cahier des charges, 9.7), calcul seul.
//   node --test tests/core/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './load.mjs';

const { Evm, Model, Schedule, Dates } = loadCore();
const plain = x => JSON.parse(JSON.stringify(x));
const eur = x => Math.round(x * 100);

function project(tasks, extra = {}) {
  const p = Model.newProject('2026-01-05', 1);
  p.tasks = tasks.map(t => ({
    type: 'task', name: t.id, parent: '', dur: 5, deps: [], assign: [], cat: '', pct: 0, forcedStart: '', notBefore: '', deadline: '',
    realStart: '', realEnd: '', tags: [], notes: '', comments: [], collapsed: false, budget: 0, actual: 0, ...t,
    deps: (t.deps || []).map(d => ({ id: d, type: 'FS', lag: 0 })),
  }));
  return Object.assign(p, extra);
}
// A (100 €, 80 %, fin 09/01, coût réel 140 €) puis B (100 €, 0 %, fin 16/01)
const base = (extra = {}, a = {}) => project([
  { id: 'A', budget: eur(100), pct: 80, actual: eur(140), ...a },
  { id: 'B', budget: eur(100), deps: ['A'] },
], extra);
const run = (p, day = '2026-01-09') => Evm.compute(p, Schedule.compute(p), Dates.parse(day));

test('R-80 indicateurs de valeur acquise du cours (PV par palier)', () => {
  const r = run(base({ etc: eur(100) }));
  assert.deepEqual(plain([r.bac, r.pv, r.ev, r.ac, r.cv, r.sv]), [eur(200), eur(100), eur(80), eur(140), -eur(60), -eur(20)]);
  assert.deepEqual(plain([r.cpi.hundredths, r.spi.hundredths]), [57, 80]);
  assert.equal(r.basis, 'plan');
});

test('R-81 trois prévisions à terminaison, BAC / CPI non arrondi', () => {
  const r = run(base({ etc: eur(100) }));
  assert.deepEqual(plain([r.eac.byCpi.cents, r.eac.byEtc.cents, r.eac.byEv.cents]), [eur(350), eur(240), eur(260)]);
  assert.deepEqual(plain([r.eac.byCpi.vac, r.eac.byEtc.vac, r.eac.byEv.vac]), [-eur(150), -eur(40), -eur(60)]);
  assert.equal(run(base()).eac.byEtc.reason, 'noEtc');
});

test('R-82 voyants sur la valeur affichée, seuils du projet', () => {
  assert.deepEqual(plain([run(base()).cpi.light, run(base()).spi.light]), ['red', 'red']);
  const r = run(base({ evmGreen: 100, evmRed: 50 }));
  assert.deepEqual(plain([r.cpi.light, r.spi.light]), ['orange', 'orange']);
  assert.equal(Evm.lightOf(99, { evmGreen: 100, evmRed: 90 }), 'orange');
  assert.equal(Evm.lightOf(100, { evmGreen: 100, evmRed: 90 }), 'green');
  assert.equal(Evm.lightOf(89, { evmGreen: 100, evmRed: 90 }), 'red');
});

test('R-82 non calculable : jamais 0 ni infini, avec la raison', () => {
  const none = run(project([{ id: 'A' }]));
  assert.deepEqual(plain([none.cpi.value, none.cpi.reason, none.spi.reason, none.eac.byCpi.reason]), [null, 'noBudget', 'noBudget', 'noBudget']);
  const noAc = run(base({}, { actual: 0 }));
  assert.equal(noAc.cpi.reason, 'noActual');
  assert.equal(noAc.eac.byCpi.reason, 'noActual');
  const early = run(base(), '2026-01-05');
  assert.equal(early.pv, 0);
  assert.equal(early.spi.reason, 'noPlanned');
  assert.equal(run(base({}, { pct: 0 })).eac.byCpi.reason, 'noEarned');
});

test('R-82 provision exclue des indicateurs', () => {
  assert.deepEqual(plain([run(base({ provision: eur(50) })).bac]), [eur(200)]);
});

test('R-87 baseline de référence : budgets et fins figés, tâches ajoutées/supprimées signalées', () => {
  const p = base({ etc: eur(100) });
  const s = Schedule.compute(p);
  p.baselines = [{ id: 'B1', name: 'Initiale', initial: true, tasks: p.tasks.map(t => ({ id: t.id, budget: t.budget, end: Dates.toISO(s.tasks.get(t.id).endDn) })) }];
  p.baselineRef = 'B1';
  p.tasks[0].dur = 10; // glissement du plan actuel
  p.tasks[0].budget = eur(500); // le plan actuel change, la référence non
  p.tasks.push(...project([{ id: 'C', budget: eur(10), actual: eur(5) }]).tasks);
  const r = run(p);
  assert.equal(r.basis, 'baseline');
  assert.deepEqual(plain([r.bac, r.pv, r.ev]), [eur(200), eur(100), eur(80)]);
  assert.deepEqual(plain(r.added), ['C']);
  p.tasks = p.tasks.filter(t => t.id !== 'B');
  assert.deepEqual(plain(run(p).removed), ['B']);
});

test('R-88 point de situation : photo des indicateurs', () => {
  const pt = Evm.point(run(base({ etc: eur(100) })), '  Revue 1 ');
  assert.deepEqual(plain(pt), { date: '2026-01-09', label: 'Revue 1', ref: '', cpi: 57, spi: 80, bac: eur(200), pv: eur(100), ev: eur(80), ac: eur(140), etc: eur(100) });
});

test('R-88 produits au-delà de 2^53 sans perte', () => {
  assert.equal(Evm.divRound(5000000000000, 4000000000000, 5000000000000), 6250000000000); // produit 2,5e25, résultat exact
  assert.equal(Evm.divRound(5000000000000, 3, 5000000000000), null, 'résultat hors limite : refusé, pas faux');
  assert.equal(Evm.divRound(9007199254740991, 1, 9007199254740991), null);
  assert.equal(Evm.divRound(1, 3), 0);
  assert.equal(Evm.divRound(1, 2), 1);
});

test('R-88 les points de situation survivent à la relecture ; l\'export sans montants garde les indices et retire les montants', () => {
  const p = Model.sanitize({ format: 3, name: 'T', projectStart: '2026-01-05', tasks: [{ id: 'A', name: 'a', type: 'task', dur: 5, budget: 10000 }],
    statusPoints: [{ date: '2026-01-09', label: 'Revue', cpi: 57, spi: 80, bac: 20000, pv: 10000, ev: 8000, ac: 14000, etc: 100 }] }).project;
  assert.equal(p.statusPoints.length, 1);
  const full = Model.serialize(p, { amounts: true }).statusPoints[0];
  assert.deepEqual(plain([full.cpi, full.spi, full.ev]), [57, 80, 8000]);
  const bare = Model.serialize(p, { amounts: false }).statusPoints[0];
  assert.deepEqual(plain([bare.cpi, bare.spi, 'ev' in bare, 'ac' in bare, 'pv' in bare, 'bac' in bare, 'etc' in bare]), [57, 80, false, false, false, false, false]);
  assert.throws(() => Model.sanitize({ format: 3, name: 'T', projectStart: '2026-01-05', tasks: [{ id: 'A', name: 'a', type: 'task', dur: 1 }], statusPoints: Array.from({ length: 61 }, () => ({ date: '2026-01-09' })) }));
});

test('divRound : le calcul rapide sans BigInt donne exactement le même arrondi que BigInt', () => {
  const ref = (a, b, k) => { const A = BigInt(a) * BigInt(k), B = BigInt(b), q = (2n * A + B) / (2n * B); return q > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(q); };
  let seed = 7; const rnd = m => { seed = (seed * 1103515245 + 12345) % 2147483648; return Math.floor((seed / 2147483648) * m); };
  const cases = [[0, 1, 1], [1, 2, 1], [3, 2, 1], [5, 10, 1], [15, 10, 1], [25, 10, 1], [12345, 100, 33], [10010 * 3, 100, 33],
    [2 ** 52, 3, 1], [2 ** 51, 7, 3], [Model.LIMITS.amount, 100, 100], [Model.LIMITS.amount * 1000, 7, 1], [9007199254740991, 2, 1]];
  for (let i = 0; i < 20000; i++) {
    const big = i % 4 === 0;
    cases.push([rnd(big ? 2 ** 30 : 1e6) * (big ? 2 ** 20 : 1), 1 + rnd(big ? 2 ** 30 : 1000), rnd(big ? 2 ** 10 : 101)]);
  }
  for (const [a, b, k] of cases) assert.equal(Evm.divRound(a, b, k), ref(a, b, k), `${a} x ${k} / ${b}`);
});
