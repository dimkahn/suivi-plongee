---
paths:
  - "backend/src/main/java/fr/club/plongee/sejour/**"
  - "frontend/src/app/features/sejours/**"
  - "frontend/src/app/features/admin/sorties.component.ts"
---

# Séjours

**Séjour d'une sortie (2026, V75).** Paquet `fr.club.plongee.sejour`,
écrans `/sejours` et `/sejours/:id` (bouton « Gérer le séjour » de
`/admin/sorties`). Tout dépend de la `Sortie` et disparaît avec elle :
participants (`sejour_participant`, instantané éditable comme un membre de
groupe de plongeurs, pré-rempli du dossier élève ou du compte ; un participant
qui plonge peut être **lié** à un membre d'un groupe de plongeurs de la saison
(V79, `sejour_participant.membre_groupe_id`, posé par « Inscrire un groupe »
ou choisi dans sa fiche ; un par séjour) : deux fiches, mais nom, prénom et
e-mail sont reportés de l'une à l'autre (`SejourService.reporterSurLePlongeur`,
`GroupePlongeursService.reporterSurLesParticipants`, qui garde désormais
l'id des membres à l'enregistrement d'un groupe, et, sans id — appli
restée à l'ancienne version, groupe repris d'une fiche — les retrouve par
dossier puis nom et prénom, `retrouver`) ; l'e-mail du dossier n'est jamais
figé dans le groupe ; un participant déjà inscrit dont nom ou e-mail diffère
n'est pas lié par « Inscrire un groupe » (rien n'est écrasé sans être vu).
`MigrationParticipantLieTest` rejoue la mise en production de V79 sur une
base remplie (Flyway jusqu'à V78 puis V79) ; arrivée et
départ avec moyen, numéro de vol ou de train, lieu ; régimes alimentaires
en cases `RegimeAlimentaire` + une précision pour la cuisine ; personne à
prévenir), voitures (places conducteur compris, conducteur, passagers),
logements → chambres → occupants (une chambre par participant, contrainte
en base), affaires à prévoir (`CategorieAffaire`, liste remplacée d'un
bloc, liste type côté écran), programme (`sejour_evenement`, les plongées
de la sortie s'y ajoutent à l'affichage) et infos pratiques. Tables en SQL
(`SejourService`, `NamedParameterJdbcTemplate`, pas d'entité ni d'Envers).
**Modifié par son créateur et les organisateurs qu'il désigne, seulement**
(choix du club, 2026, V80, `DroitsSejour`, `@droitsSejour.organise(#id, …)`
sur chaque écriture) : le créateur est le compte qui a créé la sortie
(`sejour.createur_id`, posé par `SortieController.creer` ; V80 l'a retrouvé
dans `sortie_aud` pour les sorties existantes), les organisateurs sont dans
`sejour_organisateur` (comptes d'encadrant actifs, `PUT …/organisateurs`).
Être ADMIN ou DT ne suffit plus pour modifier ; un ADMIN peut seulement
désigner les organisateurs (séjour sans créateur connu, créateur parti).
Lu en entier par les autres encadrants ; un participant qui a
un compte (son dossier élève ou son compte) lit le **carnet** : sans
téléphone, e-mail, régime ni personne à prévenir des autres (filtré par le
serveur). `CarnetSejourService` envoie à chacun son carnet par e-mail
(ou aux seuls participants cochés : `participantIds` dans le corps, de
même pour la demande d'informations, pour relancer qui ne l'a pas reçu) ;
« Version imprimable » (`/sejours/:id/imprimer`, `CarnetImprimableComponent`, aussi dans la page du lien) : le carnet composé pour le papier en tableaux, rubriques à cocher ; téléphones, repas et personnes à prévenir seulement sur demande d'un encadrant (non par défaut, un carnet imprimé se distribue). Le bandeau « Organisation » sous le titre du séjour réunit organisateurs, droits, version imprimable, envoi du carnet et demande d'informations. Avertissements jamais bloquants
(voiture ou chambre trop pleine, sans conducteur, sans chambre). **Une
seule voiture par personne** (choix du club, 2026) : conducteur ou
passager, refus 422 à l'enregistrement d'une voiture (pas de contrainte en
base, conducteur et passagers sont dans deux tables) ; l'avertissement
« dans plusieurs voitures » ne reste que pour les séjours saisis avant.
**Voiture de location** (V82, `sejour_voiture.location_html`) : le mail de
réservation du loueur, collé en HTML par un organisateur. Le serveur ne
garde que le HTML nettoyé par `NettoyageHtml` (jsoup : texte, tableaux,
liens ouverts dans un nouvel onglet ; ni script, ni image, ni style) ;
« Vérifier » (`POST …/voitures/verifier-location`, n'écrit rien) montre
l'aperçu et ce qui est retiré. Affiché par `MailLoueurComponent`
(`[innerHTML]`, nettoyé encore par Angular) ; dans le carnet, seulement
pour le conducteur et les passagers de la voiture (filtré par le serveur),
en texte dans leur carnet par e-mail ; pas dans la version imprimable. **Encart « Aujourd'hui »** (`JourneeSejourComponent`, calcul pur
dans `programme-du-jour.ts`, date de l'appareil ; dans le séjour et sur la
page du lien, qui reçoit le programme par `MesInformationsVue.programme`) :
du jour du premier voyage aller au dernier retour, le programme du jour et
les voyages qui partent ce jour-là avec l'heure à laquelle être sur place
(avance par moyen de transport, `MoyenTransport` côté serveur pour le
carnet par e-mail, `AVANCES_TRANSPORT` côté écran : avion 2 h, train
30 min, bateau 45 min, car 15 min) ; la veille, un rappel. L'arrivée porte
l'heure et le lieu de départ du voyage aller (V78,
`arrivee_heure_depart`/`arrivee_lieu_depart` ; plus tard que l'heure
d'arrivée = départ la veille). **Palanquées dans le programme** (demande du
club, 2026, `PalanqueesSejourService`, `SejourVue.palanquees` et
`ProgrammeVue.palanquees`) : lues sur les fiches de sécurité des plongées
de la sortie, sous chaque plongée (`PalanqueesPlongeeComponent`), avec la
fonction, l'aptitude et le niveau préparé de chacun ; un encadrant les voit
toutes, un participant seulement la sienne (filtré par le serveur, retrouvé
par dossier élève, compte, sinon nom et prénom). Démo : V121. **Pas de champ médical** (allergie, traitement) : demandé par
le club en 2026, écarté par la règle « Données personnelles » ci-dessous
tant qu'elle n'est pas révisée. Réseau obligatoire. Démo : V117 (Port-Cros,
juin 2027, Camille y participe ; créé par `e3@club.fr`, V120, sans
organisateur désigné).
**Partage des frais** (V76, onglet « Frais », `SejourFraisComponent`) :
dépenses avancées par un participant (`sejour_depense`, montants en
**centimes**), réparties entre les participants cochés selon leurs parts
(`sejour_depense_part`, 2 pour un couple), et remboursements faits
(`sejour_versement`). Soldes et remboursements à faire sont **calculés,
jamais stockés** (`FraisSejour`, calcul pur testé à part : prorata arrondi
au centime inférieur, centimes restants aux premiers ids ; plus gros
débiteur vers plus gros créancier). Saisis par les organisateurs, lus aussi par les
participants (carnet compris, et dans l'e-mail du carnet). Un participant
présent dans les frais ne se retire pas du séjour (422). Démo : V118.
**Saisie par les participants, photos, accès sans compte (V77, choix du
club 2026).** `FraisService` règle les droits selon qui agit
(`ActeurFrais`, jamais le seul rôle) : créateur et organisateurs tout ; **moniteur inscrit
au séjour** toute dépense, quel qu'en soit le payeur (les élèves passent
par lui) ; autre participant (invité, compte non élève) ce qu'il a payé
lui-même ; **élève : lecture seule**. Chacun modifie ce qu'il a saisi
(`saisie_par_utilisateur_id` / `saisie_par_participant_id`) ; un
remboursement se note par celui qui le reçoit. `FraisVue.droits` dit à
l'écran ce qui est permis (le serveur revérifie). Photos des notes :
`sejour_depense_photo` (6 au plus, JPEG/PNG vérifiés par
`PhotoPretService.verifierImage`, réduites par le téléphone), lues par
tous les participants. **Demande d'informations et accès par lien (choix
du club, 2026)** : « Demander à chacun ses informations »
(`POST /api/sejours/{id}/invitations`, `AccesSejourService.envoyerInvitations`)
envoie à chaque participant qui a un e-mail de quoi renseigner lui-même
téléphone, arrivée/départ, régimes, personne à prévenir, remarques
(`SejourService.DemandeMesInformations` : jamais nom, e-mail ni rôle) et
voir/saisir les frais. Un **encadrant** (compte MONITEUR, ADMIN ou DT,
propre ou via le dossier élève) reçoit le lien de l'appli et y complète
par « Modifier mes informations » (`PUT /api/sejours/{id}/mes-informations`,
ouvert à tout participant connecté) ; **tous les autres** (élèves, avec
ou sans compte, invités) la page publique `/sejour/{code}` (`/frais/{code}`,
ancienne adresse, ouvre les frais ; `EspaceParticipantComponent`,
`AccesSejourController` sous `/api/public/sejour/**`, ouvert dans
SecurityConfig) : `sejour.code_frais` secret, code à 6 chiffres par e-mail
(empreinte SHA-256 seulement, 10 min, 5 essais, un envoi par minute, même
réponse si l'e-mail est inconnu ou celui d'un encadrant), puis jeton
(empreinte en base, en-tête `X-Jeton-Sejour`, gardé en IndexedDB) valable
jusqu'à 60 jours après le séjour ; onglets « Carnet » (ouvert d'abord,
`CarnetSejourComponent` : la carte `MonSejourComponent` de l'appli puis
un sommaire et les seules rubriques non vides, lecture seule ; « Enregistrer
mes informations » y ramène ; `GET …/carnet` =
`SejourService.carnetDuParticipant` : le carnet filtré comme pour un
participant connecté, toujours à jour), « Mes informations »
(`MesInformationsComponent`, partagé avec l'appli) et « Frais ». L'onglet
et la page publique partagent `SejourFraisComponent` par un `PortFrais`.
