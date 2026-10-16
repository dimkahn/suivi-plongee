# Historique des décisions : planning du bassin et groupes d'entraînement

Ce fichier est l'historique. Les règles en vigueur sont dans `.claude/rules/planning.md`.

## Remplacer le tableur « Planning » du lundi soir (lot 1, 2026, V26)
- **Contexte :** le club tenait un tableur « Planning » : groupes × dates, chaque case = une ligne d'eau, « F10 » pour la fosse 10 m, « F6 » pour la fosse limitée à 6 m.
- **Décision :** paquet `fr.club.plongee.planning`, avec `EspaceBassin` (lignes 1 à 6 + fosse 10 m, installées par V26) et `GroupeEntrainement` par saison.
- **Conséquences :** le « F6 » devient une affectation en fosse avec `profondeur_limitee`.

## Référents de groupe à la place du moniteur référent du cursus (2026, V36)
- **Contexte :** chaque cursus avait son propre « moniteur référent » (`cursus.moniteur_referent_id`).
- **Décision :** choix du club, le suivi d'un élève passe par les référents de son groupe d'entraînement (`groupe_entrainement_referent`). V36 a supprimé `cursus.moniteur_referent_id`.
- **Conséquences :** un référent est toujours aussi encadrant attitré, pour que le planning ne lise qu'une liste.

## Plusieurs lignes attitrées par groupe (V37, V111)
- **Contexte :** un groupe n'avait qu'une ligne attitrée (`groupe_entrainement.espace_attitre_id`) ; un groupe nombreux occupe pourtant par exemple les lignes 5 et 6.
- **Décision :** V37 crée `groupe_entrainement_espace`.
- **Conséquences :** l'ancienne colonne reste en base, inutilisée, parce que les démos V104/V107 l'écrivent ; V111 la recopie dans la nouvelle table.

## Grille des soirées et stockage des seuls écarts (lot 2, V27, V38)
- **Décision :** `/admin/planning`, `PlanningService`. `affectation_groupe` (V27) ne stocke que les écarts à la ligne attitrée. Seules les dates avec une séance en milieu artificiel sont des soirées (choix du club, 2026).
- **Conséquences :** changer la ligne attitrée suit sur toutes les dates non retouchées. V38 permet un écart sur plusieurs lignes (`espace_id` garde la première, `affectation_groupe_ligne` les autres).

## DP fosse et DP piscine à la place du responsable de séance (2026, V41)
- **Contexte :** `soiree_planning` portait un « responsable de séance », dans la colonne `responsable_id`, écrite par la démo V107.
- **Décision :** choix du club, deux DP par soirée. Le DP fosse reste dans `responsable_id` ; `dp_piscine_id` est nouvelle.
- **Conséquences :** les responsables déjà saisis ont été repris comme DP fosse. Ces DP sont distincts du DP de la fiche de sécurité ; `seance.dp_id` est resté inutilisé.

## Présences des encadrants (lot 3, V28)
- **Décision :** `disponibilite_encadrant`, une réponse PRESENT/ABSENT par encadrant et par soirée, sans file hors ligne. De nouveaux avertissements s'y ajoutent (encadrants tous absents, DP absent, aucun E3 présent).
- **Écarté pour l'instant :** le rappel aux encadrants qui n'ont pas répondu reste une suite possible.

## Encadrant dans un autre groupe un soir (V42)
- **Décision :** `affectation_encadrant`, seul l'écart est stocké, comme pour les groupes.
- **Conséquences :** les avertissements lisent désormais les encadrants du soir (`CaseVue.encadrants`) et non plus les seuls attitrés ; l'encadrant accède au programme du groupe d'accueil ce jour-là.

## Filtres par groupe d'entraînement
- **Contexte :** les pages Infos élèves, Présences et Trombinoscope filtraient par niveau PN1/PN2/PN3.
- **Décision :** elles filtrent par groupe d'entraînement de la saison ouverte (`FiltreGroupeComponent`) ; l'onglet Moniteurs du trombinoscope, par encadrants attitrés.

## Consigne sur plusieurs cases d'un coup (2026)
- **Décision :** sélection de plusieurs cases (glisser à la souris, appui long au téléphone) et `PUT /api/planning/saison/{id}/cases`, en tout ou rien.
