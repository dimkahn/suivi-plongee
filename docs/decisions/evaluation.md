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

## Validation d'une compétence : exercices de maîtrise obligatoires et accord des encadrants du groupe

- **Date :** 2026-10-19. Choix du club.
- **Contexte :** une seule maîtrise acquise suffisait, et un seul moniteur habilité validait. Le club veut désigner les exercices de maîtrise obligatoires pour valider chaque compétence (pas un nombre), vérifier que les progressions types les font tous faire comme le veut le MFT, et que la validation se décide entre les encadrants du groupe d'entraînement de l'élève, « comme un vote ».
- **Décision :**
  - `exercice_competence.obligatoire` (V93, maîtrise seulement, case de « Modifier » dans `/admin/exercices`) : la compétence ne se valide qu'avec tous ses obligatoires actifs acquis, hors entraînement ; sans obligatoire, une maîtrise acquise suffit comme avant (`EvaluationService.exigenceMaitrise`, `BlocVue.maitriseAttendue` / `maitriseObligatoire`).
  - Le MFT veut chaque critère validé : V93 coche, pour chaque critère qui a une maîtrise active, celle qui couvre le plus de critères (puis l'ordre) ; `ModeleCentreMerService` fait de même pour les critères que la base « mer » laisse sans obligatoire. `/admin/exercices` signale un critère non couvert (`core/exercices-obligatoires.ts`). Vérifié sur le contenu installé : `ExercicesObligatoiresMftTest`.
  - `ProgressionVue.obligatoiresManquants` : obligatoires actifs prévus dans aucune période, ou (N2/N3 par mois) seulement hors milieu naturel ; encadré dans `/admin/progressions`. Les trois progressions types du club n'en ont aucun (même test). `ExerciceResume.obligatoire` : mention dans la progression et pastille « Obligatoire pour valider » dans `/parcours`.
  - Démo : V125 note 1.7 et 1.8 acquis pour Anis (vidéo M6).
  - **Un critère technique se valide aussi seul, par le même vote** (V94, `validation_critere`, `accord_validation_critere`, ajout seul) : `POST /api/cursus/{id}/criteres/{critereId}/validation`, `ValidationParAccordService.accepterCritere` (vote commun `voter`), `EvaluationService.verifierCritereValidable` : critère acquis hors entraînement, ses obligatoires acquis (`obligatoiresManquants`), ni lui ni sa compétence déjà validés. Grille : `CritereVue.validation`, `accords`, `maitriseAttendue` ; « Valider le critère » / « Proposer… » / « Accepter de valider le critère » sous le critère, dans la compétence. Indépendant de la validation de la compétence, qui ne l'exige pas.
  - Votants = encadrants attitrés du groupe de l'élève, actifs, habilités au niveau (`ValidationParAccordService.votants`). La compétence est validée quand **la moitié arrondie au-dessus** a donné son accord (1/2, 2/3, 2/4) ; **un référent la valide seul**. Élève sans groupe, ou groupe sans votant : un seul encadrant habilité, comme avant. Un encadrant hors du groupe : 422.
  - Même route `POST /api/cursus/{id}/competences/{blocId}/validation` : vérifie toutes les règles à chaque appel (`EvaluationService.verifierValidable`), enregistre un accord (`accord_validation`, ajout seul, unique par cursus/bloc/moniteur), valide si le compte est atteint, renvoie `EtatValidation`. Pas de refus ni de retrait d'accord (non demandé).
- **Conséquences :** la grille porte `votantIds`, `accordsRequis`, `BlocVue.accords` ; boutons « Valider la compétence », « Proposer la validation », « Accepter la validation » (`core/validation-competence.ts`). Un moniteur qui a donné un accord ne se supprime plus (on désactive son compte). Les fichiers `.claude/rules/exercices.md` (« Validation d'une compétence ») et `evaluation.md` sont à compléter de ce point (non modifiables par l'assistant).
