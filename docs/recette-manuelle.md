# Recette manuelle de GanttPro

Ce document guide, pas à pas, la validation d'une mise à jour par le propriétaire du produit. Il est complété à
chaque évolution visible (règle 5 de `CLAUDE.md`) : **une mise à jour n'est livrée qu'avec son parcours à jour et
ses fichiers d'essai**.

## Comment l'utiliser

1. Ouvrez `GanttPro.html` (double-clic, aucun serveur nécessaire) dans un navigateur récent. Langue : français,
   sauf indication contraire.
2. Les projets d'essai sont dans `tests/fixtures/`. Ce sont de **faux projets** : aucune donnée réelle. On les ouvre
   par le bouton **Ouvrir** de la barre du haut. Si un projet est déjà ouvert et modifié, choisissez
   **Remplacer le projet ouvert** dans la fenêtre d'aperçu.
3. Chaque parcours indique l'état de départ, des actions numérotées et le résultat attendu. Cochez la case quand le
   résultat constaté est conforme. En cas d'écart, notez le numéro de l'étape et ce que vous voyez.
4. Les références (EF, RG, R-xx) renvoient au cahier des charges
   (<https://claude.ai/code/artifact/76a646d0-34e1-42f9-a540-a79b741f91d7>).
5. Les montants s'écrivent en unités, avec deux décimales au plus (`1 234,56` ou `1234.56`). Les espaces entre les
   groupes de chiffres sont des espaces insécables : ne cherchez pas à les reproduire à l'identique.

---

## Mise à jour : Budget, étape A

Exigences : EF-112 à EF-127, RG-35 à RG-43. Scénarios : R-71 à R-84.
Fichiers : `budget-base.json`, `budget-avec-baseline.json`, `budget-montants-geants.json`, `budget-sans-montant.json`,
`refus-montant-negatif.json`, `refus-montant-trop-grand.json`, `refus-jalon-avec-montant.json`, `tableur-montants.csv`.

### Parcours 1 — Un projet sans montant ne montre pas de budget (EF-117)

Départ : ouvrez `budget-sans-montant.json`.

- [ ] 1. Dans la liste, repérez la colonne **Budget / Réel**. *Attendu :* chaque tâche affiche `0,00 € / 0,00 €`.
- [ ] 2. Ouvrez **Tableau de bord**. *Attendu :* seulement deux onglets, **Synthèse** et **Charge** (pas d'onglet
  Budget). Fermez avec Échap.

### Parcours 2 — Saisir et lire les montants d'une tâche (EF-112, EF-113, EF-115, RG-35, RG-36, R-71)

Départ : ouvrez `budget-base.json`. Il contient deux tâches (Etude, Realisation) et un jalon.

- [ ] 1. Lisez la colonne **Budget / Réel**. *Attendu :* Etude `100,00 € / 90,00 €`, Realisation
  `300,00 € / 100,00 €`, le jalon est vide.
- [ ] 2. Cliquez sur **Etude** pour ouvrir sa fiche. *Attendu :* un groupe **Budget** avec les champs budget (`100`)
  et **Coût réel cumulé** (`90`), une aide sur le format du montant, et le texte qui précise que le coût réel
  compte les factures engagées ou payées.
- [ ] 3. Dans le budget, tapez `12,345` puis **Enregistrer**. *Attendu :* la fiche reste ouverte, le champ est
  signalé en erreur (deux décimales au plus).
- [ ] 4. Essayez `-5`, puis `abc`, puis `50 000 000 000,01`. *Attendu :* un message d'erreur clair à chaque fois
  (négatif refusé ; « écrire un montant » ; limite de `50 000 000 000,00` rappelée).
- [ ] 5. Tapez `1 234,56` dans le budget et `1234.5` dans le coût réel, puis **Enregistrer**. *Attendu :*
  `1 234,56 € / 1 234,50 €` sur la ligne.
- [ ] 6. Cliquez **Annuler** (barre du haut). *Attendu :* retour à `100,00 € / 90,00 €`.
- [ ] 7. Ouvrez la fiche du jalon. *Attendu :* aucun champ de budget ni de coût réel.

### Parcours 3 — L'onglet Budget et la courbe des coûts (EF-117, EF-118, EF-119, RG-37 à RG-40, R-72, R-74)

Départ : `budget-base.json` ouvert. La date du jour importe peu pour les chiffres ci-dessous (tuiles et catégories).

- [ ] 1. **Tableau de bord**, onglet **Budget**. *Attendu :* BAC `400,00 €`, Provision `40,00 €`, Budget total
  `440,00 €`, Coût réel total `190,00 €`, Reste `250,00 €`.
- [ ] 2. Lisez le tableau **Budget par catégorie**. *Attendu :* Etudes `400,00 €` / `190,00 €` / écart `210,00 €` ;
  Sans catégorie `0,00 €` ; Total `400,00 €` / `190,00 €` / `210,00 €`.
- [ ] 3. Repérez la **Courbe en S des coûts** avec sa note (le coût réel d'une tâche non terminée n'est pas dans la
  courbe ; la provision non plus). *Attendu :* la courbe est lisible, un titre et un résumé écrit l'accompagnent.
- [ ] 4. Cliquez sur **Afficher les valeurs**. *Attendu :* un tableau de valeurs cumulées apparaît (par semaine).
  Passez en **mois** : une seule ligne si le projet tient sur un mois.
- [ ] 5. Naviguez au clavier (Tab, Entrée) : tous les boutons de l'onglet sont atteignables, le focus est visible.

### Parcours 4 — Devise et provision (EF-114, RG-35)

Départ : `budget-base.json` ouvert.

- [ ] 1. Cliquez sur le nom du projet (en haut) pour ouvrir ses réglages. *Attendu :* **Symbole de la devise**
  (`€`) et **Provision globale** (`40`).
- [ ] 2. Videz la devise et enregistrez. *Attendu :* refus avec un message (1 à 5 caractères).
- [ ] 3. Saisissez `CHF` et provision `12,5`, enregistrez. *Attendu :* la liste affiche `100,00 CHF / 90,00 CHF`
  (symbole **après** le montant en français). L'onglet Budget indique `12,50 CHF` de provision.
- [ ] 4. Remettez `€` et `40`.

### Parcours 5 — Affichage compact des grands montants (EF-125, RG-43, R-83, R-84)

Départ : ouvrez `budget-montants-geants.json` (cinq tâches, du petit montant au plafond).

- [ ] 1. Lisez la colonne **Budget / Réel**. *Attendu :* `999 999,99 € / 0,00 €` (affiché en entier),
  `1 M € / 1,23 M €`, `1,23 M € / 0,00 €`, `2,5 Md € / 0,00 €`, `50 Md € / 50 Md €`.
  (En français : M = million, Md = milliard.)
- [ ] 2. Ouvrez la fiche de la tâche « Un million », champ coût réel. *Attendu :* le montant **complet**
  (`1234567,89`), jamais abrégé.
- [ ] 3. Onglet Budget du tableau de bord. *Attendu :* les tuiles et tableaux affichent les montants en entier
  (BAC `52 503 234 567,88 €`).
- [ ] 4. Passez en anglais (bouton de langue). *Attendu :* symbole **avant** le montant (`€1M`, `€2.5B`, `€50B`),
  séparateurs anglais ; milliard = `B`. Revenez en français.
- [ ] 5. (Facultatif, lecteur d'écran) Sur une ligne abrégée, le lecteur annonce le montant abrégé puis le
  montant complet entre parenthèses.

### Parcours 6 — Masquer les montants à l'écran (EF-126, RG-41, R-78)

Départ : `budget-base.json` ouvert.

- [ ] 1. Cliquez **Masquer les montants** (barre du haut). *Attendu :* le bouton paraît enfoncé ; la colonne
  affiche `••••` partout ; aucun chiffre de montant n'est visible.
- [ ] 2. Ouvrez la fiche d'Etude. *Attendu :* les champs budget et coût réel sont **désactivés**.
- [ ] 3. Ouvrez le tableau de bord, onglet Budget. *Attendu :* tuiles, tableau des catégories et valeurs de la
  courbe sont masqués.
- [ ] 4. Rechargez la page (F5). *Attendu :* le masquage est conservé (réglage mémorisé sur votre poste).
- [ ] 5. Cliquez de nouveau sur le bouton. *Attendu :* les montants reviennent. Le masquage n'a modifié aucune
  donnée (le bouton **Annuler** reste grisé).

### Parcours 7 — Baselines et BAC (EF-121, RG-39, R-75)

Départ : ouvrez `budget-avec-baseline.json` (une baseline à 400,00 €, le budget courant de Realisation passé à
350,00 €).

- [ ] 1. Ouvrez **Baselines**. *Attendu :* la colonne **BAC** affiche `400,00 €` pour la baseline ; la ligne
  « BAC du projet » indique `450,00 €`.
- [ ] 2. Capturez une nouvelle baseline. *Attendu :* son BAC est `450,00 €` ; la précédente reste inchangée.

### Parcours 8 — Rapport, impression et exports : « Inclure les montants » (EF-120, EF-124, RG-41, R-76)

Départ : `budget-avec-baseline.json` ouvert.

- [ ] 1. Ouvrez **Rapport**. *Attendu :* la case **Inclure les montants** est **décochée** ; aucun bloc Budget.
- [ ] 2. Cochez-la. *Attendu :* un bloc Budget apparaît (BAC `450,00 €`, provision `40,00 €`, budget total
  `490,00 €`, coût réel `190,00 €`, reste `300,00 €`). Avec la baseline, la variation du BAC est `+50,00 €`.
- [ ] 3. Fermez puis rouvrez le rapport. *Attendu :* la case est de nouveau **décochée**.
- [ ] 4. Faites de même avec **Imprimer le Gantt** : colonne montants seulement si la case est cochée.
- [ ] 5. **Exporter** en JSON **sans** cocher la case, puis ouvrez le fichier dans un éditeur de texte.
  *Attendu :* aucun champ `budget`, `actual`, `provision` ; la devise reste présente.
- [ ] 6. Exportez en JSON **avec** la case cochée. *Attendu :* les champs existent, en **centimes**
  (ex. `"budget": 10000` pour 100,00 €).
- [ ] 7. Exportez en CSV sans, puis avec. *Attendu :* colonnes Budget et Coût réel absentes, puis présentes avec
  deux décimales.
- [ ] 8. Activez **Masquer les montants**, exportez avec la case cochée. *Attendu :* le fichier contient bien les
  montants (le masquage ne concerne que l'écran).

### Parcours 9 — Importer un tableur avec montants (RG-42, R-77)

Départ : un projet quelconque ouvert.

- [ ] 1. Ouvrez `tableur-montants.csv`. L'assistant d'import s'affiche. *Attendu :* les colonnes **Budget** et
  **Coût réel** sont reconnues automatiquement.
- [ ] 2. Avancez jusqu'à l'avant-dernière étape. *Attendu :* un tableau d'avertissements liste les montants non
  pris en compte (`abc`, `99,999`) avec leur ligne.
- [ ] 3. Importez. *Attendu :* les trois tâches importées affichent `1 234,56 € / 10,00 €`, `0,00 € / 0,00 €`
  (montant invalide ignoré) et `250,50 € / 0,00 €` (le coût réel `99,999` est ignoré).

### Parcours 10 — Fichiers refusés (RG-37, R-77)

Départ : `budget-base.json` ouvert.

- [ ] 1. Ouvrez `refus-montant-negatif.json`. *Attendu :* une fenêtre d'erreur nomme la tâche et le champ
  `budget` ; le projet ouvert est **intact**.
- [ ] 2. Même chose avec `refus-montant-trop-grand.json` (limite de 5 000 000 000 000 centimes rappelée).
- [ ] 3. Même chose avec `refus-jalon-avec-montant.json` (« un jalon ou une récapitulative n'a ni budget ni coût
  réel propre »).

### Parcours 11 — Modification en masse (EF-116)

Départ : `budget-base.json` ouvert.

- [ ] 1. Ctrl + clic sur Etude et Realisation, puis **Modifier en masse**. *Attendu :* des champs budget et coût
  réel, vides par défaut (« garder »).
- [ ] 2. Budget `10`, **Appliquer**. *Attendu :* `10,00 €` en budget sur les deux lignes, coûts réels inchangés.
- [ ] 3. **Annuler** : un seul pas ramène aux montants d'origine.

### Parcours 12 — Infobulle des barres (EF-115)

Départ : `budget-base.json` ouvert.

- [ ] 1. Survolez la barre d'Etude. *Attendu :* l'infobulle contient une ligne avec budget et coût réel.
- [ ] 2. Activez le masquage et survolez de nouveau. *Attendu :* `••••` à la place des montants.

### Contrôle final de la mise à jour

- [ ] Aucune erreur visible, aucun message inattendu pendant les parcours.
- [ ] Navigation au clavier possible dans les nouvelles fenêtres et l'onglet Budget ; thème sombre lisible.
- [ ] Rien ne part vers l'extérieur (l'application fonctionne hors connexion).

Validé par : ______________________  Date : ____ / ____ / ________
