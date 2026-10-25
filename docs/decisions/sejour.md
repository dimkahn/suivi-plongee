# Séjours : historique des décisions

Historique des choix. Les règles en vigueur sont dans `.claude/rules/sejour.md`.

## Séjour d'une sortie

- **Date** : 2026, V75.
- **Décision** : un séjour (participants, voitures, logements, affaires, programme, infos pratiques) rattaché à une `Sortie`. Tables en SQL via `SejourService` et `NamedParameterJdbcTemplate`, sans entité ni Envers.
- **Conséquences** : tout disparaît avec la sortie.

## Partage des frais

- **Date** : 2026, V76.
- **Décision** : dépenses en centimes, parts par participant, remboursements ; soldes calculés par `FraisSejour`, jamais stockés.
- **Conséquences** : au départ, saisis par les organisateurs seuls et lus par les participants.

## Saisie par les participants, photos, accès sans compte

- **Date** : 2026, V77, choix du club.
- **Contexte** : les frais n'étaient saisis que par les organisateurs ; les élèves et invités n'ont pas forcément de compte.
- **Décision** : droits selon qui agit (`ActeurFrais`) ; photos des notes ; demande d'informations par e-mail et page publique par lien, code à 6 chiffres puis jeton.
- **Conséquences** : `/frais/{code}` est l'ancienne adresse de la page publique, gardée : elle ouvre les frais.

## Les élèves saisissent aussi leurs frais

- **Date** : 2026-10-24, demande du club.
- **Contexte** : un élève lisait les frais sans rien saisir ; il devait donner sa note à un moniteur du séjour.
- **Décision** : tous les participants ajoutent des frais. Un élève (avec ou sans compte) a les droits d'un invité : les dépenses qu'il a payées lui-même, modifiées et supprimées par lui seul ; un remboursement qu'il a reçu. Saisir pour un autre payeur reste à l'organisateur et aux moniteurs du séjour.
- **Conséquences** : `ActeurFrais` n'a plus de drapeau « élève » ; le moniteur peut toujours saisir pour un élève.

## Heure et lieu de départ du voyage aller

- **Date** : 2026, V78.
- **Décision** : `arrivee_heure_depart`/`arrivee_lieu_depart` sur le participant, pour l'encart « Aujourd'hui ».

## Participant lié à un membre de groupe de plongeurs

- **Date** : 2026, V79.
- **Contexte** : un participant qui plonge figure aussi dans un groupe de plongeurs ; les deux fiches divergeaient.
- **Décision** : lien `sejour_participant.membre_groupe_id` ; nom, prénom et e-mail reportés de l'une à l'autre. `GroupePlongeursService` garde désormais l'id des membres à l'enregistrement d'un groupe ; pour une appli restée à l'ancienne version, il les retrouve par dossier puis nom et prénom.
- **Conséquences** : `MigrationParticipantLieTest` rejoue la mise en production de V79 sur une base remplie.

## Modification réservée au créateur et aux organisateurs

- **Date** : 2026, V80, choix du club.
- **Contexte** : avant V80, un ADMIN ou le DT pouvait modifier tout séjour.
- **Décision** : seuls le créateur (`sejour.createur_id`) et les organisateurs désignés modifient. V80 a retrouvé le créateur des sorties existantes dans `sortie_aud`. Un ADMIN ne garde que la désignation des organisateurs.

## Une seule voiture par personne

- **Date** : 2026, choix du club.
- **Contexte** : une personne pouvait figurer dans plusieurs voitures ; un avertissement le signalait.
- **Décision** : refus 422 à l'enregistrement. Pas de contrainte en base, conducteur et passagers étant dans deux tables.
- **Conséquences** : l'avertissement « dans plusieurs voitures » ne reste que pour les séjours saisis avant.

## Voiture de location

- **Date** : 2026, V82.
- **Décision** : le mail de réservation du loueur collé en HTML, nettoyé par jsoup (`NettoyageHtml`) avant d'être gardé, montré seulement aux occupants de la voiture.
- **Révision (octobre 2026)** : fonctionnalité retirée à la demande. V83 supprime la colonne `sejour_voiture.location_html` ; V82 reste dans le dépôt, inchangée, car elle a pu être appliquée en production (`MigrationLocationRetireeTest`).

## Palanquées dans le programme

- **Date** : 2026, demande du club.
- **Décision** : palanquées lues sur les fiches de sécurité des plongées de la sortie ; un participant ne voit que la sienne. Démo V121.

