// Colonnes de la liste (EF-143 à EF-146, RG-52, RG-53 ; scénarios R-89 à R-91), calcul seul.
//   node --test tests/core/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './load.mjs';

const { Columns, Model } = loadCore();
const plain = x => JSON.parse(JSON.stringify(x));
const file = (o = {}, task = {}) => ({ format: 3, name: 'T', projectStart: '2026-01-05', tasks: [{ id: 'A', name: 'a', type: 'task', dur: 5, ...task }], ...o });
const key = o => { try { Model.sanitize(file(o)); return null; } catch (e) { return e.params && e.params.field ? e.key + ':' + e.params.field : e.key; } };

test('R-89 sans choix : ordre d\'origine, Budget et Coût réel seulement s\'il y a un montant', () => {
  const none = Model.sanitize(file()).project;
  assert.deepEqual(plain(Columns.effective(none)), ['id', 'name', 'dur', 'start', 'end', 'rstart', 'rend', 'deps', 'res', 'status']);
  const money = Model.sanitize(file({}, { budget: 100 })).project;
  assert.deepEqual(plain(Columns.effective(money)).slice(-2), ['budget', 'actual']);
  assert.equal(Columns.effective(money).length, 12);
});

test('R-89 le choix du projet est suivi à la lettre, ordre compris, même pour Budget sans montant', () => {
  const p = Model.sanitize(file({ columns: ['name', 'id', 'status', 'budget'] })).project;
  assert.deepEqual(plain(Columns.effective(p)), ['name', 'id', 'status', 'budget']);
  const layout = plain(Columns.layout(p));
  assert.deepEqual(layout.slice(0, 4).map(r => r.shown), [true, true, true, true]);
  assert.deepEqual(layout.slice(4).every(r => !r.shown), true);
  assert.equal(layout.length, 12);
});

test('R-90 un fichier à colonnes incorrectes est refusé en entier ; un choix correct survit à l\'écriture', () => {
  assert.equal(key({ columns: ['name'] }), 'imp.field:columns', 'identifiant obligatoire');
  assert.equal(key({ columns: ['id'] }), 'imp.field:columns', 'nom obligatoire');
  assert.equal(key({ columns: ['id', 'name', 'inconnue'] }), 'imp.field:columns');
  assert.equal(key({ columns: ['id', 'name', 'id'] }), 'imp.field:columns', 'doublon');
  assert.equal(key({ columns: 'id,name' }), 'imp.field:columns');
  assert.equal(key({ columns: [...Columns.ALL, 'dur'] }), 'imp.field:columns', 'trop long');
  assert.equal(key({ columns: ['id', 'name'] }), null);
  const p = Model.sanitize(file({ columns: ['name', 'id', 'end'] })).project;
  for (const amounts of [true, false]) {
    const back = Model.sanitize(JSON.parse(JSON.stringify(Model.serialize(p, { amounts })))).project;
    assert.deepEqual(plain(back.columns), ['name', 'id', 'end']);
  }
  assert.equal('columns' in Model.serialize(Model.sanitize(file()).project), false, 'sans choix, le champ reste absent');
  assert.equal(Model.newProject('2026-01-05', 1).columns, null);
});

test('R-91 masquer, afficher, déplacer : obligatoires protégées, ordre d\'origine pour une colonne ré-affichée', () => {
  const all = Columns.ALL.slice();
  assert.equal(Columns.toggle(all, 'id', false), null);
  assert.equal(Columns.toggle(all, 'name', false), null);
  assert.equal(Columns.toggle(all, 'inconnue', true), null);
  const less = Columns.toggle(all, 'deps', false);
  assert.deepEqual(plain(less), plain(all.filter(k => k !== 'deps')));
  assert.deepEqual(plain(Columns.toggle(less, 'deps', true)), plain(all), 'revient à sa place d\'origine');
  assert.deepEqual(plain(Columns.toggle(['name', 'id'], 'start', true)), ['name', 'id', 'start'], 'placée après la dernière qui la précède');
  assert.deepEqual(plain(Columns.toggle(['id', 'name', 'status'], 'dur', true)), ['id', 'name', 'dur', 'status']);
  assert.deepEqual(plain(Columns.move(['id', 'name', 'dur'], 'dur', -1)), ['id', 'dur', 'name']);
  assert.equal(Columns.move(['id', 'name'], 'id', -1), null, 'bord gauche');
  assert.equal(Columns.move(['id', 'name'], 'name', 1), null, 'bord droit');
  assert.equal(Columns.move(['id', 'name'], 'dur', 1), null, 'colonne masquée');
});
