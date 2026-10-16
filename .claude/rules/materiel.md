---
paths:
  - "backend/src/main/java/fr/club/plongee/materiel/**"
  - "frontend/src/app/features/materiel/**"
  - "frontend/src/app/features/admin/sorties.component.ts"
  - "frontend/src/app/core/reduire-photo.ts"
---

# Matériel, prêts, sorties

## Règles

### Droits
- **Le matériel est le domaine du directeur technique** : rôle `DIRECTEUR_TECHNIQUE` (V29), cumulé avec MONITEUR, donné par un ADMIN dans l'écran Moniteurs. `/api/materiel/**` est ouvert au DT et à l'ADMIN, qui le supplée.
- **Le rôle `TIV` remplit les fiches d'inspection et consulte l'inventaire et les fiches, rien d'autre** : rôle V35, cumulé avec MONITEUR, donné par un ADMIN dans l'écran Moniteurs. `MaterielController.LECTURE_ET_INSPECTION` sur ces seules méthodes ; le reste du contrôleur reste DT/ADMIN. Étiquettes QR code et scanner lui sont ouverts comme l'inventaire.
- **Le TIV voit qu'un équipement est prêté, pas à qui, et pas l'historique des prêts.** *Pourquoi :* les emprunteurs peuvent être mineurs.
- **Côté écrans** : `AuthService.inspecteBlocs`, `gardeInspectionBlocs` ; boutons de gestion masqués si `!gereMateriel`. Ces gardes ne sont que du confort, le serveur décide.

### Équipements et fiche de gestion
- **Un seul `Equipement` pour les quatre types** (bloc, détendeur, gilet, combinaison) : les colonnes propres à un type sont nulles pour les autres, comme `bloc_competence`.
- **Détendeurs, gilets et combinaisons prêtés sont des EPI d'occasion** (position FFESSM 2018).
- **La fiche de gestion = les champs de `equipement` + le journal `intervention_equipement`, en ajout seul** comme `evaluation` : jamais d'UPDATE ni de DELETE sur le journal. *Pourquoi :* Code du sport A322-177, contenu fixé par l'annexe III-27, conservée trois ans après rebut.
- **Un détendeur est désinfecté à chaque changement d'utilisateur** : le serveur refuse le prêt sans cette confirmation et l'inscrit au journal. *Pourquoi :* A322-81.
- **Blocs** : inspection TIV ≤ 12 mois ; requalification tous les 6 ans sous régime TIV, 2 ans sinon (`regime_tiv` par bloc). *Pourquoi :* arrêté du 20 novembre 2017.
- **Les échéances sont calculées par le serveur** (`EcheancesEquipement`). Bloquent un prêt : rebut, hors service, dernier contrôle non conforme, date de rebut prévue atteinte, TIV ou requalification d'un bloc dépassée ou inconnue **jusqu'au retour prévu**.
- **Une révision fabricant en retard n'est qu'un avertissement.** *Pourquoi :* échéance de notice, pas de texte.
- **Un prêt garde `emprunteur_nom`** : supprimer un élève retire le lien, pas la trace du matériel.
- **Pas de mode hors ligne pour le matériel.**

### Photos avant/après prêt
- **Table séparée `photo_pret`** (V30, `PhotoPretService`), comme `photo_eleve` ; rattachée au prêt et éventuellement à un équipement.
- **« Avant » tant que le prêt est en cours, « après » même rendu.** Suppression seulement tant que le prêt est en cours. *Pourquoi :* ensuite elles font foi.
- **12 photos par moment au plus, JPEG/PNG vérifiés par leur signature.**
- **Le téléphone réduit la photo avant l'envoi** : `core/reduire-photo.ts`, 1600 px.
- **On photographie le matériel, pas les personnes** : pas de consentement à l'image en jeu ; l'écran le rappelle.

### Sorties
- **Une sortie** (`Sortie`, V31, `SortieService`, écran `/admin/sorties`) : nom, lieu, dates, et des séances choisies explicitement parmi celles de ses dates.
- **Une séance appartient au plus à une sortie** : contrainte en base.
- **Gérées par un ADMIN ou le DT, consultées par les moniteurs** : l'écran est dans l'administration mais ouvert au DT (`gardeSorties`).
- **Les prêts se rattachent à la sortie** (`pret.sortie_id`, plus de `pret.seance_id`, retiré par V31) ; retour prévu par défaut = dernier jour de la sortie.
- **L'écran peut créer les plongées d'une sortie** via `POST /api/seances/serie`, ouvert aux MONITEUR (un DT est toujours moniteur).
- **Une sortie qui porte des prêts ne se supprime pas.**

### Import du classeur Excel (« Historique Blocs »)
- **Colonnes retrouvées par leur titre.** Blocs `B-NN` (numéro du classeur), gilets `G-` + le n° de la feuille « Stabs ».
- **Requalifications et visites TIV** (une colonne par année) entrent au journal comme « conforme ». Une requalification postérieure à « Dernière Requalif » ou à aujourd'hui est une prévision : ignorée.
- **« VENDU »/« REFORME » = mise au rebut** : date lue dans le commentaire, sinon 1er janvier de l'année. Vaut aussi pour les gilets.
- **Référence déjà présente = laissée telle quelle** : réimport sans doublon.
- **`proprietaire` null = le club** ; le sigle `CPPJVO` est ignoré à l'import.
- **Le fichier du club n'est pas dans le dépôt** : le test fabrique le sien.

