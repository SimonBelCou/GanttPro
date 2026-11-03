// Journal local d'erreurs : moteur ErrLog (Specs_fonctionnelles.md, EF-151, RG-60 à RG-64, scénarios R-60 à R-62).
// Données fictives uniquement (CLAUDE.md §3) : « Camille Exemple » est un nom inventé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './load.mjs';

const { ErrLog, Model } = loadCore();
const NOW = Date.parse('2026-11-03T10:00:00.000Z');
const DAY = 24 * 3600 * 1000;
const CTX = { now: NOW, sid: '0a1b2c3d', ver: '3.0.0' };
const ev = (o = {}) => ({ code: 'imp.unreadable', act: 'import', cmp: 'files', ...o });
const at = (t, o = {}) => ErrLog.make(ev(o), { ...CTX, now: t });
// Les tableaux du moteur viennent d'un autre contexte (vm) : comparaison par copie.
const plain = x => JSON.parse(JSON.stringify(x));

test('une ligne a exactement les champs prévus, en UTC', () => {
  const l = ErrLog.make(ev(), CTX);
  assert.deepEqual(Object.keys(l), ['ts', 'lvl', 'act', 'code', 'cmp', 'res', 'sid', 'ver']);
  assert.equal(l.ts, '2026-11-03T10:00:00.000Z');
  assert.equal(l.lvl, 'WARN');
  assert.equal(l.res, 'refused');
  const u = ErrLog.make(ev({ code: 'app.unexpected', act: 'app', cmp: 'main' }), CTX);
  assert.equal(u.lvl, 'ERROR');
  assert.equal(u.res, 'failed');
});

test('code inconnu, refus de saisie err.* ou valeur hors liste : ligne refusée', () => {
  assert.equal(ErrLog.make(ev({ code: 'imp.inventé' }), CTX), null);
  assert.equal(ErrLog.make(ev({ code: 'imp.nexistepas' }), CTX), null);
  assert.equal(ErrLog.make(ev({ code: 'err.required' }), CTX), null);
  assert.equal(ErrLog.make(ev({ code: 'app.title' }), CTX), null);
  assert.equal(ErrLog.make(ev({ act: 'Camille Exemple' }), CTX), null);
  assert.equal(ErrLog.make(ev({ cmp: 'files\nINFO' }), CTX), null);
  assert.equal(ErrLog.make(ev({ lvl: 'FATAL' }), CTX), null);
  assert.ok(ErrLog.make(ev({ code: 'pwd.bad' }), CTX));
  assert.ok(ErrLog.make(ev({ code: 'store.full', act: 'store', cmp: 'library' }), CTX));
  assert.ok(ErrLog.make(ev({ code: 'calc.error', act: 'calc', cmp: 'state' }), CTX));
});

test('le message d\'une exception (nom fictif) n\'entre jamais dans le journal', () => {
  const e = new Error('Ressource Camille Exemple introuvable\n    at volerDonnees (file:///C:/Users/camille/x.html:9:9)');
  const l = ErrLog.make(ev({ code: 'app.unexpected', act: 'app', cmp: 'main', error: e }), CTX);
  const text = JSON.stringify(l);
  assert.ok(!text.includes('Camille'));
  assert.ok(!text.includes('volerDonnees'), 'un message sur plusieurs lignes ne peut pas imiter un cadre de pile');
  assert.equal(l.err, 'Error');
  const inv = new Model.Invalid('imp.dupResource', { name: 'Camille Exemple' });
  const li = ErrLog.make(ev({ code: inv.key, error: inv }), CTX);
  assert.equal(li.err, 'Invalid');
  assert.ok(!JSON.stringify(li).includes('Camille'));
});

test('type d\'exception hors liste : « Other »', () => {
  const e = { name: 'CamilleExempleError', stack: '' };
  assert.equal(ErrLog.make(ev({ error: e }), CTX).err, 'Other');
});

