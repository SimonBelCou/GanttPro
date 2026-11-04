# Taux 7 — Onglet Budget : coût des ressources face au budget saisi

**Ce qui change** : le tableau de bord compare le coût calculé des ressources au budget saisi, sans jamais modifier ce dernier (le budget saisi reste la référence du BAC, de la valeur acquise et des baselines).
**Fichier à ouvrir** : `tests/fixtures/taux-profils-base.json`, par « Importer », puis **Tableau de bord**, onglet **Budget**.
**Durée** : 8 minutes

- [ ] 1. Regardez la section **Coût des ressources**. → Attendu : trois tuiles, **BAC `14 500,00 €`**, **Coût des ressources `13 000,00 €`** et **Budget des tâches moins coût des ressources `1 500,00 €`**.
- [ ] 2. Regardez le BAC de la section Budget. → Attendu : `14 500,00 €` (pas modifié par les taux).
- [ ] 3. Regardez le tableau par ressource. → Attendu : Alice `10 j-p`, `4 000,00 €`, coût réel estimé `2 000,00 €` ; Bob `20 j-p`, `9 000,00 €`, estimé `4 500,00 €`.
- [ ] 4. Regardez la ligne **Total**. → Attendu : `30 j-p`, `13 000,00 €`, `6 500,00 €` ; aucun message « Total partiel ».
- [ ] 5. Lisez la note sous le tableau. → Attendu : elle dit que le coût réel estimé (coût prévu × avancement) est indicatif et **n'entre ni dans le coût réel ni dans la valeur acquise**.
- [ ] 6. Regardez la section **Valeur acquise**. → Attendu : EV `7 500,00 €` (2 500 + 50 % de 10 000) et AC `5 400,00 €` (coûts réels saisis 2 400 + 3 000).
- [ ] 7. Supprimez tous les profils, ou rendez-leur un taux différent. → Attendu : EV et AC ne bougent pas (ils ne dépendent ni des taux ni de la date du jour).
- [ ] 8. Basculez entre **Semaine** et **Mois**. → Attendu : la courbe des coûts n'est pas modifiée par les taux.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

Étape C du budget, PR #14. EF-149, RG-56, R-97. « j-p » = jours-personne : jours ouvrés × taux d'occupation de la ressource (10 jours à 50 % = 5 jours-personne).
