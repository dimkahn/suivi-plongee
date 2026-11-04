---
paths:
  - "backend/src/main/java/fr/club/plongee/sejour/**"
  - "frontend/src/app/features/sejours/**"
  - "frontend/src/app/features/admin/sorties.component.ts"
---

# Séjours

Paquet `fr.club.plongee.sejour`. Écrans `/sejours`, `/sejours/:id` (bouton « Gérer le séjour » de `/admin/sorties`). Migrations V75 (séjour), V76 (frais), V77 (saisie par les participants, photos, accès sans compte).

## Page du séjour
- **Cinq onglets, les mêmes pour tous** (`onglets-sejour.ts`) : Programme (et fiches de sécurité), Qui et où (participants, arrivées et départs, voitures, logements), Repas (régimes, courses, restaurant), Frais, Pratique (affaires, infos pratiques, matériel emprunté). *Demande du club, 2026.*
- **Sous-onglets** (`rubriquesSejour`, `rubriqueChoisie`) : une seule rubrique montrée à la fois ; un participant n'a pas celles des encadrants. Anciens noms d'onglet et tuiles de « Mon séjour » ouvrent la bonne rubrique (`ouvertureDemandee`).
- Points à vérifier en haut de la rubrique qui les règle (« Voitures », « Logements ») ; rond orange sur « Qui et où ».
- Encart « À faire » (`ActionsSejourComponent`) : les fiches qui attendent l'encadrant (établir, compléter, signer comme DP). Jamais replié.
- « Replier » réduit « Aujourd'hui » et « Mon séjour », dans l'appli seulement ; choix gardé sur l'appareil (`ReplisSejourService`, IndexedDB).

## Structure
- Un séjour dépend de sa `Sortie` et disparaît avec elle : participants, voitures, logements → chambres → occupants, affaires, programme, infos pratiques, frais.
- Tables en SQL, sans entité ni Envers : `SejourService` (`NamedParameterJdbcTemplate`).
- Lecture et écritures sans réseau : voir « Sans réseau ».

## Droits
- **Modifié seulement par son créateur et les organisateurs qu'il désigne** : `DroitsSejour`, `@droitsSejour.organise(#id, …)` sur chaque écriture (V80, source `sortie_aud`). *Choix du club, 2026.*
- Créateur = compte qui a créé la sortie (`sejour.createur_id`, posé par `SortieController.creer`).
- Organisateurs = comptes d'encadrant actifs (`sejour_organisateur`, `PUT …/organisateurs`).
- **ADMIN ou DT ne suffit pas pour modifier** ; un ADMIN peut seulement désigner les organisateurs (créateur inconnu ou parti).
- Les autres encadrants lisent tout, sauf les réservations de voyage, cartes d'embarquement et attestations d'assurance des autres (`sansReservationsDesAutres`).
- « Voir comme un participant » (`?commeParticipant=true`, tout encadrant) : le carnet et les frais sans droits d'organisateur. Une vue seulement : le serveur revérifie chaque écriture.
- Un participant avec compte (dossier élève ou compte) lit le carnet sans téléphone, e-mail, régime ni personne à prévenir des autres, **filtré par le serveur**.

