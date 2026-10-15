---
paths:
  - "backend/src/main/java/fr/club/plongee/planning/**"
  - "frontend/src/app/features/planning/**"
  - "frontend/src/app/features/admin/planning-admin.component.ts"
  - "frontend/src/app/features/admin/groupes-entrainement.component.ts"
  - "frontend/src/app/core/planning.ts"
  - "frontend/src/app/core/filtre-groupe.component.ts"
---

# Planning du bassin et groupes d'entraînement

**Planning du bassin : espaces et groupes d'entraînement (lot 1, 2026).**
Remplace le tableur « Planning » du lundi soir (groupes × dates, chaque case
= ligne d'eau, F10 fosse 10 m, F6 fosse limitée à 6 m). Paquet
`fr.club.plongee.planning`. `EspaceBassin` : lignes d'eau et fosse (V26 installe
lignes 1 à 6 + fosse 10 m, 15 plongeurs encadrants compris). `GroupeEntrainement`
(par saison) : encadrants attitrés, dont un ou plusieurs **référents** (V36,
`groupe_entrainement_referent` ; un référent est toujours aussi encadrant
attitré, règle du service, pour que le planning ne lise qu'une liste), une
ou plusieurs **lignes attitrées** (V37, `groupe_entrainement_espace` : un
groupe nombreux occupe par exemple les lignes 5 et 6 ; l'ancienne colonne
`groupe_entrainement.espace_attitre_id` reste en base, inutilisée, parce
que les démos V104/V107 l'écrivent — V111 recopie), élèves rangés **explicitement**
par l'admin (`/admin/groupes-entrainement`), avec une suggestion tirée de
`niveau_prepare` et du cursus en cours ; un élève dans au plus un groupe par
saison (règle du service). Choix du club (2026) : le suivi d'un élève passe
par les référents de son groupe ; l'ancien « moniteur référent » propre à
chaque cursus (`cursus.moniteur_referent_id`) a été supprimé par V36. **Sans rapport avec `GroupePlongeurs`** (V13), qui compose les palanquées d'un séjour : voir `encadrants-fiche-securite.md`.
**Grille des soirées (lot 2)** :
`/admin/planning`, `PlanningService`. Une soirée = une date de la saison qui
porte au moins une séance en milieu **artificiel** (piscine, fosse) ; une
date qui n'a que des séances en milieu naturel n'y figure pas (choix du
club, 2026). `affectation_groupe` (V27) ne stocke que les **écarts** à
la ligne attitrée (autre espace, fosse avec `profondeur_limitee` = le « F6 »,
activité, absence) : changer la ligne attitrée suit sur toutes les dates non
retouchées. Un écart « espace » met le groupe ce soir-là, à la place de
toutes ses lignes attitrées, soit sur **une ou plusieurs lignes** cochées
(V38 : `espace_id` garde la première, `affectation_groupe_ligne` les
autres), soit dans la fosse **seule** (règle du service) ; `CaseVue.espaces`
liste tous les espaces occupés, lus par les avertissements. Plusieurs cases
reçoivent la même consigne d'un coup (sélection à la souris en glissant, ou
appui long puis touchers au téléphone ; barre « Pas de séance » / « Lignes
attitrées » / « Autre choix… ») : `PUT /api/planning/saison/{id}/cases`,
`PlanningService.definirCases`, tout ou rien. `soiree_planning` porte le **DP fosse** et le
**DP piscine** (V41, choix du club 2026 : ils remplacent l'ancien
« responsable de séance » ; le DP fosse reste dans la colonne historique
`responsable_id`, écrite par la démo V107, d'où la reprise des responsables
déjà saisis comme DP fosse ; `dp_piscine_id` est nouvelle), distincts du
DP de la fiche de sécurité (E3 minimum, choisi à part ; `seance.dp_id` reste
inutilisé). Avertissements calculés par le serveur, jamais bloquants : fosse
au-delà de sa capacité (élèves + encadrants attitrés), groupe N1 ou encadré
par un E1 en fosse sans limite à 6 m, ligne donnée à deux groupes. Les
encadrants consultent en lecture sur `/planning` (soirée par soirée, leurs
groupes en tête, `PlanningVue.mesGroupeIds` calculé côté serveur ; embarqué
hors ligne). **Présences des encadrants (lot 3)** : `disponibilite_encadrant`
(V28), une réponse PRESENT/ABSENT par encadrant et par soirée, donnée depuis
`/planning` ou par un admin à sa place (`saisi_par_id`) ; pas de ligne = pas
encore répondu, jamais supposé présent ni absent. Avertissements ajoutés :
groupe ayant séance dont tous les encadrants attitrés ont répondu absent,
DP fosse ou DP piscine absent, et, dès qu'un encadrant a répondu présent,
aucun E3 parmi les présents (`FicheSecuriteService.NIVEAU_DP_MINIMUM`). La
réponse demande le réseau (pas de file hors ligne). **Encadrant dans un
autre groupe un soir** (V42, `affectation_encadrant`, une ligne au plus par
encadrant et par soirée, saisie par un ADMIN dans le dialogue de la soirée) :
comme `affectation_groupe`, seul l'écart est stocké ; ce soir-là l'encadrant
n'encadre que ce groupe. `CaseVue.encadrants` donne les encadrants du soir
(attitrés moins partis, plus venus, `affecteCeSoir`), et ce sont eux que lisent
les avertissements (capacité de la fosse, E1, groupe sans encadrant présent).
`mesGroupeIds` reste les groupes attitrés ; `/planning` met en tête les groupes
du soir. Le programme d'exercices du groupe d'accueil est ouvert à l'encadrant
pour les séances de ce jour-là (`ProgrammeSeanceService`). Les filtres des pages
Infos élèves, Présences et Trombinoscope sont les groupes d'entraînement de
la saison ouverte (`FiltreGroupeComponent`), et non plus les niveaux
PN1/PN2/PN3 ; l'onglet Moniteurs du trombinoscope filtre de même sur les
encadrants attitrés (`membres="ENCADRANTS"`). Suite possible : rappel aux encadrants qui n'ont pas répondu.
