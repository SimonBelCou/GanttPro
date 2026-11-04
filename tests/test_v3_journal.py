#!/usr/bin/env python3
"""Tests de bout en bout du journal local d'erreurs (EF-151, RG-59 à RG-63, scénarios R-101 à R-103).

    python3 tools/build.py && python3 tests/test_v3_journal.py

Couvre : journal tenu en mémoire et aucune clé de journal sur l'appareil tant que l'option est désactivée (J1),
import d'un fichier piégé refusé sans nom dans le journal, exception imprévue et promesse rejetée (bandeau, au plus un
toutes les 10 s, sans pile), fenêtre « Journal d'erreurs » (axe-core), export .jsonl (J3), conservation activée puis
désactivée, journal stocké corrompu ou hostile (remis à zéro, lignes filtrées, purge à 30 jours), stockage plein sans
récursion, « Effacer le journal » et « Effacer toutes les données ».
Données fictives uniquement : « Camille Exemple » est un nom inventé (CLAUDE.md §3).
"""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_v3 import HTML, axe_check, check, results  # noqa: E402

FX = Path(__file__).resolve().parent / 'fixtures'
NOW = '2026-11-03T10:00:00'
LOG_KEY = 'ganttpro.log.journal'


def line(ts, **over):
    return {'ts': ts, 'lvl': 'WARN', 'act': 'import', 'code': 'imp.unreadable', 'cmp': 'files', 'res': 'refused', 'sid': '0a1b2c3d', 'ver': '3.0.0', **over}


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-sandbox'])
        page_errors = []

        def page(init=None):
            # Un contexte neuf par page : le stockage d'une page précédente ne fausse pas la suivante.
            pg = browser.new_context(viewport={'width': 1500, 'height': 950}, locale='fr-FR', accept_downloads=True).new_page()
            pg.on('pageerror', lambda e: page_errors.append(str(e)))
            if init:
                pg.add_init_script(init)
            pg.clock.set_fixed_time(NOW)
            pg.goto(HTML.as_uri())
            pg.wait_for_selector('#task-rows tr')
            return pg

        def settings(pg):
            pg.click('#btn-settings')
            pg.wait_for_selector('#set-win')

        def close_all(pg):
            while pg.locator('dialog[open]').count():
                pg.keyboard.press('Escape')
                pg.wait_for_timeout(80)

        def throw_in_page(pg, expr):
            # Exception levée dans un gestionnaire d'événement : le navigateur la signale par l'événement « error » de
            # window, comme une vraie erreur du programme (un minuteur ne convient pas : l'horloge simulée l'intercepte).
            pg.evaluate("() => { const f = () => { throw " + expr + "; }; document.body.addEventListener('journal-test', f, { once: true });"
                        " document.body.dispatchEvent(new Event('journal-test')); }")

        def count(pg):
            return pg.inner_text('#set-log-count')

        def stored_log(pg):
            return pg.evaluate(f"localStorage.getItem('{LOG_KEY}')")

        def table(pg):
            return pg.inner_text('#log-table')

        # ── J1 : option désactivée par défaut, journal en mémoire seulement ────────────────────
        pg = page()
        settings(pg)
        check('Réglages : section « Journal d\'erreurs », case décochée, journal vide',
              "Journal d'erreurs" in pg.inner_text('#set-win') and not pg.is_checked('#set-log') and '0 ligne' in count(pg), count(pg))
        check('Réglages : Exporter et Effacer inactifs quand le journal est vide', pg.is_disabled('#set-log-export') and pg.is_disabled('#set-log-clear'))
        axe_check(pg, "Réglages avec la section Journal d'erreurs")
        close_all(pg)

        # ── Import d'un fichier piégé : refus journalisé par son code, sans nom ──────────────
        pg.set_input_files('#file-input', str(FX / 'journal-import-refuse.json'))
        pg.wait_for_selector('dialog[open]')
        check('fichier piégé refusé (deux ressources du même nom)', 'Deux ressources portent le nom' in pg.inner_text('dialog[open]'))
        close_all(pg)
        check('option désactivée : aucune clé de journal sur l\'appareil', not pg.evaluate("Object.keys(localStorage).some(k => k.startsWith('ganttpro.log.'))"))

        # ── Exception imprévue et promesse rejetée : bandeau non bloquant ─────────────────────
        pg.focus('#btn-settings')
        throw_in_page(pg, "new TypeError('Ressource Camille Exemple\\n    at piege (file:///C:/Users/camille/x.html:1:1)')")
        pg.wait_for_selector('#errlog-banner:not([hidden])')
        text = pg.inner_text('#errlog-banner')
        check('bandeau : « Erreur inattendue (réf. …). Exportez votre projet. »', 'Erreur inattendue (réf. ' in text and 'Exportez votre projet' in text, text)
        check('bandeau : ni message ni pile à l\'écran', 'Camille' not in text and 'at ' not in text and 'file:' not in text, text)
        check('bandeau : rôle alert et bouton « Exporter le journal »', pg.get_attribute('#errlog-banner', 'role') == 'alert' and pg.is_visible('#errlog-export'))
        axe_check(pg, "bandeau d'erreur inattendue")
        pg.evaluate("void Promise.reject(new RangeError('Camille Exemple'))")
        pg.wait_for_timeout(150)
        check('deuxième erreur en moins de 10 s : pas de nouveau bandeau (même référence)', pg.inner_text('#errlog-banner') == text)
        pg.click('#errlog-close')
        check('bandeau fermé par « Fermer le message »', pg.is_hidden('#errlog-banner'))
        check('bandeau fermé : le focus revient où il était (RGAA 12.8)', pg.evaluate("document.activeElement && document.activeElement.id") == 'btn-settings')

        # ── Fenêtre « Journal d'erreurs » ───────────────────────────────────────────────────
        settings(pg)
        check('trois lignes dans le journal', '3 lignes' in count(pg), count(pg))
        pg.click('#set-log-view')
        pg.wait_for_selector('#log-table')
        t = table(pg)
        check('tableau : codes imp.dupResource et app.unexpected', 'imp.dupResource' in t and t.count('app.unexpected') == 2, t)
        check('tableau : niveaux, types et origine « fonction:ligne »', 'ERROR' in t and 'WARN' in t, t)
        check('tableau : aucun nom, message ni chemin', all(x not in t for x in ('Camille', 'Users', 'file:', 'piege')), t)
        check('tableau : la plus récente en premier', pg.locator('#log-table tbody tr').count() == 3)
        axe_check(pg, "fenêtre Journal d'erreurs")

        # ── Export .jsonl (J3) ──────────────────────────────────────────────────────────────
        with pg.expect_download() as dl:
            pg.locator('dialog[open]').last.locator('button:has-text("Exporter le journal")').click()
        name = dl.value.suggested_filename
        rows = [json.loads(r) for r in Path(dl.value.path()).read_text(encoding='utf-8').splitlines()]
        check('export : ganttpro_journal_20261103.jsonl', name == 'ganttpro_journal_20261103.jsonl', name)
        check('export : en-tête version et langue, rien sur le navigateur', set(rows[0]) == {'app', 'ver', 'lang', 'exported', 'lines'} and rows[0]['lang'] == 'fr', rows[0])
        check('export : trois lignes, champs de la liste fermée', len(rows) == 4 and all(set(r) <= {'ts', 'lvl', 'act', 'code', 'cmp', 'res', 'sid', 'ver', 'err', 'at'} for r in rows[1:]), rows)
        check('export : identifiant de corrélation commun à la session', len({r['sid'] for r in rows[1:]}) == 1)
        check('export : aucun nom ni chemin', all(x not in json.dumps(rows) for x in ('Camille', 'Users', 'file:')))
        check('export : type de l\'erreur imprévue gardé (TypeError, RangeError)', {r.get('err') for r in rows[1:]} >= {'TypeError', 'RangeError', 'Invalid'}, rows)
        close_all(pg)

        # ── Conservation activée puis désactivée ────────────────────────────────────────────
        settings(pg)
        pg.check('#set-log')
        pg.wait_for_timeout(100)
        saved = json.loads(stored_log(pg) or '[]')
        check('option activée : les lignes de la session sont écrites sur l\'appareil', len(saved) == 3, saved)
        pg.uncheck('#set-log')
        pg.wait_for_timeout(100)
        check('option désactivée : le journal est retiré de l\'appareil', stored_log(pg) is None and '3 lignes' in count(pg))

        # ── Effacer le journal (confirmation) ───────────────────────────────────────────────
        pg.click('#set-log-clear')
        pg.locator('dialog[open]').last.locator('button:has-text("Effacer")').last.click()
        pg.wait_for_timeout(100)
        check('« Effacer le journal » vide le journal', '0 ligne' in count(pg), count(pg))
        close_all(pg)
        pg.close()

        # ── Journal stocké corrompu ou hostile (relecture tolérante, purge) ─────────────────
        for label, raw, expect in (
            ('non JSON', '{pas du json', 0),
            ('très gros', json.dumps([line('2026-11-02T10:00:00.000Z')] * 3000), 0),
            ('lignes hostiles et ancienne', json.dumps([
                line('2026-11-02T10:00:00.000Z'),
                line('2026-11-02T10:00:00.000Z', code='imp.unreadable\n{"lvl":"INFO"}'),
                line('2026-11-02T10:00:00.000Z', at='file:///C:/Users/camille/x.html:1'),
                line('2026-11-02T10:00:00.000Z', extra='Camille Exemple'),
                line('2026-11-02T10:00:00.000Z', code='imp.inconnu'),
                line('2026-10-01T10:00:00.000Z'),
            ]), 1),
        ):
            pg = page(f"if (!window.__seeded) {{ window.__seeded = 1; localStorage.setItem('ganttpro.settings.errlog', 'on'); localStorage.setItem('{LOG_KEY}', {json.dumps(raw)}); }}")
            kept = json.loads(stored_log(pg) or 'null')
            check(f'journal stocké {label} : {expect} ligne(s) gardée(s), réécrit propre', isinstance(kept, list) and len(kept) == expect, kept)
            if label.startswith('lignes'):
                check('ligne purgée à plus de 30 jours, lignes hostiles écartées', 'Camille' not in json.dumps(kept) and kept[0]['ts'] == '2026-11-02T10:00:00.000Z')
            pg.close()

        # ── Stockage plein : pas de récursion, journal en mémoire, store.* journalisé ────────
        pg = page("""if (!window.__seeded) { window.__seeded = 1;
            localStorage.setItem('ganttpro.settings.errlog', 'on'); localStorage.setItem('ganttpro.settings.noticed', 'yes');
            Storage.prototype.setItem = function () { throw new DOMException('plein', 'QuotaExceededError'); }; }""")
        throw_in_page(pg, "new Error('Camille Exemple')")
        pg.wait_for_selector('#errlog-banner:not([hidden])')
        throw_in_page(pg, "new Error('Camille Exemple')")
        pg.click('#errlog-close')
        pg.keyboard.press('Control+s')
        pg.wait_for_selector('dialog[open]')
        check('stockage plein : le message de stockage s\'affiche', "n'est pas disponible" in pg.inner_text('dialog[open]') or 'est plein' in pg.inner_text('dialog[open]'), pg.inner_text('dialog[open]'))
        close_all(pg)
        settings(pg)
        check('stockage plein : 2 lignes en mémoire (erreur identique répétée comptée une fois), aucune ligne sur l\'échec du journal lui-même', '2 lignes' in count(pg), count(pg))
        pg.click('#set-log-view')
        pg.wait_for_selector('#log-table')
        check('stockage plein : échec du stockage journalisé (store.*)', 'store.off' in table(pg) or 'store.full' in table(pg), table(pg))
        close_all(pg)
        pg.close()

        # ── « Effacer toutes les données » efface aussi le journal ──────────────────────────
        pg = page("if (!window.__seeded) { window.__seeded = 1; localStorage.setItem('ganttpro.settings.errlog', 'on'); }")
        throw_in_page(pg, "new Error('x')")
        pg.wait_for_selector('#errlog-banner:not([hidden])')
        check('option active : la ligne est écrite sur l\'appareil', len(json.loads(stored_log(pg) or '[]')) == 1)
        pg.click('#errlog-close')
        settings(pg)
        pg.clock.set_fixed_time('2026-11-03T10:00:15')
        throw_in_page(pg, "new Error('x')")
        pg.wait_for_selector('dialog[open] #errlog-banner:not([hidden])')
        check('fenêtre ouverte : le bandeau est placé dans la fenêtre, donc utilisable (RGAA 12.8)', pg.locator('dialog[open] #errlog-close').is_enabled())
        axe_check(pg, 'bandeau dans une fenêtre ouverte')
        check('erreur identique en moins d\'une minute : pas de nouvelle ligne', len(json.loads(stored_log(pg) or '[]')) == 1)
        pg.click('#errlog-close')
        pg.click('#set-clear')
        pg.locator('dialog[open]').last.locator('button:has-text("Tout effacer")').click()
        pg.wait_for_timeout(150)
        check('« Effacer toutes les données » : journal effacé en mémoire et sur l\'appareil, option désactivée',
              stored_log(pg) is None and '0 ligne' in count(pg) and not pg.is_checked('#set-log'), count(pg))
        close_all(pg)
        pg.close()

        # Les erreurs provoquées volontairement (message « Camille Exemple » ou « x ») sont les seules attendues.
        unexpected = [e for e in page_errors if 'Camille Exemple' not in e and e.strip() not in ('x', 'Error: x')]
        check('aucune autre erreur JavaScript pendant le parcours', not unexpected, unexpected)
        browser.close()

    failed = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} vérifications réussies.")
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
