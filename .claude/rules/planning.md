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

## Règles

### Groupes d'entraînement
- **Un groupe d'entraînement appartient à une saison** : `GroupeEntrainement`, avec ses encadrants attitrés, ses référents, ses lignes attitrées et ses élèves.
- **Un référent est toujours aussi encadrant attitré** : règle du service (`groupe_entrainement_referent`, `V36`). *Pourquoi :* le planning ne lit qu'une liste d'encadrants.
- **Un groupe peut avoir une ou plusieurs lignes attitrées** : `groupe_entrainement_espace` (`V37`). Exemple : un groupe nombreux sur les lignes 5 et 6.
- **Lire les lignes attitrées dans `groupe_entrainement_espace`, jamais dans `groupe_entrainement.espace_attitre_id`** : cette colonne reste en base, inutilisée. Ne pas la supprimer : les démos `V104`/`V107` l'écrivent (`V111` recopie).
- **Les élèves sont rangés explicitement par l'admin** dans `/admin/groupes-entrainement`. Une suggestion est tirée de `niveau_prepare` et du cursus en cours, rien n'est automatique.
- **Un élève est dans au plus un groupe par saison** : règle du service.
- **Le suivi d'un élève passe par les référents de son groupe.** *Pourquoi :* choix du club, 2026 (il n'y a plus de moniteur référent par cursus).
- **Les groupes d'entraînement n'ont aucun rapport avec `GroupePlongeurs`** (`V13`), qui compose les palanquées d'un séjour : voir `encadrants-fiche-securite.md`.

### Espaces du bassin
- **`EspaceBassin` décrit les lignes d'eau et la fosse** : `V26` installe les lignes 1 à 6 et la fosse 10 m (15 plongeurs, encadrants compris).

### Grille des soirées
- **Une soirée = une date de la saison qui porte au moins une séance en milieu artificiel** (piscine, fosse). Une date qui n'a que des séances en milieu naturel n'y figure pas. *Pourquoi :* choix du club, 2026.
- **`affectation_groupe` (`V27`) ne stocke que les écarts à la ligne attitrée** : autre espace, fosse avec `profondeur_limitee` (le « F6 »), activité, absence. Changer la ligne attitrée suit donc sur toutes les dates non retouchées.
- **Un écart « espace » remplace toutes les lignes attitrées du groupe ce soir-là** : soit une ou plusieurs lignes cochées (`V38` : `espace_id` garde la première, `affectation_groupe_ligne` les autres), soit la fosse **seule** (règle du service).
- **`CaseVue.espaces` liste tous les espaces occupés** : c'est ce que lisent les avertissements.
- **Plusieurs cases reçoivent la même consigne d'un coup, en tout ou rien** : sélection à la souris en glissant, ou appui long puis touchers au téléphone ; barre « Pas de séance » / « Lignes attitrées » / « Autre choix… ». Endpoint `PUT /api/planning/saison/{id}/cases`, `PlanningService.definirCases`.
- **`soiree_planning` porte le DP fosse et le DP piscine** (`V41`). Le DP fosse est dans la colonne historique `responsable_id`, le DP piscine dans `dp_piscine_id`. *Pourquoi :* choix du club, 2026.
- **Les DP de soirée sont distincts du DP de la fiche de sécurité** : celui-ci est E3 minimum et choisi à part. `seance.dp_id` reste inutilisé : ne pas s'en servir.
- **Les avertissements sont calculés par le serveur et jamais bloquants** :
  - fosse au-delà de sa capacité (élèves + encadrants du soir) ;
  - groupe N1, ou encadré par un E1, en fosse sans limite à 6 m ;
  - ligne donnée à deux groupes ;
  - groupe ayant séance dont tous les encadrants attitrés ont répondu absent ;
  - DP fosse ou DP piscine absent ;
  - dès qu'un encadrant a répondu présent, aucun E3 parmi les présents (`FicheSecuriteService.NIVEAU_DP_MINIMUM`).
