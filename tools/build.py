#!/usr/bin/env python3
"""Assemble GanttPro v3 en un seul fichier HTML autonome (EX-18).

Sources :
    src/index.html      gabarit, avec les marqueurs <!--CSP-->, /*@STYLES@*/ et //@SCRIPT@
    src/styles/*.css    feuilles de style, concaténées dans l'ordre alphabétique
    src/js/core/*.js    moteur de calcul et données (sans DOM), dans l'ordre alphabétique
    src/js/ui/*.js      interface, dans l'ordre alphabétique

Tout le JavaScript est placé dans UNE fonction immédiatement exécutée, en mode strict :
aucun nom n'est exposé sur `window`.

Sécurité (CLAUDE.md, SECURITY.md) : la Content-Security-Policy autorise le script ET la
feuille de style par leur empreinte SHA-256. Ni 'unsafe-inline' ni 'unsafe-eval' : un
attribut style="" ou onclick="" injecté est bloqué par le navigateur. Les styles calculés
(positions des barres, couleurs) sont appliqués par le CSSOM (element.style.setProperty),
que la CSP n'interdit pas.

    python3 tools/build.py            # écrit dist/GanttPro.html
    python3 tools/build.py --check    # échoue si dist/GanttPro.html n'est pas à jour (CI)
"""
import base64
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
OUT = ROOT / 'dist' / 'GanttPro.html'

# Motifs interdits dans les sources (règles A03 de CLAUDE.md) : contrôlés à chaque build.
FORBIDDEN_JS = [
    (r'\beval\s*\(', "eval() est interdit"),
    (r'\bnew\s+Function\s*\(', "new Function() est interdit"),
    (r'document\.write', "document.write est interdit"),
    (r'\son[a-z]+\s*=\s*["\'`]', "gestionnaire d'événement en ligne (onclick=…) interdit : utiliser data-click"),
    (r'\sstyle\s*=\s*["\'`]', "attribut style en ligne interdit (bloqué par la CSP) : utiliser le CSSOM"),
    (r'setAttribute\(\s*["\']style["\']', "setAttribute('style') interdit : utiliser element.style"),
    (r'setAttribute\(\s*["\']on[a-z]+["\']', "setAttribute('on…') interdit"),
    (r'console\.(log|info|debug|warn|error)\s*\(', "pas de journalisation : les noms de ressources sont des données personnelles"),
    (r'\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b', "aucun appel réseau (connect-src 'none')"),
    (r'localStorage|sessionStorage|indexedDB', "accès au stockage uniquement par le module storage (src/js/ui/10-storage.js)"),
]
STORAGE_MODULE = '10-storage.js'


def b64sha256(text: str) -> str:
    return base64.b64encode(hashlib.sha256(text.encode('utf-8')).digest()).decode()


def build_csp(script_hash: str, style_hash: str) -> str:
    return "; ".join([
        "default-src 'none'",
        f"script-src 'sha256-{script_hash}'",
        f"style-src 'sha256-{style_hash}'",   # pas de 'unsafe-inline' : styles calculés via le CSSOM
        "font-src data:",                     # polices intégrées
        "img-src data: blob:",                # export PNG, aperçus
        "connect-src 'none'",                 # aucune requête réseau
        "worker-src 'none'",
        "frame-src 'none'",
        "form-action 'none'",
        "base-uri 'none'",
        "object-src 'none'",
    ])


def lint(path: Path, code: str) -> list[str]:
    errors = []
    # Les commentaires et les chaînes de messages peuvent citer ces motifs : on retire les commentaires.
    stripped = re.sub(r'/\*.*?\*/', '', code, flags=re.S)
    stripped = re.sub(r'(^|[^:\\])//[^\n]*', r'\1', stripped)
    for pattern, why in FORBIDDEN_JS:
        if pattern.startswith('localStorage') and path.name == STORAGE_MODULE:
            continue
        for m in re.finditer(pattern, stripped):
            line = stripped[:m.start()].count('\n') + 1
            errors.append(f"{path.relative_to(ROOT)}:{line}: {why}")
    return errors


def js_files() -> list[Path]:
    return sorted((SRC / 'js' / 'core').glob('*.js')) + sorted((SRC / 'js' / 'ui').glob('*.js'))


def assemble() -> str:
    template = (SRC / 'index.html').read_text(encoding='utf-8')
    styles = '\n'.join(p.read_text(encoding='utf-8') for p in sorted((SRC / 'styles').glob('*.css')))
    errors, parts = [], []
    for p in js_files():
        code = p.read_text(encoding='utf-8')
        errors += lint(p, code)
        parts.append(f"// ── {p.relative_to(SRC)} ──\n{code.rstrip()}\n")
    if errors:
        raise SystemExit("Build refusé :\n  " + "\n  ".join(errors))
    if re.search(r'\sstyle\s*=|\son[a-z]+\s*=', re.sub(r'<!--.*?-->', '', template, flags=re.S)):
        raise SystemExit("Build refusé : attribut style= ou on…= dans src/index.html")
    script = "\n(() => {\n'use strict';\n" + "\n".join(parts) + "})();\n"
    style = "\n" + styles + "\n"
    for marker in ('<!--CSP-->', '/*@STYLES@*/', '//@SCRIPT@'):
        if template.count(marker) != 1:
            raise SystemExit(f"Build refusé : le marqueur {marker} doit apparaître une fois dans src/index.html")
    html = template.replace('/*@STYLES@*/', style)
    html = html.replace('//@SCRIPT@', script)
    # Les empreintes portent sur le contenu exact des balises, après insertion.
    scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
    stylesheets = re.findall(r'<style>(.*?)</style>', html, re.S)
    if len(scripts) != 1 or len(stylesheets) != 1 or re.search(r'<script[^>]+src=', html):
        raise SystemExit("Build refusé : exactement un <script> et un <style> en ligne sont attendus.")
    if '</script' in script.lower() or '</style' in style.lower():
        raise SystemExit("Build refusé : une source contient une balise fermante.")
    csp = build_csp(b64sha256(scripts[0]), b64sha256(stylesheets[0]))
    return html.replace('<!--CSP-->', f'<meta http-equiv="Content-Security-Policy" content="{csp}">')


def main() -> int:
    html = assemble()
    if '--check' in sys.argv[1:]:
        if not OUT.exists() or OUT.read_text(encoding='utf-8') != html:
            print("dist/GanttPro.html n'est pas à jour : lancez « python3 tools/build.py » puis recommitez.")
            return 1
        print("dist/GanttPro.html à jour.")
        return 0
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html, encoding='utf-8')
    print(f"dist/GanttPro.html écrit ({len(html.encode('utf-8')) // 1024} Ko).")
    return 0


if __name__ == '__main__':
    sys.exit(main())
