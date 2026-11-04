# Architecture de GanttPro

Ce document va du général au détaillé : contexte, fabrication, briques, données, flux, puis modules. Il permet de
reprendre le projet sans l'historique des conversations. Les exigences fonctionnelles sont dans
[Specs_fonctionnelles.md](Specs_fonctionnelles.md) (source unique), la continuité dans [PCA.md](PCA.md), les règles de
développement dans [CLAUDE.md](CLAUDE.md).

Les schémas sont en Mermaid (rendus par GitHub). Les dépendances entre modules et entre fichiers sont **générées par
analyse des sources** (`tools/dependances.mjs`), jamais écrites de mémoire ; celles des fonctions sont écrites dans le
commentaire de chaque fonction (section 6, « Dépendances au niveau des fonctions »).

## 1. Contexte

GanttPro est **une application locale** : un seul fichier HTML ouvert dans un navigateur. Il n'y a ni serveur, ni
compte, ni base de données, ni appel réseau. Les données de l'utilisateur ne quittent le navigateur que par un export
qu'il déclenche lui-même.

```mermaid
flowchart LR
  user(["Utilisateur"])
  subgraph poste["Poste de l'utilisateur"]
    browser["Navigateur"]
    app["GanttPro.html : un seul fichier, aucune dépendance"]
    files[("Fichiers échangés : projet JSON, Excel, CSV, MS Project XML, image PNG, PDF")]
    storage[("Stockage du navigateur : réglages, bibliothèque, récupération")]
    session[("Mémoire de session : contrat de la page d'accueil")]
  end
  home["Page d'accueil locale (facultative)"]
  net(["Réseau"])
  user --> browser --> app
  app <-->|"importer, exporter"| files
  app <-->|"geste explicite ou option activée"| storage
  home -.->|"projet transmis"| session --> app
  app -.-|"aucun appel : blocage par la CSP"| net
```

Menaces et mesures : [SECURITY.md](SECURITY.md). Le principal vecteur est un fichier de projet malveillant importé
(section 5 du présent document).

## 2. Fabrication et livraison

Le fichier livré est **généré** : on ne le modifie jamais à la main. `tools/build.py` assemble les sources, refuse les
constructions dangereuses (`eval`, gestionnaires en ligne, appels réseau, `console.*`, accès au stockage hors de
`src/js/ui/10-storage.js`) et calcule la politique de sécurité du contenu (CSP) avec l'empreinte SHA-256 exacte du script
et de la feuille de style. Sans `'unsafe-inline'`, un script ou un style injecté est bloqué par le navigateur.

```mermaid
flowchart LR
  tpl["src/index.html : gabarit et marqueurs"]
  css["src/styles/*.css"]
  core["src/js/core/*.js : moteur sans DOM"]
  ui["src/js/ui/*.js : interface"]
  build["tools/build.py : contrôles, concaténation, empreintes SHA-256"]
  out["GanttPro.html : un script et un style en ligne, CSP par empreinte"]
  tests["tests/core (node --test) et tests/*.py (Playwright, axe-core)"]
  ci["CI GitHub Actions : build --check, syntaxe, tests, gitleaks"]
  tpl --> build
  css --> build
  core --> build
  ui --> build
  build --> out
  out --> tests --> ci
  out --> ci
```

Ordre de chargement : les fichiers sont concaténés dans l'ordre alphabétique, `core` avant `ui`, dans **une seule
fonction exécutée immédiatement, en mode strict** : aucun nom n'est exposé sur `window`. Le préfixe numérique des noms
de fichiers fait donc l'ordre de définition : au moment de sa définition, un module ne peut utiliser qu'un module de
préfixe inférieur ; un appel vers un module de préfixe supérieur n'a lieu qu'à l'exécution.

## 3. Briques

