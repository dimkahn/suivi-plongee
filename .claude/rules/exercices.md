---
paths:
  - "backend/src/main/java/fr/club/plongee/referentiel/**/*Exercice*"
  - "backend/src/main/java/fr/club/plongee/referentiel/**/*Schema*"
  - "backend/src/main/java/fr/club/plongee/formation/**/*ProgrammeSeance*"
  - "backend/src/main/java/fr/club/plongee/formation/**/*ExerciceSeance*"
  - "backend/src/main/java/fr/club/plongee/formation/**/SchemaProgrammeService.java"
  - "backend/src/main/java/db/migration/**"
  - "backend/src/main/resources/db/migration/*exercice*"
  - "backend/src/main/resources/db/migration/*parcours*"
  - "backend/src/main/resources/db/migration/*programme*"
  - "backend/src/test/java/fr/club/plongee/outils/**"
  - "frontend/src/app/features/exercices/**"
  - "frontend/src/app/features/seances/programme-exercices.component.ts"
  - "frontend/src/app/features/admin/exercices-admin.component.ts"
  - "frontend/src/app/features/grille/**"
  - "frontend/src/app/core/programme-seance.component.ts"
  - "frontend/src/app/core/phase-exercice.ts"
  - "frontend/src/app/core/schema-exercice.component.ts"
  - "frontend/src/app/core/photo-exercice.component.ts"
---

# Exercices : programme de séance, base par compétence, parcours, schémas

## Programme d'exercices d'une séance
- **Chaque groupe d'entraînement prépare sa séance exercice par exercice, avant comme après** : `/seances/:id/programme`, `ProgrammeSeanceService`, `exercice_seance` + `exercice_seance_critere` (V39), `exercice_seance.groupe_id` (V40).
- **Préparé par les encadrants attitrés du groupe (référents compris) ou un ADMIN**, 422 sinon ; lu par tous les encadrants. `groupe_id` null = programme commun (séance sans groupes, échauffement), préparé par tout encadrant.
- **Chaque exercice vise une formation** (`referentiel_id`, null = commun sans critère) **et les critères qu'il travaille.**
- **Ne note personne, se remplace d'un bloc, sans historique** : `PUT …/programme?groupeId=` (sans paramètre : le commun). Disparaît avec la séance ou le groupe.
- **Construit d'abord avec la base** (« + Ajouter des exercices des compétences », `exercice_seance.exercice_competence_id`), en proposant d'abord les exercices de la période du mois. Un tel exercice garde l'intitulé et **les critères de la base** (ceux du client ignorés) ; seuls durée et consignes se retouchent. *Pourquoi :* choix du club, 2026.
- **Exercice libre (échauffement, nage) : phase facultative** (`exercice_seance.phase`, V55) ; sans phase il ne fait qu'étiqueter le programme. `phaseEffective()` = phase de la base pour un exercice qui en vient. *Pourquoi :* choix du club, 2026.
- **Critère de réussite et schéma** : ceux de la base pour un exercice venu de la base ; propres à l'exercice libre (`exercice_seance.critere_reussite`, `schema_id` → `schema_programme`, V58). Vues : `critereReussite`, `aSchema`, `schemaId`.
- **`schema_programme` rattachée à la séance, pas à l'exercice** (programme remplacé d'un bloc) : image déposée d'abord par `POST …/programme/schemas`, copiée si l'exercice est repris d'une autre séance, effacée un jour après n'être plus citée (`SchemaProgrammeService`).

