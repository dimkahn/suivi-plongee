---
paths:
  - "backend/src/main/java/fr/club/plongee/sejour/**"
  - "frontend/src/app/features/sejours/**"
  - "frontend/src/app/features/admin/sorties.component.ts"
---

# Séjours

## Règles

### Structure
- **Un séjour dépend de sa `Sortie` et disparaît avec elle** : participants, voitures, logements → chambres → occupants, affaires à prévoir, programme, infos pratiques, frais.
- **Tables en SQL, sans entité ni Envers** : `SejourService` avec `NamedParameterJdbcTemplate`.
- **Réseau obligatoire** : pas de mode hors ligne.

### Droits
- **Modifié par son créateur et les organisateurs qu'il désigne, seulement** : `DroitsSejour`, `@droitsSejour.organise(#id, …)` sur chaque écriture (V80). *Pourquoi :* choix du club, 2026.
- **Le créateur est le compte qui a créé la sortie** : `sejour.createur_id`, posé par `SortieController.creer`.
- **Les organisateurs sont des comptes d'encadrant actifs** : table `sejour_organisateur`, `PUT …/organisateurs`.
- **Être ADMIN ou DT ne suffit pas pour modifier.** Un ADMIN peut seulement désigner les organisateurs (séjour sans créateur connu, créateur parti).
- **Les autres encadrants lisent le séjour en entier.**
- **Un participant qui a un compte** (son dossier élève ou son compte) **lit le carnet** : sans téléphone, e-mail, régime ni personne à prévenir des autres, **filtré par le serveur**.

### Participants
- **Un participant est un instantané éditable** (`sejour_participant`), comme un membre de groupe de plongeurs, pré-rempli du dossier élève ou du compte.
- **Contenu** : arrivée et départ (moyen, numéro de vol ou de train, lieu) ; régimes alimentaires en cases `RegimeAlimentaire` + une précision pour la cuisine ; personne à prévenir.
- **L'arrivée porte l'heure et le lieu de départ du voyage aller** (`arrivee_heure_depart`/`arrivee_lieu_depart`, V78). Plus tard que l'heure d'arrivée = départ la veille.
- **Le départ porte l'heure d'arrivée du voyage retour** (`depart_heure_arrivee`, V85) : qui aller chercher au retour, et quand. Montrée dans les groupes de départs, le carnet (écran et e-mail) et l'encart « Aujourd'hui ».
- **Un participant qui plonge peut être lié à un membre d'un groupe de plongeurs de la saison** (`sejour_participant.membre_groupe_id`, V79) : posé par « Inscrire un groupe » ou choisi dans sa fiche ; un par séjour.
- **Deux fiches liées, mais nom, prénom et e-mail reportés de l'une à l'autre** : `SejourService.reporterSurLePlongeur`, `GroupePlongeursService.reporterSurLesParticipants`.
- **À l'enregistrement d'un groupe, l'id des membres est gardé.** Sans id (appli restée à l'ancienne version, groupe repris d'une fiche), les membres sont retrouvés par dossier puis nom et prénom (`retrouver`).
- **L'e-mail du dossier n'est jamais figé dans le groupe.**
- **« Inscrire un groupe » ne lie pas un participant déjà inscrit dont nom ou e-mail diffère.** *Pourquoi :* rien n'est écrasé sans être vu.
- **Un participant présent dans les frais ne se retire pas du séjour** (422).
- **Pas de champ médical** (allergie, traitement). *Pourquoi :* demandé par le club en 2026, écarté par la règle « Données personnelles » tant qu'elle n'est pas révisée.

### Voitures et chambres
- **Une voiture** : places (conducteur compris), conducteur, passagers.
- **Une seule voiture par personne**, conducteur ou passager : refus 422 à l'enregistrement d'une voiture. Pas de contrainte en base (conducteur et passagers sont dans deux tables). *Pourquoi :* choix du club, 2026.
- **Une chambre par participant** : contrainte en base.
- **Avertissements jamais bloquants** : voiture ou chambre trop pleine, sans conducteur, sans chambre. L'avertissement « dans plusieurs voitures » ne sert qu'aux séjours saisis avant la règle d'une voiture.
- **Voiture de location** (`sejour_voiture.location_html`, V82) : le mail de réservation du loueur, collé en HTML par un organisateur.
- **Le serveur ne garde que le HTML nettoyé par `NettoyageHtml`** (jsoup : texte, tableaux, liens ouverts dans un nouvel onglet ; ni script, ni image, ni style).
- **« Vérifier » n'écrit rien** (`POST …/voitures/verifier-location`) : il montre l'aperçu et ce qui est retiré.
- **Affiché par `MailLoueurComponent`** (`[innerHTML]`, nettoyé encore par Angular).
- **Dans le carnet, seulement pour le conducteur et les passagers de la voiture**, filtré par le serveur ; en texte dans leur carnet par e-mail ; pas dans la version imprimable.

