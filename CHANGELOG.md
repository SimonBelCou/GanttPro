# Journal des changements

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Chaque entrée renvoie à la pull request qui l'a
livrée. L'application affiche la version `3.0.0` (constante `APP_VERSION` de `src/js/ui/87-settings.js`) ; le dépôt
n'a pas encore d'étiquette Git de version : le versionnement de l'application et du format de fichier est un chantier
prévu (Specs_fonctionnelles.md, annexe A.8, ligne 8).

À chaque modification : ajouter une ligne sous « Non publié » dans la même pull request (CLAUDE.md §13.6).

## Non publié

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

### Budget, étape C (PR #14, en attente de la recette par fiches `docs/recettes/` (Taux 1 à 15))
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

## 3.0.0

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
