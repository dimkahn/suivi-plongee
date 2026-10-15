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

**Programme d'exercices d'une séance (2026).** Chaque groupe d'entraînement
prépare sa séance exercice par exercice (`/seances/:id/programme`,
`ProgrammeSeanceService`, `exercice_seance` + `exercice_seance_critere`,
V39 ; `exercice_seance.groupe_id`, V40), avant comme après la séance. Le
programme d'un groupe est préparé par ses encadrants attitrés (référents
compris) ou un ADMIN (refus 422 sinon) et consulté par tous les encadrants ;
`groupe_id` null = programme commun à toute la séance (séance sans groupes,
échauffement), préparé par tout encadrant. Chaque exercice vise une formation
(`referentiel_id`, null = exercice commun sans critère) et les critères qu'il
fait travailler. Le programme ne note personne : celui d'un groupe se
remplace d'un bloc (`PUT …/programme?groupeId=`, sans paramètre : le
commun), sans historique, et disparaît avec la séance ou le groupe. La fiche
de suivi reçoit avec la grille (`GrilleVue.programmes`, donc embarquée hors
ligne) le programme commun et celui du groupe de l'élève, et marque les
critères travaillés à la séance choisie, et les fait noter sous chaque
exercice du programme (choix du club, 2026 : on y note **l'exercice**,
« non abordé / en cours d'acquisition / acquis », dont l'état est la
dernière note de cet exercice, `CritereVue.etatsExercices` ; ouvert même
une compétence validée). Même règle dans la compétence dès qu'un exercice
est choisi : les boutons montrent l'état de l'exercice, celui du critère
est rappelé dessous (« Critère : … ») et celui de la compétence en
pastille (A / ECA / NT, recalculé à l'écran avec les notes en attente).
Plusieurs exercices se notent sur un même critère (choix du club, 2026) :
sous « 1. Exercice », « Exercices déjà notés » (lu dans `etatsExercices`)
les rappelle avec leur état et en reprend un d'un appui, « + Noter un
autre exercice » ouvre le choix ; comme sous le programme, la notation
sur un exercice reste ouverte une compétence validée.
Les boutons de note n'affichent que les sigles NA / ECA / A (place sur
téléphone), avec une légende en haut de la fiche ; leur nom accessible
reste le libellé complet (lu par les vidéos) ; la notation groupée propose de
cocher d'un coup les critères des exercices (du groupe filtré et du commun),
chacun gardant son commentaire obligatoire.

