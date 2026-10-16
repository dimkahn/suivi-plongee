---
paths:
  - "backend/src/main/java/fr/club/plongee/evaluation/**"
  - "backend/src/main/java/fr/club/plongee/formation/**"
  - "frontend/src/app/features/grille/**"
  - "frontend/src/app/features/presences/**"
  - "frontend/src/app/features/seances/synthese-seance.component.ts"
  - "frontend/src/app/features/groupes/synthese-groupe.component.ts"
  - "frontend/src/app/features/synchronisation/**"
---

# Évaluation, présences, synthèses

## Règles

### Table `evaluation`
- **`evaluation` est en ajout seul** : une correction crée une ligne. L'état courant d'un critère est la dernière saisie (le plus grand `id`). *Pourquoi :* garder l'historique de progression et savoir qui a noté quoi.

### Entraînement N2/N3 en piscine/fosse
- **Une note en milieu artificiel sur un référentiel `milieu_naturel_exclusif` est acceptée, mais marquée entraînement** : `evaluation.entrainement` (V45), fixé à la saisie par `EvaluationService.estEntrainement`. *Pourquoi :* choix du club, 2026.
- **L'entraînement forme un second état courant** : `EvaluationRepository.etatEntrainement`.
- **L'entraînement ne fait rien acquérir** : `etatCourant` et `compterAcquisDuBloc` l'excluent. Acquisition, validation d'un bloc, retard de progression et délivrance ne lisent que le milieu naturel.
- **La grille livre les deux suivis** : `CritereVue.entrainement`, `BlocVue.acquisEntrainement`. À l'écran, la séance choisie décide du suivi que notent les boutons ; l'autre est rappelé sous le critère.
- **La vue globale distingue les deux** : `MatriceComponent`, `CelluleVue.entrainement`. Colonnes marquées « validation » / « entraînement », deux états actuels par critère, filtre par milieu.
- **La fiche PDF a une colonne « Piscine / fosse ».**
- **La notation groupée compare au suivi de la séance** (et ne fait rien reculer non plus).

### Présence avant notation
- **Un élève ne se note sur une séance que s'il y est noté `PRESENT`** : `EvaluationService.verifierSeance`, sur tous les chemins (grille, synchronisation, notation groupée). Une compétence transverse notée sans séance n'est pas concernée. *Pourquoi :* choix du club, 2026.
- **Les présences se saisissent jusqu'à 7 jours avant la séance** (`Seance.JOURS_ANTICIPATION_PRESENCE`). Les notes et le profil réalisé attendent toujours le jour J.
- **Une présence annoncée à l'avance ne compte pas tant que la séance n'a pas eu lieu** : ni dans les séances bloc/nage (`ParticipationRepository.compterAtelier`), ni comme plongée en milieu naturel pour la délivrance.
- **La grille ne propose que les séances où l'élève est présent** : `GrilleVue.seancesPresent`, complété par les présences en attente sur l'appareil.
- **Hors ligne, les présences partent avant les notes** : `FileAttenteService`.
- **La feuille de présence compte les notes reçues par élève sur la séance** : `LignePresence.evaluations`, entraînement compris. Une séance passée signale les présents « pas encore évalués » (lien vers leur grille, filtre dédié). Les notes en attente sur l'appareil comptent comme reçues.

### Ateliers
- **Nage et bloc s'excluent ; la théorie s'y ajoute ou se fait seule** : `participation.theorie` (V72). Atelier `THEORIE` seul = colonne toujours vraie. *Pourquoi :* choix du club, 2026.
- **`Participation.codeAtelier()` donne le code combiné** (« BLOC+THEORIE ») à Infos élèves et à la synthèse des notes.

### Notation groupée
- **Plusieurs élèves présents, un ou plusieurs critères, un commentaire obligatoire par critère** (le même pour tous les élèves notés) : bouton « Noter les présents » de la feuille de présence, `NotationGroupeeService`, `POST /api/seances/{id}/notation-groupee`.
- **Ne fait jamais reculer un élève** : acquis reste acquis, en cours reste en cours (seul le commentaire s'ajoute), non abordé passe en cours.
- **Contraintes** : élèves d'une même version du MFT à la fois, présence déjà enregistrée, tout ou rien (un refus nomme l'élève), réseau obligatoire.

