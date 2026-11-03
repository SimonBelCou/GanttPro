# Plan de continuité d'activité (PCA) de GanttPro

Ce document permet de **présenter** le projet et de le **reprendre après un incident** sans l'historique des
conversations. Il ne contient **aucun secret** ni contact personnel : seulement des rôles et des adresses génériques.
Date de dernière relecture : 2 novembre 2026.

## 1. Description

GanttPro est un éditeur de diagramme de Gantt livré en **un seul fichier HTML** (`GanttPro.html`), ouvert dans un
navigateur. Il sert à planifier des projets (tâches, liens, ressources, charge, baselines, budget et valeur acquise) sans
installation, sans compte, sans serveur et sans connexion. Il est destiné aux chefs de projet et à leurs équipes.
Spécifications : [Specs_fonctionnelles.md](Specs_fonctionnelles.md). Mode d'emploi :
[docs/guide-utilisateur.md](docs/guide-utilisateur.md).

Conséquence pour la continuité : **l'application n'héberge aucune donnée d'utilisateur**. Il n'y a rien à restaurer côté
serveur ; ce qu'il faut protéger, c'est le **code**, les **spécifications** et l'**outillage de livraison**.

## 2. Architecture

Application locale : sources `src/` assemblées par `tools/build.py` en `GanttPro.html`, avec une politique de sécurité du
contenu calculée par empreinte. Résumé et schémas : [Architecture.md](Architecture.md).

## 3. Secrets

