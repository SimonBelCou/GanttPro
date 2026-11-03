// Étape B, valeur acquise : scénarios R-80 à R-82 (Specs_fonctionnelles.md, 9.7), calcul seul.
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

// Courbes PV / EV / AC dans le temps (EF-151, RG-59). Baseline initiale : A (100 €, fin 09/01) puis B (100 €, fin 16/01).
// Aujourd'hui = mercredi 14/01/2026 ; A terminée (coût réel 90 €), B à 40 % (coût réel 60 €) : EV 140 €, AC 150 €.
const withRef = (points = [], extra = {}) => {
  const p = base({ statusPoints: points, ...extra }, { pct: 100, actual: eur(90) });
  p.tasks[1].pct = 40; p.tasks[1].actual = eur(60);
  const s = Schedule.compute(p);
  p.baselines = [{ id: 'B1', name: 'Initiale', initial: true, tasks: p.tasks.map(t => ({ id: t.id, budget: t.budget, end: Dates.toISO(s.tasks.get(t.id).endDn) })) }];
  return p;
};
const pts = [
  { id: 'S1', date: '2026-01-07', label: 'Lundi', cpi: 83, spi: 50, ev: eur(50), ac: eur(60) },
  { id: 'S2', date: '2026-01-09', label: 'Revue', cpi: 57, spi: 80, ev: eur(80), ac: eur(140) },
  { id: 'S3', date: '2026-01-09', label: 'Relu sans montants', cpi: 57, spi: 80, ev: null, ac: null },
  { id: 'S4', date: '2026-02-20', label: 'Futur', cpi: 100, spi: 100, ev: eur(1), ac: eur(1) },
];
const curvesOf = (p, unit = 'week', day = '2026-01-14') => Evm.curves(p, Schedule.compute(p), Dates.parse(day), unit);

test('R-101 courbes PV / EV / AC par semaine : PV continue, EV et AC aux seules mesures', () => {
  const c = curvesOf(withRef(pts));
  assert.equal(c.reason, null);
  assert.equal(c.periods.length, 2);
  assert.deepEqual(plain(c.pv), [eur(100), eur(200)]);
  assert.deepEqual(plain(c.ev), [eur(80), eur(140)], 'semaine 1 : le point le plus récent (09/01) ; semaine 2 : aujourd\'hui');
  assert.deepEqual(plain(c.ac), [eur(140), eur(150)], 'AC = coût réel total (RG-47), pas la courbe réelle des coûts (RG-38)');
  assert.deepEqual(plain(c.marks.map(m => [Dates.toISO(m.dn), m.label, m.today])), [['2026-01-09', 'Revue', false], ['2026-01-14', '', true]]);
  assert.equal(c.skipped, 2, 'un point sans montants et un point daté après aujourd\'hui ne sont pas tracés');
  assert.equal(c.bac, eur(200));
});

test('R-101 par mois, sans point, et période sans mesure', () => {
  const m = curvesOf(withRef(pts), 'month');
  assert.deepEqual(plain([m.pv, m.ev, m.ac]), [[eur(200)], [eur(140)], [eur(150)]], 'la mesure du jour l\'emporte dans sa période');
  const late = curvesOf(withRef([pts[0]]), 'week', '2026-01-28');
  assert.deepEqual(plain(late.pv), [eur(100), eur(200), eur(200), eur(200)]);
  assert.deepEqual(plain(late.ev), [eur(50), null, null, eur(140)], 'aucune valeur inventée hors mesure');
  assert.equal(late.marks[1], null);
});

test('R-101 sans baseline de référence ou sans budget : la raison, jamais une courbe à 0', () => {
  assert.deepEqual(plain(curvesOf(base({ statusPoints: pts }))), { reason: 'noBaseline' });
  const p = withRef();
  for (const bt of p.baselines[0].tasks) bt.budget = 0;
  assert.equal(curvesOf(p).reason, 'noBudget');
  // La PV suit la baseline de référence, pas le planning actuel (B2) : budget de B porté à 500 € après la capture.
  const q = withRef(); q.tasks[1].budget = eur(500);
  assert.deepEqual(plain(curvesOf(q).pv), [eur(100), eur(200)]);
});
