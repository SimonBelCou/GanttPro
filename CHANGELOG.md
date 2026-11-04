# Journal des changements

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Chaque entrée renvoie à la pull request qui l'a
livrée. Numérotation [SemVer](https://semver.org/lang/fr/) : majeur = format de fichier incompatible, mineur =
fonctionnalité, correctif = correction. Le numéro vient du fichier `VERSION` ; une version publiée a une section
« ## [X.Y.Z] - AAAA-MM-JJ », dont le texte devient les notes de la release GitHub (CLAUDE.md §13.6 bis).
`python3 tools/build.py --check` vérifie que la première section datée porte le numéro de `VERSION`.

À chaque modification : ajouter une ligne sous « Non publié » dans la même pull request (CLAUDE.md §13.6).

## Non publié

### Versionnement (premier numéro publié : 3.0.0, format de fichier 4)
- Fichier `VERSION` (3.0.0), source unique du numéro, injecté par `tools/build.py` : titre de la page, balise
  `<meta name="generator">`, aide, pied du rapport d'état et champ informatif `app` de tout projet écrit (EF-151).
- Format de fichier **4** (il réunit les champs du budget A, B et C) ; formats 3 et antérieurs lus ; un format supérieur
  est refusé avec la version requise (« format 5 : GanttPro 4.0.0 ou ultérieur requis », RG-59). Nouveau texte du code
  d'erreur `imp.newer`.
- Garde-fou des champs inconnus (EF-152) : avertissement dans l'aperçu de l'import, confirmation au premier export JSON
  ou enregistrement, nom de fichier distinct, nouvelle entrée de bibliothèque ; indicateur conservé par la sauvegarde
  automatique. Fichier d'essai `tests/fixtures/champs-inconnus-version-recente.json`.
- `tools/version.py` (concordance VERSION / CHANGELOG, notes de publication, contrôle d'étiquette), contrôlé par
  `build.py --check` et `tests/test_build.py`. Workflows `release.yml` (release par étiquette `v*`, avec
  `GanttPro.html.sha256`) et `etiquette.yml` (étiquette posée à la main, jamais automatiquement) (EX-42).
- Décisions V1 à V9 du 3 novembre 2026 au journal C.1 ; A.8 ligne 8 close. Procédure de publication : CLAUDE.md §13.6 bis ;
  retour à une release précédente : PCA.md, procédure F.

### Documentation et organisation
- `CLAUDE.md` remplacé par le texte générique de développement (§0 à §12), avec les spécificités de GanttPro au §13.
- Nouveaux documents : `Specs_fonctionnelles.md` (source unique des spécifications, copie du cahier des charges avec
  une annexe C : journal des arbitrages et écarts connus), `Architecture.md`, `PCA.md`, `docs/veille-securite.md` et ce
  journal.
- `README.md` et `SECURITY.md` alignés (documents, protection de `main`, journalisation).
- **Dépendances entre fonctions** : nouvel outil `tools/dependances.mjs` (acorn, outil de développement) qui écrit les lignes
  « Appelle / Appelée par » dans les commentaires des 576 fonctions et modules, et génère le graphe d'`Architecture.md` ;
  contrôlé en CI (`--check`) ; 9 tests (`tests/test_dependances.mjs`). Seuls des commentaires changent dans le code
  (suite des lexèmes identique avant et après, vérifiée sur les 51 fichiers) ; `GanttPro.html` grossit d'environ 68 Ko.
- **Numérique responsable** : règles d'écoconception et d'accessibilité de l'INR (`skill-nr` 1.0.0, CC BY-SA 4.0) copiées
  dans `.claude/regles-nr/` et importées par `CLAUDE.md` §13.10 ; sous-agents de revue `eco-check` et
  `accessibilite-check` dans `.claude/agents/`. Aucun changement de code.

### Budget, étape C (PR #14, en attente de la recette « Taux 1 à 10 »)
- Profils de coût et taux datés des ressources (par jour ouvré), coût des ressources par tâche, par ressource et face au
  budget saisi, signalement des ressources sans taux, exports avec ou sans taux (EF-147 à EF-150, RG-54 à RG-58, R-92 à R-100).
  Nouveau module `src/js/core/46-rates.js`, fenêtre `src/js/ui/71-rates.js`. Nouveaux codes d'erreur : `imp.dupProfile`,
  `imp.unknownProfile`, `rule.rateOrder`.
- Correctif de mise en page : texte des tuiles de l'onglet Budget un peu plus petit (8,5 cqi au lieu de 9,5), pour que le plus grand
  montant garde environ 9 % de marge. Le contrôle EX-04 échouait en CI (marge de 2 % seulement, police de repli différente).
- Correctif de l'outil `tools/build.py` : sous Windows, il écrivait les en-têtes de fichiers avec « \ » et le fichier en
  fins de ligne CRLF, si bien que `--check` échouait sur toute branche. En-têtes en « / » et fichier en LF sur tout poste ;
  nouveau test `tests/test_build.py`, lancé en CI. Le contenu de `GanttPro.html` ne change pas.
- Revues `eco-check` et `accessibilite-check` (CLAUDE.md §13.10) : écoconception conforme ; message d'erreur du nom de
  profil désormais restitué aux lecteurs d'écran (`role="alert"`, RGAA 11.10). Exigences détaillées EF-147 à EF-150
  écrites (Specs_fonctionnelles.md, 5.22). Veille sécurité du jour dans `docs/veille-securite.md`.

## Développement de la version 3 (avant le versionnement, jamais publié)

### 2026-10-30
- **Colonnes de la liste** (#13) : choisir les colonnes affichées, les ordonner (boutons Monter / Descendre), choix
  enregistré dans le projet ; Budget et Coût réel masqués tant qu'aucun montant n'existe. Largeurs de colonnes
  corrigées après un défaut signalé sous Firefox.
- **Budget, étape B : valeur acquise** (#12) : PV par palier, EV, AC, CV, SV, CPI, SPI avec voyants, trois hypothèses de
  prévision à terminaison (EAC) et VAC, diagramme CPI / SPI, points de situation, bloc dans le rapport. Baselines : dix au
  plus, trois affichées par vue, baseline initiale protégée, baseline de référence enregistrée dans le projet. Onglet
  Budget visible aussi avec des points de situation seuls.

### 2026-10-29
- **Budget, étape A** (#11) : budget et coût réel par tâche, provision, BAC, courbe en S des coûts, budget par catégorie,
  montants en entiers de centimes, masquage à l'écran, exports sans montants.

### 2026-10-16
- Arbitrages de la version 3 (#9) et décisions d'interface du budget (#10).

### 2026-10-15
- Application des arbitrages du 15 octobre 2026 (#7).

### 2026-10-09
- **GanttPro 3** (#6) : refonte complète à partir du cahier des charges.
- Intégration continue : mises à jour des actions GitHub par Dependabot (#2, #3, #4, #5 ; #8 le 16 octobre).

### 2026-10-08
- **Sécurité, vie privée et accessibilité** (#1) : correction des failles d'injection, politique de sécurité du contenu
  (CSP), polices intégrées.
