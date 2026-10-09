#!/usr/bin/env python3
"""Tests de bout en bout de GanttPro : Chromium headless, CSP réellement appliquée.

    pip install playwright && python3 -m playwright install chromium
    npm install --no-save axe-core          # optionnel : audit d'accessibilité
    python3 tests/test_gantt.py

Couvre : import JSON malveillant (XSS), efficacité de la CSP, parcours fonctionnel
complet (clic et clavier), export/réimport, accessibilité (axe-core, WCAG 2.1 AA).
"""
import json, os, sys, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
HTML = Path(os.environ.get('GANTT_HTML', ROOT / 'GanttPro.html'))
AXE = Path(os.environ.get('AXE_JS', ROOT / 'node_modules' / 'axe-core' / 'axe.min.js'))

results = []
def check(name, ok, extra=''):
    results.append((name, bool(ok)))
    print(('OK    ' if ok else 'ECHEC '), name, extra if not ok else '')

def push(n):  # charge utile : enregistre n dans window.__xss si le code est exécuté
    return f"<img src=x onerror=(window.__xss=window.__xss||[]).push({n})>"

def evil_project(first_id='A'):
    return {
        "name": push(1), "desc": "<svg onload=(window.__xss=window.__xss||[]).push(2)>", "emoji": "<b>x",
        "color": 'red" onmouseover="window.__xss=3', "projectStart": "2026-10-01",
        "tasks": [
            {"id": first_id, "name": push(4), "dur": 5, "deps": [], "cat": push(5), "res": push(6), "pct": 50},
            {"id": "B", "name": "Tache normale", "dur": 3, "deps": [first_id], "cat": "Cat1", "res": "R1", "pct": 0},
        ],
        "resources": [{"id": "r1", "name": push(7), "role": '"><img src=x onerror=(window.__xss=window.__xss||[]).push(8)>', "color": '#fff" onmouseover="window.__xss=9'}],
        "categories": [{"id": "c1", "name": push(10), "color": "#4d9fff"}],
        "baselines": [{"id": "bl');(window.__xss=window.__xss||[]).push(11);//", "name": push(12), "color": "x", "createdAt": 1, "shownOnScurve": True, "shownOnGantt": True, "tasks": []}],
    }