## Notation dans la fiche de suivi
- **La grille reçoit le programme commun et celui du groupe de l'élève** (`GrilleVue.programmes`, donc hors ligne) et marque les critères travaillés à la séance choisie.
- **On note l'exercice** (« non abordé / en cours d'acquisition / acquis ») sous chaque exercice du programme, et dans la compétence dès qu'un exercice est choisi ; état = dernière note de l'exercice (`CritereVue.etatsExercices`). Rappels : état du critère dessous (« Critère : … »), compétence en pastille (A / ECA / NT, recalculée avec les notes en attente). Ouvert même compétence validée. *Pourquoi :* choix du club, 2026.
- **Plusieurs exercices par critère** : sous « 1. Exercice », « Exercices déjà notés » (d'après `etatsExercices`) les rappelle avec leur état et en reprend un d'un appui ; « + Noter un autre exercice » ouvre le choix, où les exercices libres sont sous « Exercices libres du programme ». *Pourquoi :* choix du club, 2026.
- **Boutons de note en sigles NA / ECA / A**, légende en haut de la fiche ; nom accessible = libellé complet (lu par les vidéos). *Pourquoi :* place sur téléphone.
- **Notation groupée : cocher d'un coup les critères des exercices** (groupe filtré + commun), commentaire obligatoire pour chacun.

## Base d'exercices par compétence (N1, N2, N3)
- **`ExerciceCompetence` = exercice type rattaché à un bloc d'une version du MFT** (paquet `referentiel`, `exercice_competence`, V50) : numéro du document du club (« 1.7 »), `PhaseExercice` (INITIATION, PERFECTIONNEMENT, MAITRISE), déroulement, critère de réussite.
- **N1 (V51)** : 90 exercices du N1 PE20, 9 par compétence. Le document numérote « 9 » Retourner en surface et « 10 » Évoluer en sécurité, rangés en ordre inverse par V7 : rattachement par l'ordre du bloc, numéros du document conservés.
- **N2 (V59)** : 99 exercices N2 PA20 | PE40, 9 par compétence, numérotés dans l'ordre des blocs de V8, d'après le MFT de mai 2026 ; rien pour les deux blocs transverses de théorie.
- **N3 (V61)** : 63 exercices N3 PA40 | PE60, 7 compétences, MFT de décembre 2025 ; rien pour le bloc transverse de théorie. Enseignement et validation 0-40 m par un E3 ; 40-60 m seulement sous un E4 et progressivement (MFT).
- **N2/N3 : chaque critère a au moins un exercice de maîtrise, en milieu naturel.** Une note en piscine/fosse, même sur un exercice de maîtrise, reste un suivi d'entraînement (`estEntrainement`) et ne fait rien acquérir. *Pourquoi :* rappel du club, 2026.
- **Un exercice est relié aux critères qu'il travaille** : `exercice_competence_critere` (V54), au moins un, tous de son bloc ; le bloc ne sert qu'à ranger et numéroter. *Pourquoi :* choix du club, 2026 (« 1.7 » → « Gréage et dégréage », pas toute « S'équiper »).
- **Modifiée depuis `/admin/exercices`** (`ExerciceCompetenceController`, ADMIN ; lecture MONITEUR). Un exercice déjà noté ne se supprime pas, il se désactive.

## La note porte sur l'exercice
- **`evaluation.exercice_id` facultatif**, doit travailler le critère noté ; choisi critère par critère dans la grille, présélectionné d'après le programme.
- **Deux états par note** : `evaluation.statut_exercice` (V56), saisi pour l'exercice (une initiation peut être acquise) ; `evaluation.statut`, état du **critère** qui en découle, seul lu par validation des blocs, retard et délivrance. *Pourquoi :* choix du club, 2026.
- **Dérivation** (`EvaluationService.statutDuCritere`, idem dans la grille) : un exercice de maîtrise fait l'état du critère ; toute autre note sur un exercice (initiation, perfectionnement, non abordé) le met en cours, sans jamais faire reculer un critère acquis. Pas de suivi séparé par phase : la phase qualifie la note.
- **Serveur : sans exercice, « acquis » refusé pour un critère qui a un exercice de maîtrise actif** (`verifierExerciceDeMaitrise`), sauf critère déjà acquis (commentaire).
- **Grille : exercice exigé pour toute note d'un critère qui en a**, sauf critère déjà acquis (`refusSansExercice`). *Pourquoi :* choix du club, 2026 : lire la phase de chaque note.
- **Sans exercice possibles** : notation groupée, notes anciennes (marquées « sans exercice » dans la vue globale), critère sans exercice de maîtrise (N1 : « Départ plage », « Ventilation sur tuba », bloc transverse).

## Exercice libre noté
- **Un exercice libre avec phase et critères sert à noter ces critères** : `Notation.exerciceLibre` (intitulé), retrouvé par `EvaluationService.exerciceLibre` dans le programme de la séance ; refus s'il n'y est plus, ne travaille pas le critère ou n'a pas de phase.
- **La note copie intitulé et phase, sans lien** (programme remplacé d'un bloc) : `evaluation.exercice_libre`, `evaluation.phase_exercice` (V57).
- **Toujours la règle des phases** (seule la maîtrise acquise rend le critère acquis), même si le critère n'a pas d'exercice de maîtrise dans la base.
- **Vues : `ExerciceNoteVue` sans id ni numéro** (`CelluleVue.exerciceLibre` / `phaseExercice` dans la vue globale).

## Validation d'une compétence
- **Un bloc avec exercices de maîtrise actifs ne se valide que si l'élève en a acquis au moins un** (base ou libre de maîtrise, hors entraînement) : `EvaluationService.maitriseManquante`, `EvaluationRepository.maitriseAcquiseDansLeBloc` ; la grille le rappelle à la place du bouton (`BlocVue.maitriseAttendue`). *Pourquoi :* choix du club, 2026.

## Lecture : grille, historique, vue globale
- **Pastille I/P/M** sous chaque critère de la grille, dans l'historique et chaque case de la vue globale.
- **Vue globale** : « programme : 3 » sous chaque date (pas de ligne « Programme d'exercices » en tête) ; clic sur une séance = programme préparé, exercices libres compris (`MatriceVue.programmes`, mêmes données que `GrilleVue.programmes`), puis exercices notés (`MatriceVue.exercices`) ; filtre par défaut = séances où l'élève était présent (`MatriceVue.seancesPresent`) ou noté.

## Parcours de formation
- **Conseils de l'encadrant par exercice** : `exercice_competence.conseils` (V64) : vigilance, erreurs fréquentes, remédiation. *Pourquoi :* choix du club, 2026, « un vrai cursus de niveau ».
- **Photos** : `photo_exercice`, 6 au plus, légende, dépôt ADMIN exigeant `accordPersonnes` (personne reconnaissable ou accord donné). *Pourquoi :* le club suit des mineurs.
- **Vidéos = liens seulement** : `video_exercice`, https ou `/medias/…`, jamais de fichier en base.
- **`MediaExerciceService`, `FicheExerciceController`** : `GET /api/exercices/{id}` = fiche complète, avec périodes où l'exercice est prévu et voisins dans la compétence.
- **Périodes d'une progression type → exercices** : `periode_progression_exercice`, rangés par bloc puis ordre, sans ordre propre ; `DemandePeriode.exerciceIds` null = inchangés.
- **Lu par les encadrants sur `/parcours`** (`ParcoursComponent`) ; chaque exercice ouvre `/exercices/:id` (`FicheExerciceComponent`). Découpage par mois, pas par séance (choix de 2026 maintenu).
- **Contenu installé** : V65 (N1), V67 (N2), V69 (N3) remplissent les conseils (si vides) et les exercices des périodes de V22, initiation avant maîtrise, toutes les maîtrises N2/N3 dans la période en milieu naturel. Les blocs des périodes (qui font le retard) ne changent pas.
- **Chaque exercice a son schéma** : V66, V68, V70 (migrations Java) complètent, dessins de `SchemasExercicesN1`, `SchemasExercicesN2Complements`, `SchemasExercicesN3Complements` (`-Dschemas.n1=`, `-Dschemas.n2c=`, `-Dschemas.n3c=`).
- **Photos et vidéos restent à fournir par le club.** Réseau obligatoire pour fiche et parcours ; photos vues en cache comme les schémas.

## Schémas de la base
- **Table `schema_exercice` à part** (V52), comme `photo_eleve` ; PNG/JPEG vérifiés par signature ; `SchemaExerciceService`, `/api/exercices/{id}/schema`, dépôt ADMIN.
- **V53, migration Java** (`backend/src/main/java/db/migration/`) : images de `db/schemas/n1/`, découpées dans le document du club (compétences 1 à 8 ; 5.3 et 5.4 partagent le même).
- **V60** : 31 exercices N2 (`db/schemas/n2/`), dessinés en Java2D par `backend/src/test/java/fr/club/plongee/outils/SchemasExercicesN2.java`, hors `mvn test` (nom sans `Test`, exige `-Dschemas.n2=<dossier>`). **V62** : 20 exercices N3 (`db/schemas/n3/`), `SchemasExercicesN3`, `-Dschemas.n3=`. Même règle pour les outils N1 et compléments.
- **Corriger un schéma déjà en base = écran d'admin**, pas relancer les outils ni les migrations.
- **Les vues ne portent que `aSchema`** ; image lue à part (`SchemaExerciceComponent`), gardée sur l'appareil et embarquée par « Préparer hors ligne ».

Historique des choix : `docs/decisions/exercices.md`.
