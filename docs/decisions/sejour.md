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

## Démonstrations

- V117 : séjour à Port-Cros, juin 2027, Camille y participe.
- V118 : frais de démonstration.
- V120 : le séjour de démo est créé par `e3@club.fr`, sans organisateur désigné.
- V121 : palanquées de démonstration.
