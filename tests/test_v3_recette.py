#!/usr/bin/env python3
"""Recette complète de GanttPro v3 : scénarios de la section 9 qui se vérifient dans l'interface et
qui ne sont pas déjà couverts par test_v3.py / test_v3_espace.py, temps de réponse (EX-15, EX-25),
petits écrans (EX-04) et corrections issues du contrôle de conformité.

    python3 tools/build.py && python3 tests/test_v3_recette.py
    PERF_FACTOR=2 python3 tests/test_v3_recette.py   # machine environ deux fois plus lente qu'un poste de bureau

Toutes les données sont fictives (EX-12).
"""
import json
import os
import statistics
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
HTML = Path(os.environ.get('GANTT_HTML', ROOT / 'GanttPro.html'))
AXE = Path(os.environ.get('AXE_JS', ROOT / 'node_modules' / 'axe-core' / 'axe.min.js'))
results = []
# Les objectifs EX-15 / EX-25 valent « sur un ordinateur de bureau courant » ; un serveur d'intégration
# partagé est plus lent : PERF_FACTOR (2 dans la CI) élargit les seuils sans changer l'objectif affiché.
PERF = float(os.environ.get('PERF_FACTOR', '1'))


def check(name, ok, extra=''):
    results.append((name, bool(ok)))
    print(('OK    ' if ok else 'ECHEC '), name, '' if ok else extra)


def task(id, name, dur=5, **kw):
    return {'id': id, 'name': name, 'dur': dur, **kw}


def project(tasks, **over):
    p = {'format': 3, 'name': 'Recette', 'projectStart': '2026-01-05', 'leveling': 'off', 'tasks': tasks,
         'resources': [{'name': 'Alice'}, {'name': 'Bob'}], 'categories': [{'name': 'Etudes', 'color': '#4d9fff'}, {'name': 'Dev', 'color': '#36d9a0'}]}
    p.update(over)
    return p


def big_project(n):
    """n tâches en chaînes de 10, deux ressources, quelques étiquettes : charge réaliste pour EX-15."""
    tasks = []
    for i in range(n):
        tid = f'T{i}'
        deps = [f'T{i - 1}'] if i % 10 else []
        tasks.append({'id': tid, 'name': f'Tâche {i}', 'dur': 1 + i % 7, 'deps': deps, 'res': 'Alice' if i % 3 == 0 else ('Bob' if i % 3 == 1 else ''),
                      'cat': 'Dev' if i % 2 else 'Etudes', 'tags': ['lot' + str(i % 5)], 'pct': (i * 7) % 101})
    return project(tasks, leveling='level')