| Brique | Dossier | Rôle | Touche au DOM ? |
|---|---|---|---|
| Moteur (`core`) | `src/js/core/` | Dates, calendrier, ordonnancement, indicateurs, budget et valeur acquise, colonnes, filtres, traductions, lecture et écriture des formats, chiffrement, validation des fichiers | Non |
| Interface (`ui`) | `src/js/ui/` | Rendu, fenêtres, gestes, fichiers, stockage, démarrage | Oui |
| Styles | `src/styles/` | Polices intégrées (base64) et feuille de style, thèmes clair et sombre | — |
| Gabarit | `src/index.html` | Squelette de la page, zones, marqueurs de construction | — |
| Outils | `tools/build.py`, `tools/dependances.mjs` | Assemblage, contrôles, CSP ; dépendances entre fonctions, commentaires et graphe | — |
| Tests | `tests/` | Moteur (`core/`), bout en bout (`test_v3*.py`), fichiers d'essai fictifs (`fixtures/`) | — |

Règle de séparation : le moteur ne lit ni n'écrit rien d'extérieur ; il reçoit un projet et rend un résultat. L'interface
ne calcule pas : elle appelle le moteur. Ainsi les scénarios chiffrés de la recette se testent sans navigateur.

## 4. Données

Un projet est un objet unique, validé à chaque entrée. Les montants sont des **entiers de centimes**. Les identifiants
de tâche sont des chaînes `[A-Z0-9._-]` de 1 à 12 caractères, jamais convertis en nombres. Le détail des champs et des
limites est dans Specs_fonctionnelles.md, section 3.

```mermaid
erDiagram
  PROJET ||--o{ TACHE : contient
  PROJET ||--o{ RESSOURCE : contient
  PROJET ||--o{ CATEGORIE : contient
  PROJET ||--o{ BASELINE : "dix au plus"
  PROJET ||--o{ VERSION : "dix au plus"
  PROJET ||--|| CALENDRIER : "semaine, fériés, jours chômés"
  PROJET ||--o{ POINT_DE_SITUATION : "valeur acquise"
  TACHE }o--o| TACHE : "parent"
  TACHE }o--o{ TACHE : "liens"
  TACHE }o--o{ RESSOURCE : "affectée à"
  TACHE }o--|| CATEGORIE : "est classée dans"
  BASELINE ||--o{ TACHE_FIGEE : "dates, durée, budget"
```

Lecture du schéma : le parent est une tâche récapitulative (5 niveaux au plus) ; les liens sont de type FD, DD, FF ou DF avec un
délai ; une affectation porte un taux de 1 à 100 % de la capacité de la ressource.

Champs facultatifs du format 3, ajoutés sans changer son numéro : montants (`budget`, `actual`, provision), `evmGreen`,
`evmRed`, `etc`, `baselineRef`, `statusPoints`, `columns`.

Trois lieux de conservation, tous contrôlés par `src/js/ui/10-storage.js` (le seul module autorisé à y toucher) :

| Lieu | Contenu | Quand |
|---|---|---|
| `localStorage`, préfixe `ganttpro.settings.` | Réglages : langue, thème, raccourcis, masquage des montants, sauvegarde automatique, message de première utilisation | Réglage modifié |
| `localStorage`, préfixes `ganttpro.lib.` et `ganttpro.rec.` | Bibliothèque (projets et modèles) ; emplacements de récupération | Geste explicite ; sauvegarde automatique, désactivée par défaut |
| `sessionStorage` (`gantt_project`, `gantt_saved_project`, `gantt_home_url`) | Contrat avec une page d'accueil (section 8.4 des spécifications) | Lu au démarrage ; le projet transmis est supprimé après lecture |

« Réglages > Effacer toutes les données » supprime tout ce qui porte le préfixe `ganttpro.`.

## 5. Flux : d'un fichier importé à l'écran

Tout ce qui entre est **non fiable** : le fichier est contrôlé **en entier avant** tout changement ; s'il est refusé, le
projet ouvert reste intact. Le même contrôle (`Model.sanitize` par `Model.parseFile`) s'applique aux versions
restaurées, à la bibliothèque, à la récupération et à la page d'accueil.

