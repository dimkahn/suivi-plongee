# Specs

Une évolution non triviale passe par cinq étapes (skill `de-la-spec-au-code`),
chacune produite par un agent de `.claude/agents/` et validée par un humain :

1. `01-intention.md` — le problème, la valeur, le critère de succès
   (`redacteur-intention` ; le PO corrige).
2. `02-spec.md` — le quoi : comportement attendu, critères d'acceptation
   (`redacteur-spec` ; Produit, Tech et QA ensemble).
3. `03-plan.md` — le comment : UX, solution technique, découpage
   (`concepteur-plan` ; Design et Tech approuvent).
4. Le code et ses tests (`developpeur-tdd` ; la Tech relit).
5. `05-validation.md` — tests, couverture des critères, risque
   (`validateur` ; QA et tech lead décident).

Un dossier par évolution : `docs/specs/<AAAA-MM-JJ>-<sujet>/`. Le **Statut**
en tête de chaque fichier dit où on en est. Les décisions durables qui en
sortent vont ensuite dans `.claude/rules/` et `docs/decisions/`.
