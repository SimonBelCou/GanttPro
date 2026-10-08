# Politique de sécurité

## Signaler une vulnérabilité

Merci de **ne pas ouvrir d'issue publique** pour une faille de sécurité.

Utilisez le signalement privé de GitHub : onglet **Security → Report a vulnerability**
(<https://github.com/SimonBelCou/GanttPro/security/advisories/new>). Indiquez la version
(commit), les étapes de reproduction et l'impact estimé. Vous recevrez un accusé de réception,
puis une correction ou une réponse motivée dans un délai raisonnable.

## Périmètre et modèle de menace

GanttPro est une application **locale** : un seul fichier HTML, sans serveur, sans compte,
sans transmission de données. Le principal vecteur d'attaque est donc un **fichier de projet
JSON malveillant** (reçu par courriel, partagé, etc.) que l'utilisateur importe.

Mesures en place :

| Risque (OWASP 2021) | Mesure |
|---|---|
| A03 – Injection (XSS) | Échappement systématique (`esc()`) de toute donnée insérée dans le HTML, `textContent` pour l'aperçu d'import, aucun gestionnaire d'événement inline |
| A08 – Intégrité des données | Import validé par liste blanche (`sanitizeProject()`) : types, longueurs, identifiants `[A-Z0-9._-]`, couleurs `#rrggbb`, dates ISO, limites (5 Mo, 1000 tâches) |
| A05 – Mauvaise configuration | `Content-Security-Policy` stricte : script autorisé par empreinte SHA-256, `connect-src 'none'` (aucune requête réseau), `default-src 'none'`, `form-action 'none'`, `base-uri 'none'` |
| A06 – Composants vulnérables | Aucune dépendance d'exécution ; polices intégrées au fichier (pas de CDN) ; Dependabot pour les actions CI |
| A09 – Journalisation | Aucune donnée personnelle ni secret écrit dans la console |
| Données personnelles (RGPD) | Aucun cookie, aucun traceur, aucun envoi : voir la section « Vie privée » du README |

Limite connue de la version 2.3 : `style-src 'unsafe-inline'` reste nécessaire (attributs `style` générés).
Il n'autorise pas l'exécution de code.

### Refonte v3 (`src/`, `dist/GanttPro.html`)

- CSP sans aucun `'unsafe-inline'` : script et feuille de style autorisés par empreinte SHA-256 ; les styles
  calculés passent par le CSSOM. Un attribut `style=` ou `onclick=` injecté est bloqué (testé).
- DOM construit sans `innerHTML` : tout texte venant d'un fichier est inséré par `textContent`.
- Import reconstruit champ par champ (liste blanche), y compris les versions imbriquées ; pollution de
  prototype sans effet ; dates bornées à 1970-2199 pour qu'un fichier ne puisse pas bloquer l'onglet.
- Stockage local limité aux réglages (langue, thème), lus avec validation ; aucun projet ni nom stocké.
- Le build refuse les motifs dangereux (`eval`, gestionnaires inline, appels réseau, journalisation).
- Sans objet pour une application locale sans serveur ni compte : contrôle d'accès (A01), authentification
  (A07), SSRF (A10), journalisation centralisée (A09) ; aucune donnée ne quitte le poste.

## Bonnes pratiques de développement

- Après toute modification du JavaScript : `python3 tools/update-csp.py` (la CI échoue sinon).
- Ne jamais réintroduire d'attribut `onclick=`/`onchange=`… : utiliser `data-click` / `data-change` / `data-input`
  et déclarer l'action dans la table `ACTIONS`.
- Toute donnée issue d'un fichier, du stockage ou d'un champ de saisie passe par `esc()` avant
  `innerHTML`, et par `safeColor()` avant d'entrer dans un attribut `style`.
- Lancer `python3 tests/test_gantt.py` (import malveillant, CSP, parcours complet, accessibilité).
- Détection de secrets dans la CI (gitleaks).