## Participants
- Instantané éditable (`sejour_participant`), comme un membre de groupe de plongeurs, pré-rempli du dossier élève ou du compte.
- Contenu : arrivée et départ (moyen, n° de vol/train, lieu) ; régimes en cases `RegimeAlimentaire` + précision pour la cuisine ; personne à prévenir.
- Arrivée : heure et lieu de départ du voyage aller (`arrivee_heure_depart`/`arrivee_lieu_depart`, V78) ; plus tard que l'heure d'arrivée = départ la veille.
- Départ : jour, heure, lieu d'arrivée du retour (`depart_date_arrivee`/`depart_heure_arrivee`/`depart_lieu_arrivee`, V85, V87, V89 : qui aller chercher, quand, où), montré dans les groupes de départs, le carnet (écran et e-mail) et « Aujourd'hui ».
- Lien possible vers un membre d'un groupe de plongeurs de la saison (`membre_groupe_id`, V79), posé par « Inscrire un groupe » ou dans la fiche ; un par séjour.
- Nom, prénom, e-mail reportés d'une fiche liée à l'autre : `SejourService.reporterSurLePlongeur`, `GroupePlongeursService.reporterSurLesParticipants`.
- À l'enregistrement d'un groupe, l'id des membres est gardé ; sans id (appli ancienne, groupe repris d'une fiche), retrouvés par dossier puis nom et prénom (`retrouver`).
- L'e-mail du dossier n'est jamais figé dans le groupe.
- « Inscrire un groupe » ne lie pas un inscrit dont nom ou e-mail diffère. *Pourquoi :* rien n'est écrasé sans être vu.
- Un participant présent dans les frais ne se retire pas (422).
- Liste : recherche et filtres « À compléter », « Sans attestation » (`recherche-participants.ts`), boutons rapides sous chaque nom, qui a activé les notifications.
- **Pas de champ médical** (allergie, traitement). *Demandé par le club en 2026, écarté par « Données personnelles » tant qu'elle n'est pas révisée.*
- Test `MigrationParticipantLieTest` : rejoue V79 sur une base remplie (Flyway jusqu'à V78 puis V79).

## Voitures et chambres
- Voiture : places (conducteur compris), conducteur, passagers.
- **Une seule voiture par personne** (conducteur ou passager) : 422 à l'enregistrement, pas de contrainte en base (deux tables). *Choix du club, 2026.*
- Une chambre par participant : contrainte en base.
- Avertissements jamais bloquants : trop plein, sans conducteur, sans chambre ; « dans plusieurs voitures » ne sert qu'aux séjours d'avant la règle.
- Voiture de location (mail du loueur, V82) : **retirée** à la demande du club, colonne supprimée par V83 (`MigrationLocationRetireeTest`).

## Affaires et programme
- Affaires : `CategorieAffaire`, liste remplacée d'un bloc ; liste type côté écran.
- Programme : `sejour_evenement`, plus les plongées de la sortie à l'affichage.
- Palanquées (`PalanqueesSejourService`, `SejourVue.palanquees`, `ProgrammeVue.palanquees`) lues sur les fiches de sécurité des plongées de la sortie, sous chaque plongée (`PalanqueesPlongeeComponent`) avec fonction, aptitude, niveau préparé. *Demande du club, 2026.*
- Encadrant : toutes les palanquées ; participant : la sienne seulement, **filtré par le serveur**, retrouvé par dossier, compte, sinon nom et prénom.
- Présentation d'une journée en carnet de voyage (`sejour_journee`, V99_10, `JourneesSejourService`, `JourneeProgrammeComponent`) : titre, trajet, à découvrir, conseil, hébergement, 4 photos au plus (`sejour_journee_photo`). **Aucune personne reconnaissable** ; réseau obligatoire pour écrire ; e-mail et version imprimable : textes seulement.
- Matériel emprunté (Pratique › « Matériel emprunté », `PretsSejourService`) : dans « Mon séjour », question « Avez-vous emprunté du matériel du club ? » tant que ni emprunt ni réponse « rien emprunté » (`rien_emprunte`, V91, pour soi seulement, effacée par une déclaration) ; puis case « Matériel emprunté ». Carte et onglet partagent `PretsDuSejour`. Qui voit tous les emprunts voit aussi `rienEmpruntePar` et `sansReponse` (vides pour un participant, **filtré par le serveur**).
- Encart « Aujourd'hui » (`JourneeSejourComponent`, calcul pur `programme-du-jour.ts`, date de l'appareil), dans le séjour et la page du lien (`MesInformationsVue.programme`) : du premier aller au dernier retour, programme du jour et voyages du jour avec l'heure d'être sur place ; la veille, un rappel.
- Avance par transport : `MoyenTransport` (serveur, e-mail), `AVANCES_TRANSPORT` (écran). Avion 3 h, train 30 min, bateau 45 min, car 15 min.

