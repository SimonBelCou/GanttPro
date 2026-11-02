#!/usr/bin/env node
/* Dépendances entre fonctions de GanttPro (CLAUDE.md §6, annexe C.1 de Specs_fonctionnelles.md).
 *
 * Rôle : analyser les sources de `src/js/` avec un vrai analyseur JavaScript (acorn), calculer pour chaque fonction
 * ce qu'elle appelle et par qui elle est appelée, puis
 *   1. écrire (ou contrôler) les lignes « Appelle : … » et « Appelée par : … » à la fin du commentaire qui précède
 *      chaque fonction de niveau module, et chaque module ;
 *   2. régénérer (ou contrôler) le graphe des modules et le tableau d'usage du moteur par l'interface, entre les
 *      marqueurs `<!-- dependances:… -->` d'`Architecture.md`.
 *
 *   node tools/dependances.mjs            écrit les modifications
 *   node tools/dependances.mjs --check    échoue (code 1) si une ligne ou le graphe est périmé (CI)
 *
 * Entrées : fichiers `src/js/core/*.js` puis `src/js/ui/*.js` (ordre alphabétique, comme le build : tous les fichiers
 * partagent une seule portée) et `Architecture.md`. Sortie : ces mêmes fichiers, modifiés seulement dans leurs
 * commentaires ; le code n'est jamais touché (vérifié par comparaison des lexèmes lors du rétrofit).
 * Dépendance de développement : acorn (`npm install --no-save acorn@8.19.0`), non livrée dans GanttPro.html.
 *
 * Ce qui compte comme « appel » : un appel direct, et aussi une fonction transmise en rappel (`liste.map(f)`,
 * `addEventListener('click', f)`) : la dépendance existe dans les deux cas.
 * Limites : un appel dynamique n'est pas vu (par exemple `ACTIONS[nom]()`, ou un nom construit dans une chaîne) ; une
 * action déclarée par `action('nom', …)` est donc dite « déclenchée par l'événement nom ». Les fonctions définies dans
 * le corps d'une autre fonction ne sont pas annotées : leurs appels sont attribués à la fonction qui les contient.
 * Portée : les noms locaux (paramètres, `const`, `let`, fonctions internes) masquent les noms de module et globaux. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Racine du dépôt ; `DEPENDANCES_RACINE` la remplace (les tests analysent un petit dépôt fictif).
const ROOT = process.env.DEPENDANCES_RACINE ? path.resolve(process.env.DEPENDANCES_RACINE) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let acorn;
try { acorn = require('acorn'); } catch {
  console.error("acorn est absent : lancer « npm install --no-save acorn@8.19.0 » (outil de développement, non livré).");
  process.exit(2);
}

const CHECK = process.argv.includes('--check');
const MAX_NAMES = 12;      // au-delà, la liste est remplacée par un nombre (fonction d'usage général)
const WIDTH = 118;         // largeur maximale d'une ligne de commentaire

// ───────────────────────── 1. Lecture des sources ─────────────────────────

/** Fichiers de `src/js/` dans l'ordre du build : `core` puis `ui`, chacun trié par nom. */
function sourceFiles() {
  const out = [];
  for (const dir of ['core', 'ui']) {
    const d = path.join(ROOT, 'src', 'js', dir);
    for (const f of fs.readdirSync(d).filter(x => x.endsWith('.js')).sort()) out.push({ rel: `src/js/${dir}/${f}`, dir, name: f });
  }
  return out;
}

/** Analyse un fichier : arbre syntaxique avec positions, et liste de ses commentaires. */
function parse(file) {
  const text = fs.readFileSync(path.join(ROOT, file.rel), 'utf8');
  const comments = [];
  const ast = acorn.parse(text, {
    ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true,
    onComment: (block, value, start, end) => comments.push({ block, value, start, end }),
  });
  return { ...file, text, ast, comments };
}

// ───────────────────────── 2. Définitions (unités) ─────────────────────────

