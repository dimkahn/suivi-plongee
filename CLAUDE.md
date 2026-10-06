# Contexte du projet

Application de suivi des compétences de plongée pour un club FFESSM. Des
moniteurs bénévoles notent leurs élèves séance par séance, souvent depuis un
téléphone au bord du bassin. Remplace un classeur Google Sheets avec un onglet
par élève.

Backend Java 25 / Spring Boot 4.1 (Maven), frontend Angular 22 standalone,
PostgreSQL en production, H2 en développement. Migrations Flyway. Un
`pom.xml` agrégateur à la racine permet `mvn install` depuis la racine
(le module `frontend` enveloppe `npm ci && ng build` via
frontend-maven-plugin) ; le déploiement reste deux services Docker séparés
(`docker-compose.yml`).

Le code, les commentaires, les noms de classes et les messages d'erreur sont
**en français**. C'est délibéré : les utilisateurs et les futurs contributeurs
sont des moniteurs de club, pas des développeurs professionnels. Garder cette
convention, y compris pour les nouveaux fichiers.

## Commandes

```bash
cd backend && mvn spring-boot:run     # profil dev, H2 + données de démo
cd backend && mvn test                # tests d'intégration
cd frontend && npm install && npm start
```

Pour lancer les deux en une seule commande depuis la racine (un seul
terminal ; le frontend est détaché en arrière-plan, son log est dans
`frontend/frontend-dev.log`) :

```bash
mvn -N -Pdev antrun:run@dev          # démarre frontend + backend
mvn -N -Pdev antrun:run@dev-stop     # arrête le frontend resté en tâche de fond
```

Mise en production : un tag `v…` sur un commit de `master` est vu par
`outils/surveiller-tags.sh` (cron toutes les 5 minutes sur le serveur), qui
construit les images sur place, sauvegarde la base, redémarre la prod et
revient en arrière tout seul si le backend ne répond pas. Le même tag
déclenche `.github/workflows/deploiement.yml`, qui ne fait plus que les
tests et les images ghcr.io (plus d'étape SSH). Voir `DEPLOIEMENT.md`,
« Déploiement automatique ».

Vidéos d'aide : `outils/videos/tourner.sh` (Playwright, données de démo,
backend `dev` neuf ; voix off des sous-titres par Piper, montée par
`monter.mjs` avec ffmpeg) puis `outils/videos/publier.sh`. Page publique `/videos`
(`VideosComponent`, sans connexion) ; les fichiers ne sont ni dans le dépôt
ni dans les images, Caddy les sert sous `/medias/videos/` depuis le dossier
`VIDEOS` du `.env`. Voir `outils/videos/LISEZ-MOI.md`.
`outils/videos/surveiller-scenarios.sh` (cron toutes les 5 minutes, clone
dans `~/suivi-plongee-videos/`) tourne et publie seul les scénarios nouveaux
ou modifiés de la version en ligne.

Aide et manuels : page publique `/aide` (`AideComponent`, sans connexion),
des questions fréquentes qui renvoient chacune au manuel d'utilisation
d'une fonctionnalité et à ses vidéos. Un manuel = un fichier Markdown de
`frontend/src/app/features/aide/manuels/` (en-tête : titre, rubrique,
codes des vidéos, écran, mots-clés, questions ; format dans le
`LISEZ-MOI.md` du dossier), listé dans `manuels/index.ts` et embarqué dans
l'appli (loader `.md` en texte, `angular.json`) : la recherche tourne dans
le navigateur, sans serveur ni réseau, seules les vidéos viennent du
catalogue publié. Changer un écran = mettre à jour son manuel au même
commit ; un nouveau scénario de vidéo = le citer dans un manuel.

Le frontend proxifie `/api` vers `localhost:8080` et `/medias/videos` vers
`outils/videos/apercu.mjs` (port 4300) (`proxy.conf.json`).
Comptes de démonstration dans le README, mot de passe `plongee2026`.

## Décisions structurantes — ne pas défaire sans raison