## Carnet
- `CarnetSejourService` envoie à chacun son carnet par e-mail, ou aux seuls cochés (`participantIds`) pour relancer.
- Version imprimable (`/sejours/:id/imprimer`, `CarnetImprimableComponent`, aussi dans la page du lien) : tableaux, rubriques à cocher.
- **Téléphones, repas, personnes à prévenir imprimés seulement sur demande d'un encadrant.** *Pourquoi :* un carnet imprimé se distribue.
- Bandeau « Organisation » : « Version imprimable » ; le reste dans la fenêtre « Partager et organiser… » (voir comme un participant, trombinoscope, carnet, paramètres de plongée, organisateurs, prévenir). « Demander les informations… » est en haut de la liste des participants.
- « Envoyer les paramètres de plongée… » (`POST …/envoi-parametres`, organisateurs, `ParametresPlongeeSejourService`) : aux cochés, chacun ses seules plongées, lues sur les fiches de sécurité.

## Voyages et documents
- Réservation d'un voyage (V96) : terminal, ouverture de l'enregistrement, n° de dossier, lien http(s) ; carte `CarteVoyageComponent`, calculs `voyage.ts`. Rien n'est lu chez la compagnie.
- Carte d'embarquement (V98, `CartesEmbarquementService`) et attestation d'assurance (V99, `AttestationsAssuranceService`) : PDF ou JPEG/PNG, 5 Mo, signature vérifiée, `no-store`. **Lues seulement par la personne et les organisateurs, pas par un ADMIN** (403), jamais imprimées ni envoyées par e-mail.
- **Effacées après le séjour par une tâche de nuit**, heure de Paris : cartes 3 h 30, attestations 3 h 35, photos d'invités 3 h 40.
- Conseil d'assurance : texte de l'organisateur (`sejour.conseil_assurance`, V99), montré tant que l'attestation manque, sans bloquer.

## Trombinoscope
- `TrombinoscopeSejourService` : encadrants, toutes les photos consenties ; participants, seulement celles qu'un organisateur a rendues visibles avec l'accord de la personne (V99_5). **Jamais sans le droit à l'image du dossier ou du compte.**
- Invité : photo propre au séjour (V99_4), déposée par un organisateur avec son accord, effacée après le séjour.
- Export en image : organisateurs seulement, fabriqué dans le navigateur (`ExportTrombinoscopeComponent`) ; le manuel demande l'accord des personnes.

