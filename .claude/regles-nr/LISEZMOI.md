# Règles Numérique Responsable (INR) : provenance et licence

Ce dossier et les deux agents de `.claude/agents/` (`eco-check.md`, `accessibilite-check.md`) sont une **copie sans
modification** de la déclinaison Claude Code du dépôt
[Institut-du-Numerique-Responsable/skill-nr](https://github.com/Institut-du-Numerique-Responsable/skill-nr) :

| Fichier ici | Fichier source |
| --- | --- |
| `.claude/regles-nr/regles-nr.md` | `versions/claude-code/CLAUDE.md` |
| `.claude/agents/eco-check.md` | `versions/claude-code/.claude/agents/eco-check.md` |
| `.claude/agents/accessibilite-check.md` | `versions/claude-code/.claude/agents/accessibilite-check.md` |

- **Version** : 1.0.0, commit `2466e7550d74001a01b0aba181bfdc72cb214f9c` (copié le 2 novembre 2026).
- **Licence** : [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.fr), © Institut du Numérique
  Responsable et contributeurs ; intègre des règles Opquast (CC BY-SA), le GR491 (INR), le RGESN et le RGAA. Cette
  licence ne s'applique qu'aux trois fichiers ci-dessus, pas au reste du dépôt.

## Rôle
- `regles-nr.md` : règles d'écoconception et d'accessibilité, chargées par Claude Code grâce à la ligne
  `@.claude/regles-nr/regles-nr.md` du `CLAUDE.md` du projet. Une section par langage : ne s'applique qu'aux fichiers
  de ce langage.
- `eco-check` et `accessibilite-check` : sous-agents de revue d'un diff, listés par `/agents`. Les lancer avant une
  pull request : « lance l'agent eco-check sur mes changements ». `eco-check` peut corriger directement un fichier
  quand la correction est sûre et locale : relire son diff.

## Règle d'usage
- **Fichiers générés en amont : ne pas les éditer à la main** (CLAUDE.md §6). Une adaptation au projet s'écrit dans le
  `CLAUDE.md` du projet, qui **prévaut** en cas de conflit (par exemple une règle de cache réseau sans objet pour une
  application sans réseau).

## Mise à jour
```bash
git clone --depth 1 https://github.com/Institut-du-Numerique-Responsable/skill-nr /tmp/skill-nr
cp /tmp/skill-nr/versions/claude-code/CLAUDE.md .claude/regles-nr/regles-nr.md
cp /tmp/skill-nr/versions/claude-code/.claude/agents/*.md .claude/agents/
git -C /tmp/skill-nr rev-parse HEAD   # reporter version et commit ci-dessus
```
Relire le diff avant de committer : ces fichiers deviennent des consignes pour l'assistant.