**Le référentiel MFT est en base, pas en dur.** Un `Referentiel` = un niveau +
une version datée du MFT ; un `Cursus` y est figé à l'inscription (la copie
des valeurs utilisées par `EvaluationService`/`RegleDelivranceService` reste
celle du moment de l'inscription, portée par le cursus lui-même). Le contenu
initial de chaque révision fédérale a été importé via
`outils/generer_referentiel.py` (un tuple par bloc dans la liste
`REFERENTIELS`, un `INSERT` par version dans une migration Flyway dédiée) ;
ce script reste la référence pour importer une **nouvelle** révision publiée
par la fédération, avec une migration Flyway dédiée. **Choix révisé (2026) :**
l'écran `/admin/referentiel` permet désormais d'éditer un référentiel, ses
blocs et ses critères directement en base (`ReferentielController`,
`hasRole('ADMIN')`), y compris ceux déjà utilisés par des cursus en cours —
l'ancienne garantie « une révision fédérale ne s'applique jamais
rétroactivement » n'est donc plus automatique pour ces corrections manuelles :
c'est à l'admin de ne pas modifier un référentiel figé sur des cursus en
cours si la rétroactivité n'est pas voulue. La suppression reste bloquée si
la ligne est référencée par un cursus, un critère porte une évaluation, ou un
bloc porte une validation. Ne jamais éditer le SQL déjà généré dans une
migration passée à la main : cette liberté est réservée à l'écran d'admin,
pas aux fichiers de migration. **Exception ponctuelle (2026) :** les trois
premières versions du MFT (N1 2016-11-15, N2 2015-01-02, N3 2016-01-01),
générées par une version antérieure du script et intégralement désactivées
depuis par V7/V8, ont été retirées de `V2__referentiel_mft.sql` (fichier
supprimé) et de `REFERENTIELS` — possible uniquement parce qu'aucune base
n'avait encore exécuté ces migrations. Ne plus jamais éditer une migration
déjà appliquée quelque part : passer par une nouvelle migration ou par
l'écran d'admin.
Historiquement les codes de bloc `C1` à `C9` étaient communs aux trois
niveaux (intitulés et critères différents par niveau) — **ce n'est plus
garanti** : la révision PE20 (décembre 2025) du N1 les a abandonnés au profit
de dix compétences nommées, structurées en Technique (des critères, comme
avant) / Comportement / Théorie / Modalités d'évaluation (texte libre, porté
par des colonnes nullable sur `bloc_competence` ajoutées en V7 — vide sur les
blocs des révisions antérieures). Ne pas supposer que `code` a un sens
partagé entre niveaux ou révisions : c'est un simple identifiant unique par
référentiel.

**Le N2 et le N3 se scindent maintenant en plusieurs qualifications.** Les
révisions PA20|PE40 (N2, mai 2026, V8) et PA40|PE60 (N3, décembre 2025, V8)
remplacent chacune un bloc unique de compétences par deux qualifications
(PA20 « plongeur autonome à 20 m » + PE40 « plongeur encadré à 40 m » pour le
N2 ; PA40 + PE60, plus des « compétences complémentaires N3 », pour le N3),
chacune avec ses propres blocs, plus des blocs communs. Le brevet N2/N3 n'est
délivré que quand les qualifications requises sont acquises. **Choix de
modélisation délibéré :** un seul `Referentiel` par niveau, comme avant —
pas un « niveau » à part entière par qualification, ce qui aurait touché
`Cursus`, `HabilitationService`, `RegleDelivranceService` et les écrans
d'admin. Chaque bloc porte juste une étiquette d'affichage dans la colonne
`regroupement` (« Commun », « PA20 », « PE40 », « PA40 », « PE60 », « N3 »,
ajoutée en V8) : il n'y a **aucun suivi séparé** de la progression par
qualification, tout se valide sous un même cursus N2 ou N3. Si le club a
besoin un jour de distinguer formellement « a le PA20 mais pas le PE40 »,
c'est un vrai chantier de modélisation, pas une simple mise à jour du
référentiel. PA60 (plongeur autonome à 60 m, sans DP, obtenu après le N3)
n'est pas importé : hors périmètre du brevet N3 lui-même.

