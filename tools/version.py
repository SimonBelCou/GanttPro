#!/usr/bin/env python3
"""Versionnement de GanttPro : concordance VERSION / CHANGELOG, notes de publication, contrôle d'une étiquette.

Source unique du numéro : le fichier VERSION à la racine (X.Y.Z, SemVer : majeur = format de fichier incompatible,
mineur = fonctionnalité, correctif = correction ; décisions V1 à V9 du 3 novembre 2026, Specs_fonctionnelles.md,
annexe C). Une version publiée a dans CHANGELOG.md une section « ## [X.Y.Z] - AAAA-MM-JJ » ; le travail en cours est
sous « ## Non publié ».

    python3 tools/version.py check            # VERSION valide et égal à la première section datée (CI, via build.py --check)
    python3 tools/version.py notes 3.0.0      # écrit les notes de la section 3.0.0 (workflow release.yml)
    python3 tools/version.py tag-check 3.0.0  # numéro SemVer, égal à VERSION et première section datée (workflow etiquette.yml)

Le numéro passé en argument vient d'une saisie (workflow déclenché à la main) : il est validé par expression
régulière avant tout usage et n'est jamais interprété par un shell ici.

Appelle : aucun autre module (bibliothèque standard seulement)
Appelée par : tools/build.py (main), .github/workflows/etiquette.yml, .github/workflows/release.yml, tests/test_build.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHANGELOG = ROOT / 'CHANGELOG.md'
SEMVER = re.compile(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)')
DATED = re.compile(r'^## \[(\S+)\] - (\d{4}-\d{2}-\d{2})\s*$', re.M)
UNRELEASED = re.compile(r'^## Non publié\s*$', re.M)


def read_version(root: Path = ROOT) -> str:
    """Numéro du fichier VERSION ; ValueError s'il n'est pas de la forme X.Y.Z.
    Appelée par : check(), tag_check()"""
    path = root / 'VERSION'
    v = path.read_text(encoding='utf-8').strip() if path.exists() else ''
    if not SEMVER.fullmatch(v):
        raise ValueError(f"le fichier VERSION doit contenir un numéro X.Y.Z (trouvé : « {v[:40]} »)")
    return v


def sections(text: str) -> list[tuple[str, str]]:
    """Sections datées du CHANGELOG, de la plus récente à la plus ancienne : [(numéro, date)].
    Appelée par : check(), tag_check()"""
    return [(m.group(1), m.group(2)) for m in DATED.finditer(text)]


def check(version: str, text: str) -> list[str]:
    """Erreurs de concordance (liste vide si tout va bien) : la première section datée porte le numéro de VERSION ;
    tant qu'aucune n'existe, la section « Non publié » doit exister.
    Appelée par : main(), tools/build.py"""
    errors = []
    found = sections(text)
    for v, _ in found:
        if not SEMVER.fullmatch(v):
            errors.append(f"CHANGELOG.md : « [{v[:40]}] » n'est pas un numéro X.Y.Z")
    if found:
        if found[0][0] != version:
            errors.append(f"VERSION vaut {version} mais la première section datée de CHANGELOG.md est {found[0][0]}")
    elif not UNRELEASED.search(text):
        errors.append("CHANGELOG.md : ni section datée « ## [X.Y.Z] - AAAA-MM-JJ » ni section « ## Non publié »")
    return errors


def notes(version: str, text: str) -> str:
    """Corps de la section « ## [version] - date », sans son titre ; ValueError si elle n'existe pas.
    Appelée par : main()"""
    m = re.search(r'^## \[' + re.escape(version) + r'\] - \d{4}-\d{2}-\d{2}\s*$', text, re.M)
    if not m:
        raise ValueError(f"CHANGELOG.md n'a pas de section « ## [{version}] - AAAA-MM-JJ »")
    rest = text[m.end():]
    end = re.search(r'^## ', rest, re.M)
    body = (rest[:end.start()] if end else rest).strip()
    if not body:
        raise ValueError(f"la section {version} de CHANGELOG.md est vide")
    return body + '\n'


def tag_check(version: str, root_version: str, text: str) -> list[str]:
    """Contrôles avant de poser l'étiquette v<version> (V9).
    Appelée par : main()"""
    if not SEMVER.fullmatch(version):
        return [f"« {version[:40]} » n'est pas un numéro X.Y.Z"]
    errors = []
    if version != root_version:
        errors.append(f"le numéro saisi ({version}) diffère du fichier VERSION ({root_version})")
    found = sections(text)
    if not found or found[0][0] != version:
        errors.append(f"la première section datée de CHANGELOG.md doit être « ## [{version}] - AAAA-MM-JJ »")
    errors += check(root_version, text)
    return sorted(set(errors))


def main(argv: list[str]) -> int:
    """Appelle : check(), notes(), read_version(), tag_check()"""
    if not argv or argv[0] not in ('check', 'notes', 'tag-check') or (argv[0] != 'check' and len(argv) != 2):
        print(__doc__)
        return 2
    text = CHANGELOG.read_text(encoding='utf-8')
    try:
        root_version = read_version()
        if argv[0] == 'notes':
            sys.stdout.write(notes(argv[1], text))
            return 0
        errors = check(root_version, text) if argv[0] == 'check' else tag_check(argv[1], root_version, text)
    except ValueError as e:
        errors = [str(e)]
    for e in errors:
        print('ERREUR :', e)
    if not errors:
        print(f"Version {root_version} : concordance avec CHANGELOG.md vérifiée.")
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
