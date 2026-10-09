#!/usr/bin/env python3
"""Tests de bout en bout du lot D de GanttPro v3 : espace de travail.

    python3 tools/build.py && python3 tests/test_v3_espace.py

Couvre : onglets (R-62, limite de dix), bibliothèque et message de première utilisation (EF-99,
EX-22), modèles fournis (EF-100), sauvegarde automatique désactivée par défaut puis récupération
après fermeture brutale (R-63, RG-31), sauvegarde protégée par mot de passe, réglages et
effacement des données (EF-104), langue (R-64), aide (EF-57, EF-58), contrat de page d'accueil
(EF-56, 8.4) et accessibilité des nouvelles fenêtres.
"""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_v3 import HTML, axe_check, check, project, results  # noqa: E402


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-sandbox'])
        ctx = browser.new_context(viewport={'width': 1500, 'height': 950}, locale='fr-FR')
        errors = []

        def page():
            pg = ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(str(e)))
            pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' or 'Content Security Policy' in m.text else None)
            pg.clock.set_fixed_time('2026-01-14T10:00:00')
            pg.goto(HTML.as_uri())
            pg.wait_for_selector('#task-rows tr')
            return pg

        pg = page()

        def btn(label, scope='dialog[open]'):
            pg.locator(scope).last.locator(f'button:has-text("{label}")').first.click()
            pg.wait_for_timeout(80)

        def dialog_text():
            return pg.locator('dialog[open]').last.inner_text()

        def tabs():
            return pg.eval_on_selector_all('#tabs-list button.tab', 'els => els.map(e => e.innerText.trim())')

        def wait_js(expr, timeout=9000):
            # Sondage côté Python : la CSP de l'application interdit l'évaluation de chaîne en page.
            for _ in range(timeout // 100):
                if pg.evaluate(expr):
                    return True
                pg.wait_for_timeout(100)
            return False

        def stored():
            return pg.evaluate("Object.keys(localStorage).filter(k => k.startsWith('ganttpro.'))")

        # ── Onglets (R-62, EF-98) ────────────────────────────────────────────────────────────
        check('un onglet au démarrage', len(tabs()) == 1 and pg.get_attribute('#tabs-list button.tab', 'aria-current') == 'page')
        pg.click('button[data-arg="task"]'); pg.keyboard.press('Escape')
        n1 = pg.locator('#task-rows tr[data-id]').count()
        check('onglet modifié : pastille annoncée', '(modifié)' in pg.inner_text('#tabs-list'))
        pg.click('#tabs button.tab-plus'); btn('Nouveau projet')
        check('« + » ouvre un deuxième onglet actif', len(tabs()) == 2 and pg.get_attribute('#tabs-list li:nth-child(2) button.tab', 'aria-current') == 'page')
        check('le nouvel onglet a son propre historique', pg.is_disabled('#btn-undo'))
        pg.click('#tabs-list li:nth-child(1) button.tab')
        check("retour au premier onglet : tâches et historique conservés", pg.locator('#task-rows tr[data-id]').count() == n1 and not pg.is_disabled('#btn-undo'))
        axe_check(pg, "bande d'onglets")

        # ── Modèle fourni (EF-100) ───────────────────────────────────────────────────────────
        pg.click('#tabs button.tab-plus'); btn("Nouveau projet à partir d'un modèle")
        axe_check(pg, 'fenêtre Nouveau projet à partir d\'un modèle')
        pg.fill('#tpl-pname', 'Essai modèle'); pg.fill('#tpl-start', '2026-02-02')
        btn('Créer le projet')
        rows = pg.inner_text('#task-rows')
        check('modèle « Projet en 5 phases » : 6 éléments enchaînés', all(x in rows for x in ['Cadrage', 'Conception', 'Réalisation', 'Recette', 'Mise en service', 'Livraison']), rows)
        check('modèle : nom et début choisis', 'Essai modèle' in pg.inner_text('#project-label') and pg.input_value('#project-start') == '2026-02-02')
        check('modèle : fin au lun. 30 mars 2026 (41 jours ouvrés)', 'lun. 30 mars 2026' in pg.inner_text('#kpis'), pg.inner_text('#kpis'))
        check('trois onglets', len(tabs()) == 3)

        # ── Par défaut, rien n'est conservé sur l'appareil (EX-10, R-63) ─────────────────────
        check("par défaut : aucune donnée de projet sur l'appareil", not [k for k in stored() if not k.startswith('ganttpro.settings.')], stored())

        # ── Bibliothèque (EF-99) et message de première utilisation (EX-22) ─────────────────
        pg.keyboard.press('Control+s')
        pg.wait_for_selector('dialog[open]')
        check('première utilisation : message sur le stockage local', 'appareil partagé' in dialog_text(), dialog_text())
        axe_check(pg, 'message de première utilisation')
        btn("J'ai compris, enregistrer")
        btn('Enregistrer')
        check('enregistré dans la bibliothèque : pastille retirée', '(modifié)' not in pg.inner_text('#tabs-list li:nth-child(3)'))
        pg.click('button:has-text("Bibliothèque")')
        pg.wait_for_selector('#lib-win')
        check('bibliothèque : projet listé avec ses tâches', 'Essai modèle' in pg.inner_text('#lib-win') and 'appareil' in pg.inner_text('#lib-win'))
        axe_check(pg, 'fenêtre Bibliothèque')
        pg.click('#lib-win button[aria-label="Dupliquer Essai modèle"]')
        check('bibliothèque : duplication', 'Copie de Essai modèle' in pg.inner_text('#lib-win'))
        pg.click('#lib-win button[aria-label="Supprimer Copie de Essai modèle"]'); btn('Supprimer')
        check('bibliothèque : suppression confirmée', 'Copie de Essai modèle' not in pg.inner_text('#lib-win'))
        pg.click('#lib-win button[aria-label="Ouvrir Essai modèle"]')
        check('bibliothèque : ouverture dans un nouvel onglet', len(tabs()) == 4 and pg.query_selector('dialog[open]') is None)
        # Projet protégé par mot de passe dans la bibliothèque (EF-102)
        pg.click('button:has-text("Bibliothèque")'); pg.wait_for_selector('#lib-win')
        pg.click('#lib-save'); pg.check('#lib-protect')
        pg.fill('#lib-pwd', 'une phrase de passe solide'); pg.fill('#lib-pwd2', 'une phrase de passe solide')
        btn('Enregistrer')
        wait_js("document.querySelector('#lib-win') && document.querySelector('#lib-win').innerText.includes('protégé')", 30000)
        raw = pg.evaluate("Object.entries(localStorage).filter(([k]) => k.startsWith('ganttpro.lib.') && k !== 'ganttpro.lib.index').map(([, v]) => v).join('')")
        check('bibliothèque protégée : contenu chiffré, aucun nom de tâche en clair', '"encrypted":true' in raw and 'Cadrage' not in raw)
        btn('Fermer')

        # ── Limite de dix onglets (R-62) ─────────────────────────────────────────────────────
        while len(tabs()) < 10:
            pg.click('button[data-click="newProject"]')
        pg.click('button[data-click="newProject"]')
        check('onzième onglet refusé avec un message', 'Dix projets au plus' in dialog_text())
        btn('Valider')
        # Fermer un onglet modifié demande confirmation
        pg.click('#tabs-list li:nth-child(1) button.tab-close')
        check("fermer un onglet modifié demande confirmation", "Elles seront perdues" in dialog_text())
        btn('Fermer sans enregistrer')
        check('onglet fermé', len(tabs()) == 9)
        while len(tabs()) > 1:
            pg.click('#tabs-list li:last-child button.tab-close')
            if pg.query_selector('dialog[open]'):
                btn('Fermer sans enregistrer')
        check('fermeture des onglets jusqu\'au dernier', len(tabs()) == 1)

        # ── Réglages : sauvegarde automatique (EF-101, RG-31) ────────────────────────────────
        pg.click('#btn-settings')
        pg.wait_for_selector('#set-win')
        axe_check(pg, 'fenêtre Réglages')
        pg.check('#set-auto')
        check("activation : ce qui est conservé, où, et le risque", 'appareil partagé' in dialog_text() and '5 secondes' in dialog_text())
        btn('Activer')
        check('sauvegarde automatique activée', pg.is_checked('#set-auto'))
        btn('Fermer')
        check('indicateur visible', pg.is_visible('#autosave-status'))
        pg.click('button[data-arg="task"]'); pg.keyboard.press('Escape')
        wait_js("document.getElementById('autosave-status').innerText.includes('Sauvegardé sur cet appareil à')", 9000)
        check("« Sauvegardé sur cet appareil à … » après 5 secondes", True)
        check('une copie de récupération existe', any(k.startswith('ganttpro.rec.') for k in stored()))

        # Fermeture brutale : nouvelle page, même appareil (R-63)
        pg.close()
        pg = page()
        pg.wait_for_selector('dialog[open]')
        check('au lancement : travail non exporté proposé', 'Travail non exporté retrouvé' in dialog_text(), dialog_text())
        axe_check(pg, 'fenêtre de récupération')
        btn('Valider')
        check('projet restauré, marqué modifié', pg.locator('#task-rows tr[data-id]').count() == 2 and '(modifié)' in pg.inner_text('#tabs-list'))
        # Supprimer la copie : refus au lancement suivant
        pg.close()
        pg = page()
        pg.wait_for_selector('dialog[open]')
        pg.check('#rec-0-delete'); btn('Valider')
        pg.close()
        pg = page()
        pg.wait_for_timeout(400)
        check('copie supprimée : plus rien proposé', pg.query_selector('dialog[open]') is None and not any(k.startswith('ganttpro.rec.') for k in stored()))

        # Désactiver supprime les copies
        pg.click('button[data-arg="task"]'); pg.keyboard.press('Escape')
        wait_js("Object.keys(localStorage).some(k => k.startsWith('ganttpro.rec.'))", 9000)
        pg.click('#btn-settings'); pg.uncheck('#set-auto')
        check('désactivation : copies supprimées', not any(k.startswith('ganttpro.rec.') for k in stored()) and pg.is_hidden('#autosave-status'))

        # ── Langue depuis les réglages (R-64, EF-103) ────────────────────────────────────────
        pg.select_option('#set-lang', 'en')
        pg.wait_for_selector('#set-win')
        check('langue anglaise immédiate, sans recharger', pg.get_attribute('html', 'lang') == 'en' and 'Settings' in dialog_text() and pg.locator('#task-rows tr[data-id]').count() == 2)
        pg.select_option('#set-lang', 'fr')
        pg.wait_for_selector('#set-win')
        check('choix de langue conservé sur l\'appareil', pg.evaluate("localStorage.getItem('ganttpro.settings.lang')") == 'fr')

        # ── Effacer toutes les données (EF-104) ──────────────────────────────────────────────
        pg.click('#set-clear')
        check("effacement : confirmation qui dit ce qui est supprimé", 'définitivement' in dialog_text())
        btn('Tout effacer')
        check("effacement : plus aucune donnée GanttPro sur l'appareil", stored() == [], stored())
        btn('Fermer')

        # ── Aide (EF-57, EF-58) ──────────────────────────────────────────────────────────────
        pg.click('#task-rows tr[data-id] button.select')
        pg.keyboard.press('Escape')
        pg.focus('#task-rows tr[data-id] button.select')
        pg.keyboard.press('?')
        pg.wait_for_selector('#help-win')
        help_txt = pg.inner_text('#help-win')
        check('« ? » ouvre l\'aide : version, licence, raccourcis, vie privée, accessibilité',
              all(x in help_txt for x in ['version 3.0.0', 'MIT', 'Ctrl + Z', 'Vie privée', "Déclaration d'accessibilité", 'partiellement conforme']), help_txt[:300])
        axe_check(pg, "fenêtre d'aide")
        pg.keyboard.press('Escape')

        # ── Page d'accueil (EF-56, 8.4, A-22) ───────────────────────────────────────────────
        check("sans page d'accueil : boutons masqués", pg.is_hidden('#btn-home') and pg.is_hidden('#btn-homesave'))
        pg.close()
        home = HTML.parent.joinpath('accueil.html').as_uri()
        proj = json.dumps(project(name='Transmis'))
        for url, expect in (('https://exemple.invalid/accueil', False), (home, True)):
            pg = ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(str(e)))
            pg.add_init_script(f"if (!window.__seeded) {{ window.__seeded = 1; sessionStorage.setItem('gantt_project', {json.dumps(proj)}); sessionStorage.setItem('gantt_home_url', {json.dumps(url)}); }}")
            pg.goto(HTML.as_uri()); pg.wait_for_selector('#task-rows tr[data-id]')
            check(f"projet transmis chargé ({'même origine' if expect else 'autre origine'})", 'Transmis' in pg.inner_text('#project-label'))
            check(f"projet transmis lu une seule fois ({'même origine' if expect else 'autre origine'})", pg.evaluate("sessionStorage.getItem('gantt_project')") is None)
            check(f"boutons d'accueil {'affichés' if expect else 'masqués pour une autre origine'}", pg.is_visible('#btn-home') == expect)
            if expect:
                pg.click('#btn-homesave')
                saved = json.loads(pg.evaluate("sessionStorage.getItem('gantt_saved_project')"))
                check('« Sauvegarder » remet une copie à la page d\'accueil', saved['name'] == 'Transmis' and saved['format'] == 3)
            pg.close()
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.add_init_script("if (!window.__seeded) { window.__seeded = 1; sessionStorage.setItem('gantt_project', '{\"tasks\": \"pas une liste\"}'); }")
        pg.goto(HTML.as_uri()); pg.wait_for_selector('dialog[open]')
        check('projet transmis invalide : refusé comme un import', '"tasks"' in pg.locator('dialog[open]').inner_text(), pg.locator('dialog[open]').inner_text())
        pg.close()

        check('aucune erreur JavaScript pendant le parcours', not errors, errors)
        browser.close()

    failed = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} vérifications réussies.")
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
