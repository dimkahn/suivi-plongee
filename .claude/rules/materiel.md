---
paths:
  - "backend/src/main/java/fr/club/plongee/materiel/**"
  - "frontend/src/app/features/materiel/**"
  - "frontend/src/app/features/admin/sorties.component.ts"
  - "frontend/src/app/core/reduire-photo.ts"
---

# Matériel, prêts, sorties

**Matériel et prêts : le domaine du directeur technique (2026).** Rôle
`DIRECTEUR_TECHNIQUE` (V29), cumulé avec MONITEUR, donné par un ADMIN dans
l'écran Moniteurs ; `/api/materiel/**` est ouvert au DT et à l'ADMIN (qui le
supplée). Paquet `fr.club.plongee.materiel`, écrans `/materiel` (inventaire),
`/materiel/:id` (fiche, imprimable) et `/materiel/prets`. Un seul
`Equipement` pour les quatre types (bloc, détendeur, gilet, combinaison),
colonnes propres à un type nulles pour les autres, comme `bloc_competence`.
Cadre retenu : détendeurs, gilets et combinaisons prêtés sont traités
comme des **EPI d'occasion** (position FFESSM 2018) ; la fiche de gestion
(Code du sport A322-177, contenu fixé par l'annexe III-27, conservée trois
ans après rebut) = les champs de `equipement` + le journal
`intervention_equipement`, **en ajout seul** comme `evaluation`. A322-81 :
un détendeur est désinfecté à chaque changement d'utilisateur — le serveur
refuse le prêt sans cette confirmation et l'inscrit au journal. Blocs :
arrêté du 20 novembre 2017, inspection TIV ≤ 12 mois, requalification 6
ans sous régime TIV, 2 ans sinon (`regime_tiv` par bloc). **Échéances
calculées par le serveur** (`EcheancesEquipement`) ; bloquent un prêt :
rebut, hors service, dernier contrôle non conforme, date de rebut prévue
atteinte, TIV ou requalification d'un bloc dépassée ou inconnue **jusqu'au
retour prévu**. Une révision fabricant en retard n'est qu'un avertissement
(échéance de notice, pas de texte). Un prêt garde `emprunteur_nom` : la
suppression d'un élève retire le lien, pas la trace du matériel. Pas de
mode hors ligne pour le matériel. **Photos avant/après prêt** (V30,
`photo_pret`, `PhotoPretService`) : table séparée comme `photo_eleve`,
rattachée au prêt et éventuellement à un équipement ; « avant » tant que
le prêt est en cours, « après » même rendu, suppression seulement tant
qu'il est en cours (ensuite elles font foi), 12 par moment, JPEG/PNG
vérifiés par leur signature. Le téléphone réduit la photo avant l'envoi
(`core/reduire-photo.ts`, 1600 px). On photographie le matériel, pas les
personnes : pas de consentement à l'image en jeu, l'écran le rappelle.
**Sorties** (V31, `Sortie`, `/admin/sorties`, `SortieService`) : nom,
lieu, dates, et les séances choisies explicitement parmi celles de ses
dates ; une séance appartient au plus à une sortie (contrainte en base).
Gérées par un ADMIN ou le DT (l'écran est dans l'administration mais
ouvert au DT, `gardeSorties`), consultées par les moniteurs. Les prêts
se rattachent à la sortie (`pret.sortie_id`, V31 a retiré
`pret.seance_id`) ; retour prévu par défaut = dernier jour de la sortie.
L'écran peut créer les plongées d'une sortie via `POST /api/seances/serie`
(ouvert aux MONITEUR ; un DT est toujours moniteur). Une sortie qui porte
des prêts ne se supprime plus.
**Reprise du classeur Excel** (« Historique Blocs », bouton « Importer le
classeur Excel » de `/materiel`, `ImportMaterielService`, `POST
/api/materiel/import`) : colonnes retrouvées par leur titre ; blocs
`B-NN` (numéro du classeur), gilets `G-` + le n° de la feuille « Stabs ».
Requalifications et visites TIV (une colonne par année) entrent au journal
comme « conforme » ; une requalification postérieure à « Dernière
Requalif » ou à aujourd'hui est une prévision, ignorée. « VENDU »/« REFORME »
= mise au rebut (date lue dans le commentaire, sinon 1er janvier de
l'année). Référence déjà présente = laissée telle quelle (réimport sans
doublon). V33 a ajouté `proprietaire` (null = le club, sigle `CPPJVO`
ignoré à l'import), `constructeur`, `ancienne_reference`, `numero_robinet`.
Le fichier du club n'est pas dans le dépôt : le test fabrique le sien.
**Export au même format** (bouton « Exporter le classeur Excel », `GET
/api/materiel/export.xlsx`, `ExportMaterielService`) : feuilles « Blocs »
et « Stabs » aux titres que lit l'import, réimportable sans perte (test
d'aller-retour dans `ImportMaterielTest`). Seuls blocs et gilets y
figurent ; seules les visites/requalifications conformes vont dans les
colonnes par année (une colonne « Visite 2024 (2) » si deux la même
année), les non conformes et le hors service dans « Commentaires ». Rebut :
« VENDU »/« REFORME » dans une colonne « Sortie », la date en tête du
commentaire ; l'import relit aussi ce rebut pour les gilets.
**Fiche d'inspection TIV** (V34, `InspectionTiv`, `InspectionTivService`,
écrans `/materiel/:id/tiv` (saisie) et `/materiel/tiv/:id` (compte rendu
imprimable)) : l'onglet « FICHE D'EVALUATION ET DE SUIVI » du classeur,
complété d'après le manuel de formation TIV de la FFESSM (UC8.2 : contenu
du compte rendu ; UC11 service oxygène, UC12 aluminium). Les questions
sont l'enum `PointInspectionTiv` (oui/non, réponse normale, décision
proposée, défaut qui interdit l'avis favorable), pas une table : les
questions aluminium et oxygène ne sont posées qu'aux blocs concernés.
Une fiche = une ligne INSPECTION_VISUELLE du journal (conforme si avis
favorable, non conforme sinon, ce qui bloque les prêts) + `inspection_tiv`
et `constat_tiv`, en ajout seul ; le rebut met aussi le bloc au rebut.
Le serveur exige une réponse à chaque question et une observation pour un
avis défavorable ou un rebut. Le n° de TIV est repris de la dernière fiche
saisie par le même compte (pas de colonne sur `utilisateur`). La saisie
rapide « Inspection visuelle » du journal reste possible (reprise
d'historique). Pas d'envoi au dispositif fédéral en ligne.
**Rôle `TIV`** (V35, cumulé avec MONITEUR, donné par un ADMIN dans l'écran
Moniteurs ; démo : `e2@club.fr`, V109) : remplit les fiches d'inspection
et consulte l'inventaire et les fiches (`MaterielController.LECTURE_ET_INSPECTION`
sur ces seules méthodes, le reste du contrôleur reste DT/ADMIN). Il voit
qu'un équipement est prêté, pas à qui, et pas l'historique des prêts
(emprunteurs mineurs). Côté écrans : `AuthService.inspecteBlocs`,
`gardeInspectionBlocs` ; boutons de gestion masqués si `!gereMateriel`.
**Étiquettes QR code** (`QrCodeMaterielService`, ZXing, écrans
`/materiel/etiquettes?ids=…` (planche imprimable, depuis les cases à
cocher de l'inventaire — le choix survit aux changements de filtre — ou
depuis la fiche) et `/materiel/scanner`) : le QR code porte l'adresse
de la fiche, `origine` + `/materiel/{id}` (id et non référence, pour
corriger une référence sans réimprimer ; `origine` = adresse vue par le
navigateur, contrôlée par le serveur). L'appareil photo de n'importe quel
téléphone l'ouvre donc directement. Le scanner lit en direct avec
`BarcodeDetector` (Chrome Android) ; sinon (iPhone) une photo de
l'étiquette est lue par le serveur (`POST /api/materiel/qr-code/photo`).
Un QR code qui ne porte qu'une référence (« B-12 ») est reconnu aussi.
Ouvert au TIV comme l'inventaire.
Suites possibles : masques et tubas
(A322-81 cite les tubas), rappel des échéances par e-mail, export PDF de
la fiche de gestion.
