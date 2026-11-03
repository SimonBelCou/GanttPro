# Plan d'audit RGAA 4.1 de GanttPro

Plan de l'audit d'accessibilité demandé par l'exigence **EX-05** et l'écart **C.2 n° 4** de
`Specs_fonctionnelles.md`. Ce document **prépare** l'audit : il ne le réalise pas. Aucun critère n'y est évalué, et
GanttPro **ne peut afficher aucune mention de conformité** tant que l'audit et les essais avec des technologies
d'assistance n'ont pas eu lieu (EX-05).

- **Version du référentiel** : RGAA 4.1 (106 critères, 13 thématiques), qui reprend les WCAG 2.1 niveaux A et AA.
  Le référentiel officiel et sa méthode de test font foi ; ce plan les résume sans les remplacer. Vérifier avant
  l'audit que 4.1 est toujours la version en vigueur (non vérifié à la rédaction : pas de recherche faite).
- **Documents liés** : exigences d'accessibilité `Specs_fonctionnelles.md` §7.1 (EX-01 à EX-05), EF-15, EF-23,
  EF-40, EF-57, EF-78, EF-97, EF-107, EF-125 ; règles de code `CLAUDE.md` §10 et §13.8 ; recette manuelle
  `docs/recette-manuelle.md` (G14, G15) ; règles de l'INR `.claude/regles-nr/regles-nr.md`.
- **Données** : uniquement les faux projets de `tests/fixtures/` (CLAUDE.md §13.9). Aucune donnée réelle dans la
  grille de résultats, les captures ni les enregistrements.

## 1. Ce qui existe déjà