const isFn = n => n && (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression');
const isModuleIife = n => n && n.type === 'CallExpression' && n.arguments.length === 0 && isFn(n.callee)
  && n.callee.body && n.callee.body.type === 'BlockStatement';

/** Nom affichable d'une unité : « f() », « Model.sanitize() », « action « nom » ». */
const display = u => (u.kind === 'action' ? `action « ${u.name} »` : u.kind === 'init' ? `(${u.name})` : u.kind === 'module' ? u.id : `${u.id}()`);

/**
 * Parcourt les fichiers et dresse les unités : fonctions de niveau module (ou de niveau global), modules,
 * actions, et une unité « initialisation » par fichier ou module pour les instructions qui ne sont pas des fonctions.
 * @returns {{units:Map, modules:Map, globals:Map<string,object>, globalDeclared:Set<string>}}
 */
function collect(files) {
  const units = new Map();        // id -> unité
  const modules = new Map();      // nom de module -> { name, file, scope: Map nom->unité, declared:Set, exports: Map public->unité }
  const globals = new Map();      // nom global -> unité (fonction de niveau fichier)
  const globalDeclared = new Set();

  const add = (u) => { units.set(u.id, u); return u; };

  for (const f of files) {
    const initId = `initialisation de ${f.name}`;
    const init = { id: initId, name: initId, kind: 'init', file: f, nodes: [], scope: null };
    f.init = init;
    for (const stmt of f.ast.body) {
      let claimed = false;
      if (stmt.type === 'FunctionDeclaration') {
        const u = add({ id: stmt.id.name, name: stmt.id.name, kind: 'function', file: f, stmt, fn: stmt, annotate: true });
        globals.set(u.name, u); globalDeclared.add(u.name); claimed = true;
      } else if (stmt.type === 'VariableDeclaration') {
        const fnDecls = stmt.declarations.filter(d => d.id.type === 'Identifier');
        for (const d of stmt.declarations) for (const n of patternNames(d.id)) globalDeclared.add(n);
        for (const d of fnDecls) {
          if (isFn(d.init)) {
            const u = add({ id: d.id.name, name: d.id.name, kind: 'function', file: f, stmt, fn: d.init, annotate: stmt.declarations.length === 1 });
            globals.set(u.name, u); claimed = true;
          } else if (isModuleIife(d.init)) {
            collectModule(f, stmt, d, add, modules); claimed = true;
          } else if (d.init && d.init.type === 'ObjectExpression') {
            const m = { name: d.id.name, file: f, scope: new Map(), declared: new Set(), exports: new Map(), stmt, fn: null, object: d.init };
            for (const p of d.init.properties) {
              if (p.type !== 'Property' || p.computed || !(p.key.type === 'Identifier')) continue;
              if (isFn(p.value)) {
                const u = add({ id: `${m.name}.${p.key.name}`, name: p.key.name, module: m.name, kind: 'function', file: f, stmt: p, fn: p.value, annotate: false });
                m.scope.set(p.key.name, u); m.exports.set(p.key.name, u);
              }
            }
            modules.set(m.name, m);
          }
        }
      } else if (stmt.type === 'ExpressionStatement' && stmt.expression.type === 'CallExpression'
        && stmt.expression.callee.type === 'Identifier' && stmt.expression.callee.name === 'action'
        && stmt.expression.arguments.length >= 2 && stmt.expression.arguments[0].type === 'Literal'
        && isFn(stmt.expression.arguments[1])) {
        const name = String(stmt.expression.arguments[0].value);
        add({ id: `action « ${name} »`, name, kind: 'action', file: f, stmt, fn: stmt.expression.arguments[1], annotate: true });
        claimed = true;
      }
      if (!claimed) init.nodes.push(stmt);
    }
    if (init.nodes.length) units.set(initId, init);
  }
  return { units, modules, globals, globalDeclared };
}

/** Noms liés par un motif de déclaration (identifiant, déstructuration). */
function patternNames(p, out = []) {
  if (!p) return out;
  switch (p.type) {
    case 'Identifier': out.push(p.name); break;
    case 'ObjectPattern': for (const q of p.properties) patternNames(q.type === 'RestElement' ? q.argument : q.value, out); break;
    case 'ArrayPattern': for (const q of p.elements) patternNames(q, out); break;
    case 'AssignmentPattern': patternNames(p.left, out); break;
    case 'RestElement': patternNames(p.argument, out); break;
    default: break;
  }
  return out;
}

/** Module de la forme `const X = (() => { … return { … }; })();` : fonctions internes et exportations. */
function collectModule(f, stmt, declarator, add, modules) {
  const name = declarator.id.name;
  const body = declarator.init.callee.body.body;
  const m = { name, file: f, scope: new Map(), declared: new Set(), exports: new Map(), stmt, fn: declarator.init.callee };
  add({ id: name, name, kind: 'module', file: f, stmt, fn: declarator.init.callee, annotate: true, module: name });
  const initNodes = [];
  for (const s of body) {
    let claimed = false;
    if (s.type === 'FunctionDeclaration') {
      const u = add({ id: `${name}.${s.id.name}`, name: s.id.name, module: name, kind: 'function', file: f, stmt: s, fn: s, annotate: true });
      m.scope.set(s.id.name, u); m.declared.add(s.id.name); claimed = true;
    } else if (s.type === 'VariableDeclaration') {
      for (const d of s.declarations) for (const n of patternNames(d.id)) m.declared.add(n);
      for (const d of s.declarations) {
        if (d.id.type === 'Identifier' && isFn(d.init)) {
          const u = add({ id: `${name}.${d.id.name}`, name: d.id.name, module: name, kind: 'function', file: f, stmt: s, fn: d.init, annotate: s.declarations.length === 1 });
          m.scope.set(d.id.name, u); claimed = true;
        }
      }
    } else if (s.type === 'ReturnStatement' && s.argument) {
      let obj = s.argument;
      if (obj.type === 'CallExpression' && obj.arguments[0] && obj.arguments[0].type === 'ObjectExpression') obj = obj.arguments[0];
      if (obj.type === 'ObjectExpression') {
        for (const p of obj.properties) {
          if (p.type !== 'Property' || p.computed || p.key.type !== 'Identifier') continue;
          const target = p.value.type === 'Identifier' ? p.value.name : p.key.name;
          if (p.value.type === 'Identifier' && m.scope.has(target)) m.exports.set(p.key.name, m.scope.get(target));
          else if (isFn(p.value)) {
            const u = add({ id: `${name}.${p.key.name}`, name: p.key.name, module: name, kind: 'function', file: f, stmt: p, fn: p.value, annotate: false });
            m.scope.set(p.key.name, u); m.exports.set(p.key.name, u);
          }
        }
      }
      claimed = true;
    }
    if (!claimed) initNodes.push(s);
  }
  m.initNodes = initNodes;
  if (initNodes.length) {
    const id = `initialisation de ${name}`;
    add({ id, name: id, kind: 'init', file: f, nodes: initNodes, scope: m, module: name });
  }
  modules.set(name, m);
}

// ───────────────────────── 3. Appels : parcours avec portées ─────────────────────────

/**
 * Calcule, pour une unité, les unités et les modules qu'elle utilise.
 * @returns {{calls:Set<string>, mods:Set<string>}}
 */
function analyse(unit, env) {
  const calls = new Set(), mods = new Set();
  const mod = unit.module ? env.modules.get(unit.module) : (unit.scope || null);
  const own = unit.kind === 'init' ? null : unit.id;

  /** Résout un nom libre : unité ciblée, module ciblé, ou rien (local, intégré, constante). */
  function resolve(name, scopes) {
    for (const s of scopes) if (s.has(name)) return { local: true };
    if (mod && mod.declared.has(name)) return { unit: mod.scope.get(name) || null };
    if (mod && mod.scope.has(name)) return { unit: mod.scope.get(name) };
    if (env.globals.has(name)) return { unit: env.globals.get(name) };
    if (env.modules.has(name)) return { module: env.modules.get(name) };
    return {};
  }
  const hit = (u) => { if (u && u.id !== own && u.kind !== 'init') calls.add(u.id); };

  function visitFunction(fn, scopes) {
    const names = new Set();
    for (const p of fn.params) patternNames(p).forEach(n => names.add(n));
    if (fn.type === 'FunctionExpression' && fn.id) names.add(fn.id.name);
    hoistVars(fn.body, names);
    const inner = [names, ...scopes];
    for (const p of fn.params) visitPattern(p, inner);
    if (fn.body.type === 'BlockStatement') visitBlock(fn.body, inner, true); else visit(fn.body, inner);
  }
  function hoistVars(node, names) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'VariableDeclaration' && node.kind === 'var') for (const d of node.declarations) patternNames(d.id).forEach(n => names.add(n));
    if (node.type === 'FunctionDeclaration' || isFn(node)) return;
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (Array.isArray(v)) v.forEach(x => hoistVars(x, names)); else if (v && typeof v.type === 'string') hoistVars(v, names);
    }
  }
  function visitBlock(block, scopes, isFunctionBody = false) {
    const names = new Set();
    for (const s of block.body) {
      if (s.type === 'VariableDeclaration' && s.kind !== 'var') for (const d of s.declarations) patternNames(d.id).forEach(n => names.add(n));
      if (s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') names.add(s.id.name);
    }
    const inner = names.size ? [names, ...scopes] : scopes;
    for (const s of block.body) visit(s, inner);
  }
  function visitPattern(p, scopes) {
    if (!p) return;
    if (p.type === 'AssignmentPattern') { visitPattern(p.left, scopes); visit(p.right, scopes); }
    else if (p.type === 'ObjectPattern') for (const q of p.properties) { if (q.type === 'RestElement') visitPattern(q.argument, scopes); else { if (q.computed) visit(q.key, scopes); visitPattern(q.value, scopes); } }
    else if (p.type === 'ArrayPattern') p.elements.forEach(e => visitPattern(e, scopes));
    else if (p.type === 'RestElement') visitPattern(p.argument, scopes);
  }

  function visit(node, scopes) {
    if (!node || typeof node.type !== 'string') return;
    switch (node.type) {
      case 'Identifier': {
        const r = resolve(node.name, scopes);
        if (r.unit) hit(r.unit);
        return;
      }
      case 'MemberExpression': {
        if (node.object.type === 'Identifier') {
          const r = resolve(node.object.name, scopes);
          if (r.module) {
            mods.add(r.module.name);
            if (!node.computed && node.property.type === 'Identifier') hit(r.module.exports.get(node.property.name) || r.module.scope.get(node.property.name));
            else visit(node.property, scopes);
            return;
          }
          if (r.unit) hit(r.unit);
        } else visit(node.object, scopes);
        if (node.computed) visit(node.property, scopes);
        return;
      }
      case 'Property':
        if (node.computed) visit(node.key, scopes);
        visit(node.value, scopes);
        return;
      case 'FunctionDeclaration': {
        visitFunction(node, scopes); return;
      }
      case 'FunctionExpression': case 'ArrowFunctionExpression':
        visitFunction(node, scopes); return;
      case 'BlockStatement': visitBlock(node, scopes); return;
      case 'VariableDeclaration':
        for (const d of node.declarations) { visitPattern(d.id, scopes); visit(d.init, scopes); }
        return;
      case 'ForStatement': case 'ForInStatement': case 'ForOfStatement': {
        const names = new Set();
        const decl = node.type === 'ForStatement' ? node.init : node.left;
        if (decl && decl.type === 'VariableDeclaration' && decl.kind !== 'var') for (const d of decl.declarations) patternNames(d.id).forEach(n => names.add(n));
        const inner = names.size ? [names, ...scopes] : scopes;
        for (const k of ['init', 'test', 'update', 'left', 'right', 'body']) visit(node[k], inner);
        return;
      }
      case 'CatchClause': {
        const names = new Set(patternNames(node.param));
        visit(node.body, [names, ...scopes]); return;
      }
      case 'LabeledStatement': visit(node.body, scopes); return;
      case 'BreakStatement': case 'ContinueStatement': return;
      case 'ClassDeclaration': case 'ClassExpression':
        if (node.superClass) visit(node.superClass, scopes);
        for (const m of node.body.body) { if (m.computed) visit(m.key, scopes); visit(m.value, scopes); }
        return;
      default:
        for (const k of Object.keys(node)) {
          if (k === 'type' || k === 'start' || k === 'end') continue;
          const v = node[k];
          if (Array.isArray(v)) v.forEach(x => visit(x, scopes)); else if (v && typeof v.type === 'string') visit(v, scopes);
        }
    }
  }

  if (unit.kind === 'init') {
    for (const n of unit.nodes) visit(n, []);
  } else if (unit.kind === 'module') {
    // le module « appelle » ce que font ses fonctions (calculé à part) : on ne parcourt que ses instructions d'initialisation
    for (const n of (mod && mod.initNodes) || []) visit(n, []);
    if (mod && mod.object) visit(mod.object, []);
  } else {
    visitFunction(unit.fn, []);
  }
  return { calls, mods };
}

