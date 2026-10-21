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
- **Relances CACI** (`notification/relance/`, spec `docs/specs/2026-10-21-relances-caci`) : les e-mails passent par `ServiceNotification.envoyerCourriel` (parti = `true`, accepté par le SMTP ; console en `dev`), sans méthode ajoutée à l'interface. Moniteurs relancés : rôle `MONITEUR` (pas `estMoniteur()`) et compte actif le jour D (`actif`, `acces_jusqu_au` absent ou ≥ D), filtrés dans `RelancesCaciService` avant le calcul. Tables `relance_caci_envoi` (trace) et `relance_caci_faite` (relances faites, garde la fin de validité, jamais exposée) en SQL seul, sans Envers (V99_1). Journal d'un échec : jamais d'adresse, de nom ni de date de CACI (`ServiceNotificationEmail` ne journalise que le type de l'exception). Déclenchement chaque jour à 7 h, heure de Paris (`DeclencheurRelancesCaci`, horloge `Clock` de `HorlogeConfig`) ; aucune route ni bouton.