### Affaires et programme
- **Affaires à prévoir** : `CategorieAffaire`, liste remplacée d'un bloc ; liste type côté écran.
- **Programme** : `sejour_evenement` ; les plongées de la sortie s'y ajoutent à l'affichage.
- **Palanquées dans le programme** (`PalanqueesSejourService`, `SejourVue.palanquees`, `ProgrammeVue.palanquees`) : lues sur les fiches de sécurité des plongées de la sortie, affichées sous chaque plongée (`PalanqueesPlongeeComponent`) avec fonction, aptitude et niveau préparé de chacun. *Pourquoi :* demande du club, 2026.
- **Un encadrant voit toutes les palanquées, un participant seulement la sienne**, filtré par le serveur ; retrouvé par dossier élève, compte, sinon nom et prénom.
- **Encart « Aujourd'hui »** (`JourneeSejourComponent`, calcul pur dans `programme-du-jour.ts`, date de l'appareil) : dans le séjour et sur la page du lien (qui reçoit le programme par `MesInformationsVue.programme`). Du jour du premier voyage aller au dernier retour : le programme du jour et les voyages qui partent ce jour-là, avec l'heure à laquelle être sur place ; la veille, un rappel.
- **Avance par moyen de transport** : `MoyenTransport` côté serveur (carnet par e-mail), `AVANCES_TRANSPORT` côté écran. Avion 2 h, train 30 min, bateau 45 min, car 15 min.

### Carnet
- **`CarnetSejourService` envoie à chacun son carnet par e-mail**, ou aux seuls participants cochés (`participantIds` dans le corps), pour relancer qui ne l'a pas reçu.
- **Version imprimable** (`/sejours/:id/imprimer`, `CarnetImprimableComponent`, aussi dans la page du lien) : le carnet composé pour le papier, en tableaux, rubriques à cocher.
- **Téléphones, repas et personnes à prévenir ne sont imprimés que sur demande d'un encadrant**, jamais par défaut. *Pourquoi :* un carnet imprimé se distribue.
- **Le bandeau « Organisation »** sous le titre du séjour réunit organisateurs, droits, version imprimable, envoi du carnet et demande d'informations.

### Partage des frais
- **Dépenses avancées par un participant** (`sejour_depense`, montants en **centimes**), réparties entre les participants cochés selon leurs parts (`sejour_depense_part`, 2 pour un couple) ; remboursements faits dans `sejour_versement`. Onglet « Frais », `SejourFraisComponent`.
- **Soldes et remboursements à faire sont calculés, jamais stockés** (`FraisSejour`, calcul pur testé à part) : prorata arrondi au centime inférieur, centimes restants aux premiers ids ; plus gros débiteur vers plus gros créancier.
- **Lus par les participants**, carnet compris, et dans l'e-mail du carnet.
- **Les droits dépendent de qui agit, jamais du seul rôle** (`FraisService`, `ActeurFrais`). *Pourquoi :* choix du club, 2026 (V77).
  - créateur et organisateurs : tout ;
  - **moniteur inscrit au séjour** : toute dépense, quel qu'en soit le payeur (les élèves passent par lui) ;
  - autre participant (invité, compte non élève) : ce qu'il a payé lui-même ;
  - **élève : lecture seule**.
- **Chacun modifie ce qu'il a saisi** (`saisie_par_utilisateur_id` / `saisie_par_participant_id`).
- **Un remboursement se note par celui qui le reçoit.**
- **`FraisVue.droits` dit à l'écran ce qui est permis ; le serveur revérifie.**
- **Photos des notes** (`sejour_depense_photo`) : 6 au plus, JPEG/PNG vérifiés par `PhotoPretService.verifierImage`, réduites par le téléphone, lues par tous les participants.