## Repas
- Courses (encadrants) : seuls les repas au restaurant sont stockés (`sejour_repas_au_restaurant`, V99_7, `RepasSejourService`) ; la liste est calculée par l'écran (`liste-courses.ts`), rien d'autre n'en est gardé. Réseau obligatoire.
- Menu du restaurant (V99_8, `MenusRestaurantService`, `LecteurMenu`) : classeur importé par les organisateurs, fabriqué avec le prompt de l'écran (`PROMPT_MENU`) : **l'appli n'envoie rien à une IA**. Réimporter efface les choix ; modifier à la main garde ceux des plats conservés.
- Choix : plusieurs plats, **ni quantité ni commentaire libre** (pas de porte d'entrée à une donnée de santé). Chacun ne lit que le sien ; la commande complète, seulement les organisateurs, **filtré par le serveur**.
- « Payer l'addition » (`POST …/menus/{menuId}/reglement`, organisateurs ; payeur : tout participant ou le club) dès qu'une personne a choisi : **une dépense par personne** au prix de ses plats (`sejour_depense.menu_id`, V99_9), sauf ceux qui paient de leur côté. Payée = une dépense du menu existe : choix et menu figés (422) ; supprimer ces dépenses rouvre les choix.

## Fiches de sécurité du séjour
- `FichesSecuriteSejourService`, onglet Programme : une ligne par plongée de la sortie et l'état de sa fiche (MONITEUR ou ADMIN). Établir, compléter, signer passent par les écrans et droits habituels (`?sejour=` pour le retour).
- Ajouter une plongée, ou supprimer celle qui n'a ni fiche, ni présence, ni évaluation (422) : organisateurs. Réseau obligatoire.

## Partage des frais
- Dépenses avancées par un participant (`sejour_depense`, **centimes**), réparties entre cochés selon leurs parts (`sejour_depense_part`, 2 pour un couple) ; remboursements dans `sejour_versement`. Onglet « Frais », `SejourFraisComponent`.
- **Soldes et remboursements à faire calculés, jamais stockés** (`FraisSejour`, calcul pur testé à part) : prorata arrondi au centime inférieur, reste aux premiers ids ; plus gros débiteur vers plus gros créancier.
- **Le club peut avancer une dépense** (V99_3) : `payeur_id` null ; `de_id` ou `a_id` null dans un remboursement, jamais les deux. Il a son solde, sans jamais prendre de part. **Un id null signifie « le club » dans `FraisVue`** : comparer par `moi.equals(id)`.
- Lus par les participants, carnet et e-mail compris.
- **Droits selon qui agit, jamais le seul rôle** (`FraisService`, `ActeurFrais`). *Choix du club, 2026 (V77).*
  - créateur et organisateurs : tout ;
  - moniteur inscrit : toute dépense, quel que soit le payeur ;
  - tout autre participant, **élèves compris** (2026-10-24) : ce qu'il a payé.
- Chacun modifie ce qu'il a saisi (`saisie_par_utilisateur_id` / `saisie_par_participant_id`).
- Un remboursement se note par celui qui le reçoit, ou par un organisateur ou moniteur du séjour.
- `FraisVue.droits` guide l'écran ; le serveur revérifie.
- Photos des notes (`sejour_depense_photo`) : 6 max, JPEG/PNG vérifiés par `PhotoPretService.verifierImage`, réduites par le téléphone, lues par tous les participants.
- **Lignes d'une addition de restaurant masquées** : `FraisService.lire` ne les renvoie qu'aux organisateurs, à celui qui a payé, et à chacun la sienne (le montant dirait ce qu'il a choisi). Soldes et remboursements restent calculés sur toutes.
- Lecture des notes : sur le téléphone, sans IA ni service extérieur (`ocr-ticket.ts`, règles `lecture-ticket.ts`). Claude seulement en option par installation (`LECTURE_NOTES_CLE_API`, `LecteurNoteClaude`), avec repli sur le téléphone. Rien n'est gardé de la photo lue.
- Règles apprises des corrections (`regle_lecture_note`, V88, `ReglesLectureService`) : commerçant → catégorie, libellé → total, communes au club ; ni photo, ni texte du ticket, ni montant, ni auteur.
- **Export Excel** (`GET …/frais.xlsx`, `FraisExcelService`, « Exporter en Excel ») au format du classeur du club : onglets « Soldes », « Dépenses », « Remboursements », formules qui retrouvent chacun par son nom, d'où un nom unique par ligne. **Organisateurs seulement** (`DroitsFrais.exporter`) : les formules additionnent les lignes d'additions que les autres ne lisent pas. Rien ne revient dans l'appli. **Le fichier sort de l'appli** (noms, parfois de mineurs ; prix du repas de chacun, le libellé d'une addition nomme la personne) : le manuel demande de ne le donner qu'au trésorier et de le supprimer du téléphone.

## Demande d'informations et accès par lien
- « Demander à chacun ses informations » (`POST /api/sejours/{id}/invitations`, `AccesSejourService.envoyerInvitations`) : à chaque participant avec e-mail (ou aux cochés, `participantIds`), de quoi renseigner téléphone, arrivée/départ, régimes, personne à prévenir, remarques, et voir/saisir les frais. *Choix du club, 2026.*
- **Un participant ne modifie jamais son nom, son e-mail ni son rôle** (`SejourService.DemandeMesInformations`).
- Encadrant (MONITEUR, ADMIN ou DT, compte propre ou via dossier élève) : reçoit le lien de l'appli, complète par « Modifier mes informations » (`PUT /api/sejours/{id}/mes-informations`, ouvert à tout participant connecté).
- Tous les autres (élèves avec ou sans compte, invités) : page publique `/sejour/{code}` (`EspaceParticipantComponent`, `AccesSejourController`, `/api/public/sejour/**` ouvert dans SecurityConfig). `/frais/{code}` (ancienne adresse) ouvre les frais.
- `sejour.code_frais` est secret.
- Code à 6 chiffres par e-mail : **seule l'empreinte SHA-256 en base**, 10 min, 5 essais, un envoi par minute, même réponse si e-mail inconnu ou d'encadrant.
- Puis un jeton : **empreinte en base**, en-tête `X-Jeton-Sejour`, gardé en IndexedDB, valable jusqu'à 60 jours après le séjour.
- Onglets de la page publique :
  - « Carnet », ouvert d'abord (`CarnetSejourComponent`) : carte `MonSejourComponent`, sommaire, rubriques non vides, lecture seule. `GET …/carnet` = `SejourService.carnetDuParticipant`, filtré comme pour un participant connecté, toujours à jour. « Enregistrer mes informations » y ramène.
  - « Mes informations » (`MesInformationsComponent`, partagé avec l'appli).
  - « Frais » : `SejourFraisComponent` partagé via `PortFrais`.
  - « Matériel », « Restaurant », « Trombinoscope ».
- **Entrée sans le lien** depuis la page de connexion (`EntreeSejourController`, `POST /api/public/sejours/code`, `/connexion`) : mêmes règles de code ; réponse identique que l'e-mail soit connu ou non, **l'adresse secrète rendue seulement après le bon code**.
- **QR code d'une minute** (`POST …/participants/{pid}/qr-code`, organisateurs, refusé pour un encadrant) : ticket `sejour_ticket_qr` (V99_11), empreinte seulement, 60 s, un seul usage, dans le fragment de l'adresse. **Un nouveau QR code déconnecte les appareils du participant.** Jeton valable un mois après le séjour.
- Séjour retenu sur le téléphone (`sejour-courant.ts`, IndexedDB) : la page de connexion y renvoie tant que la connexion dure ; « Se déconnecter » ou un jeton refusé l'oublient.

## Notifications
- Web Push (`NotificationsSejourService`) activées par chaque participant, envoyées par les organisateurs (`POST …/notifications`), e-mail en secours si demandé. Sans bibliothèque : `ChiffrementPush`, `ClesVapid` (clés gardées en base, `cle_vapid`, V99_12).
- Seules les adresses des services des navigateurs sont acceptées. Abonnements (`sejour_abonnement_push`) oubliés si expirés, coupés, ou 60 jours après le séjour (`PurgeAbonnementsPush`, 3 h).

## Sans réseau
- **Une copie pour lire, une file pour écrire, jamais un cache d'écriture** (`FileSejourService`, calcul pur `sejour-hors-ligne.ts`, magasins `sejour`, `refusSejour`). Un 403 ou 404 efface la copie.
- En file : participants, trajet commun, voitures, logements, affaires, programme, infos pratiques, conseil d'assurance, « Mes informations », dépenses, remboursements. Créations rejouables : `X-Reference-Client`, `RejeuSejour`, `sejour_reference_client` (V99_2).
- Restent en ligne : e-mails, organisateurs, « Inscrire un groupe », cartes et attestations (jamais copiées), photos, lecture des notes par le serveur, matériel, export Excel. La page du lien se lit sur sa copie mais n'écrit pas sans réseau.

## Démos
V117 (Port-Cros, juin 2027, Camille y participe), créé par `e3@club.fr` (V120), sans organisateur ; V118 (frais) ; V119 (départs de l'aller) ; V121 (palanquées) ; V122 (heure d'arrivée des retours) ; V124 (lieu d'arrivée des retours) ; V126 (réservations) ; V128 (carte d'embarquement) ; V129 (attestation, conseil) ; V130 (frais du club) ; V131 (groupes de plongeurs) ; V132 (repas au restaurant) ; V133 (menu) ; V134 (journées).

Historique des choix : `docs/decisions/sejour.md`.
