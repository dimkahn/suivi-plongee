---
paths:
  - "backend/src/main/java/fr/club/plongee/evaluation/**"
  - "backend/src/main/java/fr/club/plongee/formation/**/*Participation*"
  - "backend/src/main/java/fr/club/plongee/formation/**/*Cursus*"
  - "backend/src/main/java/fr/club/plongee/formation/**/Roster*"
  - "frontend/src/app/features/grille/**"
  - "frontend/src/app/features/presences/**"
  - "frontend/src/app/features/roster/**"
  - "frontend/src/app/features/seances/synthese-seance.component.ts"
  - "frontend/src/app/features/groupes/synthese-groupe.component.ts"
  - "frontend/src/app/features/synchronisation/**"
---

# Évaluation, présences, synthèses

## Droits
- **Seule exception à « l'auteur vient du SecurityContext »** (choix du club, 2026) : un référent du groupe d'entraînement de l'élève peut noter au nom d'un autre encadrant qui ne l'a pas fait (`pourMoniteurId`, contrôlé par `EvaluationService.moniteurRemplace` : référent du groupe de l'élève dans la saison du cursus, encadrant actif et habilité au niveau). La note porte le nom de cet encadrant (`moniteur_id`), le référent est gardé dans `evaluation.saisi_par_id` (V63, null si on note soi-même), montré « saisi par » dans l'historique. Grille seulement (et sa file hors ligne) : ni notation groupée ni validation d'un bloc.

## Table `evaluation`
- **Ajout seul, ni UPDATE ni DELETE** : une correction crée une ligne ; état courant d'un critère = dernière saisie (plus grand `id`). *Pourquoi :* garder l'historique de progression et qui a noté quoi.

## Entraînement N2/N3 en piscine/fosse
- **Note en milieu artificiel sur un référentiel `milieu_naturel_exclusif` acceptée, marquée entraînement** : `evaluation.entrainement` (V45), fixé à la saisie par `EvaluationService.estEntrainement`. *Pourquoi :* choix du club, 2026.
- **Second état courant** : `EvaluationRepository.etatEntrainement`.
- **Ne fait rien acquérir** : exclu de `etatCourant` et `compterAcquisDuBloc` ; acquisition, validation d'un bloc, retard de progression et délivrance ne lisent que le milieu naturel.
- **Grille** : `CritereVue.entrainement`, `BlocVue.acquisEntrainement` ; la séance choisie décide du suivi que notent les boutons, l'autre est rappelé sous le critère.
- **Vue globale** (`MatriceComponent`, `CelluleVue.entrainement`) : colonnes « validation » / « entraînement », deux états actuels par critère, filtre par milieu.
- **Fiche PDF : colonne « Piscine / fosse ».**
- **Notation groupée : compare au suivi de la séance.**
- Démo : notes d'entraînement en fosse de Camille (N2), V113, vidéo M19.

## Présence avant notation
- **Noter sur une séance exige `PRESENT`** : `EvaluationService.verifierSeance`, sur tous les chemins (grille, synchronisation, notation groupée) ; sauf compétence transverse notée sans séance. *Pourquoi :* choix du club, 2026.
- **Présences saisissables jusqu'à 7 jours avant** (`Seance.JOURS_ANTICIPATION_PRESENCE`) ; notes et profil réalisé attendent toujours le jour J.
- **Présence anticipée non comptée tant que la séance n'a pas eu lieu** : ni en séances bloc/nage (`ParticipationRepository.compterAtelier`), ni comme plongée en milieu naturel pour la délivrance.
- **La grille ne propose que les séances où l'élève est présent** (`GrilleVue.seancesPresent`), plus les présences en attente sur l'appareil.
- **Hors ligne, présences avant notes** : `FileAttenteService`.
- **Feuille de présence : notes reçues par élève sur la séance** (`LignePresence.evaluations`, entraînement et notes en attente sur l'appareil compris). Séance passée : présents « pas encore évalués » signalés (lien vers leur grille, filtre dédié).

## Ateliers
- **Nage et bloc s'excluent ; la théorie s'y ajoute ou se fait seule** : `participation.theorie` (V72) ; atelier `THEORIE` seul = colonne toujours vraie. *Pourquoi :* choix du club, 2026.
- **`Participation.codeAtelier()`** donne le code combiné (« BLOC+THEORIE ») à Infos élèves et à la synthèse des notes.

## Notation groupée
- **Plusieurs élèves présents, un ou plusieurs critères, un commentaire obligatoire par critère** (le même pour tous) : bouton « Noter les présents » de la feuille de présence, `NotationGroupeeService`, `POST /api/seances/{id}/notation-groupee`.
- **Ne fait jamais reculer** : acquis reste acquis, en cours reste en cours (seul le commentaire s'ajoute), non abordé passe en cours.
- **Contraintes** : une seule version du MFT à la fois, présence déjà enregistrée, tout ou rien (un refus nomme l'élève), réseau obligatoire.

## Synthèse des notes d'une séance
- **Pour un niveau : les présents et, par critère noté pendant la séance, le compte acquis / en cours / non abordé** : lien « Synthèse des notes » de la feuille de présence, `/seances/:id/synthese?niveau=`, `SyntheseSeanceService`, `GET /api/seances/{id}/synthese`, MONITEUR/ADMIN.
- **État retenu par élève et critère = sa dernière note de la séance**, avec tous les commentaires du jour.
- **État montré et compté = celui de l'exercice noté** : `NoteSyntheseVue.statutAffiche` = `statutExercice`, sinon `statut` (note sans exercice). Exercice d'initiation acquis affiché « acquis » ; l'état du critère n'est rappelé que s'il diffère. *Pourquoi :* choix du club, 2026.
- **Vue d'ouverture « Tableau »** (modèle du tableau papier du club) : élèves en lignes (sous le nom, les encadrants qui l'ont noté, `EleveSyntheseVue.notePar`, et l'atelier), critères en colonnes, commentaires en dernière colonne.
- **Lecture seule, réseau obligatoire** (pas embarquée hors ligne).

## Synthèse des compétences d'un groupe
- **Un élève par ligne, une compétence (bloc) par colonne, un tableau par version du MFT** : lien « Synthèse des compétences du groupe » d'Infos élèves, `/groupes-entrainement/synthese?groupe=`, `SyntheseGroupeService`, `GET /api/groupes-entrainement/{id}/synthese-competences`, MONITEUR/ADMIN.
- **Chaque case ne montre que l'état de la compétence**, pas le nombre de critères. *Pourquoi :* choix du club, 2026.
- **État = `EtatCompetence`** (paquet `evaluation.service`), calculé par `GrilleService`, porté par chaque bloc de la grille (`BlocVue.etat`) : A acquise = bloc validé ; ECA en cours d'acquisition = un critère noté au-delà de « non abordé » (entraînement compris), même tous acquis tant que le bloc n'est pas validé ; NT non travaillée sinon.
- **Lecture seule, réseau obligatoire** (pas embarquée hors ligne).

## Fiche de synthèse d'un élève
- **Compétences en trois listes A / ECA / NT, détail des critères pour celles en cours** : lien « Synthèse A / ECA / NT » de la grille, `/cursus/:id/synthese`, `SyntheseEleveComponent`.
- **Lue dans la grille elle-même** : hors ligne si la grille est embarquée. Ouverte à l'élève pour sa propre formation.

## Photos dans les synthèses
- **Photo de chaque élève, droit à l'image compris** : `aPhoto` dans les vues, `PhotoEleveComponent` (`core/`), initiales à défaut.

Historique des choix : `docs/decisions/evaluation.md`.
