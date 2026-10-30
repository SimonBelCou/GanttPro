// Étape C, taux des ressources (EF-147 et suivantes, RG-54 à RG-58 ; scénarios R-92 à R-97), calcul seul.
//   node --test tests/core/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './load.mjs';

const { Rates, Model, Schedule, Evm, Dates, Exchange, Xlsx } = loadCore();
const plain = x => JSON.parse(JSON.stringify(x));
const eur = x => Math.round(x * 100);

// Fichier minimal : projet lundi 5 janvier 2026, calendrier français, ressources et profils au format du fichier.
const file = (o = {}) => ({
  format: 3, name: 'T', projectStart: '2026-01-05',
  profiles: [{ name: 'Dév', rates: [{ from: '', rate: eur(400) }] }],
  resources: [{ name: 'Alice', profile: 'Dév' }, { name: 'Bob' }],
  tasks: [{ id: 'A', name: 'a', type: 'task', dur: 10, assign: [{ res: 'Alice', units: 50 }] }],
  ...o,
});
const load = o => Model.sanitize(file(o)).project;
const key = o => { try { Model.sanitize(file(o)); return null; } catch (e) { return e.params && e.params.field ? e.key + ':' + e.params.field : e.key; } };
const costs = p => Rates.compute(p, Schedule.compute(p));

test('R-92 coût d\'une affectation : jours ouvrés x taux d\'occupation x taux du jour (exemple du cours)', () => {
  const p = load();
  const c = costs(p);
  const a = c.byTask.get('A');
  assert.equal(a.pd, 500, '10 j à 50 % = 5 jours-personne (en centièmes)');
  assert.equal(a.cents, eur(2000), '5 j-p x 400,00 = 2 000,00');
  assert.equal(c.total.cents, eur(2000));
  assert.equal(c.byRes.get('R1').cents, eur(2000));
  assert.equal(c.byRes.get('R2').cents, 0);
  assert.equal(c.any, true);
});

test('R-93 taux daté : le coût suit le taux en vigueur chaque jour ouvré', () => {
  // Tâche de 5 jours à 100 % du lundi 5 au vendredi 9 janvier : 3 jours à 400,00 puis 2 jours à 420,00.
  const p = load({
    profiles: [{ name: 'Dév', rates: [{ from: '2026-01-08', rate: eur(420) }, { from: '', rate: eur(400) }] }],
    tasks: [{ id: 'A', name: 'a', type: 'task', dur: 5, assign: [{ res: 'Alice', units: 100 }] }],
  });
  assert.deepEqual(plain(p.profiles[0].rates.map(l => l.from)), ['', '2026-01-08'], 'lignes triées, la ligne sans date d\'abord');
  assert.equal(costs(p).total.cents, eur(3 * 400 + 2 * 420), '2 040,00 et non 2 000,00');
  assert.equal(Rates.rateOn(p.profiles[0].rates, Dates.parse('2026-01-07')), eur(400));
  assert.equal(Rates.rateOn(p.profiles[0].rates, Dates.parse('2026-01-08')), eur(420));
  assert.equal(Rates.rateOn([{ from: '2026-01-08', rate: 1 }], Dates.parse('2026-01-07')), null, 'avant la première ligne : pas de taux');
});

test('R-94 arrondi au centime : une seule fois, moitié vers le haut, sur des entiers', () => {
  // 1 jour à 33 % de 123,45 = 40,7385 -> 40,74
  const one = load({ profiles: [{ name: 'Dév', rates: [{ from: '', rate: 12345 }] }], tasks: [{ id: 'A', name: 'a', type: 'task', dur: 1, assign: [{ res: 'Alice', units: 33 }] }] });
  assert.equal(costs(one).total.cents, 4074);
  // 3 jours à 33 % de 100,10 : 300,30 x 33 % = 99,099 -> 99,10 ; arrondir chaque jour (33,03 x 3 = 99,09) serait faux.
  const three = load({ profiles: [{ name: 'Dév', rates: [{ from: '', rate: 10010 }] }], tasks: [{ id: 'A', name: 'a', type: 'task', dur: 3, assign: [{ res: 'Alice', units: 33 }] }] });
  assert.equal(costs(three).total.cents, 9910);
  // Gros montants : aucun dépassement de 2^53 (taux maximal, 3 650 jours, 100 %).
  const big = load({ profiles: [{ name: 'Dév', rates: [{ from: '', rate: Model.LIMITS.rate }] }], tasks: [{ id: 'A', name: 'a', type: 'task', dur: 3650, assign: [{ res: 'Alice', units: 100 }] }] });
  assert.equal(costs(big).total.cents, Model.LIMITS.rate * 3650);
});

