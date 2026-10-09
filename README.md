# 🔧 GanttPro

GanttPro est un éditeur de diagramme de Gantt interactif, complet et autonome — livré en **un seul fichier HTML**, sans dépendance serveur ni installation requise.

Ouvrez le fichier dans votre navigateur et commencez à planifier.

> **Refonte v3 en cours** (dossier `src/`, fichier assemblé `dist/GanttPro.html`) : nouvelle version construite à
> partir du cahier des charges fonctionnel — liens FD/DD/FF/DF avec délai, récapitulatives, capacité et absences
> des ressources, calendriers FR / Alsace-Moselle / BE / DE, français et anglais, CSP stricte sans `unsafe-inline`.
> Construction : `python3 tools/build.py` ; tests : `node --test tests/core/*.test.mjs`, `python3 tests/test_v3.py`, `python3 tests/test_v3_espace.py`
> et `python3 tests/test_v3_recette.py` (scénarios de recette, temps de réponse, petits écrans).

## ✨ Fonctionnalités

### 📋 Gestion des tâches
- Ajout, édition et suppression de tâches via un formulaire latéral
- Définition de la durée (en jours ouvrés), des dépendances, de la catégorie et de la ressource assignée
- Support des jalons (milestones) affichés sous forme de losanges ◆
- Date de début forcée (📌) par tâche, avec indicateur visuel sur la barre

### 📅 Planification avancée
- Calcul automatique des dates de début/fin à partir de la date de projet et des dépendances
- Chemin critique calculé et mis en évidence (encadré rouge + indicateur ●)
- Prise en charge des jours fériés français (colonnes surlignées)
- Affichage de la semaine courante et de la date d'aujourd'hui

### 📈 Suivi de l'avancement
- Saisie du pourcentage d'avancement par tâche (curseur 0–100 %)
- Saisie des dates réelles de début et de fin
- Barre de progression globale du projet dans la barre de statistiques
- Statuts automatiques : À venir / En cours / Terminé / En retard

### 🔗 Dépendances visuelles
- Flèches de dépendance SVG entre les tâches (chemin de Bézier)
- Distinction visuelle entre flèches normales et flèches sur le chemin critique
- Activation/désactivation des liens d'un clic (bouton 🔗 Liens)

### 👥 Gestion des ressources
- Gestionnaire de ressources intégré (nom, rôle, couleur avatar)
- Détection automatique des conflits de ressource (chevauchement de tâches)
- Bannière d'alerte + animation pulsée sur les tâches en conflit
- Résolution automatique des conflits en un clic

### 📊 Dashboard & courbe en S
- Vue tableau de bord avec KPIs (durée, tâches, avancement, retard moyen)
- Courbe en S : visualisation de l'avancement planifié vs réel
- Basculement semaines/mois sur la courbe
- Tableau de suivi par tâche avec delta de retard

### 🗂 Baselines (référentiels)
- Sauvegarde de plusieurs baselines nommées avec horodatage
- Affichage des barres de baseline sous les barres courantes
- Activation/désactivation par baseline

### 🔍 Zoom & affichage
- Zoom de 20 % à 300 % avec boutons +/− ou Ctrl + molette
- Basculement automatique entre vue semaine et vue mois
- Sidebar rétractable pour maximiser l'espace du Gantt
- Colonnes redimensionnables par glisser-déposer (N°, Activité, Durée, Dép., Ressource)

### 💾 Import / export
- Export du projet en JSON (sauvegarde complète)
- Import JSON pour recharger un projet existant (fichier validé, 5 Mo maximum)
- Avertissement avant fermeture si des modifications non exportées sont détectées

### 🎨 Interface
- Thème sombre (dark mode), polices Sora + Fira Code intégrées
- Catégories de tâches définissables, avec couleurs
- Tooltips au survol des barres (dates, durée, ressource, avancement)
- Légende intégrée en bas de page

## 🚀 Utilisation

1. Téléchargez le fichier `GanttPro.html`
2. Ouvrez-le dans un navigateur moderne (Chrome, Firefox, Edge…)
3. Définissez la date de début du projet (champ en haut)
4. Ajoutez vos tâches via le bouton **+ Ajouter tâche**
5. Exportez votre projet en JSON pour le sauvegarder

Aucune installation, aucun serveur, **aucune connexion internet requise** : les polices sont intégrées au fichier.

## 🖥 Compatibilité

| Navigateur | Support |
|---|---|
| Chrome / Chromium | ✅ Recommandé (testé automatiquement) |
| Firefox | ✅ Supporté |
| Edge | ✅ Supporté |
| Safari | Non testé |

## 🔒 Sécurité

