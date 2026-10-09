#!/usr/bin/env python3
"""Met à jour la Content-Security-Policy de GanttPro.html.

GanttPro est un fichier unique : son JavaScript est en ligne. La CSP autorise donc
uniquement ce script précis, via son empreinte SHA-256 (pas de 'unsafe-inline' pour les scripts).
Toute modification du JavaScript change l'empreinte : relancer ce script après chaque édition.

    python3 tools/update-csp.py            # met à jour GanttPro.html
    python3 tools/update-csp.py --check    # échoue si la CSP est périmée (utilisé en CI)
"""
import base64, hashlib, re, sys
from pathlib import Path

HTML = Path(__file__).resolve().parent.parent / 'GanttPro.html'

def build_csp(script_hash: str) -> str:
    return "; ".join([
        "default-src 'none'",
        f"script-src 'sha256-{script_hash}'",
        "style-src 'unsafe-inline'",     # styles en ligne (attributs style) : risque faible, pas d'exécution de code
        "font-src data:",                # polices intégrées au fichier
        "img-src data: blob:",
        "connect-src 'none'",            # aucune requête réseau possible (fetch, XHR, WebSocket)
        "form-action 'none'",
        "base-uri 'none'",
        "object-src 'none'",
    ])

def main() -> int:
    check = '--check' in sys.argv[1:]
    text = HTML.read_text(encoding='utf-8')
    scripts = re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>', text, re.S)
    if len(scripts) != 1:
        print(f"Erreur : un seul <script> en ligne est attendu, {len(scripts)} trouvé(s).")
        return 2
    if re.search(r'<script[^>]+src=', text):
        print("Erreur : aucun script externe n'est autorisé.")
        return 2
    digest = base64.b64encode(hashlib.sha256(scripts[0].encode('utf-8')).digest()).decode()
    tag = f'<meta http-equiv="Content-Security-Policy" content="{build_csp(digest)}">'
    pattern = r'<!--CSP-->|<meta http-equiv="Content-Security-Policy" content="[^"]*">'
    if not re.search(pattern, text):
        print("Erreur : emplacement de la CSP introuvable dans <head>.")
        return 2
    new = re.sub(pattern, lambda _: tag, text, count=1)
    if check:
        if new != text:
            print("CSP périmée : lancez « python3 tools/update-csp.py » puis recommitez.")
            return 1
        print("CSP à jour.")
        return 0
    HTML.write_text(new, encoding='utf-8')
    print(f"CSP mise à jour (script-src sha256-{digest[:12]}…).")
    return 0

if __name__ == '__main__':
    sys.exit(main())
