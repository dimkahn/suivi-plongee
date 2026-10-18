---
paths:
  - "backend/src/main/java/fr/club/plongee/formation/**/*Adhesion*"
  - "backend/src/main/java/fr/club/plongee/formation/**/*InscriptionClub*"
  - "backend/src/main/java/fr/club/plongee/formation/**/*Saison*"
  - "backend/src/main/java/fr/club/plongee/formation/**/*Participation*"
  - "backend/src/main/java/fr/club/plongee/formation/calendrier/**"
  - "frontend/src/app/features/admin/eleves.component.ts"
  - "frontend/src/app/features/admin/saisons.component.ts"
  - "frontend/src/app/features/seances/generation-saison.component.ts"
---

# Élèves et saisons

- **Un élève n'est pas forcément en formation.** `Cursus` = formation N1/N2/N3 figée sur un référentiel. Pour un breveté qui plonge sans viser de niveau : `AdhesionSaison` (`adhesion_saison`, `/api/adhesions`), appartenance légère à une saison, sans référentiel ni suivi. `Participation.cursus_id` reste obligatoire (volontaire) : un élève en adhésion seule n'apparaît pas dans le roster. Écran `/admin/eleves`, filtre « Sans rattachement à la saison ». Compter ses présences un jour = vrai chantier sur `Participation`, pas une extension d'`AdhesionSaison`.
- **Inscription au club à jour, par saison** (choix du club, 2026) : `inscription_club` (V86, ligne = OK, absence = KO), `/api/inscriptions-club`, ADMIN pour changer, MONITEUR pour lire. Pastille OK/KO sur chaque carte de `/admin/eleves` et filtre « Inscription au club ». Distincte d'`AdhesionSaison` et de `Cursus` ; tout repart à KO à la saison suivante.
- **Vacances scolaires : source officielle, pas de copie.** `GenerationSaisonService` (`/admin/seances/generer`) lit les vacances de la zone dans le jeu « Calendrier scolaire » de data.education.gouv.fr (`CalendrierScolaireOfficiel`) au moment de l'aperçu : le serveur doit joindre internet. Source injoignable = refus explicite, jamais de dates devinées. Jours fériés calculés (`JoursFeries`, Pâques par Meeus). Les tests utilisent une fausse source (`GenerationSaisonTest`).
