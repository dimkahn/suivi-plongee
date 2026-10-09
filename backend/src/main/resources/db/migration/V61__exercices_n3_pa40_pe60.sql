-- ============================================================
--  Base d'exercices du N3 (MFT PA40 | PE60 | PA60, decembre 2025) :
--  7 competences, 9 exercices chacune (3 d'initiation, 3 de
--  perfectionnement, 3 de maitrise), soit 63 exercices.
--
--  Numeros N.1 a N.9 dans l'ordre des blocs de V8 (1 a 3 PA40,
--  4 PE60, 5 et 6 competences complementaires N3, 7 commune). Le bloc
--  8 (connaissances theoriques PA40 - N3, transverse) n'a pas
--  d'exercice propre.
--
--  Cadre du MFT respecte : enseignement et validation dans l'espace
--  0-40 m par un E3 minimum ; la zone 40-60 m seulement sous la
--  responsabilite d'un E4, de facon progressive. Le N3 s'obtient en
--  milieu naturel (referentiel milieu_naturel_exclusif) : une note en
--  piscine ou en fosse, meme sur un exercice de maitrise, n'est qu'un
--  suivi d'entrainement (EvaluationService.estEntrainement). D'ou des
--  exercices de maitrise tous decrits en milieu naturel.
--
--  Chaque exercice est relie aux criteres qu'il travaille (seconde
--  requete) ; chaque critere a au moins un exercice de maitrise.
--
--  Ensuite, la base se modifie depuis l'ecran /admin/exercices :
--  ne pas retoucher ce fichier une fois applique.
-- ============================================================

