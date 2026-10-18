---
paths:
  - "backend/src/main/java/fr/club/plongee/sejour/**"
  - "frontend/src/app/features/sejours/**"
  - "frontend/src/app/features/admin/sorties.component.ts"
---

# Séjours

Paquet `fr.club.plongee.sejour`. Écrans `/sejours`, `/sejours/:id` (bouton « Gérer le séjour » de `/admin/sorties`). Migrations V75 (séjour), V76 (frais), V77 (saisie par les participants, photos, accès sans compte).

## Structure
- Un séjour dépend de sa `Sortie` et disparaît avec elle : participants, voitures, logements → chambres → occupants, affaires, programme, infos pratiques, frais.
- Tables en SQL, sans entité ni Envers : `SejourService` (`NamedParameterJdbcTemplate`).
- Réseau obligatoire, pas de hors ligne.

## Droits
- **Modifié seulement par son créateur et les organisateurs qu'il désigne** : `DroitsSejour`, `@droitsSejour.organise(#id, …)` sur chaque écriture (V80, source `sortie_aud`). *Choix du club, 2026.*
- Créateur = compte qui a créé la sortie (`sejour.createur_id`, posé par `SortieController.creer`).
- Organisateurs = comptes d'encadrant actifs (`sejour_organisateur`, `PUT …/organisateurs`).
- **ADMIN ou DT ne suffit pas pour modifier** ; un ADMIN peut seulement désigner les organisateurs (créateur inconnu ou parti).
- Les autres encadrants lisent tout.
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
- **Pas de champ médical** (allergie, traitement). *Demandé par le club en 2026, écarté par « Données personnelles » tant qu'elle n'est pas révisée.*
- Test `MigrationParticipantLieTest` : rejoue V79 sur une base remplie (Flyway jusqu'à V78 puis V79).

## Voitures et chambres
- Voiture : places (conducteur compris), conducteur, passagers.
- **Une seule voiture par personne** (conducteur ou passager) : 422 à l'enregistrement, pas de contrainte en base (deux tables). *Choix du club, 2026.*
- Une chambre par participant : contrainte en base.
- Avertissements jamais bloquants : trop plein, sans conducteur, sans chambre ; « dans plusieurs voitures » ne sert qu'aux séjours d'avant la règle.
- Voiture de location (`sejour_voiture.location_html`, V82) : mail de réservation du loueur collé en HTML par un organisateur. Le serveur ne garde que le HTML nettoyé par `NettoyageHtml` (jsoup : texte, tableaux, liens en nouvel onglet ; ni script, ni image, ni style).
- « Vérifier » (`POST …/voitures/verifier-location`) n'écrit rien : aperçu et ce qui est retiré.
- Affiché par `MailLoueurComponent` (`[innerHTML]`, renettoyé par Angular).
- Dans le carnet seulement pour le conducteur et les passagers de la voiture (filtré par le serveur), en texte dans leur e-mail, **jamais dans la version imprimable**.

## Affaires et programme
- Affaires : `CategorieAffaire`, liste remplacée d'un bloc ; liste type côté écran.
- Programme : `sejour_evenement`, plus les plongées de la sortie à l'affichage.
- Palanquées (`PalanqueesSejourService`, `SejourVue.palanquees`, `ProgrammeVue.palanquees`) lues sur les fiches de sécurité des plongées de la sortie, sous chaque plongée (`PalanqueesPlongeeComponent`) avec fonction, aptitude, niveau préparé. *Demande du club, 2026.*
- Encadrant : toutes les palanquées ; participant : la sienne seulement, **filtré par le serveur**, retrouvé par dossier, compte, sinon nom et prénom.
- Matériel emprunté (onglet « Matériel », `PretsSejourService`) : dans « Mon séjour », question « Avez-vous emprunté du matériel du club ? » tant que ni emprunt ni réponse « rien emprunté » (`rien_emprunte`, V91, pour soi seulement, effacée par une déclaration) ; puis case « Matériel emprunté ». Carte et onglet partagent `PretsDuSejour`.
- Encart « Aujourd'hui » (`JourneeSejourComponent`, calcul pur `programme-du-jour.ts`, date de l'appareil), dans le séjour et la page du lien (`MesInformationsVue.programme`) : du premier aller au dernier retour, programme du jour et voyages du jour avec l'heure d'être sur place ; la veille, un rappel.
- Avance par transport : `MoyenTransport` (serveur, e-mail), `AVANCES_TRANSPORT` (écran). Avion 2 h, train 30 min, bateau 45 min, car 15 min.

## Carnet
- `CarnetSejourService` envoie à chacun son carnet par e-mail, ou aux seuls cochés (`participantIds`) pour relancer.
- Version imprimable (`/sejours/:id/imprimer`, `CarnetImprimableComponent`, aussi dans la page du lien) : tableaux, rubriques à cocher.
- **Téléphones, repas, personnes à prévenir imprimés seulement sur demande d'un encadrant.** *Pourquoi :* un carnet imprimé se distribue.
- Bandeau « Organisation » sous le titre : organisateurs, droits, version imprimable, envoi du carnet, demande d'informations.

## Partage des frais
- Dépenses avancées par un participant (`sejour_depense`, **centimes**), réparties entre cochés selon leurs parts (`sejour_depense_part`, 2 pour un couple) ; remboursements dans `sejour_versement`. Onglet « Frais », `SejourFraisComponent`.
- **Soldes et remboursements à faire calculés, jamais stockés** (`FraisSejour`, calcul pur testé à part) : prorata arrondi au centime inférieur, reste aux premiers ids ; plus gros débiteur vers plus gros créancier.
- Lus par les participants, carnet et e-mail compris.
- **Droits selon qui agit, jamais le seul rôle** (`FraisService`, `ActeurFrais`). *Choix du club, 2026 (V77).*
  - créateur et organisateurs : tout ;
  - moniteur inscrit : toute dépense, quel que soit le payeur (les élèves passent par lui) ;
  - autre participant (invité, compte non élève) : ce qu'il a payé ;
  - **élève : lecture seule**.
- Chacun modifie ce qu'il a saisi (`saisie_par_utilisateur_id` / `saisie_par_participant_id`).
- Un remboursement se note par celui qui le reçoit.
- `FraisVue.droits` guide l'écran ; le serveur revérifie.
- Photos des notes (`sejour_depense_photo`) : 6 max, JPEG/PNG vérifiés par `PhotoPretService.verifierImage`, réduites par le téléphone, lues par tous les participants.

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

## Démos
V117 (Port-Cros, juin 2027, Camille y participe), créé par `e3@club.fr` (V120), sans organisateur ; V118 (frais) ; V121 (palanquées) ; V122 (heure d'arrivée des retours) ; V124 (lieu d'arrivée des retours).

Historique des choix : `docs/decisions/sejour.md`.
