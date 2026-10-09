// Échanges de fichiers : CSV, Excel, MS Project, import de tableau, chiffrement (sections 5.18, 8.5, 8.6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './load.mjs';

const { Model, Schedule, Dates, Csv, Xlsx, Zip, Xml, Exchange, Secure, I18n } = loadCore();
const plain = x => JSON.parse(JSON.stringify(x));
const TODAY = Dates.parse('2026-01-14');
const imp = obj => Model.sanitize(obj).project;
const sample = () => imp({
  format: 3, name: 'Projet test', projectStart: '2026-01-05',
  calendar: { daysOff: [{ start: '2026-01-07', end: '2026-01-07', label: 'Pont' }] },
  tasks: [
    { id: 'P', name: 'Phase', type: 'summary' },
    { id: 'A', name: '=1+1', parent: 'P', dur: 5, assign: [{ res: 'Alice', units: 50 }, { res: 'Bob', units: 100 }], cat: 'Dev', tags: ['urgent'], notes: '@note', deadline: '2026-02-01' },
    { id: 'B', name: 'Bravo', dur: 3, deps: ['A', { id: 'J', type: 'SS', lag: -2 }], forcedStart: '2026-01-20' },
    { id: 'J', name: 'Jalon', type: 'milestone', dur: 0, notBefore: '2026-01-12' },
  ],
  resources: [{ name: 'Alice', capacity: 80 }, { name: 'Bob' }], categories: [{ name: 'Dev', color: '#36d9a0' }],
});

