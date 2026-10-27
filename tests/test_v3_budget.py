#!/usr/bin/env python3
"""Tests de bout en bout du budget, étape A (EF-112 à EF-127, RG-35 à RG-43, recette R-71 à R-84).

    python3 tools/build.py && python3 tests/test_v3_budget.py

Toutes les données sont fictives (EX-12).
"""
import json
import sys
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_v3 import HTML, axe_check, check, results  # noqa: E402


def sp(s):
    """Espaces insécables et fines normalisés, pour comparer les textes affichés."""
    return (s or '').replace(' ', ' ').replace(' ', ' ')


def budget_project(**over):
    """Données de R-74 : T1 terminée, T2 à 40 %, provision 40,00, aujourd'hui = 14/01/2026."""
    p = {
        'format': 3, 'name': 'Projet budget', 'projectStart': '2026-01-05', 'provision': 4000,
        'tasks': [
            {'id': 'T1', 'name': 'Etude', 'dur': 5, 'pct': 100, 'realEnd': '2026-01-09', 'cat': 'Etudes', 'budget': 10000, 'actual': 9000},
            {'id': 'T2', 'name': 'Realisation', 'dur': 5, 'deps': ['T1'], 'pct': 40, 'cat': 'Etudes', 'budget': 30000, 'actual': 10000},
            {'id': 'J', 'name': 'Jalon', 'type': 'milestone', 'dur': 0, 'deps': ['T2']},
        ],
        'resources': [{'name': 'Alice'}], 'categories': [{'name': 'Etudes', 'color': '#4d9fff'}],
    }
    p.update(over)
    return p