test('R-95 ressource sans taux : non valorisée et signalée, jamais un zéro muet', () => {
  const p = load({ tasks: [
    { id: 'A', name: 'a', type: 'task', dur: 10, assign: [{ res: 'Alice', units: 50 }] },
    { id: 'B', name: 'b', type: 'task', dur: 4, assign: [{ res: 'Bob', units: 100 }] },
  ] });
  const c = costs(p);
  assert.equal(c.total.cents, eur(2000), 'Bob n\'ajoute rien');
  assert.equal(c.total.pd, 500 + 400, 'ses jours-personne sont comptés quand même');
  assert.equal(c.total.unrated, 1, 'une affectation sans taux');
  assert.equal(c.byTask.get('B').unrated, 1);
  assert.equal(c.byTask.get('A').unrated, 0);
  assert.equal(Rates.sourceOf(p, p.resources[1]), 'none');
  // Jours avant la première ligne datée : partiellement valorisés.
  const part = load({ profiles: [{ name: 'Dév', rates: [{ from: '2026-01-08', rate: eur(420) }] }], tasks: [{ id: 'A', name: 'a', type: 'task', dur: 5, assign: [{ res: 'Alice', units: 100 }] }] });
  assert.equal(costs(part).total.cents, eur(2 * 420));
  assert.equal(costs(part).total.unrated, 1);
});

test('R-96 le taux nominatif remplace celui du profil ; une récapitulative somme ses enfants', () => {
  const p = load({
    resources: [{ name: 'Alice', profile: 'Dév', rates: [{ from: '', rate: eur(700) }] }],
    tasks: [
      { id: 'S', name: 's', type: 'summary' },
      { id: 'A', name: 'a', type: 'task', parent: 'S', dur: 2, assign: [{ res: 'Alice', units: 100 }] },
      { id: 'B', name: 'b', type: 'task', parent: 'S', dur: 3, assign: [{ res: 'Alice', units: 50 }] },
      { id: 'M', name: 'm', type: 'milestone' },
    ],
  });
  assert.equal(Rates.sourceOf(p, p.resources[0]), 'own');
  const c = costs(p);
  assert.equal(c.byTask.get('A').cents, eur(1400));
  assert.equal(c.byTask.get('B').cents, eur(1050));
  assert.equal(c.byTask.get('S').cents, eur(2450));
  assert.equal(c.byTask.get('S').pd, 200 + 150);
  assert.equal(c.byTask.get('M').cents, 0, 'un jalon ne coûte rien');
  assert.equal(c.byProfile.get('P1').cents, eur(2450));
});

test('R-97 coût réel estimé = coût prévu x avancement, et il n\'entre ni dans le coût réel ni dans l\'EVM', () => {
  const tasks = [{ id: 'A', name: 'a', type: 'task', dur: 10, pct: 40, budget: eur(2500), actual: eur(900), assign: [{ res: 'Alice', units: 50 }] }];
  const withRates = load({ tasks }), without = load({ tasks, profiles: [], resources: [{ name: 'Alice' }, { name: 'Bob' }] });
  assert.equal(costs(withRates).total.est, eur(800), '40 % de 2 000,00');
  assert.equal(costs(withRates).byRes.get('R1').est, eur(800));
  const run = p => Evm.compute(p, Schedule.compute(p), Dates.parse('2026-01-12'));
  assert.deepEqual(plain(run(withRates)), plain(run(without)), 'les indicateurs de valeur acquise ne dépendent pas des taux');
});

