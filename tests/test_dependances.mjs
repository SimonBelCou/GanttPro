// Outil tools/dependances.mjs (CLAUDE.md §6, Specs_fonctionnelles.md annexe C.1) : lignes « Appelle / Appelée par »
// écrites dans les commentaires et graphe d'Architecture.md. Les sources analysées sont un petit dépôt FICTIF créé
// dans un dossier temporaire ; le dépôt réel est contrôlé à part par « node tools/dependances.mjs --check ».
// Dépend d'acorn : `npm install --no-save acorn@8.19.0` (voir la CI). Lancer : node --test tests/test_dependances.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TOOL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'dependances.mjs');

/** Crée un dépôt fictif et renvoie son dossier. */
function fixture(extraUi = '') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-'));
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  put('src/js/core/00-a.js', `/* Module A : démonstration. */
const A = (() => {
  function helper() { return 1; }
  /** Calcule. */
  function pub() { return helper() + 1; }
  return { pub };
})();
`);
  put('src/js/core/10-b.js', `const B = (() => {
  const local = x => A.pub() + x;
  function shadow(A) { return A.pub(); }
  return { local, shadow };
})();
`);
  put('src/js/ui/20-ui.js', `/** Dessine. */
function draw(items) { return items.map(render).length + B.local(1); }
function render(x) { return x; }
action('go', () => draw([]));
document.addEventListener('x', () => draw([]));
${extraUi}`);
  put('Architecture.md', '# A\n\n<!-- dependances:modules:debut -->\n<!-- dependances:modules:fin -->\n\n<!-- dependances:ui:debut -->\n<!-- dependances:ui:fin -->\n');
  return root;
}
const run = (root, ...args) => spawnSync(process.execPath, [TOOL, ...args], { env: { ...process.env, DEPENDANCES_RACINE: root }, encoding: 'utf8' });
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('D-01 écrit les lignes Appelle / Appelée par, appels directs et rappels compris', () => {
  const root = fixture(); const r = run(root); assert.equal(r.status, 0, r.stderr);
  const a = read(root, 'src/js/core/00-a.js'), ui = read(root, 'src/js/ui/20-ui.js');
  assert.match(a, /Calcule\.\n\s+\* Appelle : A\.helper\(\)\n\s+\* Appelée par : B\.local\(\)/);   // commentaire existant conservé, lignes ajoutées
  assert.match(ui, /Dessine\.\n \* Appelle : B\.local\(\), render\(\)\n \* Appelée par : \(initialisation de 20-ui\.js\), action « go »/);
  assert.match(ui, /Appelée par : draw\(\)\n \*\/\nfunction render/);   // render est transmis en rappel à map()
});

test('D-02 un nom local masque le module : aucun appel vers A depuis shadow()', () => {
  const root = fixture(); run(root);
  assert.match(read(root, 'src/js/core/10-b.js'), /Appelle : aucune\n\s+\* Appelée par : aucune dans le code[^\n]*\n\s+\*\/\n\s+function shadow/);
});

test('D-03 une action déclarée par action() est dite déclenchée par son événement', () => {
  const root = fixture(); run(root);
  assert.match(read(root, 'src/js/ui/20-ui.js'), /Appelée par : l'événement « go » \(table ACTIONS\)\n \*\/\naction\('go'/);
});

test('D-04 un module liste les modules et fichiers qu\'il appelle et qui l\'appellent', () => {
  const root = fixture(); run(root);
  const a = read(root, 'src/js/core/00-a.js');
  assert.match(a, /Module A : démonstration\.\n \*\n \* Appelle : aucune\n \* Appelée par : B\n \*\/\nconst A/);
  assert.match(read(root, 'src/js/core/10-b.js'), /Appelle : A\n \* Appelée par : 20-ui\.js\n \*\/\nconst B/);
});

test('D-05 une fonction appelée par plus de 12 fonctions est notée « usage général »', () => {
  const callers = Array.from({ length: 13 }, (_, i) => `function c${i}() { return render(${i}); }`).join('\n');
  const root = fixture(callers); run(root);
  assert.match(read(root, 'src/js/ui/20-ui.js'), /Appelée par : 14 fonctions \(usage général\)\n \*\/\nfunction render/);
});

test('D-06 le graphe et le tableau d\'Architecture.md sont générés entre les marqueurs', () => {
  const root = fixture(); run(root);
  const arch = read(root, 'Architecture.md');
  assert.match(arch, /```mermaid\nflowchart LR\n  B --> A\n```/);
  assert.match(arch, /\| `20-ui\.js` \| `B` \|/);
});

test('D-07 un second passage ne change rien ; --check réussit', () => {
  const root = fixture(); run(root);
  const before = ['src/js/core/00-a.js', 'src/js/core/10-b.js', 'src/js/ui/20-ui.js', 'Architecture.md'].map(f => read(root, f));
  const again = run(root); assert.equal(again.status, 0); assert.match(again.stdout, /Rien à changer/);
  assert.deepEqual(['src/js/core/00-a.js', 'src/js/core/10-b.js', 'src/js/ui/20-ui.js', 'Architecture.md'].map(f => read(root, f)), before);
  assert.equal(run(root, '--check').status, 0);
});

test('D-08 --check échoue quand un commentaire est périmé ou que le code a changé, sans rien écrire', () => {
  const root = fixture(); run(root);
  const ui = path.join(root, 'src/js/ui/20-ui.js');
  fs.writeFileSync(ui, fs.readFileSync(ui, 'utf8').replace('Appelle : B.local(), render()', 'Appelle : rien'));
  const stale = fs.readFileSync(ui, 'utf8');
  const r = run(root, '--check');
  assert.equal(r.status, 1); assert.match(r.stderr, /20-ui\.js/);
  assert.equal(fs.readFileSync(ui, 'utf8'), stale, '--check ne modifie aucun fichier');
  // ajouter un appel sans mettre à jour les commentaires est aussi détecté
  const root2 = fixture(); run(root2);
  const ui2 = path.join(root2, 'src/js/ui/20-ui.js');
  fs.writeFileSync(ui2, fs.readFileSync(ui2, 'utf8').replace('function render(x) { return x; }', 'function render(x) { return B.shadow(x); }'));
  assert.equal(run(root2, '--check').status, 1);
});

test('D-09 le code n\'est jamais modifié : seuls les commentaires changent', () => {
  const root = fixture();
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
  const before = ['src/js/core/00-a.js', 'src/js/core/10-b.js', 'src/js/ui/20-ui.js'].map(f => strip(read(root, f)));
  run(root);
  assert.deepEqual(['src/js/core/00-a.js', 'src/js/core/10-b.js', 'src/js/ui/20-ui.js'].map(f => strip(read(root, f))), before);
});
