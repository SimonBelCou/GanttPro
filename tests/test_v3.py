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
    write('level.json', project(tasks=[
        {'id': 'A', 'name': 'Conception', 'dur': 3, 'res': 'Alice'}, {'id': 'B', 'name': 'Revue', 'dur': 2, 'res': 'Alice'}]))

    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-sandbox'])
        ctx = browser.new_context(viewport={'width': 1500, 'height': 950}, locale='fr-FR', accept_downloads=True)
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
        check('projet initial : tâche A de 10 jours', pg.inner_text('#task-rows tr[data-id="A"]').count('10 j') == 1)
        axe_check(pg, 'vue principale')

        def import_file(name):
            pg.set_input_files('#file-input', files[name])
            pg.wait_for_selector('dialog[open]')

        def dialog_text():
            return pg.inner_text('dialog[open]')

        def close_dialog(button='Annuler'):
            pg.click(f'dialog[open] button:has-text("{button}")')
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
        check('import malveillant : aucune balise injectée', pg.evaluate("document.querySelectorAll('img, svg').length") == 0)

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
        pg.click('#rsv-win section:has-text("Pour tout le projet") button')
        check('nivellement rétabli : plus de conflit', pg.input_value('#leveling-mode') == 'level' and pg.is_hidden('#btn-alerts'))
        close_dialog('Fermer')
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