## Champ médical écarté

- **Date** : 2026.
- **Contexte** : le club a demandé un champ allergie / traitement.
- **Décision** : écarté par la règle « Données personnelles » (le club suit des mineurs), tant qu'elle n'est pas révisée.

## Matériel emprunté, déclaré depuis le séjour

- **Date** : 2026-10.
- **Contexte** : le club veut que ceux qui empruntent du matériel pour un séjour le déclarent eux-mêmes, comme leurs frais, plutôt que d'attendre le directeur technique.
- **Décision** : onglet « Matériel » du séjour et de la page du lien (`PretsSejourService`, `/api/sejours/{id}/prets`, `/api/public/sejour/{code}/prets`). Chaque déclaration est un vrai prêt (`PretService.declarer`), rattaché à la sortie, avec tous les contrôles du matériel (déjà prêté, échéances jusqu'à la fin du séjour, désinfection des détendeurs) ; `sejour_pret` (V84) garde le participant emprunteur et qui a déclaré. Tout participant déclare pour lui-même, élève compris (pas d'argent en jeu), sauf un détendeur : sa désinfection entre au journal légal (A322-81, A322-177) et s'atteste par un encadrant identifié ; un refus « déjà prêté » ne nomme pas l'emprunteur (mineurs) ; organisateurs et moniteurs inscrits pour les autres ; chacun annule ce qu'il a déclaré tant que ce n'est pas rendu. Un participant ne voit que ses emprunts, les encadrants tous. Le retour reste au directeur technique.
- **Conséquences** : les prêts « Déclaré depuis le séjour par … » apparaissent dans « Matériel », « Prêts », sans « prêté par ».

## Détendeur déclaré par son emprunteur, désinfecté au retour

- **Date** : 2026-10-23.
- **Contexte** : un participant ne trouvait pas les détendeurs dans la liste du matériel à déclarer : seuls l'organisateur et les moniteurs du séjour pouvaient en déclarer un, en attestant sa désinfection à la remise. Le club veut que chacun déclare aussi son détendeur, et qu'un moniteur atteste la désinfection au retour.
- **Décision** : les détendeurs sont proposés à tous les participants. Déclaré par l'emprunteur lui-même, le prêt porte `desinfection_au_retour` (V99_6) : rien n'est inscrit au journal à la remise ; au retour (« Matériel », « Prêts »), celui qui reçoit le matériel doit cocher « Le détendeur a été désinfecté au retour », inscrite au journal à la date du retour (422 sinon). Déclaré par l'organisateur ou un moniteur pour un autre, la désinfection s'atteste toujours à la déclaration.
- **Conséquences** : le prêt affiche « Désinfection au retour » dans les prêts en cours. L'attestation reste celle d'un encadrant identifié (le directeur technique ou l'ADMIN, seuls à noter un retour). Entre deux prêts, la désinfection se fait au retour plutôt qu'à la remise : un détendeur rendu d'un prêt ordinaire puis déclaré par un participant n'a pas été désinfecté entre les deux ; c'est au directeur technique de le désinfecter avant de le ranger.

## « Avez-vous emprunté du matériel ? » dans « Mon séjour »

- **Date** : 2026-10.
- **Contexte** : le club veut voir dans la carte « Mon séjour » le matériel emprunté, et y demander bien en vue à chacun s'il en a pris.
- **Décision** : tant que le participant n'a ni emprunt déclaré ni répondu, un encart orange pose la question : « Oui, je déclare mon matériel » (onglet « Matériel », fenêtre ouverte) ou « Non, je n'ai rien emprunté » (`sejour_participant.rien_emprunte`, V91, `PUT …/prets/rien-emprunte`, pour soi seulement). Ensuite une case « Matériel emprunté » : ses emprunts et le jour du retour, ou « Aucun ». Déclarer un emprunt retire « rien emprunté » ; l'inverse est refusé tant qu'un emprunt est déclaré. La carte et l'onglet partagent la même vue (`PretsDuSejour`).
- **Conséquences** : l'organisateur et les encadrants voient, sous les emprunts, qui a répondu « rien emprunté » et qui n'a pas encore répondu (`rienEmpruntePar`, `sansReponse`, vides pour un participant). Suite possible : relancer par e-mail.

## Jour de départ de l'aller, jour d'arrivée du retour

- **Date** : 2026-10.
- **Contexte** : un vol long (escale, décalage horaire) part deux jours avant l'arrivée ou arrive deux jours après le départ ; l'écran ne savait que deviner la veille (heure de départ plus tard que l'heure d'arrivée).
- **Décision** : `arrivee_date_depart` et `depart_date_arrivee` (V87), facultatifs : vides, on garde le jour du trajet et la déduction de la veille. Montrés seulement s'ils diffèrent du jour du trajet (fiche, « Un même vol pour plusieurs », « Mes informations », Mon séjour, carnet par e-mail, encart « Aujourd'hui »). L'encart s'ouvre dès le jour de départ saisi. Un avion qui arriverait un jour avant celui où il part est refusé (422, `Trajet.verifierJours`).

