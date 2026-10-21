---
paths:
  - "backend/src/main/java/fr/club/plongee/commun/*Caci*"
  - "backend/src/main/java/fr/club/plongee/formation/domain/Eleve.java"
  - "backend/src/main/java/fr/club/plongee/formation/**/*PhotoEleve*"
  - "backend/src/main/java/fr/club/plongee/formation/EleveController.java"
  - "backend/src/main/java/fr/club/plongee/formation/TrombinoscopeController.java"
  - "backend/src/main/java/fr/club/plongee/securite/**"
  - "backend/src/main/java/fr/club/plongee/admin/**"
  - "backend/src/main/java/fr/club/plongee/notification/relance/**"
  - "frontend/src/app/core/*caci*"
  - "frontend/src/app/core/photo-eleve.component.ts"
  - "frontend/src/app/features/admin/eleves.component.ts"
  - "frontend/src/app/features/admin/moniteurs.component.ts"
  - "frontend/src/app/features/compte/**"
  - "frontend/src/app/features/roster/**"
---

# Données personnelles : CACI et photos

Complète « Données personnelles » de CLAUDE.md.

- **CACI** : seule la date de l'examen se saisit (`caci_date_examen`) ; la fin de validité (`eleve.certificat_valide_jusqu_au`) en est déduite par le serveur, examen + 1 an (`Caci.finValidite`, choix du club 2026 ; V48 a repris la date d'examen des dossiers qui n'avaient que la fin).
- Élève (V46) et moniteur (V47, mêmes colonnes sur `utilisateur`) : date d'examen, qualité du médecin (`caci_medecin`, enum `MedecinCaci`), cases cochées du CACI FFESSM « Version Juin 2026 » (`caci_activites`, enum `ActiviteCaci`, libellés dans `core/caci.ts`). Types communs dans `fr.club.plongee.commun` (`Caci.verifier()`) ; écran : `SaisieCaciComponent`, `DetailCaciComponent`.
- Saisi par un ADMIN (dossier élève, écran Moniteurs) ; montré au clic sur la case CACI d'« Infos élèves », sur le CACI d'un moniteur et dans « Mon compte ».
- **Les cases seulement, jamais le texte du médecin** (activités en compétition, détail des limites) : la case « limites » renvoie au certificat papier.
- **Photo d'élève** (`photo_eleve`, table séparée pour ne pas alourdir les lectures) : ni acceptée ni renvoyée par `EleveController` sans `eleve.autorisation_image` (distinct d'`autorisation_legale`, qui ne couvre que la pratique). Retirer le consentement supprime la photo.
- **Trombinoscope des moniteurs**, même règle : `utilisateur.autorisation_image` + `photo_utilisateur`. Dépôt par un ADMIN (`/api/admin/moniteurs/{id}/photo`) ou par le moniteur (`/api/auth/moi/photo`, « Mon compte » : le dépôt vaut consentement, le retrait le retire) ; lecture `/api/moniteurs/{id}/photo`.

## Relances CACI (spec `docs/specs/2026-10-21-relances-caci`)

- `relance_caci_faite` garde la fin de validité calculée (rien d'autre du
  CACI) pour éviter une double relance ; jamais exposée par l'API. Purgée au
  début de chaque traitement : « bientôt » et « jour J » dès que la fin de
  validité est passée, citations « Sans CACI renseigné » hors des 7 jours de
  R12 (avant D − 6).
- La trace `relance_caci_envoi` (+ `_personne`) recopie nom, prénom et adresse
  du destinataire et les noms des personnes concernées, sans clé étrangère :
  elle survit 2 ans à la suppression d'un dossier, puis est purgée (choix du
  club, 2026 : supprimée le premier jour D où envoi + 2 ans < D,
  `plusYears(2)`, calculé en Java). Ni fin de validité, ni mention élève ou
  moniteur, ni texte de l'e-mail. Lue seulement par
  `GET /api/admin/relances-caci` (`hasRole('ADMIN')` : ni niveau E1 à E4 ni
  DIRECTEUR_TECHNIQUE), records de vue sans identifiant ; aucune route
  d'écriture ni de déclenchement.
- E-mails : prénom, nom, mention, fin de validité et date du jour seulement.
  Journal : jamais d'adresse, de nom, d'identifiant ni de date de CACI (type
  de l'exception seulement).