INSERT INTO exercice_competence (bloc_id, numero, ordre, phase, intitule, deroulement, critere_reussite)
SELECT b.id, v.numero, v.ordre, v.phase, v.intitule, v.deroulement, v.critere_reussite
  FROM bloc_competence b
  JOIN referentiel r ON r.id = b.referentiel_id
  JOIN (VALUES
    -- ---------- Competence 1 : Planifier la plongee (PA40) ----------
    (1, '1.1', 1, 'INITIATION', 'Lire les consignes du DP',
     'Au sec, à partir d''un briefing de DP pour une plongée dans la zone 20-40 m. L''élève reformule : profondeur et temps de plongée, consignes de paliers et de retour en surface, informations sur le site.',
     'Toutes les consignes reformulées sans erreur.'),
    (1, '1.2', 2, 'INITIATION', 'Étudier le site',
     'Au sec, sur la carte ou le croquis du site. Relief, courant, profondeurs, mouillage. L''élève choisit ses moyens d''orientation : instrument et repères naturels.',
     'Contraintes du site repérées, orientation choisie et justifiée.'),
    (1, '1.3', 3, 'INITIATION', 'Calculs pour la zone 20-40 m',
     'Au sec. Consommation en profondeur et au palier, en litres puis en bars par minute ; autonomie et réserve. Incidence des GF sur les paliers. Les calculs servent à comprendre.',
     'Calculs justes, autonomie déduite.'),
    (1, '1.4', 4, 'PERFECTIONNEMENT', 'Profil avec des ordinateurs différents',
     'Au sec. La palanquée passe ses ordinateurs en mode planification pour le profil prévu, compare les paliers et retient la procédure commune.',
     'Le moyen le plus contraignant est identifié et suivi.'),
    (1, '1.5', 5, 'PERFECTIONNEMENT', 'Protocole de consommation et de retour',
     'Au sec puis en plongée. La palanquée fixe ses annonces (mi-pression, réserve) et son retour en surface, ordinaire ou avec incident (remontée sur parachute, panne d''air).',
     'Protocole décidé ensemble et appliqué en plongée.'),
    (1, '1.6', 6, 'PERFECTIONNEMENT', 'Planifier un parcours orienté',
     'Milieu naturel, 20 à 30 m. La palanquée planifie un parcours avec ses repères et ses caps, le réalise et revient près du mouillage. Débriefing des écarts.',
     'Parcours conforme au plan, retour au mouillage.'),
    (1, '1.7', 7, 'MAITRISE', 'Présenter et argumenter une planification',
     'Milieu naturel, plongée dans la zone 20-40 m. Avant la mise à l''eau, l''élève présente au moniteur la planification de la palanquée et la justifie : profil, paramètres, orientation, procédures, retour.',
     'Planification complète, argumentée, dans le cadre du DP.'),
    (1, '1.8', 8, 'MAITRISE', 'Consignes changées par le DP',
     'Milieu naturel. Le DP modifie ses consignes avant la plongée (profondeur réduite, temps limité, courant) : la palanquée replanifie et l''expose.',
     'Nouvelle planification conforme et réaliste.'),
    (1, '1.9', 9, 'MAITRISE', 'Planification sur un site inconnu',
     'Milieu naturel, site nouveau pour la palanquée. Recherche d''informations, choix de l''orientation, calculs de consommation adaptés à la zone d''évolution.',
     'Plan adapté au site, réalisé sans écart majeur.'),

    -- ---------- Competence 2 : Evoluer en autonomie (PA40) ----------
    (2, '2.1', 1, 'INITIATION', 'Orientation : instrument et milieu',
     'Milieu naturel, 10 à 20 m. Parcours aller-retour en combinant le compas, le relief, le courant et la lumière.',
     'Retour au point de départ.'),
    (2, '2.2', 2, 'INITIATION', 'Surveillance mutuelle',
     'Au sec puis en immersion. Codes de communication, place de chacun dans la palanquée, contrôle visuel régulier des équipiers et de leurs paramètres.',
     'Équipiers contrôlés sans rappel.'),
    (2, '2.3', 3, 'INITIATION', 'Ordinateur : cas concrets',
     'Au sec, sur des captures d''écran. Lecture des paramètres et repérage des profils à risque : profils inversés, yoyo, plongées successives.',
     'Chaque cas lu et commenté justement.'),
    (2, '2.4', 4, 'PERFECTIONNEMENT', 'Parcours varié en autonomie',
     'Milieu naturel, 20 à 30 m, moniteur en retrait. Parcours par points remarquables, palanquée groupée, retour à proximité du bateau.',
     'Itinéraire tenu, retour près du bateau.'),
    (2, '2.5', 5, 'PERFECTIONNEMENT', 'Faire face à un imprévu',
     'Milieu naturel. Le moniteur annonce un imprévu : équipier qui a froid, visibilité réduite, matériel défaillant. La palanquée adapte le déroulement de la plongée.',
     'Décision rapide, adaptée, partagée.'),
    (2, '2.6', 6, 'PERFECTIONNEMENT', 'Paliers en pleine eau sous parachute',
     'Milieu naturel. Remontée en pleine eau : parachute lancé, vitesse et paliers du moyen le plus contraignant, arrêt et tour d''horizon à 3 m.',
     'Vitesse et paliers respectés, palanquée groupée.'),
    (2, '2.7', 7, 'MAITRISE', 'Plongée autonome proche de 40 m',
     'Milieu naturel, au moins deux situations différentes. La palanquée évolue en autonomie près de 40 m : orientation, communication, surveillance, gestion de la désaturation, retour au bateau.',
     'Plongée menée sans intervention du moniteur.'),
    (2, '2.8', 8, 'MAITRISE', 'Désaturation dans une palanquée mixte',
     'Milieu naturel. Palanquée aux moyens de désaturation différents : vitesse, paliers et cohésion jusqu''en surface, paliers signalés au parachute.',
     'Procédure commune respectée par tous.'),
    (2, '2.9', 9, 'MAITRISE', 'Analyse de captures d''ordinateur',
     'Oral, à partir de cas concrets et de captures d''écran. L''élève dit ce qu''il ferait dans chaque situation.',
     'Comportement proposé adapté à chaque cas.'),

    -- ---------- Competence 3 : Intervenir et porter assistance (PA40) ----------
    (3, '3.1', 1, 'INITIATION', 'Reconnaître une difficulté en profondeur',
     'Au sec puis en plongée. Signes conventionnels et manifestations sans signe : ventilation anormale, agitation, perte de vigilance, inconscience.',
     'Chaque situation reconnue et nommée.'),
    (3, '3.2', 2, 'INITIATION', 'Assistance au gilet depuis 20 m',
     'Milieu naturel, 20 m. Prise en charge, remontée au gilet à vitesse régulière, arrêt marqué entre 5 et 3 m.',
     'Prise ferme, vitesse régulière, arrêt marqué.'),
    (3, '3.3', 3, 'INITIATION', 'Nage capelée progressive',
     'En surface, capelé : 150 à 200 m, à allure régulière, sans chronomètre.',
     'Parcours fini sans essoufflement.'),
    (3, '3.4', 4, 'PERFECTIONNEMENT', 'Assistance depuis 30 m',
     'Milieu naturel, 30 m. Remontée assistée à une vitesse adaptée aux moyens de désaturation, arrêt marqué entre 5 et 3 m, surface.',
     'Vitesse régulée jusqu''à l''arrêt.'),
    (3, '3.5', 5, 'PERFECTIONNEMENT', 'Sortir rapidement de la zone profonde',
     'Milieu naturel, depuis 40 m. Départ rapide jusqu''à 30 m environ, puis régulation de la vitesse jusqu''à l''arrêt entre 5 et 3 m.',
     'Vitesse reprise en main dès 30 m.'),
    (3, '3.6', 6, 'PERFECTIONNEMENT', 'Panne d''air à 30 m',
     'Milieu naturel, 30 m. Passage de l''octopus, stabilisation, puis remontée assistée.',
     'Octopus donné aussitôt, remontée maîtrisée.'),
    (3, '3.7', 7, 'MAITRISE', 'Assistance à 40 m : première situation',
     'Milieu naturel, à 40 m, en fin de formation, au moins deux fois. Interprétation, prise en charge rapide, remontée régulière à vitesse adaptée, arrêt marqué entre 5 et 3 m, sortie d''eau sécurisée. Gilets privilégiés, palmage autorisé.',
     'Interprétation juste, prise en charge rapide et efficace.'),
    (3, '3.8', 8, 'MAITRISE', 'Assistance à 40 m : seconde situation',
     'Milieu naturel, à 40 m, au moins deux fois. Situation différente de 3.7 (par exemple panne d''air ou perte de vigilance), réalisée intégralement.',
     'Situation réalisée en entier, arrêt marqué, sortie sûre.'),
    (3, '3.9', 9, 'MAITRISE', 'Nage capelée de 300 m',
     'Milieu naturel, en surface, capelé : 300 m. Pas d''épreuve chronométrée.',
     'Parcours fini en bonnes conditions physiques.'),

    -- ---------- Competence 4 : S'adapter a la profondeur (PE60) ----------
    (4, '4.1', 1, 'INITIATION', 'Stabilisation à 30 m',
     'Milieu naturel, 30 m. Stabilisation au gilet puis au poumon ballast, palmes immobiles, en tenant compte de l''écrasement de la combinaison.',
     'Profondeur tenue sans palmer.'),
    (4, '4.2', 2, 'INITIATION', 'Réviser les techniques du PE40',
     'Milieu naturel, 20 à 30 m. Ventilation, vidage de masque, lâcher et reprise d''embout, communication avec le guide, intervention en relais.',
     'Gestes réalisés sans stress.'),
    (4, '4.3', 3, 'INITIATION', 'Sensations en profondeur',
     'Milieu naturel, descente progressive vers 35 m avec le guide. L''élève signale son ressenti : narcose, froid, essoufflement.',
     'Ressenti analysé et signalé.'),
    (4, '4.4', 4, 'PERFECTIONNEMENT', 'Descente et remontée équilibrées jusqu''à 40 m',
     'Milieu naturel, 40 m au plus. Arrêts aux profondeurs annoncées, évolution équilibrée au fond, remontée et palier.',
     'Chaque arrêt tenu à ± 1 m.'),
    (4, '4.5', 5, 'PERFECTIONNEMENT', 'Communiquer en zone profonde',
     'Milieu naturel, 35 à 40 m. Le guide demande pression, paliers, état ; l''élève répond et annonce spontanément ses seuils.',
     'Annonces claires, sans être sollicité.'),
    (4, '4.6', 6, 'PERFECTIONNEMENT', 'Relais en zone profonde',
     'Milieu naturel, 35 à 40 m. Intervention en relais auprès d''un équipier jusqu''à l''arrivée du guide, sans descendre.',
     'Profondeur gardée, équipier pris en charge.'),
    (4, '4.7', 7, 'MAITRISE', 'Évaluation à 40 m au plus',
     'Milieu naturel, par un E3, à 40 m au plus. Stabilisation à toutes les étapes de la plongée et mise en œuvre de l''ensemble des techniques.',
     'Stabilité constante, techniques sûres.'),
    (4, '4.8', 8, 'MAITRISE', 'Plongée encadrée entre 40 et 60 m',
     'Milieu naturel, encadrée par un E4, profondeur augmentée progressivement d''une plongée à l''autre. Contrôle de la consommation, communication, stabilisation, retour.',
     'Comportement identique à celui du PE40, adapté à la profondeur.'),
    (4, '4.9', 9, 'MAITRISE', 'Consommation et désaturation en zone profonde',
     'Milieu naturel, encadrée. L''élève suit sa consommation et sa désaturation, prévient le guide de chaque seuil et respecte le retour prévu.',
     'Aucun seuil franchi sans annonce.'),

    -- ---------- Competence 5 : Organiser la plongee (N3) ----------
    (5, '5.1', 1, 'INITIATION', 'Météo et choix du site',
     'Au sec. Lecture d''un bulletin (vent, houle, courant, marée) et d''une carte ; restrictions de mouillage, zones protégées ou interdites.',
     'Site retenu ou écarté avec de bonnes raisons.'),
    (5, '5.2', 2, 'INITIATION', 'Matériel de secours',
     'Au sec. Vérification du matériel de secours et d''oxygénothérapie et des moyens de communication, en lien avec le RIFA Plongée.',
     'Matériel complet et en état, manque signalé.'),
    (5, '5.3', 3, 'INITIATION', 'Rédiger une fiche de sécurité',
     'Au sec. Fiche de sécurité d''une sortie fictive : palanquées, paramètres prévus, heures, moyens d''alerte.',
     'Fiche complète et lisible.'),
    (5, '5.4', 4, 'PERFECTIONNEMENT', 'Comparer deux sites',
     'Sur le terrain, avec le moniteur. Deux sites possibles selon la météo du jour : courant, abri, mouillage, profondeurs.',
     'Choix argumenté et prudent.'),
    (5, '5.5', 5, 'PERFECTIONNEMENT', 'Embarcation et surveillance de surface',
     'Milieu naturel. Vérification de la conformité de l''embarcation, pavillon alpha, surveillance de surface et rotation des palanquées.',
     'Dispositif en place avant la première mise à l''eau.'),
    (5, '5.6', 6, 'PERFECTIONNEMENT', 'Plan de secours',
     'Au sec ou sur site. Scénario d''accident : alerte, oxygène, communication, évacuation.',
     'Rôles et gestes de chacun clairs.'),
    (5, '5.7', 7, 'MAITRISE', 'Organiser une plongée du bord',
     'Milieu naturel, première situation. Organisation complète d''une plongée dans la zone 0-40 m sans DP : site, conditions, fiche de sécurité, matériel de secours.',
     'Organisation faisable et pertinente.'),
    (5, '5.8', 8, 'MAITRISE', 'Organiser une plongée en bateau',
     'Milieu naturel, deuxième situation, depuis une embarcation : mouillage, pavillon alpha, surveillance de surface, rotation des palanquées.',
     'Organisation faisable et pertinente.'),
    (5, '5.9', 9, 'MAITRISE', 'Conditions qui changent',
     'Milieu naturel, troisième situation. Vent, houle ou courant évoluent : l''élève adapte l''organisation ou renonce, et l''explique.',
     'Décision prudente et justifiée.'),

    -- ---------- Competence 6 : Evoluer en autonomie 0-60 m (N3) ----------
    (6, '6.1', 1, 'INITIATION', 'Orientation sur parcours variés',
     'Milieu naturel, 20 à 30 m. Parcours à plusieurs caps, avec instrument et repères naturels.',
     'Parcours suivi, retour au point prévu.'),
    (6, '6.2', 2, 'INITIATION', 'Préparer une plongée profonde',
     'Au sec. Consommation en profondeur et au palier, mode planification de l''ordinateur, conservatisme (GF bas = GF haut entre 85 et 90 % à l''air).',
     'Paramètres et réserve justes.'),
    (6, '6.3', 3, 'INITIATION', 'Co-gestion de la palanquée',
     'Au sec puis en plongée. Briefing entre équipiers : rôles, signes, surveillance, conduite en cas d''imprévu.',
     'Chacun connaît son rôle.'),
    (6, '6.4', 4, 'PERFECTIONNEMENT', 'Parcours orienté à 35-40 m',
     'Milieu naturel, 35 à 40 m. Parcours orienté en autonomie, consommation et paramètres contrôlés.',
     'Itinéraire tenu, contrôles réguliers.'),
    (6, '6.5', 5, 'PERFECTIONNEMENT', 'Désaturation après une plongée à 40 m',
     'Milieu naturel. Gestion des paliers d''une palanquée aux moyens différents après une plongée près de 40 m.',
     'Paliers du moyen le plus contraignant respectés.'),
    (6, '6.6', 6, 'PERFECTIONNEMENT', 'Risques accrus en profondeur',
     'Milieu naturel. Un équipier simule narcose, froid ou essoufflement : la palanquée réagit et adapte la plongée.',
     'Réaction adaptée, plongée sécurisée.'),
    (6, '6.7', 7, 'MAITRISE', 'Autonomie à 40 m comme entre 40 et 60 m',
     'Milieu naturel, à 40 m au plus, au moins deux situations différentes. Le comportement attendu est celui de la zone 40-60 m : consommation, désaturation, risques accrus, co-gestion.',
     'Comportement aux exigences de la zone 40-60 m.'),
    (6, '6.8', 8, 'MAITRISE', 'Vers 60 m sous la responsabilité d''un E4',
     'Milieu naturel, en présence d''un DP, sous la responsabilité d''un E4, profondeur augmentée progressivement. Communication et co-gestion de la palanquée, gestion de la désaturation.',
     'Plongée menée avec rigueur, aucune consigne dépassée.'),
    (6, '6.9', 9, 'MAITRISE', 'Retour en surface d''une plongée profonde',
     'Milieu naturel. Consommation suivie, remontée à la vitesse prévue, paliers, parachute, arrêt et tour d''horizon à 3 m, retour près du bateau.',
     'Retour conforme au plan, palanquée groupée.'),

    -- ---------- Competence 7 : Respecter le milieu et l'environnement (commune) ----------
    (7, '7.1', 1, 'INITIATION', 'Stabilisation fine en profondeur',
     'Milieu naturel, 20 à 30 m. Stabilisation au-dessus d''un fond fragile, sans appui, palmes immobiles.',
     'Aucun contact avec le fond.'),
    (7, '7.2', 2, 'INITIATION', 'Espèces et dangers du milieu',
     'Au sec. Espèces courantes du site, espèces protégées, dangers du milieu. Rappel de la Charte internationale du plongeur responsable.',
     'Espèces reconnues, dangers cités.'),
    (7, '7.3', 3, 'INITIATION', 'Éclairage et discrétion',
     'Milieu naturel. Lampe orientée à côté des animaux, déplacements lents et silencieux, aucun nourrissage.',
     'Aucun animal dérangé.'),
    (7, '7.4', 4, 'PERFECTIONNEMENT', 'Le long d''un tombant à 30 m',
     'Milieu naturel, 30 m. Évolution à 1 m d''un tombant ou d''une épave, sans contact.',
     'Trajectoire stable, aucun contact.'),
    (7, '7.5', 5, 'PERFECTIONNEMENT', 'Observer en palanquée autonome',
     'Milieu naturel. La palanquée autonome montre des espèces sans les poursuivre ni les toucher.',
     'Observation discrète, palanquée groupée.'),
    (7, '7.6', 6, 'PERFECTIONNEMENT', 'Palmage adapté au milieu',
     'Milieu naturel. Palmage de grenouille et recul près des fonds sensibles et dans les zones de sédiments.',
     'Aucun nuage de sédiment.'),
    (7, '7.7', 7, 'MAITRISE', 'Plongée d''observation',
     'Milieu naturel. Plongée consacrée à l''observation ; en surface, l''élève décrit et nomme les espèces vues.',
     'Aucun contact, espèces nommées et décrites.'),
    (7, '7.8', 8, 'MAITRISE', 'Milieu fragile en zone profonde',
     'Milieu naturel : coralligène, gorgones, épave. Évolution sur toute la plongée, au fond comme au palier.',
     'Aucune dégradation.'),
    (7, '7.9', 9, 'MAITRISE', 'Comportement sur toutes les plongées',
     'Milieu naturel, tout au long de la formation. Discrétion, absence de nourrissage et de prélèvement, éclairage limité ; bilan au débriefing.',
     'Comportement respectueux et responsable sur toutes les plongées.')
  ) AS v(bloc_ordre, numero, ordre, phase, intitule, deroulement, critere_reussite)
    ON v.bloc_ordre = b.ordre
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)';

