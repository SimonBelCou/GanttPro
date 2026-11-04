# Taux 11 — Export Excel, CSV et MS Project

**Ce qui change** : les exports Excel et CSV portent le coût des ressources seulement si vous incluez les montants ; MS Project n'en reçoit jamais.
**Fichier à ouvrir** : `tests/fixtures/taux-historique.json`, par « Importer ».
**Durée** : 12 minutes

- [ ] 1. **Exporter** en **Excel** avec « Inclure les montants », ouvrez le fichier, feuille **Tâches**. → Attendu : une dernière colonne « Coût des ressources ».
- [ ] 2. Ouvrez la feuille **Ressources**. → Attendu : les colonnes Profil de coût, Taux par jour, Coût prévu, Coût réel estimé.
- [ ] 3. Ouvrez la feuille **Taux**. → Attendu : une feuille avec profil ou ressource, nature, à partir du, taux.
- [ ] 4. Exportez en Excel **sans** les montants. → Attendu : ni la feuille Taux ni ces colonnes (seul le profil reste).
- [ ] 5. Exportez en Excel avec les montants **anonymisé**. → Attendu : pas de taux nominatif ni de coût par ressource.
- [ ] 6. Exportez en **CSV** avec les montants. → Attendu : dernière colonne « Coût des ressources ».
- [ ] 7. Exportez en **CSV** sans les montants. → Attendu : la colonne « Coût des ressources » est absente.
- [ ] 8. Exportez en **MS Project** et ouvrez le fichier `.xml` dans un éditeur de texte. → Attendu : aucun taux ni coût (les montants ne partent jamais vers MS Project).

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

Étape C du budget, PR #14. EF-150, RG-58, R-98 à R-100.
