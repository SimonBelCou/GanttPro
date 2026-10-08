# CLAUDE.md — GanttPro

GanttPro est un éditeur de diagramme de Gantt autonome, livré en un seul fichier
`GanttPro.html` (HTML + CSS + JS vanilla, sans serveur ni dépendance).

Les règles ci-dessous s'appliquent à TOUT code produit, révisé ou modifié sur ce
projet, sans exception, même si ce n'est pas explicitement demandé.

## 1. OWASP Top 10 (2021) — Vulnérabilités à prévenir
- A01 - Broken Access Control : vérifier les autorisations à CHAQUE requête
  (jamais uniquement côté client), principe du moindre privilège par défaut.
- A02 - Cryptographic Failures : chiffrer les données sensibles au repos et en
  transit (TLS 1.2+), jamais de mot de passe en clair, utiliser bcrypt/argon2
  (jamais MD5/SHA1 pour les mots de passe).
- A03 - Injection : requêtes paramétrées/préparées obligatoires (SQL, NoSQL,
  LDAP, OS command), échapper/valider toutes les entrées utilisateur,
  jamais de concaténation de requêtes.
- A04 - Insecure Design : penser menaces dès la conception (threat modeling),
  valider les cas limites et les abus possibles avant de coder.
- A05 - Security Misconfiguration : pas de configuration par défaut en prod,
  désactiver les fonctionnalités/ports inutiles, headers de sécurité HTTP
  (CSP, X-Frame-Options, HSTS...), messages d'erreur génériques en prod
  (pas de stack trace exposée).
- A06 - Vulnerable Components : vérifier les dépendances (npm audit, pip-audit,
  Dependabot/Snyk), maintenir les versions à jour, éviter les libs abandonnées.
- A07 - Identification & Authentication Failures : MFA quand possible,
  politique de mots de passe robuste, protection contre le brute-force
  (rate limiting), gestion sécurisée des sessions (rotation des tokens).
- A08 - Software and Data Integrity Failures : vérifier l'intégrité des
  dépendances (lockfiles, signatures), pipelines CI/CD sécurisés, pas de
  désérialisation de données non fiables.
