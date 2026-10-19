# Évaluation, présences, synthèses : historique des décisions

Historique des choix. Les règles en vigueur sont dans `.claude/rules/evaluation.md`.

## Table `evaluation` en ajout seul

- **Date :** non datée.
- **Contexte :** il faut l'historique de progression d'un élève et la traçabilité de qui a noté quoi.
- **Décision :** une correction crée une ligne ; l'état courant d'un critère est la dernière saisie (le plus grand `id`).
- **Conséquences :** aucun UPDATE ni DELETE sur la table. Elle n'a pas besoin d'Envers.

## Entraînement N2/N3 en piscine/fosse séparé de l'évaluation

- **Date :** 2026, V45. Choix du club.
- **Contexte :** pour un référentiel `milieu_naturel_exclusif` (N2, N3), une note prise sur une séance en milieu artificiel était refusée.
- **Décision :** la note n'est plus refusée. Elle est marquée `evaluation.entrainement` et forme un second état courant, que l'acquisition, la validation, le retard et la délivrance ignorent.
- **Conséquences :** la grille, la vue globale, la fiche PDF et la notation groupée distinguent les deux suivis. Démo : Camille (N2), V113, vidéo M19.

## Présence avant notation

- **Date :** 2026. Choix du club.
- **Décision :** un élève ne se note sur une séance que s'il y est `PRESENT`, sur tous les chemins. Les présences peuvent être annoncées jusqu'à 7 jours avant ; les notes attendent le jour J.
- **Conséquences :** une présence anticipée ne compte ni dans les ateliers ni pour la délivrance avant la séance. La grille ne propose que les séances où l'élève est présent. Hors ligne, la file envoie les présences avant les notes. La feuille de présence signale les présents pas encore évalués.

## Théorie en plus de nage ou bloc

- **Date :** 2026, V72. Choix du club.
- **Décision :** `participation.theorie` : la théorie s'ajoute à nage ou bloc, ou se fait seule (atelier `THEORIE`, colonne alors toujours vraie).
- **Conséquences :** `Participation.codeAtelier()` produit des codes combinés (« BLOC+THEORIE »).

## Synthèse des notes : état de l'exercice

- **Date :** 2026. Choix du club.
- **Contexte :** avec la notation par exercice (voir `docs/decisions/exercices.md`), une note porte deux états : celui de l'exercice et celui du critère.
- **Décision :** la synthèse montre et compte l'état de l'exercice noté (`statutExercice`), sinon `statut`. L'état du critère n'est rappelé que s'il diffère.
- **Conséquences :** un exercice d'initiation acquis s'affiche « acquis ». La vue « Tableau » reprend le tableau papier du club.

## Synthèse des compétences d'un groupe : état seul

- **Date :** 2026. Choix du club.
- **Décision :** pas de nombre de critères ; chaque case ne montre que l'état A / ECA / NT (`EtatCompetence`).
- **Conséquences :** l'état est calculé par `GrilleService` et porté par chaque bloc de la grille (`BlocVue.etat`).

## Validation d'une compétence : nombre de maîtrises et accord des encadrants du groupe

- **Date :** 2026-10-19. Choix du club.
- **Contexte :** une seule maîtrise acquise suffisait, et un seul moniteur habilité validait. Le club veut fixer, par compétence, le nombre d'exercices de maîtrise acquis qui la valident, et que la validation se décide entre les encadrants du groupe d'entraînement de l'élève, « comme un vote ».
- **Décision :**
  - `bloc_competence.maitrises_requises` (V93, 1 par défaut) : exercices de maîtrise **différents** à acquérir (base par id, libres par intitulé, hors entraînement), plafonné au nombre de maîtrises actives ; réglé par un ADMIN sous chaque compétence de `/admin/exercices` (`PUT /api/referentiels/{id}/blocs/{blocId}/maitrises-requises`) ; `EvaluationService.exigenceMaitrise`.
  - Votants = encadrants attitrés du groupe de l'élève, actifs, habilités au niveau (`ValidationParAccordService.votants`). La compétence est validée quand **la moitié arrondie au-dessus** a donné son accord (1/2, 2/3, 2/4) ; **un référent la valide seul**. Élève sans groupe, ou groupe sans votant : un seul encadrant habilité, comme avant. Un encadrant hors du groupe : 422.
  - Même route `POST /api/cursus/{id}/competences/{blocId}/validation` : vérifie toutes les règles à chaque appel (`EvaluationService.verifierValidable`), enregistre un accord (`accord_validation`, ajout seul, unique par cursus/bloc/moniteur), valide si le compte est atteint, renvoie `EtatValidation`. Pas de refus ni de retrait d'accord (non demandé).
- **Conséquences :** la grille porte `votantIds`, `accordsRequis`, `BlocVue.accords`, `maitrisesRequises`, `maitrisesAcquises` ; boutons « Valider la compétence », « Proposer la validation », « Accepter la validation » (`core/validation-competence.ts`). Un moniteur qui a donné un accord ne se supprime plus (on désactive son compte). Les fichiers `.claude/rules/exercices.md` (« Validation d'une compétence ») et `evaluation.md` sont à compléter de ce point (non modifiables par l'assistant).