**Une progression type découpe l'année par périodes de mois, pas par séance.**
`ProgressionType` (paquet `fr.club.plongee.progression`, écran
`/admin/progressions`) est rattachée à une version du référentiel, pas au
niveau, et porte des `PeriodeProgression` : une plage de mois (1-12, qui
peut enjamber le changement d'année), un milieu facultatif et les blocs
travaillés. En mois et non en dates, pour resservir d'une saison à l'autre.
Choix du club (2026) : un découpage séance par séance a été écarté comme trop
lourd à tenir. Un bloc peut figurer dans plusieurs périodes. V22 installe
une proposition par niveau (N1 PE20, N2 PA20|PE40, N3 PA40|PE60), à adapter
depuis l'écran. Une saison suit au plus une progression par référentiel
(table `progression_saison`, choix dans `/admin/saisons`, règle tenue par
`ProgressionService`) ; aucune migration ne rattache une progression à une
saison réelle (seules les démos V102 et V107 le font). Chaque séance affiche la période
qui couvre son mois (`core/progression.ts`, `ProgrammeSeanceComponent`,
liste des séances et feuille de présence ; embarqué hors ligne). Dans la
grille, les blocs de la période du mois (séance choisie, sinon aujourd'hui)
sont marqués « Au programme ». Le **retard est calculé par le serveur**
(`EcheancesProgression`, appelé par `GrilleService`) : l'échéance d'un bloc
est le dernier jour de la dernière période qui le contient, située dans
l'année de la saison ; un bloc est en retard si cette date est passée, qu'il
n'est pas validé et que ses critères ne sont pas tous acquis, pour un cursus
`EN_COURS` seulement. Conséquence : une période de fin de saison qui reprend
tous les blocs (validations en milieu naturel du N2/N3) repousse toutes les
échéances au mois de juin ; c'est voulu pour N2/N3, et V24 a retiré ce
travers de la proposition N1.

**Encadrants : niveau d'encadrement et niveau de plongeur sont distincts.**
`utilisateur.niveau_plongeur` (N1 à N5, V25, saisi par un ADMIN dans l'écran
Moniteurs) n'est pas déduit de `niveau_encadrement` : un E1 peut n'être que
N2. Le **directeur de plongée d'une fiche de sécurité est E3 minimum, quel
que soit le milieu** (choix du club, 2026 ; `FicheSecuriteService`,
constante `NIVEAU_DP_MINIMUM` — règle de sécurité générale, pas du MFT,
donc pas une colonne du référentiel).

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
chaque cursus (`cursus.moniteur_referent_id`) a été supprimé par V36. **Sans rapport avec `GroupePlongeurs`** (V13), qui
compose les palanquées d'un séjour (e-mail facultatif par membre, V44 —
vide, celui du dossier ; en fin de séjour `EnvoiParametresSejourService`
envoie à chacun les seules plongées de la sortie où il figure, lues sur les
fiches de sécurité ; des séances du même jour peuvent être
**liées**, V43 `LiaisonSeances`, depuis la fiche de sécurité : deux bateaux
se partagent un groupe, chaque fiche ne propose que les plongeurs absents
des palanquées des fiches liées ; `FicheSecuriteVue.seancesLiees`, simple
avertissement si un plongeur est sur les deux). **Grille des soirées (lot 2)** :
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
liste tous les espaces occupés, lus par les avertissements. `soiree_planning` porte le **DP fosse** et le
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
comme reçues.
**Notation groupée** (bouton « Noter les présents » de la feuille de
présence, `NotationGroupeeService`, `POST /api/seances/{id}/notation-groupee`) :
plusieurs élèves présents, un ou plusieurs critères, chacun avec son
commentaire, obligatoire (le même pour tous les élèves notés).
Elle ne fait jamais reculer un élève : acquis reste acquis, en cours reste en
cours (seul le commentaire s'ajoute), non abordé passe en cours. Élèves d'une
même version du MFT à la fois, présence déjà enregistrée exigée, tout ou rien
(un refus nomme l'élève), réseau obligatoire.

**Programme d'exercices d'une séance (2026).** Chaque groupe d'entraînement
prépare sa séance exercice par exercice (`/seances/:id/programme`,
`ProgrammeSeanceService`, `exercice_seance` + `exercice_seance_critere`,
V39 ; `exercice_seance.groupe_id`, V40), avant comme après la séance. Le
programme d'un groupe est préparé par ses encadrants attitrés (référents
compris) ou un ADMIN (refus 422 sinon) et consulté par tous les encadrants ;
`groupe_id` null = programme commun à toute la séance (séance sans groupes,
échauffement), préparé par tout encadrant. Chaque exercice vise une formation
(`referentiel_id`, null = exercice commun sans critère) et les critères qu'il
fait travailler. Le programme ne note personne : celui d'un groupe se
remplace d'un bloc (`PUT …/programme?groupeId=`, sans paramètre : le
commun), sans historique, et disparaît avec la séance ou le groupe. La fiche
de suivi reçoit avec la grille (`GrilleVue.programmes`, donc embarquée hors
ligne) le programme commun et celui du groupe de l'élève, et marque les
critères travaillés à la séance choisie ; la notation groupée propose de
cocher d'un coup les critères des exercices (du groupe filtré et du commun),
chacun gardant son commentaire obligatoire.

**La sécurité se joue à deux niveaux.** Le rôle via `hasRole('MONITEUR')`,
puis l'habilitation métier via
`@habilitation.peutEvaluer(#cursusId, authentication)` qui compare le niveau
d'encadrement de l'utilisateur au niveau exigé par le référentiel (E1 pour le
N1, E2 pour le N2, E3 pour le N3). L'auteur d'une évaluation vient toujours du
`SecurityContext`, jamais du corps de la requête. Les gardes Angular ne sont
que du confort d'affichage.

**Les règles du MFT sont dans le serveur.** `EvaluationService` et
`RegleDelivranceService` comparent des valeurs issues de la table
`referentiel` : milieu naturel exclusif pour N2 et N3, âge minimum, brevet
prérequis, RIFAP pour le N3, C6 du N2 validée en dernier. Ajouter une règle =
ajouter une colonne au référentiel plutôt qu'une constante dans le code.
**Choix révisé (2026) :** la vérification de la profondeur maximale
d'évolution (`referentiel.profondeur_max_formation` vs `seance.profondeur_max`)
a été retirée de `EvaluationService.verifierSeance` — la colonne reste en
base et éditable dans l'écran d'admin du référentiel, à titre indicatif, mais
n'est plus opposée au moniteur qui note un critère.

**Un élève n'est pas forcément en formation.** Le seul lien élève-saison
historique était `Cursus` (une formation N1/N2/N3 figée sur un référentiel).
Pour un élève déjà breveté qui continue de plonger avec le club sans viser
un nouveau niveau, `AdhesionSaison` (table `adhesion_saison`, contrôleur
`/api/adhesions`) porte une appartenance légère à une saison : pas de
référentiel, pas de suivi de séances/plongées (`Participation.cursus_id`
reste obligatoire, volontairement pas touché — un élève en adhésion seule
n'apparaît pas dans le roster de présence). Écran : `/admin/eleves`, filtre
« Sans rattachement à la saison ». Si le club a un jour besoin de compter
les présences d'un élève sans Cursus, c'est un vrai chantier sur
`Participation`, pas une extension de `AdhesionSaison`.

**Le hors ligne passe par une file, pas par un cache d'écriture.** Une
notation est écrite dans IndexedDB avec une référence client (UUID), puis
rejouée par `POST /api/synchronisation/evaluations`, qui répond élément par
élément. La référence est unique en base : rejouer une saisie ne la duplique
pas. Un refus différé remonte au moniteur dans un bandeau, il n'est jamais
absorbé silencieusement. Les écritures qui remplacent un état (présence,
fiche de sécurité, profil réalisé) passent par une seconde file,
`FileEcrituresService` : elles sont idempotentes côté serveur, donc on ne
garde que la dernière version par cible, envoyées dans l'ordre de leur
première saisie (une fiche avant son profil réalisé). « Préparer hors
ligne » embarque aussi les feuilles de présence et fiches de sécurité des
séances à ±30 jours, les moniteurs, plongeurs connus, groupes et le
planning du bassin de la saison ouverte.

**L'historique des entités modifiables passe par Envers, pas par un journal
maison.** `Utilisateur`, `Eleve`, `Seance`, `Cursus`, `ValidationCompetence`
et `Delivrance` sont `@Audited` (voir `fr.club.plongee.audit`) : chaque
UPDATE/DELETE crée une ligne dans sa table `*_aud`, rattachée à une ligne de
`revision_audit` qui porte l'auteur (`EcouteurRevisionAudit`, lu du
SecurityContext). Les tables déjà en ajout seul (`evaluation`...) n'ont pas
besoin d'Envers, elles portent déjà leur propre historique. Auditer une
nouvelle entité : ajouter `@Audited`, générer le schéma une fois avec
`ddl-auto=create` sur une base jetable, reprendre le DDL dans une migration
Flyway à la main (les types choisis par H2/Hibernate ne sont pas toujours
ceux qu'on veut en Postgres).

**Les vacances scolaires viennent de la source officielle, pas d'une copie.**
La génération d'une saison (`/admin/seances/generer`, `GenerationSaisonService`)
lit les vacances de la zone choisie dans le jeu de données « Calendrier
scolaire » de data.education.gouv.fr (`CalendrierScolaireOfficiel`) au
moment de l'aperçu : le serveur doit pouvoir joindre internet. Source
injoignable = refus explicite, jamais de dates devinées. Les jours fériés,
eux, sont calculés (`JoursFeries`, Pâques par l'algorithme de Meeus). Les
tests remplacent la source par une fausse (`GenerationSaisonTest`).

## Conventions

- Pas de `localStorage` ni de `sessionStorage` côté navigateur. Le jeton
  d'accès vit dans un signal Angular, le reste dans IndexedDB
  (`core/base-locale.ts`).
- Composants Angular standalone, signaux plutôt que RxJS pour l'état local,
  template et styles en ligne dans le `.ts`.
- Les erreurs métier lèvent `RegleMetierException` (422) avec un message
  destiné à l'utilisateur final, pas au développeur. Le front affiche le
  champ `detail` du `ProblemDetail` tel quel.
- Cibles tactiles d'au moins 44 px : l'appli se manipule avec les mains
  mouillées.
- Créations et modifications dans une fenêtre de dialogue
  (`core/dialogue.component.ts`, `<app-dialogue [ouvert] titre [erreur]
  (fermer)>`, boutons dans `.actions-dialogue`), plein écran sur
  téléphone, et non plus dans la liste. Restent des pages entières les
  formulaires longs (fiche d'un équipement, inspection TIV, fiche de
  sécurité, programme d'exercices, génération de saison). Un overlay
  ouvert depuis un dialogue (recadrage photo) se place dans son contenu :
  le reste de la page est inerte tant qu'il est ouvert.
- Identité visuelle alignée sur celle du club (cppjvo.fr) : palette
  océan/corail, Poppins pour les titres, Nunito pour le texte courant.
  Jetons de design dans `frontend/src/styles.css`. Ne pas introduire de
  bibliothèque de composants.

## Données personnelles

Le club suit des mineurs. Le certificat médical n'est **jamais** stocké,
seulement sa date de fin de validité (`eleve.certificat_valide_jusqu_au`).
Pour un élève (V46) comme pour un moniteur (V47, colonnes identiques sur
`utilisateur`) s'ajoutent la date de l'examen (`caci_date_examen`), la
qualité du médecin (`caci_medecin`, enum `MedecinCaci`) et les cases
cochées du CACI FFESSM « Version Juin 2026 » (`caci_activites`, enum
`ActiviteCaci`, libellés dans `core/caci.ts` : ensemble des activités, ou
bien seulement scaphandre/apnée/apnée > 6 m/nage avec accessoires,
compétition, limites et préconisations). Types communs dans
`fr.club.plongee.commun` (`Caci.verifier()` : contrôles de saisie) ; côté
écran `SaisieCaciComponent` et `DetailCaciComponent` (`core/`). Saisis par
un ADMIN (dossier élève, écran Moniteurs), montrés au clic sur la case CACI
d'« Infos élèves » et sur le CACI d'un moniteur, et dans « Mon compte ».
**Les cases seulement, jamais le texte écrit par le médecin** (activités en
compétition, détail des limites) : la case « limites » renvoie l'encadrant
au certificat papier. Ne pas ajouter de champ de santé, de pièce jointe médicale ni de commentaire
libre sur l'état de santé. `V100__donnees_demo.sql` ne contient que des noms
fictifs et ne doit pas être chargé en production (profil `dev` uniquement).

**Le droit à l'image est un consentement à part entière.** `eleve.autorisation_image`
est distinct de `eleve.autorisation_legale` (qui ne couvre que la pratique).
Une photo (`photo_eleve`, table séparée pour ne jamais alourdir les lectures
courantes d'un élève) n'est ni acceptée en dépôt ni renvoyée par
`EleveController` sans ce consentement explicite ; le retirer supprime la
photo, pas seulement son affichage. Même règle pour le trombinoscope des moniteurs :
`utilisateur.autorisation_image` + table `photo_utilisateur` (dépôt par un
ADMIN via `/api/admin/moniteurs/{id}/photo`, ou par le moniteur lui-même via
`/api/auth/moi/photo` depuis « Mon compte » — ce dépôt vaut consentement, le
retrait le retire ; lecture via `/api/moniteurs/{id}/photo`).

## Chantiers ouverts

1. Import du classeur Google Sheets existant, pour démarrer la saison en cours
   avec les données réelles. Point d'attention : le tableur a un 4ᵉ statut
   (`NA`, non acquis) que `StatutAcquisition` ne représente pas encore.
2. Écran d'administration : inscription des élèves, ouverture de saison faits
   (`/admin/eleves`, `/admin/saisons`, `/admin/cursus`), y compris modification
   des dates d'une saison. Import d'une révision du MFT fait pour N1, N2 et N3
   (V7, V8 — voir la note plus haut sur le N2/N3 scindés en qualifications) ;
   PA60 non importé (hors périmètre du brevet N3, voir plus haut).
3. Relances automatiques : certificats médicaux qui expirent, RIFAP échus, et
   les 4 plongées en milieu naturel dues par un N1 certifié en piscine.
4. ~~Export PDF de la fiche de suivi d'un élève.~~ Fait (`GET
   /api/cursus/{id}/fiche.pdf`, bouton dans la grille).
5. ~~Icônes PWA à fournir dans `frontend/public/icones/`.~~ Fait, depuis le
   logo du club (voir `frontend/public/icones/LISEZ-MOI.txt`).
6. ~~Envoi d'e-mail réel.~~ Fait (`ServiceNotificationEmail`, profil `!dev`,
   `spring.mail.*` en profil `prod` dans `application.yml` — hôte/identifiants
   par variables d'environnement `SMTP_HOTE`/`SMTP_UTILISATEUR`/
   `SMTP_MOT_DE_PASSE`). `ServiceNotificationConsole` reste la seule
   implémentation active en profil `dev` (pas de serveur SMTP local).

## Avertissement

Ce code a été écrit sans être compilé (Maven Central inaccessible dans
l'environnement de génération). Attendre des ajustements d'imports et de
signatures au premier `mvn spring-boot:run`. Commencer par faire passer
`mvn test` avant d'ajouter des fonctionnalités.