def main():
    tmp = Path(tempfile.mkdtemp())
    files = {}

    def write(name, obj):
        f = tmp / name
        f.write_text(obj if isinstance(obj, str) else json.dumps(obj), encoding='utf-8')
        files[name] = str(f)

    write('budget.json', budget_project())
    write('neg.json', budget_project(tasks=[{'id': 'A', 'name': 'x', 'dur': 2, 'budget': -5}]))
    write('milestone.json', budget_project(tasks=[{'id': 'M', 'name': 'j', 'type': 'milestone', 'dur': 0, 'budget': 100}]))
    write('sheet.csv', 'Nom;Durée;Budget;Coût réel\nUn;3;1 234,56;10\nDeux;2;abc;\nTrois;4;250,5;99,999\n')

    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-sandbox'])
        ctx = browser.new_context(viewport={'width': 1500, 'height': 950}, locale='fr-FR', accept_downloads=True)
        pg = ctx.new_page()
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' or 'Content Security Policy' in m.text else None)
        pg.clock.set_fixed_time('2026-01-14T10:00:00')
        pg.goto(HTML.as_uri())
        pg.wait_for_selector('#task-rows tr')

        def btn(label, scope='dialog[open]'):
            pg.locator(scope).last.locator(f'button:has-text("{label}")').first.click()
            pg.wait_for_timeout(80)

        def load(name):
            pg.set_input_files('#file-input', files[name])
            pg.wait_for_selector('dialog[open]')
            # EF-52 : remplacer un projet modifié demande une confirmation de plus.
            for _ in range(2):
                b = pg.locator('dialog[open]').last.locator('button:has-text("Remplacer le projet ouvert")')
                if b.count():
                    b.first.click()
                    pg.wait_for_timeout(120)
            pg.wait_for_timeout(150)

        def cell(id_):
            # Texte visible seulement : le texte réservé aux lecteurs d'écran (.sr-only) est exclu.
            return sp(pg.evaluate("""id => {
              const td = document.querySelector('#task-rows tr[data-id="' + id + '"] td.money').cloneNode(true);
              td.querySelectorAll('.sr-only').forEach(n => n.remove());
              return td.textContent.trim();
            }""", id_))

        def open_task(id_):
            pg.click(f'#task-rows tr[data-id="{id_}"] button.select')
            pg.wait_for_selector('#editor:not([hidden])')

        def esc():
            pg.keyboard.press('Escape')
            pg.wait_for_timeout(80)

        # ── Projet vide : pas d'onglet Budget (EF-117) ────────────────────────────────────────
        check('colonne « Budget / Réel » dans l\'en-tête de la liste', 'Budget / Réel' in pg.inner_text('#tasks-table thead'))
        pg.click('button[data-click="openDashboard"]')
        check('sans montant, pas d\'onglet Budget', pg.locator('#dash-win [role="tab"]').count() == 2)
        esc()

        # ── R-74 : colonne, fiche, onglet ────────────────────────────────────────────────────
        load('budget.json')
        check('colonne : budget puis coût réel de T1', '100,00 € / 90,00 €' in cell('T1'), cell('T1'))
        check('colonne : un jalon n\'a aucun montant', cell('J') == '')

        open_task('T1')
        check('fiche : budget et coût réel en unités', pg.input_value('#f-budget') == '100' and pg.input_value('#f-actual') == '90')
        check('fiche : le coût réel explique ce qu\'il compte', 'factures engagées' in pg.inner_text('#editor'))
        axe_check(pg, 'fiche de tâche avec le groupe Budget')

        # R-71 : saisies refusées avec la limite, acceptées en centimes
        for raw, msg in [('12,345', 'deux décimales'), ('-5', 'négatif'), ('50 000 000 000,01', '50 000 000 000,00'), ('abc', 'écrire un montant')]:
            pg.fill('#f-budget', raw)
            pg.click('#edit-form button[type=submit]')
            err = sp(pg.inner_text('#f-budget-err'))
            check(f'R-71 : « {raw} » refusé avec un message ({msg})', msg in err and pg.is_visible('#editor') and pg.get_attribute('#f-budget', 'aria-invalid') == 'true', err)
        pg.fill('#f-budget', '1 234,56')
        pg.fill('#f-actual', '1234.5')
        pg.click('#edit-form button[type=submit]')
        check('R-71 : « 1 234,56 » et « 1234.5 » enregistrés', '1 234,56 € / 1 234,50 €' in cell('T1'), cell('T1'))
        pg.click('#btn-undo')
        check('annuler rétablit les montants', '100,00 € / 90,00 €' in cell('T1'), cell('T1'))

        open_task('J')
        check('fiche d\'un jalon : aucun champ de montant', pg.locator('#f-budget').count() == 0)
        esc()

        # ── Onglet Budget (EF-117, EF-118, R-72, R-74) ────────────────────────────────────────
        pg.click('button[data-click="openDashboard"]')
        check('avec des montants, l\'onglet Budget apparaît', pg.locator('#dtab-budget').count() == 1)
        pg.click('#dtab-budget')
        tiles = sp(pg.inner_text('#bud-tiles'))
        for needle in ['400,00 €', '40,00 €', '440,00 €', '190,00 €', '250,00 €']:
            check(f'onglet Budget : indicateur {needle}', needle in tiles, tiles)
        cats = sp(pg.inner_text('#bud-cats'))
        check('tableau par catégorie : Etudes 400,00 € / 190,00 € / 210,00 €', 'Etudes' in cats and '400,00 €' in cats and '210,00 €' in cats, cats)
        check('courbe des coûts présente, avec un titre', pg.locator('#dpanel svg.scurve').count() == 1)
        pg.click('button[data-click="dashCostValues"]')
        vals = sp(pg.inner_text('#bud-values'))
        check('R-74 : tableau des valeurs, semaine 1 prévu 100,00 réel 90,00', '100,00 €' in vals and '90,00 €' in vals and '400,00 €' in vals, vals)
        axe_check(pg, 'onglet Budget du tableau de bord')
        pg.click('#sc-month')
        check('R-74 : par mois, une seule période', pg.locator('#bud-values tbody tr').count() == 1)
        esc()

        # ── Fenêtre du projet : devise et provision (EF-114) ──────────────────────────────────
        pg.click('#project-label')
        check('fenêtre du projet : devise et provision', pg.input_value('#p-currency') == '€' and pg.input_value('#p-provision') == '40')
        axe_check(pg, 'fenêtre du projet avec devise et provision')
        pg.fill('#p-currency', '')
        btn('Enregistrer')
        check('devise vide refusée', pg.is_visible('#p-currency-err'))
        pg.fill('#p-currency', 'CHF'); pg.fill('#p-provision', '12,5')
        btn('Enregistrer')
        check('devise CHF : affichée après le montant', 'CHF' in cell('T1'), cell('T1'))
        pg.click('button[data-click="openDashboard"]'); pg.click('#dtab-budget')
        check('provision 12,50 dans l\'onglet Budget', '12,50 CHF' in sp(pg.inner_text('#bud-tiles')), sp(pg.inner_text('#bud-tiles')))
        esc()
        pg.click('#project-label'); pg.fill('#p-currency', '€'); pg.fill('#p-provision', '40'); btn('Enregistrer')

        # ── R-83 : affichage compact ─────────────────────────────────────────────────────────
        open_task('T2'); pg.fill('#f-budget', '1234567,89'); pg.click('#edit-form button[type=submit]')
        check('R-83 : 1 234 567,89 s\'affiche « 1,23 M € » dans la colonne', '1,23 M €' in cell('T2'), cell('T2'))
        check('R-84 : le lecteur d\'écran lit le montant complet', '1 234 567,89 €' in sp(pg.evaluate("document.querySelector('#task-rows tr[data-id=\"T2\"] td.money .sr-only').textContent")))
        open_task('T2')
        check('R-84 : la fiche affiche le montant complet', pg.input_value('#f-budget') == '1234567,89')
        esc()
        pg.click('#btn-undo')

        # ── R-78 : masquage ──────────────────────────────────────────────────────────────────
        pg.click('#btn-mask')
        check('masquage : bouton à bascule enfoncé', pg.get_attribute('#btn-mask', 'aria-pressed') == 'true')
        check('masquage : « •••• » dans la colonne, sans montant', '••••' in cell('T1') and '100' not in cell('T1'), cell('T1'))
        check('masquage : nom accessible « montant masqué »', 'montant masqué' in pg.evaluate("document.querySelector('#task-rows tr[data-id=\"T1\"] td.money').textContent"))
        open_task('T1')
        check('masquage : champs de la fiche désactivés', pg.is_disabled('#f-budget') and pg.is_disabled('#f-actual'))
        axe_check(pg, 'fiche de tâche, montants masqués')
        esc()
        pg.click('button[data-click="openDashboard"]'); pg.click('#dtab-budget')
        check('masquage : onglet Budget masqué', '€' not in sp(pg.inner_text('#bud-tiles')) and '••••' in pg.inner_text('#bud-tiles'))
        check('masquage : tableau des catégories masqué', '400' not in sp(pg.inner_text('#bud-cats')))
        axe_check(pg, 'onglet Budget, montants masqués')
        esc()
        pg.reload(); pg.wait_for_selector('#task-rows tr')
        check('masquage mémorisé après rechargement', pg.get_attribute('#btn-mask', 'aria-pressed') == 'true')
        pg.click('#btn-mask')
        load('budget.json')
        check('démasqué : les montants reviennent', '100,00 € / 90,00 €' in cell('T1'), cell('T1'))

        # ── Baselines (EF-121, R-75) ─────────────────────────────────────────────────────────
        pg.click('button[data-click="openBaselines"]'); btn('Capturer')
        esc()
        open_task('T2'); pg.fill('#f-budget', '350'); pg.click('#edit-form button[type=submit]')
        pg.click('button[data-click="openBaselines"]')
        bl = sp(pg.inner_text('#bl-win'))
        check('R-75 : BAC de la baseline 400,00 € et BAC du projet 450,00 €', '400,00 €' in bl and '450,00 €' in bl, bl)
        axe_check(pg, 'fenêtre des baselines avec la colonne BAC')
        esc()

        # ── Rapport (EF-120, EF-124) ─────────────────────────────────────────────────────────
        pg.click('button[data-click="openReport"]')
        check('rapport : la case « Inclure les montants » est décochée', not pg.is_checked('#rep-amounts'))
        check('rapport : sans la case, aucun bloc Budget', pg.locator('#report-preview .rep-budget').count() == 0)
        pg.check('#rep-amounts')
        rep = sp(pg.inner_text('#report-preview .rep-budget'))
        check('rapport : BAC, provision, budget total, coût réel, reste', all(x in rep for x in ['450,00 €', '40,00 €', '490,00 €', '190,00 €', '300,00 €']), rep)
        pg.select_option('#rep-bl', 'B1')
        check('rapport : variation du BAC avec la baseline (+50,00 €)', '+50,00 €' in sp(pg.inner_text('#report-preview .rep-budget')), sp(pg.inner_text('#report-preview .rep-budget')))
        axe_check(pg, 'rapport avec le bloc Budget')
        esc()
        pg.click('button[data-click="openReport"]')
        check('rapport rouvert : case décochée de nouveau', not pg.is_checked('#rep-amounts'))
        esc()

        # ── Export sans montants (EF-124, R-76) ──────────────────────────────────────────────
        def export(fmt, amounts):
            pg.click('button[data-click="exportFile"]')
            pg.check(f'#exp-f-{fmt}')
            check(f'R-76 : case « Inclure les montants » décochée à l\'ouverture ({fmt}, {"cochée" if amounts else "défaut"})', not pg.is_checked('#exp-amounts'))
            if amounts:
                pg.check('#exp-amounts')
            with pg.expect_download() as dl:
                btn('Exporter')
            path = dl.value.path()
            return Path(path).read_bytes() if fmt == 'xlsx' else Path(path).read_text(encoding='utf-8')

        pg.click('button[data-click="exportFile"]')
        axe_check(pg, "fenêtre d'export avec « Inclure les montants »")
        esc()
        j0 = export('json', False)
        check('R-76 : JSON sans montants : aucun champ budget, actual, provision', not any(k in j0 for k in ['"budget"', '"actual"', '"provision"']) and '"currency"' in j0)
        j1 = json.loads(export('json', True))
        check('R-76 : JSON avec montants : en centimes', j1['provision'] == 4000 and j1['tasks'][0]['budget'] == 10000 and j1['tasks'][1]['budget'] == 35000, j1['tasks'][0])
        c0 = export('csv', False)
        check('R-76 : CSV sans montants : aucune colonne', 'Budget' not in c0 and 'Coût réel' not in c0)
        c1 = export('csv', True)
        check('R-76 : CSV avec montants : deux décimales', 'Budget;Coût réel' in c1 and '100.00;90.00' in c1, c1[:300])

        # ── Import d'un tableur (RG-42) ──────────────────────────────────────────────────────
        pg.set_input_files('#file-input', files['sheet.csv']); pg.wait_for_selector('#wiz-header')
        btn('Suivant')
        check('assistant : colonnes Budget et Coût réel reconnues', pg.input_value('#wiz-map-budget') == '2' and pg.input_value('#wiz-map-actual') == '3')
        btn('Suivant')
        warn = sp(pg.inner_text('#wiz-warnings'))
        check('assistant : montants invalides signalés (abc, 99,999)', 'abc' in warn and '99,999' in warn, warn)
        axe_check(pg, "assistant d'import avec montants ignorés")
        btn('Importer')
        pg.wait_for_timeout(200)
        un = [r for r in pg.query_selector_all('#task-rows tr[data-id]') if 'Un' in r.inner_text()]
        check('import : « 1 234,56 » lu en centimes', un and '1 234,56 €' in sp(un[0].query_selector('td.money').inner_text()) and '10,00 €' in sp(un[0].query_selector('td.money').inner_text()), [sp(r.inner_text()) for r in un])

        # ── Modification en masse (EF-116) ───────────────────────────────────────────────────
        load('budget.json')
        pg.click('#task-rows tr[data-id="T1"] button.select', modifiers=['Control'])
        pg.click('#task-rows tr[data-id="T2"] button.select', modifiers=['Control'])
        pg.click('#selbar button:has-text("Modifier en masse")')
        pg.fill('#bk-budget', '10'); btn('Appliquer')
        check('masse : budget fixé pour les tâches sélectionnées', '10,00 € /' in cell('T1') and '10,00 € /' in cell('T2'), (cell('T1'), cell('T2')))

        # ── Fichiers refusés (R-77) ──────────────────────────────────────────────────────────
        before = cell('T1')
        for name in ['neg.json', 'milestone.json']:
            pg.set_input_files('#file-input', files[name]); pg.wait_for_timeout(300)
            msg = sp(pg.locator('dialog[open]').last.inner_text()) if pg.locator('dialog[open]').count() else ''
            check(f'R-77 : {name} refusé, projet ouvert intact', ('Tâche n° 1' in msg) and cell('T1') == before, msg)
            while pg.locator('dialog[open]').count():
                esc()

        # ── Anglais ──────────────────────────────────────────────────────────────────────────
        pg.click('#btn-lang'); pg.wait_for_timeout(150)
        check('anglais : symbole avant le montant et séparateurs anglais', '€10.00 / €' in cell('T1'), cell('T1'))
        check('anglais : bouton « Hide amounts »', 'Hide amounts' in pg.inner_text('#btn-mask'))
        pg.click('#btn-lang')

        # ── Dupliquer conserve les montants (la copie en texte n'en contient pas) ─────────────────
        load('budget.json')
        pg.click('#task-rows tr[data-id="T1"] button.select'); pg.keyboard.press('Escape')
        pg.focus('#task-rows tr[data-id="T1"] button.select')
        pg.keyboard.press('Control+d')
        pg.wait_for_timeout(200)
        n = pg.evaluate("[...document.querySelectorAll('#task-rows tr[data-id] td.money')].filter(td => td.textContent.replace(/\\u00a0/g, ' ').startsWith('100,00 €') && td.textContent.includes('90,00')).length")
        check('dupliquer une tâche conserve son budget et son coût réel', n == 2, n)

        # ── Fichiers d'essai de la recette manuelle (docs/recette-manuelle.md) ────────────────────
        fx = Path(__file__).resolve().parent / 'fixtures'
        def load_fx(name):
            pg.set_input_files('#file-input', str(fx / name))
            pg.wait_for_selector('dialog[open]')
            for _ in range(2):
                b = pg.locator('dialog[open]').last.locator('button:has-text("Remplacer le projet ouvert")')
                if b.count():
                    b.first.click()
                    pg.wait_for_timeout(120)
            pg.wait_for_timeout(150)
        load_fx('budget-base.json')
        check('recette : budget-base.json', cell('T1') == '100,00 € / 90,00 €' and cell('T2') == '300,00 € / 100,00 €' and cell('J') == '', (cell('T1'), cell('T2')))
        load_fx('budget-montants-geants.json')
        check('recette : montants géants en forme compacte', [cell(i) for i in ['T1', 'T2', 'T3', 'T4', 'T5']] ==
              ['999 999,99 € / 0,00 €', '1 M € / 1,23 M €', '1,23 M € / 0,00 €', '2,5 Md € / 0,00 €', '50 Md € / 50 Md €'], [cell(i) for i in ['T1', 'T2', 'T3', 'T4', 'T5']])
        load_fx('budget-avec-baseline.json')
        pg.click('button[data-click="openBaselines"]')
        bl = sp(pg.inner_text('#bl-win'))
        check('recette : budget-avec-baseline.json (BAC 400,00 et 450,00)', '400,00 €' in bl and '450,00 €' in bl, bl)
        esc()
        load_fx('budget-sans-montant.json')
        pg.click('button[data-click="openDashboard"]')
        check('recette : budget-sans-montant.json sans onglet Budget', pg.locator('#dtab-budget').count() == 0)
        esc()
        load_fx('projet-atlas-budget.json')
        check('recette : Atlas, lignes et récapitulatives', cell('A2') == '8 000,00 € / 9 200,00 €' and cell('F1') == '1,5 M € / 0,00 €' and cell('P1') == '19 300,00 € / 18 800,00 €' and cell('P3') == '189 000,00 € / 0,00 €', [cell(i) for i in ['A2', 'F1', 'P1', 'P3']])
        pg.click('button[data-click="openDashboard"]'); pg.click('#dtab-budget')
        tiles = sp(pg.inner_text('#bud-tiles'))
        check('recette : Atlas, onglet Budget', all(x in tiles for x in ['1 836 700,00 €', '15 000,00 €', '1 851 700,00 €', '26 100,00 €', '1 825 600,00 €']), tiles)
        esc()
        pg.click('button[data-click="openBaselines"]')
        bl = sp(pg.inner_text('#bl-win'))
        check('recette : Atlas, BAC de la baseline 1 831 700,00 et du projet 1 836 700,00', '1 831 700,00 €' in bl and '1 836 700,00 €' in bl, bl)
        esc()
        for name, needle in [('refus-montant-negatif.json', 'budget'), ('refus-montant-trop-grand.json', 'budget'), ('refus-jalon-avec-montant.json', 'jalon')]:
            pg.set_input_files('#file-input', str(fx / name)); pg.wait_for_selector('dialog[open]')
            msg = sp(pg.locator('dialog[open]').last.inner_text())
            check(f'recette : {name} refusé', needle in msg and 'Tâche n° 1' in msg, msg)
            while pg.locator('dialog[open]').count():
                esc()

        # ── Aucun montant ne déborde dans l'onglet Budget, à toutes les largeurs (EX-04) ──────────
        OVERFLOW = """() => {
          const bad = [];
          document.querySelectorAll('#bud-tiles .tile').forEach(t => {
            const dd = t.querySelector('dd');
            if (dd.scrollWidth > dd.clientWidth + 1 || dd.getBoundingClientRect().right > t.getBoundingClientRect().right + 1) bad.push(t.querySelector('dt').textContent);
          });
          const svg = document.querySelector('svg.scurve'), vb = svg.viewBox.baseVal;
          svg.querySelectorAll('text').forEach(n => { const b = n.getBBox(); if (b.x < -0.5 || b.x + b.width > vb.width + 0.5) bad.push(n.textContent); });
          const dlg = document.querySelector('dialog[open]');
          if (dlg.scrollWidth > dlg.clientWidth + 1) bad.push('fenêtre');
          return bad;
        }"""
        for fx_name in ['projet-atlas-budget.json', 'budget-montants-geants.json']:
            load_fx(fx_name)
            for width in [1500, 900, 600, 380]:
                pg.set_viewport_size({'width': width, 'height': 900})
                pg.click('button[data-click="openDashboard"]'); pg.click('#dtab-budget')
                bad = pg.evaluate(OVERFLOW)
                check(f'EX-04 : onglet Budget sans débordement ({fx_name}, {width} px)', not bad, bad)
                esc()
        pg.set_viewport_size({'width': 1500, 'height': 950})

        # EX-29 : barres de défilement horizontales toujours visibles, défilement vertical commun.
        load_fx('projet-atlas-budget.json')
        pg.evaluate('window.scrollTo(0, 0)')
        geo = pg.evaluate("""() => { const f = id => { const e = document.getElementById(id), r = e.getBoundingClientRect();
          return { bottom: Math.round(r.bottom), ox: getComputedStyle(e).overflowX, tall: e.scrollHeight > e.clientHeight }; };
          return { list: f('list'), gantt: f('gantt'), vh: innerHeight }; }""")
        check('EX-29 : le bas de la liste et du Gantt (barres horizontales) est visible en haut de page',
              geo['list']['bottom'] <= geo['vh'] and geo['gantt']['bottom'] <= geo['vh'], geo)
        check('EX-29 : défilement horizontal toujours proposé sur la liste et sur le Gantt', geo['list']['ox'] == 'scroll' and geo['gantt']['ox'] == 'scroll', geo)
        pg.evaluate("document.getElementById('list').scrollTop = 150")
        pg.wait_for_timeout(150)
        check('EX-29 : le Gantt suit le défilement vertical de la liste', pg.evaluate("document.getElementById('gantt').scrollTop") == 150)
        pg.evaluate("document.getElementById('gantt').scrollTop = 60")
        pg.wait_for_timeout(150)
        check('EX-29 : la liste suit le défilement vertical du Gantt', pg.evaluate("document.getElementById('list').scrollTop") == 60)
        head_top = pg.evaluate("document.querySelector('#gantt .g-head').getBoundingClientRect().top - document.getElementById('gantt').getBoundingClientRect().top")
        check("EX-29 : l'en-tête du Gantt reste en haut pendant le défilement", abs(head_top) <= 1, head_top)
        pg.evaluate("document.getElementById('list').scrollTop = 0")

        # Remarques de recette G1 à G6 : colonnes de dates, sélection à la saisie, niveaux, zoom.
        heads = pg.evaluate("[...document.querySelectorAll('#tasks-table thead th')].map(x => x.textContent.trim())")
        check('colonnes Début, Fin, Début réel et Fin réel dans la liste', all(x in heads for x in ['Début', 'Fin', 'Début réel', 'Fin réel']), heads)
        cells = pg.evaluate("[...document.querySelectorAll('#task-rows tr[data-id=\"A1\"] td')].map(x => x.textContent.replace(/\\s+/g, ' ').trim())")
        i0 = heads.index('Début')
        check('A1 : dates prévues et réelles affichées', cells[i0:i0 + 4] == ['07/09/2026', '08/09/2026', '07/09/2026', '08/09/2026'], cells)
        a2 = pg.evaluate("[...document.querySelectorAll('#task-rows tr[data-id=\"A2\"] td')].map(x => x.textContent.trim())")
        check('A2 : date réelle de début vide, de fin renseignée', a2[i0 + 2] == '' and a2[i0 + 3] == '21/09/2026', a2)
        pg.click('#task-rows tr[data-id="A1"] button.select')
        pg.wait_for_selector('#f-name')
        pg.click('#f-name')
        sel = pg.evaluate("(() => { const e = document.getElementById('f-name'); return [e.selectionStart, e.selectionEnd, e.value.length]; })()")
        check('saisie : le texte existant est sélectionné au focus (clic compris)', sel[0] == 0 and sel[1] == sel[2] > 0, sel)
        pg.keyboard.type('Z')
        check('saisie : le premier caractère remplace le texte existant', pg.input_value('#f-name') == 'Z')
        esc()
        pg.keyboard.press('Escape')
        deep = {'format': 3, 'name': 'Profond', 'projectStart': '2026-01-05', 'tasks': [
            {'id': 'S1', 'name': 'N1', 'type': 'summary'}, {'id': 'S2', 'name': 'N2', 'type': 'summary', 'parent': 'S1'},
            {'id': 'S3', 'name': 'N3', 'type': 'summary', 'parent': 'S2'}, {'id': 'S4', 'name': 'N4', 'type': 'summary', 'parent': 'S3'},
            {'id': 'S5', 'name': 'N5', 'type': 'summary', 'parent': 'S4'}, {'id': 'S6', 'name': 'N6', 'type': 'summary', 'parent': 'S5'}, {'id': 'T', 'name': 'Feuille', 'dur': 2, 'parent': 'S5'}]}
        (tmp / 'deep.json').write_text(json.dumps(deep), encoding='utf-8')
        pg.set_input_files('#file-input', str(tmp / 'deep.json'))
        pg.wait_for_selector('dialog[open]')
        for _ in range(2):
            b = pg.locator('dialog[open]').last.locator('button:has-text("Remplacer le projet ouvert")')
            if b.count():
                b.first.click(); pg.wait_for_timeout(120)
        pg.wait_for_timeout(150)
        n0 = pg.locator('#task-rows tr[data-id]').count()
        pg.click('#task-rows tr[data-id="S6"] button.select')
        pg.click('button[data-click="addTask"][data-arg="summary"]')
        pg.wait_for_selector('dialog[open]')
        check('sixième niveau : refus avec message, aucune ligne créée', 'niveaux' in pg.inner_text('dialog[open]') and pg.locator('#task-rows tr[data-id]').count() == n0, pg.inner_text('dialog[open]'))
        esc()
        pg.click('#task-rows tr[data-id="S5"] button.select')
        pg.click('button[data-click="addTask"][data-arg="summary"]')
        pg.wait_for_timeout(150)
        check('dernier niveau permis encore accepté', pg.locator('#task-rows tr[data-id]').count() == n0 + 1)
        esc()
        pg.keyboard.press('Escape')
        for _ in range(16):
            pg.click('#btn-zoom-in') if pg.locator('#btn-zoom-in').count() else pg.click('.topbar button[data-click="zoom"][data-arg="1"]')
        check('zoom jusqu\'à 400 %', '400' in pg.inner_text('#zoom-level'), pg.inner_text('#zoom-level'))
        for _ in range(4):
            pg.click('.topbar button[data-click="zoom"][data-arg="1"]')
        check('zoom plafonné à 400 %', '400' in pg.inner_text('#zoom-level'))
        load_fx('projet-atlas-budget.json')
        zbtn = '.topbar button[data-click="zoom"]'
        pg.click(f'{zbtn}[data-arg="0"]')
        for pct, clicks in [(100, 0), (60, 2), (40, 1), (20, 2)]:
            for _ in range(clicks):
                pg.click(f'{zbtn}[data-arg="-1"]')
            clipped = pg.evaluate("[...document.querySelectorAll('#gantt .g-col.month')].filter(c => c.textContent && c.scrollWidth > c.clientWidth + 1).map(c => c.textContent)")
            labels = pg.evaluate("[...document.querySelectorAll('#gantt .g-col.month')].filter(c => c.textContent).length")
            check(f'libellés de mois lisibles à {pct} % (aucun coupé, au moins un affiché)', not clipped and labels > 0, clipped)
        pg.click(f'{zbtn}[data-arg="0"]')

        # Remarque de recette G8 étape 4 : étiquettes affichées sous forme de pastilles, jamais « [object HTMLSpanElement] ».
        load_fx('projet-exemple.json')
        pg.check('#show-tags')
        pg.wait_for_timeout(150)
        tag_info = pg.evaluate("({ pills: [...document.querySelectorAll('#task-rows .tag-pill')].map(x => x.textContent), t3: document.querySelector('#task-rows tr[data-id=\"T3\"] td.name').textContent })")
        check('étiquettes : pastilles « cadrage » et « lot 1 » dans la liste', tag_info['pills'] == ['cadrage', 'lot 1'], tag_info)
        check('étiquettes : aucun « [object » affiché', '[object' not in tag_info['t3'], tag_info['t3'])
        pg.uncheck('#show-tags')
        load_fx('projet-atlas-budget.json')

        # Remarques de recette G9 étape 5 et fiche d'édition : message visible, titre et boutons toujours à l'écran.
        load_fx('projet-retard.json')
        pg.set_viewport_size({'width': 1500, 'height': 480})
        pg.click('#task-rows tr[data-id="C"] button.select')
        pg.wait_for_selector('#f-name')
        lay = pg.evaluate("""() => { const e = document.getElementById('editor').getBoundingClientRect(), h2 = document.getElementById('editor-title').getBoundingClientRect(),
          sv = document.querySelector('#edit-form button[type=submit]').getBoundingClientRect(), f = document.getElementById('edit-fields');
          return { vh: innerHeight, top: Math.round(h2.top), saveBottom: Math.round(sv.bottom), scroll: f.scrollHeight > f.clientHeight, eb: Math.round(e.bottom) }; }""")
        check('fiche : titre en haut et bouton Enregistrer visibles sur une fenêtre basse', lay['top'] >= 0 and lay['saveBottom'] <= lay['vh'] and lay['scroll'], lay)
        pg.evaluate("document.getElementById('edit-fields').scrollTop = 9999")
        after = pg.evaluate("({ top: Math.round(document.getElementById('editor-title').getBoundingClientRect().top), saveBottom: Math.round(document.querySelector('#edit-form button[type=submit]').getBoundingClientRect().bottom), vh: innerHeight })")
        check('fiche : titre et boutons restent en place pendant le défilement des champs', after['top'] >= 0 and after['saveBottom'] <= after['vh'], after)
        pg.evaluate("document.getElementById('edit-fields').scrollTop = 0")
        pg.fill('#f-realEnd', '2026-09-10')
        pg.click('#edit-form button[type=submit]')
        pg.wait_for_timeout(200)
        pg.click('#task-rows tr[data-id="C"] button.select')
        pg.wait_for_selector('#f-name')
        pg.fill('#f-pct', '50')
        pg.click('#edit-form button[type=submit]')
        pg.wait_for_timeout(200)
        vis = pg.evaluate("(() => { const t = document.getElementById('toast'); return t.hidden ? '' : t.textContent; })()")
        check('G9-5 : message visible quand la fin réelle est effacée (avancement sous 100 %)', 'fin réelle' in vis.lower() or 'finish' in vis.lower(), vis)
        pg.set_viewport_size({'width': 1500, 'height': 950})
        load_fx('projet-atlas-budget.json')

        # EX-30 : l'impression ne perd aucune information (bandes de pages, colonnes Début / Fin / Dépendances, textes non coupés).
        pg.evaluate('window.print = () => {}')
        for scale, orient in [('fit', 'landscape'), ('zoom', 'landscape'), ('zoom', 'portrait')]:
            pg.click('button[data-click="openPrint"]')
            pg.check(f'#pr-scale-{scale}'); pg.check(f'#pr-orient-{orient}')
            pg.click('dialog[open] button:has-text("Imprimer")')
            pg.wait_for_timeout(200)
            pg.emulate_media(media='print')
            info = pg.evaluate("""() => { const ts = [...document.querySelectorAll('#print-area table.print-gantt')]; const bad = [];
              ts.forEach(t => t.querySelectorAll('td, th').forEach(c => { if (c.scrollWidth > c.clientWidth + 1) bad.push(c.textContent.slice(0, 20)); }));
              return { n: ts.length, heads: [...ts[0].querySelectorAll('thead th')].map(x => x.textContent), caps: ts.map(t => t.querySelector('caption').textContent),
                rows: ts.map(t => t.querySelectorAll('tbody tr').length), bad }; }""")
            pg.emulate_media(media='screen')
            tag = f'{scale}, {orient}'
            check(f'EX-30 : colonnes Début, Fin et Dépendances imprimées ({tag})', all(x in sp(' '.join(info['heads'])) for x in ['Début', 'Fin', 'Dépendances']), info['heads'])
            check(f'EX-30 : aucun texte coupé à l\'impression ({tag})', not info['bad'], info['bad'])
            check(f'EX-30 : toutes les lignes sur chaque bande ({tag})', len(set(info['rows'])) == 1 and info['rows'][0] >= 40, info['rows'])
            if scale == 'fit':
                check('EX-30 : « Ajuster » = une seule bande', info['n'] == 1, info['n'])
            else:
                check(f'EX-30 : « Zoom actuel » découpé en bandes numérotées ({tag})', info['n'] > 1 and all(f'partie {i + 1} sur {info["n"]}' in c for i, c in enumerate(info['caps'])), info['caps'])
            pg.wait_for_timeout(1800)
            check(f'EX-30 : nettoyage après impression ({tag})', pg.evaluate("!document.body.classList.contains('printing')"))

        check('aucune erreur JavaScript ni violation CSP', not errors, errors)
        browser.close()

    ok = sum(1 for _, v in results if v)
    print(f'\n{ok}/{len(results)} vérifications réussies.')
    sys.exit(0 if ok == len(results) else 1)


if __name__ == '__main__':
    main()