test('R-98 fichier : lignes de taux, profils et références contrôlés, tout refus nomme la cause', () => {
  assert.equal(key(), null);
  assert.equal(key({ profiles: [{ name: 'Dév', rates: [{ from: '', rate: 1 }, { from: '', rate: 2 }] }] }), 'imp.field:rates', 'deux lignes sans date');
  assert.equal(key({ profiles: [{ name: 'Dév', rates: [{ from: '2026-02-01', rate: 1 }, { from: '2026-02-01', rate: 2 }] }] }), 'imp.field:rates', 'même date');
  assert.equal(key({ profiles: [{ name: 'Dév', rates: [{ from: '', rate: -1 }] }] }), 'imp.field:rate');
  assert.equal(key({ profiles: [{ name: 'Dév', rates: [{ from: '', rate: 1.5 }] }] }), 'imp.field:rate', 'jamais de nombre à virgule');
  assert.equal(key({ profiles: [{ name: 'Dév', rates: [{ from: '', rate: Model.LIMITS.rate + 1 }] }] }), 'imp.field:rate');
  assert.equal(key({ profiles: [{ name: 'Dév', rates: [{ from: '', rate: 1 }, { from: 'hier', rate: 2 }] }] }), 'imp.field:from');
  assert.equal(key({ profiles: [{ name: 'Dév', rates: [{ from: '' }] }] }), 'imp.field:rates', 'taux obligatoire');
  assert.equal(key({ profiles: [{ name: 'Dév', rates: Array.from({ length: 11 }, (_, i) => ({ from: `2026-0${1 + (i % 9)}-0${1 + Math.floor(i / 9)}`, rate: 1 })) }] }), 'imp.field:rates', 'onze lignes');
  assert.equal(key({ profiles: [{ name: 'Dév' }, { name: 'dév' }] }), 'imp.dupProfile', 'noms de profils uniques, casse ignorée');
  assert.equal(key({ resources: [{ name: 'Alice', profile: 'Inconnu' }, { name: 'Bob' }] }), 'imp.unknownProfile');
  assert.equal(key({ profiles: Array.from({ length: 51 }, (_, i) => ({ name: 'P' + i })) }), 'imp.tooMany');
  assert.equal(key({ resources: [{ name: 'Alice', rates: [{ from: '', rate: 0 }] }, { name: 'Bob' }], profiles: [] }), null, 'un taux nul est un taux');
  // Un fichier sans aucun champ de l'étape C se lit comme avant et s'écrit de même.
  const old = Model.sanitize({ format: 3, name: 'T', projectStart: '2026-01-05', tasks: [{ id: 'A', name: 'a', type: 'task', dur: 3 }] }).project;
  assert.deepEqual(plain(old.profiles), []);
  const out = Model.serialize(old);
  assert.equal('profiles' in out, false);
  assert.equal(out.resources.every(r => !('rates' in r) && !('profile' in r)), true);
  assert.equal(Rates.inUse(old), false);
});

test('R-99 écriture : aller-retour exact, sans montants plus aucun taux, anonymisé sans taux nominatif', () => {
  const p = load({ resources: [{ name: 'Alice', profile: 'Dév' }, { name: 'Bob', rates: [{ from: '', rate: eur(650) }, { from: '2026-03-01', rate: eur(700) }] }], tasks: [
    { id: 'A', name: 'a', type: 'task', dur: 4, assign: [{ res: 'Alice', units: 100 }, { res: 'Bob', units: 50 }] }] });
  const back = Model.sanitize(JSON.parse(JSON.stringify(Model.serialize(p)))).project;
  assert.deepEqual(plain(back.profiles), plain(p.profiles));
  assert.deepEqual(plain(back.resources.map(r => [r.profile, r.rates])), plain(p.resources.map(r => [r.profile, r.rates])));
  assert.equal(costs(back).total.cents, costs(p).total.cents);

  const bare = JSON.parse(JSON.stringify(Model.serialize(p, { amounts: false })));
  assert.deepEqual(plain(bare.profiles), [{ id: 'P1', name: 'Dév', rates: [] }], 'le profil garde son nom, plus aucune ligne');
  assert.equal(bare.resources.some(r => 'rates' in r), false);
  assert.equal(JSON.stringify(bare).includes(String(eur(650))), false, 'aucun taux nulle part');
  const reread = Model.sanitize(bare).project;
  assert.equal(Rates.hasRates(reread), false);
  assert.equal(reread.resources[0].profile, 'P1', 'le lien avec le profil survit');

  const anon = JSON.parse(JSON.stringify(Model.serialize(p, { anonymize: true })));
  assert.equal(anon.resources.some(r => 'rates' in r), false, 'aucun taux nominatif dans un fichier anonymisé');
  assert.equal(anon.profiles[0].rates.length, 1, 'le taux du profil, qui n\'est pas une personne, reste');
  assert.deepEqual(anon.resources.map(r => r.name), ['Ressource 1', 'Ressource 2']);
  assert.equal(JSON.stringify(anon).includes('Alice'), false);
});