def main():
    tmp = Path(tempfile.mkdtemp())
    evil = tmp / 'evil.json'; evil.write_text(json.dumps(evil_project()))
    badid = tmp / 'badid.json'; badid.write_text(json.dumps(evil_project("');alert(1);//")))
    huge = tmp / 'huge.json'; huge.write_text('{"tasks":[],"pad":"' + 'x' * (5 * 1024 * 1024 + 10) + '"}')

    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox'])
        ctx = b.new_context(viewport={'width': 1600, 'height': 900}, accept_downloads=True)
        pg = ctx.new_page()
        errors, csp, dialogs = [], [], []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: csp.append(m.text) if ('Content Security Policy' in m.text or 'Refused' in m.text)
              else (errors.append(m.text) if m.type == 'error' else None))
        def on_dialog(d):
            dialogs.append((d.type, d.message)); d.accept('v-test' if d.type == 'prompt' else None)
        pg.on('dialog', on_dialog)
        pg.goto(HTML.as_uri()); pg.wait_for_timeout(500)

        # ── chargement ───────────────────────────────────────────────────────────────
        check('aucune erreur au chargement', not errors and not csp, (errors, csp))
        fonts = pg.evaluate("Promise.all([document.fonts.load('600 14px Sora'),document.fonts.load(\"400 12px 'Fira Code'\")]).then(()=>[document.fonts.check('600 14px Sora'),document.fonts.check(\"400 12px 'Fira Code'\")])")
        check('polices intégrées chargées (aucun appel réseau)', fonts == [True, True])
        check("panneau d'édition masqué au démarrage", not pg.is_visible('#edit-panel'))

        # ── sécurité : CSP ────────────────────────────────────────────────────────────
        pg.evaluate("document.body.insertAdjacentHTML('beforeend','<img id=\"csp-probe\" src=x onerror=\"window.__csp1=1\">');"
                    "const s=document.createElement('script'); s.textContent='window.__csp2=1'; document.body.appendChild(s);")
        pg.wait_for_timeout(300)
        check('CSP : un handler inline injecté est bloqué', not pg.evaluate('!!window.__csp1'))
        check('CSP : un script injecté est bloqué', not pg.evaluate('!!window.__csp2'))
        check('CSP : aucune requête réseau possible', pg.evaluate("fetch('https://example.com').then(()=>'sortie').catch(()=>'bloquee')") == 'bloquee')
        pg.evaluate("document.getElementById('csp-probe').remove()"); csp.clear()

        # ── sécurité : import JSON malveillant ───────────────────────────────────────────
        pg.click('text=Importer'); pg.set_input_files('#import-file-input', str(badid)); pg.wait_for_timeout(300)
        check("import refusé si un identifiant est dangereux", any('Identifiant invalide' in m for t, m in dialogs) and not pg.is_visible('#import-confirm-btn'))
        dialogs.clear()
        pg.set_input_files('#import-file-input', str(huge)); pg.wait_for_timeout(300)
        check('import refusé au-delà de 5 Mo', any('trop volumineux' in m for t, m in dialogs)); dialogs.clear()
        pg.set_input_files('#import-file-input', str(evil)); pg.wait_for_timeout(300)
        check("aperçu d'import : aucune exécution de code", not pg.evaluate('window.__xss'))
        pg.click('#import-confirm-btn'); pg.wait_for_timeout(500)
        for fn in ('openDash()', 'closeDash()', 'openResModal()', 'closeResModal()', 'openCatModal()', 'closeCatModal()',
                   'openBaselineModal()', 'closeBaselineModal()', 'openVerModal()', 'closeVerModal()'):
            pg.evaluate(fn); pg.wait_for_timeout(120)
        pg.evaluate("document.querySelector('.task-card')?.click()")
        if pg.query_selector('.bar'): pg.hover('.bar')
        pg.wait_for_timeout(300)
        check('import + rendu de tous les écrans : aucune exécution de code', not pg.evaluate('window.__xss'), pg.evaluate('window.__xss'))
        check('import : aucun élément injecté dans le DOM', pg.evaluate("document.querySelectorAll('img[src=\"x\"],svg[onload],[onerror],[onmouseover]').length") == 0)
        check("import : le texte malveillant reste affiché comme du texte", '<img' in pg.inner_text('#task-list'))
        check('import : couleurs invalides remplacées', pg.evaluate("resources.every(r=>/^#[0-9a-f]{6}$/.test(r.color)) && /^#[0-9a-f]{6}$/.test(currentProject.color)"))
        pg.evaluate("location.reload()"); pg.wait_for_timeout(500)

        # ── parcours fonctionnel (clic + clavier) ─────────────────────────────────────────────
        pg.click('text=Ajouter tâche'); pg.wait_for_timeout(150)
        check('modale : role=dialog, focus à l’intérieur', pg.evaluate("(()=>{const m=document.querySelector('#overlay .modal');return m.getAttribute('role')==='dialog'&&m.contains(document.activeElement)})()"))
        pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
        check('Échap ferme la modale et rend le focus', not pg.evaluate("document.getElementById('overlay').classList.contains('open')") and pg.evaluate("document.activeElement.textContent.includes('Ajouter tâche')"))
        pg.click('text=Ajouter tâche')
        pg.fill('#n-id', 'b'); pg.fill('#n-name', 'Tâche <b>B</b>'); pg.fill('#n-dur', '4'); pg.fill('#n-dep', 'A')
        pg.click('#overlay [data-click="addTask"]'); pg.wait_for_timeout(200)
        check('ajout de tâche (identifiant en majuscules, nom échappé)', pg.evaluate("tasks.map(t=>t.id).join()") == 'A,B' and pg.evaluate("document.querySelectorAll('#tbody b').length") == 0)
        pg.click('text=Ajouter tâche'); pg.fill('#n-id', "x');alert(1);//"); pg.click('#overlay [data-click="addTask"]'); pg.wait_for_timeout(100)
        check('identifiant dangereux refusé à la saisie', any('ID invalide' in m for t, m in dialogs) and pg.evaluate('tasks.length') == 2)
        pg.keyboard.press('Escape')
        pg.click('#tbody td.fc-id[data-click] >> nth=1'); pg.wait_for_timeout(150)
        check('clic sur une ligne : panneau d’édition', pg.is_visible('#edit-panel') and pg.input_value('#e-id') == 'B')
        pg.click('#edit-panel [data-click="cancelEdit"]')
        pg.focus('#tbody td.fc-id[data-click] >> nth=0'); pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
        check('Entrée au clavier sélectionne la tâche', pg.is_visible('#edit-panel') and pg.input_value('#e-id') == 'A')
        pg.fill('#e-name', 'Alpha'); pg.fill('#e-dur', '6'); pg.click('#edit-panel [data-click="saveEdit"]'); pg.wait_for_timeout(200)
        check('enregistrement de la modification', pg.evaluate("tasks[0].name") == 'Alpha' and pg.evaluate("tasks[0].dur") == 6)

        pg.click('text=Ressources'); pg.wait_for_timeout(150)
        pg.fill('#new-res-name', 'Alice <i>Martin</i>'); pg.fill('#new-res-role', 'Cheffe'); pg.click('#res-overlay [data-click="addResource"]'); pg.wait_for_timeout(150)
        n = pg.evaluate('resources.length')
        check('ressource ajoutée, nom échappé', n >= 2 and pg.evaluate("document.querySelectorAll('#res-list i').length") == 0)
        pg.fill('#res-list .res-name-input >> nth=1', 'Alice M.'); pg.press('#res-list .res-name-input >> nth=1', 'Enter')
        pg.locator('#res-list .res-role-input >> nth=1').fill('Chef'); pg.locator('#res-list .res-role-input >> nth=1').blur(); pg.wait_for_timeout(150)
        check('renommage et rôle de la ressource', pg.evaluate('resources[1].name') == 'Alice M.' and pg.evaluate('resources[1].role') == 'Chef')
        before = pg.evaluate('resources[1].color'); pg.focus('#res-list .res-avatar >> nth=1'); pg.keyboard.press('Enter'); pg.wait_for_timeout(100)
        check('avatar : couleur modifiable au clavier', pg.evaluate('resources[1].color') != before)
        pg.click('#res-list .res-del >> nth=1'); pg.wait_for_timeout(150)
        check('suppression de ressource', pg.evaluate('resources.length') == n - 1)
        pg.keyboard.press('Escape')

        pg.click('text=Catégories'); pg.wait_for_timeout(150)
        pg.fill('#new-cat-name', 'Études'); pg.click('#cat-overlay [data-click="addCategory"]'); pg.wait_for_timeout(150)
        pg.evaluate("const i=document.getElementById('new-cat-color-pick'); i.value='#ff0000'; i.dispatchEvent(new Event('input',{bubbles:true}))")
        check('catégorie ajoutée, couleur choisie prise en compte', pg.evaluate("categories.some(c=>c.name==='Études')") and pg.evaluate('newCatColor') == '#ff0000')
        pg.keyboard.press('Escape')

        pg.click('text=Baselines'); pg.wait_for_timeout(150)
        pg.fill('#bl-new-name', 'B0 – Initiale'); pg.click('#bl-overlay [data-click="captureBaseline"]'); pg.wait_for_timeout(200)
        pg.click('#bl-list label.toggle-sw'); pg.wait_for_timeout(100)
        check('baseline capturée puis masquée', pg.evaluate('baselines.length') == 1 and pg.evaluate('baselines[0].shownOnGantt') is False)
        pg.keyboard.press('Escape')
        pg.click('text=Tableau de bord'); pg.wait_for_timeout(500)
        check('tableau de bord : KPI et lignes', pg.evaluate("document.querySelectorAll('#dash-kpis .kpi').length") == 4 and pg.evaluate("document.querySelectorAll('#dash-tbody tr').length") == 2)
        pg.click('#dash-overlay [data-click="setSCurveScale"][data-arg="month"]'); pg.wait_for_timeout(200); pg.keyboard.press('Escape')

        pg.click('[data-click="zoomIn"]'); z1 = pg.inner_text('#zoom-level'); pg.click('[data-click="zoomReset"]')
        check('zoom', z1 != '100%' and pg.inner_text('#zoom-level') == '100%')
        pg.click('[data-click="toggleSidebar"]')
        check('barre latérale repliée, état exposé (aria-expanded)', pg.evaluate("document.getElementById('sidebar').classList.contains('collapsed')") and pg.get_attribute('#sidebar-toggle-btn', 'aria-expanded') == 'false')
        pg.click('[data-click="toggleSidebar"]')

        with pg.expect_download() as dl:
            pg.click('[data-click="exportProjectJSON"]')
        out = tmp / 'export.json'; dl.value.save_as(str(out))
        data = json.loads(out.read_text())
        check('export JSON valide', len(data['tasks']) == 2 and 'baselines' in data)
        pg.evaluate("tasks.length=0; tasks.push({id:'Z',name:'Z',dur:1,deps:[],cat:'Général',res:'Ressource',pct:0,realStart:null,realEnd:null}); rebuildAll()")
        pg.click('[data-click="openImportModal"]'); pg.set_input_files('#import-file-input', str(out)); pg.wait_for_timeout(300)
        pg.click('#import-confirm-btn'); pg.wait_for_timeout(300)
        check('réimport : projet restauré', pg.evaluate("tasks.map(t=>t.id).join()") == 'A,B')
        pg.click('[data-click="openImportModal"]')
        with pg.expect_file_chooser() as fc:
            pg.click('#import-drop-zone')
        fc.value.set_files(str(out)); pg.wait_for_timeout(200)
        check('zone de dépôt : cliquable, role=button', 'tâche' in pg.inner_text('#import-preview-content') and pg.get_attribute('#import-drop-zone', 'role') == 'button')
        pg.keyboard.press('Escape')

        pg.evaluate('openVerModal()'); pg.click('#ver-overlay [data-click="saveVersion"]'); pg.wait_for_timeout(200)
        ok = pg.evaluate('versions.length') == 1 and 'v-test' in pg.inner_text('#ver-list')
        pg.click('#ver-list [data-click="deleteVersion"]'); pg.wait_for_timeout(100)
        check('versions : enregistrement et suppression', ok and pg.evaluate('versions.length') == 0)
        pg.keyboard.press('Escape')
        pg.focus('#proj-name-tag'); pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
        check('renommage du projet ouvert au clavier', pg.evaluate("document.getElementById('meta-overlay').classList.contains('open')"))
        pg.keyboard.press('Escape')
        check('aucun gestionnaire inline dans le DOM', pg.evaluate("document.querySelectorAll('[onclick],[onchange],[oninput],[onfocus],[onblur],[onload],[onerror]').length") == 0)
        check('aucune erreur JavaScript ni violation CSP pendant le parcours', not errors and not csp, (errors[:3], csp[:3]))

        # ── accessibilité (axe-core) ───────────────────────────────────────────────────────────────
        if AXE.exists():
            pg.evaluate(AXE.read_text(encoding='utf-8'))
            def audit(label):
                bad = pg.evaluate("axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']}}).then(r=>r.violations.map(v=>v.id+' x'+v.nodes.length))")
                check('axe-core : ' + label, not bad, bad)
            audit('vue principale')
            for name, op, cl in [('ajout de tâche', 'openAddModal()', 'closeModal()'), ('ressources', 'openResModal()', 'closeResModal()'),
                                 ('catégories', 'openCatModal()', 'closeCatModal()'), ('baselines', 'openBaselineModal()', 'closeBaselineModal()'),
                                 ('import', 'openImportModal()', 'closeImportModal()'), ('tableau de bord', 'openDash()', 'closeDash()'),
                                 ('versions', 'openVerModal()', 'closeVerModal()')]:
                pg.evaluate(op); pg.wait_for_timeout(250); audit('modale ' + name); pg.evaluate(cl)
            pg.evaluate("selectTask('A')"); audit("panneau d'édition")
        else:
            print("(axe-core absent : audit d'accessibilité ignoré — `npm install --no-save axe-core`)")
        b.close()

    bad = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(bad)}/{len(results)} vérifications réussies")
    return 1 if bad else 0

if __name__ == '__main__':
    sys.exit(main())
