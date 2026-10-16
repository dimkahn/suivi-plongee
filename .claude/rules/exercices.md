---
paths:
  - "backend/src/main/java/fr/club/plongee/referentiel/**"
  - "backend/src/main/java/fr/club/plongee/formation/**"
  - "frontend/src/app/features/exercices/**"
  - "frontend/src/app/features/seances/programme-exercices.component.ts"
  - "frontend/src/app/features/admin/exercices-admin.component.ts"
  - "frontend/src/app/features/grille/**"
  - "frontend/src/app/core/programme-seance.component.ts"
  - "frontend/src/app/core/phase-exercice.ts"
  - "frontend/src/app/core/schema-exercice.component.ts"
  - "frontend/src/app/core/photo-exercice.component.ts"
  - "backend/src/main/java/db/migration/**"
  - "backend/src/test/java/fr/club/plongee/outils/**"
---

# Exercices : programme de séance, base par compétence, parcours, schémas

## Règles

### Programme d'exercices d'une séance
- **Chaque groupe d'entraînement prépare sa séance exercice par exercice, avant comme après la séance** : `/seances/:id/programme`, `ProgrammeSeanceService`, `exercice_seance` + `exercice_seance_critere` (V39), `exercice_seance.groupe_id` (V40).
- **Le programme d'un groupe est préparé par ses encadrants attitrés (référents compris) ou un ADMIN**, refus 422 sinon. Tous les encadrants le consultent.
- **`groupe_id` null = programme commun à toute la séance** (séance sans groupes, échauffement), préparé par tout encadrant.
- **Chaque exercice vise une formation** (`referentiel_id`, null = exercice commun sans critère) **et les critères qu'il fait travailler.**
- **Le programme ne note personne et se remplace d'un bloc, sans historique** : `PUT …/programme?groupeId=` (sans paramètre : le commun). Il disparaît avec la séance ou le groupe.
- **Le programme se construit d'abord avec la base** : « + Ajouter des exercices des compétences », `exercice_seance.exercice_competence_id`. Un tel exercice garde l'intitulé de la base et **reçoit les critères de la base** (`ProgrammeSeanceService` ignore ceux envoyés par le client). Seuls durée et consignes se retouchent. *Pourquoi :* choix du club, 2026.
- **Le programme propose d'abord les exercices de la période du mois.**
- **L'« exercice libre » (échauffement, nage) a une phase facultative** : `exercice_seance.phase` (V55). `phaseEffective()` = celle de la base pour un exercice qui en vient. *Pourquoi :* choix du club, 2026.
- **Un exercice libre sans phase ne fait qu'étiqueter le programme.**
- **Un exercice du programme montre le critère de réussite et le schéma de la base ; un exercice libre reçoit les siens** : `exercice_seance.critere_reussite` et `schema_id` vers `schema_programme` (V58).
- **`schema_programme` est rattachée à la séance, pas à l'exercice**, puisque le programme se remplace d'un bloc. Image déposée d'abord par `POST …/programme/schemas`, copiée si l'exercice est repris d'une autre séance, effacée un jour après n'être plus citée (`SchemaProgrammeService`).
- **Les vues portent `critereReussite`, `aSchema` et `schemaId`** (exercice libre).

### Notation dans la fiche de suivi
- **La grille reçoit le programme commun et celui du groupe de l'élève** : `GrilleVue.programmes`, donc embarqué hors ligne. Elle marque les critères travaillés à la séance choisie.
- **Sous chaque exercice du programme, on note l'exercice** (« non abordé / en cours d'acquisition / acquis »). Son état est la dernière note de cet exercice (`CritereVue.etatsExercices`). Ouvert même une compétence validée. *Pourquoi :* choix du club, 2026.
- **Même règle dans la compétence dès qu'un exercice est choisi** : les boutons montrent l'état de l'exercice ; celui du critère est rappelé dessous (« Critère : … ») ; celui de la compétence en pastille (A / ECA / NT, recalculé à l'écran avec les notes en attente).
- **Plusieurs exercices se notent sur un même critère** : sous « 1. Exercice », « Exercices déjà notés » (lu dans `etatsExercices`) les rappelle avec leur état et en reprend un d'un appui ; « + Noter un autre exercice » ouvre le choix. La notation sur un exercice reste ouverte une compétence validée. *Pourquoi :* choix du club, 2026.
- **Les boutons de note n'affichent que les sigles NA / ECA / A**, avec une légende en haut de la fiche ; leur nom accessible reste le libellé complet (lu par les vidéos). *Pourquoi :* place sur téléphone.
- **La notation groupée propose de cocher d'un coup les critères des exercices** (du groupe filtré et du commun), chacun gardant son commentaire obligatoire.
- **Le choix de l'exercice propose les exercices libres sous « Exercices libres du programme ».**

