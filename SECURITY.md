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
malveillant** (reçu par courriel, partagé, etc.) que l'utilisateur importe (projet
GanttPro, classeur Excel, CSV ou XML MS Project), puis les données relues du stockage du navigateur.

Mesures en place :

| Risque (OWASP 2021) | Mesure |
|---|---|
| A03 – Injection (XSS) | DOM construit sans `innerHTML` : tout texte venant d'un fichier ou d'une saisie est inséré par `textContent` ; aucun gestionnaire d'événement inline ; couleurs limitées à `#rgb` / `#rrggbb` |
| A05 – Mauvaise configuration | `Content-Security-Policy` stricte **sans `'unsafe-inline'`** : script et feuille de style autorisés par empreinte SHA-256, `default-src 'none'`, `connect-src 'none'` (aucune requête réseau), `form-action 'none'`, `base-uri 'none'`, `object-src 'none'` |
| A08 – Intégrité des données | Tout fichier, toute version restaurée, tout projet relu du stockage passe par le même contrôle par liste blanche : types, longueurs, identifiants `[A-Z0-9._-]`, dates 1970-2199, boucles de dépendances, limites (5 Mo, 1 000 tâches) ; un fichier invalide est refusé en entier |
| A02 – Données au repos | Chiffrement facultatif par mot de passe (PBKDF2-SHA256 600 000 itérations, AES-256-GCM, Web Crypto) |
| A06 – Composants vulnérables | Aucune dépendance d'exécution ; polices intégrées (pas de CDN) ; Dependabot pour les actions de la CI |
| A09 – Journalisation | Aucune journalisation à ce jour (le build refuse `console.*`) : aucune donnée personnelle ni secret ne peut fuiter par la console. L'absence de journal local est un **écart documenté** au CLAUDE.md §4 (Specs_fonctionnelles.md, annexe C.2, n° 1) ; un journal local d'erreurs pseudonymisé est prévu |
| Données personnelles (RGPD) | Aucun cookie, aucun traceur, aucun envoi ; stockage local seulement à la demande ; effacement complet depuis les réglages ; montants et taux exclus des exports par défaut, taux nominatifs retirés d'un export « sans noms de personnes » |

Détail des mesures :

- CSP sans aucun `'unsafe-inline'` : script et feuille de style autorisés par empreinte SHA-256 ; les styles
  calculés passent par le CSSOM. Un attribut `style=` ou `onclick=` injecté est bloqué (testé).
- DOM construit sans `innerHTML` : tout texte venant d'un fichier est inséré par `textContent`.
- Import reconstruit champ par champ (liste blanche), y compris les versions imbriquées ; pollution de
  prototype sans effet ; dates bornées à 1970-2199 pour qu'un fichier ne puisse pas bloquer l'onglet.
- Stockage local maîtrisé (EX-10, EX-22), concentré dans `src/js/ui/10-storage.js` (vérifié au build) :
  réglages validés par liste blanche ; bibliothèque et modèles uniquement sur geste explicite ; sauvegarde
  automatique **désactivée par défaut**. Un message à la première utilisation explique où vont les données et
  le risque sur un appareil partagé. Tout contenu relu du stockage repasse par le même contrôle qu'un import.
- Chiffrement au repos facultatif (A02) : export, bibliothèque et sauvegarde automatique peuvent être protégés par
  mot de passe (PBKDF2-SHA256 600 000 itérations, AES-256-GCM, Web Crypto). Le mot de passe (12 caractères au
  moins) n'est jamais écrit ; pour la sauvegarde automatique, il reste en mémoire le temps de la session.
- Effacement (RGPD) : « Réglages > Effacer toutes les données » supprime bibliothèque, sauvegardes et réglages ;
  désactiver la sauvegarde automatique supprime ses copies.
- Page d'accueil (8.4) : seules trois clés de la mémoire de session sont lues ; le projet transmis est contrôlé
  comme un import puis supprimé ; l'adresse de retour n'est suivie que si elle est de même origine (http(s)/file).
- Import de classeurs : ZIP borné (200 entrées, 50 Mo décompressés), XML sans DOCTYPE ni entités ; cellules
  commençant par `= + - @` neutralisées à l'export (injection de formules).
- Le build refuse les motifs dangereux (`eval`, gestionnaires inline, appels réseau, journalisation).
- Sans objet pour une application locale sans serveur ni compte : contrôle d'accès (A01), authentification
  (A07), SSRF (A10), journalisation centralisée (A09) ; aucune donnée ne quitte le poste.

## Bonnes pratiques de développement

- Ne jamais modifier `GanttPro.html` à la main : `python3 tools/build.py` l'assemble depuis `src/` et recalcule la
  CSP ; `python3 tools/build.py --check` (CI) refuse un fichier périmé et les constructions dangereuses.
- Construire le DOM avec `h()` / `svg()` (jamais `innerHTML`) ; passer les couleurs par `safeColor()`.
- Ne jamais réintroduire d'attribut `onclick=`/`onchange=`… : utiliser `data-click` / `data-change` / `data-input`
  et déclarer l'action dans la table `ACTIONS`.
- Tout projet importé ou relu passe par `Model.sanitize` / `Model.parseFile`.
- Lancer `node tools/dependances.mjs` après toute modification de code (commentaires de dépendances, contrôlés en CI).
- Lancer les tests (`node --test tests/core/*.test.mjs`, `tests/test_v3.py`, `tests/test_v3_espace.py`,
  `tests/test_v3_recette.py`, `tests/test_v3_budget.py`, `tests/test_v3_recette_manuelle.py`) : import malveillant, CSP réellement appliquée, parcours clavier, accessibilité.
- Détection de secrets dans la CI (gitleaks), détection de secrets et blocage à l'envoi activés sur GitHub.
- Règle d'ensemble sur `main` : pull request et vérification CI `verifier` verte obligatoires ; suppression et envoi forcé
  interdits. **Aucune approbation n'est exigée** (mainteneur unique) : la validation est la recette manuelle du
  propriétaire du produit (voir `PCA.md`, §4).

## Veille et continuité

- Veille sécurité datée à chaque reprise de session : [docs/veille-securite.md](docs/veille-securite.md) (audits des outils,
  avis récents, corrections proposées, ce qui n'a pas pu être vérifié).
- Reprise après incident, codes d'erreur et contacts par rôle : [PCA.md](PCA.md).
- Écarts connus aux règles de développement : Specs_fonctionnelles.md, annexe C.2.

## Versions prises en charge

| Version | Prise en charge |
|---|---|
| Dernière release publiée (3.x à partir de 3.0.0) | ✅ correctifs de sécurité |
| Releases antérieures | ❌ mettre à jour vers la dernière release |

Seule la dernière release de `GanttPro.html` reçoit des correctifs (une version corrective X.Y.Z+1). Chaque release joint
l'empreinte SHA-256 du fichier (`GanttPro.html.sha256`), calculée par la CI après reconstruction et contrôle que le
fichier est identique à celui du dépôt (`.github/workflows/release.yml`) ; l'étiquette n'est posée que par un workflow
déclenché à la main (`.github/workflows/etiquette.yml`). Un fichier d'une version plus récente (format supérieur) est
refusé ; un champ inconnu est ignoré, sans jamais être interprété, et l'utilisateur est prévenu avant de le perdre.