### Synthèse des notes d'une séance
- **Pour un niveau : les présents et, par critère noté pendant la séance, le compte acquis / en cours / non abordé** : lien « Synthèse des notes » de la feuille de présence, `/seances/:id/synthese?niveau=`, `SyntheseSeanceService`, `GET /api/seances/{id}/synthese`, MONITEUR/ADMIN.
- **L'état retenu par élève et critère est sa dernière note de la séance**, avec tous les commentaires du jour.
- **L'état montré et compté est celui de l'exercice noté** : `NoteSyntheseVue.statutAffiche` = `statutExercice`, sinon `statut` pour une note sans exercice. Un exercice d'initiation acquis s'affiche « acquis » ; l'état du critère n'est rappelé que s'il diffère. *Pourquoi :* choix du club, 2026.
- **Vue d'ouverture « Tableau »**, sur le modèle du tableau papier du club : élèves en lignes (sous le nom, les encadrants qui l'ont noté, `EleveSyntheseVue.notePar`, et l'atelier), critères en colonnes, commentaires en dernière colonne.
- **Lecture seule, réseau obligatoire** (pas embarquée hors ligne).

### Synthèse des compétences d'un groupe
- **Un élève du groupe par ligne, une compétence (bloc) par colonne, un tableau par version du MFT** : lien « Synthèse des compétences du groupe » d'Infos élèves, `/groupes-entrainement/synthese?groupe=`, `SyntheseGroupeService`, `GET /api/groupes-entrainement/{id}/synthese-competences`, MONITEUR/ADMIN.
- **Chaque case ne montre que l'état de la compétence**, pas le nombre de critères. *Pourquoi :* choix du club, 2026.
- **L'état est `EtatCompetence`** (paquet `evaluation.service`), calculé par `GrilleService` et porté par chaque bloc de la grille (`BlocVue.etat`) :
  - A acquise = bloc validé ;
  - ECA en cours d'acquisition = un critère noté au-delà de « non abordé » (entraînement compris), même tous acquis tant que le bloc n'est pas validé ;
  - NT non travaillée sinon.
- **Lecture seule, réseau obligatoire.**

### Fiche de synthèse d'un élève
- **Ses compétences en trois listes A / ECA / NT, avec le détail des critères pour celles en cours** : lien « Synthèse A / ECA / NT » de la grille, `/cursus/:id/synthese`, `SyntheseEleveComponent`.
- **Lue dans la grille elle-même** : hors ligne si la grille est embarquée. Ouverte à l'élève pour sa propre formation.

### Photos dans les synthèses
- **Les synthèses montrent la photo de chaque élève, droit à l'image compris** : `aPhoto` dans leurs vues, `PhotoEleveComponent` de `core/`, initiales à défaut.

## À ne pas faire
- Pas d'UPDATE ni de DELETE sur `evaluation`.
- Ne pas faire compter une note d'entraînement dans l'acquisition, la validation, le retard ou la délivrance.
- Ne pas accepter de note pour un élève non `PRESENT` sur la séance (sauf compétence transverse sans séance).
- Ne pas accepter de note ni de profil réalisé avant le jour de la séance.
- Ne pas compter une présence anticipée avant que la séance ait eu lieu.
- Ne pas faire reculer un élève par la notation groupée ; pas de notation groupée partielle ni hors ligne.
- Ne pas afficher de nombre de critères dans la synthèse de groupe.
- Ne pas embarquer hors ligne les synthèses de séance et de groupe.

## Repères
- `evaluation` : notes, en ajout seul ; `evaluation.entrainement` (V45) marque l'entraînement.
- `EvaluationService.estEntrainement` : fixe l'entraînement à la saisie. `EvaluationService.verifierSeance` : exige la présence.
- `EvaluationRepository.etatEntrainement` : état courant d'entraînement. `etatCourant`, `compterAcquisDuBloc` : milieu naturel seul.
- `CritereVue.entrainement`, `BlocVue.acquisEntrainement`, `BlocVue.etat`, `GrilleVue.seancesPresent` : vues de la grille.
- `MatriceComponent`, `CelluleVue.entrainement` : vue globale.
- `Seance.JOURS_ANTICIPATION_PRESENCE` : 7 jours d'anticipation des présences.
- `ParticipationRepository.compterAtelier` : séances bloc/nage. `participation.theorie` (V72), `Participation.codeAtelier()`.
- `FileAttenteService` : file hors ligne, présences d'abord.
- `LignePresence.evaluations` : notes reçues par élève sur la séance.
- `NotationGroupeeService` : notation groupée.
- `SyntheseSeanceService`, `NoteSyntheseVue.statutAffiche`, `EleveSyntheseVue.notePar` : synthèse des notes.
- `SyntheseGroupeService`, `EtatCompetence`, `GrilleService` : synthèse des compétences.
- `SyntheseEleveComponent` : fiche de synthèse d'un élève.
- `PhotoEleveComponent` : photo ou initiales.
- Démo : notes d'entraînement en fosse de Camille (N2), V113, vidéo M19.

Historique des choix : `docs/decisions/evaluation.md`.