```mermaid
sequenceDiagram
  actor U as Utilisateur
  participant F as 80-files.js (interface)
  participant S as Secure (65-crypto.js)
  participant X as Exchange (64-exchange.js)
  participant M as Model (40-model.js)
  participant A as App (40-state.js)
  participant P as Schedule et Metrics
  participant R as 50-render.js
  U->>F: choisit un fichier
  F->>F: refuse au-delà de 20 Mo puis de la taille maximale du format
  alt projet GanttPro (JSON)
    F->>M: parseFile(texte)
    opt fichier protégé par mot de passe
      F->>S: decrypt(enveloppe, mot de passe)
      S-->>F: texte clair
      F->>M: parseFile(texte clair)
    end
  else Excel, CSV ou MS Project
    F->>X: lecture du format (ZIP et XML bornés)
    X->>M: sanitize(brut)
  end
  alt fichier invalide
    M-->>F: erreur avec code imp.*
    F-->>U: message précis, projet ouvert intact
  else valide
    M-->>F: projet nettoyé
    F->>A: remplace le projet ou ouvre un onglet
    A->>P: recompute() : planning, indicateurs
    P-->>R: résultat
    R-->>U: écran reconstruit
  end
```

### Flux d'une modification

Toute modification de données passe par `commit(mutate)` (`40-state.js`) : un pas d'annulation, indicateur « modifié »,
recalcul du planning par `recompute()` puis reconstruction de l'écran par `renderAll()` (déterministe, moins de 100 ms
pour 1 000 tâches). L'interface n'écrit jamais dans `App.project` autrement.

## 6. Modules du moteur (`src/js/core/`)

| Fichier | Module | Rôle |
|---|---|---|
| `00-dates.js` | `Dates` | Jour = entier (nombre de jours depuis le 01/01/1970), jamais de fuseau |
| `10-calendar.js` | `Calendar` | Jours ouvrés, fériés par pays, jours chômés (RG-01 à RG-03) |
| `20-schedule.js` | `Schedule` | Ordonnancement, chemin critique, modes de charge (RG-04 à RG-12, RG-23 à RG-25, RG-33) |
| `30-metrics.js` | `Metrics` | Statuts, écarts, avancement, courbe en S, occupation (RG-13 à RG-20) |
| `35-resolve.js` | `Resolve` | Propositions de résolution des conflits, simulées sur une copie (EF-31, RG-34) |
| `40-model.js` | `Model` | Limites, validation par liste blanche, lecture et écriture du format 3 |
| `42-budget.js` | `Budget` | Budget, coût réel, provision, BAC, courbe des coûts, entiers de centimes (RG-35 à RG-43) |
| `43-evm.js` | `Evm` | Valeur acquise : PV, EV, AC, CV, SV, CPI, SPI, EAC, VAC, points de situation |
| `44-columns.js` | `Columns` | Colonnes affichées et leur ordre (EF-143 à EF-146) |
| `45-view.js` | `View` | Recherche, filtres, regroupements : affichage seulement |
| `46-rates.js` | `Rates` | Taux des ressources : lignes datées, normalisation, coût par jour ouvré (EF-147 à EF-150) |
| `50-i18n.js` | `I18n` | Catalogues français et anglais, pluriels, messages d'erreur |
| `60-xml.js` | `Xml` | Lecteur XML minimal sans DOCTYPE ni entités |
| `61-zip.js` | `Zip` | Écriture sans compression, lecture bornée (200 fichiers, 50 Mo) |
| `62-csv.js` | `Csv` | CSV et texte tabulé, neutralisation des formules |
| `63-xlsx.js` | `Xlsx` | Écriture et lecture de classeurs Excel, sans formule |
| `64-exchange.js` | `Exchange` | Export et import tableur et MS Project ; tout passe par `Model.sanitize` |
| `65-crypto.js` | `Secure` | PBKDF2-SHA256 (600 000 itérations) et AES-256-GCM par Web Crypto |

