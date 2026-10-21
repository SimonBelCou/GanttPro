// Budget, étape A : scénarios de la recette R-71 à R-79 et R-83 (cahier des charges, 9.7), calcul seul.
//   node --test tests/core/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './load.mjs';

const { Budget, Model, Schedule, Dates, I18n, Exchange, Csv, Xlsx } = loadCore();
const plain = x => JSON.parse(JSON.stringify(x));
const eur = x => Math.round(x * 100); // euros d'exemple -> centimes

function project(tasks, extra = {}) {
  const p = Model.newProject('2026-01-05', 1);
  p.tasks = tasks.map(t => ({
    type: 'task', name: t.id, parent: '', dur: 5, deps: [], assign: [], cat: '', pct: 0, forcedStart: '', notBefore: '', deadline: '',
    realStart: '', realEnd: '', tags: [], notes: '', comments: [], collapsed: false, budget: 0, actual: 0, ...t,
    deps: (t.deps || []).map(d => ({ id: d, type: 'FS', lag: 0 })),
  }));
  return Object.assign(p, extra);
}
const norm = s => s.replace(/[  ]/g, ' ');
const file = (o = {}) => ({ format: 3, name: 'T', projectStart: '2026-01-05', tasks: [{ id: 'A', name: 'a', type: 'task', dur: 5 }], ...o });

test('R-71 saisie d\'un montant : virgule ou point, deux décimales au plus, bornes', () => {
  assert.deepEqual(plain(Budget.parse('1 234,56')), { ok: true, cents: 123456 });
  assert.deepEqual(plain(Budget.parse('1234.5')), { ok: true, cents: 123450 });
  assert.deepEqual(plain(Budget.parse('')), { ok: true, cents: 0 });
  assert.deepEqual(plain(Budget.parse('12,345')), { ok: false, reason: 'decimals' });
  assert.deepEqual(plain(Budget.parse('-5')), { ok: false, reason: 'negative' });
  assert.deepEqual(plain(Budget.parse('50 000 000 000,01')), { ok: false, reason: 'max' });
  assert.deepEqual(plain(Budget.parse('50 000 000 000')), { ok: true, cents: 5000000000000 });
  assert.deepEqual(plain(Budget.parse('1,234.56')), { ok: false, reason: 'format' });
  assert.deepEqual(plain(Budget.parse('abc')), { ok: false, reason: 'format' });
  assert.deepEqual(plain(Budget.parse('99999999999999999999')), { ok: false, reason: 'max' });
  assert.deepEqual(plain(Budget.parse('1 200 €', '€')), { ok: true, cents: 120000 }); // RG-42 : symbole ignoré
  assert.equal(Budget.toInput(123450, 'fr'), '1234,5');
  assert.equal(Budget.toInput(123456, 'en'), '1234.56');
  assert.equal(Budget.toInput(120000, 'fr'), '1200');
});

test('R-72 BAC, budget total, coût réel total, reste, dépassement', () => {
  const p = project([{ id: 'A', budget: eur(100), actual: eur(120) }, { id: 'B', budget: eur(250.5) }, { id: 'C', budget: eur(49.5) },
    { id: 'M', type: 'milestone', dur: 0 }], { provision: eur(40) });
  assert.deepEqual(plain(Budget.totals(p)), { bac: 40000, provision: 4000, total: 44000, actual: 12000, remaining: 32000 });
  p.tasks[0].actual = eur(450);
  assert.equal(Budget.totals(p).remaining, -1000);
});

test('R-73 récapitulative = somme de sa descendance, sans double compte dans le BAC', () => {
  const p = project([{ id: 'S', type: 'summary', dur: 0 }, { id: 'A', parent: 'S', budget: eur(100), actual: eur(30) }, { id: 'B', parent: 'S', budget: eur(300) }]);
  assert.deepEqual(plain(Budget.amounts(p).get('S')), { budget: 40000, actual: 3000 });
  assert.equal(Budget.totals(p).bac, 40000);
  p.tasks.splice(2, 1);
  assert.deepEqual(plain(Budget.amounts(p).get('S')), { budget: 10000, actual: 3000 });
  p.tasks.splice(1, 1);
  assert.deepEqual(plain(Budget.amounts(p).get('S')), { budget: 0, actual: 0 });
});

