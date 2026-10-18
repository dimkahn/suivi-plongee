---
paths:
  - "backend/src/main/java/fr/club/plongee/audit/**"
  - "backend/src/main/java/fr/club/plongee/config/AuditConfig.java"
  - "backend/src/main/java/fr/club/plongee/**/domain/*.java"
  - "backend/src/main/java/fr/club/plongee/delivrance/**"
---

# Historique des entités : Envers, pas un journal maison

- `Utilisateur`, `Eleve`, `Seance`, `Cursus`, `ValidationCompetence`, `Delivrance` sont `@Audited` : chaque UPDATE/DELETE crée une ligne dans `*_aud`, rattachée à `revision_audit` qui porte l'auteur (`EcouteurRevisionAudit`, lu du SecurityContext).
- Les tables en ajout seul (`evaluation`…) portent leur propre historique : pas d'Envers.
- Auditer une nouvelle entité : `@Audited`, générer le schéma une fois avec `ddl-auto=create` sur une base jetable, reprendre le DDL à la main dans une migration Flyway (les types H2/Hibernate ne sont pas toujours ceux voulus en Postgres).