test('R-100 exports : coût par tâche et feuille « Taux » avec les montants, rien sans montants ni sous anonymisation, jamais vers MS Project', async () => {
  const p = load({ resources: [{ name: 'Alice', profile: 'Dév' }, { name: 'Bob', rates: [{ from: '', rate: eur(650) }] }], tasks: [
    { id: 'A', name: 'a', type: 'task', dur: 4, assign: [{ res: 'Alice', units: 100 }, { res: 'Bob', units: 50 }] }] });
  const s = Schedule.compute(p), today = Dates.parse('2026-01-14');
  const lines = text => text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).map(l => l.split(';'));
  const withAmounts = lines(Exchange.csv(p, s, today, { amounts: true }));
  // Dernière colonne (les ressources d'une ligne contiennent un « ; » entre guillemets).
  assert.equal(withAmounts[0].at(-1), 'Coût des ressources', 'colonne présente avec les montants');
  assert.equal(withAmounts[1].at(-1), (4 * 400 + 2 * 650).toFixed(2), '4 j x 400,00 + 2 j-p x 650,00 = 2 900,00');
  for (const opts of [{}, { amounts: false }, { amounts: true, anonymize: true }]) {
    assert.equal(Exchange.csv(p, s, today, opts).includes('Coût des ressources'), false, JSON.stringify(opts));
  }
  const sheets = await Xlsx.read(Exchange.xlsx(p, s, today, { amounts: true }));
  const names = sheets.map(x => x.name);
  assert.ok(names.includes('Taux'), 'feuille Taux avec les montants');
  const rows = sheets.find(x => x.name === 'Taux').rows;
  assert.deepEqual(plain(rows.slice(1).map(r => [r[0], r[1]])), [['Dév', 'Profil'], ['Bob', 'Taux nominatif']]);
  const res = sheets.find(x => x.name === 'Ressources').rows;
  assert.deepEqual(plain(res[0].slice(4)), ['Profil de coût', 'Taux par jour', 'Coût prévu', 'Coût réel estimé']);
  const noAmounts = await Xlsx.read(Exchange.xlsx(p, s, today, {}));
  assert.equal(noAmounts.map(x => x.name).includes('Taux'), false);
  assert.deepEqual(plain(noAmounts.find(x => x.name === 'Ressources').rows[0].slice(4)), ['Profil de coût'], 'le profil est un intitulé : il reste, pas les montants');
  const anon = await Xlsx.read(Exchange.xlsx(p, s, today, { amounts: true, anonymize: true }));
  const anonRates = anon.find(x => x.name === 'Taux').rows;
  assert.deepEqual(plain(anonRates.slice(1).map(r => r[0])), ['Dév'], 'aucun taux nominatif dans un classeur anonymisé');
  assert.deepEqual(plain(anon.find(x => x.name === 'Ressources').rows[0].slice(4)), ['Profil de coût'], 'ni taux du jour ni coût par ressource');
  const xml = Exchange.mspXml(p, s);
  assert.equal(/65000|650[.,]00|40000|Rate/i.test(xml.replace(/StandardRate|OvertimeRate|CostRatePerHour/gi, '')), false, 'MS Project ne reçoit aucun taux');
});