test('R-73 bis : récapitulatives imbriquées', () => {
  const p = project([{ id: 'S', type: 'summary', dur: 0 }, { id: 'T', type: 'summary', parent: 'S', dur: 0 }, { id: 'A', parent: 'T', budget: 500 }, { id: 'B', parent: 'S', budget: 700 }]);
  const a = Budget.amounts(p);
  assert.equal(a.get('T').budget, 500);
  assert.equal(a.get('S').budget, 1200);
  assert.equal(Budget.totals(p).bac, 1200);
});

/** Données de R-74 : T1 terminée, T2 à 40 %, aujourd'hui mercredi 14/01/2026. */
function r74() {
  return project([{ id: 'T1', pct: 100, realEnd: '2026-01-09', budget: eur(100), actual: eur(90) },
    { id: 'T2', deps: ['T1'], pct: 40, budget: eur(300), actual: eur(100) }]);
}
test('R-74 courbe des coûts par semaine et par mois', () => {
  const p = r74(), s = Schedule.compute(p), today = Dates.parse('2026-01-14');
  const w = Budget.costCurve(p, s, today, 'week');
  assert.deepEqual(plain(w.planned), [10000, 40000]);
  assert.deepEqual(plain(w.real), [9000, 9000]); // les 100,00 de T2, non terminée, n'y figurent pas
  assert.equal(Budget.totals(p).actual, 19000);
  const m = Budget.costCurve(p, s, today, 'month');
  assert.deepEqual(plain(m.planned), [40000]);
  assert.deepEqual(plain(m.real), [9000]);
});

test('R-74 bis : tâche à 100 % sans fin réelle, comptée dans la période en cours seulement', () => {
  const p = project([{ id: 'T1', pct: 100, budget: 1000, actual: 800 }]);
  const s = Schedule.compute(p);
  assert.deepEqual(plain(Budget.costCurve(p, s, Dates.parse('2026-01-08'), 'week').real), [800]); // période en cours : comptée
  assert.deepEqual(plain(Budget.costCurve(p, s, Dates.parse('2026-01-14'), 'week').real), [0]); // période passée sans fin réelle : non comptée (RG-20)
});

test('R-75 baseline : budgets et provision capturés, BAC et variation', () => {
  const p = r74();
  p.tasks[0].budget = eur(100); p.tasks[1].budget = eur(300); p.provision = eur(40);
  const bl = { id: 'B1', name: 'B1', color: '#f0b429', createdAt: 0, projectStart: p.projectStart, shownOnGantt: true, shownOnScurve: true, provision: p.provision,
    tasks: p.tasks.map(t => ({ id: t.id, name: t.id, dur: 5, deps: [], cat: '', start: t.id === 'T1' ? '2026-01-05' : '2026-01-12', end: t.id === 'T1' ? '2026-01-09' : '2026-01-16', budget: t.budget })) };
  p.baselines = [bl];
  p.tasks[1].budget = eur(350);
  assert.equal(Budget.baselineBac(bl), 40000);
  assert.equal(Budget.totals(p).bac, 45000);
  assert.equal(Budget.bacVariation(p, bl), 5000);
  const c = Budget.costCurve(p, Schedule.compute(p), Dates.parse('2026-01-14'), 'week');
  assert.deepEqual(plain(c.baselines.B1), [10000, 40000]);
});

test('R-76 export sans montants : aucun montant, la devise reste', () => {
  const p = r74(); p.provision = eur(40); p.currency = 'CHF';
  p.baselines = [{ id: 'B1', name: 'B', color: '#fff', createdAt: 0, projectStart: p.projectStart, shownOnGantt: true, shownOnScurve: true, provision: 4000,
    tasks: [{ id: 'T1', name: 'x', dur: 5, deps: [], cat: '', start: '2026-01-05', end: '2026-01-09', budget: 10000 }] }];
  const withAmounts = Model.serialize(p);
  assert.equal(withAmounts.provision, 4000);
  assert.equal(withAmounts.tasks[0].budget, 10000);
  p.versions = [{ id: 'V1', label: 'v', ts: 1, state: Model.serialize(p, { withVersions: false }) }];
  const without = Model.serialize(p, { amounts: false });
  const text = JSON.stringify(without);
  assert.ok(!/"(budget|actual|provision)"/.test(text), 'aucun champ de montant, y compris dans les baselines et les versions');
  assert.equal(without.currency, 'CHF');
  // Le projet ouvert (et l'état de ses versions) n'est pas modifié.
  assert.equal(p.versions[0].state.provision, 4000);
  assert.equal(p.versions[0].state.tasks[0].budget, 10000);
});

