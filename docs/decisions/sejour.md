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

## Démonstrations

- V117 : séjour à Port-Cros, juin 2027, Camille y participe.
- V118 : frais de démonstration.
- V120 : le séjour de démo est créé par `e3@club.fr`, sans organisateur désigné.
- V121 : palanquées de démonstration.