test('pile réduite à « fonction:ligne », jamais de chemin de fichier', () => {
  const chrome = 'TypeError: x is undefined\n    at importText (file:///C:/Users/camille/Documents/GanttPro.html:4567:12)\n    at async importFile (file:///C:/Users/camille/GanttPro.html:4500:3)';
  assert.equal(ErrLog.frame(chrome, 'TypeError: x is undefined'), 'importText:4567');
  assert.equal(ErrLog.frame('importText@file:///C:/Users/camille/GanttPro.html:4567:12\n'), 'importText:4567');
  assert.equal(ErrLog.frame('    at file:///C:/Users/camille/GanttPro.html:12:5'), 'anonymous:12');
  assert.equal(ErrLog.frame('    at Object.write (file:///C:/Users/x/a.html:7:1)'), 'write:7');
  assert.equal(ErrLog.frame('aucun cadre'), undefined);
  assert.equal(ErrLog.frame(undefined), undefined);
  // Nom trop long ou chargé de caractères : rien n'est gardé.
  assert.equal(ErrLog.frame(`    at ${'a'.repeat(60)} (file:///C:/x.html:1:1)`), undefined);
  const l = ErrLog.make(ev({ code: 'app.unexpected', act: 'app', cmp: 'main', error: { name: 'TypeError', message: 'm', stack: 'TypeError: m\n' + chrome.split('\n').slice(1).join('\n') } }), CTX);
  assert.equal(l.at, 'importText:4567');
  assert.ok(!JSON.stringify(l).includes('Users'));
});

test('rotation : à la 201e ligne, la plus ancienne sort', () => {
  let lines = [];
  for (let i = 0; i < 201; i++) lines = ErrLog.push(lines, at(NOW - (201 - i) * 1000), NOW);
  assert.equal(lines.length, 200);
  assert.equal(lines[0].ts, new Date(NOW - 200 * 1000).toISOString());
});

test('purge : une ligne de plus de 30 jours ou datée du futur est retirée', () => {
  const lines = [at(NOW - 31 * DAY), at(NOW - 29 * DAY), at(NOW + 2 * DAY)];
  const kept = ErrLog.purge(lines, NOW);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].ts, new Date(NOW - 29 * DAY).toISOString());
});

test('journal stocké corrompu : non JSON, pas un tableau ou trop gros = remis à zéro', () => {
  assert.deepEqual(plain(ErrLog.parse('{pas du json', NOW)), []);
  assert.deepEqual(plain(ErrLog.parse('{"a":1}', NOW)), []);
  assert.deepEqual(plain(ErrLog.parse(null, NOW)), []);
  const big = ErrLog.serialize(Array.from({ length: 5000 }, () => at(NOW)));
  assert.ok(big.length > ErrLog.MAX_CHARS);
  assert.deepEqual(plain(ErrLog.parse(big, NOW)), []);
});

test('lignes hostiles relues : ignorées une à une, les bonnes sont gardées', () => {
  const good = at(NOW - 1000);
  const hostile = [
    { ...good, code: 'imp.unreadable\n{"lvl":"INFO"}' },
    { ...good, extra: 'Camille Exemple' },
    { ...good, at: 'file:///C:/Users/camille/x.html:1' },
    { ...good, ts: 'hier' },
    { ...good, sid: '<script>' },
    { ...good, ver: '3.0.0; rm' },
    { ...good, err: 'CamilleError' },
    { ...good, act: '__proto__' },
    'texte', 42, null, [good],
    good,
  ];
  const kept = ErrLog.parse(JSON.stringify(hostile), NOW);
  assert.deepEqual(plain(kept), plain([good]));
});

test('export JSON Lines : en-tête (version, langue) puis une ligne par entrée, sans retour à la ligne injecté', () => {
  const lines = [at(NOW - 2000), at(NOW - 1000, { code: 'pwd.bad' })];
  const text = ErrLog.toJsonl(lines, { ver: '3.0.0', lang: 'en', now: NOW });
  const rows = text.trimEnd().split('\n').map(r => JSON.parse(r));
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { app: 'GanttPro', ver: '3.0.0', lang: 'en', exported: '2026-11-03T10:00:00.000Z', lines: 2 });
  assert.equal(rows[2].code, 'pwd.bad');
  assert.deepEqual(Object.keys(rows[0]).sort(), ['app', 'exported', 'lang', 'lines', 'ver'], 'rien sur le navigateur ni le système');
});
