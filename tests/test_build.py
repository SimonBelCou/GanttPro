#!/usr/bin/env python3
"""Outil tools/build.py : le fichier assemblé est le même sur tout poste (Windows comme Linux).

Défaut corrigé (PCA.md, problèmes récurrents) : sous Windows, les en-têtes de fichiers étaient écrits avec « \\ » et le
fichier en fins de ligne CRLF ; « build.py --check » échouait alors sur toute branche et la CSP ne correspondait plus.
Le dépôt réel n'est pas modifié : l'écriture se fait dans un dossier temporaire.

    python3 tests/test_build.py
"""
import importlib.util
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_build():
    """Charge tools/build.py comme module, sans l'exécuter."""
    spec = importlib.util.spec_from_file_location('build', ROOT / 'tools' / 'build.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    build = load_build()
    failures = []

    # 1. Les en-têtes de fichiers utilisent « / » quel que soit le système.
    html = build.assemble()
    heads = re.findall(r'^// ── (.+?) ──$', html, re.M)
    if not heads:
        failures.append("aucun en-tête de fichier trouvé dans le script assemblé")
    bad = [x for x in heads if not re.fullmatch(r'js/(core|ui)/[\w.-]+\.js', x)]
    if bad:
        failures.append(f"en-têtes non portables : {bad[:3]}")

    # 2. Le fichier écrit est en fins de ligne LF, octet pour octet.
    with tempfile.TemporaryDirectory() as tmp:
        build.OUT = Path(tmp) / 'GanttPro.html'
        argv, sys.argv = sys.argv, ['build.py']
        try:
            build.main()
        finally:
            sys.argv = argv
        data = build.OUT.read_bytes()
        if b'\r\n' in data:
            failures.append("le fichier écrit contient des fins de ligne CRLF")
        if data.decode('utf-8') != html:
            failures.append("le fichier écrit diffère du contenu assemblé")

    for f in failures:
        print('ÉCHEC :', f)
    print('build.py portable : ' + ('ÉCHEC' if failures else 'OK'))
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
