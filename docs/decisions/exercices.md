# Exercices : historique des décisions

Historique des choix. Les règles en vigueur sont dans `.claude/rules/exercices.md`.

## Programme d'exercices d'une séance

- **Date :** 2026, V39 puis V40 (`exercice_seance.groupe_id`).
- **Décision :** chaque groupe d'entraînement prépare sa séance exercice par exercice. Le programme se remplace d'un bloc, sans historique, et ne note personne.
- **Conséquences :** une note ne peut pas pointer vers un exercice du programme (voir « Exercice libre noté »). Les schémas des exercices libres sont rattachés à la séance (V58).

## Notation sur l'exercice dans la fiche de suivi

- **Date :** 2026. Choix du club.
- **Décision :** sous chaque exercice du programme, on note l'exercice (non abordé / en cours d'acquisition / acquis), même une compétence validée. Plusieurs exercices se notent sur un même critère.
- **Conséquences :** `CritereVue.etatsExercices`, rappel « Exercices déjà notés », pastille de compétence recalculée à l'écran.

## Base d'exercices par compétence

- **Date :** 2026, V50 (structure), V51 (N1), V59 (N2), V61 (N3).
- **Contexte :** le document du club numérote « 9 » Retourner en surface et « 10 » Évoluer en sécurité, rangés dans l'ordre inverse par V7.
- **Décision :** rattachement sur l'ordre du bloc, numéros du document conservés. N2 et N3 : chaque critère a au moins un exercice de maîtrise décrit en milieu naturel.
- **Conséquences :** rappel du club (2026) : une note en piscine/fosse, même sur un exercice de maîtrise, reste un entraînement. Après l'installation, la base se modifie depuis `/admin/exercices`.

## Exercice relié à ses critères

- **Date :** 2026, V54. Choix du club.
- **Décision :** un exercice est relié aux critères qu'il travaille (« 1.7 » → « Gréage et dégréage », pas toute la compétence « S'équiper »).
- **Conséquences :** le bloc ne sert plus qu'à ranger et numéroter.

## La note porte sur l'exercice

- **Date :** 2026, V56. Choix du club.
- **Décision :** `evaluation.statut_exercice` garde l'état saisi pour l'exercice ; `evaluation.statut` reste l'état du critère qui en découle.
- **Conséquences :** un exercice d'initiation peut être acquis sans rendre le critère acquis. Les notes anciennes et la notation groupée peuvent être sans exercice ; la vue globale les marque « sans exercice ».

## Exercice exigé dans la grille

- **Date :** 2026. Choix du club : on doit lire la phase de chaque note.
- **Contexte :** le serveur ne refuse « acquis » sans exercice que pour un critère qui a un exercice de maîtrise actif (`verifierExerciceDeMaitrise`).
- **Décision :** la grille va plus loin et exige un exercice pour toute note d'un critère qui en a, sauf critère déjà acquis (`refusSansExercice`).

## Validation d'une compétence conditionnée à une maîtrise

- **Date :** 2026. Choix du club.
- **Décision :** un bloc qui a des exercices de maîtrise actifs ne se valide que si l'élève en a acquis au moins un, hors entraînement.

## Programme construit d'abord avec la base

- **Date :** 2026. Choix du club.
- **Décision :** « + Ajouter des exercices des compétences » ; un exercice venu de la base garde son intitulé et reçoit ses critères, seuls durée et consignes se retouchent.
- **Conséquences :** l'« exercice libre » (échauffement, nage) reste la saisie d'avant, avec une phase facultative depuis V55 (choix du club, 2026).

## Exercice libre noté (choix révisé)

- **Date :** 2026, V57. Choix révisé.
- **Contexte :** un exercice libre ne servait qu'à étiqueter le programme.
- **Décision :** un exercice libre qui a une phase et des critères sert aussi à noter ces critères.
- **Conséquences :** le programme se remplaçant d'un bloc, la note copie intitulé et phase (`evaluation.exercice_libre`, `evaluation.phase_exercice`) au lieu d'un lien. Un exercice libre sans phase ne fait toujours qu'étiqueter le programme.

## Critère de réussite et schéma des exercices libres

- **Date :** 2026, V58.
- **Décision :** un exercice libre reçoit son critère de réussite et son schéma, dans `schema_programme`, rattachée à la séance.
- **Conséquences :** l'image est copiée si l'exercice est repris d'une autre séance et effacée un jour après n'être plus citée.

## Ligne « Programme d'exercices » retirée de la vue globale

- **Date :** 2026.
- **Contexte :** une ligne « Programme d'exercices » figurait en tête du tableau de la vue globale.
- **Décision :** retirée, jugée inutile par le club. Le programme est signalé sous chaque date (« programme : 3 »).

## Parcours de formation

- **Date :** 2026, V64 à V70. Choix du club : « un vrai cursus de niveau ».
- **Décision :** conseils, photos et vidéos (liens) par exercice ; exercices rattachés aux périodes des progressions types.
- **Écarté :** un découpage séance par séance. Le découpage reste par mois (choix de 2026 maintenu).
- **Conséquences :** V65/V67/V69 remplissent conseils et périodes de V22 sans changer les blocs des périodes. V66/V68/V70 complètent les schémas pour que chaque exercice ait le sien. Photos et vidéos restent à fournir par le club.

## Schémas de la base

- **Date :** 2026, V52 (table), V53 (N1), V60 (N2), V62 (N3).
- **Décision :** N1 découpé dans le document du club (compétences 1 à 8 seulement) ; N2 et N3 dessinés en Java2D par des outils hors de `mvn test`.
- **Conséquences :** ces outils et migrations ne se relancent pas pour corriger un schéma déjà en base : l'écran d'admin sert à ça.
