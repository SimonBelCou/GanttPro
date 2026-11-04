# Journal d'erreurs : le conserver sur l'appareil, puis l'effacer

**Ce qui change :** sur demande, le journal d'erreurs peut être gardé sur l'appareil. On peut aussi l'effacer, seul ou avec toutes les données.
**Fichier à ouvrir :** aucun (on part d'un GanttPro vide).
**Durée :** 8 minutes.

Pour provoquer une erreur inattendue, tapez dans la console du navigateur (F12, onglet « Console ») : `setTimeout(() => { throw new Error('essai') })` puis Entrée.

- [ ] 1. Réglages ⚙ → cochez « Conserver le journal sur cet appareil ». → Attendu : le lecteur d'écran annonce « Le journal est conservé sur cet appareil. » ; la case reste cochée.
- [ ] 2. Fermez les Réglages, provoquez une erreur, attendez le bandeau, rechargez la page (F5) et rouvrez Réglages ⚙. → Attendu : « 1 ligne dans le journal. »
- [ ] 3. Décochez la case. → Attendu : l'annonce « Le journal n'est plus conservé sur cet appareil. » ; on lit toujours « 1 ligne dans le journal. »
- [ ] 4. Cliquez « Effacer le journal », puis « Annuler ». → Attendu : rien ne change, toujours « 1 ligne ».
- [ ] 5. Cliquez à nouveau « Effacer le journal », puis « Effacer ». → Attendu : « 0 ligne dans le journal. »
- [ ] 6. Cochez la case, fermez les Réglages et provoquez une erreur. → Attendu : le bandeau « Erreur inattendue (réf. …) » apparaît.
- [ ] 7. Réglages ⚙ → « Effacer toutes les données de l'application sur cet appareil » → « Tout effacer ». → Attendu : « 0 ligne dans le journal. » et la case est décochée.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

EF-151, EF-104, RG-60, RG-61 ; scénarios R-102 et R-103 (`Specs_fonctionnelles.md`).