test('EX-21 neutralisation des formules', () => {
  assert.equal(Csv.neutralize('=1+1'), "'=1+1");
  assert.equal(Csv.neutralize('+33 6'), "'+33 6");
  assert.equal(Csv.neutralize('-2'), "'-2");
  assert.equal(Csv.neutralize('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(Csv.neutralize('Normal'), 'Normal');
});

test('R-57 et R-58 : export CSV puis réimport à l\'identique', () => {
  I18n.setLang('fr');
  const p = sample(), s = Schedule.compute(p);
  const text = Exchange.csv(p, s, TODAY);
  assert.ok(text.startsWith('﻿'));
  assert.ok(text.includes(";'=1+1;"), 'formule neutralisée');
  const { rows, sep } = Csv.parse(text);
  assert.equal(sep, ';');
  assert.equal(rows[0][1], 'Identifiant');
  const map = Exchange.guessMapping(rows[0]);
  for (const f of ['id', 'name', 'type', 'parent', 'dur', 'deps', 'res', 'cat', 'pct', 'tags', 'notes', 'forcedStart', 'notBefore', 'deadline']) assert.ok(map[f] !== undefined, f);
  const res = Exchange.rowsToTasks(rows, map, []);
  assert.deepEqual(plain(res.errors), []);
  // Le nom « =1+1 » revient avec son apostrophe : c'est le texte du tableur, jamais une formule.
  const empty = imp({ format: 3, projectStart: '2026-01-05', tasks: [] });
  const merged = Exchange.mergeRows(empty, res.rows, 'replace').project;
  const t = id => merged.tasks.find(x => x.id === id);
  assert.deepEqual(plain(merged.tasks.map(x => [x.id, x.type, x.parent, x.dur])), [['P', 'summary', '', 0], ['A', 'task', 'P', 5], ['B', 'task', '', 3], ['J', 'milestone', '', 0]]);
  assert.deepEqual(plain(t('B').deps), [{ id: 'A', type: 'FS', lag: 0 }, { id: 'J', type: 'SS', lag: -2 }]);
  assert.deepEqual(plain(t('A').assign.map(a => [merged.resources.find(r => r.id === a.res).name, a.units])), [['Alice', 50], ['Bob', 100]]);
  assert.equal(t('B').forcedStart, '2026-01-20');
  assert.equal(t('J').notBefore, '2026-01-12');
  const s2 = Schedule.compute({ ...merged, calendar: p.calendar });
  assert.equal(Dates.toISO(s2.tasks.get('B').endDn), Dates.toISO(s.tasks.get('B').endDn));
});

test('R-59 import de tableau : erreurs ligne par ligne, lignes valides gardées', () => {
  const rows = [['Nom', 'Durée', 'Prédécesseurs', 'Ressource'], ['Un', '5', '', 'Alice'], ['Deux', 'cinq', '', ''], ['Trois', '3 j', 'Z', ''], ['Quatre', '2j', '', 'Bob 50 %'], ['', '1', '', '']];
  const r = Exchange.rowsToTasks(rows, Exchange.guessMapping(rows[0]), []);
  assert.equal(r.rows.length, 2);
  assert.deepEqual(plain(r.errors.map(e => e.line)), [3, 4, 6]);
  const merged = Exchange.mergeRows(imp({ format: 3, tasks: [{ id: 'A', name: 'Existante', dur: 1 }] }), r.rows, 'add').project;
  assert.deepEqual(plain(merged.tasks.map(x => x.id)), ['A', 'B', 'C']);
});

test('RG-30 sans identifiant, la colonne N° sert de référence des liens et des parents', () => {
  const rows = [['N°', 'Nom', 'Type', 'Parent', 'Durée', 'Prédécesseurs'], ['1', 'Lot', 'récapitulative', '', '', ''], ['1.1', 'Étude', '', '1', '3', ''], ['1.2', 'Réalisation', '', '1', '4', '1.1 FD+2']];
  const map = Exchange.guessMapping(rows[0]);
  assert.equal(map.num, 0);
  assert.equal(map.id, undefined);
  const r = Exchange.rowsToTasks(rows, map, ['A']);
  assert.equal(r.errors.length, 0, JSON.stringify(r.errors));
  const p = Exchange.mergeRows(imp({ format: 3, tasks: [{ id: 'A', name: 'Existante', dur: 1 }] }), r.rows, 'add').project;
  const by = n => p.tasks.find(x => x.name === n);
  assert.equal(by('Étude').parent, by('Lot').id);
  assert.deepEqual(plain(by('Réalisation').deps), [{ id: by('Étude').id, type: 'FS', lag: 2 }]);
  assert.ok(!p.tasks.some(x => x.id === '1.1'));
});

test('séparateurs reconnus et texte tabulé', () => {
  assert.equal(Csv.parse('a,b\n1,2').sep, ',');
  assert.equal(Csv.parse('a\tb\n1\t2').sep, '\t');
  assert.deepEqual(plain(Csv.parse('"x;y";"a ""b"""\n1;2').rows), [['x;y', 'a "b"'], ['1', '2']]);
});

test('EF-94 classeur Excel : écriture puis lecture des valeurs', async () => {
  const p = sample(), s = Schedule.compute(p);
  const bytes = Exchange.xlsx(p, s, TODAY);
  const files = await Zip.read(bytes);
  assert.ok(files.has('xl/workbook.xml') && files.has('xl/worksheets/sheet5.xml'));
  const sheets = await Xlsx.read(bytes);
  assert.deepEqual(plain(sheets.map(x => x.name)), ['Tâches', 'Ressources', 'Absences', 'Calendrier', 'Baselines']);
  assert.equal(sheets[0].rows[2][2], "'=1+1");
  assert.equal(sheets[0].rows[2][5], 5);
  assert.deepEqual(plain(sheets[1].rows[1]), ['Alice', '', 80, 2.5]);
  const sheet1 = new TextDecoder().decode(files.get('xl/worksheets/sheet1.xml'));
  assert.ok(sheet1.includes('state="frozen"') && sheet1.includes('<autoFilter'));
  assert.ok(!sheet1.includes('<f>'), 'aucune formule');
});

test('EX-27 archives et XML refusés', async () => {
  await assert.rejects(() => Zip.read(new Uint8Array([1, 2, 3])));
  const many = Zip.write(Array.from({ length: 201 }, (_, i) => ({ name: `f${i}.txt`, data: 'x' })));
  await assert.rejects(() => Zip.read(many), /zip.tooMany/);
  assert.throws(() => Xml.parse('<!DOCTYPE x [<!ENTITY a "b">]><x>&a;</x>'), /xml.doctype/);
  assert.throws(() => Xml.parse('<a><b></a>'));
  assert.equal(Xml.parse('<a x="1&amp;2">t&lt;u<![CDATA[<v>]]></a>').children[0].text, 't<u<v>');
});

test('EX-27 bombe de décompression arrêtée sur les octets réels', async () => {
  // Une entrée « deflate » déclarant 10 octets mais produisant 60 Mo de zéros.
  const cs = new CompressionStream('deflate-raw');
  const big = new Uint8Array(60 * 1024 * 1024);
  const comp = new Uint8Array(await new Response(new Blob([big]).stream().pipeThrough(cs)).arrayBuffer());
  const zip = Zip.write([{ name: 'bomb.txt', data: comp }]);
  // On patche la méthode (8 = deflate) et la taille déclarée (10 octets) dans les en-têtes.
  const dv = new DataView(zip.buffer);
  dv.setUint16(8, 8, true); dv.setUint32(22, 10, true);
  const cd = zip.length - 22 - 46 - 'bomb.txt'.length;
  dv.setUint16(cd + 10, 8, true); dv.setUint32(cd + 24, 10, true);
  await assert.rejects(() => Zip.read(zip), /zip.tooBig/);
});

test('R-60 MS Project : export puis import', () => {
  const p = sample(), s = Schedule.compute(p);
  const xml = Exchange.mspXml(p, s);
  assert.ok(xml.includes('<Type>3</Type><LinkLag>-9600</LinkLag>'));
  assert.ok(xml.includes('<ConstraintType>2</ConstraintType><ConstraintDate>2026-01-20T08:00:00'));
  const { raw, ignored } = Exchange.fromMspXml(xml);
  assert.deepEqual(plain(ignored), []);
  const q = Model.sanitize(raw).project;
  assert.deepEqual(plain(q.tasks.map(x => [x.id, x.type, x.parent, x.dur])), plain(p.tasks.map(x => [x.id, x.type, x.parent, x.dur])));
  const qs = Schedule.compute(q);
  for (const id of ['A', 'B', 'J']) assert.equal(Dates.toISO(qs.tasks.get(id).endDn), Dates.toISO(s.tasks.get(id).endDn), id);
  assert.deepEqual(plain(q.tasks[2].deps), [{ id: 'A', type: 'FS', lag: 0 }, { id: 'J', type: 'SS', lag: -2 }]);
  assert.equal(q.tasks[1].deadline, '2026-02-01');
  assert.equal(q.resources.find(r => r.name === 'Alice').capacity, 80);
});

test('MS Project : éléments sans équivalent listés', () => {
  const xml = '<Project xmlns="http://schemas.microsoft.com/project"><Name>X</Name><StartDate>2026-01-05T08:00:00</StartDate><Tasks>' +
    '<Task><UID>1</UID><ID>1</ID><Name>T</Name><OutlineLevel>1</OutlineLevel><Duration>PT12H0M0S</Duration><ConstraintType>5</ConstraintType><Cost>100</Cost></Task></Tasks></Project>';
  const { raw, ignored } = Exchange.fromMspXml(xml);
  assert.equal(raw.tasks[0].dur, 2); // 12 h → 2 jours (arrondi au jour supérieur)
  assert.equal(ignored.length, 2);
  assert.throws(() => Exchange.fromMspXml('<!DOCTYPE p [<!ENTITY x SYSTEM "file:///etc/passwd">]><Project>&x;</Project>'));
});

test('R-61 chiffrement : aller-retour, mauvais mot de passe, fichier altéré', async () => {
  const text = JSON.stringify(Model.serialize(sample()));
  await assert.rejects(() => Secure.encrypt(text, 'court'), e => e.key === 'pwd.short');
  const env = await Secure.encrypt(text, 'une phrase de passe assez longue', 600000);
  assert.equal(env.kdf.iterations, 600000);
  assert.ok(!JSON.stringify(env).includes('Bravo'), 'aucun nom en clair');
  assert.equal(await Secure.decrypt(env, 'une phrase de passe assez longue'), text);
  await assert.rejects(() => Secure.decrypt(env, 'une autre phrase de passe'), e => e.key === 'pwd.bad');
  const altered = { ...env, data: env.data.slice(0, -4) + (env.data.endsWith('AAAA') ? 'BBBB' : 'AAAA') };
  await assert.rejects(() => Secure.decrypt(altered, 'une phrase de passe assez longue'), e => e.key === 'pwd.bad');
  await assert.rejects(() => Secure.decrypt({ ...env, kdf: { ...env.kdf, iterations: 1000 } }, 'x'), e => e.key === 'imp.unreadable');
});

test('EF-95 MS Project : la première baseline est transmise, les suivantes non', () => {
  const p = sample();
  const s = Schedule.compute(p);
  const snap = (name, shift) => ({ id: 'X', name, color: '#f0b429', createdAt: 0, projectStart: p.projectStart, shownOnGantt: true, shownOnScurve: true,
    tasks: p.tasks.filter(x => x.type !== 'summary').map(x => { const r = s.tasks.get(x.id); return { id: x.id, name: x.name, dur: x.dur, deps: x.deps.map(d => d.id), cat: '', start: Dates.toISO(r.startDn + shift), end: Dates.toISO(r.endDn + shift) }; }) });
  p.baselines = [snap('Référence', 0), snap('Seconde', 7)];
  const xml = Exchange.mspXml(p, s);
  assert.equal((xml.match(/<Baseline>/g) || []).length, 3, 'une baseline par tâche non récapitulative, la première seulement');
  const q = Model.sanitize(Exchange.fromMspXml(xml).raw).project;
  assert.equal(q.baselines.length, 1);
  assert.equal(q.baselines[0].tasks.find(x => x.id === 'A').start, p.baselines[0].tasks.find(x => x.id === 'A').start);
  assert.equal(q.baselines[0].tasks.find(x => x.id === 'B').end, p.baselines[0].tasks.find(x => x.id === 'B').end);
});