- A09 - Security Logging and Monitoring Failures : logger les événements
  sensibles (échecs d'authentification, accès refusés) SANS logger de
  données personnelles/secrets, prévoir une alerte en cas d'anomalie.
- A10 - Server-Side Request Forgery (SSRF) : valider/filtrer strictement
  toute URL fournie par l'utilisateur avant un appel serveur.

## 2. Gestion des secrets et données sensibles
- Jamais de secret (clé API, mot de passe, token) en dur dans le code ou
  committé dans Git → utiliser des variables d'environnement ou un
  gestionnaire de secrets (Vault, AWS Secrets Manager...).
- Ajouter systématiquement .env, credentials, *.pem au .gitignore.
- Ne jamais exposer d'identifiants dans les logs, erreurs ou réponses API.

## 3. RGPD (protection des données personnelles) — obligation légale, pas une option
- Minimisation des données : ne collecter que le strict nécessaire.
- Base légale claire pour tout traitement de données personnelles.
- Chiffrement/anonymisation/pseudonymisation des données sensibles.
- Droit à l'oubli : prévoir la suppression effective des données sur demande.
- Durée de conservation définie et documentée.
- Privacy by design et by default dès la conception d'une fonctionnalité.

## 4. ISO/IEC 27001 & 27002 — bonnes pratiques organisationnelles
- Traçabilité : toute action sensible (création, modification, suppression
  de données critiques) doit être auditable.
- Séparation des environnements (dev / staging / prod) et des accès associés.
- Gestion des accès basée sur les rôles (RBAC), révocation immédiate des
  accès obsolètes.
- Sauvegardes régulières et testées (test de restauration).

## 5. Recommandations ANSSI
- Appliquer le principe de défense en profondeur (pas un seul point de
  défaillance de sécurité).
- Mots de passe : 12+ caractères ou passphrase, pas de complexité imposée
  artificielle sans nécessité, vérifier via une liste de mots de passe
  compromis (type HaveIBeenPwned API) si pertinent.
- Mise à jour régulière des systèmes et dépendances (patch management).
- Documenter les mesures de sécurité mises en place (traçabilité pour audit).

## 6. Comportement attendu de l'assistant/développeur
- Si une demande de code introduit une faille connue (ex: requête SQL
  concaténée, désactivation de la vérification TLS, hash faible...),
  signaler le risque ET proposer une alternative sécurisée, ne pas
  l'implémenter silencieusement.
- Documenter les choix de sécurité dans les commentaires ou le README
  quand ils ne sont pas évidents.
- Ne jamais générer de code de contournement de sécurité, de malware,
  ou d'exploitation de vulnérabilité, même à des fins de test, sauf dans
  un environnement de test isolé explicitement dédié au security testing
  autorisé.

## 7. Développement éthique et responsable
- Design centré utilisateur : toute fonctionnalité doit répondre à un vrai
  besoin utilisateur, pas uniquement à un objectif business (engagement,
  rétention forcée...) ; identifier et éviter les "dark patterns"
  (consentement biaisé, désabonnement caché, urgence artificielle...).
- Accessibilité et inclusion : respecter les standards WCAG (W3C) et, pour
  le secteur public/parapublic français, le RGAA (Référentiel Général
  d'Amélioration de l'Accessibilité) — contraste suffisant, navigation
  clavier, compatibilité lecteurs d'écran, textes alternatifs, formulaires
  accessibles. Concevoir aussi pour la diversité des équipements
  (connexions lentes, petits écrans, matériel ancien).
- Protection de la vie privée au-delà du RGPD légal : donner à l'utilisateur
  un contrôle réel et compréhensible sur ses données (paramètres clairs,
  pas de consentement présumé, granularité des choix), limiter le tracking
  au strict nécessaire et le rendre transparent.
- Anticipation des risques liés à l'IA : vigilance sur les biais
  algorithmiques (jeux de données représentatifs, tests sur des groupes
  variés), la désinformation (ne pas faciliter la génération de contenu
  trompeur), et la manipulation (pas de nudging non éthique, transparence
  sur l'usage d'une IA quand elle interagit avec l'utilisateur).
- Prise en compte de la santé et du bien-être : concevoir pour limiter la
  surcharge cognitive, éviter les mécaniques favorisant l'exposition
  prolongée ou la dépendance (scroll infini non justifié, notifications
  intrusives, gamification excessive), et porter une attention particulière
  aux impacts sur les jeunes publics (sédentarité, développement cognitif,
  santé mentale) si le produit peut les toucher.

Applique ces règles par défaut à chaque réponse technique, sans attendre
qu'on te les rappelle.

## Outils complémentaires recommandés (en plus de ces règles)
Un prompt guide la génération de code mais ne garantit rien seul. À coupler avec :
- **SAST** : Semgrep, SonarQube
- **SCA** : Dependabot, Snyk, OWASP Dependency-Check
- **Secret scanning** : gitleaks, truffleHog
- **DAST** : OWASP ZAP
- **Revue de code obligatoire** avant merge sur les branches protégées

---

# Spécificités du projet GanttPro

Application en **un seul fichier** `GanttPro.html` (HTML + CSS + JS vanilla), ouverte en local, sans serveur.
Ces consignes complètent les règles ci-dessus ; elles s'appliquent à tout code produit ou modifié.

## Obligatoire à chaque modification du JavaScript
1. Lancer `python3 tools/update-csp.py` : la CSP autorise le script par son empreinte SHA-256, elle devient
   périmée à la moindre modification (la CI échoue sinon). Ne jamais ajouter `'unsafe-inline'` à `script-src`.
2. Lancer `python3 tests/test_gantt.py` (import malveillant, CSP, parcours clavier/souris, accessibilité).

## Règles de code (A03 – Injection)
- **Aucun gestionnaire inline** (`onclick=`, `onchange=`, `oninput=`…, y compris dans les gabarits JS).
  Utiliser `data-click` / `data-change` / `data-input` (+ `data-arg`) et déclarer l'action dans la table `ACTIONS`.
- Toute donnée venant d'un fichier, du stockage ou d'un champ de saisie : `esc()` avant `innerHTML`
  (ou `textContent`), `safeColor()` avant tout attribut `style`, jamais d'`eval`, `new Function`, `document.write`.
- Tout import passe par `sanitizeProject()` (liste blanche de champs, types, longueurs, identifiants `[A-Z0-9._-]`).
- Les identifiants de tâche sont des chaînes : ne jamais les convertir en nombres (`data-arg` brut pour `selectTask`).
- `goHome()` ne suit que des URL de même origine en http(s)/file.

## Accessibilité (WCAG 2.1 AA / RGAA)
- Tout élément interactif non natif : `role="button"` + `tabindex="0"` ; Entrée/Espace sont gérés globalement.
- Tout champ ou bouton-icône a un nom accessible ; le nom accessible d'un contrôle doit contenir son texte visible.
- Texte ≥ 4,5:1 de contraste (`--muted` a été ajusté pour cela) ; pas de `outline:none` ; respecter `prefers-reduced-motion`.
- Les modales sont gérées par `initDialogs()` (role=dialog, focus, Échap) : ajouter une modale = l'ajouter à `_DIALOG_CLOSERS`.

## Vie privée (RGPD)
- Aucun appel réseau (`connect-src 'none'`), aucune ressource externe (polices intégrées), aucun cookie/traceur.
- Les noms de ressources sont des données personnelles potentielles : ne jamais les journaliser ni les envoyer.
- Aucune donnée réelle (noms, projets, chemins, entreprise) dans les fichiers du dépôt, y compris dans les exemples.