| Contrôle | Portée | Limite |
| --- | --- | --- |
| `axe_check` (axe-core 4.14.0, balises `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) dans `tests/test_v3*.py` | Vue principale (clair et sombre), plein écran du Gantt, panneau d'édition, fiche de tâche, filtres, modification en masse, chaque fenêtre (Calendrier, Baselines, Ressources, fiche de ressource, Résoudre les conflits, Versions, Colonnes, Export, Aperçu d'import, Assistant d'import, Impression, confirmations), tableau de bord et ses onglets Charge et Budget, rapport, bande d'onglets, premier lancement, états « montants masqués » | Chromium seul ; vérifie ce qu'une machine peut décider (environ un tiers des critères, et seulement leur partie mécanique) ; rien sur la pertinence d'un texte, l'ordre de lecture, l'annonce par un lecteur d'écran, la qualité d'un nom accessible |
| Contrôles du build (`tools/build.py`) | Pas de gestionnaire inline, pas de `style=` | Sans lien direct avec le RGAA |
| Recette manuelle G15 | Clavier seul, lecteur d'écran « si disponible », zoom 200 %, `prefers-reduced-motion` | Parcours court, sans méthode ni trace des constats |
| Revue de diff (`accessibilite-check`) | Chaque pull request touchant `src/` | Revue de code, pas d'audit de rendu |

**Écarts déjà connus** (à reprendre dans la grille, statut `NC` ou `NA` à confirmer) :

1. L'image PNG exportée du Gantt n'a pas d'alternative textuelle (EF-97, C.2 n° 4). La fenêtre d'export recommande le
   tableur ou le rapport.
2. Les montants masqués s'écrivent « •••• » avec le nom accessible « montant masqué » : la **décision** sur ce libellé
   est en attente (voir §5.3).
3. Aucun essai avec un lecteur d'écran n'a été fait.

## 2. Périmètre et échantillon

**Périmètre.** L'application `GanttPro.html` ouverte dans un navigateur, en **français puis en anglais** (la langue
change l'attribut `lang`, EF-103), thèmes **clair et sombre**, avec et sans montants masqués. Hors périmètre :
les documents `docs/*.md` (le guide utilisateur est un fichier Markdown du dépôt, pas une page de l'application ;
à auditer séparément s'il est publié sous forme de page web) et les fichiers exportés (tableur, MS Project, JSON ;
leur accessibilité propre est un sujet distinct, voir §5.2 pour le PNG).

**Échantillon.** L'application tient en une seule page : l'échantillon est donc la liste des **états d'écran**.
Il est volontairement exhaustif (pas de tirage au sort). Chaque ligne indique le fichier d'essai à ouvrir par
**Importer** ; « (neuf) » = projet vide au premier lancement.

| N° | Écran ou fenêtre | Comment l'obtenir | Fichier d'essai |
| --- | --- | --- | --- |
| E01 | Premier lancement et message d'accueil | Nouvel onglet sans donnée enregistrée | (neuf) |
| E02 | Écran principal : barre d'onglets, barre d'outils, indicateurs, alertes, recherche et filtres, liste, Gantt, légende | Ouvrir le projet | `projet-exemple.json` |
| E03 | Gantt en vue jour, semaine, mois ; plein écran ; liens, jalons, chemin critique, barres de baseline | Boutons de vue et de zoom | `projet-atlas-budget.json` |
| E04 | Gantt avec conflits de ressources, décalages, absences | Ouvrir le projet | `projet-surcharge.json` |
| E05 | Gantt avec tâche en retard, voyant rouge | Ouvrir le projet | `projet-retard.json` |
| E06 | Panneau d'édition d'une tâche (groupe Budget compris) | Sélectionner une tâche | `projet-atlas-budget.json` |
| E07 | Sélection multiple, barre d'actions, modification en masse | Ctrl + clic, Ctrl + A | `projet-exemple.json` |
| E08 | Fenêtres de saisie : projet (nom, emoji, devise, provision, seuils), Calendrier, Colonnes, Ressources, fiche de ressource, Catégories, Étiquettes | Barre d'outils | `projet-atlas-budget.json`, `colonnes-personnalisees.json` |
| E09 | Baselines (dix baselines, référence, colonne BAC) et Versions | Barre d'outils | `valeur-acquise-derive.json`, `budget-avec-baseline.json` |
| E10 | Résoudre les conflits | Barre d'outils | `projet-surcharge.json` |
| E11 | Tableau de bord, onglet **Synthèse** (indicateurs, courbe en S, tableau des valeurs) | Bouton Tableau de bord | `projet-retard.json` |
| E12 | Tableau de bord, onglet **Charge** (barres, surcharge, absences, tableau des valeurs) | Idem | `projet-surcharge.json` |
| E13 | Tableau de bord, onglet **Budget** (indicateurs, courbe des coûts, valeur acquise, points de situation, tableau) | Idem | `projet-atlas-budget.json`, `valeur-acquise-passe.json` (indices calculés), `valeur-acquise-futur.json` (« non calculable ») |
| E14 | Rapport d'état (choix des blocs, note, copie) | Bouton Rapport | `projet-retard.json` |
| E15 | Impression : fenêtre de choix et aperçu navigateur | Bouton Imprimer, puis « noir et blanc » | `projet-atlas-budget.json` |
| E16 | Export (formats, « Inclure les montants », image PNG) | Bouton Exporter | `projet-atlas-budget.json` |
| E17 | Import : aperçu d'import, assistant tableur, collage de lignes, mot de passe, refus | Bouton Importer, Coller | `tableur-montants.csv`, `budget-sans-montant.json`, `refus-montant-negatif.json`, `refus-jalon-avec-montant.json` |
| E18 | Onglets de projet, « Nouveau projet à partir d'un modèle », bibliothèque, enregistrement d'un modèle | Bande d'onglets, « + » | `projet-exemple.json` |
| E19 | Réglages (langue, thème, raccourcis au survol, sauvegarde automatique, protection, effacement), récupération après fermeture | Bouton Réglages | `projet-exemple.json` |
| E20 | Aide et à propos, déclaration d'accessibilité (EF-57) | Bouton Aide ou « ? » | — |
| E21 | Confirmations et messages (suppression, « Fermer sans enregistrer ? », limites, erreurs de valeur) | Provoquer chaque cas | `projet-exemple.json`, `refus-montant-trop-grand.json` |
| E22 | Montants masqués (« •••• ») sur E02, E06, E09, E13, E14 | Bouton « Masquer les montants » | `projet-atlas-budget.json`, `budget-montants-geants.json` (montants abrégés) |
| E23 | Projet volumineux (fluidité au clavier et au lecteur d'écran) | Ouvrir le projet | `projet-1000-taches.json` |
| E24 | Contenus piégés affichés comme du texte | Ouvrir le projet | `projet-noms-pieges.json` |

L'ensemble E01 à E24 est audité **dans les deux langues et les deux thèmes** pour les critères qui en dépendent
(contrastes, langue, libellés) ; les autres critères sont jugés une fois, en français.

## 3. Méthode par thématique

**Statuts** : `C` conforme, `NC` non conforme, `NA` non applicable (avec la raison). Un critère est `C` seulement si
**tous** les tests de sa méthode officielle réussissent sur **tous** les écrans où il s'applique ; un seul échec
donne `NC` pour le critère, noté avec l'écran concerné.

**Lecture des colonnes.** *axe-core en CI* : ce que la CI vérifie déjà (jamais suffisant seul). *Reste manuel* : ce qu'il
faut juger. Les nombres de critères sont ceux du RGAA 4.1 ; l'identification des critères non applicables est une
**hypothèse à confirmer** par l'auditeur, écran par écran.

| Th. | Thématique (critères) | axe-core en CI | Reste manuel | Non applicable (hypothèse et raison) |
| --- | --- | --- | --- | --- |
| 1 | **Images** (9) | Présence d'un `alt` ou d'un nom sur `img`, `svg[role=img]`, `input[type=image]`, zones | Pertinence des alternatives ; images décoratives bien ignorées (flèches de liens du Gantt en SVG `aria-hidden`, bandes de dates réelles, hachures) ; images-objets et CAPTCHA ; légendes d'images ; **courbes (S et coûts) et barres de charge : alternative détaillée** (tableaux des valeurs, EF-40, EF-87) | 1.4, 1.5, 1.6 en partie : pas de CAPTCHA, pas de légende d'image ; 1.7 à 1.9 si aucune image porteuse d'information n'a de description longue ni de légende |
| 2 | **Cadres** (2) | Titre des `iframe` | — | **Thématique entière NA** : aucun `iframe` ni `frame` (à confirmer par recherche dans le DOM de chaque écran) |
| 3 | **Couleurs** (3) | Contraste du texte (3.2) dans l'état affiché | 3.1 : information jamais portée par la seule couleur (chemin critique ●, statut, surcharge ▲, retard, voyant du rapport, barres de baseline, séries des courbes) ; 3.2 dans **tous** les états (survol, focus, désactivé, thème sombre, texte sur barre colorée par une catégorie choisie par l'utilisateur) ; 3.3 contraste des composants d'interface et graphiques ≥ 3:1 | Aucun |
| 4 | **Multimédia** (13) | — | — | **Thématique entière NA** : aucun son, aucune vidéo, aucun média temporel ni synchronisé (CLAUDE.md §13.9 : aucune ressource externe) |
| 5 | **Tableaux** (8) | En-têtes liées aux cellules, `scope`, structure de base | 5.1 à 5.3 : tableaux de données ou de mise en page ? (les tableaux des valeurs et du rapport sont des tableaux de données ; la liste des tâches est-elle un tableau, une grille ARIA ou des listes ?) ; titre (5.4, 5.5), en-têtes (5.6, 5.7), tableaux linéarisés (5.8) | 5.1, 5.2 si le Gantt et la liste ne sont pas des tableaux complexes ; 5.8 si aucun tableau de mise en page |
| 6 | **Liens** (2) | Nom accessible d'un lien, lien vide | 6.1 : intitulé explicite hors contexte (liens de l'aide, de la déclaration, du dépôt) ; 6.2 | Possible NA 6.1 sur l'écran principal : peu ou pas de liens, tout est bouton |
| 7 | **Scripts** (5) | Rôles et propriétés ARIA valides, états obligatoires, noms | 7.1 : alternative aux scripts ; 7.2 ; 7.3 : **tout au clavier** (barres, jalons, poignées de colonnes, zone de dépôt, choix de couleurs, glisser-déposer) ; 7.4 : changement de contexte non annoncé ; 7.5 : **messages de statut** (zone `role="status"`, `aria-live`, alertes de champ) | Aucun : l'application est entièrement scriptée |
| 8 | **Éléments obligatoires** (10) | 8.1 doctype, 8.3 `lang`, 8.5 titre de page non vide, 8.2 validité (partielle) | 8.2 : validation du HTML produit par le DOM (validateur W3C sur le DOM après rendu) ; 8.4 : pertinence de la langue (mise à jour au changement de langue, EF-103) ; 8.6 : titre pertinent (change-t-il avec le projet ?) ; 8.7 et 8.8 : **changements de langue dans le contenu** (noms de tâches saisis dans une autre langue, termes de l'aide) ; 8.9 : balises non détournées ; 8.10 : sens de lecture | 8.7, 8.8 possibles NA si aucun passage dans une autre langue que celle de l'interface (les contenus saisis par l'utilisateur ne sont pas du contenu de l'éditeur : à trancher) |
| 9 | **Structuration** (4) | Titres : ordre et vides ; landmarks : unicité, contenu hors repères ; listes | 9.1 : hiérarchie de titres (un `h1` ; titres des fenêtres et du rapport) ; 9.2 : structure du document (en-tête, navigation, contenu principal) ; 9.3 : listes bien balisées ; 9.4 : citations | 9.4 NA (aucune citation) |
| 10 | **Présentation de l'information** (14) | 10.4 (partiel), 10.7 (partiel), 10.20 | 10.1 : feuilles de style (pas de `style=` : garanti par le build) ; 10.2 : contenu sans CSS ; 10.3 : ordre de lecture sans CSS ; 10.4 : **zoom texte 200 %** ; 10.5 : couleurs de fond et de texte en CSS ; 10.6 : liens distinguables ; 10.7 : **focus visible** ; 10.8 : contenu caché à bon escient ; 10.9 : information non portée par la forme seule ; 10.10 à 10.12 : **reflow, espacement du texte, 320 px** ; 10.13 : contenu au survol ou au focus (infobulle EF-23 : écartable, survolable, persistante) ; 10.14 : contenu additionnel au focus | 10.8 en partie : à confirmer |
| 11 | **Formulaires** (13) | Étiquette associée à chaque champ, `autocomplete` valide, noms des boutons | 11.1 à 11.4 : pertinence et proximité des étiquettes ; 11.5, 11.6 : regroupements (`fieldset`, `legend`) ; 11.7 : légendes ; 11.8 : regroupements de listes ; 11.9 : intitulés des boutons ; 11.10 à 11.11 : **contrôle de saisie** (EX-06 : message près du champ, annoncé, saisie conservée) ; 11.12 : données sensibles (suppressions, remplacement d'un projet modifié : annulation ou confirmation) ; 11.13 : finalité des champs (`autocomplete`) | 11.12 en partie : aucune donnée financière ni juridique saisie dans un service ; la confirmation de suppression reste à examiner |
| 12 | **Navigation** (11) | Lien d'évitement présent et cible valide | 12.1 : deux systèmes de navigation au moins (ici, un seul écran : à justifier) ; 12.2 à 12.5 : menu, plan, moteur de recherche, accès rapide ; 12.6 : zones regroupées (repères) ; 12.7 : lien d'évitement ; 12.8 : **ordre de tabulation** ; 12.9 : **absence de piège clavier** (fenêtres : focus piégé volontairement, Échap sort) ; 12.10 : raccourcis à touche unique (« / », « ? », + et − : désactivables ou limités au focus, WCAG 2.1.4) ; 12.11 : contenus additionnels atteignables au clavier | 12.1 à 12.5 : **NA probable** (application d'une seule page : la barre d'outils et la recherche de tâches ne sont pas une « navigation entre pages » ; l'auditeur tranche) |
| 13 | **Consultation** (12) | Rafraîchissement automatique absent (`meta refresh`) | 13.1 : limite de temps (sauvegarde automatique, messages qui disparaissent : durée suffisante ou contrôle) ; 13.2 : ouverture de nouvelle fenêtre ; 13.3 : documents bureautiques téléchargeables (**exports : tableur, MS Project, PNG**, voir §5.2) ; 13.4, 13.5 : documents en téléchargement ; 13.6 : contenus cryptiques ; 13.7 : **changements brusques de luminosité, clignotements** ; 13.8 : contenus en mouvement (`prefers-reduced-motion`, animation arrêtable) ; 13.9 : orientation ; 13.10 : gestes complexes (**glisser-déposer**, appui long) ; 13.11 : actions au pointeur annulables (`Échap`, bouton Annuler du message) ; 13.12 : mouvement de l'appareil | 13.4, 13.5 si aucun document en téléchargement sur la page ; 13.2 si aucune ouverture de fenêtre ; 13.9, 13.12 probables NA (pas de capteur) |

Pour chaque critère d'une thématique non évaluée à 100 % par axe-core, l'auditeur applique les **tests de la méthode
officielle** du critère (RGAA 4.1, « Méthodologie de test »), pas seulement la description ci-dessus.

## 4. Protocole manuel

Chaque passe s'applique aux écrans de l'échantillon (§2) qui s'y prêtent ; la grille (§6) indique pour chaque constat
la passe qui l'a produit.

| Passe | Outil et réglage | Ce qu'on regarde | Écrans |
| --- | --- | --- | --- |
| P1 Clavier seul | Chromium puis Firefox, souris débranchée ou ignorée | Tab / Maj + Tab suit l'ordre visuel ; focus visible partout ; Entrée et Espace activent ; Échap ferme et **rend le focus** à l'élément d'origine ; aucun piège ; chaque action à la souris a son équivalent (EX-01), notamment : **Alt + flèches** (date), **Alt + Maj + flèches** (durée), **poignées de colonnes** (flèches), choix de couleur, ouverture de la zone de dépôt d'import | E01 à E22 |
| P2 NVDA + Firefox | Windows, NVDA à jour, voix française puis anglaise ; lecture par flèches, par titres (H), par repères (D), liste des éléments (Insert + F7), mode formulaire | Noms, rôles, états annoncés ; fenêtre annoncée avec son titre ; messages de la zone `role="status"` ; barres du Gantt (nom complet : tâche, dates, statut, criticité, décalage, baseline) ; tableaux des valeurs ; onglets du tableau de bord (flèches) ; « montant masqué » | E02 à E22 |
| P3 NVDA + Chrome | Idem | Mêmes contrôles ; noter les écarts entre navigateurs (un défaut propre à un couple navigateur / lecteur est consigné, avec le couple) | Mêmes écrans |
| P4 VoiceOver + Safari | macOS, **si disponible** (sinon `NA` dans la grille, avec la mention « non essayé ») | Mêmes contrôles, rotor | E02, E06, E08, E11, E20 |
| P5 Zoom et reflow | Zoom navigateur 200 % puis 400 % (équivaut à 320 px de large) ; largeur 320 px et 375 px ; orientation portrait et paysage | Rien de coupé, pas de défilement à deux dimensions (hors Gantt, dont le défilement horizontal est inhérent : le noter), toutes les fonctions atteignables, fenêtres entières visibles | E02 à E21 |
| P6 Espacement du texte | Favelet ou extension qui force interlignage 1,5, paragraphes 2, lettres 0,12, mots 0,16 | Aucune perte de contenu ni de fonction | E02, E06, E08, E11 |
| P7 Contrastes | Outil de contraste (exemples : Colour Contrast Analyser, ou l'inspecteur du navigateur), mesure **par état** : normal, survol, focus, désactivé, sélectionné | Texte ≥ 4,5:1 (≥ 3:1 si grand), composants d'interface et graphiques ≥ 3:1 (EX-03), **dans les deux thèmes** ; texte sur barre colorée par une catégorie (couleur choisie par l'utilisateur : tester les 10 teintes de la palette) | E02 à E22, en clair et en sombre |
| P8 Sans couleur | Niveaux de gris ou simulateur de daltonisme ; impression « noir et blanc » | Critique, réalisé, jalon, retard, surcharge, baseline distinguables sans couleur | E03, E04, E05, E11 à E15 |
| P9 Mouvement | Réglage système « réduire les animations » | Animations arrêtées ou réduites ; aucun clignotement (> 3 par seconde) ; la barre de progression et les transitions s'arrêtent | E02, E11, E19 |
| P10 Petits écrans et tactile | Téléphone ou émulation 375 px, écran tactile | Cibles ≥ 24 × 24 px (WCAG 2.2, à titre indicatif) ; appui long (0,3 s) pour saisir une barre : alternative disponible ; pas de geste à plusieurs doigts | E02, E06, E11 |
| P11 Sans CSS ni script | Désactiver la feuille de style (extension) ; le script est indispensable (application entièrement scriptée : critère 7.1 à examiner avec soin) | Ordre de lecture ; contenu compréhensible | E02, E20 |
| P12 Validation du DOM | Validateur de balisage sur le DOM après rendu de chaque écran, et revue des identifiants uniques | 8.2, `id` dupliqués, ARIA invalide | E01 à E22 |
| P13 Relecture des textes | Relecture par une personne non spécialiste | Libellés clairs, messages d'erreur utiles (EX-06), noms de boutons-icônes qui contiennent le texte visible | E02, E06, E17, E21 |

Navigateurs et versions utilisés, et couples lecteur d'écran / navigateur, sont **consignés dans la grille** (§6) pour
que l'audit puisse être rejoué.

**Essai avec des utilisateurs** (EX-05, deuxième volet). Au moins **trois** personnes utilisant au quotidien une
technologie d'assistance (lecteur d'écran, navigation clavier ou commande vocale, loupe d'écran), sur quatre
tâches types : ouvrir un projet d'essai et trouver la tâche en retard ; ajouter une tâche et la lier ; lire le
rapport d'état ; exporter en tableur. Recrutement, accord de participation et restitution sont à définir ; aucune
donnée personnelle des participants n'entre dans le dépôt (CLAUDE.md §3), la restitution se fait par rôle
(« participant 1, lecteur d'écran »).

## 5. Points de vigilance propres à GanttPro

### 5.1 Le diagramme de Gantt et son équivalent textuel

- Les barres sont des éléments HTML `role="button"`, `tabindex="0"`, dont le **nom accessible** donne tâche, dates,
  statut, criticité, décalage et baselines (EF-15, EF-34, EF-106). Les liens entre tâches sont tracés en SVG
  `aria-hidden` : leur information existe-t-elle ailleurs (colonne « Dépendances », champ de l'édition) ? À vérifier
  critère 1.1/1.2 et 3.1.
- **Équivalent textuel de l'ensemble** : la liste des tâches (colonnes choisies), le panneau d'édition et le rapport
  d'état portent la même information en texte. L'auditeur vérifie que **rien n'existe seulement sur le Gantt**.
- La région « Diagramme de Gantt » est focalisable (`tabindex="0"`) : vérifier son rôle, son nom, l'annonce de sa
  navigation et la lecture de ses ~1 000 barres (E23) sans surcharge du lecteur d'écran.
- **Courbes** (S, coûts) et **barres de charge** : alternative par « Afficher les valeurs » (EF-40, EF-87). Vérifier que
  le tableau est complet (toutes les séries, y compris baselines), qu'il est atteignable au clavier, qu'il porte un
  titre et des en-têtes.
- **Infobulle** (EF-23) : critère 10.13 (écartable par Échap, survolable, persistante) ; mêmes informations dans le
  panneau d'édition.

### 5.2 Export PNG non accessible

L'image du Gantt (EF-97) ne peut avoir d'alternative textuelle intégrée. L'audit constate le fait (`NC` ou `NA`
selon que l'auditeur considère le fichier exporté comme faisant partie du service, critères 13.3 à 13.5) et vérifie
que : la fenêtre d'export **dit** que l'image n'est pas accessible ; elle **propose** le tableur ou le rapport
(équivalents accessibles) ; le rapport d'état, copiable en texte, couvre bien les informations du Gantt. Piste de
correction à instruire plus tard (hors plan) : texte alternatif ou description jointe au fichier.

### 5.3 Montants masqués « •••• » (décision en attente)

Le masquage remplace les montants par « •••• » de nom accessible « montant masqué » (EF-125, RG-41). À examiner :
(a) la lecture par NVDA est-elle compréhensible et non répétitive dans une liste de 49 lignes ? (b) l'information
« il existe un montant » est-elle utile ou bruyante ? (c) le bouton à bascule annonce-t-il son état ? La
**décision** (libellé, annonce, ou suppression de la valeur dans l'arbre d'accessibilité) est celle du propriétaire du
produit ; elle sera consignée au journal des arbitrages (`Specs_fonctionnelles.md`, annexe C) après l'audit. Même
examen pour les montants abrégés (« 1,23 M », nom accessible complet, RG-43 ; fichier `budget-montants-geants.json`).

### 5.4 Glisser-déposer et alternative au clavier

Les gestes sur le Gantt (déplacer une barre, changer sa durée, créer un lien), le glisser-déposer de lignes de la liste
et la zone de dépôt d'import ont des équivalents : **Alt + flèches** (date), **Alt + Maj + flèches** (durée),
**Mettre en retrait / Remonter / Monter / Descendre** (EF-60, EF-86), liens dans l'édition, bouton **Importer**.
L'auditeur vérifie, critères 7.3, 13.10, 13.11 : (a) chaque geste a une alternative **annoncée** (aide, raccourcis
au survol, EX-35) ; (b) l'appui long tactile (0,3 s) n'est pas indispensable ; (c) Échap abandonne un geste en cours ;
(d) le résultat d'un geste est annoncé (message avec « Annuler »).

### 5.5 Autres points

- **Fenêtres** (`Dialog.open`) : dialogue natif titré, focus piégé, Échap, focus rendu (EX-02, EF-107). Contrôler la
  superposition de deux fenêtres (confirmation au-dessus d'une fenêtre de saisie) : où va le focus, que lit NVDA ?
- **Raccourcis à touche unique** (« / », « ? », + et −) : critère 12.10 ; inactifs en saisie (EF-58), à confirmer ; prévoir
  de les rendre désactivables si l'audit le demande.
- **Messages** (`role="status"`, toasts avec « Annuler ») : durée suffisante (13.1), non perdus pour un lecteur
  d'écran.
- **Couleurs choisies par l'utilisateur** (catégories, ressources) : le contraste du texte sur ces couleurs n'est pas
  garanti par construction ; consigner la limite dans la déclaration si elle est avérée.
- **Langue** : le changement immédiat de langue met à jour `lang` (EF-103) ; contrôler que le focus et la position de
  lecture ne sont pas perdus.
- **Impression** (E15) : lisible sans couleur (hachures, contours) ; hors RGAA strict, noté en observation.
- **Performance** : 1 000 tâches (E23), `PERF_FACTOR` en test ; un lecteur d'écran sur un DOM volumineux peut être
  inutilisable même si chaque critère est `C` : consigner en observation.

## 6. Grille de résultats

Un fichier de résultats par audit, créé à côté de ce plan : `docs/audit-rgaa-AAAA-MM.md` (tableau Markdown) ou un
tableur de même structure. Il commence par l'en-tête de contexte, puis la grille.

**En-tête de contexte**

| Champ | Valeur |
| --- | --- |
| Date de l'audit | `<AAAA-MM-JJ>` |
| Version de GanttPro et empreinte du fichier | `<3.x.y>` / `<SHA-256 de GanttPro.html>` |
| Référentiel | RGAA 4.1 |
| Navigateurs et versions | `<Chromium n>`, `<Firefox n>`, `<Safari n si disponible>` |
| Lecteurs d'écran et versions | `<NVDA n + Firefox n>`, `<NVDA n + Chrome n>`, `<VoiceOver n + Safari n>` |
| Système | `<Windows n>`, `<macOS n>` |
| Auditeur (rôle) | `<rôle>`, jamais un nom |

**Grille** (une ligne par critère et par constat ; un critère `C` ou `NA` tient sur une ligne)

| Critère | Thème | Statut | Écran(s) | Passe | Constat | Gravité | Correction proposée | Suivi |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | Images | `C` / `NC` / `NA` | E02, E11 | P2 | Ce qu'on a vu ou entendu, avec le couple navigateur / lecteur | Bloquante / Majeure / Mineure | Ce qu'il faut changer | Lien vers l'issue ou la pull request |

- **Gravité** : *bloquante* = empêche d'accomplir une tâche ; *majeure* = la tâche reste possible avec effort ;
  *mineure* = gêne.
- Un constat `NC` donne **une issue GitHub** (étiquette `accessibilité`) avec le critère, l'écran, la procédure pour
  reproduire (fichier d'essai), l'attendu.
- Les critères `NA` portent leur raison ; elle est relue avant de signer l'audit.
- **Taux de conformité** (pour la déclaration) : critères `C` ÷ (critères `C` + `NC`), calculé sur les 106 moins les
  `NA`, avec le détail par thématique. Ce chiffre n'est publié qu'accompagné des limites (§7).

## 7. Déclaration d'accessibilité (format cible)

La déclaration est déjà annoncée par EF-57 (fenêtre Aide) ; son état actuel ne dit **pas** « conforme ». Après
l'audit, elle suit la structure du modèle officiel (obligation des services publics, reprise ici par bonne pratique)
et vit dans la fenêtre d'aide (FR et EN) et dans `README.md` ; une seule source, l'autre renvoie à elle (CLAUDE.md §8).

1. **Identité** : GanttPro, éditeur de diagramme de Gantt autonome, adresse du dépôt.
2. **État de conformité** : *totalement*, *partiellement* ou *non conforme* au RGAA 4.1, avec le taux (§6) et la date.
3. **Résultats des tests** : nombre de critères conformes, non conformes, non applicables ; navigateurs et lecteurs
   d'écran utilisés ; date et rôle de l'auditeur (jamais un nom).
4. **Contenus non accessibles** : *non-conformités* (liste issue de la grille), *dérogations pour charge
   disproportionnée* (aucune par défaut), *contenus non soumis* (fichiers exportés, image PNG avec renvoi au tableur ou
   au rapport).
5. **Établissement de la déclaration** : date, méthode (ce plan), échantillon (§2).
6. **Retour d'information et contact** : moyen de signaler un défaut (EX-05) : onglet *Issues* du dépôt, ou adresse
   générique à créer (jamais une adresse personnelle).
7. **Voies de recours** : mention du recours auprès du Défenseur des droits, telle que le modèle officiel la formule
   (texte à reprendre du modèle en vigueur au moment de la rédaction).
8. **Prochaine révision** : à chaque évolution visible de l'interface (au moins une revue ciblée) et au plus tard un an
   après le dernier audit.

Tant que l'audit n'est pas fait, la déclaration reste : « Non évalué. Contrôle automatique axe-core sur chaque
fenêtre ; audit RGAA et essai avec technologies d'assistance prévus (EX-05). »

## 8. Qui fait quoi et durée estimée

| Rôle | Tâches |
| --- | --- |
| **Propriétaire du produit** | Valide ce plan et l'échantillon ; tranche les arbitrages en attente (montants masqués, raccourcis à touche unique, critères NA discutables) ; recrute ou désigne les testeurs ; valide la déclaration |
| **Auditeur accessibilité** (interne formé au RGAA, ou prestataire) | Réalise les passes P1 à P13 ; remplit la grille ; calcule le taux ; rédige le projet de déclaration |
| **Utilisateurs de technologies d'assistance** (≥ 3) | Essai sur les tâches types (§4) ; restituent leurs difficultés |
| **Développeur** (ou assistant IA sous contrôle) | Prépare l'environnement et les fichiers d'essai ; corrige les non-conformités (une pull request par lot, avec un test de plus, CLAUDE.md §7) ; met à jour `Specs_fonctionnelles.md`, `CHANGELOG.md`, la recette |
| **Relecteur** | Contre-vérifie par sondage 20 % des critères `C` (au moins un par thématique) |

| Étape | Durée estimée (jours-personne) | Remarque |
| --- | --- | --- |
| Préparation (environnement, fichiers d'essai, outils, revue du plan) | 1 | Les fichiers d'essai existent presque tous ; E01, E21 à compléter |
| Audit : thématiques 1 à 4, 6, 8, 9, 12, 13 (passes P1, P11, P12, P13) | 3 | Beaucoup de `NA` et de contrôles de structure |
| Audit : thématiques 3, 5, 10, 11 (P5 à P10) | 3 | Contrastes dans 2 thèmes × 2 langues, reflow, formulaires de toutes les fenêtres |
| Audit : thématique 7 et 13.10 (P2 à P4) | 3 | NVDA × 2 navigateurs sur 24 écrans ; VoiceOver en plus si disponible (+1) |
| Essai avec utilisateurs (3 personnes, restitution) | 2 | Hors recrutement |
| Rédaction du rapport, taux, issues | 2 | |
| Contre-vérification | 1 | |
| **Total audit** | **≈ 15 jours-personne**, soit 3 à 4 semaines calendaires | Estimation d'ordre de grandeur, à recaler après la première thématique |
| Corrections | à estimer après l'audit | Nouvelle passe ciblée sur les critères `NC` (≈ 20 % de l'audit) |

## 9. Livrables et déclenchement

1. `docs/audit-rgaa-AAAA-MM.md` : en-tête et grille complets.
2. Une issue par non-conformité, une pull request par lot de corrections.
3. Déclaration d'accessibilité mise à jour (§7) et écart C.2 n° 4 clos dans `Specs_fonctionnelles.md` (journal des
   arbitrages daté).
4. Parcours G15 de `docs/recette-manuelle.md` mis à jour avec les points durablement utiles.

**Quand lancer l'audit** : une fois la recette manuelle des chantiers en cours validée (le fichier de l'application
audité est celui de la version publiée), et avant toute mention de conformité. Rejouer au moins une revue ciblée à
chaque évolution visible de l'interface.

## 10. Journal de ce plan

| Date | Changement |
| --- | --- |
| 3 novembre 2026 | Rédaction initiale (aucun audit réalisé). |