### Base d'exercices par compétence (N1, N2, N3)
- **`ExerciceCompetence` = exercice type rattaché à un bloc d'une version du MFT** (paquet `referentiel`, table `exercice_competence`, V50) : numéro du document du club (« 1.7 »), `PhaseExercice` (INITIATION, PERFECTIONNEMENT, MAITRISE), déroulement, critère de réussite.
- **N1 (V51)** : 90 exercices du N1 PE20, 9 par compétence. Le document numérote « 9 » Retourner en surface et « 10 » Évoluer en sécurité, rangés dans l'ordre inverse par V7 : le rattachement se fait sur l'ordre du bloc, les numéros restent ceux du document.
- **N2 (V59)** : 99 exercices du N2 PA20 | PE40, 9 par compétence, numérotés dans l'ordre des blocs de V8, rédigés d'après le MFT de mai 2026 ; rien pour les deux blocs transverses de théorie. Chaque critère a au moins un exercice de maîtrise, toujours décrit **en milieu naturel**.
- **N3 (V61)** : 63 exercices du N3 PA40 | PE60, 7 compétences, MFT de décembre 2025 ; rien pour le bloc transverse de théorie. Enseignement et validation entre 0 et 40 m par un E3 ; zone 40-60 m seulement sous un E4 et progressivement, comme le MFT. Chaque critère a au moins un exercice de maîtrise en milieu naturel.
- **Une note en piscine/fosse, même sur un exercice de maîtrise, reste un suivi d'entraînement** (`estEntrainement`) et ne fait rien acquérir. *Pourquoi :* rappel du club, 2026.
- **Un exercice est relié aux critères qu'il travaille** : `exercice_competence_critere` (V54), au moins un, tous de son bloc. Le bloc ne sert qu'à ranger et numéroter. *Pourquoi :* choix du club, 2026 (« 1.7 » → « Gréage et dégréage », pas toute la compétence « S'équiper »).
- **La base se modifie depuis `/admin/exercices`** : `ExerciceCompetenceController`, ADMIN ; lecture MONITEUR.
- **Un exercice déjà noté ne se supprime pas, il se désactive.**

### La note porte sur l'exercice
- **Chaque note peut porter l'exercice réalisé** : `evaluation.exercice_id`, facultatif, qui doit travailler le critère noté. Choisi critère par critère dans la grille, présélectionné d'après le programme de la séance.
- **Deux états par note** : `evaluation.statut_exercice` (V56), l'état saisi pour l'exercice (un exercice d'initiation peut être acquis) ; `evaluation.statut`, l'état du **critère** qui en découle, seul lu par la validation des blocs, le retard et la délivrance. *Pourquoi :* choix du club, 2026.
- **Règle de dérivation** (`EvaluationService.statutDuCritere`, même règle côté écran dans la grille) : un exercice de maîtrise fait l'état du critère ; toute autre note sur un exercice (initiation, perfectionnement, exercice non abordé) le met en cours et ne fait jamais reculer un critère acquis.
- **Serveur : sans exercice, « acquis » est refusé pour un critère qui a un exercice de maîtrise actif** (`verifierExerciceDeMaitrise`), sauf critère déjà acquis (commentaire).
- **Grille : un exercice est exigé pour toute note d'un critère qui en a**, sauf critère déjà acquis (`refusSansExercice`). *Pourquoi :* choix du club, 2026 : on doit lire la phase de chaque note.
- **La notation groupée et les notes anciennes peuvent être sans exercice** ; la vue globale les marque « sans exercice ».
- **Un critère sans exercice de maîtrise se note sans exercice** (au N1 : « Départ plage », « Ventilation sur tuba », bloc transverse).
- **Pas de suivi séparé par phase** : la phase ne fait que qualifier la note.

### Exercice libre noté
- **Un exercice libre qui a une phase et des critères sert à noter ces critères** : `Notation.exerciceLibre` (son intitulé), retrouvé par `EvaluationService.exerciceLibre` dans le programme de la séance notée. Refus s'il n'y est plus, ne travaille pas le critère ou n'a pas de phase.
- **La note copie l'intitulé et la phase** (le programme se remplaçant d'un bloc, pas de lien) : `evaluation.exercice_libre` et `evaluation.phase_exercice` (V57).
- **Un exercice libre suit toujours la règle des phases** (seule la maîtrise acquise rend le critère acquis), même pour un critère sans exercice de maîtrise dans la base.
- **Les vues le livrent comme un `ExerciceNoteVue` sans id ni numéro** (`CelluleVue.exerciceLibre` / `phaseExercice` dans la vue globale).

### Validation d'une compétence
- **Un bloc qui a des exercices de maîtrise actifs ne se valide que si l'élève en a acquis au moins un**, de la base ou exercice libre de maîtrise, hors entraînement : `EvaluationService.maitriseManquante`, `EvaluationRepository.maitriseAcquiseDansLeBloc`. La grille le rappelle à la place du bouton (`BlocVue.maitriseAttendue`). *Pourquoi :* choix du club, 2026.

### Lecture : grille, historique, vue globale
- **Pastille I/P/M** sous chaque critère de la grille, dans l'historique et dans chaque case de la vue globale.
- **Un clic sur une séance de la vue globale montre le programme préparé**, exercices libres compris (`MatriceVue.programmes`, mêmes données que `GrilleVue.programmes`), puis les exercices notés (`MatriceVue.exercices`).
- **La vue globale signale le programme sous chaque date** (« programme : 3 »).
- **Le filtre par défaut de la vue globale garde les séances où l'élève était présent** (`MatriceVue.seancesPresent`) autant que celles où il a été noté.

### Parcours de formation
- **Chaque exercice de la base a des conseils de l'encadrant** : `exercice_competence.conseils` (V64) : vigilance, erreurs fréquentes, remédiation. *Pourquoi :* choix du club, 2026, « un vrai cursus de niveau ».
- **Photos d'exercice** : `photo_exercice`, 6 au plus, légende, dépôt ADMIN qui exige `accordPersonnes` (personne de reconnaissable ou accord donné). *Pourquoi :* le club suit des mineurs.
- **Vidéos d'exercice = liens seulement** : `video_exercice`, https ou `/medias/…`, jamais de fichier en base.
- **`MediaExerciceService`, `FicheExerciceController`** : `GET /api/exercices/{id}` renvoie la fiche complète, avec les périodes où l'exercice est prévu et ses voisins dans la compétence.
- **Les périodes d'une progression type portent des exercices** : `periode_progression_exercice`, rangés par bloc puis ordre, sans ordre propre ; `DemandePeriode.exerciceIds` null = inchangés.
- **Le parcours est lu par les encadrants sur `/parcours`** (`ParcoursComponent`) ; chaque exercice ouvre `/exercices/:id` (`FicheExerciceComponent`).
- **Le découpage reste par mois**, pas séance par séance (choix de 2026 maintenu).
- **Contenu installé** : V65 (N1), V67 (N2), V69 (N3) remplissent les conseils (seulement s'ils sont vides) et les exercices des périodes de V22, initiation avant maîtrise, toutes les maîtrises N2/N3 dans la période en milieu naturel. Les blocs des périodes, qui font le retard, ne changent pas.
- **Chaque exercice a son schéma** : V66, V68, V70 (migrations Java) complètent les schémas, dessinés par `SchemasExercicesN1`, `SchemasExercicesN2Complements`, `SchemasExercicesN3Complements` (`-Dschemas.n1=`, `-Dschemas.n2c=`, `-Dschemas.n3c=`, même règle que les outils N2/N3).
- **Photos et vidéos restent à fournir par le club.**
- **Réseau obligatoire pour la fiche et le parcours** ; les photos vues restent en cache comme les schémas.

### Schémas de la base
- **Table `schema_exercice` à part** (V52), comme `photo_eleve` ; PNG/JPEG vérifiés par leur signature ; `SchemaExerciceService`, `/api/exercices/{id}/schema`, dépôt ADMIN.
- **V53 est une migration Java** (`backend/src/main/java/db/migration/`) qui charge les images de `db/schemas/n1/`, découpées exercice par exercice dans le document du club (compétences 1 à 8 seulement ; 5.3 et 5.4 partagent le même).
- **V60** : 31 exercices du N2 (`db/schemas/n2/`), dessinés en Java2D par `backend/src/test/java/fr/club/plongee/outils/SchemasExercicesN2.java`. Hors de `mvn test` : son nom ne finit pas par `Test` et il exige `-Dschemas.n2=<dossier>`.
- **V62** : 20 exercices du N3 (`db/schemas/n3/`), `SchemasExercicesN3`, mêmes éléments de dessin, `-Dschemas.n3=`.
- **Les vues ne portent que `aSchema`** ; l'image se lit à part (`SchemaExerciceComponent`), gardée sur l'appareil et embarquée par « Préparer hors ligne ».

## À ne pas faire
- Ne pas garder d'historique du programme ni y noter un élève : il se remplace d'un bloc.
- Ne pas accepter les critères envoyés par le client pour un exercice venu de la base.
- Ne pas lier une note à un exercice libre par id : copier intitulé et phase.
- Ne pas laisser une note autre que maîtrise rendre un critère acquis, ni faire reculer un critère acquis.
- Ne pas faire acquérir quoi que ce soit par une note en piscine/fosse sur N2/N3, même sur un exercice de maîtrise.
- Ne pas supprimer un exercice déjà noté : le désactiver.
- Ne pas créer de suivi séparé par phase.
- Ne pas stocker de fichier vidéo en base.
- Ne pas déposer de photo d'exercice sans `accordPersonnes`.
- Ne pas découper le parcours séance par séance.
- Ne pas relancer les outils de schémas ni les migrations pour corriger un schéma déjà en base : passer par l'écran d'admin.
- Ne pas remettre la ligne « Programme d'exercices » en tête de la vue globale.

## Repères
- `exercice_seance`, `exercice_seance_critere` (V39), `exercice_seance.groupe_id` (V40), `exercice_seance.exercice_competence_id`, `exercice_seance.phase` (V55), `exercice_seance.critere_reussite` (V58) : programme d'une séance.
- `ProgrammeSeanceService`, `SchemaProgrammeService`, `schema_programme` : programme et ses schémas.
- `GrilleVue.programmes`, `CritereVue.etatsExercices`, `BlocVue.maitriseAttendue` : grille.
- `ExerciceCompetence`, `exercice_competence`, `exercice_competence_critere`, `PhaseExercice`, `ExerciceCompetenceController` : base d'exercices.
- `evaluation.exercice_id`, `evaluation.statut_exercice` (V56), `evaluation.statut`, `evaluation.exercice_libre`, `evaluation.phase_exercice` (V57) : la note et l'exercice.
- `EvaluationService.statutDuCritere`, `verifierExerciceDeMaitrise`, `refusSansExercice`, `EvaluationService.exerciceLibre`, `EvaluationService.maitriseManquante`, `EvaluationRepository.maitriseAcquiseDansLeBloc` : règles de notation.
- `Notation.exerciceLibre`, `ExerciceNoteVue`, `CelluleVue.exerciceLibre`, `phaseExercice`, `MatriceVue.programmes`, `MatriceVue.exercices`, `MatriceVue.seancesPresent` : vues.
- `exercice_competence.conseils`, `photo_exercice`, `video_exercice`, `MediaExerciceService`, `FicheExerciceController`, `periode_progression_exercice`, `DemandePeriode.exerciceIds`, `ParcoursComponent`, `FicheExerciceComponent` : parcours.
- `schema_exercice`, `SchemaExerciceService`, `SchemaExerciceComponent` : schémas de la base.
- Outils de dessin (hors `mvn test`) : `SchemasExercicesN1`, `SchemasExercicesN2`, `SchemasExercicesN3`, `SchemasExercicesN2Complements`, `SchemasExercicesN3Complements`.
- Migrations : V50 base, V51/V59/V61 contenu N1/N2/N3, V52/V53/V60/V62 schémas, V54 critères, V56/V57 notes, V64 médias, V65/V67/V69 conseils et périodes, V66/V68/V70 schémas complémentaires.

Historique des choix : `docs/decisions/exercices.md`.
