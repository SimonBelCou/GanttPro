#!/usr/bin/env python3
"""Tests de bout en bout de GanttPro v3 (dist/GanttPro.html) : Chromium headless, CSP réellement appliquée.

    python3 tools/build.py
    pip install playwright && python3 -m playwright install chromium
    npm install --no-save axe-core          # audit d'accessibilité (WCAG 2.1 AA)
    python3 tests/test_v3.py

Couvre : CSP (script et style par empreinte, aucun réseau), import malveillant (XSS, refus complet),
parcours clavier et souris (ajout, édition, dépendances, boucle refusée, annuler/rétablir),
ressources et conflits, export/réimport, langue, fermeture avec modifications, accessibilité.
"""
import json
import os
import sys
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
HTML = Path(os.environ.get('GANTT_HTML', ROOT / 'dist' / 'GanttPro.html'))
AXE = Path(os.environ.get('AXE_JS', ROOT / 'node_modules' / 'axe-core' / 'axe.min.js'))

results = []


def check(name, ok, extra=''):
    results.append((name, bool(ok)))
    print(('OK    ' if ok else 'ECHEC '), name, '' if ok else extra)


def xss(n):
    return f"<img src=x onerror=(window.__xss=window.__xss||[]).push({n})>"


def project(**over):
    p = {
        'format': 3, 'name': 'Projet de test', 'projectStart': '2026-01-05',
        'tasks': [
            {'id': 'A', 'name': 'Conception', 'dur': 5, 'res': 'Alice', 'cat': 'Etudes'},
            {'id': 'B', 'name': 'Réalisation', 'dur': 3, 'deps': ['A'], 'res': 'Alice', 'cat': 'Etudes'},
        ],
        'resources': [{'name': 'Alice'}], 'categories': [{'name': 'Etudes', 'color': '#4d9fff'}],
    }
    p.update(over)
    return p


def axe_check(pg, label):
    if not AXE.exists():
        check(f'axe : {label} (axe-core absent, ignoré)', True)
        return
    if not pg.evaluate('!!window.axe'):
        pg.evaluate(AXE.read_text(encoding='utf-8'))
    res = pg.evaluate("""() => axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']}})
                          .then(r => r.violations.map(v => v.id + ' (' + v.nodes.length + ') ' + v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')))""")
    check(f'axe : {label} sans violation', not res, res)


