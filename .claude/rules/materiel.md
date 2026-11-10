---
paths:
  - "backend/src/main/java/fr/club/plongee/materiel/**"
  - "frontend/src/app/features/materiel/**"
  - "frontend/src/app/features/admin/sorties.component.ts"
  - "frontend/src/app/core/reduire-photo.ts"
---

# Matériel, prêts, sorties

Paquet `fr.club.plongee.materiel`. Écrans : `/materiel` (inventaire), `/materiel/:id` (fiche, imprimable), `/materiel/prets`, `/materiel/:id/tiv` (saisie d'inspection), `/materiel/tiv/:id` (compte rendu imprimable), `/materiel/etiquettes?ids=…`, `/materiel/scanner`.

## Droits
- **Domaine du directeur technique** : rôle `DIRECTEUR_TECHNIQUE` (V29), cumulé avec MONITEUR, donné par un ADMIN (écran Moniteurs). `/api/materiel/**` ouvert au DT et à l'ADMIN, qui le supplée.
- **DT non moniteur** (choix du club, 2026-11-10) : rôle `DIRECTEUR_TECHNIQUE` seul, créé par un ADMIN dans `/admin/directeurs-techniques` (`AdminComptesMaterielController`, `/api/admin/comptes-materiel`), absent des listes de moniteurs et d'emprunteurs. Matériel, prêts, sorties ; rien qui demande MONITEUR. **Pas encadrant des séjours ni des groupes de plongeurs** (`UtilisateurPrincipal.estEncadrant()` = MONITEUR ou ADMIN) : la sortie qu'il crée n'a pas de créateur de séjour. Suppression comme pour un moniteur : refusée (422) dès qu'il a une ligne au journal du matériel (inspections TIV comprises), un prêt fait, reçu ou emprunté, une photo de prêt ou un prêt de séjour déclaré ; sinon on désactive. Écran : `AuthService.directeurTechniqueSeul` (menu Matériel, Prêts, Scanner, Sorties ; accueil `/materiel`). Il lit les séances de la saison avec leur commentaire (`GET /api/seances`, pour rattacher les plongées à une sortie) : le commentaire d'une séance sert à l'organisation, jamais à parler d'un élève (*choix du club, 2026-11-10*). Démo `materiel@club.fr` (V136). Test : `ComptesMaterielTest`.
- **Rôle `TIV`** (V35, cumulé avec MONITEUR, donné par un ADMIN) : remplit les fiches d'inspection, consulte inventaire et fiches, rien d'autre. `MaterielController.LECTURE_ET_INSPECTION` sur ces seules méthodes ; le reste DT/ADMIN. Étiquettes QR et scanner lui sont ouverts comme l'inventaire.
- **Le TIV voit qu'un équipement est prêté, pas à qui, ni l'historique des prêts.** *Pourquoi :* emprunteurs parfois mineurs.
- Écrans : `AuthService.inspecteBlocs`, `gardeInspectionBlocs`, boutons masqués si `!gereMateriel` ; confort seulement, le serveur décide.
- Démo : `e2@club.fr` a le rôle TIV (V109).

## Équipements et fiche de gestion
- Un seul `Equipement` pour bloc, détendeur, gilet, combinaison : colonnes propres à un type nulles pour les autres, comme `bloc_competence`.
- Détendeurs, gilets, combinaisons prêtés = EPI d'occasion (position FFESSM 2018).
- **Fiche de gestion = champs de `equipement` + journal `intervention_equipement` en ajout seul** (jamais d'UPDATE/DELETE), comme `evaluation`. *Pourquoi :* Code du sport A322-177, contenu de l'annexe III-27, conservée trois ans après rebut.
- **Détendeur désinfecté à chaque changement d'utilisateur** : prêt refusé sans cette confirmation, inscrite au journal. *Pourquoi :* A322-81. Exception : déclaré depuis un séjour par son emprunteur, voir « Prêts déclarés depuis un séjour ».
- **L'ancien numéro suit le matériel partout** : « B-12 (ancien n° 12) » (`core/nom-equipement.ts`, `Equipement.designation()`), trouvé par chaque recherche. Au scanner, la référence actuelle prime ; un ancien numéro porté par plusieurs équipements est refusé en les citant.
- Blocs : inspection TIV ≤ 12 mois ; requalification 6 ans sous régime TIV, 2 ans sinon (`regime_tiv` par bloc). *Pourquoi :* arrêté du 20 novembre 2017.
- **Échéances calculées par le serveur** (`EcheancesEquipement`). Bloquent un prêt : rebut, hors service, dernier contrôle non conforme, date de rebut prévue atteinte, TIV ou requalification d'un bloc dépassée ou inconnue **jusqu'au retour prévu**.
- Révision fabricant en retard = simple avertissement. *Pourquoi :* échéance de notice, pas de texte.
- Un prêt garde `emprunteur_nom` : supprimer un élève retire le lien, pas la trace.
- Pas de mode hors ligne.

## Prêts déclarés depuis un séjour
- Chacun déclare son emprunt dans le séjour ou par le lien (`PretsSejourService`, `sejour.md`) : un vrai prêt (`PretService.declarer`), rattaché à la sortie, mêmes contrôles ; `sejour_pret` (V84) garde le participant et qui a déclaré.
- Détendeur déclaré par l'emprunteur : `desinfection_au_retour` (V99_6), rien au journal à la remise ; au retour, celui qui reçoit le matériel coche la désinfection, inscrite à cette date (422 sinon). Déclaré par un organisateur ou un moniteur pour un autre : attestée à la remise. *Choix du club, 2026-10-23.*

## Photos avant/après prêt
- Table séparée `photo_pret` (V30, `PhotoPretService`), comme `photo_eleve` ; rattachée au prêt, éventuellement à un équipement.
- « Avant » tant que le prêt est en cours, « après » même rendu. **Suppression seulement tant que le prêt est en cours.** *Pourquoi :* ensuite elles font foi.
- 12 photos max par moment, JPEG/PNG vérifiés par signature.
- Réduite par le téléphone avant envoi (`core/reduire-photo.ts`, 1600 px).
- On photographie le matériel, pas les personnes : pas de consentement à l'image ; l'écran le rappelle.

## Sorties
- `Sortie` (V31, `SortieService`, `/admin/sorties`) : nom, lieu, dates, séances choisies explicitement parmi celles de ses dates.
- Une séance appartient au plus à une sortie (contrainte en base).
- Gérées par ADMIN ou DT, consultées par les moniteurs ; écran dans l'administration mais ouvert au DT (`gardeSorties`).
- Prêts rattachés à la sortie (`pret.sortie_id` ; `pret.seance_id` retiré par V31) ; retour prévu par défaut = dernier jour de la sortie.
- L'écran peut créer les plongées d'une sortie via `POST /api/seances/serie`, ouvert aux MONITEUR ; un DT non moniteur ne fait que rattacher les plongées existantes (ni « Gérer le séjour », ni impression des fiches).
- Une sortie qui porte des prêts ne se supprime pas.

## Import du classeur Excel « Historique Blocs »
`ImportMaterielService`, `POST /api/materiel/import` (bouton « Importer le classeur Excel » de `/materiel`) ; V33 : `proprietaire`, `constructeur`, `ancienne_reference`, `numero_robinet`.
- Colonnes retrouvées par leur titre. Blocs `B-NN` (n° du classeur), gilets `G-` + n° de la feuille « Stabs ».
- Requalifications et visites TIV (une colonne par année) entrent au journal comme « conforme » ; une requalification postérieure à « Dernière Requalif » ou à aujourd'hui est une prévision, ignorée.
- « VENDU »/« REFORME » = rebut (gilets aussi), date lue dans le commentaire, sinon 1er janvier de l'année.
- Référence déjà présente laissée telle quelle : réimport sans doublon.
- `proprietaire` null = le club ; le sigle `CPPJVO` est ignoré.
- Le fichier du club n'est pas dans le dépôt : le test fabrique le sien.

## Export Excel
`ExportMaterielService`, `GET /api/materiel/export.xlsx` (bouton « Exporter le classeur Excel »).
- **Même format que l'import, réimportable sans perte** : feuilles « Blocs » et « Stabs » aux titres lus par l'import ; test d'aller-retour dans `ImportMaterielTest`.
- Seuls blocs et gilets.
- Colonnes par année : seulement visites/requalifications conformes (« Visite 2024 (2) » si deux la même année) ; non conformes et hors service dans « Commentaires ».
- Rebut : « VENDU »/« REFORME » dans une colonne « Sortie », date en tête du commentaire.

## Fiche d'inspection TIV
V34, `InspectionTiv` / `InspectionTivService`.
- Reprend l'onglet « FICHE D'EVALUATION ET DE SUIVI » du classeur, complété d'après le manuel TIV FFESSM (UC8.2 compte rendu ; UC11 service oxygène ; UC12 aluminium).
- **Questions = enum `PointInspectionTiv`, pas une table** : oui/non, réponse normale, décision proposée, défaut qui interdit l'avis favorable. Questions aluminium et oxygène posées aux seuls blocs concernés.
- **Une fiche = une ligne INSPECTION_VISUELLE du journal + `inspection_tiv` et `constat_tiv`, en ajout seul.** Conforme si avis favorable, non conforme sinon (bloque les prêts) ; un rebut met aussi le bloc au rebut.
- Le serveur exige une réponse à chaque question, et une observation pour un avis défavorable ou un rebut.
- **N° de TIV repris de la dernière fiche saisie par le même compte, pas de colonne sur `utilisateur`.**
- La saisie rapide « Inspection visuelle » du journal reste possible (reprise d'historique).
- Pas d'envoi au dispositif fédéral en ligne.

## Étiquettes QR code
`QrCodeMaterielService` (ZXing).
- **Le QR code porte `origine` + `/materiel/{id}`** : l'id, pas la référence, pour corriger une référence sans réimprimer ; n'importe quel appareil photo ouvre la fiche.
- `origine` = adresse vue par le navigateur, contrôlée par le serveur.
- Planche imprimable depuis les cases de l'inventaire (choix gardé aux changements de filtre) ou depuis la fiche.
- Scanner : `BarcodeDetector` en direct (Chrome Android) ; sinon (iPhone) photo de l'étiquette lue par le serveur (`POST /api/materiel/qr-code/photo`).
- Un QR code qui ne porte qu'une référence (« B-12 ») est reconnu aussi.
- **Tags NFC** (`core/tag-nfc.ts`) : la fiche les programme (Web NFC, Chrome Android) avec **la même adresse que le QR code** ; aucune colonne en base, pas d'UID enregistré. Case « Verrouiller le tag (définitif) » cochée par défaut (`makeReadOnly`, `programmerTag`) : l'adresse n'a jamais à changer, et un tag verrouillé ne peut plus être effacé ni détourné ; un verrou raté est signalé, le tag reste utilisable. Le scanner les lit et passe par `POST /api/materiel/qr-code`. iPhone : lecture native du tag, sans l'appli. *Choix 2026-11-10.*
- **Retour depuis la fiche** (DT/ADMIN, fenêtre `RetourPretComponent` partagée avec `/materiel/prets`) : le prêt se rend en entier, puis « Scanner le matériel suivant ».

## Suites possibles
Masques et tubas (A322-81 cite les tubas), rappel des échéances par e-mail, export PDF de la fiche de gestion.

Historique des choix : `docs/decisions/materiel.md`.