INSERT INTO exercice_competence_critere (exercice_id, critere_id)
SELECT e.id, c.id
  FROM exercice_competence e
  JOIN bloc_competence b ON b.id = e.bloc_id
  JOIN referentiel r ON r.id = b.referentiel_id
  JOIN critere c ON c.bloc_id = b.id
  JOIN (VALUES
    -- Planifier : 1 directives du DP, 2 topologie et orientation, 3 profil et procédures
    ('1.1', 1), ('1.2', 2), ('1.3', 3), ('1.4', 3), ('1.5', 1), ('1.5', 3), ('1.6', 2),
    ('1.7', 1), ('1.7', 2), ('1.7', 3), ('1.8', 1), ('1.8', 3), ('1.9', 2), ('1.9', 3),
    -- Évoluer en autonomie (PA40) : 1 orientation, 2 évolution subaquatique, 3 désaturation
    ('2.1', 1), ('2.2', 2), ('2.3', 3), ('2.4', 1), ('2.4', 2), ('2.5', 2), ('2.6', 3),
    ('2.7', 1), ('2.7', 2), ('2.7', 3), ('2.8', 3), ('2.9', 3),
    -- Porter assistance : 1 observation, compréhension et réaction
    ('3.1', 1), ('3.2', 1), ('3.3', 1), ('3.4', 1), ('3.5', 1), ('3.6', 1), ('3.7', 1), ('3.8', 1), ('3.9', 1),
    -- S'adapter à la profondeur : 1 stabilisation, 2 autres techniques
    ('4.1', 1), ('4.2', 2), ('4.3', 2), ('4.4', 1), ('4.5', 2), ('4.6', 2),
    ('4.7', 1), ('4.7', 2), ('4.8', 1), ('4.8', 2), ('4.9', 2),
    -- Organiser : 1 choix du site, 2 conditions de la plongée, 3 sécurisation
    ('5.1', 1), ('5.2', 3), ('5.3', 3), ('5.4', 1), ('5.5', 2), ('5.5', 3), ('5.6', 3),
    ('5.7', 1), ('5.7', 2), ('5.7', 3), ('5.8', 1), ('5.8', 2), ('5.8', 3), ('5.9', 1), ('5.9', 2), ('5.9', 3),
    -- Évoluer en autonomie (0-60 m) : 1 orientation, 2 évolution subaquatique, 3 désaturation
    ('6.1', 1), ('6.2', 3), ('6.3', 2), ('6.4', 1), ('6.4', 2), ('6.5', 3), ('6.6', 2),
    ('6.7', 1), ('6.7', 2), ('6.7', 3), ('6.8', 2), ('6.8', 3), ('6.9', 3),
    -- Milieu et environnement : 1 aisance aquatique
    ('7.1', 1), ('7.2', 1), ('7.3', 1), ('7.4', 1), ('7.5', 1), ('7.6', 1), ('7.7', 1), ('7.8', 1), ('7.9', 1)
  ) AS v(numero, critere_ordre)
    ON v.numero = e.numero AND v.critere_ordre = c.ordre
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)';