test('R-77 import : fichier sans montant, bornes, jalon et récapitulative', () => {
  const r = Model.sanitize(file());
  assert.equal(r.project.currency, '€');
  assert.equal(r.project.provision, 0);
  assert.deepEqual([r.project.tasks[0].budget, r.project.tasks[0].actual], [0, 0]);
  const key = o => { try { Model.sanitize(file(o)); return null; } catch (e) { return e.params && e.params.field ? e.key + ':' + e.params.field : e.key; } };
  const t = extra => ({ tasks: [{ id: 'A', name: 'a', type: 'task', dur: 5, ...extra }] });
  assert.equal(key(t({ budget: -500 })), 'imp.field:budget');
  assert.equal(key(t({ budget: 1.5 })), 'imp.field:budget');
  assert.equal(key(t({ budget: 5000000000001 })), 'imp.field:budget');
  assert.equal(key(t({ actual: '12' })), 'imp.field:actual');
  assert.equal(key(t({ budget: 5000000000000 })), null);
  assert.equal(key({ provision: 5000000000001 }), 'imp.field:provision');
  assert.equal(key({ currency: '' }), 'imp.field:currency');
  assert.equal(key({ currency: 'ABCDEF' }), 'imp.field:currency');
  assert.equal(key({ currency: 'A\u0007' }), 'imp.field:currency');
  assert.equal(key({ tasks: [{ id: 'M', name: 'j', type: 'milestone', dur: 0, budget: 100 }] }), 'imp.noAmount');
  assert.equal(key({ tasks: [{ id: 'S', name: 's', type: 'summary', budget: 100 }] }), 'imp.noAmount');
  assert.equal(key({ tasks: [{ id: 'S', name: 's', type: 'summary', budget: 0 }] }), null);
  assert.equal(key({ baselines: [{ name: 'b', provision: -1, tasks: [] }] }), 'imp.field:provision');
});

test('R-77 bis : le message de refus donne le numéro de la tâche et la limite', () => {
  I18n.setLang('fr');
  try { Model.sanitize(file({ tasks: [{ id: 'A', name: 'a', type: 'task', dur: 5 }, { id: 'B', name: 'b', type: 'task', dur: 5 }, { id: 'C', name: 'c', type: 'task', dur: 5 }, { id: 'D', name: 'd', type: 'task', dur: 5, budget: -5 }] })); assert.fail(); } catch (e) {
    const m = norm(I18n.error(e));
    assert.match(m, /Tâche n° 4/);
    assert.match(m, /5 000 000 000 000/);
  }
  I18n.setLang('en');
  try { Model.sanitize(file({ tasks: [{ id: 'A', name: 'a', type: 'task', dur: 5, budget: 1.5 }] })); assert.fail(); } catch (e) { assert.match(I18n.error(e), /5,000,000,000,000/); }
  I18n.setLang('fr');
});

test('fichier écrit puis relu : montants et devise identiques', () => {
  const p = r74(); p.provision = 123456; p.currency = '$';
  const back = Model.sanitize(JSON.parse(JSON.stringify(Model.serialize(p)))).project;
  assert.equal(back.provision, 123456);
  assert.equal(back.currency, '$');
  assert.deepEqual(back.tasks.map(t => [t.budget, t.actual]), [[10000, 9000], [30000, 10000]]);
});

test('R-79 somme exacte en centimes', () => {
  const p = project([{ id: 'A', budget: eur(0.1) }, { id: 'B', budget: eur(0.2) }, { id: 'C', budget: eur(0.3) }]);
  assert.equal(Budget.totals(p).bac, 60);
  assert.equal(Budget.format(Budget.totals(p).bac, { lang: 'en' }), '0.60');
});

