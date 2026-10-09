# 🔧 GanttPro

GanttPro est un éditeur de diagramme de Gantt complet et autonome, livré en **un seul fichier HTML** : ouvrez
`GanttPro.html` dans votre navigateur et planifiez, sans installation, sans compte, sans serveur et sans connexion.

**Mode d'emploi complet : [docs/guide-utilisateur.md](docs/guide-utilisateur.md).**

![Écran principal de GanttPro avec un projet d'exemple](docs/img/02-principal.png)

## ✨ Fonctionnalités (version 3)

### 📋 Planification
- Tâches, jalons et tâches récapitulatives sur 5 niveaux ; durées en jours ouvrés
- Liens fin-début, début-début, fin-fin et début-fin, avec délai positif ou négatif ; boucles refusées
- Date imposée, « ne pas commencer avant », échéance
- Calendrier du projet : semaine de travail, jours fériés (France, Alsace-Moselle, Belgique, Allemagne), jours chômés
  et jours travaillés exceptionnels
- Chemin critique calculé sur le planning réel (liens, ressources, échéances)

### 👥 Ressources et charge
- Ressources avec capacité, absences et affectations multiples à un taux
- Trois modes : lissage dans la marge (la fin ne bouge pas), nivellement automatique, sans nivellement
- Conflits de surcharge et d'absence signalés en texte ; fenêtre « Résoudre… » avec propositions simulées
  (déplacer, réaffecter, arbitrer l'ordre) : rien n'est appliqué sans votre accord
- Histogramme de charge par ressource, avec absences hachurées

### ✏️ Édition
- Gestes sur la grille : déplacer, allonger, lier, régler l'avancement ; équivalents clavier
- Sélection multiple, modification en masse, copier-coller (y compris depuis un tableur)
- Recherche sans accents, filtres combinables, regroupement par ressource, catégorie ou statut
- Annuler / rétablir sur 50 pas ; notes, commentaires datés, étiquettes

### 📈 Suivi et compte rendu
- Avancement, dates réelles, statuts, écarts en jours ouvrés
- Baselines (3) et versions (10) ; tableau de bord avec courbe en S et tableau de suivi
- Rapport d'état avec voyant, à imprimer, enregistrer en PDF ou copier en texte ; impression du Gantt

### 💾 Fichiers et projets
- Export JSON (protection par mot de passe en option), Excel, CSV, MS Project XML, image PNG ; export sans noms de personnes
- Import de projets GanttPro (y compris 2.3), MS Project, Excel et CSV avec un assistant
- Dix projets en onglets, bibliothèque locale, modèles, sauvegarde automatique facultative

### 🌍 Interface
- Français et anglais ; thèmes clair, sombre ou système ; utilisable au clavier, au doigt et sur petit écran

## 🖥 Compatibilité

| Navigateur | Support |
|---|---|
| Chrome / Chromium / Edge | ✅ Testé automatiquement à chaque modification |
| Firefox, Safari | ✅ Visés, à vérifier lors de la recette manuelle |

## 🔒 Sécurité

Le principal risque est un fichier de projet malveillant. GanttPro contrôle chaque fichier champ par champ avant de l'ouvrir,
n'insère jamais de texte comme du code et applique une `Content-Security-Policy` stricte, sans `'unsafe-inline'`, qui
interdit tout script non prévu et toute requête réseau. Détails et signalement d'une faille : [SECURITY.md](SECURITY.md).

## 🕵️ Vie privée (RGPD)

- **Fonctionnement 100 % local** : aucune donnée n'est transmise (aucun appel réseau, aucune police externe, aucun cookie,
  aucun traceur, aucune statistique).
- **Données traitées** : noms de tâches, noms et rôles des ressources (qui peuvent être des **données personnelles**), dates et
  avancements. Elles restent dans l'onglet tant que vous ne les exportez pas.
- **Stockage sur l'appareil** : seulement les réglages, et la bibliothèque ou la sauvegarde automatique si vous les utilisez
  (désactivée par défaut, protégeable par mot de passe). Tout s'efface depuis Réglages > « Effacer toutes les données ».
- **Minimisation** : préférez des prénoms, des initiales ou des fonctions ; l'export sans noms de personnes remplace les noms.

## ♿ Accessibilité

Objectif : WCAG 2.1 niveau AA et RGAA 4.1. État actuel : **partiellement conforme**.
- Tout se fait au clavier, focus visible, fenêtres accessibles, informations jamais données par la seule couleur,
  équivalents texte des graphiques, deux thèmes contrastés, mouvement réduit respecté, 360 px de large et zoom 200 %.
- Contrôle automatique axe-core : aucune violation sur l'écran principal et chaque fenêtre.
- Pas encore d'audit RGAA complet ni d'essai avec des utilisateurs de technologies d'assistance. L'image PNG n'est pas accessible.

Un défaut d'accessibilité ? Ouvrez une issue.

## 📁 Structure du projet

```text
GanttPro.html             ← Application livrée (assemblée par tools/build.py, ne pas modifier à la main)
src/                      ← Sources : js/core (moteur), js/ui (interface), styles, index.html
tools/build.py            ← Assemble GanttPro.html, calcule la CSP, refuse les constructions dangereuses
tests/                    ← core/ (node --test, scénarios de recette) et tests de bout en bout (Chromium)
docs/                     ← Guide utilisateur et captures d'écran
archive/v2.3/             ← Ancienne version, pour mémoire (non maintenue)
.github/workflows/ci.yml  ← CI : build à jour, syntaxe, tests, accessibilité, gitleaks
CLAUDE.md                 ← Règles de sécurité, d'éthique et de code du projet
SECURITY.md               ← Politique de sécurité et signalement
THIRD_PARTY_LICENSES.md   ← Licences des polices intégrées (SIL OFL 1.1)
```

## 🧪 Développement

```bash
python3 tools/build.py                       # assemble GanttPro.html depuis src/
node --test tests/core/*.test.mjs            # moteur et scénarios chiffrés (sans dépendance)
pip install playwright && python3 -m playwright install chromium
npm install --no-save axe-core               # contrôle d'accessibilité
python3 tests/test_v3.py
python3 tests/test_v3_espace.py
python3 tests/test_v3_recette.py             # PERF_FACTOR=2 sur une machine lente
```

Règles de code (détail dans [CLAUDE.md](CLAUDE.md)) : DOM construit avec `h()` (jamais `innerHTML`), aucun gestionnaire
inline (`data-click` + table `ACTIONS`), `safeColor()` pour les couleurs, `Model.sanitize` pour toute donnée importée.

Référence fonctionnelle : le cahier des charges (exigences, règles de calcul, scénarios de recette).

## 📄 Licence

Ce projet est distribué sous licence MIT (voir [LICENSE](LICENSE)). Vous êtes libre de l'utiliser, le modifier et le redistribuer.

## 🤝 Contribution

Les contributions sont les bienvenues : ouvrez une issue ou une pull request. Une pull request doit garder la CI au vert
(fichier assemblé à jour, tests, accessibilité, gitleaks).
