/* Traductions (EF-103, EX-24, RG-32) : un catalogue par langue, repli sur le français,
 * pluriels (« 1 conflit », « 2 conflits »). Les paramètres sont insérés comme TEXTE : l'interface
 * affiche toujours le résultat par textContent, jamais par innerHTML. */
const I18n = (() => {
  const FR = {
    'app.title': 'GanttPro',
    'app.skip': 'Aller au planning',
    // Barre du haut
    'top.project': 'Modifier le projet {name}',
    'top.start': 'Début projet',
    'top.addTask': '+ Ajouter tâche', 'top.addMilestone': '+ Ajouter jalon', 'top.addSummary': '+ Ajouter récapitulative',
    'top.resources': 'Ressources', 'top.categories': 'Catégories', 'top.calendar': 'Calendrier',
    'top.undo': 'Annuler', 'top.redo': 'Rétablir',
    'top.new': 'Nouveau', 'top.import': 'Importer', 'top.export': 'Exporter',
    'top.zoomOut': 'Zoom arrière', 'top.zoomIn': 'Zoom avant', 'top.zoomReset': 'Zoom à 100 %', 'top.zoom': 'Zoom {pct} %',
    'top.theme': 'Thème : {theme}', 'theme.system': 'système', 'theme.light': 'clair', 'theme.dark': 'sombre',
    'top.lang': 'English', 'top.langLabel': 'Switch to English',
    'top.links': 'Liens : {state}', 'state.on': 'ON', 'state.off': 'OFF',
    'top.conflicts': { one: '{count} conflit', other: '{count} conflits' },
    'top.alerts': { one: '{count} alerte', other: '{count} alertes' },
    'top.toolbar': 'Commandes',
    // Barre de chiffres
    'kpi.label': 'Chiffres du planning',
    'kpi.duration': 'Durée', 'kpi.days': { one: '{count} jour ouvré', other: '{count} jours ouvrés' },
    'kpi.start': 'Début', 'kpi.end': 'Fin', 'kpi.holidays': 'Jours fériés et chômés', 'kpi.critical': 'Chemin critique',
    'kpi.progress': 'Avancement global', 'kpi.none': 'aucun',
    // Liste
    'list.label': 'Liste des tâches',
    'col.id': 'N°', 'col.name': 'Activité', 'col.dur': 'Durée', 'col.deps': 'Dépendances', 'col.res': 'Ressource', 'col.status': 'Statut',
    'list.select': '{id} {name}', 'list.noRes': 'sans ressource',
    'list.critical': 'critique', 'list.conflict': 'en conflit', 'list.warning': 'avertissement',
    'list.msStart': 'Jalon Début', 'list.msEnd': 'Jalon Fin',
    'dur.days': { one: '{count} j', other: '{count} j' }, 'dur.milestone': 'jalon',
    // Statuts (RG-14)
    'status.done': 'Terminé', 'status.late': 'En retard', 'status.ongoing': 'En cours', 'status.notStarted': 'Pas démarré', 'status.upcoming': 'À venir',
    // Grille
    'gantt.label': 'Diagramme de Gantt', 'gantt.today': "Aujourd'hui",
    'gantt.week': 'Semaine du {date}', 'gantt.bar': '{id} {name} : du {start} au {end}, {dur}, {pct} %, {status}',
    'gantt.milestone': 'Jalon {id} {name} : {date}, {status}',
    'gantt.summary': 'Récapitulative {id} {name} : du {start} au {end}, {pct} %',
    'gantt.forced': 'date imposée',
    // Alertes
    'alerts.label': 'Alertes', 'alerts.close': 'Masquer les alertes',
    'alert.overload': '{res} est à {pct} % du {start} au {end} ({tasks})',
    'alert.absence': '{res} : absence du {start} au {end} pendant {tasks}',
    'alert.link.FS': '{task} commence le {date} avant la fin de {pred} ({predDate})',
    'alert.link.SS': '{task} commence le {date} avant le début de {pred} ({predDate})',
    'alert.link.FF': '{task} finit le {date} avant la fin de {pred} ({predDate})',
    'alert.link.SF': '{task} finit le {date} avant le début de {pred} ({predDate})',
    'alert.deadline': { one: '{task} dépasse son échéance de {count} jour', other: '{task} dépasse son échéance de {count} jours' },
    // Édition
    'edit.title': 'Modifier {id}', 'edit.save': 'Enregistrer', 'edit.cancel': 'Annuler', 'edit.delete': 'Supprimer',
    'edit.up': 'Monter', 'edit.down': 'Descendre',
    'f.id': 'Identifiant', 'f.name': 'Nom', 'f.type': 'Type', 'f.parent': 'Récapitulative parente', 'f.dur': 'Durée (jours ouvrés)',
    'f.cat': 'Catégorie', 'f.pct': 'Avancement (%)', 'f.reached': 'Atteint',
    'f.forced': 'Date imposée', 'f.notBefore': 'Ne pas commencer avant', 'f.deadline': 'Échéance',
    'f.realStart': 'Début réel', 'f.realEnd': 'Fin réelle', 'f.notes': 'Notes', 'f.tags': 'Étiquettes (séparées par des virgules)',
    'f.deps': 'Prédécesseurs', 'f.assign': 'Affectations', 'f.none': '— aucune —',
    'f.addDep': 'Ajouter le prédécesseur', 'f.addAssign': 'Ajouter la ressource', 'f.remove': 'Retirer {name}',
    'f.linkType': 'Type de lien avec {id}', 'f.lag': 'Délai avec {id} (jours ouvrés)', 'f.units': 'Taux de {name} (%)',
    'f.depPick': 'Choisir un prédécesseur', 'f.resPick': 'Choisir une ressource',
    'type.task': 'Tâche', 'type.milestone': 'Jalon', 'type.summary': 'Récapitulative',
    'link.FS': 'Fin → début (FD)', 'link.SS': 'Début → début (DD)', 'link.FF': 'Fin → fin (FF)', 'link.SF': 'Début → fin (DF)',
    'link.short.FS': 'FD', 'link.short.SS': 'DD', 'link.short.FF': 'FF', 'link.short.SF': 'DF',
    // Validation à la saisie (EX-06)
    'err.required': '{field} : obligatoire.', 'err.text': '{field} : {min} à {max} caractères.',
    'err.int': '{field} : entier de {min} à {max}.', 'err.date': '{field} : date au format AAAA-MM-JJ.',
    'err.idFormat': '{field} : 1 à 12 caractères parmi A-Z, 0-9, point, tiret et tiret bas.',
    'err.idTaken': "{field} : l'identifiant {id} est déjà utilisé.",
    'err.cycle': 'Cette dépendance créerait la boucle {path}.',
    'err.realOrder': '{field} : la fin réelle ne peut pas précéder le début réel.',
    'err.capacity': '{field} : au plus la capacité de {name} ({cap} %).',
    'err.nameTaken': '{field} : le nom {name} est déjà pris.',
    'err.limit': 'Limite atteinte : {max} {what} au plus. Supprimez un élément pour en ajouter un.',
    'err.realEndCleared': "L'avancement est inférieur à 100 % : la fin réelle a été effacée.",
    'err.depth': 'La hiérarchie est limitée à {max} niveaux.',
    'err.lastCategory': 'La dernière catégorie ne peut pas être supprimée.',
    // Fenêtres
    'dlg.close': 'Fermer', 'dlg.cancel': 'Annuler', 'dlg.ok': 'Valider', 'dlg.confirm': 'Confirmer',
    'dlg.deleteTask': 'Supprimer la tâche {id} « {name} » ?',
    'dlg.deleteTaskDeps': { one: '{count} tâche perdra un prédécesseur.', other: '{count} tâches perdront un prédécesseur.' },
    'dlg.deleteSummary': { one: 'Sa descendance ({count} élément) sera aussi supprimée.', other: 'Sa descendance ({count} éléments) sera aussi supprimée.' },
    'dlg.project': 'Projet', 'dlg.desc': 'Description', 'dlg.emoji': 'Emoji',
    'dlg.resources': 'Ressources', 'dlg.categories': 'Catégories',
    'res.name': 'Nom', 'res.role': 'Rôle', 'res.color': 'Couleur', 'res.capacity': 'Capacité (%)', 'res.add': 'Ajouter la ressource',
    'res.new': 'Nouvelle ressource', 'res.tasks': { one: '{count} tâche', other: '{count} tâches' },
    'res.delete': 'Supprimer la ressource {name} ?', 'res.deleteUsed': { one: 'Elle est affectée à {count} tâche.', other: 'Elle est affectée à {count} tâches.' },
    'res.privacy': 'Les noms de ressources sont des données personnelles : préférez des prénoms, des initiales ou des fonctions.',
    'cat.add': 'Ajouter la catégorie', 'cat.new': 'Nouvelle catégorie', 'cat.delete': 'Supprimer la catégorie {name} ?',
    'cat.deleteUsed': { one: 'Sa tâche passera dans {other}.', other: 'Ses {count} tâches passeront dans {other}.' },
    'color.pick': 'Couleur {n}',
    'dlg.new': 'Remplacer le projet ouvert par un nouveau projet ?', 'dlg.unsaved': 'Les modifications non exportées seront perdues.',
    'imp.title': "Aperçu de l'import", 'imp.replace': 'Remplacer le projet ouvert', 'imp.summary': '{tasks} tâches, {resources} ressources, {categories} catégories, {baselines} baselines ; début le {start} ; avancement moyen {pct} %.',
    'imp.notice.unknown': { one: '{count} champ inconnu a été ignoré.', other: '{count} champs inconnus ont été ignorés.' },
    'imp.notice.resources': 'Ressources créées : {names}.', 'imp.notice.categories': 'Catégories créées : {names}.',
    'imp.encrypted': "Ce fichier est protégé par mot de passe : l'ouverture des fichiers protégés n'est pas encore disponible dans cette version.",
    'exp.notice': "Fichier exporté. Il n'est pas chiffré et contient les noms des ressources.",
    'exp.anonymize': 'Exporter sans noms de personnes',
    // Messages d'import (8.3)
    'imp.unreadable': "Ce fichier n'est pas un projet GanttPro lisible.",
    'imp.tooBig': 'Fichier trop volumineux (5 Mo au maximum).',
    'imp.noTasks': 'Le champ "tasks" est manquant ou invalide.',
    'imp.newer': 'Ce fichier vient d\'une version plus récente de GanttPro.',
    'imp.tooMany': 'Trop d\'éléments « {what} » ({max} au maximum).',
    'imp.badId': 'Tâche n° {n} : identifiant invalide (A-Z, 0-9, ., _ ou -, 12 caractères au plus).',
    'imp.dupId': 'Identifiant de tâche en double : {id}.',
    'imp.field': '{obj}{n} : champ « {field} » invalide ({rule}).',
    'imp.rangeOrder': '{obj} : plage n° {n} — la fin précède le début.',
    'imp.noWorkday': "Calendrier : aucun jour de la semaine n'est travaillé.",
    'imp.calendarClash': 'Calendrier : le {date} est à la fois chômé et travaillé.',
    'imp.dupResource': 'Deux ressources portent le nom {name}.',
    'imp.dupCategory': 'Deux catégories portent le nom {name}.',
    'imp.dupAssign': 'Tâche n° {n} : la ressource {name} est affectée deux fois.',
    'imp.overCapacity': 'Tâche n° {n} : le taux de {units} % dépasse la capacité de {capacity} % de {name}.',
    'imp.milestoneRes': "Tâche n° {n} : un jalon n'a pas de ressource.",
    'imp.summaryField': "Tâche n° {n} : une récapitulative n'a ni lien, ni affectation, ni date imposée, ni contrainte.",
    'imp.realOrder': 'Tâche n° {n} : la fin réelle précède le début réel.',
    'imp.realEndPct': "Tâche n° {n} : une fin réelle impose un avancement de 100 %.",
    'imp.badParent': "Tâche n° {n} : le parent {parent} n'est pas une récapitulative.",
    'imp.parentCycle': 'Hiérarchie en boucle autour de {id}.',
    'imp.tooDeep': 'La tâche {id} dépasse {max} niveaux de récapitulatives.',
    'imp.missingPred': "Tâche n° {n} : le prédécesseur {pred} n'existe pas.",
    'imp.selfLink': 'Tâche n° {n} : une tâche ne peut pas dépendre d\'elle-même.',
    'imp.dupLink': 'Tâche n° {n} : le prédécesseur {pred} est lié deux fois.',
    'imp.linkSummary': 'Tâche n° {n} : le prédécesseur {pred} est une récapitulative.',
    'imp.linkHierarchy': 'Tâche n° {n} : le lien avec {pred} relie une tâche à sa propre récapitulative.',
    'imp.cycle': 'Boucle de dépendances : {path}.',
    'imp.version': 'Version n° {n} : {inner}',
    'imp.horizon': 'Le planning dépasserait l\'année 2199 : fichier refusé.',
    'obj.project': 'Projet', 'obj.task': 'Tâche n° ', 'obj.resource': 'Ressource n° ', 'obj.category': 'Catégorie n° ', 'obj.baseline': 'Baseline n° ',
    'obj.baselineTask': 'Tâche de baseline n° ', 'obj.version': 'Version n° ', 'obj.calendar': 'Calendrier',
    'rule.text': 'texte de {min} à {max} caractères', 'rule.int': 'entier de {min} à {max}', 'rule.number': 'nombre positif',
    'rule.bool': 'vrai ou faux', 'rule.date': 'date AAAA-MM-JJ entre 1970 et 2199', 'rule.color': 'couleur #rgb ou #rrggbb',
    'rule.enum': 'une valeur parmi {values}', 'rule.list': 'liste de {max} éléments au plus', 'rule.object': 'objet attendu',
    'rule.link': 'lien invalide', 'rule.week': 'sept valeurs 0 ou 1', 'rule.ident': 'identifiant invalide', 'rule.unique': 'valeurs en double',
    'rule.milestonePct': '0 ou 100 pour un jalon', 'rule.absent': 'champ interdit ici',
    'calc.error': 'Le planning ne peut pas être calculé : une date dépasse 2199.',
    // Divers
    'undo.done': 'Modification annulée.', 'redo.done': 'Modification rétablie.', 'saved': 'Tâche {id} enregistrée.', 'deleted': 'Tâche {id} supprimée.',
    'added': 'Tâche {id} ajoutée.', 'newTask': 'Nouvelle tâche', 'newMilestone': 'Nouveau jalon', 'newSummary': 'Nouvelle récapitulative',
    'unsaved.leave': 'Des modifications n\'ont pas été exportées.',
    'hol.newYear': "Jour de l'an", 'hol.goodFriday': 'Vendredi saint', 'hol.easterMonday': 'Lundi de Pâques', 'hol.labour': 'Fête du Travail',
    'hol.victory': 'Victoire 1945', 'hol.ascension': 'Ascension', 'hol.whitMonday': 'Lundi de Pentecôte', 'hol.bastille': 'Fête nationale',
    'hol.belgium': 'Fête nationale', 'hol.assumption': 'Assomption', 'hol.allSaints': 'Toussaint', 'hol.armistice': 'Armistice 1918',
    'hol.germanUnity': "Jour de l'Unité allemande", 'hol.christmas': 'Noël', 'hol.stStephen': 'Saint-Étienne',
    'init.project': 'Nouveau projet', 'init.task': 'Renommer cette tâche…', 'init.resource': 'Ressource', 'init.category': 'Général',
    'top.leveling': 'Charge des ressources', 'lvl.level': 'Nivellement automatique', 'lvl.smooth': 'Lissage dans la marge', 'lvl.off': 'Sans nivellement',
    'top.resolve': 'Résoudre…',
    'rsv.title': 'Résoudre les conflits', 'rsv.none': 'Aucun conflit : rien à résoudre.',
    'rsv.noOption': 'Aucune correction automatique : modifiez les dates, les durées ou les affectations de ces tâches.',
    'rsv.opt.moveForced': 'Déplacer la date imposée de {task} au {date}', 'rsv.opt.unforce': 'Lever la date imposée de {task}',
    'rsv.opt.reassign': 'Confier {task} à {to} au lieu de {from}',
    'rsv.opt.sequence': 'Arbitrer : faire passer {first} avant {task} (lien fin-début {first} → {task})', 'rsv.opt.level': 'Passer le projet en nivellement automatique',
    'rsv.left': { one: '{count} conflit restant', other: '{count} conflits restants' }, 'rsv.left0': 'aucun conflit restant',
    'rsv.endSame': 'fin inchangée', 'rsv.endLater': { one: 'fin repoussée de {count} jour', other: 'fin repoussée de {count} jours' },
    'rsv.endEarlier': { one: 'fin avancée de {count} jour', other: 'fin avancée de {count} jours' },
    'rsv.apply': 'Appliquer', 'rsv.applyLabel': 'Appliquer : {what}', 'rsv.applied': 'Correction appliquée : {left}.', 'rsv.global': 'Pour tout le projet',
    'rsv.more': { one: '{count} autre conflit sera analysé après ces corrections.', other: '{count} autres conflits seront analysés après ces corrections.' },
    'rsv.intro': "Chaque proposition est simulée avant d'être affichée. Rien n'est modifié sans votre clic ; « Annuler » revient en arrière.",
    'list.shift': '{count} j de décalage ({res} : {why})', 'why.overload': 'surcharge', 'why.absence': 'absence',
    'edit.shift': { one: 'Décalée de {count} jour ouvré par le nivellement ({res} : {why}). Sans ce décalage, elle commencerait le {date}.', other: 'Décalée de {count} jours ouvrés par le nivellement ({res} : {why}). Sans ce décalage, elle commencerait le {date}.' },
    'alert.smooth': '{task} ne tient pas dans sa marge : la surcharge de {res} n\'est pas lissée',
    'legend.label': 'Légende', 'legend.critical': 'Tâche critique (●)', 'legend.forced': 'Date imposée (📌)', 'legend.milestone': 'Jalon (◆)', 'legend.today': "Aujourd'hui",
  };

  const EN = {
    'app.skip': 'Skip to schedule',
    'top.project': 'Edit project {name}', 'top.start': 'Project start',
    'top.addTask': '+ Add task', 'top.addMilestone': '+ Add milestone', 'top.addSummary': '+ Add summary task',
    'top.resources': 'Resources', 'top.categories': 'Categories', 'top.calendar': 'Calendar',
    'top.undo': 'Undo', 'top.redo': 'Redo', 'top.new': 'New', 'top.import': 'Import', 'top.export': 'Export',
    'top.zoomOut': 'Zoom out', 'top.zoomIn': 'Zoom in', 'top.zoomReset': 'Zoom to 100%', 'top.zoom': 'Zoom {pct}%',
    'top.theme': 'Theme: {theme}', 'theme.system': 'system', 'theme.light': 'light', 'theme.dark': 'dark',
    'top.lang': 'Français', 'top.langLabel': 'Passer en français',
    'top.links': 'Links: {state}', 'state.on': 'ON', 'state.off': 'OFF',
    'top.conflicts': { one: '{count} conflict', other: '{count} conflicts' }, 'top.alerts': { one: '{count} alert', other: '{count} alerts' },
    'top.toolbar': 'Commands',
    'kpi.label': 'Schedule figures', 'kpi.duration': 'Duration', 'kpi.days': { one: '{count} working day', other: '{count} working days' },
    'kpi.start': 'Start', 'kpi.end': 'Finish', 'kpi.holidays': 'Holidays and days off', 'kpi.critical': 'Critical path', 'kpi.progress': 'Overall progress', 'kpi.none': 'none',
    'list.label': 'Task list', 'col.id': 'ID', 'col.name': 'Activity', 'col.dur': 'Duration', 'col.deps': 'Dependencies', 'col.res': 'Resource', 'col.status': 'Status',
    'list.select': '{id} {name}', 'list.noRes': 'no resource', 'list.critical': 'critical', 'list.conflict': 'in conflict', 'list.warning': 'warning',
    'list.msStart': 'Start milestone', 'list.msEnd': 'Finish milestone',
    'dur.days': { one: '{count} d', other: '{count} d' }, 'dur.milestone': 'milestone',
    'status.done': 'Done', 'status.late': 'Late', 'status.ongoing': 'In progress', 'status.notStarted': 'Not started', 'status.upcoming': 'Upcoming',
    'gantt.label': 'Gantt chart', 'gantt.today': 'Today', 'gantt.week': 'Week of {date}',
    'gantt.bar': '{id} {name}: {start} to {end}, {dur}, {pct}%, {status}', 'gantt.milestone': 'Milestone {id} {name}: {date}, {status}',
    'gantt.summary': 'Summary task {id} {name}: {start} to {end}, {pct}%', 'gantt.forced': 'fixed start date',
    'alerts.label': 'Alerts', 'alerts.close': 'Hide alerts',
    'alert.overload': '{res} is at {pct}% from {start} to {end} ({tasks})',
    'alert.absence': '{res}: absent from {start} to {end} during {tasks}',
    'alert.link.FS': '{task} starts on {date} before {pred} finishes ({predDate})',
    'alert.link.SS': '{task} starts on {date} before {pred} starts ({predDate})',
    'alert.link.FF': '{task} finishes on {date} before {pred} finishes ({predDate})',
    'alert.link.SF': '{task} finishes on {date} before {pred} starts ({predDate})',
    'alert.deadline': { one: '{task} misses its deadline by {count} day', other: '{task} misses its deadline by {count} days' },
    'edit.title': 'Edit {id}', 'edit.save': 'Save', 'edit.cancel': 'Cancel', 'edit.delete': 'Delete', 'edit.up': 'Move up', 'edit.down': 'Move down',
    'f.id': 'ID', 'f.name': 'Name', 'f.type': 'Type', 'f.parent': 'Parent summary task', 'f.dur': 'Duration (working days)',
    'f.cat': 'Category', 'f.pct': 'Progress (%)', 'f.reached': 'Reached', 'f.forced': 'Fixed start date', 'f.notBefore': 'Start no earlier than',
    'f.deadline': 'Deadline', 'f.realStart': 'Actual start', 'f.realEnd': 'Actual finish', 'f.notes': 'Notes', 'f.tags': 'Tags (comma-separated)',
    'f.deps': 'Predecessors', 'f.assign': 'Assignments', 'f.none': '— none —', 'f.addDep': 'Add predecessor', 'f.addAssign': 'Add resource',
    'f.remove': 'Remove {name}', 'f.linkType': 'Link type with {id}', 'f.lag': 'Lag with {id} (working days)', 'f.units': '{name} units (%)',
    'f.depPick': 'Choose a predecessor', 'f.resPick': 'Choose a resource',
    'type.task': 'Task', 'type.milestone': 'Milestone', 'type.summary': 'Summary task',
    'link.FS': 'Finish → start (FS)', 'link.SS': 'Start → start (SS)', 'link.FF': 'Finish → finish (FF)', 'link.SF': 'Start → finish (SF)',
    'link.short.FS': 'FS', 'link.short.SS': 'SS', 'link.short.FF': 'FF', 'link.short.SF': 'SF',
    'err.required': '{field}: required.', 'err.text': '{field}: {min} to {max} characters.', 'err.int': '{field}: whole number from {min} to {max}.',
    'err.date': '{field}: date in YYYY-MM-DD format.', 'err.idFormat': '{field}: 1 to 12 characters among A-Z, 0-9, dot, hyphen and underscore.',
    'err.idTaken': '{field}: ID {id} is already used.', 'err.cycle': 'This dependency would create the loop {path}.',
    'err.realOrder': '{field}: actual finish cannot be before actual start.', 'err.capacity': '{field}: at most the capacity of {name} ({cap}%).',
    'err.nameTaken': '{field}: the name {name} is already taken.', 'err.limit': 'Limit reached: at most {max} {what}. Delete an item to add one.',
    'err.realEndCleared': 'Progress is below 100%: the actual finish has been cleared.', 'err.depth': 'The hierarchy is limited to {max} levels.',
    'err.lastCategory': 'The last category cannot be deleted.',
    'dlg.close': 'Close', 'dlg.cancel': 'Cancel', 'dlg.ok': 'OK', 'dlg.confirm': 'Confirm',
    'dlg.deleteTask': 'Delete task {id} “{name}”?',
    'dlg.deleteTaskDeps': { one: '{count} task will lose a predecessor.', other: '{count} tasks will lose a predecessor.' },
    'dlg.deleteSummary': { one: 'Its {count} child item will also be deleted.', other: 'Its {count} child items will also be deleted.' },
    'dlg.project': 'Project', 'dlg.desc': 'Description', 'dlg.emoji': 'Emoji', 'dlg.resources': 'Resources', 'dlg.categories': 'Categories',
    'res.name': 'Name', 'res.role': 'Role', 'res.color': 'Colour', 'res.capacity': 'Capacity (%)', 'res.add': 'Add resource', 'res.new': 'New resource',
    'res.tasks': { one: '{count} task', other: '{count} tasks' }, 'res.delete': 'Delete resource {name}?',
    'res.deleteUsed': { one: 'It is assigned to {count} task.', other: 'It is assigned to {count} tasks.' },
    'res.privacy': 'Resource names are personal data: prefer first names, initials or job titles.',
    'cat.add': 'Add category', 'cat.new': 'New category', 'cat.delete': 'Delete category {name}?',
    'cat.deleteUsed': { one: 'Its task will move to {other}.', other: 'Its {count} tasks will move to {other}.' }, 'color.pick': 'Colour {n}',
    'dlg.new': 'Replace the open project with a new one?', 'dlg.unsaved': 'Changes that were not exported will be lost.',
    'imp.title': 'Import preview', 'imp.replace': 'Replace the open project',
    'imp.summary': '{tasks} tasks, {resources} resources, {categories} categories, {baselines} baselines; starts {start}; average progress {pct}%.',
    'imp.notice.unknown': { one: '{count} unknown field was ignored.', other: '{count} unknown fields were ignored.' },
    'imp.notice.resources': 'Resources created: {names}.', 'imp.notice.categories': 'Categories created: {names}.',
    'imp.encrypted': 'This file is password-protected: opening protected files is not available in this version yet.',
    'exp.notice': 'File exported. It is not encrypted and contains resource names.', 'exp.anonymize': 'Export without personal names',
    'imp.unreadable': 'This file is not a readable GanttPro project.', 'imp.tooBig': 'File too large (5 MB maximum).',
    'imp.noTasks': 'The "tasks" field is missing or invalid.', 'imp.newer': 'This file comes from a newer version of GanttPro.',
    'imp.tooMany': 'Too many “{what}” items ({max} maximum).', 'imp.badId': 'Task #{n}: invalid ID (A-Z, 0-9, ., _ or -, at most 12 characters).',
    'imp.dupId': 'Duplicate task ID: {id}.', 'imp.field': '{obj}{n}: invalid field “{field}” ({rule}).',
    'imp.rangeOrder': '{obj}: range #{n} — the end is before the start.', 'imp.noWorkday': 'Calendar: no working day in the week.',
    'imp.calendarClash': 'Calendar: {date} is both a day off and a working day.', 'imp.dupResource': 'Two resources are named {name}.',
    'imp.dupCategory': 'Two categories are named {name}.', 'imp.dupAssign': 'Task #{n}: resource {name} is assigned twice.',
    'imp.overCapacity': 'Task #{n}: {units}% exceeds the {capacity}% capacity of {name}.', 'imp.milestoneRes': 'Task #{n}: a milestone has no resource.',
    'imp.summaryField': 'Task #{n}: a summary task has no link, assignment, fixed date or constraint.',
    'imp.realOrder': 'Task #{n}: actual finish is before actual start.', 'imp.realEndPct': 'Task #{n}: an actual finish requires 100% progress.',
    'imp.badParent': 'Task #{n}: parent {parent} is not a summary task.', 'imp.parentCycle': 'Circular hierarchy around {id}.',
    'imp.tooDeep': 'Task {id} exceeds {max} levels of summary tasks.', 'imp.missingPred': 'Task #{n}: predecessor {pred} does not exist.',
    'imp.selfLink': 'Task #{n}: a task cannot depend on itself.', 'imp.dupLink': 'Task #{n}: predecessor {pred} is linked twice.',
    'imp.linkSummary': 'Task #{n}: predecessor {pred} is a summary task.', 'imp.linkHierarchy': 'Task #{n}: the link with {pred} connects a task to its own summary task.',
    'imp.cycle': 'Dependency loop: {path}.', 'imp.version': 'Version #{n}: {inner}', 'imp.horizon': 'The schedule would go beyond 2199: file rejected.',
    'obj.project': 'Project', 'obj.task': 'Task #', 'obj.resource': 'Resource #', 'obj.category': 'Category #', 'obj.baseline': 'Baseline #',
    'obj.baselineTask': 'Baseline task #', 'obj.version': 'Version #', 'obj.calendar': 'Calendar',
    'rule.text': 'text of {min} to {max} characters', 'rule.int': 'whole number from {min} to {max}', 'rule.number': 'positive number',
    'rule.bool': 'true or false', 'rule.date': 'YYYY-MM-DD date between 1970 and 2199', 'rule.color': '#rgb or #rrggbb colour',
    'rule.enum': 'one of {values}', 'rule.list': 'list of at most {max} items', 'rule.object': 'object expected', 'rule.link': 'invalid link',
    'rule.week': 'seven 0 or 1 values', 'rule.ident': 'invalid identifier', 'rule.unique': 'duplicate values', 'rule.milestonePct': '0 or 100 for a milestone',
    'rule.absent': 'field not allowed here', 'calc.error': 'The schedule cannot be computed: a date goes beyond 2199.',
    'undo.done': 'Change undone.', 'redo.done': 'Change redone.', 'saved': 'Task {id} saved.', 'deleted': 'Task {id} deleted.', 'added': 'Task {id} added.',
    'newTask': 'New task', 'newMilestone': 'New milestone', 'newSummary': 'New summary task', 'unsaved.leave': 'Some changes were not exported.',
    'hol.newYear': "New Year's Day", 'hol.goodFriday': 'Good Friday', 'hol.easterMonday': 'Easter Monday', 'hol.labour': 'Labour Day',
    'hol.victory': 'Victory in Europe Day', 'hol.ascension': 'Ascension Day', 'hol.whitMonday': 'Whit Monday', 'hol.bastille': 'Bastille Day',
    'hol.belgium': 'Belgian National Day', 'hol.assumption': 'Assumption Day', 'hol.allSaints': "All Saints' Day", 'hol.armistice': 'Armistice Day',
    'hol.germanUnity': 'German Unity Day', 'hol.christmas': 'Christmas Day', 'hol.stStephen': "St Stephen's Day",
    'top.leveling': 'Resource load', 'lvl.level': 'Automatic levelling', 'lvl.smooth': 'Smoothing within slack', 'lvl.off': 'No levelling',
    'top.resolve': 'Resolve…',
    'rsv.title': 'Resolve conflicts', 'rsv.none': 'No conflicts: nothing to resolve.',
    'rsv.noOption': 'No automatic fix: change the dates, durations or assignments of these tasks.',
    'rsv.opt.moveForced': 'Move the fixed date of {task} to {date}', 'rsv.opt.unforce': 'Remove the fixed date of {task}',
    'rsv.opt.reassign': 'Give {task} to {to} instead of {from}',
    'rsv.opt.sequence': 'Arbitrate: schedule {first} before {task} (finish-to-start link {first} → {task})', 'rsv.opt.level': 'Switch the project to automatic levelling',
    'rsv.left': { one: '{count} conflict left', other: '{count} conflicts left' }, 'rsv.left0': 'no conflict left',
    'rsv.endSame': 'finish unchanged', 'rsv.endLater': { one: 'finish delayed by {count} day', other: 'finish delayed by {count} days' },
    'rsv.endEarlier': { one: 'finish brought forward by {count} day', other: 'finish brought forward by {count} days' },
    'rsv.apply': 'Apply', 'rsv.applyLabel': 'Apply: {what}', 'rsv.applied': 'Fix applied: {left}.', 'rsv.global': 'For the whole project',
    'rsv.more': { one: '{count} more conflict will be analysed after these fixes.', other: '{count} more conflicts will be analysed after these fixes.' },
    'rsv.intro': 'Each proposal is simulated before it is shown. Nothing changes until you click; “Undo” reverts it.',
    'list.shift': '{count} d shift ({res}: {why})', 'why.overload': 'overload', 'why.absence': 'absence',
    'edit.shift': { one: 'Shifted by {count} working day by levelling ({res}: {why}). Without it, it would start on {date}.', other: 'Shifted by {count} working days by levelling ({res}: {why}). Without it, it would start on {date}.' },
    'alert.smooth': '{task} does not fit in its slack: the overload of {res} is not smoothed',
    'init.project': 'New project', 'init.task': 'Rename this task…', 'init.resource': 'Resource', 'init.category': 'General',
    'legend.label': 'Legend', 'legend.critical': 'Critical task (●)', 'legend.forced': 'Fixed date (📌)', 'legend.milestone': 'Milestone (◆)', 'legend.today': 'Today',
  };

  const CATALOGS = { fr: FR, en: EN };
  let lang = 'fr';

  const DAYS = { fr: ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'], en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] };
  const MONTHS = {
    fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  };

  function setLang(l) { lang = CATALOGS[l] ? l : 'fr'; }
  function getLang() { return lang; }

  function fill(str, params) {
    return str.replace(/\{(\w+)\}/g, (m, k) => (params && params[k] !== undefined ? String(params[k]) : m));
  }

  /** Message traduit. Une entrée {one, other} choisit selon params.count. */
  function t(key, params = {}) {
    let v = CATALOGS[lang][key];
    if (v === undefined) v = FR[key];
    if (v === undefined) return key;
    if (typeof v === 'object') {
      const n = Number(params.count) || 0;
      const one = lang === 'fr' ? Math.abs(n) < 2 : Math.abs(n) === 1;
      v = one ? v.one : v.other;
    }
    return fill(v, params);
  }

  /** Message d'une erreur de contrôle (Model.Invalid) : {key, params}. */
  function error(e) {
    const p = { ...e.params };
    if (p.obj) p.obj = t('obj.' + p.obj);
    if (p.n === undefined) p.n = '';
    if (p.rule) p.rule = t(p.rule, p);
    if (p.inner) p.inner = error(p.inner);
    return t(e.key, p);
  }

  /** Date longue : « lun. 05 janv. 2026 » / « Mon 05 Jan 2026 » (RG-32). */
  function date(dn) {
    if (dn == null) return '';
    const { y, m, d } = Dates.ymd(dn);
    return `${DAYS[lang][Dates.weekday(dn)]} ${String(d).padStart(2, '0')} ${MONTHS[lang][m - 1]} ${y}`;
  }
  /** Date courte : « 05/01 » (fr) / « 01/05 » (en). */
  function shortDate(dn) {
    const { m, d } = Dates.ymd(dn);
    const dd = String(d).padStart(2, '0'), mm = String(m).padStart(2, '0');
    return lang === 'fr' ? `${dd}/${mm}` : `${mm}/${dd}`;
  }
  function monthLabel(dn) { const { y, m } = Dates.ymd(dn); return `${MONTHS[lang][m - 1]} ${y}`; }
  function number(n, digits = 0) {
    const s = n.toFixed(digits);
    return lang === 'fr' ? s.replace('.', ',') : s;
  }

  return { t, error, setLang, getLang, date, shortDate, monthLabel, number, CATALOGS };
})();
