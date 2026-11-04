// Fuseaux horaires et changements d'heure : le moteur (dates, calendrier, planning) ne doit pas
// dépendre du fuseau de l'ordinateur, sauf Dates.todayDn() qui doit donner la date LOCALE.
// Voir Specs_fonctionnelles.md (RG-03, annexe C.1 du 4 novembre 2026) et PCA.md.
//   node --test tests/core/fuseaux.test.mjs
//
// Le test fait lui-même varier le fuseau (process.env.TZ, relu par Node à chaque affectation) ;
// la CI relance en plus toute la suite sous plusieurs TZ. Sous Windows, TZ n'est pas toujours
// pris en compte : le test vérifie d'abord que le changement a un effet (voir « garde-fou »).
// Aucune donnée réelle : projet et dates fictifs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './load.mjs';

const { Dates, Calendar, Schedule } = loadCore();

const ZONES = ['UTC', 'Europe/Paris', 'America/New_York', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'];
const ORIGINE = process.env.TZ;

/** Exécute f dans le fuseau tz puis rétablit le fuseau d'origine. */
function sous(tz, f) {
  process.env.TZ = tz;
  try { return f(); } finally { if (ORIGINE === undefined) delete process.env.TZ; else process.env.TZ = ORIGINE; }
}

// Garde-fou : si Node ignore TZ (cas possible sous Windows), les tests multi-fuseaux seraient
// trompeurs ; on les saute explicitement plutôt que de les laisser passer à vide.
const tzEffectif = sous('Pacific/Kiritimati', () => new Date(2026, 0, 1).getTimezoneOffset()) === -840;
const opt = tzEffectif ? {} : { skip: 'TZ non pris en compte par ce Node (voir PCA.md, Windows)' };

// Dates sensibles : [libellé, année, mois (1-12), jour].
const DATES = [
  ['veille changement d\'heure UE (mars)', 2026, 3, 28], ['changement d\'heure UE (mars)', 2026, 3, 29],
  ['lendemain changement UE (mars)', 2026, 3, 30],
  ['veille changement UE (octobre)', 2026, 10, 24], ['changement d\'heure UE (octobre)', 2026, 10, 25],
  ['lendemain changement UE (octobre)', 2026, 10, 26],
  ['veille changement US (mars)', 2026, 3, 7], ['changement d\'heure US (mars)', 2026, 3, 8],
  ['lendemain changement US (mars)', 2026, 3, 9],
  ['veille changement US (novembre)', 2026, 10, 31], ['changement d\'heure US (novembre)', 2026, 11, 1],
  ['lendemain changement US (novembre)', 2026, 11, 2],
  ['29 février', 2028, 2, 29], ['28 février non bissextile', 2027, 2, 28], ['1er mars non bissextile', 2027, 3, 1],
  ['31 décembre', 2026, 12, 31], ['1er janvier', 2027, 1, 1],
].map(([l, y, m, d]) => ({ l, y, m, d, iso: `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` }));

test('todayDn : 23 h 30 et 0 h 30 locales donnent la date locale, dans chaque fuseau', opt, () => {
  for (const tz of ZONES) sous(tz, () => {
    for (const { l, y, m, d, iso } of DATES) {
      for (const [h, mi] of [[23, 30], [0, 30], [12, 0]]) {
        const now = new Date(y, m - 1, d, h, mi); // heure locale du fuseau en cours
        assert.equal(Dates.toISO(Dates.todayDn(now)), iso, `${tz} ${l} ${h} h ${mi}`);
      }
    }
  });
});

test('todayDn : un même instant UTC donne des dates locales différentes selon le fuseau', opt, () => {
  const instant = new Date(Date.UTC(2026, 5, 15, 23, 30)); // 15/06/2026 23 h 30 UTC
  const attendu = { 'UTC': '2026-06-15', 'Europe/Paris': '2026-06-16', 'America/New_York': '2026-06-15',
    'Pacific/Kiritimati': '2026-06-16', 'Pacific/Pago_Pago': '2026-06-15' };
  for (const tz of ZONES) sous(tz, () => assert.equal(Dates.toISO(Dates.todayDn(instant)), attendu[tz], tz));
  // Instant où Pacific/Pago_Pago (UTC−11) est encore la veille de Kiritimati (UTC+14) : 25 h d'écart.
  const t = new Date(Date.UTC(2026, 0, 1, 10, 30));
  assert.equal(sous('Pacific/Pago_Pago', () => Dates.toISO(Dates.todayDn(t))), '2025-12-31');
  assert.equal(sous('Pacific/Kiritimati', () => Dates.toISO(Dates.todayDn(t))), '2026-01-02');
});

test('parse / toISO / fromYMD / ymd / weekday : aller-retour identique dans tous les fuseaux', () => {
  const ref = DATES.map(({ iso }) => Dates.parse(iso));
  // Valeurs de référence calculées sans Date locale : 20 454 = 2026-01-01 (jours depuis 1970).
  assert.equal(Dates.parse('2026-01-01'), 20454);
  for (const tz of ZONES) sous(tz, () => {
    DATES.forEach(({ l, y, m, d, iso }, i) => {
      const dn = Dates.parse(iso);
      assert.equal(dn, ref[i], `${tz} ${l} : numéro de jour`);
      assert.equal(Dates.toISO(dn), iso, `${tz} ${l} : toISO`);
      assert.equal(Dates.fromYMD(y, m, d), dn, `${tz} ${l} : fromYMD`);
      assert.deepEqual({ ...Dates.ymd(dn) }, { y, m, d }, `${tz} ${l} : ymd`);
      // Le jour de la semaine ne dépend que du numéro de jour (0 = lundi) : 2026-03-29 est un dimanche.
      assert.equal(Dates.weekday(dn), (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7, `${tz} ${l} : weekday`);
    });
    assert.equal(Dates.weekday(Dates.parse('2026-03-29')), 6);
    assert.equal(Dates.parse('2027-02-29'), null); // 2027 n'est pas bissextile
    assert.notEqual(Dates.parse('2028-02-29'), null);
  });
});

test('mondayOf / monthStart / monthEnd : indépendants du fuseau, y compris autour des changements d\'heure', () => {
  for (const tz of ZONES) sous(tz, () => {
    assert.equal(Dates.toISO(Dates.mondayOf(Dates.parse('2026-03-29'))), '2026-03-23');
    assert.equal(Dates.toISO(Dates.mondayOf(Dates.parse('2026-11-01'))), '2026-10-26');
    assert.equal(Dates.toISO(Dates.monthStart(Dates.parse('2026-10-25'))), '2026-10-01');
    assert.equal(Dates.toISO(Dates.monthEnd(Dates.parse('2028-02-10'))), '2028-02-29');
    assert.equal(Dates.toISO(Dates.monthEnd(Dates.parse('2026-12-15'))), '2026-12-31');
  });
});

test('calendrier : jours ouvrés et fériés identiques dans tous les fuseaux (Pâques, changements d\'heure)', () => {
  const instantane = () => {
    const out = [];
    for (const set of ['FR', 'US', 'GB']) {
      const cal = Calendar.create({ workDays: [1, 1, 1, 1, 1, 0, 0], holidays: set, daysOff: [], daysWorked: [] }, '2026-01-05');
      for (let dn = Dates.parse('2026-03-20'); dn <= Dates.parse('2026-11-05'); dn++) out.push(set + dn + (cal.isWork(dn) ? 'T' : 'F'));
      out.push(set + Dates.toISO(Calendar.easter(2026)), set + Dates.toISO(cal.dnOf(0)), set + Dates.toISO(cal.dnOf(200)));
    }
    return out.join('|');
  };
  const ref = sous('UTC', instantane);
  for (const tz of ZONES) sous(tz, () => assert.equal(instantane(), ref, tz));
});

test('planning : mêmes dates calculées dans tous les fuseaux (tâches à cheval sur les changements d\'heure)', () => {
  const projet = () => ({
    projectStart: '2026-03-23',
    calendar: { workDays: [1, 1, 1, 1, 1, 0, 0], holidays: 'FR', daysOff: [], daysWorked: [] },
    resources: [], categories: [], baselines: [],
    tasks: [
      { id: 'A', name: 'a', type: 'task', parent: '', dur: 10, deps: [], assign: [], pct: 0, forcedStart: '', notBefore: '', deadline: '', realStart: '', realEnd: '' },
      { id: 'B', name: 'b', type: 'task', parent: '', dur: 5, deps: [{ id: 'A', type: 'FS', lag: 0 }], assign: [], pct: 0, forcedStart: '', notBefore: '', deadline: '', realStart: '', realEnd: '' },
      { id: 'C', name: 'c', type: 'task', parent: '', dur: 3, deps: [{ id: 'B', type: 'FS', lag: 2 }], assign: [], pct: 0, forcedStart: '2026-10-22', notBefore: '', deadline: '', realStart: '', realEnd: '' },
    ],
  });
  const dates = () => {
    const s = Schedule.compute(projet());
    return ['A', 'B', 'C'].map(id => { const r = s.tasks.get(id); return `${id} ${Dates.toISO(r.startDn)}→${Dates.toISO(r.endDn)}`; }).join(' ; ')
      + ` ; fin ${Dates.toISO(s.projectEndDn)}`;
  };
  const ref = sous('UTC', dates);
  assert.match(ref, /^A 2026-03-23→2026-04-03 ; B 2026-04-07→2026-04-13/); // 06/04 : lundi de Pâques
  for (const tz of ZONES) sous(tz, () => assert.equal(dates(), ref, tz));
});
