---
name: de-la-spec-au-code
description: Conduit une évolution de suivi-plongee en cinq étapes (intention, spec, design et plan, code et tests, validation), chacune confiée à un agent, avec une validation humaine entre deux. À utiliser quand on demande une fonctionnalité ou un changement de comportement non trivial « en passant par la spec », ou pour reprendre un dossier docs/specs/ là où il en est.
argument-hint: "[demande brute, ou dossier docs/specs/<sujet>]"
---

# De la spec au code

La spec est le code source du système agentique : une spec floue produit du
code faux, vite. La discussion Produit / Tech a lieu **avant**, autour de la
spec. Tout vit dans `docs/specs/<AAAA-MM-JJ>-<sujet>/` (voir
`docs/specs/README.md`).

| # | Étape | Agent | Fichier | Qui décide |
|---|-------|-------|---------|------------|
| 1 | Intention : problème, valeur, critère de succès | `redacteur-intention` | `01-intention.md` | l'agent rédige, le PO corrige |
| 2 | Spec : comportement attendu, critères d'acceptation | `redacteur-spec` | `02-spec.md` | Produit, Tech et QA ensemble |
| 3 | Design et plan : UX, solution, découpage | `concepteur-plan` | `03-plan.md` | l'agent propose, Design et Tech approuvent |
| 4 | Code et tests : boucle TDD jusqu'au vert | `developpeur-tdd` | le code | l'agent exécute, la Tech relit |
| 5 | Validation : tests, couverture des CA, risque | `validateur` | `05-validation.md` | QA et tech lead décident |

## Conduite

1. **Où en est-on ?** Si on te donne un dossier, lis les fichiers présents et
   leur **Statut** ; reprends à la première étape non validée. Sinon, étape 1.
2. **Lance l'agent de l'étape** (outil Agent, `subagent_type` = l'agent du
   tableau) en lui passant la demande ou le chemin du dossier, et tout ce que
   l'utilisateur a déjà dit.
3. **Porte de validation humaine.** Après chaque étape, montre le chemin du
   fichier et les questions de l'agent, puis **arrête-toi** : l'humain relit,
   corrige ou répond. Ne passe à l'étape suivante que lorsqu'il dit que c'est
   validé ; alors mets à jour le **Statut** du fichier (`validée`, `approuvé`)
   en notant qui a validé et la date. Une réponse aux questions : relance le
   même agent pour qu'il corrige son fichier.
4. **Étape 4** : le diff n'est pas commité par l'agent. Montre son résumé ;
   la Tech relit. Commit par étape du plan, selon les règles de `CLAUDE.md`
   (manuels et vidéos dans le même commit).
5. **Étape 5** : si le diff touche des données de personnes, lance aussi
   `relecteur-donnees-personnelles` et ajoute son verdict à
   `05-validation.md`. La mise en production (tag `v…`) reste une décision
   humaine.

## Retours en arrière

- Le développeur ou le concepteur trouve un trou dans la spec : on revient à
  l'étape 2, on ne le comble pas dans le code.
- La validation trouve un CA non couvert : retour à l'étape 4 sur ce CA.
- Petite correction évidente (coquille, bogue d'une ligne) : la chaîne n'est
  pas obligatoire, le TDD de `CLAUDE.md` suffit.