test('RG-40 tableau par catégorie : ordre alphabétique, sans catégorie en dernier, total', () => {
  const p = project([{ id: 'A', cat: 'C2', budget: 500, actual: 200 }, { id: 'B', cat: 'C1', budget: 300, actual: 400 }, { id: 'C', budget: 100 },
    { id: 'S', type: 'summary', dur: 0, cat: 'C3' }, { id: 'M', type: 'milestone', dur: 0, cat: 'C4' }]);
  p.categories = [{ id: 'C1', name: 'Études', color: '#fff' }, { id: 'C2', name: 'achats', color: '#fff' }, { id: 'C3', name: 'Vide', color: '#fff' }, { id: 'C4', name: 'Z', color: '#fff' }];
  const t = Budget.byCategory(p);
  assert.deepEqual(plain(t.rows.map(r => r.name)), ['achats', 'Études', 'Z', '']);
  assert.deepEqual(plain(t.rows[1]), { id: 'C1', name: 'Études', budget: 300, actual: 400, gap: -100 });
  assert.deepEqual(plain(t.total), { budget: 900, actual: 600, gap: 300 });
});

test('EF-117 présence de montants', () => {
  const p = project([{ id: 'A' }]);
  assert.equal(Budget.hasAmounts(p), false);
  p.provision = 1;
  assert.equal(Budget.hasAmounts(p), true);
});

test('R-83 affichage compact en français et en anglais', () => {
  const fr = c => norm(Budget.formatCompact(c, { lang: 'fr' })), en = c => Budget.formatCompact(c, { lang: 'en' });
  const cases = [[99999999, '999 999,99', '999,999.99'], [100000000, '1 M', '1M'], [123456789, '1,23 M', '1.23M'], [199500000, '2 M', '2M'],
    [99999999999, '1 Md', '1B'], [150000000000, '1,5 Md', '1.5B'], [5000000000000, '50 Md', '50B'], [0, '0,00', '0.00'], [150000000, '1,5 M', '1.5M']];
  for (const [c, f, e] of cases) { assert.equal(fr(c), f, 'fr ' + c); assert.equal(en(c), e, 'en ' + c); }
  assert.equal(norm(Budget.formatCompact(123456789, { lang: 'fr', symbol: '€' })), '1,23 M €');
  assert.equal(Budget.formatCompact(123456789, { lang: 'en', symbol: '€' }), '€1.23M');
  assert.equal(norm(Budget.formatCompact(-123456789, { lang: 'fr', symbol: '€' })), '−1,23 M €');
});

test('montant complet : groupement et symbole selon la langue (RG-32)', () => {
  assert.equal(norm(Budget.format(123456, { lang: 'fr', symbol: '€' })), '1 234,56 €');
  assert.equal(Budget.format(123456, { lang: 'en', symbol: '€' }), '€1,234.56');
  assert.equal(norm(Budget.format(-1000, { lang: 'fr', symbol: '€' })), '−10,00 €');
  assert.equal(Budget.format(5005000000000000, { lang: 'en' }), '50,050,000,000,000.00');
});

test('plus grand total possible : exact (1 000 tâches au plafond + provision)', () => {
  const p = project(Array.from({ length: 1000 }, (_, i) => ({ id: 'T' + i, budget: Budget.MAX, actual: Budget.MAX })), { provision: Budget.MAX });
  const t = Budget.totals(p);
  assert.equal(t.bac, 5000000000000000);
  assert.equal(t.total, 5005000000000000);
  assert.ok(Number.isSafeInteger(t.total));
});

// ── Échanges Excel et CSV (EF-123, EF-124, RG-42) ─────────────────────────────────────────────
const TODAY = Dates.parse('2026-01-14');

function withSummary() {
  const p = project([{ id: 'S', type: 'summary', dur: 0 }, { id: 'A', parent: 'S', budget: 12345, actual: 600 }, { id: 'B', parent: 'S', budget: eur(250.5), actual: 0 },
    { id: 'M', type: 'milestone', dur: 0 }]);
  p.currency = '€';
  return p;
}

test('R-76 CSV : colonnes de montants seulement si demandées, deux décimales, somme pour la récapitulative', () => {
  I18n.setLang('fr');
  const p = withSummary(), s = Schedule.compute(p);
  const without = Exchange.csv(p, s, TODAY, { amounts: false });
  assert.ok(!/Budget|Coût réel/.test(without), 'aucune colonne de montant par défaut');
  assert.ok(!/123\.45|250\.50/.test(without));
  const rows = Csv.parse(Exchange.csv(p, s, TODAY, { amounts: true })).rows;
  const hb = rows[0].indexOf('Budget'), ha = rows[0].indexOf('Coût réel');
  assert.ok(hb > 0 && ha === hb + 1);
  const row = id => rows.find(r => r[1] === id);
  assert.deepEqual([row('A')[hb], row('A')[ha]], ['123.45', '6.00']);
  assert.deepEqual([row('S')[hb], row('S')[ha]], ['373.95', '6.00']); // RG-36 : somme des enfants
  assert.deepEqual([row('M')[hb], row('M')[ha]], ['0.00', '0.00']);
});