def main():
    tmp = Path(tempfile.mkdtemp())
    files = {}

    def write(name, obj):
        f = tmp / name
        f.write_text(obj if isinstance(obj, str) else json.dumps(obj, ensure_ascii=False), encoding='utf-8')
        files[name] = str(f)

    write('r24.json', project([task('A', 'Alpha'), task('B', 'Bravo', deps=['A']), task('C', 'Charlie', 2, deps=['B'])]))
    write('r25.json', project([task('A', 'Alpha', res='Alice'), task('B', 'Bravo', res='Alice'), task('C', 'Charlie', res='Bob')]))
    write('r31.json', project([task('A', 'Alpha'), task('B', 'Bravo', 3, deps=['A'])]))
    write('r42.json', project([
        {'id': 'S0', 'name': 'Niveau 1', 'type': 'summary'}, {'id': 'S1', 'name': 'Niveau 2', 'type': 'summary', 'parent': 'S0'},
        {'id': 'S2', 'name': 'Niveau 3', 'type': 'summary', 'parent': 'S1'}, {'id': 'S3', 'name': 'Niveau 4', 'type': 'summary', 'parent': 'S2'},
        {'id': 'S4', 'name': 'Niveau 5', 'type': 'summary', 'parent': 'S3'}, task('T', 'Feuille', 2, parent='S4'),
        {'id': 'P', 'name': 'Phase', 'type': 'summary'}, task('C1', 'Etude', 5, parent='P', pct=100), task('C2', 'Codage', 5, parent='P', deps=['C1'])]))
    write('r54.json', project([task('A', 'Alpha', cat='Etudes'), task('B', 'Bravo', cat='Etudes'), task('C', 'Charlie', cat='Etudes'),
                               task('D', 'Delta', cat='Etudes'), task('E', 'Echo', cat='Etudes')]))
    write('r55.json', project([task('A', 'Alpha'), task('B', 'Bravo', 3)], resources=[]))
    write('conflict.json', project([task('A', 'Alpha', res='Alice'), task('B', 'Bravo', 3, res='Alice', forcedStart='2026-01-07')]))
    write('tags.json', project([task('A', 'Alpha')] + [task(f'X{k}', f'Lot {k}', 1, tags=[f'g{k}-{i}' for i in range(10)]) for k in range(20)]))
    write('tpl.json', project([task('A', 'Alpha', 3, res='Alice')], resources=[{'name': 'Alice', 'absences': [{'start': '2026-01-12', 'end': '2026-01-13', 'label': 'Congé'}]}]))
    write('big1000.json', big_project(1000))
    write('big50.json', big_project(50))

    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-sandbox'])
        ctx = browser.new_context(viewport={'width': 1500, 'height': 950}, locale='fr-FR', accept_downloads=True)
        pg = ctx.new_page()
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        pg.clock.set_fixed_time('2026-01-14T10:00:00')
        pg.goto(HTML.as_uri())
        pg.wait_for_selector('#task-rows tr')

        def axe(label):
            if not AXE.exists():
                check(f'axe : {label} (axe-core absent, ignoré)', True)
                return
            if not pg.evaluate('!!window.axe'):
                pg.evaluate(AXE.read_text(encoding='utf-8'))
            res = pg.evaluate("""() => axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']}})
                                  .then(r => r.violations.map(v => v.id + ' ' + v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')))""")
            check(f'axe : {label} sans violation', not res, res)

        def dlg(button):
            pg.locator('dialog[open]').last.locator(f'button:has-text("{button}")').first.click()
            pg.wait_for_timeout(80)

        def open_project(name):
            pg.set_input_files('#file-input', files[name])
            pg.wait_for_selector('dialog[open]')
            dlg('Remplacer le projet ouvert')
            if pg.query_selector('dialog[open] button:has-text("Remplacer le projet ouvert")'):
                dlg('Remplacer le projet ouvert')
            pg.wait_for_timeout(100)

        ids = lambda: pg.evaluate("[...document.querySelectorAll('#task-rows tr[data-id]')].map(r => r.dataset.id)")
        row = lambda i: pg.inner_text(f'#task-rows tr[data-id="{i}"]')
        unload_warns = lambda: pg.evaluate("() => { const e = new Event('beforeunload', {cancelable: true}); window.dispatchEvent(e); return e.defaultPrevented; }")

        # ── R-24 : identifiants automatiques, renommage répercuté ──────────────────────────────
        for _ in range(26):
            pg.click('button[data-click="addTask"][data-arg="task"]')
        pg.keyboard.press('Escape')
        got = ids()
        check('R-24 : 27 tâches nommées A à Z puis AA', got[:26] == [chr(65 + i) for i in range(26)] and got[26] == 'AA', got)
        open_project('r24.json')
        pg.click('button[data-click="openBaselines"]'); pg.click('#bl-win button:has-text("Capturer une baseline")'); dlg('Fermer')
        pg.click('#task-rows button.select:has-text("Bravo")')
        pg.fill('#f-id', 'B2'); pg.click('#editor button[type=submit]')
        check('R-24 : renommer B en B2 met à jour les prédécesseurs de C', 'B2' in pg.inner_text('#task-rows tr[data-id="C"] td:nth-child(4)'), row('C'))
        check('EF-05 : la baseline suit le renommage (barre de baseline de B2)', 'baseline Baseline 1' in (pg.get_attribute('.bar[data-arg="B2"]', 'aria-label') or ''))

        # ── R-25 : renommage, nom en double, suppression chiffrée ──────────────────────────────
        open_project('r25.json')
        pg.click('button[data-click="openResources"]'); pg.wait_for_selector('#res-win')
        inp = pg.locator('#res-win input[aria-label="Nom (Alice)"]')
        inp.fill('Alice M.'); inp.dispatch_event('change')
        dlg('Fermer')
        check('R-25 : les deux tâches restent affectées à « Alice M. »', 'Alice M.' in row('A') and 'Alice M.' in row('B'))
        pg.click('button[data-click="openResources"]'); pg.wait_for_selector('#res-win')
        pg.click('#res-win button:has-text("Ajouter la ressource")')
        last = pg.locator('#res-win tbody tr:last-child input[type=text]').first
        last.fill('alice m.'); last.dispatch_event('change')
        check('R-25 : « alice m. » refusé (nom déjà pris, casse ignorée)', 'déjà pris' in pg.inner_text('#res-win'), pg.inner_text('#res-win'))
        pg.click('#res-win button:has-text("Supprimer Alice M.")')
        txt = pg.locator('dialog[open]').last.inner_text()
        check('R-25 : la confirmation dit « 2 tâches deviendront sans ressource »', '2 tâches deviendront sans ressource' in txt, txt)
        dlg('Annuler'); dlg('Fermer')

        # ── R-30 : avertissement de fermeture seulement après une modification de données ────
        open_project('r31.json')
        pg.click('#task-rows button.select:has-text("Alpha")'); pg.keyboard.press('Escape')
        pg.click('button[aria-label="Zoom avant"]'); pg.click('#btn-theme'); pg.click('#btn-theme'); pg.click('#btn-theme')
        check('R-30 : sélectionner, zoomer, changer de thème : aucun avertissement', unload_warns() is False)
        pg.click('#task-rows button.select:has-text("Alpha")'); pg.fill('#f-name', 'Alpha modifiée'); pg.click('#editor button[type=submit]')
        check('R-30 : après une modification : avertissement', unload_warns() is True)
        pg.click('button[data-click="exportFile"]'); pg.check('#exp-f-json')
        with pg.expect_download():
            dlg('Exporter')
        check('R-30 : après export : plus d\'avertissement', unload_warns() is False)
        pg.click('button[aria-label="Zoom à 100 %"]')

        # ── R-31 : supprimer un prédécesseur puis annuler ──────────────────────────────────────
        open_project('r31.json')
        pg.focus('#task-rows button.select:has-text("Alpha")'); pg.keyboard.press('Delete')
        txt = pg.locator('dialog[open]').last.inner_text()
        check('EF-06 : la confirmation nomme la tâche et compte les liens perdus', 'Alpha' in txt and '1 tâche perdra un prédécesseur' in txt, txt)
        dlg('Supprimer')
        check('R-31 : A supprimée, B sans prédécesseur', 'A' not in ids() and pg.inner_text('#task-rows tr[data-id="B"] td:nth-child(4)') == '')
        pg.click('#btn-undo')
        check('R-31 : « Annuler » rétablit A et la dépendance de B', 'A' in ids() and pg.inner_text('#task-rows tr[data-id="B"] td:nth-child(4)') == 'A')

        # ── R-32 : vue semaine ou mois selon le zoom ──────────────────────────────────────────
        views = []
        for _ in range(4):
            views.append((pg.inner_text('#zoom-level'), pg.locator('.g-col.week').count() > 0))
            pg.click('button[aria-label="Zoom arrière"]')
        check('R-32 : semaines à 100, 80 et 60 %, mois à 40 %', [v[1] for v in views] == [True, True, True, False] and '40' in views[3][0], views)
        pg.click('button[aria-label="Zoom à 100 %"]')

        # ── R-33 : la baseline reste à l'ancienne date ─────────────────────────────────────────
        pg.click('button[data-click="openBaselines"]'); pg.click('#bl-win button:has-text("Capturer une baseline")'); dlg('Fermer')
        left = lambda sel: pg.evaluate(f"parseFloat(document.querySelector('{sel}').style.left)")
        bl0, bar0 = left('.g-row .bl'), left('.bar[data-arg="A"]')
        pg.fill('#project-start', '2026-01-12'); pg.dispatch_event('#project-start', 'change')
        bl1, bar1 = left('.g-row .bl'), left('.bar[data-arg="A"]')
        check('R-33 : vue semaine, la barre avance d\'une semaine, la baseline reste', abs((bar1 - bar0) - (bl1 - bl0) - 26) < 1.5, (bl0, bar0, bl1, bar1))
        for _ in range(3): pg.click('button[aria-label="Zoom arrière"]')
        mv = pg.locator('.g-col.week').count() == 0
        blm, barm = left('.g-row .bl'), left('.bar[data-arg="A"]')
        check('R-33 : vue mois, la baseline reste affichée à l\'ancienne date', mv and pg.locator('.g-row .bl').count() >= 1 and barm > blm, (blm, barm))
        pg.click('button[aria-label="Zoom à 100 %"]')

        # ── R-34 : chaque fenêtre au clavier seul, focus rendu, aucune violation ─────────────
        open_project('conflict.json')
        windows = [('#project-label', 'Projet'), ('button[data-click="openResources"]', 'Ressources'), ('button[data-click="openCategories"]', 'Catégories'),
                   ('button[data-click="openTags"]', 'Étiquettes'), ('button[data-click="openCalendar"]', 'Calendrier'), ('button[data-click="openBaselines"]', 'Baselines'),
                   ('button[data-click="openDashboard"]', 'Tableau de bord'), ('button[data-click="openReport"]', "Rapport d'état"), ('button[data-click="openPrint"]', 'Imprimer'),
                   ('button[data-click="openVersions"]', 'Versions'), ('#btn-resolve', 'Résoudre'), ('button[data-click="exportFile"]', 'Exporter'),
                   ('button[data-click="openLibrary"]', 'Bibliothèque'), ('#btn-settings', 'Réglages'), ('#btn-help', 'Aide'), ('button[data-click="tabPlus"]', 'Ouvrir un projet')]
        for sel, label in windows:
            pg.focus(sel); pg.keyboard.press('Enter')
            pg.wait_for_selector('dialog[open]', timeout=3000)
            named = pg.evaluate("() => { const d = [...document.querySelectorAll('dialog[open]')].pop(); const h = document.getElementById(d.getAttribute('aria-labelledby')); return !!h && h.textContent.length > 0 && d.contains(document.activeElement); }")
            axe(f'fenêtre « {label} » ouverte au clavier')
            pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
            back = pg.evaluate(f"document.activeElement === document.querySelector('{sel}')")
            check(f'R-34 : « {label} » : dialogue titré, focus dedans, Échap ferme et rend le focus', named and back and pg.locator('dialog[open]').count() == 0)
        pg.focus('button[data-click="addTask"][data-arg="task"]'); pg.keyboard.press('Enter')
        pg.wait_for_selector('#editor:not([hidden])'); pg.keyboard.type('Ajout au clavier'); pg.keyboard.press('Enter')
        check('R-34 : ajout et enregistrement d\'une tâche au clavier seul', 'Ajout au clavier' in pg.inner_text('#task-rows'))

        # ── R-42 : hiérarchie limitée à 5 niveaux ; repli sans perte de calcul ───────────────
        open_project('r42.json')
        pg.click('#task-rows button.select:has-text("Phase")')
        pg.select_option('#f-parent', 'S4'); pg.click('#editor button[type=submit]')
        check('R-42 : sixième niveau refusé avec un message', 'limitée à 5 niveaux' in pg.inner_text('#f-parent-err'), pg.inner_text('#editor'))
        pg.keyboard.press('Escape')
        lbl0 = pg.get_attribute('.sbar[data-arg="P"]', 'aria-label')
        pg.click('#task-rows button.toggle[data-arg="P"]')
        check('R-42 : P repliée masque C1 et C2 et garde ses dates et son avancement',
              'C1' not in ids() and 'C2' not in ids() and pg.get_attribute('.sbar[data-arg="P"]', 'aria-label') == lbl0 and '50 %' in lbl0 and '16 janv.' in lbl0, lbl0)
        check('EF-61 : replier ne compte pas comme une modification', unload_warns() is False)
        pg.click('#task-rows button.toggle[data-arg="P"]')

        # ── Mettre en retrait / remonter une tâche seule depuis son édition (EF-60, 4.2) ─────
        pg.click('#task-rows button.select:has-text("Phase")'); pg.keyboard.press('Escape')
        pg.click('#task-rows button.select:has-text("Etude")')
        pg.fill('#f-name', 'Etude renommée')
        pg.click('#btn-outdent')
        check('EF-60 : « Remonter d\'un niveau » depuis l\'édition', pg.input_value('#f-parent') == '' and pg.input_value('#f-name') == 'Etude renommée', pg.input_value('#f-parent'))
        pg.click('#editor button[type=submit]')
        check('EF-60 : la saisie en cours est gardée et le niveau aussi', 'Etude renommée' in row('C1') and pg.evaluate("document.querySelector('#task-rows tr[data-id=\"C1\"] td.name').style.getPropertyValue('--depth')") == '0')
        pg.click('#btn-undo'); pg.click('#btn-undo')

        # ── R-54 : sélection par Maj + clic, modification en masse, copier-coller ────────────
        open_project('r54.json')
        pg.click('#task-rows button.select:has-text("Alpha")'); pg.keyboard.press('Escape')
        pg.click('#task-rows button.select:has-text("Charlie")', modifiers=['Shift'])
        check('R-54 : Maj + clic sélectionne trois tâches', '3 tâches sélectionnées' in pg.inner_text('#selbar'), pg.inner_text('#selbar'))
        pg.click('#selbar button:has-text("Modifier en masse")'); pg.select_option('#bk-cat', label='Dev'); dlg('Appliquer')
        cats = pg.evaluate("[...document.querySelectorAll('#task-rows tr[data-id]')].map(r => r.dataset.id)")
        pg.click('#task-rows button.select:has-text("Alpha")'); dev_a = pg.eval_on_selector('#f-cat', 'e => e.selectedOptions[0].textContent'); pg.keyboard.press('Escape')
        pg.click('#task-rows button.select:has-text("Delta")'); dev_d = pg.eval_on_selector('#f-cat', 'e => e.selectedOptions[0].textContent'); pg.keyboard.press('Escape')
        check('R-54 : catégorie changée sur les trois, pas sur les autres', dev_a == 'Dev' and dev_d == 'Etudes', (dev_a, dev_d))
        pg.click('#btn-undo')
        pg.click('#task-rows button.select:has-text("Charlie")'); back_c = pg.eval_on_selector('#f-cat', 'e => e.selectedOptions[0].textContent'); pg.keyboard.press('Escape')
        check('R-54 : un seul « Annuler » revient sur les trois', back_c == 'Etudes', back_c)
        pg.click('#task-rows button.select:has-text("Alpha")'); pg.keyboard.press('Escape')
        pg.click('#task-rows button.select:has-text("Charlie")', modifiers=['Shift'])
        tsv = pg.evaluate("""() => { const dt = new DataTransfer(); document.dispatchEvent(new ClipboardEvent('copy', {clipboardData: dt, bubbles: true})); return dt.getData('text/plain'); }""")
        pg.evaluate("""(t) => { const dt = new DataTransfer(); dt.setData('text/plain', t); document.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true})); }""", tsv)
        got = ids()
        check('R-54 : trois nouvelles tâches collées avec des identifiants libres', len(got) == 8 and len(set(got)) == 8 and pg.inner_text('#task-rows').count('Alpha') == 2, got)

        # ── R-55 : trois gestes, trois pas d'annulation ; boucle refusée ──────────────────────
        open_project('r55.json')
        for _ in range(10): pg.click('button[aria-label="Zoom avant"]')
        day = pg.evaluate("26 * 3 / 7")
        bar = pg.locator('.bar[data-arg="A"]').bounding_box()
        pg.mouse.move(bar['x'] + 15, bar['y'] + bar['height'] / 2); pg.mouse.down()
        pg.mouse.move(bar['x'] + 15 + 2 * day, bar['y'] + bar['height'] / 2, steps=8); pg.mouse.up()
        pg.click('#task-rows button.select:has-text("Alpha")'); forced = pg.input_value('#f-forcedStart'); pg.keyboard.press('Escape')
        check('R-55 : glisser A de deux jours : date imposée au 07/01', forced == '2026-01-07', forced)
        bar = pg.locator('.bar[data-arg="A"]').bounding_box()
        pg.mouse.move(bar['x'] + bar['width'] - 2, bar['y'] + 8); pg.mouse.down()
        pg.mouse.move(bar['x'] + bar['width'] - 2 + day, bar['y'] + 8, steps=6); pg.mouse.up()
        check('R-55 : tirer le bord droit d\'un jour : 6 jours', '6 j' in row('A'), row('A'))
        pg.hover('.bar[data-arg="A"]')
        src = pg.locator('.bar[data-arg="A"] .lk-e').bounding_box()
        pg.mouse.move(src['x'] + 4, src['y'] + 4); pg.mouse.down(); pg.mouse.move(src['x'] + 30, src['y'] + 30, steps=4)
        dst = pg.locator('.bar[data-arg="B"] .lk-s').bounding_box()
        pg.mouse.move(dst['x'] + 4, dst['y'] + 4, steps=6); pg.mouse.up()
        check('R-55 : relier A à B : B après A', pg.inner_text('#task-rows tr[data-id="B"] td:nth-child(4)') == 'A', row('B'))
        pg.hover('.bar[data-arg="B"]')
        s2 = pg.locator('.bar[data-arg="B"] .lk-e').bounding_box()
        pg.mouse.move(s2['x'] + 4, s2['y'] + 4); pg.mouse.down(); pg.mouse.move(s2['x'] + 20, s2['y'] - 20, steps=4)
        d2 = pg.locator('.bar[data-arg="A"] .lk-s').bounding_box()  # poignées de toutes les barres pendant le geste
        pg.mouse.move(d2['x'] + 4, d2['y'] + 4, steps=6); pg.mouse.up()
        check('R-55 : un lien qui créerait une boucle est refusé', 'boucle' in pg.inner_text('#toast') and pg.inner_text('#task-rows tr[data-id="A"] td:nth-child(4)') == '', pg.inner_text('#toast'))
        pg.click('#btn-undo'); s1 = pg.inner_text('#task-rows tr[data-id="B"] td:nth-child(4)')
        pg.click('#btn-undo'); s2_ = row('A')
        pg.click('#btn-undo'); pg.click('#task-rows button.select:has-text("Alpha")'); s3 = pg.input_value('#f-forcedStart'); pg.keyboard.press('Escape')
        check('R-55 : chaque geste s\'annule séparément (lien, durée, date)', s1 == '' and '5 j' in s2_ and s3 == '', (s1, s2_, s3))
        pg.click('button[aria-label="Zoom à 100 %"]')

        # ── Corrections du contrôle de conformité ─────────────────────────────────────────────
        open_project('conflict.json')
        leg = pg.inner_text('#legend')
        check('EF-46 : la légende reprend ressources et statuts', 'Ressources :' in leg and 'Alice' in leg and 'Statuts :' in leg and 'Pas démarré' in leg and 'En conflit (⚠)' in leg, leg)
        check('EF-30 : la barre en conflit porte ⚠ en clair', '⚠' in pg.inner_text('.bar[data-arg="B"] .bar-label'))
        pg.focus('#btn-help'); pg.keyboard.press('Enter'); pg.wait_for_selector('#help-win')
        h = pg.inner_text('#help-win')
        check('EF-58 : l\'aide décrit Alt + Maj + flèches (durée) et « / »', 'Alt + Maj' in h and 'Durée diminuée ou allongée' in h and "Aller au champ de recherche" in h)
        pg.click('#help-win details summary')
        check('EX-20 : l\'avis de licence des polices est reproduit dans l\'aide', 'SIL OPEN FONT LICENSE' in pg.inner_text('#help-win') and 'Fira Code Project Authors' in pg.inner_text('#help-win'))
        pg.keyboard.press('Escape')
        z0 = pg.inner_text('#zoom-level'); pg.focus('#btn-help'); pg.keyboard.press('+'); z1 = pg.inner_text('#zoom-level'); pg.keyboard.press('-')
        check('EF-41 : la touche + zoome hors de la grille', z0 != z1 and pg.inner_text('#zoom-level') == z0, (z0, z1))
        pg.select_option('#group-by', 'res')
        pg.click('#task-rows button.select >> nth=0')
        dis = pg.evaluate("['btn-up','btn-down','btn-indent','btn-outdent'].every(id => document.getElementById(id).disabled)")
        check('EF-86 : monter, descendre, retrait indisponibles en vue regroupée', dis)
        pg.keyboard.press('Escape'); pg.select_option('#group-by', '')

        open_project('tags.json')
        pg.click('#task-rows button.select:has-text("Alpha")')
        pg.fill('#f-tags', 'g0-0, nouvelle')
        pg.click('#editor button[type=submit]')
        check('3.7 : une 201e étiquette distincte est refusée à la saisie', '200 étiquettes différentes au plus' in pg.inner_text('#f-tags-err'), pg.inner_text('#editor'))
        pg.keyboard.press('Escape')

        # Modèle personnel : les absences suivent la nouvelle date de début (EF-100)
        open_project('tpl.json')
        pg.click('button[data-click="openLibrary"]'); pg.wait_for_selector('#lib-win')
        pg.click('#lib-tpl')
        if pg.query_selector('dialog[open] button:has-text("J\'ai compris, enregistrer")'):
            dlg("J'ai compris, enregistrer")
        pg.check('#tpl-res'); dlg('Enregistrer le modèle')
        pg.wait_for_timeout(150)
        pg.click('#lib-new'); pg.wait_for_selector('#tpl-pick')
        pg.select_option('#tpl-pick', index=2); pg.fill('#tpl-pname', 'Depuis modèle'); pg.fill('#tpl-start', '2026-03-02')
        dlg('Créer le projet'); pg.wait_for_timeout(150)
        pg.click('button[data-click="openResources"]'); pg.click('#res-win button:has-text("Fiche Alice")')
        sheet = pg.locator('dialog[open]').last.inner_text()
        check('EF-100 : les absences du modèle sont décalées sur le nouveau début', '09 mars 2026' in sheet and '10 mars 2026' in sheet, sheet)
        dlg('Fermer'); dlg('Fermer')
        check('aucune erreur JavaScript pendant la recette', not errors, errors)

        # ── EX-15 et EX-25 : temps de réponse ─────────────────────────────────────────────────
        def edit_time(tid):
            pg.click(f'#task-rows button.select[data-arg="{tid}"]')
            times = []
            for k in range(3):
                pg.fill('#f-dur', str(2 + k))
                times.append(pg.evaluate("() => { const t0 = performance.now(); document.getElementById('edit-form').requestSubmit(); return performance.now() - t0; }"))
                pg.click(f'#task-rows button.select[data-arg="{tid}"]')
            pg.keyboard.press('Escape')
            return statistics.median(times)
        open_project('big50.json')
        t50 = edit_time('T25')
        check(f'EX-15 : 50 tâches, affichage à jour en moins de 100 ms ({t50:.0f} ms)', t50 < 100 * PERF, t50)
        open_project('big1000.json')
        t1000 = edit_time('T500')
        check(f'EX-15 / R-35 : 1 000 tâches, affichage à jour en moins de 500 ms ({t1000:.0f} ms)', t1000 < 500 * PERF, t1000)
        search = pg.evaluate("""() => { const s = document.getElementById('search'); s.value = 'Tâche 77';
            const t0 = performance.now(); s.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true})); return performance.now() - t0; }""")
        check(f'EX-25 : recherche sur 1 000 tâches en moins de 100 ms ({search:.0f} ms)', search < 100 * PERF, search)
        pg.evaluate("() => { const s = document.getElementById('search'); s.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})); }")
        check('EX-25 : Échap vide la recherche (1 000 lignes affichées)', pg.locator('#task-rows tr[data-id]').count() == 1000, pg.locator('#task-rows tr[data-id]').count())
        pg.click('#btn-filters')
        flt = pg.evaluate("""() => { const c = document.querySelector('#filters-panel input[data-arg="status:late"]'); c.checked = true;
            const t0 = performance.now(); c.dispatchEvent(new Event('change', {bubbles: true})); return performance.now() - t0; }""")
        check(f'EX-25 : filtre sur 1 000 tâches en moins de 100 ms ({flt:.0f} ms)', flt < 100 * PERF, flt)
        pg.click('#filters-panel button:has-text("Effacer les filtres")'); pg.click('#btn-filters')
        grp = pg.evaluate("""() => { const s = document.getElementById('group-by'); s.value = 'cat';
            const t0 = performance.now(); s.dispatchEvent(new Event('change', {bubbles: true})); return performance.now() - t0; }""")
        check(f'EX-25 : regroupement de 1 000 tâches en moins de 100 ms ({grp:.0f} ms)', grp < 100 * PERF, grp)
        pg.select_option('#group-by', '')
        pg.click('button[data-click="exportFile"]'); pg.check('#exp-f-xlsx')
        t0 = pg.evaluate('performance.now()')
        with pg.expect_download():
            dlg('Exporter')
        tx = pg.evaluate('performance.now()') - t0
        check(f'EX-25 : export Excel de 1 000 tâches en moins de 3 s ({tx:.0f} ms)', tx < 3000 * PERF, tx)

        # ── EX-04 : 360 px de large et zoom de 200 % (640 px CSS), sans défilement horizontal ───
        for width in (360, 640):
            c2 = browser.new_context(viewport={'width': width, 'height': 800}, locale='fr-FR')
            p2 = c2.new_page(); p2.clock.set_fixed_time('2026-01-14T10:00:00')
            p2.goto(HTML.as_uri()); p2.wait_for_selector('#task-rows tr')
            over = p2.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            check(f'EX-04 : {width} px de large, aucun défilement horizontal de la page', over <= 1, over)
            p2.click('#task-rows button.select >> nth=0')
            ed = p2.evaluate("(() => { const r = document.getElementById('editor').getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; })()")
            check(f'EX-04 : {width} px, édition entièrement visible', ed)
            c2.close()

        # ── Limite de la bibliothèque (3.7, EF-99) ─────────────────────────────────────────────
        c3 = browser.new_context(viewport={'width': 1500, 'height': 950}, locale='fr-FR')
        c3.add_init_script("""(() => { if (localStorage.getItem('ganttpro.lib.index')) return; const idx = [];
            for (let i = 0; i < 50; i++) { const k = 'k' + i; localStorage.setItem('ganttpro.lib.' + k, '{"format":3,"tasks":[]}');
              idx.push({key: k, kind: 'project', name: 'Projet ' + i, emoji: '📁', date: 0, tasks: 0}); }
            localStorage.setItem('ganttpro.lib.index', JSON.stringify(idx)); localStorage.setItem('ganttpro.settings.noticed', 'yes'); })()""")
        p3 = c3.new_page(); p3.goto(HTML.as_uri()); p3.wait_for_selector('#task-rows tr')
        p3.keyboard.press('Control+s'); p3.wait_for_selector('dialog[open]')
        p3.locator('dialog[open]').last.locator('button:has-text("Enregistrer")').first.click(); p3.wait_for_timeout(200)
        msg = p3.locator('dialog[open]').last.inner_text() if p3.locator('dialog[open]').count() else ''
        check('3.7 : au-delà de 50 entrées, la bibliothèque refuse et le dit', 'bibliothèque est pleine' in msg, msg)
        c3.close()
        browser.close()

    ok = sum(1 for _, r in results if r)
    print(f'\n{ok}/{len(results)} vérifications réussies.')
    raise SystemExit(0 if ok == len(results) else 1)


if __name__ == '__main__':
    main()