### Export Excel
- **Même format que l'import, réimportable sans perte** : feuilles « Blocs » et « Stabs » aux titres que lit l'import ; test d'aller-retour dans `ImportMaterielTest`.
- **Seuls blocs et gilets y figurent.**
- **Seules les visites/requalifications conformes vont dans les colonnes par année** (« Visite 2024 (2) » si deux la même année) ; les non conformes et le hors service vont dans « Commentaires ».
- **Rebut** : « VENDU »/« REFORME » dans une colonne « Sortie », la date en tête du commentaire.

### Fiche d'inspection TIV
- **Reprend l'onglet « FICHE D'EVALUATION ET DE SUIVI » du classeur**, complété d'après le manuel de formation TIV de la FFESSM (UC8.2 : contenu du compte rendu ; UC11 service oxygène ; UC12 aluminium).
- **Les questions sont l'enum `PointInspectionTiv`, pas une table** : oui/non, réponse normale, décision proposée, défaut qui interdit l'avis favorable. Les questions aluminium et oxygène ne sont posées qu'aux blocs concernés.
- **Une fiche = une ligne INSPECTION_VISUELLE du journal + `inspection_tiv` et `constat_tiv`, en ajout seul.** Conforme si avis favorable, non conforme sinon (ce qui bloque les prêts). Un rebut met aussi le bloc au rebut.
- **Le serveur exige une réponse à chaque question**, et une observation pour un avis défavorable ou un rebut.
- **Le n° de TIV est repris de la dernière fiche saisie par le même compte** : pas de colonne sur `utilisateur`.
- **La saisie rapide « Inspection visuelle » du journal reste possible** (reprise d'historique).
- **Pas d'envoi au dispositif fédéral en ligne.**

### Étiquettes QR code
- **Le QR code porte l'adresse de la fiche** : `origine` + `/materiel/{id}`. *Pourquoi :* l'id et non la référence, pour corriger une référence sans réimprimer ; l'appareil photo de n'importe quel téléphone ouvre la fiche directement.
- **`origine` = adresse vue par le navigateur, contrôlée par le serveur.**
- **Planche imprimable** depuis les cases à cocher de l'inventaire (le choix survit aux changements de filtre) ou depuis la fiche.
- **Scanner** : lecture en direct avec `BarcodeDetector` (Chrome Android) ; sinon (iPhone) une photo de l'étiquette est lue par le serveur.
- **Un QR code qui ne porte qu'une référence (« B-12 ») est reconnu aussi.**

## À ne pas faire
- Pas d'UPDATE ni de DELETE sur `intervention_equipement`, `inspection_tiv`, `constat_tiv`.
- Ne pas accepter un prêt de détendeur sans confirmation de désinfection.
- Ne pas montrer l'emprunteur ni l'historique des prêts au rôle TIV.
- Ne pas calculer les échéances bloquantes côté écran : c'est le serveur.
- Ne pas supprimer une photo de prêt après la fin du prêt.
- Ne pas ajouter de colonne n° de TIV sur `utilisateur`.
- Ne pas encoder la référence dans un QR code neuf : l'id.
- Ne pas ajouter de mode hors ligne au matériel.

## Repères
- Paquet `fr.club.plongee.materiel`.
- Écrans : `/materiel` (inventaire), `/materiel/:id` (fiche, imprimable), `/materiel/prets`, `/materiel/:id/tiv` (saisie d'une inspection), `/materiel/tiv/:id` (compte rendu imprimable), `/materiel/etiquettes?ids=…` (planche d'étiquettes), `/materiel/scanner`, `/admin/sorties`.
- Tables et colonnes : `equipement`, `intervention_equipement` (journal), `regime_tiv`, `emprunteur_nom`, `photo_pret`, `pret.sortie_id`, `inspection_tiv`, `constat_tiv` ; V33 : `proprietaire`, `constructeur`, `ancienne_reference`, `numero_robinet`.
- Migrations : V29 (rôle DT), V30 (photos de prêt), V31 (sorties), V33 (colonnes de l'import), V34 (inspection TIV), V35 (rôle TIV).
- Services : `EcheancesEquipement` (échéances), `PhotoPretService`, `SortieService`, `ImportMaterielService` (import), `ExportMaterielService` (export), `InspectionTiv` / `InspectionTivService`, `QrCodeMaterielService` (ZXing).
- Endpoints : `/api/materiel/**`, `POST /api/materiel/import` (bouton « Importer le classeur Excel » de `/materiel`), `GET /api/materiel/export.xlsx` (bouton « Exporter le classeur Excel »), `POST /api/materiel/qr-code/photo` (lecture d'une photo d'étiquette), `POST /api/seances/serie`.
- Front : `core/reduire-photo.ts`, `gardeSorties`, `gardeInspectionBlocs`, `AuthService.inspecteBlocs`.
- Démo : `e2@club.fr` a le rôle TIV (V109).
- Suites possibles : masques et tubas (A322-81 cite les tubas), rappel des échéances par e-mail, export PDF de la fiche de gestion.

Historique des choix : `docs/decisions/materiel.md`.
