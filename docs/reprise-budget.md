# Reprise — gestion du budget de GanttPro

Document de passage pour démarrer une conversation neuve. Lisez-le en entier avant de coder.
Aucune donnée réelle : tous les montants ci-dessous sont des exemples.

## 1. Où en est-on (16 octobre 2026)

- Dépôt `SimonBelCou/GanttPro`, branche de travail `arbitrages-v3`, PR n° 7 ouverte vers `main`.
  La fusion de la PR est la décision de l'utilisateur, pas la vôtre.
- Dernier commit : « Ergonomie de la vue principale » (EF-108 à EF-111). Tests au vert :
  moteur 79, `test_v3` 179/179, espace 52/52, recette 87/87.
- Le budget est **cadré, pas développé**. Aucun code n'a été écrit pour lui.
- Cadrage : Claude Doc « GanttPro — Cadrage de la gestion du budget »
  (https://claude.ai/code/artifact/5a393a3b-48d1-41d0-8751-f884c55e284a), sections 1 à 8.
  Cahier des charges : https://claude.ai/code/artifact/76a646d0-34e1-42f9-a540-a79b741f91d7.

## 2. Règles à respecter (résumé, la référence reste `CLAUDE.md` et `SECURITY.md`)

- Ne jamais modifier `GanttPro.html` à la main : `python3 tools/build.py`.
- Après toute modification : `python3 tools/build.py`, `node --test tests/core/*.test.mjs`,
  `python3 tests/test_v3.py`, `python3 tests/test_v3_espace.py`, `PERF_FACTOR=2 python3 tests/test_v3_recette.py`.
- Une exigence nouvelle = un test de plus. Toute fonction ou arbitrage est reporté dans le cahier des charges
  (exigence + annexe A) et, si l'usage change, dans `docs/guide-utilisateur.md`.
- DOM par `h()` / `textContent`, jamais `innerHTML` ; actions par `data-click` et la table `ACTIONS` ;
  fenêtres par `Dialog` ; libellés par `I18n.t()` en français ET en anglais ; imports par `Model.sanitize`.
- Aucun appel réseau ; stockage seulement dans `src/js/ui/10-storage.js` ; aucun montant réel dans le dépôt.
- Commits avec les lignes `Co-Authored-By` et `Claude-Session` demandées par la session ; pas de sous-agent
  sans demande ; l'utilisateur veut des explications pas à pas.

## 3. Décisions de l'utilisateur (16 octobre 2026)

| Sujet | Décision |
|---|---|
| Taux de ressource | Cas général : taux moyen par rôle ou profil, fixé par la comptabilité. Externes : taux nominatif autorisé (donnée nécessaire). Concerne l'étape C. |
| Confidentialité | Export « sans montants » obligatoire ; rien ne sort sans export volontaire. |
| Compatibilité du format | Aucune contrainte tant que l'application est en développement. À prévoir : versionnement de GanttPro (application et format), tâche à ouvrir. Avant cela, ajouter les champs sans changer le numéro de format est acceptable ; à trancher au moment du versionnement. |
| Historique | Le budget est capturé avec la baseline (budgets des tâches, provision, BAC). |
| Montants | Entiers en centimes, plafonds à fixer. |
| Surpromesse | Rien à ajouter (mention dans le guide : l'outil ne remplace pas une comptabilité projet). |

**Non tranché, valeurs recommandées retenues par défaut** (à confirmer au premier échange utile) :
étapes A puis B ; coût réel cumulé par tâche ; valeur acquise (EV) proportionnelle à l'avancement ;
une devise par projet ; récapitulative = somme de ses enfants ; seuils CPI/SPI vert ≥ 1, orange 0,9 à 1,
rouge < 0,9 ; estimation à terminaison par défaut BAC/CPI ; points de situation de l'étape B.

## 4. Périmètre (détails dans le cadrage)

- **Étape A** : budget et coût réel par tâche, BAC (somme des tâches + provision globale), budgets dans les
  baselines, courbe en S des coûts (coût compté à la fin de la tâche), blocs dans le tableau de bord, le rapport
  d'état et les exports, export « sans montants ».
- **Étape B** : EV, PV, CV, SV, CPI, SPI, trois EAC (BAC/CPI ; AC+ETC ; AC+BAC−EV), VAC, courbes, diagramme
  CPI/SPI, points de situation.
- **Étape C** : taux de ressource, types de dépenses (RH, CAPEX, OPEX), années, lignes hors tâche, consommation
  de provision.

Scénario chiffré à reprendre comme test de recette (cours) : BAC 200, PV 100, AC 140, EV 80
→ CV −60, SV −20, CPI 0,57, SPI 0,8 ; EAC 351 / 240 / 260 ; VAC −151 / −40 / −60.

## 5. Points d'accroche dans le code

- `src/js/core/40-model.js` : `FORMAT = 3`, `LIMITS`, `sanitize` (liste blanche de champs ; baselines lues vers
  la ligne 346, champs `id, name, dur, deps, cat, start, end` par tâche de baseline), `serialize`, `newProject`.
  Les budgets y entrent comme entiers de centimes, avec plafond dans `LIMITS`.
- Poids 1 par tâche partout (décision du 15 octobre) : l'avancement global, les courbes en S et les récapitulatives
  se calculent par nombre de tâches ; le coût réel de la courbe en S compte les tâches terminées.
- Moteur sans DOM dans `src/js/core/` ; interface dans `src/js/ui/` (fichiers triés par nom, concaténés).
- Textes : `src/js/core/50-i18n.js` (test de complétude FR/EN).

## 6. Ordre de travail proposé pour la conversation neuve

1. Lire ce fichier, `CLAUDE.md`, le cadrage (section 8 incluse) et l'annexe A du cahier des charges.
2. Demander à l'utilisateur de confirmer ou corriger les valeurs « par défaut » du paragraphe 3 (une seule question).
3. Écrire dans le cahier des charges : exigences EF (étape A), règles de gestion, scénarios chiffrés de recette,
   annexe A (arbitrages ci-dessus).
4. Développer l'étape A : modèle et moteur d'abord (tests `tests/core/`), puis interface, traductions, exports,
   guide utilisateur, tests d'interface et axe-core.
5. Ouvrir la tâche « versionnement de GanttPro » et l'étape B ensuite.

## 7. Autres restes à faire (hors budget)

- Fiche de recette manuelle EX-16 (Firefox, Safari, tablette) et plan d'audit RGAA EX-05 dans `docs/`.
- Mémorisation facultative de la mise en page, choix et ordre des colonnes, hauteur réglable de la zone.
- Mesurer EX-15 (1000 tâches) sans `PERF_FACTOR`.
- PR n° 7 en attente de relecture par l'utilisateur.
