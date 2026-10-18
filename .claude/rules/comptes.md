---
paths:
  - "backend/src/main/java/fr/club/plongee/securite/**"
  - "backend/src/main/java/fr/club/plongee/notification/**"
  - "backend/src/main/resources/application*.yml"
  - "frontend/src/app/features/connexion/**"
  - "frontend/src/app/features/compte/**"
---

# Comptes et e-mail

- **Comptes élèves fermés** (choix du club, 2026) : aucun écran ne crée de compte élève, et un compte qui n'a que le rôle `ELEVE` ne se connecte pas (`AuthController.compteEleveFerme`, 422 lisible à la connexion, refus au rafraîchissement) tant que `app.comptes-eleves-ouverts` est faux. Défaut `COMPTES_ELEVES_OUVERTS=false`, vrai seulement en profil `dev` (`eleve@club.fr`, vidéos E1/E2, tests ; `ComptesElevesFermesTest` vérifie la fermeture). Les élèves passent par le lien et le code des séjours. Le code pour élève connecté (grille en lecture, carnet, « Modifier mes informations ») reste en place pour une ouverture ultérieure, avec une campagne de création de comptes à écrire.
- **E-mail** : `ServiceNotificationEmail` en profil `!dev` (`spring.mail.*` du profil `prod`, variables `SMTP_HOTE`, `SMTP_UTILISATEUR`, `SMTP_MOT_DE_PASSE`) ; en `dev`, seulement `ServiceNotificationConsole`.
