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

## Références
- Cahier des charges fonctionnel (exigences EF/RG/EX, recette R-01 à R-70, annexes A d'arbitrages) :
  https://claude.ai/code/artifact/76a646d0-34e1-42f9-a540-a79b741f91d7
- Guide utilisateur : `docs/guide-utilisateur.md`.
- Toute fonction ajoutée ou tout arbitrage est reporté dans le cahier des charges (exigence + annexe A) et,
  s'il change l'usage, dans le guide utilisateur.

## Organisation du code
- Sources : `src/js/core/` (moteur sans DOM : dates, calendrier, planning, indicateurs, résolution des conflits,
  validation des fichiers, traductions, échanges CSV/Excel/MS Project, chiffrement), `src/js/ui/` (interface),
  `src/styles/`, gabarit `src/index.html`.
- **Ne jamais modifier `GanttPro.html` à la main** : `python3 tools/build.py` l'assemble à partir de `src/` et
  calcule la CSP (script ET style autorisés par empreinte SHA-256, **aucun `'unsafe-inline'`**).
  `python3 tools/build.py --check` (CI) échoue si le fichier n'est pas à jour.
- Le build refuse `eval`, `new Function`, `document.write`, `onclick=`, `style=`, `setAttribute('style'|'on…')`,
  `console.*`, tout appel réseau et tout accès au stockage hors de `src/js/ui/10-storage.js`.
- `archive/v2.3/` conserve l'ancienne version, pour mémoire : elle n'est plus maintenue ni testée.

## Obligatoire à chaque modification
1. `python3 tools/build.py`
2. `node --test tests/core/*.test.mjs` (moteur, scénarios chiffrés de la recette)
3. `python3 tests/test_v3.py`, `python3 tests/test_v3_espace.py`, `python3 tests/test_v3_recette.py`
   (`npm install --no-save axe-core` pour le contrôle d'accessibilité ; `PERF_FACTOR=2` sur une machine lente).
4. Une nouvelle exigence ou un défaut corrigé = un test de plus.

## Règles de code (A03 – Injection)
- DOM construit avec `h()` : tout texte par `textContent`, **jamais `innerHTML`** ; SVG par `svg()`.
- Styles calculés par `element.style.setProperty` ; couleurs par `safeColor()` (#rgb ou #rrggbb seulement).
- **Aucun gestionnaire inline** : `data-click` / `data-change` / `data-input` / `data-submit` (+ `data-arg`) et
  l'action déclarée par `action('nom', …)` dans la table `ACTIONS`.
- Tout projet venant d'un fichier, du stockage, d'une page d'accueil ou d'une version passe par
  `Model.sanitize` / `Model.parseFile` (liste blanche de champs, types, longueurs, identifiants `[A-Z0-9._-]`).
- Les identifiants de tâche sont des chaînes : ne jamais les convertir en nombres.
- Toute modification de données passe par `commit()` (un pas d'annulation, indicateur « modifié »).
- Tout libellé passe par `I18n.t()` avec ses deux entrées, français ET anglais (test de complétude).
- L'adresse de retour d'une page d'accueil n'est suivie que si elle est de même origine, en http(s) ou file.

## Accessibilité (WCAG 2.1 AA / RGAA)
- Tout élément interactif non natif : `role="button"` + `tabindex="0"` ; Entrée/Espace sont gérés globalement.
- Tout champ ou bouton-icône a un nom accessible qui contient son texte visible.
- Texte ≥ 4,5:1 de contraste dans les deux thèmes ; pas de `outline:none` ; respecter `prefers-reduced-motion`.
- Fenêtres : uniquement par `Dialog.open` / `Dialog.message` / `Dialog.confirm` (dialogue natif titré, focus
  piégé, Échap, focus rendu), jamais `alert` / `confirm` / `prompt`.
- Chaque nouvelle fenêtre est contrôlée par axe-core dans les tests.

## Vie privée (RGPD)
- Aucun appel réseau (`connect-src 'none'`), aucune ressource externe (polices intégrées), aucun cookie/traceur.
- Les noms de ressources sont des données personnelles potentielles : ne jamais les journaliser ni les envoyer.
- Stockage local seulement sur geste explicite ou option activée par l'utilisateur, effaçable depuis les réglages.
- Aucune donnée réelle (noms, projets, chemins, entreprise) dans les fichiers du dépôt, y compris dans les exemples.
