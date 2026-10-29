# Faire créer ou modifier un projet GanttPro par une IA

Ce guide donne deux **prompts prêts à l'emploi** : l'un pour créer le fichier d'un projet à partir de vos notes, l'autre pour
mettre à jour un projet existant après une réunion. L'IA produit un fichier JSON ; GanttPro le **contrôle champ par champ** à
l'import et le refuse en entier, avec un message précis, s'il est incorrect. Rien n'est appliqué avant que vous ayez validé l'aperçu.

> Ce guide complète le [guide utilisateur](guide-utilisateur.md). Le format décrit ici est celui de la version 3 de GanttPro
> (les limites sont celles de l'application).

## Avant de commencer : vos données

- **Une IA en ligne est un service tiers.** Ce que vous collez dans le prompt (notes de réunion, noms de personnes, noms de projets)
  est transmis à ce service. Les noms de ressources sont des **données personnelles** : utilisez des prénoms, des initiales ou des
  fonctions (« Dev 1 », « Chef de projet »), et vérifiez la politique de votre organisation avant d'envoyer des informations
  confidentielles.
- GanttPro, lui, ne transmet rien : l'import se fait en local, dans votre navigateur.
- Relisez toujours le résultat. L'IA peut se tromper sur une durée, un lien ou une date ; l'aperçu d'import et le chemin critique
  de GanttPro sont là pour le vérifier.

## Le déroulé

1. Copiez le prompt qui correspond à votre cas (A ou B), complétez les parties entre crochets `[…]`.
2. Collez-le dans l'IA de votre choix. Pour le prompt B, collez aussi le JSON exporté de GanttPro (**Exporter**, format « Projet GanttPro (.json) »).
3. Enregistrez la réponse dans un fichier `projet.json` (texte brut, encodage UTF-8, sans le texte autour).
4. Dans GanttPro : **Importer** (ou déposez le fichier sur la fenêtre), lisez l'aperçu, puis choisissez d'ouvrir le projet dans un
   nouvel onglet ou de remplacer le projet ouvert.
5. Si GanttPro refuse le fichier, copiez le message d'erreur à l'IA : « GanttPro refuse ce fichier : [message]. Corrige-le et renvoie
   le JSON complet. »

## Prompt A — Créer un projet à partir de notes

```text
Tu es un assistant de planification de projet. À partir des informations ci-dessous, produis le fichier d'un projet au format
GanttPro (JSON). Réponds UNIQUEMENT par le JSON, dans un seul bloc de code, sans commentaire autour.

INFORMATIONS DU PROJET
- Nom : [nom du projet, 60 caractères maximum]
- Date de début : [AAAA-MM-JJ]
- Contexte et objectif : [quelques lignes]
- Ressources (prénoms, initiales ou fonctions) : [liste, avec la disponibilité en % si elle est inférieure à 100]
- Jours de congé ou d'absence connus : [dates, qui]
- Calendrier : [semaine de 5 jours lundi-vendredi ou autre] ; jours fériés : [FR, FR-AM, BE, DE, GB, US, CH ou NONE]
- Tâches, ordre et contraintes : [notes de réunion, liste de tâches, jalons, échéances]

RÈGLES DU FORMAT (à respecter strictement)
1. Racine : { "format": 3, "name", "desc", "emoji", "projectStart", "calendar", "leveling", "resources", "categories", "tasks" }.
   Ne mets ni "id", ni "createdAt", ni "baselines", ni "versions".
2. "emoji" : l'un de 🚁 🚀 🏗️ 💡 🎯 📱 🌍 ⚙️ 🔬 🎨 🏭 📦 🔧 🛸 🌿 🏆 📊 🔐 🚂 💊 📁.
3. Dates au format "AAAA-MM-JJ", entre 1970 et 2199.
4. "calendar" : { "workDays": [lun, mar, mer, jeu, ven, sam, dim] avec 1 = travaillé et 0 = non (au moins un 1),
   "holidays": "FR" | "FR-AM" | "BE" | "DE" | "GB" | "US" | "CH" | "NONE",
   "daysOff": [{ "start", "end", "label" }], "daysWorked": [{ "start", "end", "label" }] }.
   Une même date ne peut pas être à la fois chômée et travaillée.
5. "leveling" : "smooth" (lissage dans la marge, par défaut), "level" (nivellement automatique) ou "off".
6. "resources" : [{ "name" (unique, 100 car. max), "role", "capacity" (entier 1 à 100, en %), "absences": [{ "start", "end", "label" }] }].
7. "categories" : [{ "name" (unique), "color" "#rgb" ou "#rrggbb" }] (facultatif).
8. "tasks" : liste ordonnée (1 000 maximum). Chaque tâche :
   - "id" : texte unique de 1 à 12 caractères parmi A-Z, 0-9, point, tiret et souligné (ex. "T1", "PHASE1.2"). Jamais un nombre.
   - "name" : 1 à 200 caractères.
   - "type" : "task" (défaut), "milestone" (jalon) ou "summary" (récapitulative).
   - "dur" : durée en JOURS OUVRÉS, entier de 1 à 3650, obligatoire pour une tâche. Omets-la pour un jalon (0) et une récapitulative.
   - "parent" : id d'une tâche de type "summary" (5 niveaux maximum). Une récapitulative regroupe ses enfants : elle n'a ni
     "dur", ni "deps", ni date, ni ressource.
   - "deps" : prédécesseurs. Forme courte : ["T1", "T2"] (fin → début). Forme complète : { "id": "T1", "type": "FS" | "SS" | "FF" | "SF", "lag": entier de -365 à 365 en jours ouvrés }.
     Pas de boucle, pas de lien vers soi-même ni vers une récapitulative, pas de lien entre une récapitulative et ses enfants.
   - "assign" : [{ "res": "nom d'une ressource", "units": 1 à 100 }] ; le taux ne dépasse pas la capacité de la ressource.
     Pas de ressource sur un jalon ni sur une récapitulative.
   - "cat" : nom d'une catégorie ; "tags" : 10 étiquettes maximum, 30 caractères chacune, sans doublon.
   - "pct" : avancement entier de 0 à 100 (jalon : 0 ou 100). "realStart", "realEnd" : dates réelles ; "realEnd" seulement si "pct" vaut 100.
   - "forcedStart" : date imposée (à n'utiliser que si la date est réellement contractuelle) ; "notBefore" : ne pas commencer avant ;
     "deadline" : échéance.
   - "notes" : 2 000 caractères maximum.
9. Ne mets aucune date de début ou de fin calculable : GanttPro calcule le planning à partir des durées, des liens, du calendrier
   et des ressources. N'utilise "forcedStart" que pour une contrainte réelle.
10. Aucun champ en dehors de ceux listés ci-dessus.

MÉTHODE
- Découpe en tâches de 1 à 20 jours ouvrés ; regroupe-les sous des récapitulatives par phase.
- Lie les tâches par des dépendances plutôt que par des dates ; ajoute un jalon à la fin de chaque phase importante.
- Si une information manque (durée, ressource, date), fais l'hypothèse la plus raisonnable et liste-la dans le champ "desc" du projet,
  sous la forme « Hypothèses : … ».

AVANT DE RÉPONDRE, VÉRIFIE : JSON valide ; ids uniques ; chaque "parent" et chaque id de "deps" existe ; aucune boucle ; aucune ressource
inexistante ; durées entières ; dates "AAAA-MM-JJ".
```

## Prompt B — Mettre à jour un projet après une réunion

```text
Tu es un assistant de planification de projet. Je te donne le fichier JSON d'un projet GanttPro et les décisions d'une réunion.
Applique les décisions au projet et renvoie le fichier COMPLET mis à jour, UNIQUEMENT sous forme d'un bloc de code JSON, sans commentaire
autour. Termine ensuite, hors du bloc, par la liste de ce que tu as modifié, ligne par ligne (id, avant, après).

DÉCISIONS DE LA RÉUNION
[notes : tâches terminées ou avancées, retards, tâches ajoutées ou supprimées, changements de durée, de ressource, de date, nouveaux risques…]

FICHIER ACTUEL
[colle ici le JSON exporté de GanttPro]

RÈGLES
- Ne change que ce que les décisions imposent. Recopie tel quel tout le reste, y compris "id", "createdAt", "baselines" et "versions"
  s'ils existent. Si le fichier est trop long pour être recopié en entier, dis-le au lieu de le tronquer.
- Garde les ids des tâches existantes ; pour une nouvelle tâche, choisis un id libre (texte de 1 à 12 caractères parmi A-Z, 0-9, ".", "-", "_").
- Pour une tâche supprimée, retire-la aussi des "deps" des autres tâches (ou remplace le lien par un lien vers son prédécesseur) et
  signale-le dans ta liste.
- Avancement : "pct" de 0 à 100 ; "realStart" quand une tâche démarre ; "realEnd" et "pct": 100 quand elle se termine (jamais "realEnd" si "pct" < 100).
- Ne saisis pas de dates de début ou de fin calculées : modifie plutôt les durées, les liens ou les ressources. N'utilise "forcedStart"
  que si la réunion a fixé une date ferme, et dis-le dans ta liste.
- Respecte le format et les limites de GanttPro : JSON valide, ids uniques, "parent" vers une tâche "summary", aucune boucle de
  dépendances, aucun lien vers une récapitulative, ressources existantes dans "resources", taux "units" au plus égal à la
  capacité, 1 000 tâches maximum, 5 niveaux maximum.
- Si une décision est ambiguë ou contradictoire (par exemple une tâche à la fois supprimée et avancée), ne devine pas : liste-la
  en fin de réponse sous « Points à confirmer » et laisse la tâche inchangée.
```

> Astuce : avant d'envoyer le fichier à l'IA, créez une **version** dans GanttPro (**Versions**, bouton « Enregistrer l'état actuel »). Si le résultat ne
> vous convient pas, vous revenez à l'état précédent en un clic.

## Exemple de fichier valide

Cet exemple est volontairement fictif. Il est contrôlé à chaque modification de GanttPro par un test automatique : s'il cessait d'être
accepté, la construction échouerait.

<!-- exemple-valide -->
```json
{
  "format": 3,
  "name": "Exemple de projet",
  "desc": "Hypothèses : durées estimées lors de la réunion de lancement.",
  "emoji": "🎯",
  "projectStart": "2026-11-02",
  "calendar": {
    "workDays": [1, 1, 1, 1, 1, 0, 0],
    "holidays": "FR",
    "daysOff": [{ "start": "2026-12-24", "end": "2026-12-24", "label": "Pont de fin d'année" }],
    "daysWorked": []
  },
  "leveling": "smooth",
  "resources": [
    { "name": "Dev 1", "role": "Développement", "capacity": 100, "absences": [{ "start": "2026-11-16", "end": "2026-11-17", "label": "Formation" }] },
    { "name": "Chef de projet", "role": "Pilotage", "capacity": 50 }
  ],
  "categories": [{ "name": "Conception", "color": "#4d9fff" }, { "name": "Réalisation", "color": "#36d9a0" }],
  "tasks": [
    { "id": "P1", "name": "Phase 1 — Cadrage", "type": "summary" },
    { "id": "T1", "name": "Rédiger la note de cadrage", "parent": "P1", "dur": 3, "assign": [{ "res": "Chef de projet", "units": 50 }], "cat": "Conception", "pct": 100, "realStart": "2026-11-02", "realEnd": "2026-11-04" },
    { "id": "T2", "name": "Valider le périmètre", "parent": "P1", "dur": 2, "deps": ["T1"], "assign": [{ "res": "Chef de projet", "units": 50 }], "cat": "Conception", "pct": 40 },
    { "id": "M1", "name": "Cadrage validé", "type": "milestone", "parent": "P1", "deps": ["T2"] },
    { "id": "P2", "name": "Phase 2 — Réalisation", "type": "summary" },
    { "id": "T3", "name": "Développer le premier lot", "parent": "P2", "dur": 10, "deps": [{ "id": "M1", "type": "FS", "lag": 1 }], "assign": [{ "res": "Dev 1", "units": 100 }], "cat": "Réalisation", "tags": ["lot 1"] },
    { "id": "T4", "name": "Recetter le premier lot", "parent": "P2", "dur": 4, "deps": ["T3"], "assign": [{ "res": "Chef de projet", "units": 50 }], "cat": "Réalisation", "deadline": "2026-12-18" }
  ]
}
```

## Erreurs fréquentes et correctifs

| Message ou symptôme | Cause probable | À demander à l'IA |
|---|---|---|
| « fichier illisible » | Texte autour du JSON, guillemets typographiques, virgule en trop | « Renvoie uniquement le JSON valide, dans un seul bloc de code. » |
| Identifiant refusé | Id numérique (`1`), trop long ou avec espace/minuscule | « Utilise des ids en texte de 1 à 12 caractères parmi A-Z, 0-9, ., -, _ (ex. "T1"). » |
| Prédécesseur introuvable | Un lien vise une tâche absente ou supprimée | « Vérifie que chaque id de deps existe. » |
| Boucle de dépendances | A dépend de B qui dépend de A (directement ou non) | « Supprime la boucle indiquée et explique ton choix. » |
| Lien vers une récapitulative | Une dépendance vise une tâche de type summary | « Lie plutôt la dernière tâche de la phase, ou un jalon. » |
| Champ interdit sur une récapitulative ou un jalon | `dur`, `deps`, dates ou ressource sur une récapitulative ; ressource sur un jalon | « Retire ces champs. » |
| Taux supérieur à la capacité | `units` plus grand que la capacité de la ressource | « Ramène units à la capacité de la ressource ou ajuste la durée. » |
| `realEnd` refusé | Date de fin réelle avec un avancement inférieur à 100 | « Mets pct à 100 ou retire realEnd. » |
| Un jour chômé et travaillé à la fois | Mêmes dates dans `daysOff` et `daysWorked` | « Une date ne peut figurer que dans l'une des deux listes. » |

## Pour aller plus loin

- **Montants** : une tâche (jamais un jalon ni une récapitulative) accepte `budget` et `actual`, en **centimes entiers**
  (`12345` = 123,45), de 0 à 5 000 000 000 000 ; le projet accepte `currency` (1 à 5 caractères) et `provision` (centimes).
  Un montant hors limite refuse le fichier en entier. Les montants sont des données sensibles : ne les confiez à une IA
  que si votre organisation l'autorise, ou exportez le projet **sans les montants** (case décochée par défaut).
- Un champ inconnu n'est pas une erreur : il est ignoré, et l'aperçu d'import indique combien ont été ignorés.
- Les ressources ou catégories citées par une tâche mais absentes des listes sont **créées** à l'import, et l'aperçu les mentionne :
  relisez-les, une faute de frappe crée une ressource en trop.
- Pour un tableur (Excel, CSV) plutôt qu'un JSON, demandez à l'IA un tableau avec les colonnes de l'assistant d'import
  (voir le guide utilisateur).
