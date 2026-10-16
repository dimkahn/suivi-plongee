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

## Jour de départ de l'aller, jour d'arrivée du retour

- **Date** : 2026-10.
- **Contexte** : un vol long (escale, décalage horaire) part deux jours avant l'arrivée ou arrive deux jours après le départ ; l'écran ne savait que deviner la veille (heure de départ plus tard que l'heure d'arrivée).
- **Décision** : `arrivee_date_depart` et `depart_date_arrivee` (V87), facultatifs : vides, on garde le jour du trajet et la déduction de la veille. Montrés seulement s'ils diffèrent du jour du trajet (fiche, « Un même vol pour plusieurs », « Mes informations », Mon séjour, carnet par e-mail, encart « Aujourd'hui »). L'encart s'ouvre dès le jour de départ saisi. Un avion qui arriverait un jour avant celui où il part est refusé (422, `Trajet.verifierJours`).

## Montant et date lus sur la photo de la note

- **Date** : 2026-10, demande du club.
- **Contexte** : on prend la photo de la note, puis on recopie à la main le total et la date qui y figurent.
- **Décision** : à la photo choisie dans « Ajouter une dépense », l'écran demande au serveur (`POST …/depenses/lecture-note`, aussi sous `/api/public/sejour/{code}`) le total et la date ; ils remplissent les cases encore vides, jamais ce qui est saisi, et restent à vérifier. Lecture par Claude (Anthropic) plutôt qu'un OCR embarqué (Tesseract) : les tickets froissés ou thermiques sont bien mieux lus, et trouver « le total » parmi sous-totaux, TVA et monnaie rendue demande de comprendre la note. Réservé à qui peut saisir la dépense (`ActeurFrais.peutAjouter`), rien n'est gardé. Facultatif par installation : `LECTURE_NOTES_CLE_API` vide = rien n'est proposé (`FraisVue.droits.lireNotes`).
- **Conséquences** : la photo de la note part chez Anthropic au moment de la lecture ; payant à l'usage (moins d'un centime par photo). Les tests remplacent le lecteur par un faux (`LectureNoteTest`).

## Démonstrations

- V117 : séjour à Port-Cros, juin 2027, Camille y participe.
- V118 : frais de démonstration.
- V120 : le séjour de démo est créé par `e3@club.fr`, sans organisateur désigné.
- V121 : palanquées de démonstration.
