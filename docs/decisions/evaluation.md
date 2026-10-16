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