**Base d'exercices par compétence (2026, N1, N2 et N3).** `ExerciceCompetence`
(paquet `referentiel`, table `exercice_competence`, V50) : des exercices types
rattachés à un bloc d'une version du MFT, chacun avec un numéro (celui du
document du club, « 1.7 »), une `PhaseExercice` (INITIATION, PERFECTIONNEMENT,
MAITRISE), un déroulement et un critère de réussite. V51 installe les 90
exercices du N1 PE20 (9 par compétence) ; attention, le document numérote
« 9 » Retourner en surface et « 10 » Évoluer en sécurité, rangés dans l'ordre
inverse par V7 : le rattachement se fait sur l'ordre du bloc, les numéros
restent ceux du document. V59 installe les 99 exercices du N2 PA20 | PE40
(9 par compétence, numérotés dans l'ordre des blocs de V8, rédigés d'après
le MFT de mai 2026 ; rien pour les deux blocs transverses de théorie) : chaque critère y a au moins un exercice de maîtrise, toujours
décrit **en milieu naturel** — une note en piscine/fosse, même sur un
exercice de maîtrise, reste un suivi d'entraînement (`estEntrainement`) et
ne fait rien acquérir (rappel du club, 2026). V61 fait de même pour les 63
exercices du N3 PA40 | PE60 (7 compétences, MFT de décembre 2025, rien pour
le bloc transverse de théorie) : enseignement et validation entre 0 et 40 m
par un E3, zone 40-60 m seulement sous un E4 et progressivement, comme le
MFT. **Un exercice est relié aux critères qu'il
travaille** (V54, `exercice_competence_critere`, au moins un, tous de son
bloc ; choix du club 2026 : « 1.7 » → « Gréage et dégréage », pas toute la
compétence « S'équiper ») ; le bloc ne sert qu'à ranger et numéroter.
Ensuite la base se modifie depuis `/admin/exercices`
(`ExerciceCompetenceController`, ADMIN ; lecture MONITEUR) ; un exercice déjà
noté ne se supprime pas, il se désactive. **Chaque note porte l'exercice
réalisé** (`evaluation.exercice_id`, facultatif, qui doit travailler le
critère noté ; choisi critère par critère dans la grille, présélectionné
d'après le programme de la séance). **La note porte sur l'exercice** (choix
du club, 2026) : V56 ajoute `evaluation.statut_exercice`, l'état saisi pour
l'exercice (un exercice d'initiation peut être acquis), et `evaluation.statut`
reste l'état du **critère** qui en découle, seul lu par la validation des
blocs, le retard et la délivrance (`EvaluationService.statutDuCritere`, même
règle côté écran dans la grille) : un exercice de maîtrise fait l'état du
critère ; toute autre note sur un exercice (initiation, perfectionnement,
exercice non abordé) le met en cours et ne fait jamais reculer un critère
acquis. Sans exercice, « acquis » est
refusé pour un critère qui a un exercice de maîtrise actif
(`verifierExerciceDeMaitrise`), sauf critère déjà acquis (commentaire) ; la
grille va plus loin (choix du club, 2026 : on doit lire la phase de chaque
note) et exige un exercice pour toute note d'un critère qui en a, sauf
critère déjà acquis (`refusSansExercice`) ; la notation groupée et les
notes anciennes peuvent en être dépourvues, la vue globale les marque
« sans exercice » ; un
critère sans exercice de maîtrise (au N1 :
« Départ plage », « Ventilation sur tuba », bloc transverse) se note comme
avant. **Validation d'une compétence** (choix du club, 2026) : un bloc qui a
des exercices de maîtrise actifs ne se valide que si l'élève en a acquis au
moins un, de la base ou exercice libre de maîtrise, hors entraînement
(`EvaluationService.maitriseManquante`, `EvaluationRepository.maitriseAcquiseDansLeBloc`) ;
la grille le rappelle à la place du bouton (`BlocVue.maitriseAttendue`). Le programme d'une séance se construit
d'abord avec la base (choix du club, 2026 : « + Ajouter des exercices des
compétences », `exercice_seance.exercice_competence_id`) : un tel exercice
garde l'intitulé de la base et **reçoit les critères de la base**
(`ProgrammeSeanceService`, ceux envoyés par le client sont ignorés) ; seuls
durée et consignes se retouchent. L'« exercice libre » (échauffement, nage)
reste la saisie d'avant, avec une phase facultative (V55,
`exercice_seance.phase`, choix du club 2026 ; `phaseEffective()` = celle de
la base pour un exercice qui en vient). **Choix révisé (2026) : un exercice
libre qui a une phase et des critères sert aussi à noter** ces critères
(`Notation.exerciceLibre`, son intitulé, retrouvé par
`EvaluationService.exerciceLibre` dans le programme de la séance notée ;
refus s'il n'y est plus, ne travaille pas le critère ou n'a pas de phase).
Le programme se remplaçant d'un bloc, la note n'y fait pas de lien : V57
copie l'intitulé et la phase dans `evaluation.exercice_libre` et
`evaluation.phase_exercice` ; un exercice libre suit toujours la règle des
phases (seule la maîtrise acquise rend le critère acquis), même pour un
critère sans exercice de maîtrise dans la base. Les vues le livrent comme
un `ExerciceNoteVue` sans id ni numéro (`CelluleVue.exerciceLibre` /
`phaseExercice` dans la vue globale) ; dans la grille, le choix de
l'exercice le propose sous « Exercices libres du programme ». Un exercice
libre sans phase ne fait qu'étiqueter le programme. Un exercice du
programme montre le critère de réussite et le schéma de la base ; un
exercice libre reçoit les siens (V58, `exercice_seance.critere_reussite`
et `schema_id` vers `schema_programme`, table rattachée à la séance et
non à l'exercice puisque le programme se remplace d'un bloc ; image
déposée d'abord par `POST …/programme/schemas`, copiée si l'exercice est
repris d'une autre séance, effacée un jour après n'être plus citée,
`SchemaProgrammeService`). Les vues portent `critereReussite`, `aSchema`
et `schemaId` (exercice libre). Lecture : pastille I/P/M sous chaque critère de la grille,
dans l'historique et dans chaque case de la vue globale, dont un clic sur
une séance montre le programme d'exercices préparé, exercices libres compris
(`MatriceVue.programmes`, mêmes données que `GrilleVue.programmes`), puis
les exercices notés (`MatriceVue.exercices`). La vue globale signale le
programme sous chaque date (« programme : 3 » ; la ligne « Programme
d'exercices » en tête du tableau a été retirée, jugée inutile par le club),
et son filtre par défaut garde les séances où l'élève était
présent (`MatriceVue.seancesPresent`) autant que celles où il a été noté. Pas de
suivi séparé par phase : la phase ne fait que qualifier la note.
**Parcours de formation (2026, choix du club : « un vrai cursus de
niveau »).** V64 ajoute à chaque exercice de la base des **conseils de
l'encadrant** (`exercice_competence.conseils` : vigilance, erreurs
fréquentes, remédiation), des **photos** (`photo_exercice`, 6 au plus,
légende, dépôt ADMIN qui exige `accordPersonnes` : personne de
reconnaissable ou accord donné — le club suit des mineurs) et des
**vidéos** qui ne sont que des **liens** (`video_exercice`, https ou
`/medias/…`, jamais de fichier en base) ; `MediaExerciceService`,
`FicheExerciceController` (`GET /api/exercices/{id}` : fiche complète,
avec les périodes où l'exercice est prévu et ses voisins dans la
compétence). Les **périodes d'une progression type portent des
exercices** (`periode_progression_exercice`, rangés par bloc puis ordre,
sans ordre propre ; `DemandePeriode.exerciceIds` null = inchangés) : c'est
le parcours, lu par les encadrants sur `/parcours` (`ParcoursComponent`),
chaque exercice ouvrant `/exercices/:id` (`FicheExerciceComponent`).
Le programme d'une séance propose d'abord les exercices de la période du
mois. Le découpage reste **par mois** (pas séance par séance, choix de
2026 maintenu). Contenu : V65 (N1), V67 (N2), V69 (N3) remplissent les
conseils (seulement s'ils sont vides) et les exercices des périodes de
V22, initiation avant maîtrise, toutes les maîtrises N2/N3 dans la
période en milieu naturel (les blocs des périodes, qui font le retard,
ne changent pas) ; V66, V68, V70 (migrations Java) complètent les
schémas pour que **chaque exercice ait le sien**, dessinés par
`SchemasExercicesN1`, `SchemasExercicesN2Complements`,
`SchemasExercicesN3Complements` (`-Dschemas.n1=`, `-Dschemas.n2c=`,
`-Dschemas.n3c=`, même règle que les outils N2/N3 ci-dessous). Les photos
et vidéos restent à fournir par le club.
Réseau obligatoire pour la fiche et le parcours (les photos vues restent
en cache comme les schémas).
**Schémas** (V52, table `schema_exercice` à part comme `photo_eleve`,
PNG/JPEG vérifiés par leur signature, `SchemaExerciceService`,
`/api/exercices/{id}/schema`, dépôt ADMIN) : V53 est une **migration Java**
(`backend/src/main/java/db/migration/`) qui charge les images de
`db/schemas/n1/`, découpées exercice par exercice dans le document du club
(compétences 1 à 8 seulement ; 5.3 et 5.4 partagent le même). V60 fait de
même pour 31 exercices du N2 (`db/schemas/n2/`), dessinés en Java2D par
l'outil `backend/src/test/java/fr/club/plongee/outils/SchemasExercicesN2.java`
(hors de `mvn test` : son nom ne finit pas par `Test` et il exige
`-Dschemas.n2=<dossier>`) ; V62 pour 20 exercices du N3 (`db/schemas/n3/`,
`SchemasExercicesN3`, mêmes éléments de dessin, `-Dschemas.n3=`) ; ne pas les relancer pour corriger un schéma
déjà en base, passer par l'écran d'admin. Les vues ne
portent que `aSchema` ; l'image se lit à part (`SchemaExerciceComponent`),
gardée sur l'appareil et embarquée par « Préparer hors ligne ».