### Demande d'informations et accès par lien
- **« Demander à chacun ses informations »** (`POST /api/sejours/{id}/invitations`, `AccesSejourService.envoyerInvitations`) : à chaque participant qui a un e-mail (ou aux seuls cochés, `participantIds`), de quoi renseigner lui-même téléphone, arrivée/départ, régimes, personne à prévenir, remarques, et voir/saisir les frais. *Pourquoi :* choix du club, 2026.
- **Un participant ne modifie jamais son nom, son e-mail ni son rôle** : `SejourService.DemandeMesInformations`.
- **Un encadrant** (compte MONITEUR, ADMIN ou DT, propre ou via le dossier élève) **reçoit le lien de l'appli** et complète par « Modifier mes informations » (`PUT /api/sejours/{id}/mes-informations`, ouvert à tout participant connecté).
- **Tous les autres** (élèves avec ou sans compte, invités) **reçoivent la page publique `/sejour/{code}`** (`EspaceParticipantComponent`, `AccesSejourController` sous `/api/public/sejour/**`, ouvert dans SecurityConfig). `/frais/{code}` (ancienne adresse) ouvre les frais.
- **`sejour.code_frais` est secret.**
- **Code à 6 chiffres par e-mail** : empreinte SHA-256 seulement en base, 10 min, 5 essais, un envoi par minute, même réponse si l'e-mail est inconnu ou celui d'un encadrant.
- **Puis un jeton** : empreinte en base, en-tête `X-Jeton-Sejour`, gardé en IndexedDB, valable jusqu'à 60 jours après le séjour.
- **Onglets de la page publique** :
  - « Carnet », ouvert d'abord (`CarnetSejourComponent`) : la carte `MonSejourComponent` de l'appli, puis un sommaire et les seules rubriques non vides, en lecture seule. `GET …/carnet` = `SejourService.carnetDuParticipant` : le carnet filtré comme pour un participant connecté, toujours à jour. « Enregistrer mes informations » y ramène.
  - « Mes informations » (`MesInformationsComponent`, partagé avec l'appli).
  - « Frais » : l'onglet et la page publique partagent `SejourFraisComponent` par un `PortFrais`.

## À ne pas faire
- Ne pas ouvrir la modification à un ADMIN ou au DT du seul fait de leur rôle.
- Ne pas laisser l'écran filtrer le carnet, les palanquées ou le mail du loueur : c'est le serveur.
- Ne pas ajouter de champ médical (allergie, traitement).
- Ne pas stocker soldes ni remboursements à faire.
- Ne pas stocker le HTML du loueur sans `NettoyageHtml`, ni le mettre dans la version imprimable.
- Ne pas imprimer téléphones, repas et personnes à prévenir par défaut.
- Ne pas stocker le code d'accès ni le jeton en clair.
- Ne pas laisser un participant changer nom, e-mail ou rôle via ses informations.
- Ne pas lier par « Inscrire un groupe » un participant dont nom ou e-mail diffère.

## Repères
- Paquet `fr.club.plongee.sejour`.
- Écrans : `/sejours`, `/sejours/:id` (bouton « Gérer le séjour » de `/admin/sorties`), `/sejours/:id/imprimer`, page publique `/sejour/{code}`, `/frais/{code}`.
- Tables : `sejour_participant` (dont `sejour_participant.membre_groupe_id`), `sejour_organisateur`, `sejour_evenement`, `sejour_voiture.location_html`, `sejour_depense`, `sejour_depense_part`, `sejour_versement`, `sejour_depense_photo` ; colonnes `sejour.createur_id`, `sejour.code_frais`, `arrivee_heure_depart`/`arrivee_lieu_depart`, `depart_heure_arrivee`, `saisie_par_utilisateur_id` / `saisie_par_participant_id` ; `sortie_aud` (source de V80).
- Migrations : V75 (séjour), V76 (frais), V77 (saisie par les participants, photos, accès sans compte), V78 (départ du voyage aller), V79 (participant lié), V80 (créateur et organisateurs), V82 (voiture de location), V85 (arrivée du voyage retour).
- Serveur : `SejourService`, `DroitsSejour`, `SortieController.creer`, `CarnetSejourService`, `PalanqueesSejourService`, `FraisService`, `ActeurFrais`, `FraisSejour`, `AccesSejourService`, `AccesSejourController`, `NettoyageHtml`, `MoyenTransport`, `RegimeAlimentaire`, `CategorieAffaire`, `GroupePlongeursService`, `PhotoPretService.verifierImage`.
- Vues : `SejourVue.palanquees`, `ProgrammeVue.palanquees`, `MesInformationsVue.programme`, `FraisVue.droits`.
- Écran : `JourneeSejourComponent`, `programme-du-jour.ts`, `AVANCES_TRANSPORT`, `PalanqueesPlongeeComponent`, `MailLoueurComponent`, `CarnetImprimableComponent`, `SejourFraisComponent`, `PortFrais`, `EspaceParticipantComponent`, `CarnetSejourComponent`, `MonSejourComponent`, `MesInformationsComponent`.
- Endpoints : `PUT …/organisateurs`, `POST …/voitures/verifier-location`, `POST /api/sejours/{id}/invitations`, `PUT /api/sejours/{id}/mes-informations`, `/api/public/sejour/**`, `GET …/carnet`.
- Test : `MigrationParticipantLieTest` rejoue la mise en production de V79 sur une base remplie (Flyway jusqu'à V78 puis V79).
- Démos : V117 (Port-Cros, juin 2027, Camille y participe), créé par `e3@club.fr` (V120), sans organisateur désigné ; V118 (frais) ; V121 (palanquées) ; V122 (heure d'arrivée des retours).

Historique des choix : `docs/decisions/sejour.md`.