Dépendances entre modules (appels à l'exécution), **générées par `tools/dependances.mjs`** : `A --> B` signifie « A appelle B ».
`Dates`, utilisé par presque tous, n'est pas dessiné. `Model`, `Budget` et `Columns` se référencent en cercle : c'est sans
danger, car chacun n'appelle l'autre qu'à l'exécution, jamais pendant sa définition.

<!-- dependances:modules:debut -->
```mermaid
flowchart LR
  Budget --> Metrics
  Budget --> Model
  Columns --> Budget
  Evm --> Budget
  Evm --> Metrics
  Evm --> Model
  Exchange --> Budget
  Exchange --> Calendar
  Exchange --> Csv
  Exchange --> I18n
  Exchange --> Metrics
  Exchange --> Model
  Exchange --> Rates
  Exchange --> View
  Exchange --> Xlsx
  Exchange --> Xml
  Model --> Calendar
  Model --> Columns
  Model --> Rates
  Model --> Schedule
  Rates --> Evm
  Rates --> Model
  Resolve --> Model
  Resolve --> Schedule
  Schedule --> Calendar
  Secure --> Model
  View --> Metrics
  Xlsx --> Csv
  Xlsx --> Xml
  Xlsx --> Zip
```
<!-- dependances:modules:fin -->

### Dépendances au niveau des fonctions

Chaque fonction de niveau module, et chaque module, porte à la fin de son commentaire deux lignes **produites par
`node tools/dependances.mjs`** (convention de CLAUDE.md §6) :

```js
/**
 * Arrondit a × k / b à l'entier, la moitié vers le haut.
 * Appelle : aucune
 * Appelée par : Evm.compute(), Evm.ratio()
 */
```

- « Appelle » compte les appels directs **et** les fonctions transmises en rappel (`liste.map(f)`,
  `addEventListener('click', f)`) ; « Appelée par » liste les fonctions qui l'appellent. Au-delà de 12 noms, la liste est
  remplacée par « N fonctions (usage général) ».
- Une action déclarée par `action('nom', …)` est dite appelée par « l'événement nom (table ACTIONS) » ; les instructions
  de niveau fichier sont regroupées sous « (initialisation de <fichier>) ».
- Pour un module : les autres modules qu'il appelle, et les modules et fichiers d'interface qui l'appellent.
- **Limites** : un appel dynamique (`ACTIONS[nom]()`, nom construit dans une chaîne) n'est pas vu ; les fonctions définies
  dans le corps d'une autre fonction ne sont pas annotées (leurs appels comptent pour la fonction qui les contient) ; un
  nom local (paramètre, `const`, `let`) masque un nom de module ou global.
- **Contrôle** : `node tools/dependances.mjs --check` (CI) échoue si une ligne ou le graphe ci-dessus est périmé. L'outil
  ne modifie que des commentaires : lors du rétrofit du 2 novembre 2026, la suite des lexèmes de chacun des 51 fichiers
  sources était identique avant et après.

## 7. Modules de l'interface (`src/js/ui/`)

| Fichier | Rôle |
|---|---|
| `00-dom.js` | `h()` et `svg()` : construction du DOM sans `innerHTML` |
| `10-storage.js` | `Settings`, `Store`, mémoire de session : seul accès au stockage |
| `20-actions.js` | Table `ACTIONS` : un écouteur par type d'événement relie `data-click`, `data-change`, `data-input`, `data-submit` aux actions |
| `30-dialog.js` | `Dialog.open`, `message`, `confirm` : fenêtres natives titrées, focus piégé |
| `40-state.js` | `App` (état), `commit()`, `recompute()`, annulation (50 pas) |
| `41-money.js` | Affichage des montants, masquage |
| `50-render.js` | Barre du haut, chiffres, alertes, liste, grille, légende ; `render()` et `renderAll()` |
| `52-viewbar.js`, `55-tooltip.js` | Recherche et filtres ; infobulles |
| `60-editor.js` à `66-layout.js` | Panneau d'édition, raccourcis, sélection, actions groupées, gestes, mise en page |
| `70-windows.js` à `74-columns.js` | Fenêtres projet, ressources, catégories, baselines, calendrier, colonnes |
| `75-dashboard.js`, `76-budget.js`, `76-load.js` | Tableau de bord, onglet Budget et valeur acquise, charge |
| `77-report.js`, `78-print.js` | Rapport d'état, impression |
| `79-versions.js` à `87-settings.js` | Versions, fichiers, presse-papiers, onglets, bibliothèque, récupération, réglages |
| `88-ofl.js` | Texte de licence des polices (généré depuis `THIRD_PARTY_LICENSES.md`) |
| `99-main.js` | Actions de l'écran principal et démarrage |

Dépendance de l'interface vers le moteur : l'interface appelle le moteur, jamais l'inverse. Tableau **généré par
`tools/dependances.mjs`** (modules du moteur utilisés par chaque fichier d'interface) :

<!-- dependances:ui:debut -->
| Fichier d'interface | Modules du moteur utilisés |
|---|---|
| `00-dom.js` | `Model` |
| `40-state.js` | `Model`, `Schedule` |
| `50-render.js` | `Budget`, `Columns`, `Dates`, `I18n`, `Metrics` |
| `52-viewbar.js` | `Dates`, `I18n`, `View` |
| `55-tooltip.js` | `I18n` |
| `62-shortcuts.js` | `Dates`, `I18n`, `Model`, `Schedule` |
| `63-selection.js` | `Columns`, `Model` |
| `64-bulk.js` | `Budget`, `Dates`, `I18n`, `Model`, `Schedule` |
| `65-gestures.js` | `Dates`, `I18n`, `Model`, `Schedule` |
| `70-windows.js` | `Budget`, `Dates`, `I18n`, `Model`, `Rates`, `Resolve` |
| `71-rates.js` | `Budget`, `Dates`, `I18n`, `Model`, `Rates` |
| `71-resource-sheet.js` | `Dates`, `I18n`, `Model`, `Rates`, `Schedule` |
| `72-baselines.js` | `Budget`, `Dates`, `Evm`, `I18n`, `Model` |
| `73-calendar.js` | `Calendar`, `Dates`, `I18n`, `Model`, `Schedule` |
| `74-columns.js` | `Columns` |
| `75-dashboard.js` | `Budget`, `Dates`, `I18n`, `Metrics`, `Rates` |
| `76-budget.js` | `Budget`, `Dates`, `Evm`, `I18n`, `Model`, `Rates` |
| `76-load.js` | `I18n`, `Metrics` |
| `77-report.js` | `Budget`, `Dates`, `Evm`, `I18n`, `Metrics` |
| `78-print.js` | `Budget`, `Dates`, `I18n`, `Metrics` |
| `79-versions.js` | `I18n`, `Model` |
| `80-files.js` | `Csv`, `Dates`, `Exchange`, `I18n`, `Metrics`, `Model`, `Schedule`, `Secure`, `Xlsx` |
| `82-clipboard.js` | `Csv`, `Exchange`, `I18n`, `Model` |
| `85-library.js` | `Dates`, `I18n`, `Model`, `Secure` |
| `87-settings.js` | `I18n`, `Model`, `Secure` |
| `99-main.js` | `Dates`, `I18n`, `Model`, `Schedule` |
<!-- dependances:ui:fin -->

## 8. Sécurité intégrée à l'architecture

Défense en profondeur : aucune mesure n'est le seul rempart.

| Couche | Mesure | Où |
|---|---|---|
| Construction | Motifs interdits refusés au build | `tools/build.py` |
| Contenu | CSP par empreinte, `connect-src 'none'` | `GanttPro.html` (généré) |
| Entrée | Liste blanche de champs, types, longueurs, identifiants ; fichier refusé en entier | `Model.sanitize`, `Model.parseFile` |
| Formats | ZIP et XML bornés, formules neutralisées | `Zip`, `Xml`, `Csv`, `Xlsx` |
| Affichage | `textContent` seul, jamais `innerHTML`, couleurs filtrées | `00-dom.js` |
| Repos | Chiffrement facultatif par mot de passe | `Secure` |
| Stockage | Un seul module, clés validées, effaçable | `10-storage.js` |
| Livraison | Détection de secrets, fichier à jour, revue avant fusion | CI et protection de `main` |

## 9. Tenir ce document à jour

Ce fichier est modifié dans la **même modification** que le code quand une brique, un fichier, une dépendance ou un flux
change (CLAUDE.md §7 et §8). Après toute modification de code, lancer `node tools/dependances.mjs` : il réécrit les lignes « Appelle / Appelée par » et
les blocs générés de ce document ; la CI (`--check`) refuse un état périmé. Ne pas se fier à la mémoire.
