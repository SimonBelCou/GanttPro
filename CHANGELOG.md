# Journal des changements

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Chaque entrée renvoie à la pull request qui l'a
livrée. L'application affiche la version `3.0.0` (constante `APP_VERSION` de `src/js/ui/87-settings.js`) ; le dépôt
n'a pas encore d'étiquette Git de version : le versionnement de l'application et du format de fichier est un chantier
prévu (Specs_fonctionnelles.md, annexe A.8, ligne 8).

À chaque modification : ajouter une ligne sous « Non publié » dans la même pull request (CLAUDE.md §13.6).

## Non publié

### Corrections
- **Clic perdu sous Safari / WebKit** : après la saisie d'un champ (date de début du projet), le premier clic sur un
  bouton de la barre d'outils (thème, langue, liens, liste) n'était pas pris en compte, car `render()` réécrivait le
  texte du bouton entre l'appui et le relâchement. `setText()` n'écrit un texte que s'il change. Test :
  `tests/test_v3_clic_change.py` (échouait sous WebKit avant la correction). Révélé par le job WebKit.

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