| Sujet | Situation |
|---|---|
| Secrets de l'application | **Aucun** : pas de clé API, pas de mot de passe, pas de base de données, pas d'appel réseau. Il n'y a donc pas de `.env` ni de `.env.example`. |
| Intégration continue | Seul le jeton `GITHUB_TOKEN`, fourni et renouvelé automatiquement par GitHub Actions à chaque exécution, droits limités à la lecture (`permissions: contents: read`). |
| Détection | `gitleaks` à chaque pull request (CI) ; détection de secrets et blocage à l'envoi activés sur GitHub. |
| `.gitignore` | `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `credentials*`, `secrets*` et les exports `*_gantt.json`. |
| Mot de passe d'un fichier exporté | Choisi par l'utilisateur, **jamais conservé** par GanttPro. S'il est perdu, le fichier est irrécupérable : c'est voulu. |
| Si un secret fuite | Le **révoquer** et le renouveler ; le retirer de l'historique ne suffit pas (CLAUDE.md §2). |

## 4. Hébergement et copies

| Élément | Lieu | Remarque |
|---|---|---|
| Code, spécifications, documents | Dépôt GitHub `SimonBelCou/GanttPro` (**public**) | Source de vérité. Aucune donnée personnelle ni secret n'y figure (CLAUDE.md §3). |
| Application livrée | Fichier `GanttPro.html` du dépôt | Se régénère par `python3 tools/build.py`. |
| Intégration continue | GitHub Actions (workflow `.github/workflows/ci.yml`) | Version des actions suivie par Dependabot (hebdomadaire). |
| Protection de `main` | Règle d'ensemble GitHub « Protection de main » | Suppression et envoi forcé interdits ; pull request obligatoire ; vérification CI `verifier` verte obligatoire et à jour. **Aucune approbation n'est exigée** (un seul mainteneur) : la validation est la recette manuelle du propriétaire du produit. |
| Copie de secours | **Clone local** du dépôt sur le poste du propriétaire du produit | À tenir à jour (`git pull`) ; contient tout l'historique. |
| Spécifications | Dans le dépôt (`Specs_fonctionnelles.md`) depuis le 2 novembre 2026 | L'ancien cahier des charges en ligne est figé (révision 192) : ce n'est **pas** une copie de secours à jour. |
| Données d'utilisateur | Poste de l'utilisateur uniquement (exports, stockage du navigateur facultatif) | Hors périmètre de sauvegarde du projet. Les utilisateurs sont invités à **exporter** leur projet : la sauvegarde automatique est désactivée par défaut. |

## 5. Reprise

### Objectifs (décision du 2 novembre 2026, Specs_fonctionnelles.md annexe C.1)
- **Délai maximal d'interruption** : 5 jours ouvrés.
- **Perte de données acceptable** : jusqu'au dernier commit poussé sur le dépôt.

### Procédures

**A. Le dépôt GitHub est perdu (suppression, compte bloqué)**
1. Prendre le clone local le plus récent (`git status` : aucun changement non commité à perdre).
2. Créer un nouveau dépôt, puis `git remote set-url origin <nouvelle adresse>` et `git push --all`.
3. Recréer : la règle de protection de `main` (pull request, vérification `verifier`, interdiction de supprimer et de
   forcer), Dependabot, la détection de secrets, le signalement privé de vulnérabilité.
4. Mettre à jour l'adresse dans `SECURITY.md` et `README.md`.
5. Vérifier (voir « Contrôle après restauration »).

**B. `GanttPro.html` est perdu ou corrompu** : `python3 tools/build.py`, puis `python3 tools/build.py --check`.

**C. Le poste du propriétaire est perdu** : cloner le dépôt depuis GitHub ; rien d'autre n'est nécessaire, aucun secret
n'est stocké sur le poste.

**D. Une donnée réelle a été committée** : la traiter comme une fuite (CLAUDE.md §3) : la retirer du dépôt **et** de
l'historique (`git filter-repo`), prévenir le responsable des données personnelles de l'organisation, évaluer la
notification à la CNIL (72 heures en cas de risque pour les personnes).

**E. Une faille est signalée** : par le signalement privé de GitHub (adresse dans `SECURITY.md`). Accusé de réception,
correctif, fusion après recette, mention dans `CHANGELOG.md`.

### Contrôle après restauration
```bash
python3 tools/build.py --check
node --test tests/core/*.test.mjs
pip install playwright && python3 -m playwright install chromium
npm install --no-save axe-core@4.14.0 acorn@8.19.0
node tools/dependances.mjs --check && node --test tests/test_dependances.mjs
python3 tests/test_v3.py && python3 tests/test_v3_espace.py && python3 tests/test_v3_recette.py
python3 tests/test_v3_budget.py && python3 tests/test_v3_recette_manuelle.py
```
Ces commandes réussissent sur un clone neuf : c'est le test de restauration.

### Test périodique
Un test de restauration (procédure A sur un dépôt de test, puis contrôle ci-dessus) **chaque trimestre**.

| Date du test | Procédure | Résultat | Écarts relevés |
|---|---|---|---|
| 3 novembre 2026 (poste Windows 11, Node 22, Python 3.14, Playwright 1.64.1 ; clone neuf de `main` au commit `a190a2b`) | **Contrôle seul** (clone neuf depuis GitHub, puis commandes du « Contrôle après restauration ») ; la **procédure A** (nouveau dépôt, `git push --all`, recréation de la protection de `main`) **n'a pas été exécutée** | **Partiel : le contrôle n'est pas vert tel qu'écrit.** Durée : 3 s de clone, environ 3,5 min cumulées pour les commandes (dont 2 min pour les essais de bout en bout), environ 15 min avec le diagnostic. Avec `core.autocrlf=false` (fins de ligne LF) et `PYTHONUTF8=1`, tout passe sauf `build.py --check` (écart 1) et, sans `PERF_FACTOR`, un seuil d'EX-25 (écart 6). | Liste ci-dessous. |

**Écarts du test du 3 novembre 2026** (aucune procédure n'a été corrigée ; corrections proposées) :

1. **`python3 tools/build.py --check` échoue sur Windows** (« GanttPro.html n'est pas à jour »), même sur un clone neuf : le build réécrit le fichier avec des fins de ligne CRLF. Cause connue, corrigée dans la PR #14 (non fusionnée au moment du test). Proposition : refaire ce contrôle une fois la PR #14 fusionnée.
2. **`python3` n'existe pas sur le PATH de Windows** : seul l'alias du Microsoft Store (`WindowsApps\python3.exe`) répond « Python est introuvable ». Les commandes écrites ne passent donc pas telles quelles. Proposition : ajouter au PCA « sous Windows, remplacer `python3` par `python` (ou `py`) », ou désactiver l'alias dans les paramètres Windows. Le test a utilisé un script d'enrobage `python3` vers `python`, hors du dépôt.
3. **`core.autocrlf=true` (réglage courant de Git pour Windows) casse deux contrôles de plus** sur un clone neuf, car les fichiers sont extraits en CRLF : `node --test tests/core/*.test.mjs` (2 tests sur 121 : « guide IA : l'exemple de fichier est accepté… » et « …les règles citées correspondent aux contrôles », erreur « bloc d'exemple introuvable ») et `node tools/dependances.mjs --check` (« Dépendances périmées » dans 50 fichiers). Avec `git clone -c core.autocrlf=false`, ces deux contrôles passent. Proposition : ajouter un `.gitattributes` (`* text=auto eol=lf`) pour imposer LF quel que soit le poste, ou documenter `-c core.autocrlf=false` dans la procédure.
4. **Les essais de bout en bout plantent quand leur sortie est redirigée** (`UnicodeEncodeError: 'charmap' codec can't encode character` dans `test_v3.py`, `test_v3_budget.py`) : Python écrit en cp1252 dès que la sortie n'est pas une console. Contournement : `PYTHONUTF8=1`. Proposition : l'ajouter à la procédure, ou forcer l'encodage dans les essais (`sys.stdout.reconfigure(encoding='utf-8')`). Non vérifié : le comportement dans une console interactive.
5. **Les `&&` des lignes d'essais s'arrêtent au premier échec** : sans `PYTHONUTF8`, `test_v3_espace.py` et `test_v3_recette.py` n'ont pas été exécutés, et le résultat de la ligne n'est pas informatif. Proposition : un script `tools/controle-restauration` qui exécute chaque contrôle, note la durée et affiche un bilan.
6. **Sans `PERF_FACTOR`, `test_v3_recette.py` échoue 5 fois sur 7** sur « EX-25 : regroupement de 1 000 tâches en moins de 100 ms » (70 à 121 ms ; voir ci-dessous). Les 86 autres vérifications passent. La commande de la procédure n'a pas de `PERF_FACTOR` : sur ce poste, elle est donc rouge. Proposition, à trancher par le propriétaire du produit : optimiser le regroupement, relever son seuil, ou écrire `PERF_FACTOR=2` dans la procédure.
7. **Sans écart** : `pip install playwright` et `playwright install chromium` (déjà installés, 4 s), `npm install --no-save axe-core@4.14.0 acorn@8.19.0` (2 s), `test_v3.py` (27 s), `test_v3_espace.py` (19 s), `test_v3_budget.py` (48 s) et `test_v3_recette_manuelle.py` (5 s), tous verts en LF avec `PYTHONUTF8=1`. Le test a été lancé sous Git Bash ; non vérifié sous Windows PowerShell 5.1, où `&&` n'existe pas.

**Reste à faire** pour clore l'écart C.2 n° 5 : exécuter la procédure A sur un dépôt de test (jamais fait), corriger les écarts 1 à 6, puis refaire le contrôle.

### Mesures de performance (EX-15 et EX-25), sans `PERF_FACTOR`
Mesure du 3 novembre 2026 : `python3 tests/test_v3_recette.py` sans facteur, 7 passages successifs sur un clone neuf (LF) de `main`, poste Windows 11 de développement ; temps mesurés dans Chromium par `performance.now()`. D'autres sessions de travail tournaient en parallèle sur le poste, ce qui peut majorer les temps. Les seuils n'ont pas été modifiés.

| Exigence | Seuil | Mesures (7 passages, triées) | Médiane | Verdict |
|---|---|---|---|---|
| EX-15, 50 tâches (modification d'une durée) | < 100 ms | 15, 15, 15, 16, 16, 16, 16 ms | 16 ms | Tenu |
| EX-15 / R-35, 1 000 tâches | < 500 ms | 216, 218, 219, 223, 236, 237, 246 ms | 223 ms | Tenu (marge d'un facteur 2) |
| EX-25, recherche sur 1 000 tâches | < 100 ms | 1 ms à chaque passage | 1 ms | Tenu |
| EX-25, filtre sur 1 000 tâches | < 100 ms | 24 à 39 ms | 31 ms | Tenu |
| EX-25, regroupement de 1 000 tâches | < 100 ms | 70, 74, 108, 110, 112, 114, 121 ms | 110 ms | **Non tenu 5 fois sur 7** |
| EX-25, export Excel de 1 000 tâches | < 3 s | 197 à 241 ms | 228 ms | Tenu |

Constat : EX-15 est tenu sans facteur, avec une marge d'un facteur 2 ; seul le regroupement d'EX-25 dépasse son seuil (il passe avec `PERF_FACTOR=2`). Le seuil de 150 ms pour 200 tâches n'est pas mesuré par la recette automatique. Ce poste n'est pas forcément « un ordinateur de bureau courant » : à confirmer par le propriétaire du produit.

## 6. Problèmes récurrents

| Symptôme | Cause | Correctif |
|---|---|---|
| La CI échoue : « GanttPro.html n'est pas à jour » | Une source de `src/` a changé sans réassembler le fichier livré | `python3 tools/build.py`, puis recommiter `GanttPro.html` |
| Le navigateur affiche une ancienne version | Fichier en cache | Rechargement forcé (Ctrl + F5) ou rouvrir le fichier |
| Après un réglage manuel des largeurs de colonnes, seules les premières colonnes restent visibles (signalé sous Firefox, 30 octobre 2026) | Largeurs mémorisées incohérentes avec la mise en page à largeur fixe | Bouton « Largeurs par défaut ». Corrigé dans la PR #13 ; la recette Colonnes 1 (étape 12b) le contrôle sous Firefox |
| L'onglet Budget disparaît après un export sans montants puis une réimportation | Onglet conditionné aux seuls montants | Corrigé (Specs_fonctionnelles.md, A.8 ligne 16) : l'onglet reste visible avec des points de situation |
| Les tests de bout en bout échouent par dépassement de délai sur une machine lente | Seuils de performance trop stricts | `PERF_FACTOR=2` (ou `3`) devant la commande |
| Le contrôle d'accessibilité ne s'exécute pas | `axe-core` absent. Installer `acorn` seul avec `--no-save` **retire** `axe-core` (npm supprime ce qui n'est pas déclaré) | Toujours une seule commande : `npm install --no-save axe-core@4.14.0 acorn@8.19.0` |
| La CI échoue : « Dépendances périmées dans … » | Une fonction ou un appel a changé sans régénérer les commentaires « Appelle / Appelée par » ni le graphe | `node tools/dependances.mjs`, puis recommiter |
| Les tests automatiques ne couvrent pas Firefox ni Safari | La CI n'exécute que Chromium | Recette manuelle (`docs/recette-manuelle.md`) |
| `gh pr create` échoue depuis l'environnement de l'assistant | L'interface GraphQL de GitHub n'est pas joignable | `gh api repos/SimonBelCou/GanttPro/pulls` (interface REST) |
| « Le stockage du navigateur n'est pas disponible » | Navigation privée ou réglage du navigateur | Exporter le projet ; voir `store.off` |
| Un fichier protégé ne s'ouvre pas | Mot de passe faux, ou fichier altéré (le message est volontairement le même) | Aucun moyen de récupération : GanttPro ne conserve jamais le mot de passe |

Toute nouvelle erreur récurrente est ajoutée à ce tableau avec sa cause et son correctif (CLAUDE.md §4).

## 7. Codes d'erreur

GanttPro n'a pas de journal (écart documenté, Specs_fonctionnelles.md annexe C.2, n° 1). Les erreurs sont **montrées à
l'utilisateur** par un message précis, identifié par un **code stable** : la clé du catalogue de traductions
(`src/js/core/50-i18n.js`, français et anglais). **Règle : une clé publiée n'est jamais renommée ni réutilisée pour un
autre sens.** Aucun message n'affiche de trace d'appel ; les messages ne contiennent que ce qui permet de corriger le
fichier.

Familles d'erreurs : `imp.*` (import et validation de fichier), `pwd.*` (mot de passe), `store.*` (stockage du
navigateur), `err.*` (saisie et planification : champ obligatoire, boucle de dépendances, profondeur) et `rule.*` (règle de
champ citée par `imp.field`). Les clés `lib.*` sont les libellés de la bibliothèque, pas des erreurs.

Codes de validation et de saisie les plus fréquents (extraits du catalogue français ; `{…}` marque une valeur insérée) :

| Code | Message affiché (français) |
|---|---|
| `imp.unreadable` | Ce fichier n'est pas un projet GanttPro lisible. |
| `imp.tooBig` | Fichier trop volumineux (5 Mo au maximum). |
| `imp.noTasks` | Le champ "tasks" est manquant ou invalide. |
| `imp.newer` | Ce fichier vient d'une version plus récente de GanttPro. |
| `imp.tooMany` | Trop d'éléments « {what} » ({max} au maximum). |
| `imp.badId` | Tâche n° {n} : identifiant invalide (A-Z, 0-9, ., _ ou -, 12 caractères au plus). |
| `imp.dupId` | Identifiant de tâche en double : {id}. |
| `imp.field` | {obj}{n} : champ « {field} » invalide ({rule}). |
| `imp.rangeOrder` | {obj} : plage n° {n} — la fin précède le début. |
| `imp.noWorkday` | Calendrier : aucun jour de la semaine n'est travaillé. |
| `imp.calendarClash` | Calendrier : le {date} est à la fois chômé et travaillé. |
| `imp.dupResource` | Deux ressources portent le nom {name}. |
| `imp.dupCategory` | Deux catégories portent le nom {name}. |
| `imp.dupAssign` | Tâche n° {n} : la ressource {name} est affectée deux fois. |
| `imp.overCapacity` | Tâche n° {n} : le taux de {units} % dépasse la capacité de {capacity} % de {name}. |
| `imp.milestoneRes` | Tâche n° {n} : un jalon n'a pas de ressource. |
| `imp.summaryField` | Tâche n° {n} : une récapitulative n'a ni lien, ni affectation, ni date imposée, ni contrainte. |
| `imp.noAmount` | Tâche n° {n} : un jalon ou une récapitulative n'a ni budget ni coût réel propre. |
| `imp.realOrder` | Tâche n° {n} : la fin réelle précède le début réel. |
| `imp.realEndPct` | Tâche n° {n} : une fin réelle impose un avancement de 100 %. |
| `imp.badParent` | Tâche n° {n} : le parent {parent} n'est pas une récapitulative. |
| `imp.parentCycle` | Hiérarchie en boucle autour de {id}. |
| `imp.tooDeep` | La tâche {id} dépasse {max} niveaux de récapitulatives. |
| `imp.missingPred` | Tâche n° {n} : le prédécesseur {pred} n'existe pas. |
| `imp.selfLink` | Tâche n° {n} : une tâche ne peut pas dépendre d'elle-même. |
| `imp.dupLink` | Tâche n° {n} : le prédécesseur {pred} est lié deux fois. |
| `imp.linkSummary` | Tâche n° {n} : le prédécesseur {pred} est une récapitulative. |
| `imp.linkHierarchy` | Tâche n° {n} : le lien avec {pred} relie une tâche à sa propre récapitulative. |
| `imp.cycle` | Boucle de dépendances : {path}. |
| `imp.version` | Version n° {n} : {inner} |
| `imp.horizon` | Le planning dépasserait l'année 2199 : fichier refusé. |
| `imp.zip` | Classeur illisible ou trop volumineux (200 fichiers et 50 Mo décompressés au plus). |
| `imp.emptySheet` | Le tableau est vide. |
| `imp.durFormat` | écrire « 5 », « 5j » ou « 5 j » |
| `imp.depFormat` | « {value} » ne se lit pas (ex. « A; B DD+2; C FF-1 ») |
| `imp.missingDep` | la tâche {id} est introuvable |
| `imp.resFormat` | « {value} » ne se lit pas (ex. « Alice 50 %; Bob ») |
| `store.off` | Le stockage du navigateur n'est pas disponible (navigation privée ou réglage du navigateur) : rien n'a été enregistré. Exportez le projet pour le conserver. |
| `store.full` | L'espace de stockage du navigateur est plein : rien n'a été enregistré. Supprimez des éléments de la bibliothèque ou exportez le projet. |
| `pwd.short` | Mot de passe : {min} caractères au moins (une phrase convient très bien). |
| `pwd.bad` | Mot de passe incorrect ou fichier altéré. |
| `pwd.mismatch` | Les deux mots de passe ne sont pas identiques. |

## 8. Qui contacter

| Besoin | Rôle ou adresse générique |
|---|---|
| Décision fonctionnelle, validation de la recette, fusion | **Propriétaire du produit** (propriétaire du dépôt GitHub) |
| Vulnérabilité | Signalement privé GitHub : onglet **Security → Report a vulnerability** du dépôt (lien dans `SECURITY.md`) |
| Défaut ou question d'usage | Issue GitHub du dépôt |
| Donnée personnelle committée par erreur | **Responsable des données personnelles** de l'organisation utilisatrice, s'il existe, et le propriétaire du produit |

Le dépôt étant public et sans information sensible, il n'y a pas de partie réservée à un dépôt privé.
