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

**`evaluation` est une table en ajout seul.** Une correction crée une ligne ;
l'état courant d'un critère est la dernière saisie (le plus grand `id`). Cela
donne l'historique de progression et la traçabilité de qui a noté quoi. Ne pas
introduire d'UPDATE ni de DELETE sur cette table.
**N2/N3 : entraînement en piscine/fosse à part de l'évaluation (choix du
club, 2026).** Pour un référentiel `milieu_naturel_exclusif`, une note prise
sur une séance en milieu artificiel n'est plus refusée : elle est marquée
`evaluation.entrainement` (V45, fixé à la saisie par
`EvaluationService.estEntrainement`) et forme un second état courant
(`EvaluationRepository.etatEntrainement`). `etatCourant` et
`compterAcquisDuBloc` l'excluent : l'acquisition, la validation d'un bloc,
le retard de progression et la délivrance ne lisent que le milieu naturel.
La grille livre les deux (`CritereVue.entrainement`,
`BlocVue.acquisEntrainement`) ; côté écran, la séance choisie décide du
suivi que notent les boutons, l'autre est rappelé sous le critère. La vue
globale (`MatriceComponent`, `CelluleVue.entrainement`) marque les colonnes
« validation »/« entraînement », donne les deux états actuels par critère
et filtre par milieu ; la fiche PDF a une colonne « Piscine / fosse ». La
notation groupée compare au suivi de la séance (rien ne recule non plus).
Démo : notes d'entraînement en fosse de Camille (N2), V113, vidéo M19.
**Présence avant notation (choix du club, 2026).** Un élève ne se note sur
une séance que s'il y est noté `PRESENT` (`EvaluationService.verifierSeance`,
tous chemins : grille, synchronisation, notation groupée) ; une compétence
transverse notée sans séance n'est pas concernée. Les présences se
renseignent jusqu'à 7 jours avant la séance
(`Seance.JOURS_ANTICIPATION_PRESENCE`), les notes et le profil réalisé
attendent toujours le jour J. Une présence annoncée à l'avance ne compte ni
dans les séances bloc/nage (`ParticipationRepository.compterAtelier`) ni
comme plongée en milieu naturel pour la délivrance tant que la séance n'a pas
eu lieu. La grille ne propose que les séances où l'élève est présent
(`GrilleVue.seancesPresent`, recouvert par les présences en attente sur
l'appareil) ; hors ligne, `FileAttenteService` envoie la file des présences
avant les notes. La feuille de présence compte les notes reçues par chaque
élève sur la séance (`LignePresence.evaluations`, entraînement compris) :
une séance passée signale les présents « pas encore évalués » (lien vers
leur grille, filtre dédié), les notes en attente sur l'appareil comptant
comme reçues. **Théorie en plus** (V72, `participation.theorie`, choix du
club 2026) : nage et bloc s'excluent, la théorie s'y ajoute ou se fait
seule (atelier `THEORIE`, dont la colonne est alors toujours vraie) ;
`Participation.codeAtelier()` donne « BLOC+THEORIE » à Infos élèves et à
la synthèse des notes.
**Notation groupée** (bouton « Noter les présents » de la feuille de
présence, `NotationGroupeeService`, `POST /api/seances/{id}/notation-groupee`) :
plusieurs élèves présents, un ou plusieurs critères, chacun avec son
commentaire, obligatoire (le même pour tous les élèves notés).
Elle ne fait jamais reculer un élève : acquis reste acquis, en cours reste en
cours (seul le commentaire s'ajoute), non abordé passe en cours. Élèves d'une
même version du MFT à la fois, présence déjà enregistrée exigée, tout ou rien
(un refus nomme l'élève), réseau obligatoire.
**Synthèse des notes d'une séance** (lien « Synthèse des notes » de la
feuille de présence, `/seances/:id/synthese?niveau=`, `SyntheseSeanceService`,
`GET /api/seances/{id}/synthese`, MONITEUR/ADMIN) : pour un niveau, les
présents et, par critère noté pendant la séance, le compte acquis / en
cours / non abordé ; l'état retenu par élève et critère est sa **dernière
note de la séance**, avec tous les commentaires du jour. L'état montré et
compté est celui de l'**exercice noté** (`NoteSyntheseVue.statutAffiche` =
`statutExercice`, sinon `statut` pour une note sans exercice ; choix du
club, 2026) : un exercice d'initiation acquis s'affiche « acquis », l'état
du critère n'est rappelé que s'il diffère. Vue d'ouverture « Tableau » sur le modèle du tableau papier du club :
élèves en lignes (sous le nom, les encadrants qui l'ont noté,
`EleveSyntheseVue.notePar`, et l'atelier), critères en colonnes,
commentaires en dernière colonne. Lecture seule, réseau obligatoire (pas
embarquée hors ligne).
**Synthèse des compétences d'un groupe** (lien « Synthèse des compétences
du groupe » d'Infos élèves, `/groupes-entrainement/synthese?groupe=`,
`SyntheseGroupeService`, `GET /api/groupes-entrainement/{id}/synthese-competences`,
MONITEUR/ADMIN) : un élève du groupe par ligne, une compétence (bloc) par
colonne, un tableau par version du MFT. Chaque case ne montre que l'état
de la compétence (choix du club, 2026 : pas le nombre de critères),
`EtatCompetence` (paquet `evaluation.service`), calculé par `GrilleService`
et porté par chaque bloc de la grille (`BlocVue.etat`) :
A acquise = bloc validé ; ECA en cours d'acquisition = un critère noté
au-delà de « non abordé » (entraînement compris), même tous acquis tant
que le bloc n'est pas validé ; NT non travaillée sinon. Lecture seule,
réseau obligatoire. **Fiche de synthèse d'un élève** (lien « Synthèse
A / ECA / NT » de la grille, `/cursus/:id/synthese`,
`SyntheseEleveComponent`) : ses compétences en trois listes, avec le
détail des critères pour celles en cours ; lue dans la grille elle-même,
donc hors ligne si la grille est embarquée, et ouverte à l'élève pour sa
propre formation. Les synthèses montrent la photo de chaque élève
(`aPhoto` dans leurs vues, droit à l'image compris ; `PhotoEleveComponent`
de `core/`, initiales à défaut).