// ───────────────────────── 4. Graphe ─────────────────────────

/** Calcule les appels de chaque unité, les appelants, et les dépendances entre modules et entre fichiers. */
function buildGraph(files) {
  const env = collect(files);
  const info = new Map();
  for (const u of env.units.values()) info.set(u.id, analyse(u, env));

  // Un module appelle ce qu'appellent ses fonctions et son initialisation, hors lui-même.
  const modDeps = new Map();        // module -> Set(modules utilisés)
  const unitDeps = new Map();       // id d'unité -> Set(ids appelés)
  const owner = u => (u.module || (u.kind === 'module' ? u.id : null));
  for (const [id, { calls, mods }] of info) {
    unitDeps.set(id, new Set(calls));
    const u = env.units.get(id);
    const mine = owner(u);
    if (!mine) continue;
    const set = modDeps.get(mine) || modDeps.set(mine, new Set()).get(mine);
    for (const c of calls) { const cu = env.units.get(c); const o = cu && owner(cu); if (o && o !== mine) set.add(o); }
    for (const m of mods) if (m !== mine) set.add(m);
  }
  // Les appels de chaque unité vers un module (membre non fonction, par exemple `Model.LIMITS`) comptent aussi.
  const callers = new Map();
  for (const [id, deps] of unitDeps) for (const c of deps) (callers.get(c) || callers.set(c, new Set()).get(c)).add(id);
  // Appelants d'un module : modules et unités extérieures qui l'utilisent.
  const modCallers = new Map();
  for (const [m, deps] of modDeps) for (const d of deps) (modCallers.get(d) || modCallers.set(d, new Set()).get(d)).add(m);
  // Fichiers d'interface (ou globaux) qui utilisent un module.
  const fileUses = new Map();       // nom de fichier -> Set(modules)
  const fileModUsers = new Map();   // module -> Set(fichiers hors module)
  for (const [id, { calls, mods }] of info) {
    const u = env.units.get(id);
    if (owner(u)) continue;
    const used = new Set(mods);
    for (const c of calls) { const cu = env.units.get(c); const o = cu && owner(cu); if (o) used.add(o); }
    const s = fileUses.get(u.file.name) || fileUses.set(u.file.name, new Set()).get(u.file.name);
    for (const m of used) { s.add(m); (fileModUsers.get(m) || fileModUsers.set(m, new Set()).get(m)).add(u.file.name); }
  }
  return { env, unitDeps, callers, modDeps, modCallers, fileUses, fileModUsers };
}

