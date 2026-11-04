# Courbes PV / EV / AC dans l'onglet Budget

**Ce qui change** : l'onglet Budget du tableau de bord montre l'évolution de la valeur planifiée (PV), de la valeur acquise (EV) et du coût réel (AC).
**Fichier à ouvrir** : `tests/fixtures/valeur-acquise-courbes.json` (projet fictif), puis `tests/fixtures/valeur-acquise-passe.json` à l'étape 8.
**Durée** : 10 minutes.

Départ : ouvrez le premier fichier avec **Importer**, puis **Tableau de bord**, onglet **Budget**. Descendez jusqu'à la
section **Courbes PV / EV / AC**, sous « Valeur acquise ». La date du jour est celle de votre ordinateur.

- [ ] 1. Lisez le haut de la section. → Attendu : « Référence : baseline « Baseline initiale » », puis une légende de trois lignes : « PV, valeur planifiée (trait continu) », « EV, valeur acquise (ronds aux mesures) », « AC, coût réel (carrés aux mesures) ».
- [ ] 2. Regardez la courbe bleue (PV). → Attendu : elle monte à 100,00 € la semaine du 05/01, puis à 200,00 €, et reste à 200,00 € ensuite.
- [ ] 3. Regardez les ronds et les carrés. → Attendu : un rond et un carré la semaine du 05/01, un rond et un carré à la semaine d'aujourd'hui, reliés par un trait ; aucune marque entre les deux.
- [ ] 4. Lisez les deux phrases sous la courbe. → Attendu : « Points de situation non tracés : 1 (sans montants…) », et une aide qui dit que cet AC est le coût réel total, différent du « réel » de la courbe des coûts.
- [ ] 5. Cliquez sur **Afficher les valeurs** de cette section. → Attendu : le bouton devient « Masquer les valeurs » ; ligne de la semaine du 05/01 : 100,00 €, 80,00 €, 140,00 €, « 09/01/2026 — Revue etude » ; lignes sans mesure : « — » pour EV, AC et Mesure ; ligne d'aujourd'hui : 200,00 €, 140,00 €, 150,00 €, « Aujourd'hui ».
- [ ] 6. Dans cette section, choisissez **Mois**. → Attendu : ligne de janvier 2026 : 200,00 €, 80,00 €, 140,00 €, « 09/01/2026 — Revue etude » ; les autres courbes de l'onglet passent aussi en mois. Revenez ensuite à **Semaines**.
- [ ] 7. Cliquez sur **Masquer les montants** (en haut de la fenêtre). → Attendu : l'axe, les étiquettes et le tableau affichent « •••• » ; la légende et les phrases restent lisibles. Cliquez de nouveau pour réafficher les montants.
- [ ] 8. Avec la touche Tab, placez-vous sur la courbe, puis appuyez sur la flèche droite plusieurs fois. → Attendu : le texte sous la courbe donne la période et la PV, et ajoute l'EV et l'AC seulement aux semaines mesurées.
- [ ] 9. Fermez la fenêtre, ouvrez `valeur-acquise-passe.json` (projet sans baseline), puis l'onglet **Budget**. → Attendu : la section dit « Aucune courbe : la valeur planifiée se calcule sur une baseline de référence… Capturez une baseline… » et ne trace rien (aucune courbe à 0).

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

EF-151, RG-59, R-101 (`Specs_fonctionnelles.md`), décisions B1 et B2 du 3 novembre 2026 (annexe C).