def main():
    tmp = Path(tempfile.mkdtemp())
    files = {}
    def write(name, obj):
        f = tmp / name
        f.write_text(obj if isinstance(obj, str) else json.dumps(obj), encoding='utf-8')
        files[name] = str(f)
    write('ok.json', project())
    write('evil.json', project(name=xss(1), desc=xss(2), tasks=[
        {'id': 'A', 'name': xss(3), 'dur': 5, 'res': xss(4), 'cat': xss(5), 'notes': xss(6)}],
        resources=[{'name': xss(4), 'role': xss(7)}], categories=[{'name': xss(5), 'color': '#123456'}]))
    write('badid.json', project(tasks=[{'id': "');alert(1);//", 'name': 'x', 'dur': 1}]))
    write('badcolor.json', project(resources=[{'name': 'Alice', 'color': 'red" onmouseover="window.__xss=9'}]))
    write('cycle.json', project(tasks=[{'id': 'A', 'name': 'a', 'dur': 1, 'deps': ['B']}, {'id': 'B', 'name': 'b', 'dur': 1, 'deps': ['A']}]))
    write('huge.json', '{"tasks":[],"pad":"' + 'x' * (5 * 1024 * 1024 + 10) + '"}')
    write('conflict.json', project(tasks=[
        {'id': 'A', 'name': 'Conception', 'dur': 5, 'res': 'Alice'},
        {'id': 'B', 'name': 'Revue', 'dur': 3, 'res': 'Alice', 'forcedStart': '2026-01-07'}]))
    write('edit.json', project(leveling='off', tasks=[
        {'id': 'A', 'name': 'Alpha', 'dur': 5}, {'id': 'B', 'name': 'Bravo', 'dur': 3, 'deps': ['A']},
        {'id': 'C', 'name': 'Charlie', 'dur': 2}, {'id': 'D', 'name': 'Delta', 'dur': 4, 'tags': ['urgent']}], resources=[{'name': 'Alice'}, {'name': 'Bob'}]))
    write('sheet.csv', 'N°;Nom;Durée;Prédécesseurs;Ressources\n1;Cadrage;3;;Alice\n2;Maquette;4;1;Bob\n3;=HYPERLINK("x");2;9;\n4;Recette;abc;2;\n')
    write('level.json', project(leveling='level', tasks=[
        {'id': 'A', 'name': 'Conception', 'dur': 3, 'res': 'Alice'}, {'id': 'B', 'name': 'Revue', 'dur': 2, 'res': 'Alice'}]))

    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-sandbox'])
        ctx = browser.new_context(viewport={'width': 1500, 'height': 950}, locale='fr-FR', accept_downloads=True)
        ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
        pg = ctx.new_page()
        errors, csp = [], []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: csp.append(m.text) if ('Content Security Policy' in m.text or 'Refused' in m.text)
              else (errors.append(m.text) if m.type == 'error' else None))
        pg.clock.set_fixed_time('2026-01-14T10:00:00')
        pg.goto(HTML.as_uri())
        pg.wait_for_selector('#task-rows tr')

        # ── Chargement et CSP ──────────────────────────────────────────────────────────────
        check('aucune erreur ni violation CSP au chargement', not errors and not csp, (errors, csp))
        meta = pg.get_attribute('meta[http-equiv="Content-Security-Policy"]', 'content')
        check("CSP sans 'unsafe-inline' ni 'unsafe-eval'", 'unsafe' not in meta, meta)
        check('polices intégrées chargées', pg.evaluate("document.fonts.load('600 14px Sora').then(() => document.fonts.check('600 14px Sora'))"))
        pg.evaluate("""() => {
            document.body.insertAdjacentHTML('beforeend', '<img id="probe" src="x" onerror="window.__csp1=1"><div id="probe2" style="width:123px"></div>');
            const s = document.createElement('script'); s.textContent = 'window.__csp2 = 1'; document.body.appendChild(s);
        }""")
        pg.wait_for_timeout(200)
        check('CSP : gestionnaire inline injecté bloqué', not pg.evaluate('!!window.__csp1'))
        check('CSP : script injecté bloqué', not pg.evaluate('!!window.__csp2'))
        check('CSP : attribut style injecté bloqué', pg.evaluate("document.getElementById('probe2').getBoundingClientRect().width") != 123)
        check('CSP : aucune requête réseau', pg.evaluate("fetch('https://example.com').then(() => 'sortie').catch(() => 'bloquée')") == 'bloquée')
        pg.evaluate("document.getElementById('probe').remove(); document.getElementById('probe2').remove()")
        csp.clear()
        check('nouveau projet en lissage par défaut', pg.input_value('#leveling-mode') == 'smooth')
        check('projet initial : tâche A de 10 jours', pg.inner_text('#task-rows tr[data-id="A"]').count('10 j') == 1)
        axe_check(pg, 'vue principale')

        def import_file(name):
            pg.set_input_files('#file-input', files[name])
            pg.wait_for_selector('dialog[open]')

        def dialog_text():
            return pg.inner_text('dialog[open]')

        def close_dialog(button='Annuler'):
            # Plusieurs fenêtres peuvent s'empiler : on agit sur la dernière ouverte.
            pg.locator('dialog[open]').last.locator(f'button:has-text("{button}")').first.click()
            pg.wait_for_timeout(100)

        # ── Import refusé : projet intact ────────────────────────────────────────────────────
        before = pg.inner_text('#task-rows')
        for name, expected in [('badid.json', 'identifiant invalide'), ('badcolor.json', 'couleur'), ('cycle.json', 'Boucle de dépendances : A → B → A'),
                               ('huge.json', 'trop volumineux')]:
            import_file(name)
            txt = dialog_text()
            check(f'import refusé : {name}', expected in txt, txt)
            close_dialog('Valider')
        check('après refus, le projet ouvert est intact', pg.inner_text('#task-rows') == before)

        # ── Import malveillant : affiché comme du texte ──────────────────────────────────────
        import_file('evil.json')
        axe_check(pg, "fenêtre d'aperçu d'import")
        close_dialog('Remplacer le projet ouvert')
        pg.wait_for_timeout(200)
        pg.hover('.bar'); pg.click('.bar'); pg.wait_for_timeout(100)
        pg.keyboard.press('Escape')
        check('import malveillant : aucun code exécuté', not pg.evaluate('window.__xss'), pg.evaluate('window.__xss'))
        check('import malveillant : le nom est affiché tel quel', xss(3) in pg.inner_text('#task-rows'))
        check('import malveillant : aucune balise injectée', pg.evaluate("document.querySelectorAll('img, svg:not(.g-links)').length") == 0)

        # ── Parcours : import, ajout au clavier, édition, dépendance, boucle ─────────────────
        import_file('ok.json')
        close_dialog('Remplacer le projet ouvert')
        check('B suit A : B du 12/01 au 14/01', 'du lun. 12 janv. 2026 au mer. 14 janv. 2026' in pg.get_attribute('.bar >> nth=1', 'aria-label'))
        pg.focus('button:has-text("+ Ajouter tâche")'); pg.keyboard.press('Enter')
        pg.wait_for_selector('#editor:not([hidden])')
        check("ajout : l'édition s'ouvre sur la nouvelle tâche C", pg.inner_text('#editor-title') == 'Modifier C')
        pg.fill('#f-name', 'Tests')
        pg.fill('#f-dur', '0')
        pg.keyboard.press('Enter')
        check('durée 0 refusée avec un message précis', 'Durée (jours ouvrés) : entier de 1 à 3 650.' in pg.inner_text('#f-dur-err') and pg.evaluate("document.activeElement.id") == 'f-dur')
        pg.fill('#f-dur', '2')
        pg.select_option('#dep-pick', 'B'); pg.click('button:has-text("Ajouter le prédécesseur")')
        pg.click('#editor button[type=submit]')
        pg.wait_for_timeout(100)
        row_c = pg.inner_text('#task-rows tr[data-id="C"]')
        check('C enregistrée : 2 j, dépend de B', '2 j' in row_c and 'B' in row_c, row_c)
        check('C du 15/01 au 16/01', 'du jeu. 15 janv. 2026 au ven. 16 janv. 2026' in pg.get_attribute('.bar[data-arg="C"]', 'aria-label'))
        check('chemin critique A → B → C', 'A → B → C' in pg.inner_text('#kpis'))
        # Boucle : A dépend de C
        pg.click('#task-rows button.select:has-text("Conception")')
        pg.select_option('#dep-pick', 'C'); pg.click('button:has-text("Ajouter le prédécesseur")')
        check('boucle refusée : message RG-09', 'Cette dépendance créerait la boucle' in pg.inner_text('#deps-err'), pg.inner_text('#deps-err'))
        axe_check(pg, "panneau d'édition")
        pg.keyboard.press('Escape')
        check('Échap ferme l\'édition sans rien changer', pg.is_hidden('#editor'))

        # ── Annuler / rétablir ───────────────────────────────────────────────────────────────
        pg.click('#btn-undo')
        check('annuler retire la tâche C', pg.query_selector('#task-rows tr[data-id="C"] td:nth-child(4)') is None or 'B' not in pg.inner_text('#task-rows tr[data-id="C"]'))
        pg.click('#btn-redo')
        check('rétablir remet le lien de C', 'B' in pg.inner_text('#task-rows tr[data-id="C"]'))

        # ── Conflit de ressource ─────────────────────────────────────────────────────────────
        import_file('conflict.json')
        close_dialog('Remplacer le projet ouvert')
        check('badge « 1 conflit »', pg.inner_text('#btn-alerts') == '1 conflit')
        check('bandeau : Alice à 200 %', 'Alice est à 200 % du 07/01 au 09/01 (A, B)' in pg.inner_text('#alerts'), pg.inner_text('#alerts'))
        check('conflit signalé en texte sur la ligne', 'en conflit' in pg.inner_text('#task-rows tr[data-id="B"]'))

        # ── Résolution des conflits (EF-31) ─────────────────────────────────────────────────
        pg.click('#btn-resolve')
        pg.wait_for_selector('#rsv-win')
        txt = pg.inner_text('#rsv-win')
        check('résoudre : propositions simulées', 'Déplacer la date imposée de B au lun. 12 janv. 2026' in txt and 'aucun conflit restant ; fin repoussée de 3 jours' in txt, txt)
        axe_check(pg, 'fenêtre Résoudre les conflits')
        pg.click('#rsv-win button:has-text("Appliquer") >> nth=0')
        pg.wait_for_timeout(100)
        check('résoudre : conflit corrigé', 'Aucun conflit' in pg.inner_text('#rsv-win') and pg.is_hidden('#btn-alerts'))
        close_dialog('Fermer')
        pg.click('#btn-undo')
        check('résoudre : la correction s\'annule', pg.inner_text('#btn-alerts') == '1 conflit')

        # ── Modes de gestion de la charge (RG-08, RG-33) ───────────────────────────────────
        import_file('level.json')
        close_dialog('Remplacer le projet ouvert')
        check('nivellement : décalage affiché sur la ligne', '3 j de décalage (Alice : surcharge)' in pg.inner_text('#task-rows tr[data-id="B"]'), pg.inner_text('#task-rows tr[data-id="B"]'))
        pg.click('#task-rows button.select:has-text("Revue")')
        check("nivellement : expliqué dans l'édition", 'Sans ce décalage, elle commencerait le lun. 05 janv. 2026' in pg.inner_text('#edit-shift'))
        pg.keyboard.press('Escape')
        pg.select_option('#leveling-mode', 'off')
        check('sans nivellement : le chevauchement devient un conflit', pg.inner_text('#btn-alerts') == '1 conflit')
        pg.select_option('#leveling-mode', 'smooth')
        check('lissage sans marge : conflit et alerte « non lissée »', pg.inner_text('#btn-alerts') == '1 conflit' and "n'est pas lissée" in pg.inner_text('#alerts'), pg.inner_text('#alerts'))
        pg.click('#btn-resolve')
        pg.wait_for_selector('#rsv-win')
        check('proposition globale : nivellement automatique', 'Passer le projet en nivellement automatique' in pg.inner_text('#rsv-win'))
        check("arbitrage proposé : A avant B, avec son effet", 'Arbitrer : faire passer A avant B (lien fin-début A → B)' in pg.inner_text('#rsv-win'), pg.inner_text('#rsv-win'))
        pg.click('#rsv-win section:has-text("Pour tout le projet") button')
        check('nivellement rétabli : plus de conflit', pg.input_value('#leveling-mode') == 'level' and pg.is_hidden('#btn-alerts'))
        close_dialog('Fermer')
        import_file('conflict.json')
        close_dialog('Remplacer le projet ouvert')

        # ── Baselines, flèches, infobulle, tableau de bord ─────────────────────────────────
        import_file('ok.json')
        close_dialog('Remplacer le projet ouvert')
        check('flèches de liens affichées (Liens : ON)', pg.locator('.g-links .link').count() == 1 and pg.get_attribute('#btn-links', 'aria-pressed') == 'true')
        pg.click('#btn-links')
        check('Liens : OFF masque les flèches', pg.locator('.g-links').count() == 0)
        pg.click('#btn-links')
        pg.focus('.bar[data-arg="B"]')
        tip = pg.inner_text('#tooltip')
        check('infobulle au focus clavier', pg.is_visible('#tooltip') and 'Réalisation' in tip and 'Prédécesseurs : A' in tip, tip)
        pg.keyboard.press('Escape')
        check('Échap ferme l\'infobulle', pg.is_hidden('#tooltip'))
        pg.click('button[data-click="openBaselines"]')
        pg.wait_for_selector('#bl-win')
        pg.click('#bl-win button:has-text("Capturer une baseline")')
        check('baseline capturée', 'Baseline 1' in pg.eval_on_selector_all('#bl-win input[type=text]', 'els => els.map(e => e.value).join()'))
        axe_check(pg, 'fenêtre Baselines')
        close_dialog('Fermer')
        check('barres de baseline sur le Gantt', pg.locator('.g-body .bl').count() == 2)
        check('baseline dans le nom accessible de la barre', 'baseline Baseline 1' in pg.get_attribute('.bar[data-arg="A"]', 'aria-label'))
        pg.click('button[data-click="openDashboard"]')
        pg.wait_for_selector('#dash-win')
        dash = pg.inner_text('#dash-win')
        check('tableau de bord : indicateurs', 'Avancement global' in dash and 'Tâches terminées' in dash)
        check('courbe en S : SVG titré et décrit', pg.locator('svg.scurve title').count() == 1 and pg.locator('svg.scurve polyline.planned').count() == 1)
        pg.click('#dash-win button:has-text("Afficher les valeurs")')
        check('équivalent texte de la courbe', pg.locator('#sc-values tbody tr').count() >= 2 and pg.get_attribute('[data-click="dashValues"]', 'aria-expanded') == 'true')
        pg.focus('#dash-win .chart-box'); pg.keyboard.press('ArrowRight')
        check('courbe parcourue au clavier', 'Prévu' in pg.inner_text('#dash-win .chart-tip'))
        pg.select_option('#dash-bl', label='Baseline 1')
        check('colonne Écart vs baseline', 'Écart vs baseline' in pg.inner_text('#tracking thead'))
        pg.click('#tracking button.sort:has-text("Activité")')
        check('tri des colonnes (aria-sort)', pg.locator('#tracking th[aria-sort="ascending"]').count() == 1)
        axe_check(pg, 'tableau de bord')
        close_dialog('Fermer')
        import_file('conflict.json')
        close_dialog('Remplacer le projet ouvert')

        # ── Calendrier, fiche de ressource (EF-69, EF-71) ─────────────────────────────────
        import_file('ok.json')
        close_dialog('Remplacer le projet ouvert')
        pg.click('button[data-click="openCalendar"]')
        pg.wait_for_selector('#cal-win')
        check('calendrier : aperçu de janvier 2026 avec le 1er janvier férié', 'janv. 2026' in pg.inner_text('#cal-month') and pg.locator('#cal-win td.holiday').count() >= 1)
        pg.fill('#cal-off-from', '2026-01-07'); pg.fill('#cal-off-label', 'Pont'); pg.click('#cal-win button:has-text("Ajouter le jour chômé")')
        check('calendrier : jour chômé ajouté', 'Pont' in pg.inner_text('#cal-win'))
        axe_check(pg, 'fenêtre Calendrier')
        pg.click('dialog[open] button:has-text("Enregistrer")')
        check('calendrier : A décalée d\'un jour (fin le 12/01)', 'au lun. 12 janv. 2026' in pg.get_attribute('.bar[data-arg="A"]', 'aria-label'))
        pg.click('#btn-undo')
        pg.click('button:has-text("Ressources")')
        pg.click('#res-win button:has-text("Fiche Alice")')
        pg.wait_for_selector('#rs-win')
        check('fiche : tâches et charge', 'Charge totale : 8 jours-personne.' in pg.inner_text('#rs-win'), pg.inner_text('#rs-win'))
        pg.fill('#rs-from', '2026-01-05'); pg.fill('#rs-to', '2026-01-06'); pg.fill('#rs-label', 'Congés')
        pg.click('#rs-win button:has-text("Ajouter l\'absence")')
        check('fiche : absence ajoutée', 'Congés' in pg.inner_text('#rs-win'))
        pg.fill('#rs-cap', '50'); pg.dispatch_event('#rs-cap', 'change')
        check('fiche : capacité trop basse refusée avec le nom de la tâche', 'la tâche A Conception est affectée à 100 %' in pg.inner_text('#rs-err'), pg.inner_text('#rs-err'))
        axe_check(pg, 'fiche de ressource')
        close_dialog('Fermer'); close_dialog('Fermer')
        # Lissage (défaut) : A est critique, sans marge ; l'absence devient un conflit à arbitrer.
        check('absence en lissage : conflit signalé', 'Alice : absence du 05/01 au 06/01 pendant A' in pg.inner_text('#alerts'), pg.inner_text('#alerts'))
        pg.select_option('#leveling-mode', 'level')
        check('absence en nivellement : A commence après les congés (07/01)', 'du mer. 07 janv. 2026' in pg.get_attribute('.bar[data-arg="A"]', 'aria-label'))

        # ── Recherche, filtres, regroupement, raccourcis (EF-78, EF-80, EF-84 à EF-86) ────
        pg.keyboard.press('Escape')
        pg.click('main'); pg.keyboard.press('/')
        check('« / » place le focus dans la recherche', pg.evaluate("document.activeElement.id") == 'search')
        pg.keyboard.type('realisation')
        pg.wait_for_timeout(250)
        check('recherche sans accents : 1 résultat', pg.inner_text('#view-count') == '1 résultat' and pg.locator('#task-rows tr[data-id]').count() == 1)
        pg.keyboard.press('Escape')
        pg.wait_for_timeout(50)
        check('Échap vide la recherche', pg.locator('#task-rows tr[data-id]').count() == 2)
        pg.click('#btn-filters')
        pg.check('#filters-panel input[data-arg="status:late"]')
        check('filtre par statut : 1 sur 2, pastille', pg.inner_text('#view-count') == '1 sur 2' and 'Statut : En retard' in pg.inner_text('#view-chips'), pg.inner_text('#view-count'))
        check('chiffres du projet entier signalés', 'projet entier' in pg.inner_text('#kpis'))
        axe_check(pg, 'panneau des filtres')
        pg.click('#view-chips button.chip')
        check('pastille retirée : plus de filtre', pg.inner_text('#view-count') == '')
        pg.click('#btn-filters')
        pg.select_option('#group-by', 'res')
        check('regroupement par ressource : en-tête avec totaux', 'Alice — 2 élément(s), 8 j' in pg.inner_text('#task-rows'), pg.inner_text('#task-rows'))
        pg.select_option('#group-by', '')
        pg.click('#task-rows button.select:has-text("Conception")'); pg.keyboard.press('Escape')
        pg.focus('#task-rows button.select:has-text("Conception")')
        pg.keyboard.press('Control+d')
        check('Ctrl + D duplique la tâche', 'Conception (copie)' in pg.inner_text('#task-rows'))
        pg.keyboard.press('Alt+ArrowRight')
        check('Alt + → impose la date suivante', '📌' in pg.inner_text('#task-rows tr[data-id="C"]'), pg.inner_text('#task-rows'))
        pg.keyboard.press('Alt+Shift+ArrowRight')
        check('Alt + Maj + → allonge d\'un jour', '6 j' in pg.inner_text('#task-rows tr[data-id="C"]'))
        import_file('conflict.json')
        close_dialog('Remplacer le projet ouvert')

        # ── Lot A : sélection multiple, hiérarchie, gestes, commentaires ───────────────────
        import_file('edit.json')
        close_dialog('Remplacer le projet ouvert')
        pg.click('#task-rows button.select:has-text("Charlie")', modifiers=['Control'])
        pg.click('#task-rows button.select:has-text("Delta")', modifiers=['Control'])
        check('Ctrl + clic : barre de sélection « 2 tâches sélectionnées »', '2 tâches sélectionnées' in pg.inner_text('#selbar'))
        pg.click('#selbar button:has-text("Modifier en masse")')
        pg.select_option('#bk-res-mode', 'add'); pg.select_option('#bk-res', label='Bob'); pg.fill('#bk-units', '50'); pg.fill('#bk-tag-add', 'lot2')
        axe_check(pg, 'modification en masse')
        close_dialog('Appliquer')
        check('modification en masse : Bob 50 % sur C et D', 'Bob 50 %' in pg.inner_text('#task-rows tr[data-id="C"]') and 'Bob 50 %' in pg.inner_text('#task-rows tr[data-id="D"]'))
        pg.click('#selbar button:has-text("Regrouper sous une récapitulative")')
        pg.keyboard.press('Escape')
        check('regrouper : récapitulative E créée au-dessus de C et D', pg.locator('#task-rows tr.summary[data-id="E"]').count() == 1 and pg.evaluate("[...document.querySelectorAll('#task-rows tr[data-id]')].map(r => r.dataset.id).join()") == 'A,B,E,C,D')
        pg.click('#task-rows button.select:has-text("Delta")'); pg.keyboard.press('Escape')
        pg.focus('#task-rows button.select:has-text("Delta")')
        pg.keyboard.press('Control+Shift+ArrowLeft')
        check('Ctrl + Maj + ← : D remonte au premier niveau', pg.evaluate("document.querySelector('#task-rows tr[data-id=\"D\"] td.name').style.getPropertyValue('--depth')") == '0')
        pg.keyboard.press('Control+Shift+ArrowRight')
        check('Ctrl + Maj + → : D rentre dans E', pg.evaluate("document.querySelector('#task-rows tr[data-id=\"D\"] td.name').style.getPropertyValue('--depth')") == '1')
        pg.click('#task-rows button.select:has-text("Nouvelle récapitulative")'); pg.keyboard.press('Escape')
        pg.focus('#task-rows button.select:has-text("Nouvelle récapitulative")'); pg.keyboard.press('Delete')
        dtxt = dialog_text()
        check('supprimer une récapitulative : choix « conserver les tâches »', 'Conserver les tâches' in dtxt and 'Supprimer aussi ses 2 tâches' in dtxt, dtxt)
        close_dialog('Conserver les tâches')
        check('tâches conservées au premier niveau', pg.locator('#task-rows tr[data-id="C"]').count() == 1 and pg.locator('#task-rows tr.summary').count() == 0)
        pg.focus('#task-rows button.select:has-text("Alpha")'); pg.keyboard.press('ArrowDown')
        check('↓ déplace la sélection dans la liste', pg.evaluate("document.activeElement.dataset.arg") == 'B' and pg.locator('#task-rows tr.selected[data-id="B"]').count() == 1)
        # Tri : D devient prédécesseur de A ; Trier doit placer D avant A.
        pg.keyboard.press('Enter'); pg.wait_for_selector('#editor:not([hidden])')
        pg.click('#task-rows button.select:has-text("Alpha")')
        pg.select_option('#dep-pick', 'D'); pg.click('button:has-text("Ajouter le prédécesseur")'); pg.click('#editor button[type=submit]')
        pg.click('button[data-click="sortTasks"]'); close_dialog('Trier')
        order = pg.evaluate("[...document.querySelectorAll('#task-rows tr[data-id]')].map(r => r.dataset.id).join()")
        check('Trier : chaque prédécesseur avant ses successeurs', order.index('D') < order.index('A') < order.index('B'), order)
        # Gestes à la souris (zoom 200 %)
        for _ in range(5): pg.click('button[aria-label="Zoom avant"]')
        bar = pg.locator('.bar[data-arg="C"]').bounding_box()
        pg.mouse.move(bar['x'] + bar['width'] / 2, bar['y'] + bar['height'] / 2); pg.mouse.down()
        pg.mouse.move(bar['x'] + bar['width'] / 2 + 60, bar['y'] + bar['height'] / 2, steps=6)
        check('glisser : barre fantôme et date visée', pg.locator('.ghost').count() == 1 and 'Date imposée' in pg.inner_text('#tooltip'))
        pg.mouse.up()
        check('glisser : date imposée et message Annuler', '📌' in pg.inner_text('#task-rows tr[data-id="C"]') and pg.is_visible('#toast button'))
        pg.click('#toast button')
        check('Annuler depuis le message', '📌' not in pg.inner_text('#task-rows tr[data-id="C"]'))
        bar = pg.locator('.bar[data-arg="C"]').bounding_box()
        pg.mouse.move(bar['x'] + bar['width'] - 2, bar['y'] + 10); pg.mouse.down()
        pg.mouse.move(bar['x'] + bar['width'] + 30, bar['y'] + 10, steps=5); pg.mouse.up()
        check('tirer le bord droit allonge la tâche', '2 j' not in pg.inner_text('#task-rows tr[data-id="C"]'), pg.inner_text('#task-rows tr[data-id="C"]'))
        pg.hover('.bar[data-arg="C"]')
        src = pg.locator('.bar[data-arg="C"] .lk-e').bounding_box()
        pg.mouse.move(src['x'] + 5, src['y'] + 5); pg.mouse.down()
        pg.mouse.move(src['x'] + 40, src['y'] + 40, steps=4)
        dst = pg.locator('.bar[data-arg="B"] .lk-s').bounding_box()
        pg.mouse.move(dst['x'] + 5, dst['y'] + 5, steps=6); pg.mouse.up()
        check('tirer un lien fin → début crée « C → B »', 'C' in pg.inner_text('#task-rows tr[data-id="B"] td:nth-child(4)'), pg.inner_text('#task-rows tr[data-id="B"]'))
        pg.mouse.move(dst['x'] + 5, dst['y'] + 5); pg.mouse.down(); pg.mouse.move(src['x'] + 5, src['y'] + 5, steps=6); pg.mouse.up()
        check('lien qui créerait une boucle : refusé avec message', 'boucle' in pg.inner_text('#toast'), pg.inner_text('#toast'))
        # Commentaires et étiquettes (EF-90, EF-91)
        pg.click('#task-rows button.select:has-text("Charlie")')
        pg.fill('#f-comment', 'Valider avec le client'); pg.click('#editor button:has-text("Ajouter le commentaire")')
        check('commentaire horodaté', 'Valider avec le client' in pg.inner_text('#comments-box'))
        check('étiquettes proposées', pg.locator('#editor .suggest button:has-text("urgent")').count() == 1)
        pg.click('#editor .suggest button:has-text("urgent")')
        pg.click('#editor button[type=submit]')
        check('📝 et étiquette visibles', '📝' in pg.inner_text('#task-rows tr[data-id="C"]'))
        pg.locator('.col-resize[data-col="name"]').focus(); pg.keyboard.press('ArrowRight'); pg.keyboard.press('ArrowRight')
        check('largeur de colonne réglable au clavier', pg.get_attribute('.col-resize[data-col="name"]', 'aria-valuenow') is not None and pg.evaluate("document.getElementById('tasks-table').classList.contains('fixed')"))
        pg.click('#btn-list')
        check('replier la liste', pg.is_hidden('#list') and pg.get_attribute('#btn-list', 'aria-expanded') == 'false')
        pg.click('#btn-list')
        pg.click('button[aria-label="Zoom à 100 %"]')
        import_file('conflict.json')
        close_dialog('Remplacer le projet ouvert')

        # ── Lot B : charge, rapport, impression, versions ───────────────────────────────────
        pg.click('button[data-click="openDashboard"]'); pg.wait_for_selector('#dash-win')
        pg.click('#dtab-load')
        check('onglet Charge : graphique par ressource', pg.locator('#dash-win svg.loadchart').count() == 1 and 'Alice' in pg.inner_text('#dash-win'))
        check('charge : surcharge signalée par ▲', pg.locator('#dash-win .over-mark').count() >= 1)
        pg.click('#dash-win button:has-text("Afficher les valeurs")')
        check('charge : tableau des valeurs avec « surcharge »', 'surcharge' in pg.inner_text('#ld-values'))
        axe_check(pg, 'onglet Charge')
        close_dialog('Fermer')
        pg.click('button[data-click="openReport"]'); pg.wait_for_selector('#report-preview')
        rep = pg.inner_text('#report-preview')
        check('rapport : voyant écrit en toutes lettres', 'Voyant : ' in rep and ('ROUGE' in rep or 'ORANGE' in rep or 'VERT' in rep), rep[:200])
        check('rapport : blocs indicateurs, retards, alertes', 'Indicateurs' in rep and 'Tâches en retard' in rep and 'Alertes' in rep)
        pg.uncheck('#rb-curve')
        check('rapport : un bloc se retire', pg.locator('#report-preview svg.scurve').count() == 0)
        pg.fill('#rep-note', 'Point hebdomadaire'); pg.dispatch_event('#rep-note', 'change')
        check('rapport : note reprise', 'Point hebdomadaire' in pg.inner_text('#report-preview'))
        axe_check(pg, "rapport d'état")
        pg.click('#rep-win button:has-text("Copier le texte")')
        pg.wait_for_timeout(200)
        clip = pg.evaluate("navigator.clipboard.readText()")
        check('rapport : texte brut copié', 'Voyant : ' in clip and 'Point hebdomadaire' in clip, clip[:120])
        close_dialog('Fermer')
        pg.click('button[data-click="openPrint"]')
        axe_check(pg, "fenêtre d'impression")
        pg.evaluate("window.print = () => {}")
        close_dialog('Imprimer')
        pg.wait_for_timeout(150)
        check('impression : tableau du Gantt avec en-tête répété', pg.evaluate("document.body.classList.contains('printing') && !!document.querySelector('#print-area table.print-gantt thead .pg-time')"))
        pg.wait_for_timeout(1700)
        check('impression : nettoyage après impression', pg.evaluate("!document.body.classList.contains('printing')"))
        pg.click('button[data-click="openVersions"]')
        pg.fill('#ver-name', 'Avant revue'); pg.click('#ver-win button:has-text("Enregistrer l\'état actuel")')
        check('version enregistrée', 'Avant revue' in pg.inner_text('#ver-win'))
        axe_check(pg, 'fenêtre Versions')
        close_dialog('Fermer')
        pg.fill('#project-start', '2026-02-02'); pg.dispatch_event('#project-start', 'change')
        pg.click('button[data-click="openVersions"]')
        pg.click('#ver-win button:has-text("Restaurer Avant revue")'); close_dialog('Restaurer')
        check('version restaurée', pg.input_value('#project-start') == '2026-01-05')
        close_dialog('Fermer')
        pg.click('#btn-undo')
        check('restauration annulée par « Annuler »', pg.input_value('#project-start') == '2026-02-02')
        import_file('conflict.json')
        close_dialog('Remplacer le projet ouvert')

        # ── Ressources ───────────────────────────────────────────────────────────────────────
        pg.click('button:has-text("Ressources")')
        pg.wait_for_selector('#res-win')
        axe_check(pg, 'fenêtre Ressources')
        pg.click('#res-win button:has-text("Ajouter la ressource")')
        names = pg.eval_on_selector_all('#res-win tbody input[type=text][aria-label^="Nom"]', 'els => els.map(e => e.value)')
        check('ressource ajoutée', len(names) == 2, names)
        last = pg.locator('#res-win tbody tr:last-child input[type=text]').first
        last.fill('alice'); last.press('Tab')
        check('nom en double refusé (casse ignorée)', 'déjà pris' in pg.inner_text('#res-win'), pg.inner_text('#res-win'))
        pg.keyboard.press('Escape')
        check('Échap ferme la fenêtre', pg.query_selector('dialog[open]') is None)

        # ── Export puis réimport ─────────────────────────────────────────────────────────────
        pg.click('button:has-text("Exporter")')
        with pg.expect_download() as dl:
            close_dialog('Exporter')
        path = dl.value.path()
        data = json.loads(Path(path).read_text(encoding='utf-8'))
        check('export : nom de fichier', dl.value.suggested_filename == 'projet_de_test_gantt.json', dl.value.suggested_filename)
        check('export : format 3, tâches et ressources', data['format'] == 3 and [t['id'] for t in data['tasks']] == ['A', 'B'] and data['tasks'][1]['res'] == 'Alice')
        files['export.json'] = path
        import_file('export.json')
        check('réimport accepté', 'Aperçu' in dialog_text())
        close_dialog('Remplacer le projet ouvert')

        # ── Lot C : exports multiformats, chiffrement, assistant d'import, copier-coller ─────
        import zipfile
        pg.click('button:has-text("Exporter")')
        pg.wait_for_selector('#exp-win')
        axe_check(pg, "fenêtre d'export")
        pg.check('#exp-f-xlsx')
        with pg.expect_download() as dl:
            close_dialog('Exporter')
        xp = dl.value.path()
        with zipfile.ZipFile(xp) as z:
            names = z.namelist(); sheet1 = z.read('xl/worksheets/sheet1.xml').decode()
        check('export Excel : classeur valide', dl.value.suggested_filename.endswith('.xlsx') and 'xl/workbook.xml' in names and 'Conception' in sheet1, names)
        pg.click('button:has-text("Exporter")'); pg.check('#exp-f-csv')
        with pg.expect_download() as dl:
            close_dialog('Exporter')
        csvt = Path(dl.value.path()).read_bytes()
        check('export CSV : BOM et point-virgule', csvt.startswith(b'\xef\xbb\xbf') and b';' in csvt and 'Revue' in csvt.decode('utf-8-sig'))
        pg.click('button:has-text("Exporter")'); pg.check('#exp-f-msp')
        with pg.expect_download() as dl:
            close_dialog('Exporter')
        mspx = Path(dl.value.path()).read_text(encoding='utf-8')
        check('export MS Project : XML avec tâches et lien', '<Project' in mspx and '<Name>Revue</Name>' in mspx, mspx[:300])
        files['export.xml'] = dl.value.path()
        pg.click('button:has-text("Exporter")'); pg.check('#exp-f-png')
        with pg.expect_download() as dl:
            close_dialog('Exporter')
        png = Path(dl.value.path()).read_bytes()
        check('export PNG : image', png[:8] == b'\x89PNG\r\n\x1a\n' and len(png) > 2000, len(png))
        import_file('export.xml')
        check('import MS Project : aperçu', 'Aperçu' in dialog_text() and '2 tâches' in dialog_text(), dialog_text())
        close_dialog('Remplacer le projet ouvert')
        check('import MS Project : tâches relues', 'Revue' in pg.inner_text('#task-rows') and 'Conception' in pg.inner_text('#task-rows'))
        # Chiffrement : mot de passe court refusé, aller-retour réussi, mauvais mot de passe refusé
        pg.click('button:has-text("Exporter")'); pg.check('#exp-f-json'); pg.check('#exp-protect')
        pg.fill('#exp-pwd', 'court'); pg.fill('#exp-pwd2', 'court')
        close_dialog('Exporter')
        check('mot de passe trop court refusé', '12' in pg.inner_text('#exp-err'), pg.inner_text('#exp-err'))
        pg.fill('#exp-pwd', 'une phrase de passe solide'); pg.fill('#exp-pwd2', 'une phrase de passe solide')
        with pg.expect_download(timeout=60000) as dl:
            close_dialog('Exporter')
        env = json.loads(Path(dl.value.path()).read_text(encoding='utf-8'))
        check('export chiffré : enveloppe AES-GCM sans texte clair', env.get('encrypted') is True and env['cipher']['name'] == 'AES-256-GCM' and 'Revue' not in json.dumps(env))
        files['enc.json'] = dl.value.path()
        import_file('enc.json')
        pg.wait_for_selector('#ask-pwd'); pg.fill('#ask-pwd', 'mauvais mot de passe'); close_dialog('Valider')
        pg.wait_for_timeout(1500)
        check('mauvais mot de passe : refus générique', 'mot de passe' in dialog_text().lower(), dialog_text())
        while pg.query_selector('dialog[open]'): pg.keyboard.press('Escape')
        import_file('enc.json')
        pg.wait_for_selector('#ask-pwd'); pg.fill('#ask-pwd', 'une phrase de passe solide'); close_dialog('Valider')
        pg.wait_for_selector('dialog[open] :text("Aperçu")', timeout=30000)
        check('fichier chiffré rouvert avec le bon mot de passe', '2 tâches' in dialog_text())
        close_dialog('Remplacer le projet ouvert')
        # Assistant d'import CSV
        import_file('sheet.csv')
        pg.wait_for_selector('#wiz')
        check('assistant : étape 1, en-têtes détectés', 'Étape 1 sur 3' in dialog_text() and pg.is_checked('#wiz-header'))
        axe_check(pg, "assistant d'import")
        close_dialog('Suivant')
        check('assistant : correspondance proposée', pg.eval_on_selector('#wiz-map-name', 'e => e.selectedOptions[0].text').endswith('Nom') and pg.eval_on_selector('#wiz-map-id', 'e => e.value') == '')
        close_dialog('Suivant')
        wt = dialog_text()
        check('assistant : lignes en erreur listées', '2 ligne(s) valide(s) sur 4' in wt and 'la tâche 9 est introuvable' in wt, wt)
        pg.check('#wiz-m-add')
        close_dialog('Importer')
        rows = pg.inner_text('#task-rows')
        check('assistant : tâches valides ajoutées, liens par N°', 'Cadrage' in rows and 'Maquette' in rows and 'Recette' not in rows, rows)
        pg.click('#btn-undo')
        check("assistant : l'import s'annule", 'Cadrage' not in pg.inner_text('#task-rows'))
        # Copier-coller
        pg.click('#task-rows tr[data-id="B"] button.select')
        n0 = pg.locator('#task-rows tr').count()
        pg.evaluate("document.activeElement && document.activeElement.blur()")
        tsv = pg.evaluate("""() => { const dt = new DataTransfer(); document.dispatchEvent(new ClipboardEvent('copy', {clipboardData: dt, bubbles: true})); return dt.getData('text/plain'); }""")
        check('copier : texte tabulé', '\t' in tsv and 'Revue' in tsv, tsv)
        pg.evaluate("""(t) => { const dt = new DataTransfer(); dt.setData('text/plain', t); document.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true})); }""", tsv)
        check('coller : copie ajoutée', pg.locator('#task-rows tr').count() == n0 + 1 and pg.inner_text('#task-rows').count('Revue') == 2, pg.inner_text('#task-rows'))
        pg.evaluate("""() => { const dt = new DataTransfer(); dt.setData('text/plain', 'Essai collé\\t2'); document.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true})); }""")
        check('coller depuis un tableur', 'Essai collé' in pg.inner_text('#task-rows'), pg.inner_text('#task-rows'))
        check("grand écran : le panneau d'édition ne recouvre pas la barre d'outils",
              pg.evaluate("document.getElementById('btn-undo').getBoundingClientRect().right <= document.getElementById('editor').getBoundingClientRect().left"))
        pg.click('#btn-undo'); pg.click('#btn-undo')
        check('collages annulés', pg.locator('#task-rows tr').count() == n0)
        pg.click('button[data-arg="task"]'); pg.click('#btn-undo')
        check("annuler la création ferme la fiche de la tâche disparue", pg.is_hidden('#editor'))
        import_file('conflict.json')
        close_dialog('Remplacer le projet ouvert')

        # ── Langue ───────────────────────────────────────────────────────────────────────────
        pg.click('#btn-lang')
        check('langue anglaise : libellés', pg.inner_text('button[data-arg="task"]') == '+ Add task' and pg.get_attribute('html', 'lang') == 'en')
        check('langue anglaise : dates', 'Mon 05 Jan 2026' in pg.inner_text('#kpis'), pg.inner_text('#kpis'))
        pg.click('#btn-lang')

        # ── Fermeture avec modifications (EF-53) ────────────────────────────────────────────
        pg.click('button:has-text("+ Zoom")') if pg.query_selector('button:has-text("+ Zoom")') else pg.click('button[aria-label="Zoom avant"]')
        check('zoomer ne marque pas le projet comme modifié', pg.evaluate("(() => { const e = new Event('beforeunload', {cancelable: true}); window.dispatchEvent(e); return e.defaultPrevented; })()") is False)
        pg.fill('#project-start', '2026-01-12'); pg.dispatch_event('#project-start', 'change')
        check('une modification déclenche l\'avertissement', pg.evaluate("(() => { const e = new Event('beforeunload', {cancelable: true}); window.dispatchEvent(e); return e.defaultPrevented; })()") is True)

        # ── Thème sombre : contraste ─────────────────────────────────────────────────────────
        pg.click('#btn-theme'); pg.click('#btn-theme')
        check('thème sombre appliqué', pg.get_attribute('html', 'data-theme') == 'dark')
        axe_check(pg, 'vue principale en thème sombre')

        check('aucune erreur JavaScript pendant le parcours', not errors and not csp, (errors, csp))
        browser.close()

    failed = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} vérifications réussies.")
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