// ───────────────────────── 5. Écriture des commentaires ─────────────────────────

/** Liste de noms formatée : triée, tronquée au-delà de MAX_NAMES. */
function names(list, env, qualify) {
  const items = [...list].map(id => env.units.get(id)).filter(Boolean).map(display).sort((a, b) => a.localeCompare(b, 'fr'));
  if (!items.length) return null;
  if (items.length > MAX_NAMES) return `${items.length} ${qualify}`;
  return items.join(', ');
}
/** Cale un texte sur des lignes de commentaire (préfixe ` * `), avec continuation en retrait. */
function wrap(label, text, indent) {
  const first = `${indent} * ${label} : `;
  const cont = `${indent} *   `;
  const out = []; let line = first;
  for (const word of text.split(' ')) {
    const candidate = line === first || line === cont ? line + word : `${line} ${word}`;
    if (candidate.length > WIDTH && line !== first && line !== cont) { out.push(line); line = cont + word; } else line = candidate;
  }
  out.push(line);
  return out;
}

/** Texte des deux lignes d'une unité. */
function linesFor(u, g, indent) {
  const { env, unitDeps, callers, modDeps, modCallers, fileModUsers } = g;
  let calls, called;
  if (u.kind === 'module') {
    const deps = [...(modDeps.get(u.id) || [])].sort((a, b) => a.localeCompare(b, 'fr'));
    calls = deps.length ? deps.join(', ') : null;
    const users = new Set([...(modCallers.get(u.id) || [])]);
    for (const f of fileModUsers.get(u.id) || []) users.add(f);
    const arr = [...users].sort((a, b) => a.localeCompare(b, 'fr'));
    called = arr.length > MAX_NAMES ? `${arr.length} modules et fichiers (voir Architecture.md)` : arr.join(', ') || null;
  } else if (u.kind === 'action') {
    calls = names(unitDeps.get(u.id) || [], env, 'fonctions');
    const direct = names(callers.get(u.id) || [], env, 'fonctions');
    called = `l'événement « ${u.name} » (table ACTIONS)${direct ? `, ${direct}` : ''}`;
  } else {
    calls = names(unitDeps.get(u.id) || [], env, 'fonctions');
    called = names(callers.get(u.id) || [], env, 'fonctions (usage général)');
  }
  const a = wrap('Appelle', calls || 'aucune', indent);
  const b = wrap('Appelée par', called || 'aucune dans le code (point d\'entrée ou appel dynamique)', indent);
  return [...a, ...b];
}

