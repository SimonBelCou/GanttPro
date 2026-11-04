#!/usr/bin/env python3
"""Régression : un clic sur un bouton de la barre d'outils juste après la saisie d'un champ n'est pas perdu.

    python3 tools/build.py && python3 tests/test_v3_clic_change.py
    BROWSER=webkit python3 tests/test_v3_clic_change.py   # le défaut n'apparaissait que sous WebKit

Pourquoi : le « change » d'un champ part au blur, c'est-à-dire PENDANT le mousedown du bouton visé, et
render() réécrit alors le texte des boutons (textContent). WebKit supprime le « click » quand le contenu du
bouton est remplacé entre mousedown et mouseup ; Chromium et Firefox le conservent. Les textes ne sont donc
réécrits que s'ils changent (setText). Le test saisit une date de début de projet, clique directement sur
chaque bouton et exige que l'événement « click » arrive.
"""
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_v3 import HTML, check, results  # noqa: E402

BROWSER = os.environ.get('BROWSER', 'chromium')
BUTTONS = ['#btn-theme', '#btn-lang', '#btn-links', '#btn-list']


def main():
    with sync_playwright() as p:
        engine = getattr(p, BROWSER)
        browser = engine.launch(args=['--no-sandbox']) if BROWSER == 'chromium' else engine.launch()
        print(f'Navigateur : {BROWSER} {browser.version}')
        pg = browser.new_context(viewport={'width': 1500, 'height': 950}, locale='fr-FR').new_page()
        pg.goto(HTML.as_uri())
        pg.wait_for_selector('#task-rows tr')
        pg.evaluate("window.__clicks = []; document.addEventListener('click', e => window.__clicks.push(e.target.closest('button') ? e.target.closest('button').id : ''), true)")
        day = 10
        for sel in BUTTONS:
            day += 1
            pg.click('#project-start')
            pg.keyboard.press('Control+a')
            pg.keyboard.type(f'2026-02-{day:02d}')
            pg.evaluate("window.__clicks = []")
            pg.click(sel, timeout=5000)
            got = pg.evaluate("window.__clicks")
            check(f'clic reçu sur {sel} juste après la saisie de la date', sel[1:] in got, got)
        browser.close()
    failed = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} vérifications réussies.")
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