## Lieu d'arrivée du retour

- **Date** : 2026-10.
- **Contexte** : l'aller porte le lieu d'où part l'avion (V78), le retour seulement l'heure et le jour où il arrive ; pour savoir où aller chercher chacun au retour, il fallait l'écrire dans les remarques.
- **Décision** : `depart_lieu_arrivee` (V89), facultatif, saisi avec l'heure et le jour d'arrivée du retour (fiche, « Un même vol pour plusieurs », « Mes informations ») et montré partout où ils le sont (groupes de départs, Mon séjour, carnet écran et e-mail, encart « Aujourd'hui »). Un brouillon avait voulu le mettre dans V87 avec une reprise des jours devinés ; V87 publiée sans, il vient seul en V89, sans reprise.

## Montant, date et catégorie lus sur la photo de la note

- **Date** : 2026-10, demande du club.
- **Contexte** : on prend la photo de la note, puis on recopie à la main le total et la date qui y figurent.
- **Décision** : à la photo choisie dans « Ajouter une dépense », l'écran demande au serveur (`POST …/depenses/lecture-note`, aussi sous `/api/public/sejour/{code}`) le total, la date et la catégorie (choisie parmi celles des frais, d'après le commerçant et les achats) ; ils remplissent les cases encore vides (catégorie encore « Autre »), jamais ce qui est saisi, et restent à vérifier. Lecture par Claude (Anthropic) plutôt qu'un OCR embarqué (Tesseract) : les tickets froissés ou thermiques sont bien mieux lus, et trouver « le total » parmi sous-totaux, TVA et monnaie rendue demande de comprendre la note. Réservé à qui peut saisir la dépense (`ActeurFrais.peutAjouter`), rien n'est gardé. Facultatif par installation : `LECTURE_NOTES_CLE_API` vide = rien n'est proposé (`FraisVue.droits.lireNotes`).
- **Conséquences** : la photo de la note part chez Anthropic au moment de la lecture ; payant à l'usage (moins d'un centime par photo). Les tests remplacent le lecteur par un faux (`LectureNoteTest`).
- **Révision (octobre 2026, demande du club : pas d'IA obligatoire)** : lecture par défaut sur le téléphone, sans IA ni service extérieur ni frais. Tesseract.js (OCR libre, `ocr-ticket.ts`) tire le texte de la photo ; des règles testées (`lecture-ticket.ts`) y trouvent le total (lignes « Total », « Net à payer », « Montant », « CB », hors sous-total, TVA, monnaie rendue ; à défaut le plus gros montant), la première date valide et la catégorie par mots-clés. Programme et dictionnaire français (~4,6 Mo) servis par l'appli sous `/ocr/` (`angular.json`), téléchargés à la première photo seulement (groupe `ocr` paresseux du service worker), jamais d'un site extérieur. La lecture par Claude reste en option : avec `LECTURE_NOTES_CLE_API`, l'écran l'utilise d'abord et repasse à l'OCR si elle ne répond pas. Moins bon que l'IA sur les notes froissées ou pâlies : c'est accepté, la saisie reste à vérifier.
- **Révision (octobre 2026, demande du club : apprendre des corrections)** : après une lecture sur le téléphone, l'enregistrement envoie une leçon (`leconDuTicket`) : le commerçant (première ligne lisible du ticket), la catégorie choisie (sauf « Autre ») et, si le total lu a été corrigé, le libellé de la ligne qui portait le bon total. Table `regle_lecture_note` (V88), commune au club, une ligne par (commerçant, sorte, valeur) avec un compteur : la valeur la plus souvent apprise l'emporte, ce qui limite l'effet d'une erreur isolée. Ni photo, ni texte du ticket, ni montant, ni auteur. Appris et lu par qui peut saisir une dépense (`/api/sejours/{id}/lecture-notes/…`, et sous `/api/public/sejour/{code}`). Pas d'écran pour revoir ou effacer les règles : à faire si une règle fausse s'installe. Rien n'est appris d'une lecture par l'IA (pas de texte).

## Réservation des voyages : terminal, enregistrement, numéro de dossier

- **Date** : 2026-10, demande du club (capture de la page d'enregistrement d'Air Caraïbes à l'appui).
- **Contexte** : les vols n'étaient qu'une ligne de texte ; chacun cherchait dans ses mails le terminal, le jour où s'enregistrer et son numéro de dossier.
- **Décision** : chaque voyage porte un terminal de départ, l'ouverture de l'enregistrement en ligne, un numéro de dossier et un lien d'enregistrement (V96, http(s) seulement). Dans « Mon séjour », un voyage en avion, train, bateau ou car devient une carte (`CarteVoyageComponent`, calculs testés dans `voyage.ts`) : heures face à face, « +1 jour », terminal, compagnie reconnue au code IATA, « L'enregistrement ouvre le … » puis « Enregistrement ouvert », dossier à copier et bouton « S'enregistrer » (le lien collé, sinon le site de la compagnie). **Dossier et lien ne sont lus que par le voyageur et les organisateurs** (`Trajet.sansReservation`, filtré par le serveur), jamais imprimés, dans l'e-mail du seul voyageur : ils permettent de modifier ou d'annuler le billet. « Un même vol pour plusieurs » pose terminal et ouverture ; dossier et lien laissés vides gardent ceux de chacun.
- **Écarté pour l'instant** : lire en direct chez la compagnie le terminal, les retards et l'ouverture de l'enregistrement. Les compagnies n'ont pas d'interface publique ; il faudrait un service de données de vol (AeroDataBox, Aviationstack…), payant, avec une clé par installation. Le lien direct pré-rempli avec le dossier n'est pas fabriqué non plus : l'adresse de chaque compagnie change ; on colle celle du mail de réservation.
- **Révision (octobre 2026, demande du club)** : en avion, le conseil passe de 2 h à **3 h avant l'embarquement** (`MoyenTransport.AVION`, `AVANCES_TRANSPORT`), partout où il paraît (« Aujourd'hui », cartes de vol, carnet par e-mail). Le résumé `.claude/rules/sejour.md` dit encore 2 h : à corriger à la main (fichier protégé pour l'IA).

## Carte d'embarquement jointe au voyage

- **Date** : 2026-10, demande du club.
- **Contexte** : chacun cherchait sa carte d'embarquement dans ses mails ou ses fichiers au moment d'embarquer.
- **Décision** : une carte par voyage (aller, retour), PDF ou photo JPEG/PNG de 5 Mo au plus, signature du fichier vérifiée (V98, table `sejour_carte_embarquement`, `CartesEmbarquementService`). Elle se joint depuis la carte du vol de « Mon séjour », dans l'appli comme par le lien (`…/participants/{id}/cartes-embarquement/{sens}`, `/api/public/sejour/{code}/cartes-embarquement/{sens}`) ; une nouvelle remplace l'ancienne. Toute photo est recodée en JPEG par le téléphone (`envoiCarte`, `reduirePhoto`), ce qui retire sa position GPS ; un PDF part tel quel, servi en bac à sable (`Content-Security-Policy: sandbox`). **Lue et modifiée seulement par le voyageur et les organisateurs**, comme le dossier : elle porte son nom et permet d'embarquer ; `Trajet.carteEmbarquement` (le type) est retiré par `sansReservation`, le fichier refusé (403) à tout autre. Jamais imprimée ni envoyée par e-mail, jamais gardée en cache (`no-store`). Les organisateurs l'ouvrent depuis « Qui est dans ce vol ». Un voyage effacé emporte sa carte.
- **Révision (octobre 2026, demande du club : ne pas garder les cartes)** : **effacées le lendemain de la fin du séjour**, ou du retour du voyageur s'il rentre plus tard (`depart_date`, `depart_date_arrivee`), par une tâche de chaque nuit à 3 h 30 (`CartesEmbarquementService.effacerChaqueNuit`, première tâche planifiée de l'appli : `@EnableScheduling`). Une nuit manquée (serveur arrêté) est rattrapée la suivante. Les sauvegardes gardent la carte jusqu'à leur propre effacement.
- **Écarté** : lire le code-barres ou le vol sur la carte pour remplir le voyage ; la garder sur le téléphone sans réseau (le séjour demande le réseau) : le manuel conseille de garder aussi le PDF de la compagnie.

## Attestation d'assurance jointe par chaque participant

- **Date** : 2026-10, demande du club.
- **Contexte** : les organisateurs réclamaient l'attestation d'assurance de chacun par e-mail, et la cherchaient ensuite dans leur boîte.
- **Décision** : une attestation par participant, PDF ou photo JPEG/PNG de 5 Mo au plus, signature vérifiée (V99, table `sejour_attestation_assurance`, `AttestationsAssuranceService`, même contrôle que la carte d'embarquement). Elle se joint depuis « Mon séjour », dans l'appli comme par le lien (`…/participants/{id}/attestation-assurance`, `/api/public/sejour/{code}/attestation-assurance`) ; un organisateur peut aussi la joindre depuis la fiche du participant. Photo recodée par le téléphone (sans position GPS), PDF servi en bac à sable, `no-store`. **Lue et modifiée seulement par le participant et les organisateurs** : elle porte son nom, son adresse et son numéro de contrat ; `ParticipantVue.attestationAssurance` (le type) est vide pour tout autre (participants, moniteurs qui n'organisent pas), le fichier refusé (403), même pour un ADMIN. Jamais imprimée ni envoyée par e-mail. Les organisateurs voient « … sur … ont joint leur attestation d'assurance » dans l'onglet Participants ; tant qu'elle manque, « Mon séjour » s'ouvre sur un encart orange, comme la question sur le matériel, « Attestation d'assurance à joindre », avec le **conseil d'assurance du séjour** et le bouton d'ajout ; pas de ligne de plus dans « À compléter » (jugée peu ergonomique par le club). Le conseil : un texte écrit par l'organisateur dans l'onglet Participants (`sejour.conseil_assurance`, V99, `PUT …/conseil-assurance`, 2 000 caractères au plus), adresses http(s) rendues cliquables par l'écran et libellées du nom du site (`texte-liens.ts`), rien d'autre interprété. Vide : le message type, que « Reprendre le message type (Lafont) » remet aussi ; c'est celui du club : une assurance complémentaire (Loisir 1 minimum) fortement recommandée, à souscrire avec son numéro de licencié sur l'espace client de Lafont Assurances. Réglé par séjour plutôt qu'écrit dans l'appli (demande du club) : chaque organisateur, et chaque structure, garde son message. **Effacée le lendemain de la fin du séjour**, ou du retour du participant s'il rentre plus tard, par une tâche de chaque nuit (3 h 35), comme les cartes d'embarquement : le club qui doit la garder l'enregistre ailleurs.
- **Écarté** : lire sur l'attestation l'assureur, le contrat ou la date de fin de garantie ; la rendre obligatoire (rien n'est bloqué sans elle). L'attestation n'est pas une donnée de santé : elle reste hors des règles du CACI.

## Voir le séjour comme un participant

- **Date** : 2026-10, demande du club.
- **Contexte** : un organisateur ne savait pas ce que voient les participants, et sur place il voulait suivre le séjour comme les autres, sans tous les boutons d'organisation.
- **Décision** : « Voir comme un participant » dans le bandeau « Organisation », pour tout encadrant ; « Revenir à l'organisation » pour revenir. `GET /api/sejours/{id}?commeParticipant=true` renvoie le carnet (`SejourService.carnet`, même filtre que pour un participant) et les frais sans les droits d'organisateur. **Une vue seulement** : les droits d'écriture ne changent pas (le serveur les vérifie à chaque écriture), et l'écran relit la vue participant après chaque écriture. Le choix n'est pas gardé : chaque ouverture du séjour repart en mode organisation.

## Le séjour sans réseau

- **Date** : 2026-10-22, demande du club (« voir et gérer le séjour hors ligne »).
- **Contexte** : au gîte, sur l'île ou sur le bateau, le réseau manque ; le séjour était jusque-là « réseau obligatoire ».
- **Décision** : comme les fiches de sécurité, une copie pour lire et une file pour écrire, jamais un cache d'écriture (`FileSejourService`, logique pure `sejour-hors-ligne.ts`, base IndexedDB v4, magasins `sejour` et `refusSejour`).
  - Lecture : chaque séjour, la liste, le matériel emprunté et le carnet imprimable lus avec du réseau sont copiés sur le téléphone, et relus sur la copie faute de réseau (pas de réponse ou 5xx). Un 403 ou 404 efface la copie : ce qu'on n'a plus le droit de lire ne reste pas. « Préparer hors ligne » a une case « Séjours » (en cours ou à 30 jours). Encart « Hors ligne. Le séjour tel qu'il était … » en tête du séjour.
  - Écriture : participants, trajet commun, voitures, logements, affaires, programme, infos pratiques, conseil d'assurance, « Mes informations », dépenses et remboursements passent par la file, envoyés tout de suite avec du réseau, sinon gardés et montrés aussitôt (le séjour montré = copie + file ; comptes recalculés comme `FraisSejour`). Une entrée par cible, la dernière version au rang de la première ; un ajout a un id provisoire négatif, le modifier ou le supprimer avant l'envoi change ou retire l'ajout ; une fois envoyé, son vrai id remplace le provisoire dans ce qui suit (participant dans une voiture, une dépense).
  - Créations rejouables : en-tête `X-Reference-Client`, notée par `RejeuSejour` dans la transaction de la création (table `sejour_reference_client`, V99_2, supprimée avec la sortie) : une réponse perdue puis un nouvel envoi ne font pas de doublon ; une création refusée ne garde pas sa référence. Droits revérifiés à chaque envoi (`@PreAuthorize`).
  - Refus différé : au bandeau de synchronisation, avec le nom du séjour ; jamais absorbé.
- **Restent en ligne** : e-mails, organisateurs, « Inscrire un groupe », cartes d'embarquement et attestations (jamais copiées, `no-store`), photos et lecture des notes (une dépense gardée reçoit sa photo une fois envoyée), déclaration du matériel (un prêt se vérifie contre le serveur). La page du lien (`/sejour/{code}`) se lit sans réseau sur sa copie, effacée par « Se déconnecter » ou un jeton refusé ; elle n'écrit qu'avec le réseau.
- **Écarté** : rejouer les écritures de la page du lien hors ligne (jeton à part, file à part) ; à revoir si le club le demande.

## Frais avancés par le club

- **Date** : 2026-10-23, V99_3, demande du club.
- **Contexte** : pendant un séjour, le club avance des frais (bateau, gîte) que les participants lui remboursent ; jusque-là, seul un participant pouvait être le payeur.
- **Décision** : le club est un payeur possible, sans être un participant : `sejour_depense.payeur_id` null ; un remboursement `de_id` ou `a_id` null vient du club ou va au club (contrainte : jamais les deux). `FraisSejour` lui donne un solde (`participantId` null, après les participants) et le fait entrer dans les remboursements à faire, comme un participant ; il ne prend jamais de part d'une dépense. Choisir « Le club » comme payeur suit la règle d'un autre payeur : organisateurs et moniteurs du séjour (`pourLesAutres`) ; ce qu'on verse au club est noté par eux aussi (le club ne note rien lui-même). À l'écran, « Le club » dans « Payé par », « Qui a remboursé » et « À qui » ; « vous devez … au club » partout où le solde est rappelé (`remboursementsDe`), dans l'e-mail du carnet aussi.
- **Conséquences** : un id null signifie « le club » dans `FraisVue` (dépenses, remboursements faits, soldes, remboursements à faire) ; tout code qui lit ces ids doit le prévoir (comparer par `moi.equals(id)`, pas l'inverse).

## Trombinoscope du séjour exporté en image

- **Date** : 2026-10-24, demande du club.
- **Décision** : « Exporter en image » dans le trombinoscope du séjour, la même fenêtre que le trombinoscope du club (`ExportTrombinoscopeComponent`, dessin `core/image-trombinoscope.ts`) : PNG des cartes affichées (groupe choisi), titre proposé « nom du séjour — groupe », photos masquables par une icône, fabriqué dans le navigateur à partir des photos déjà chargées (aucune route nouvelle). **Créateur et organisateurs seulement** : ce sont eux qui recueillent les accords des photos du séjour ; le trombinoscope du club réserve de même l'export aux administrateurs.
- **Niveau des encadrants** (même demande) : sous un encadrant, à l'écran comme sur l'image, son niveau d'encadrement, et aussi son niveau de plongeur s'il est E1 (« E1 · N2 » : un E1 peut n'être que N2). Lus sur son compte (`utilisateur.niveau_encadrement`, `niveau_plongeur`), celui du participant ou du plongeur du groupe auquel il est lié ; montrés aussi aux participants, comme les aptitudes des palanquées.
- **Conséquence** : l'image sort de l'appli et n'est pas effacée après le séjour comme les photos d'invités ; le manuel demande de ne la partager qu'avec l'accord des personnes.

## Liste de courses

- **Date** : 2026-10-24, demande du club (« une liste des courses selon la destination, le nombre de personnes et les habitudes alimentaires, sans les jours au restaurant »).
- **Décision** : onglet « Courses » pour les encadrants (qui voient déjà les régimes). Seuls les repas pris au restaurant sont stockés (`sejour_repas_au_restaurant`, V99_7 : jour et petit-déjeuner, déjeuner ou dîner), choisis par le créateur et les organisateurs (`PUT /api/sejours/{id}/repas`, liste remplacée d'un bloc, 422 hors des dates de la sortie) ; lus par les encadrants (`GET …/repas`, 403 pour un élève). La liste elle-même est **calculée sur le téléphone, jamais stockée** (`liste-courses.ts`, testé à part) : pour chaque repas préparé, les présents à son heure (8 h, 12 h 30, 19 h 30) selon l'arrivée et le départ du participant, sans heure toute la journée ; une assiette moyenne par personne qui suit ses régimes (le plus strict l'emporte pour la protéine : végétalien, végétarien, pescétarien, halal, casher ; sans porc : la viande proposée n'en a pas) ; quantités arrondies au-dessus, rayon par rayon, plus les produits de base à vérifier sur place.
- **La destination** ne change pas le calcul : elle donne le titre et les dates ; ce que le lieu ou le logement fournit se corrige à la main. *Pourquoi :* rien de fiable à en déduire sans saisie de plus.
- Cases « dans le chariot » sur l'écran seulement ; « Copier la liste » la met en texte. Réseau obligatoire.

## Menu du restaurant : chacun choisit, l'organisateur commande

- **Date** : 2026-10-24, demande du club (« importer un fichier xls des menus, généré à partir d'un prompt ; chaque participant choisit ce qu'il veut, l'organisateur a la commande complète »).
- **Décision** : onglet « Restaurant » dans le séjour et sur la page du lien. Un menu par repas (`sejour_menu`, V99_8 : jour, repas, restaurant ; `sejour_menu_plat` : catégorie, nom, description, prix en centimes facultatif, rang du fichier ; `sejour_menu_choix` : plat × participant). Le créateur et les organisateurs importent un classeur **.xlsx ou .xls** (`POST /api/sejours/{id}/menus`, multipart, 422 hors des dates ou fichier illisible), lu par `LecteurMenu` (POI) : première feuille, une ligne d'en-tête « Catégorie | Plat | Description | Prix » cherchée dans les 20 premières lignes (accents et majuscules indifférents, seule « Plat » obligatoire), lignes sans plat ignorées, prix « 12,50 € » ou nombre (illisible : sans prix), 300 plats au plus. Le fichier se fabrique avec le **prompt donné par l'écran** (`PROMPT_MENU`), à coller dans une IA avec la photo du menu : rien n'est envoyé à une IA par l'appli. Réimporter un repas remplace son menu et **efface ses choix** (l'écran prévient) ; le repas devient « pris au restaurant » pour la liste de courses.
- **Choix** : le participant pour lui-même (`PUT …/menus/{menuId}/choix/{participantId}`, ou `PUT /api/public/sejour/{code}/menus/{menuId}/choix` par le lien), un organisateur pour tout participant (enfant, invité sans e-mail) ; plusieurs plats possibles, aucune quantité ni commentaire libre (pas de porte d'entrée à une donnée de santé : une allergie se dit à l'organisateur, hors de l'appli). Un plat d'un autre menu : 422.
- **Qui lit quoi** : menus lus par les encadrants et les participants du séjour (403 pour un élève qui n'y est pas) ; chacun ne reçoit que son choix (`monChoix`) ; **la commande complète** (`commande` : nombre par plat, choix et total de chacun, qui n'a pas choisi, total) **seulement pour le créateur et les organisateurs, filtrée par le serveur** (null pour les autres, même un ADMIN ; masquée aussi en « Voir comme un participant »). « Copier la commande » la met en texte pour le restaurant, **en prénom et initiale du nom seulement, sans la liste de ceux qui n'ont pas choisi** : ce texte sort du club et des mineurs sont suivis (relecture « données personnelles »).
- **Écarté** : relier les prix aux frais du séjour (l'addition réelle se saisit dans « Frais ») ; clore les choix à une date (l'organisateur commande quand il veut ; à revoir si le club le demande) ; lire la photo du menu dans l'appli par une IA (coût, et le prompt suffit).

## Fiches de sécurité du séjour (octobre 2026)

- **Demande du club** : gérer les fiches de sécurité d'un séjour depuis sa page. Onglet « Fiches de sécurité » (`SejourFichesSecuriteComponent`), encadrants qui lisent les fiches (`GET /api/sejours/{id}/fiches-securite`, MONITEUR ou ADMIN, comme la fiche elle-même : un directeur technique seul ne voit pas l'onglet), réseau obligatoire, caché en « Voir comme un participant ».
- **Une ligne par plongée de la sortie** et l'état de sa fiche (à établir, établie, complétée au retour, signée), lus en SQL (`FichesSecuriteSejourService`). Établir, compléter, signer et imprimer passent par les écrans et les droits habituels de la fiche, sans les recopier : `?sejour=` dans l'adresse fait revenir leur « ← Séjour » à l'onglet (`navigation.ts`, `?onglet=fiches`).
- **Ajouter une plongée** (`POST …/plongees`) : une séance dans les dates du séjour, rattachée à la sortie ; n° de plongée suivant du jour par défaut. **La supprimer** (`DELETE …/plongees/{seanceId}`) : la séance elle-même, refusé (422) dès qu'elle a une fiche, une présence ou une évaluation ; 404 pour une plongée d'une autre sortie. Les deux : **créateur et organisateurs du séjour** (`@droitsSejour.organise`), comme le reste du séjour, alors que rattacher des séances à une sortie reste à l'ADMIN et au DT (`/admin/sorties`).
- **Supprimer une fiche reste réservé à l'ADMIN** (règle existante, test `FicheSecuriteTest`) : le bouton n'apparaît que pour lui. Tests : `FichesSecuriteSejourTest`.
- **Écarté pour l'instant** : modifier une plongée depuis l'onglet (date, site, profondeur), qui se fait dans l'administration des séances.

## Entrer sans le lien, depuis la page de connexion (2026-10-25)

- **Demande du club** : un participant sans compte (élève, parent, invité) qui n'a plus l'e-mail de l'organisateur entre par la page de connexion : « Participant à un séjour ? Entrer avec un code reçu par e-mail », son e-mail, puis le code à 6 chiffres. `EntreeSejourController` (`POST /api/public/sejours/code`, `/connexion`), même code, mêmes règles (10 min, 5 essais, un envoi par minute) que la page du lien.
- **Quel séjour** : celui en cours ou le prochain de cet e-mail, sinon le dernier fini (tant que le jeton y est encore possible, 60 jours) ; seulement ceux dont la demande d'informations est partie (adresse tirée) et pas pour un encadrant, qui passe par « Séjours ». Plusieurs séjours : les autres par le lien de leur e-mail.
- **L'adresse secrète du séjour n'est rendue qu'après le bon code**, avec le jeton : la réponse à la demande de code reste la même (204) que l'e-mail soit connu ou non, et tout code refusé reçoit le même message (« Code incorrect ou expiré »), sans l'indice « vérifiez les 6 chiffres » de la page du lien. *Pourquoi :* ici un e-mail suffit, sans le secret de l'adresse. Choix du séjour départagé par l'id de la sortie, pour que demande et connexion tombent sur le même. *Reste à décider avec le club :* aucune limite par adresse IP ; quelqu'un qui connaît un e-mail peut faire envoyer un code par minute et épuiser les 5 essais. *Écarté :* rediriger vers la page du lien dès l'e-mail tapé, qui aurait livré l'adresse du séjour à quiconque connaît un e-mail de participant. La page de connexion pose le jeton (`cleJetonLienSejour`) et ouvre `/sejour/{code}`, déjà connectée. Tests : `EntreeSejourSansLienTest`.

## Démonstrations

- V117 : séjour à Port-Cros, juin 2027, Camille y participe.
- V118 : frais de démonstration.
- V120 : le séjour de démo est créé par `e3@club.fr`, sans organisateur désigné.
- V121 : palanquées de démonstration.
- V126 : réservation des vols de Camille (terminal, ouverture de l'enregistrement, dossier fictif).
- V128 : carte d'embarquement fictive (petit PDF) du vol aller de Flora.
- V129 : attestation d'assurance fictive (petit PDF) de Flora, et le message type comme conseil d'assurance du séjour.
- V130 : le bateau du samedi avancé par le club (240 €, partagé entre les plongeurs).
- V132 : deux repas au restaurant (dîner du samedi 5, déjeuner du dimanche 6 juin).
- V133 : le menu de La Trinquette pour le dîner du samedi 5 juin, où Camille a déjà choisi.
