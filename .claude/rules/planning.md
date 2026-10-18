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

Paquet `fr.club.plongee.planning`. Écrans : `/admin/planning` (grille, admin), `/admin/groupes-entrainement`, `/planning` (lecture encadrants).

## Groupes d'entraînement
- `GroupeEntrainement` appartient à une saison : encadrants attitrés, référents, lignes attitrées, élèves.
- Référent toujours aussi encadrant attitré (règle du service, `groupe_entrainement_referent`, V36). *Pourquoi :* le planning ne lit qu'une liste d'encadrants.
- Une ou plusieurs lignes attitrées : `groupe_entrainement_espace` (V37), ex. lignes 5 et 6 pour un groupe nombreux.
- Lire les lignes attitrées dans `groupe_entrainement_espace`, jamais dans `groupe_entrainement.espace_attitre_id` : colonne inutilisée par le code mais gardée, écrite par les démos V104/V107 (V111 recopie).
- Élèves rangés explicitement par l'admin dans `/admin/groupes-entrainement` ; suggestion tirée de `niveau_prepare` et du cursus en cours, rien d'automatique.
- Un élève dans au plus un groupe par saison (règle du service).
- Suivi d'un élève par les référents de son groupe ; plus de moniteur référent par cursus (`cursus.moniteur_referent_id` supprimé, ne pas le recréer). *Pourquoi :* choix du club, 2026.
- Aucun rapport avec `GroupePlongeurs` (V13, palanquées d'un séjour, voir `encadrants-fiche-securite.md`).

## Espaces du bassin
- `EspaceBassin` : V26 installe les lignes 1 à 6 et la fosse 10 m (15 plongeurs, encadrants compris).

## Grille des soirées (`PlanningService`)
- Soirée = date de la saison portant au moins une séance en milieu artificiel (piscine, fosse) ; une date avec seulement du milieu naturel n'y figure pas. *Pourquoi :* choix du club, 2026.
- `affectation_groupe` (V27) ne stocke que les écarts à la ligne attitrée : autre espace, fosse avec `profondeur_limitee` (« F6 »), activité, absence. Changer la ligne attitrée suit donc sur les dates non retouchées.
- Un écart « espace » remplace toutes les lignes attitrées du groupe ce soir-là : une ou plusieurs lignes (V38 : `espace_id` = la première, `affectation_groupe_ligne` les autres), ou la fosse **seule** (règle du service).
- `CaseVue.espaces` liste tous les espaces occupés ; c'est ce que lisent les avertissements.
- Même consigne sur plusieurs cases d'un coup, en tout ou rien : glisser à la souris, ou appui long puis touchers au téléphone ; barre « Pas de séance » / « Lignes attitrées » / « Autre choix… ». `PUT /api/planning/saison/{id}/cases`, `PlanningService.definirCases`.
- `soiree_planning` (V41) porte le DP fosse (colonne historique `responsable_id`) et le DP piscine (`dp_piscine_id`). *Pourquoi :* choix du club, 2026.
- DP de soirée distincts du DP de la fiche de sécurité (E3 minimum, choisi à part). `seance.dp_id` inutilisé : ne pas s'en servir.
- Avertissements calculés par le serveur, jamais bloquants :
  - fosse au-delà de sa capacité (élèves + encadrants du soir) ;
  - groupe N1, ou encadré par un E1, en fosse sans limite à 6 m ;
  - ligne donnée à deux groupes ;
  - groupe ayant séance dont tous les encadrants attitrés ont répondu absent ;
  - DP fosse ou DP piscine absent ;
  - dès qu'un encadrant a répondu présent, aucun E3 parmi les présents (`FicheSecuriteService.NIVEAU_DP_MINIMUM`).
- `/planning` : lecture soirée par soirée, groupes de l'encadrant en tête (`PlanningVue.mesGroupeIds`, calculé serveur) ; embarqué hors ligne.

## Présences des encadrants
- Une réponse PRESENT/ABSENT par encadrant et par soirée : `disponibilite_encadrant` (V28), depuis `/planning` ou par un admin à sa place (`saisi_par_id`).
- Pas de ligne = pas encore répondu, jamais supposé présent ni absent.
- Réponse en ligne seulement, pas de file hors ligne.
- Suite possible : rappel aux encadrants qui n'ont pas répondu.

## Encadrant dans un autre groupe un soir
- Seul l'écart est stocké : `affectation_encadrant` (V42), au plus une ligne par encadrant et par soirée, saisie par un ADMIN dans le dialogue de la soirée.
- Ce soir-là, il n'encadre que ce groupe.
- Les avertissements (capacité fosse, E1, groupe sans encadrant présent) lisent `CaseVue.encadrants` : attitrés moins partis, plus venus (`affecteCeSoir`).
- `mesGroupeIds` reste les groupes attitrés ; `/planning` met en tête les groupes du soir.
- Il accède au programme d'exercices du groupe d'accueil pour les séances de ce jour (`ProgrammeSeanceService`).

## Filtres par groupe
- Infos élèves, Présences et Trombinoscope filtrent sur les groupes d'entraînement de la saison ouverte (`FiltreGroupeComponent`), pas sur PN1/PN2/PN3.
- Onglet Moniteurs du trombinoscope : encadrants attitrés (`membres="ENCADRANTS"`).

Historique des choix : `docs/decisions/planning.md`.
