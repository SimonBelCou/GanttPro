# Fiche — Profils renommés dans un export sans noms de personnes

**Ce qui change :** un export « sans noms de personnes » renomme les profils de coût « Profil 1 », « Profil 2 »… (un intitulé de profil pourrait désigner une personne) ; une aide rappelle de donner au profil un intitulé de fonction.
**Fichier à ouvrir :** `tests/fixtures/taux-historique.json` (bouton **Importer**, puis **Remplacer le projet ouvert**).
**Durée :** 12 minutes (il faut un éditeur de texte, par exemple le Bloc-notes, et un tableur).

Le projet : un profil « Analyste » (400,00 € puis 420,00 € à partir du 8 janvier) pour Alice, et un prestataire, « Dave (externe) », avec son propre taux de 700,00 €.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

- [ ] 1. Cliquez **Ressources**, puis **Profils de coût…**. → Attendu : sous le champ **Nom** du profil, l'aide « Intitulé de fonction (ex. Chef de projet), jamais le nom d'une personne ». Fermez les deux fenêtres.
- [ ] 2. **Exporter**, format **Projet GanttPro (.json)**, cochez **Inclure les montants** et **Exporter sans noms de personnes**, puis **Exporter**. → Attendu : un fichier .json est téléchargé.
- [ ] 3. Ouvrez ce fichier dans l'éditeur de texte et cherchez « profiles ». → Attendu : `"name": "Profil 1"` avec ses deux lignes de taux (`"rate": 40000` et `"rate": 42000`).
- [ ] 4. Cherchez « Analyste », puis « 70000 ». → Attendu : aucun des deux n'est trouvé.
- [ ] 5. Cherchez « Ressource 1 ». → Attendu : cette ressource porte `"profile": "Profil 1"`.
- [ ] 6. Dans GanttPro, **Importer** ce fichier et **Remplacer le projet ouvert**, puis ouvrez le **Tableau de bord**, onglet **Budget**. → Attendu : la ligne « Ressource 1 » a un profil « Profil 1 » et un coût prévu de « 2 040,00 € », comme Alice avant l'export.
- [ ] 7. Rouvrez `taux-historique.json`. **Exporter**, format **Classeur Excel (.xlsx)**, cochez **Inclure les montants** et **Exporter sans noms de personnes**, puis **Exporter**, et ouvrez le classeur. → Attendu : feuille « Ressources », colonne « Profil de coût » : « Profil 1 » pour Ressource 1, vide pour Ressource 2.
- [ ] 8. Ouvrez la feuille « Taux ». → Attendu : deux lignes au nom de « Profil 1 », aucune ligne pour Dave, et le mot « Analyste » n'apparaît nulle part.
- [ ] 9. Exportez de nouveau en JSON, **sans** cocher **Inclure les montants**, en cochant **Exporter sans noms de personnes**, et ouvrez le fichier. → Attendu : `"name": "Profil 1"` avec `"rates": []` ; aucun `"rate"` dans tout le fichier.

## Références

RG-58, EF-150, R-99, R-100 ; annexe A.8 ligne 18 et journal C du 3 novembre 2026 (`Specs_fonctionnelles.md`). Tests automatiques : `tests/core/taux.test.mjs`, `tests/test_v3_budget.py`.
