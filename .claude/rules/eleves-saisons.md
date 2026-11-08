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
- **Brevet obtenu dans une autre structure** (choix du club, 2026-11-08) : statut de cursus `OBTENU_AILLEURS` (V99_13), choisi dans « Inscriptions ». Comme `DELIVRE`, la fiche prend le niveau (`Eleve.enregistrerBrevet`) ; ce n'est pas une délivrance du club. Comme `ABANDON`, hors formation (`Cursus.horsFormation`) : absent de la feuille de présence (sauf présence déjà saisie) et des formations du programme d'exercices (`ProgrammeSeanceService`) ; en plus, absent d'Infos élèves (roster), sauf noté présent à une séance du jour. *Pourquoi :* au bord du bassin, les moniteurs gardent son téléphone et sa personne à prévenir (relecture données personnelles). `dernier_niveau` seul ne ferme jamais un cursus en cours.
- **Une personne, une ligne, même inscrite deux fois dans la saison** (brevet délivré en cours d'année puis niveau suivant ; choix du club, 2026-11-08) : `InscriptionRetenue.uneParEleve` (en cours ou suspendue, puis validée ou délivrée, puis hors formation ; à égalité la plus récente), appliquée au trombinoscope (hors formation exclues), à la feuille de présence (l'inscription déjà saisie pour la séance l'emporte), à Infos élèves (présences et comptes bloc / nage de toutes ses inscriptions de la saison), à la synthèse des compétences du groupe et au compte d'élèves du programme d'exercices. Front : `core/inscription-retenue.ts`, « Formations en cours » pour un encadrant (l'élève connecté garde ses deux formations). « Inscriptions » (admin), le paquet hors ligne et les grilles gardent toutes les inscriptions. Testé par `PlusieursInscriptionsTest`.
- **Supprimer une inscription faite par erreur** : `DELETE /api/cursus/{id}`, ADMIN, bouton « Supprimer l'inscription » de la fenêtre « Modifier » ; 422 dès qu'une note, validation, délivrance ou présence existe (passer alors en « Abandon »). Seule formation de la saison : l'élève reste en maintien (adhésion). `ChangementFormationService.supprimer`, testé par `SuppressionInscriptionTest`.