test('R-76 Excel : montants en nombres, sans colonne par défaut', async () => {
  I18n.setLang('en');
  const p = withSummary(), s = Schedule.compute(p);
  const tasks = async bytes => (await Xlsx.read(bytes))[0].rows;
  const none = await tasks(Exchange.xlsx(p, s, TODAY, {}));
  assert.ok(!none[0].includes('Budget'));
  const rows = await tasks(Exchange.xlsx(p, s, TODAY, { amounts: true }));
  const hb = rows[0].indexOf('Budget');
  assert.ok(hb > 0 && rows[0][hb + 1] === 'Actual cost');
  const a = rows.find(r => r[1] === 'A');
  assert.equal(a[hb], 123.45);
  assert.equal(typeof a[hb], 'number');
  I18n.setLang('fr');
});

test('RG-42 import d\'un tableur : colonnes reconnues, montants lus, valeurs invalides signalées et ignorées', () => {
  I18n.setLang('fr');
  const rows = [['Nom', 'BUDGET', 'Coût réel'],
    ['Un', '1 234,56 €', '10'], ['Deux', 'abc', ''], ['Trois', '12,345', '-5'], ['Quatre', 250.5, 99.999],
    ['Cinq', '50 000 000 000,01', '1.5'], ['Jalon', '100', '100']];
  rows[6][0] = 'Jalon'; // type renseigné par une colonne dédiée ci-dessous
  const header = [...rows[0], 'Type'];
  const data = rows.slice(1).map((r, i) => [...r, i === 5 ? 'Jalon' : '']);
  const map = Exchange.guessMapping(header);
  assert.equal(map.budget, 1);
  assert.equal(map.actual, 2);
  const res = Exchange.rowsToTasks([header, ...data], map, [], { symbol: '€' });
  assert.deepEqual(plain(res.errors), []);
  assert.equal(res.rows.length, 6); // toutes les lignes sont gardées
  const by = n => res.rows.find(r => r.name === n);
  assert.deepEqual([by('Un').budget, by('Un').actual], [123456, 1000]);
  assert.deepEqual([by('Deux').budget, by('Deux').actual], [0, 0]); // invalide ignoré, vide = 0
  assert.deepEqual([by('Trois').budget, by('Trois').actual], [0, 0]);
  assert.deepEqual([by('Quatre').budget, by('Quatre').actual], [25050, 0]); // 99,999 : plus de deux décimales
  assert.deepEqual([by('Cinq').budget, by('Cinq').actual], [0, 150]);
  assert.deepEqual([by('Jalon').budget, by('Jalon').actual], [0, 0]); // un jalon n'a aucun montant
  assert.deepEqual(plain(res.warnings.map(w => w.line)), [3, 4, 4, 5, 6]);
  assert.match(res.warnings[0].msg, /^Budget : « abc »/);
  // Fusion : les montants arrivent dans le projet, contrôlés par sanitize.
  const empty = Model.sanitize({ format: 3, projectStart: '2026-01-05', tasks: [] }).project;
  const merged = Exchange.mergeRows(empty, res.rows, 'replace').project;
  assert.deepEqual(plain(merged.tasks.map(t => [t.name, t.budget, t.actual]).slice(0, 2)), [['Un', 123456, 1000], ['Deux', 0, 0]]);
});

test('R-76 bis : export avec montants puis réimport à l\'identique', () => {
  I18n.setLang('fr');
  const p = withSummary(), s = Schedule.compute(p);
  const { rows } = Csv.parse(Exchange.csv(p, s, TODAY, { amounts: true }));
  const res = Exchange.rowsToTasks(rows, Exchange.guessMapping(rows[0]), []);
  const empty = Model.sanitize({ format: 3, projectStart: '2026-01-05', tasks: [] }).project;
  const merged = Exchange.mergeRows(empty, res.rows, 'replace').project;
  const t = id => merged.tasks.find(x => x.id === id);
  assert.deepEqual([t('A').budget, t('A').actual, t('B').budget], [12345, 600, 25050]);
  assert.equal(Budget.totals(merged).bac, 37395); // la somme de la récapitulative n'est pas comptée deux fois
});