Le principal risque est l'import d'un fichier de projet JSON malveillant. GanttPro valide strictement les fichiers importés,
échappe toutes les données affichées et applique une `Content-Security-Policy` qui interdit tout script non prévu et toute
requête réseau. Détails et signalement d'une faille : voir [SECURITY.md](SECURITY.md).

## 🕵️ Vie privée (RGPD)

- **Fonctionnement 100 % local** : aucune donnée n'est transmise à un serveur ou à un tiers (aucun appel réseau, aucune police externe,
  aucun cookie, aucun traceur, aucune statistique).
- **Données traitées** : noms de tâches, noms et rôles des ressources (qui peuvent être des **données personnelles** : noms de collaborateurs),
  dates et avancements. Elles sont gardées en mémoire dans l'onglet ; une copie est écrite dans le `sessionStorage` du navigateur
  uniquement lorsque vous quittez le projet via « ← Accueil » (effacée à la fermeture de l'onglet).
- **Conservation** : l'application ne conserve rien d'elle-même. Les données persistent seulement dans les fichiers JSON que **vous** exportez.
  Ces fichiers sont en clair : stockez-les dans un emplacement protégé (disque chiffré, espace partagé à accès contrôlé) et supprimez-les
  pour exercer un droit à l'effacement.
- **Minimisation** : renseignez des prénoms/initiales ou des fonctions plutôt que des identités complètes si le contexte le permet.

## ♿ Accessibilité

Objectif : WCAG 2.1 niveau AA (et RGAA pour les structures concernées). État actuel — **partiellement conforme**, sans audit RGAA complet :

- ✅ Navigation au clavier (liste des tâches, lignes du Gantt, boutons, zone d'import), focus visible, boîtes de dialogue avec `role="dialog"`,
  piège de focus, fermeture par Échap et retour du focus
- ✅ Champs et boutons nommés, repères de page, contrastes de texte ≥ 4,5:1, mouvement réduit respecté (`prefers-reduced-motion`),
  affichage adapté aux écrans étroits
- ✅ Vérifié automatiquement avec axe-core (voir [Développement](#-développement)) : 0 violation sur la vue principale et sur chaque fenêtre
- ⚠️ Limites connues : thème sombre uniquement ; barres du Gantt et infobulles non atteignables au clavier (les mêmes informations sont
  accessibles via la liste des tâches et le formulaire d'édition) ; courbe en S dessinée dans un `<canvas>` (alternative : tableau de suivi
  du tableau de bord) ; dialogues natifs `alert`/`confirm`/`prompt` ; pas de test avec des utilisateurs de technologies d'assistance.

Un défaut d'accessibilité ? Ouvrez une issue.

## 📁 Structure du projet

```text
GanttPro.html             ← Application complète (HTML + CSS + JS en un seul fichier)
tools/update-csp.py       ← Recalcule la Content-Security-Policy (empreinte du script)
tests/test_gantt.py       ← Tests de bout en bout (Chromium headless)
.github/workflows/ci.yml  ← CI : CSP à jour, syntaxe JS, gitleaks, tests
CLAUDE.md                 ← Règles de sécurité et d'éthique appliquées à tout code produit
SECURITY.md               ← Politique de sécurité et signalement
THIRD_PARTY_LICENSES.md   ← Licences des polices intégrées (SIL OFL 1.1)
```

## 🛠 Technologies utilisées

- HTML5 / CSS3 / JavaScript vanilla — aucune dépendance d'exécution
- SVG — rendu des flèches de dépendance
- Canvas API — tracé de la courbe en S
- Polices Sora et Fira Code (SIL OFL 1.1), intégrées au fichier

## 🧪 Développement

```bash
# Après TOUTE modification du JavaScript : mettre à jour l'empreinte de la CSP
python3 tools/update-csp.py

# Tests de bout en bout (import malveillant, CSP, parcours clavier/souris, accessibilité)
pip install playwright && python3 -m playwright install chromium
npm install --no-save axe-core        # optionnel : audit d'accessibilité
python3 tests/test_gantt.py
```

Règles à respecter (détail dans [CLAUDE.md](CLAUDE.md) et [SECURITY.md](SECURITY.md)) : pas d'attribut `onclick=`/`onchange=` inline
(utiliser `data-click`/`data-change`/`data-input` + table `ACTIONS`), `esc()` avant tout `innerHTML`, `safeColor()` pour les couleurs,
`sanitizeProject()` pour toute donnée importée.

## 📄 Licence

Ce projet est distribué sous licence MIT (voir [LICENSE](LICENSE)). Vous êtes libre de l'utiliser, le modifier et le redistribuer.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request pour signaler un bug ou proposer une amélioration.
Une pull request doit garder la CI au vert (CSP à jour, tests, gitleaks).
