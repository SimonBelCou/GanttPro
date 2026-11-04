#!/usr/bin/env python3
"""Outil tools/build.py : le fichier assemblé est le même sur tout poste (Windows comme Linux).

Défaut corrigé (PCA.md, problèmes récurrents) : sous Windows, les en-têtes de fichiers étaient écrits avec « \\ » et le
fichier en fins de ligne CRLF ; « build.py --check » échouait alors sur toute branche et la CSP ne correspondait plus.
Le dépôt réel n'est pas modifié : l'écriture se fait dans un dossier temporaire.

Versionnement (décisions V1 à V9 du 3 novembre 2026) : le numéro du fichier VERSION est injecté dans le titre, la balise
<meta name="generator"> et Model.APP_VERSION ; un numéro mal formé refuse le build ; tools/version.py contrôle la
concordance avec CHANGELOG.md, extrait les notes de publication et contrôle une étiquette avant sa pose.

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


def load_version():
    """Charge tools/version.py comme module, sans l'exécuter."""
    spec = importlib.util.spec_from_file_location('version', ROOT / 'tools' / 'version.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def version_failures(build) -> list[str]:
    """Injection du numéro (titre, generator, Model.APP_VERSION), refus d'un numéro mal formé, outil tools/version.py."""
    failures = []
    version = (ROOT / 'VERSION').read_text(encoding='utf-8').strip()
    html = build.assemble()
    if f'<title>GanttPro {version}</title>' not in html:
        failures.append("le titre de la page ne porte pas la version")
    if f'<meta name="generator" content="GanttPro {version}">' not in html:
        failures.append("la balise generator ne porte pas la version")
    if f"const APP_VERSION = '{version}';" not in html or '@VERSION@' in html:
        failures.append("Model.APP_VERSION n'est pas injecté (ou un marqueur @VERSION@ reste)")
    with tempfile.TemporaryDirectory() as tmp:
        saved = build.VERSION_FILE
        for bad in ('3.0', 'v3.0.0', '3.0.0-rc.1', '03.0.0', "3.0.0'<script>", ''):
            build.VERSION_FILE = Path(tmp) / 'VERSION'
            build.VERSION_FILE.write_text(bad, encoding='utf-8')
            try:
                build.assemble()
                failures.append(f"VERSION {bad!r} accepté")
            except SystemExit:
                pass
        build.VERSION_FILE = saved

    v = load_version()
    unreleased = "# Journal\n\n## Non publié\n\n- travail\n"
    released = "# Journal\n\n## Non publié\n\n- suite\n\n## [3.1.0] - 2026-12-01\n\n- fonction\n\n## [3.0.0] - 2026-11-10\n\n- départ\n"
    cases = [
        (v.check('3.0.0', unreleased), [], "sans section datée, « Non publié » suffit"),
        (bool(v.check('3.0.0', '# Journal\n')), True, "ni section datée ni « Non publié » : refusé"),
        (v.check('3.1.0', released), [], "première section datée = VERSION"),
        (bool(v.check('3.0.0', released)), True, "VERSION en retard sur le CHANGELOG : refusé"),
        (v.notes('3.0.0', released), '- départ\n', "notes de la dernière section"),
        (v.notes('3.1.0', released), '- fonction\n', "notes d'une section suivie d'une autre"),
        (v.tag_check('3.1.0', '3.1.0', released), [], "étiquette conforme"),
        (bool(v.tag_check('3.0.0', '3.1.0', released)), True, "étiquette différente de VERSION : refusée"),
        (bool(v.tag_check('3.0.0', '3.0.0', unreleased)), True, "étiquette sans section datée : refusée"),
        (bool(v.tag_check('3.1.0; rm -rf /', '3.1.0', released)), True, "saisie hostile : refusée"),
    ]
    for got, want, what in cases:
        if got != want:
            failures.append(f"version.py : {what} (obtenu {got!r})")
    try:
        v.notes('9.9.9', released)
        failures.append("version.py : notes d'une version absente acceptées")
    except ValueError:
        pass
    errors = build.changelog_errors()
    if errors:
        failures.append(f"CHANGELOG.md et VERSION discordants : {errors}")
    return failures


def main() -> int:
    build = load_build()
    failures = version_failures(build)

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
    print('build.py portable et versionné : ' + ('ÉCHEC' if failures else 'OK'))
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