/** Applique les lignes à un fichier : remplace la fin du commentaire précédant chaque unité, ou en crée un. */
function annotateFile(f, g) {
  const edits = [];
  const comments = f.comments;
  const units = [...g.env.units.values()].filter(u => u.file === f && u.annotate && u.kind !== 'init');
  const seen = new Set();
  for (const u of units) {
    if (seen.has(u.stmt.start)) continue;   // une seule annotation par instruction
    seen.add(u.stmt.start);
    const lineStart = f.text.lastIndexOf('\n', u.stmt.start - 1) + 1;
    const indent = f.text.slice(lineStart, u.stmt.start).match(/^\s*/)[0];
    if (f.text.slice(lineStart, u.stmt.start).trim() !== '') continue;   // instruction non placée en début de ligne
    const lines = linesFor(u, g, indent);
    // commentaire de bloc collé à l'instruction (au plus un retour à la ligne entre les deux)
    const prev = [...comments].reverse().find(c => c.end <= u.stmt.start && f.text.slice(c.end, u.stmt.start).split('\n').length <= 2 && f.text.slice(c.end, u.stmt.start).trim() === '' && c.block && f.text.slice(f.text.lastIndexOf('\n', c.start - 1) + 1, c.start).trim() === '');
    if (prev) {
      const raw = f.text.slice(prev.start, prev.end);
      const cIndent = f.text.slice(f.text.lastIndexOf('\n', prev.start - 1) + 1, prev.start).match(/^\s*/)[0];
      let body = raw.slice(2, -2);                       // contenu entre /* et */
      const isDoc = body.startsWith('*');
      if (isDoc) body = body.slice(1);
      let rows = body.split('\n').map(r => r.replace(/^\s*\*? ?/, '').replace(/\s+$/, ''));
      while (rows.length && rows[0].trim() === '') rows.shift();
      while (rows.length && rows[rows.length - 1].trim() === '') rows.pop();
      const cut = rows.findIndex(r => /^\s*(Appelle|Appelée par)\s*:/.test(r));
      if (cut >= 0) rows = rows.slice(0, cut);
      while (rows.length && rows[rows.length - 1].trim() === '') rows.pop();
      const head = rows.map(r => (r.trim() === '' ? `${cIndent} *` : `${cIndent} * ${r}`));
      if (u.kind === 'module' && head.length) head.push(`${cIndent} *`);
      const open = isDoc ? '/**' : '/*';
      const text = [`${cIndent}${open}`, ...head, ...lines.map(l => cIndent + l.slice(indent.length)), `${cIndent} */`].join('\n');
      edits.push({ start: prev.start, end: prev.end, text: text.slice(cIndent.length) });
    } else {
      const text = [`${indent}/**`, ...lines, `${indent} */`].join('\n') + '\n';
      edits.push({ start: lineStart, end: lineStart, text });
    }
  }
  let out = f.text;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

// ───────────────────────── 6. Architecture.md ─────────────────────────

/** Graphe des modules du moteur (sans Dates, utilisé par presque tous) et tableau d'usage par fichier d'interface. */
function architectureBlocks(g, files) {
  const coreModules = new Set([...g.env.modules.values()].filter(m => m.file.dir === 'core').map(m => m.name));
  const edges = [];
  for (const m of [...coreModules].sort()) for (const d of [...(g.modDeps.get(m) || [])].sort()) if (coreModules.has(d) && d !== 'Dates') edges.push(`  ${m} --> ${d}`);
  const mermaid = ['```mermaid', 'flowchart LR', ...edges, '```'].join('\n');
  const rows = ['| Fichier d\'interface | Modules du moteur utilisés |', '|---|---|'];
  for (const f of files.filter(x => x.dir === 'ui')) {
    const used = [...(g.fileUses.get(f.name) || [])].filter(m => coreModules.has(m)).sort();
    if (used.length) rows.push(`| \`${f.name}\` | ${used.map(m => `\`${m}\``).join(', ')} |`);
  }
  return { modules: mermaid, ui: rows.join('\n') };
}
function replaceBlock(text, tag, content) {
  const re = new RegExp(`(<!-- dependances:${tag}:debut -->)[\\s\\S]*?(<!-- dependances:${tag}:fin -->)`);
  if (!re.test(text)) throw new Error(`Marqueurs « dependances:${tag} » absents d'Architecture.md`);
  return text.replace(re, (_, a, b) => `${a}\n${content}\n${b}`);
}

// ───────────────────────── 7. Programme ─────────────────────────

const files = sourceFiles().map(parse);
const g = buildGraph(files);
const stale = [];
let written = 0;
for (const f of files) {
  const next = annotateFile(f, g);
  if (next !== f.text) {
    stale.push(f.rel);
    if (!CHECK) { fs.writeFileSync(path.join(ROOT, f.rel), next); written++; }
  }
}
const archPath = path.join(ROOT, 'Architecture.md');
if (fs.existsSync(archPath)) {
  const blocks = architectureBlocks(g, files);
  const cur = fs.readFileSync(archPath, 'utf8');
  const next = replaceBlock(replaceBlock(cur, 'modules', blocks.modules), 'ui', blocks.ui);
  if (next !== cur) { stale.push('Architecture.md'); if (!CHECK) { fs.writeFileSync(archPath, next); written++; } }
}
if (CHECK) {
  if (stale.length) {
    console.error(`Dépendances périmées dans : ${stale.join(', ')}\nLancez « node tools/dependances.mjs » puis recommitez.`);
    process.exit(1);
  }
  console.log('Dépendances à jour.');
} else {
  console.log(written ? `${written} fichier(s) mis à jour.` : 'Rien à changer : dépendances à jour.');
  const n = [...g.env.units.values()].filter(u => u.annotate && u.kind !== 'init').length;
  console.log(`${n} unités annotées (${g.env.modules.size} modules).`);
}
