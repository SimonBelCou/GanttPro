#!/usr/bin/env python3
"""Contrôle des attendus chiffrés de docs/recette-manuelle.md (partie A) sur les projets de tests/fixtures.

    python3 tools/build.py && python3 tests/test_v3_recette_manuelle.py

Un attendu du document qui cesserait d'être vrai fait échouer ce test : le document et l'outil restent d'accord.
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_v3 import HTML, check, results  # noqa: E402

FX = Path(__file__).resolve().parent / 'fixtures'


def sp(s):
    return (s or '').replace(' ', ' ').replace(' ', ' ')


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-sandbox'])
        pg = browser.new_context(viewport={'width': 1500, 'height': 950}, locale='fr-FR').new_page()
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.clock.set_fixed_time('2026-11-12T10:00:00')
        pg.goto(HTML.as_uri())
        pg.wait_for_selector('#task-rows tr')

        def load(name):
            pg.set_input_files('#file-input', str(FX / name))
            pg.wait_for_selector('dialog[open]')
            for _ in range(2):
                b = pg.locator('dialog[open]').last.locator('button:has-text("Remplacer le projet ouvert")')
                if b.count():
                    b.first.click()
                    pg.wait_for_timeout(120)
            pg.wait_for_timeout(200)

        def kpis():
            return sp(pg.inner_text('#kpis').replace('\n', ' '))

        def row(id_):
            return sp(pg.inner_text(f'#task-rows tr[data-id="{id_}"]').replace('\n', ' '))

        def open_task(id_):
            pg.click(f'#task-rows tr[data-id="{id_}"] button.select')
            pg.wait_for_selector('#editor:not([hidden])')

        def save():
            pg.click('#edit-form button[type=submit]')
            pg.wait_for_timeout(120)

        # ── G2, G4 : projet-exemple ──────────────────────────────────────────────────────────
        load('projet-exemple.json')
        check('G2 : fin au lundi 30 novembre 2026', 'Fin lun. 30 nov. 2026' in kpis(), kpis())
        check('G2 : P1 dure 5 j et P2 14 j', '5 j' in row('P1') and '14 j' in row('P2'), (row('P1'), row('P2')))
        check('G4 : chemin critique T1 → T2 → M1 → T3 → T4', 'T1 → T2 → M1 → T3 → T4' in kpis(), kpis())
        check('G4 : dépendances de T3 et T4', 'M1 FD+1' in row('T3') and 'T3' in row('T4'), (row('T3'), row('T4')))
        pg.fill('#project-start', '2026-11-07')
        pg.wait_for_timeout(200)
        check('G2 : début un samedi accepté, date saisie conservée', pg.input_value('#project-start') == '2026-11-07')
        pg.click('#btn-undo'); pg.wait_for_timeout(150)
        check('G2 : annuler rétablit le 2 novembre et la fin du 30', pg.input_value('#project-start') == '2026-11-02' and 'Fin lun. 30 nov. 2026' in kpis(), kpis())

        # G3 : durée refusée
        open_task('T3')
        pg.fill('#f-dur', '0'); save()
        err = sp(pg.inner_text('#f-dur-err'))
        check('G3 : durée 0 refusée avec le message de la recette', 'entier de 1 à 3 650' in err, err)
        pg.keyboard.press('Escape')

        # G4 : boucle refusée, date imposée, échéance
        open_task('T1')
        pg.select_option('#dep-pick', 'T4'); pg.click('button[data-click="draftAddDep"]')
        loop = sp(pg.inner_text('#deps-err'))
        check('G4 : T1 dépend de T4 refusé avec le chemin de la boucle', 'boucle' in loop and 'T1' in loop, loop)
        pg.keyboard.press('Escape')
        open_task('T3')
        pg.fill('#f-forcedStart', '2026-11-04'); save()
        check('G4 : date imposée avant la fin de M1 : 📌 et alerte', '📌' in row('T3') and pg.is_visible('#btn-alerts'), row('T3'))
        pg.click('#btn-undo'); pg.wait_for_timeout(120)
        open_task('T4')
        pg.fill('#f-deadline', '2026-11-20'); save()
        check('G4 : échéance dépassée signalée sur la ligne', 'échéance dépassée' in row('T4'), row('T4'))
        pg.click('#btn-undo'); pg.wait_for_timeout(120)

        # ── G5 : projet-surcharge ────────────────────────────────────────────────────────────
        load('projet-surcharge.json')
        check('G5 : « 1 conflit » et A, B en conflit', '1 conflit' in sp(pg.inner_text('#btn-alerts')) and 'en conflit' in row('A') and 'en conflit' in row('B'), (pg.inner_text('#btn-alerts'), row('A')))
        check('G5 : C et D hors conflit', 'en conflit' not in row('C') and 'en conflit' not in row('D'))

        # ── G9, G11 : projet-retard ──────────────────────────────────────────────────────────
        load('projet-retard.json')
        check('G9 : avancement global 43 % et fin au mercredi 23 septembre 2026', 'Avancement global 43 %' in kpis() and 'Fin mer. 23 sept. 2026' in kpis(), kpis())
        check('G9 : chemin critique A → B → C → M', 'A → B → C → M' in kpis(), kpis())
        check('G9 : statuts Terminé / En retard', 'Terminé' in row('A') and 'En retard' in row('B') and 'En retard' in row('C') and 'En retard' in row('M'))
        check('G9 : C porte « échéance dépassée »', 'échéance dépassée' in row('C'), row('C'))
        pg.click('button[data-click="openDashboard"]')
        dash = sp(pg.inner_text('#dpanel').replace('\n', ' '))
        check('G11 : tuiles 43 %, 1 terminée, 0 en cours, 3 en retard', all(x in dash for x in ['43 %', 'Tâches terminées 1', 'En cours 0', 'En retard 3']), dash[:200])
        pg.keyboard.press('Escape')
        pg.click('button[data-click="openReport"]'); pg.wait_for_timeout(200)
        check('G11 : voyant ROUGE', 'Voyant : ROUGE' in pg.inner_text('#report-preview'))
        pg.keyboard.press('Escape')

        # ── G15 6 et 7 : noms piégés et 1 000 tâches ─────────────────────────
        alerts = []
        pg.on('dialog', lambda d: (alerts.append(d.message), d.dismiss()))
        load('projet-noms-pieges.json')
        check('G15 6 : le nom `<img onerror…>` s\'affiche tel quel, sans alerte', '<img src=x onerror=alert(1)>' in row('T1') and not alerts, (row('T1'), alerts))
        check('G15 6 : aucun élément img créé par le nom', pg.locator('#task-rows img').count() == 0)
        load('projet-1000-taches.json')
        check('G15 7 : 1 000 tâches importées', pg.locator('#task-rows tr[data-id]').count() == 1000, pg.locator('#task-rows tr[data-id]').count())

        check('aucune erreur JavaScript', not errors, errors)
        browser.close()

    ok = sum(1 for _, v in results if v)
    print(f'\n{ok}/{len(results)} vérifications réussies.')
    sys.exit(0 if ok == len(results) else 1)


if __name__ == '__main__':
    main()
