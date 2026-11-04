# Recettes par fiches

Une fiche = un petit paquet à valider (10 étapes et 15 minutes au plus). Une fiche par fichier ci-dessous.

| Fiche | Ce qu'elle valide | Pull request | Durée | Statut |
|---|---|---|---|---|
| [taux-01-sans-taux.md](taux-01-sans-taux.md) | Tant qu'aucun profil de coût n'existe, l'application se comporte comme avant | #14 | 5 minutes | à faire |
| [taux-02-profils.md](taux-02-profils.md) | Vous pouvez créer et nommer des profils de coût (un profil regroupe des lignes de taux par jour, partagées par les ressources qui l'utilisent) | #14 | 5 minutes | à faire |
| [taux-03-lignes-de-taux.md](taux-03-lignes-de-taux.md) | Vous pouvez ajouter une ligne de taux à un profil ; les valeurs incorrectes sont refusées avec une explication | #14 | 5 minutes | à faire |
| [taux-04-dates-des-lignes.md](taux-04-dates-des-lignes.md) | Un taux peut changer à une date donnée ; les lignes se classent par date, sans deux lignes le même jour | #14 | 7 minutes | à faire |
| [taux-05-cout-fiches-taches.md](taux-05-cout-fiches-taches.md) | La fiche d'une tâche affiche son coût calculé à partir des taux de ses ressources | #14 | 5 minutes | à faire |
| [taux-06-cout-fiche-ressource.md](taux-06-cout-fiche-ressource.md) | La fiche d'une ressource affiche son coût, accepte un taux nominatif et arrondit au centime une seule fois | #14 | 12 minutes | à faire |
| [taux-07-budget-cout-ressources.md](taux-07-budget-cout-ressources.md) | Le tableau de bord compare le coût calculé des ressources au budget saisi, sans jamais modifier ce dernier (le budget saisi reste la référence du BAC, de la valeur acquise et des baselines) | #14 | 8 minutes | à faire |
| [taux-08-revision-taux.md](taux-08-revision-taux.md) | Un taux qui change à une date donnée est appliqué jour par jour, et un taux nominatif (prestataire) remplace celui du profil | #14 | 6 minutes | à faire |
| [taux-09-sans-taux-signale.md](taux-09-sans-taux-signale.md) | Une ressource sans taux n'est jamais valorisée en silence : elle est signalée « sans taux » et le total est annoncé partiel | #14 | 7 minutes | à faire |
| [taux-10-masquer-export-json.md](taux-10-masquer-export-json.md) | Les montants peuvent être masqués, et l'export JSON n'emporte les taux que si vous le demandez | #14 | 12 minutes | à faire |
| [taux-11-export-tableur.md](taux-11-export-tableur.md) | Les exports Excel et CSV portent le coût des ressources seulement si vous incluez les montants ; MS Project n'en reçoit jamais | #14 | 12 minutes | à faire |
| [taux-12-fichiers-refuses.md](taux-12-fichiers-refuses.md) | Un fichier dont les profils ou taux sont invalides est refusé en entier, sans toucher au projet ouvert | #14 | 5 minutes | à faire |
| [taux-13-supprimer-profil.md](taux-13-supprimer-profil.md) | Supprimer un profil demande confirmation et peut être annulé, profil des ressources compris | #14 | 5 minutes | à faire |
| [taux-14-clavier.md](taux-14-clavier.md) | Les profils et les taux s'utilisent au clavier, avec des champs nommés pour un lecteur d'écran, y compris en thème sombre | #14 | 10 minutes | à faire |
| [taux-15-controle-final.md](taux-15-controle-final.md) | Dernière vérification avant de valider la mise à jour de l'étape C | #14 | 3 minutes | à faire |

## Ordre conseillé

Dans l'ordre des numéros (1 à 15) : chaque fiche part d'un fichier d'essai neuf, sauf la fiche 15, à faire en dernier.

## Mode d'emploi

1. Ouvrez GanttPro dans votre navigateur, puis importez le fichier indiqué en tête de fiche (« Importer »).
2. Suivez les étapes dans l'ordre et cochez chaque case quand l'attendu est bien ce que vous voyez.
3. Une seule action par étape ; la valeur après « Attendu » est exacte.
4. En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.
5. Mettez « fait » dans la colonne Statut ci-dessus quand la fiche est entièrement cochée.
