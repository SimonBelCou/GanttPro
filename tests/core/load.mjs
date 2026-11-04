// Charge le moteur de GanttPro (src/js/core/*.js) dans un contexte isolé, sans navigateur,
// exactement comme le fait l'assemblage (mêmes fichiers, même ordre, mode strict).
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CORE = join(ROOT, 'src', 'js', 'core');
// Même injection du numéro de version que tools/build.py (source unique : fichier VERSION).
const VERSION = readFileSync(join(ROOT, 'VERSION'), 'utf8').trim();

export function loadCore() {
  const files = readdirSync(CORE).filter(f => f.endsWith('.js')).sort();
  const code = files.map(f => readFileSync(join(CORE, f), 'utf8')).join('\n').replace("'@VERSION@'", JSON.stringify(VERSION));
  const names = [...code.matchAll(/^const ([A-Z][A-Za-z0-9]+) = \(\(\) => \{/gm)].map(m => m[1]);
  // Seules les API standard du navigateur utilisées par le moteur sont fournies.
  const ctx = vm.createContext({ TextEncoder, TextDecoder, Blob, DecompressionStream, CompressionStream, Response, crypto: globalThis.crypto, btoa, atob });
  return vm.runInContext(`'use strict';\n${code}\n;({${names.join(',')}})`, ctx, { filename: 'core.js' });
}
