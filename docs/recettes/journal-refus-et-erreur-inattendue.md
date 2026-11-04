# Journal d'erreurs : un fichier refusé et une erreur inattendue sont notés sans aucun nom

**Ce qui change :** GanttPro note les fichiers refusés et les erreurs inattendues dans un journal qui ne contient que des codes. Une erreur inattendue affiche un bandeau en haut de l'écran.
**Fichier à ouvrir :** `tests/fixtures/journal-import-refuse.json` (deux ressources portent le même nom fictif, « Camille Exemple »).
**Durée :** 10 minutes.

Avant de commencer : Réglages ⚙ → « Effacer toutes les données de l'application sur cet appareil » → « Tout effacer ». Pour provoquer une erreur inattendue sans vrai défaut, on utilise la console du navigateur (touche F12, onglet « Console »).

- [ ] 1. Ouvrez Réglages ⚙. → Attendu : une partie « Journal d'erreurs » ; la case « Conserver le journal sur cet appareil » est décochée ; on lit « 0 ligne dans le journal. » ; les boutons « Exporter le journal » et « Effacer le journal » sont grisés. Fermez la fenêtre.
- [ ] 2. Importez `journal-import-refuse.json`. → Attendu : le message « Deux ressources portent le nom Camille Exemple. » ; le projet ouvert ne change pas. Fermez le message.
- [ ] 3. Dans la console, tapez `setTimeout(() => { throw new Error('Camille Exemple') })` puis Entrée. → Attendu : en haut de l'écran, le bandeau « Erreur inattendue (réf. xxxxxxxx-hhmmss). Exportez votre projet. », avec un bouton « Exporter le journal » et une croix. Il n'y a ni texte technique ni « Camille ». On peut continuer à travailler.
- [ ] 4. Tapez la même commande une deuxième fois tout de suite. → Attendu : aucun nouveau bandeau (un seul toutes les 10 secondes). Fermez le bandeau avec la croix.
- [ ] 5. Réglages ⚙ → « Voir le journal ». → Attendu : un tableau, la ligne la plus récente en premier. On y trouve `app.unexpected` (niveau ERROR) et `imp.dupResource` (niveau WARN), avec la date UTC et la référence du bandeau. Le tableau ne montre ni « Camille », ni « file: », ni « Users ».
- [ ] 6. Cliquez « Exporter le journal ». → Attendu : un fichier `ganttpro_journal_AAAAMMJJ.jsonl` est téléchargé. Ouvert avec un éditeur de texte, sa première ligne contient `"app":"GanttPro"`, la version et la langue, puis il y a une ligne par entrée. Aucun nom, rien sur le navigateur.
- [ ] 7. Rechargez la page (F5), puis ouvrez Réglages ⚙. → Attendu : « 0 ligne dans le journal. » (sans l'option, le journal n'existait qu'en mémoire).

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

EF-151, RG-59, RG-60, RG-62, RG-63 ; scénario R-101 (`Specs_fonctionnelles.md`) ; décisions J1 à J6 (annexe C.1).