- **Les encadrants consultent le planning en lecture sur `/planning`** : soirée par soirée, leurs groupes en tête. `PlanningVue.mesGroupeIds` est calculé côté serveur. Embarqué hors ligne.

### Présences des encadrants
- **Une réponse PRESENT/ABSENT par encadrant et par soirée** : `disponibilite_encadrant` (`V28`), donnée depuis `/planning` ou par un admin à sa place (`saisi_par_id`).
- **Pas de ligne = pas encore répondu** : jamais supposé présent ni absent.
- **La réponse demande le réseau** : pas de file hors ligne.

### Encadrant dans un autre groupe un soir
- **Seul l'écart est stocké, comme pour `affectation_groupe`** : `affectation_encadrant` (`V42`), une ligne au plus par encadrant et par soirée, saisie par un ADMIN dans le dialogue de la soirée.
- **Ce soir-là, l'encadrant n'encadre que ce groupe.**
- **Les avertissements lisent les encadrants du soir** : `CaseVue.encadrants` (attitrés moins partis, plus venus, `affecteCeSoir`) pour la capacité de la fosse, l'E1 et le groupe sans encadrant présent.
- **`mesGroupeIds` reste les groupes attitrés** ; `/planning` met en tête les groupes du soir.
- **L'encadrant accède au programme d'exercices du groupe d'accueil** pour les séances de ce jour-là (`ProgrammeSeanceService`).

### Filtres par groupe
- **Les filtres d'Infos élèves, Présences et Trombinoscope sont les groupes d'entraînement de la saison ouverte** (`FiltreGroupeComponent`), pas les niveaux PN1/PN2/PN3.
- **L'onglet Moniteurs du trombinoscope filtre sur les encadrants attitrés** (`membres="ENCADRANTS"`).

## À ne pas faire
- Ne pas lire ni écrire `groupe_entrainement.espace_attitre_id` dans le code (démos seulement).
- Ne pas recréer de moniteur référent par cursus (`cursus.moniteur_referent_id`, supprimé).
- Ne pas utiliser `seance.dp_id`, ni confondre DP de soirée et DP de fiche de sécurité.
- Ne pas stocker dans `affectation_groupe` ou `affectation_encadrant` une case identique à l'attribution attitrée.
- Ne pas rendre un avertissement bloquant.
- Ne pas supposer une présence ou une absence sans réponse.
- Ne pas mêler groupes d'entraînement et `GroupePlongeurs`.

## Repères
- Paquet `fr.club.plongee.planning`.
- `EspaceBassin` : lignes d'eau et fosse (`V26`).
- `GroupeEntrainement` : groupe d'une saison ; `groupe_entrainement_referent` (`V36`), `groupe_entrainement_espace` (`V37`).
- `PlanningService` : grille des soirées ; `PlanningService.definirCases` : consigne sur plusieurs cases.
- `affectation_groupe` (`V27`), `affectation_groupe_ligne` (`V38`), `espace_id`, `profondeur_limitee` : écarts d'un groupe.
- `affectation_encadrant` (`V42`) : écart d'un encadrant.
- `soiree_planning` (`V41`) : `responsable_id` (DP fosse), `dp_piscine_id`.
- `disponibilite_encadrant` (`V28`), `saisi_par_id` : présences des encadrants.
- `CaseVue.espaces`, `CaseVue.encadrants`, `affecteCeSoir`, `PlanningVue.mesGroupeIds` : vues de la grille.
- `FiltreGroupeComponent` : filtre par groupe d'entraînement.
- Écrans : `/admin/planning` (grille, admin), `/admin/groupes-entrainement` (groupes), `/planning` (lecture encadrants).
- Endpoint : `PUT /api/planning/saison/{id}/cases`.
- Démos : `V104`, `V107`, `V111`.
- Suite possible : rappel aux encadrants qui n'ont pas répondu.

Historique des choix : `docs/decisions/planning.md`.
