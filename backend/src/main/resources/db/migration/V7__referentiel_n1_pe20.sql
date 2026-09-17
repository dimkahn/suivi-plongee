-- ============================================================
--  Revision PE20 (decembre 2025) du referentiel N1 : la CTN FFESSM a
--  abandonne les codes de bloc C1-C9 au profit de dix competences
--  nommees, chacune structuree en Technique / Comportement / Theorie,
--  avec une phrase de "competence attendue" et des "modalites
--  d'evaluation" par bloc. Ces quatre champs n'avaient pas de colonne :
--  on les ajoute, nullable, pour ne pas casser les blocs deja migres
--  (N1 2016, N2, N3) qui restent muets sur ces colonnes.
--
--  Les criteres de la revision PE20 sont generes par
--  outils/generer_referentiel.py - ne pas editer le SQL a la main ;
--  regenerer et ajouter une nouvelle migration pour toute correction.
--  Source : Manuel de Formation Technique - Plongeur Niveau 1 - PE20,
--  Commission Technique Nationale FFESSM, version decembre 2025.
-- ============================================================

ALTER TABLE bloc_competence ADD COLUMN competence_attendue TEXT;
ALTER TABLE bloc_competence ADD COLUMN comportement        TEXT;
ALTER TABLE bloc_competence ADD COLUMN theorie             TEXT;
ALTER TABLE bloc_competence ADD COLUMN modalites_evaluation TEXT;

-- ---------- N1 (MFT PE20 (2025-12)) ----------
INSERT INTO referentiel (niveau, version_mft, date_application, source, actif,
        age_minimum, niveau_prerequis, qualification_requise, milieu_naturel_exclusif,
        niveau_encadrant_validation, niveau_encadrant_delivrance,
        profondeur_max_validation, profondeur_max_formation, prerogative_profondeur)
VALUES ('N1', 'PE20 (2025-12)', DATE '2025-12-01', 'Manuel de Formation Technique - Plongeur Niveau 1 - PE20, Commission Technique Nationale FFESSM, version decembre 2025', TRUE,
        12, NULL, NULL, FALSE,
        'E1', 'E3',
        6, 20, 20);

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation)
SELECT id, 'B1', 'S''équiper et se déséquiper', 1, FALSE, FALSE,
       'Le plongeur est capable de mettre en œuvre son équipement de manière autonome et d''en vérifier le bon fonctionnement.', 'Le plongeur est autonome dans la mise en œuvre et l''utilisation du matériel. Il respecte les consignes de sécurité. Il développe les notions de palanquée, d''entraide et de solidarité entre les plongeurs.',
       'Prévention des accidents liés aux chutes de la bouteille et des équipements sous pression. Connaissance des règles d''entretien et d''hygiène du matériel (signalement d''un dysfonctionnement, rinçage, désinfection, ...). Notions de flottabilité en rapport avec le lestage.', 'Le plongeur est capable de gérer son équipement sans l''assistance de l''encadrant. Il a un comportement adapté au contexte d''une palanquée. Il est capable de s''équiper au sec comme dans l''eau de manière autonome. Il met en œuvre les précautions d''usage pour éviter les accidents.'
  FROM referentiel WHERE niveau = 'N1' AND version_mft = 'PE20 (2025-12)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Gréage et dégréage', 'Gréage et dégréage de son équipement (bouteille, gilet stabilisateur et détendeur) sans erreur, vérification de la pression de la bouteille avant utilisation ainsi que du bon fonctionnement du gilet et du détendeur. Équipement en surface et dans l''eau, lestage approprié au milieu (eau douce, eau salée) et au matériel.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B1';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Capelage et décapelage', 'Gréage et dégréage de son équipement (bouteille, gilet stabilisateur et détendeur) sans erreur, vérification de la pression de la bouteille avant utilisation ainsi que du bon fonctionnement du gilet et du détendeur. Équipement en surface et dans l''eau, lestage approprié au milieu (eau douce, eau salée) et au matériel.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B1';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Choix de son matériel personnel', 'Gréage et dégréage de son équipement (bouteille, gilet stabilisateur et détendeur) sans erreur, vérification de la pression de la bouteille avant utilisation ainsi que du bon fonctionnement du gilet et du détendeur. Équipement en surface et dans l''eau, lestage approprié au milieu (eau douce, eau salée) et au matériel.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B1';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation)
SELECT id, 'B2', 'Se mettre à l''eau et sortir de l''eau', 2, FALSE, FALSE,
       'Le plongeur est capable de se mettre à l''eau et d''en sortir en sécurité pour lui et pour les autres plongeurs selon les modalités définies par le guide de palanquée.', 'Le plongeur se met à l''eau et sort de l''eau dans le souci de sa sécurité et de celle des autres. Son comportement est adapté au contexte de la plongée et au type d''embarcation (pneumatique, barge, chalutier,...) Il est attentif et respecte les consignes du DP (communication, vérifications des sécurités d''usage,...).',
       'Prévention des accidents, sensibilisation aux risques liés à la mise en œuvre des différentes techniques (chutes, percussion du bateau ou d''un autre plongeur) en fonction des conditions (hauteur, courant,...).', 'Le plongeur démontre sa capacité à se mettre à l''eau et à en sortir dans le respect des consignes du DP. Les techniques les plus usuelles sont maîtrisées. Les situations d''apprentissage et d''évaluation en milieu artificiel doivent être les plus proches possible de la réalité (constitution de la palanquée, consignes du DP et mise en œuvre).'
  FROM referentiel WHERE niveau = 'N1' AND version_mft = 'PE20 (2025-12)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Saut droit', 'Maîtrise des techniques de mise à l''eau en scaphandre comme en plongée libre.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B2';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Bascule arrière', 'Maîtrise des techniques de mise à l''eau en scaphandre comme en plongée libre.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B2';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Départ plage', 'Maîtrise des techniques de mise à l''eau en scaphandre comme en plongée libre.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B2';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Sortir de l''eau', 'Retrait de l''ensemble bloc-gilet en surface et passage à un support de plongée.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B2';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation)
SELECT id, 'B3', 'Évoluer dans l''eau - S''immerger', 3, FALSE, FALSE,
       'Le plongeur est capable de s''immerger selon la technique définie par le GP dans le respect de ses consignes.', 'Le plongeur adopte un comportement adapté à la demande du GP et dans le respect de ses consignes.',
       'Prévention des barotraumatismes de l''oreille, des sinus et du plaquage de masque. Flottabilité en lien avec la ventilation et le poumon ballast.', 'Les deux techniques du canard et du phoque doivent être maitrisées, le N1 doit être capable de s''immerger rapidement à la commande, en suivant les indications du GP.'
  FROM referentiel WHERE niveau = 'N1' AND version_mft = 'PE20 (2025-12)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Canard', 'Maîtrise des deux techniques du phoque et du canard en scaphandre et en plongée libre. Utilisation d''un lestage adapté : recherche essentielle de l''équilibre à 3 m.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B3';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Phoque', 'Maîtrise des deux techniques du phoque et du canard en scaphandre et en plongée libre. Utilisation d''un lestage adapté : recherche essentielle de l''équilibre à 3 m.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B3';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation)
SELECT id, 'B4', 'Évoluer dans l''eau - Se propulser', 4, FALSE, FALSE,
       'Le plongeur assure ses déplacements de manière autonome en surface comme en immersion.', 'Le plongeur maîtrise la gestion de son effort, il a le souci de l''unité de la palanquée (entraide et cohésion). Il se maintient à proximité du GP en respectant la profondeur et les consignes données.',
       'La notion d''appui de la surface de la palme et le principe du bras de levier doivent venir en soutien dans les explications du geste technique. Présentation des différents types de palmes. Prévention de l''essoufflement, gestion de la consommation.', 'Les deux types de nage de surface doivent être évalués sur des distances de l''ordre de 100 m pour le PMT et 50 m pour le capelé (simulation de retour au bateau). La qualité et l''efficacité du geste technique demeurent les principaux critères d''évaluation. Il n''y a pas d''épreuve chronométrée au N1, la capacité à effectuer un parcours en surface dans de bonnes conditions physiques (absence d''essoufflement) doit être le seul critère de performance.'
  FROM referentiel WHERE niveau = 'N1' AND version_mft = 'PE20 (2025-12)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Palmage ventral en surface', 'Maîtrise des différentes techniques de palmage : palmage de surface (sustentation, ventral, dorsal et costal), palmage en immersion, nage capelée. La qualité de réalisation et l''efficacité du geste technique doivent être privilégiées, la performance n''est pas une priorité.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B4';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Palmage dorsal', 'Maîtrise des différentes techniques de palmage : palmage de surface (sustentation, ventral, dorsal et costal), palmage en immersion, nage capelée. La qualité de réalisation et l''efficacité du geste technique doivent être privilégiées, la performance n''est pas une priorité.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B4';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Palmage de sustentation', 'Maîtrise des différentes techniques de palmage : palmage de surface (sustentation, ventral, dorsal et costal), palmage en immersion, nage capelée. La qualité de réalisation et l''efficacité du geste technique doivent être privilégiées, la performance n''est pas une priorité.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B4';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Palmage en immersion', 'Maîtrise des différentes techniques de palmage : palmage de surface (sustentation, ventral, dorsal et costal), palmage en immersion, nage capelée. La qualité de réalisation et l''efficacité du geste technique doivent être privilégiées, la performance n''est pas une priorité.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B4';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 5, 'Nage en capelé', 'Maîtrise des différentes techniques de palmage : palmage de surface (sustentation, ventral, dorsal et costal), palmage en immersion, nage capelée. La qualité de réalisation et l''efficacité du geste technique doivent être privilégiées, la performance n''est pas une priorité.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B4';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation)
SELECT id, 'B5', 'Évoluer dans l''eau - Se ventiler', 5, FALSE, FALSE,
       'Le plongeur gère et adapte sa ventilation, il réagit sereinement à une entrée volontaire ou accidentelle d''eau dans son masque.', 'Le plongeur adapte son rythme ventilatoire, il maîtrise sa ventilation et la maintient dans la zone de confort, il s''autocontrôle par des apnées de contrôle. Le plongeur vide son masque sans stress dans des situations variées. Il maîtrise sa ventilation dans la phase de remontée en prévention des barotraumatismes.',
       'Prévention des accidents : notions simples de physique pour expliquer les barotraumatismes de l''oreille et leur prévention (Valsalva, BTV, Frenzel), des sinus et du plaquage de masque. Prévention de la noyade. Consommation : notions simples de physique pour expliquer la consommation en air et sa répercussion sur la flottabilité.', 'Le plongeur montre sa capacité à gérer et réguler sa ventilation dans un contexte d''effort normal à modéré (faire face à un léger courant, retourner au bateau). Il est capable de faire, sans difficultés, des déplacements courts en apnée (quelques mètres en apnée inspiratoire et expiratoire). Il est capable de vider son masque dans des situations variées et sans stress (pas de situation brutale de nature à générer de l''insécurité). L''évaluation se fait dans la zone de 0 à 6 m.'
  FROM referentiel WHERE niveau = 'N1' AND version_mft = 'PE20 (2025-12)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Ventilation en immersion', 'Maîtrise et régulation de la ventilation en immersion (fréquence, amplitude et ventilation normale dans le volume courant).'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B5';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Ventilation sur tuba et vidage du tuba', 'Maîtrise de la ventilation en surface sur tuba et du vidage du tuba.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B5';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Vidage du masque', 'Vidage du masque par évacuation de l''eau en introduisant l''air par le nez et maintien d''une ventilation normale au contact de l''eau.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B5';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Lâcher et reprise d''embout', 'Maîtrise du lâcher-reprise d''embout et des deux techniques : vidage par expiration et utilisation du bouton de surpression. Réalisation d''une apnée (profondeur et distance modérées).'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B5';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation)
SELECT id, 'B6', 'Évoluer dans l''eau - S''équilibrer', 6, FALSE, FALSE,
       'Le plongeur gère sa stabilité grâce au poumon ballast et au gilet de stabilisation de manière autonome.', 'Le plongeur se met en situation d''équilibre à la demande, il est réactif et ajuste son réglage en fonction des variations de profondeur. Il est capable de maintenir une profondeur stable sur poumon ballast.',
       'Notions de flottabilité (positive, négative, neutre) en lien avec la ventilation et le poumon ballast. Informations sur les éléments permettant à l''élève de trouver son lestage.', 'Le plongeur s''équilibre à la demande du GP. Les situations d''évaluation doivent être variées. La compétence est évaluée de manière répétitive, la performance du plongeur est contrôlée dans des situations statique et dynamique avec une variation de plus ou moins 1 mètre.'
  FROM referentiel WHERE niveau = 'N1' AND version_mft = 'PE20 (2025-12)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Gestion du gilet de stabilisation', 'Maîtrise de la technique du poumon ballast et utilisation du gilet pour s''équilibrer : utilisation de l''inflateur et des différentes purges. Maîtrise de la combinaison des deux techniques.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B6';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Poumon ballast', 'Maîtrise de la technique du poumon ballast et utilisation du gilet pour s''équilibrer : utilisation de l''inflateur et des différentes purges. Maîtrise de la combinaison des deux techniques.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B6';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation)
SELECT id, 'B7', 'Respecter le milieu et l''environnement', 7, FALSE, FALSE,
       'Le plongeur adopte une attitude éco-responsable, il évolue dans le respect de l''environnement subaquatique et en connaissance du milieu.', 'Le plongeur évolue en limitant son impact sur l''environnement. Il développe sa capacité d''observation.',
       'Connaissance du milieu (faune et flore courantes, risques et dangers du milieu). Connaissances liées au respect de l''environnement, à l''impact du plongeur sur le milieu (respect de la tranquillité de la faune, absence de dégradation). Présentation de la Charte internationale du plongeur responsable. Froid et dangers du milieu : connaissance des risques et de la prévention.', 'Au cours des plongées en milieu naturel, le comportement respectueux et responsable du plongeur est évalué.'
  FROM referentiel WHERE niveau = 'N1' AND version_mft = 'PE20 (2025-12)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Aisance aquatique', 'Réalisation de déplacements équilibrés, sans appui, avec un palmage et une stabilisation maîtrisés.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B7';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation)
SELECT id, 'B8', 'Communiquer', 8, FALSE, FALSE,
       'Le plongeur est en mesure de comprendre et d''échanger les informations utiles à la gestion de la plongée avec le GP et les autres plongeurs.', 'Le plongeur est attentif et réactif, il sait anticiper les gestes et prendre l''initiative de communiquer sans attendre le questionnement du GP, il est rigoureux dans l''exécution des signes.',
       'Connaissance des signes et des réponses possibles.', 'Les deux aspects de la communication sont évalués, compréhension et réalisation. Les situations d''évaluation doivent être variées (statiques, dynamiques, individuelles ou en palanquée). L''exactitude et la promptitude de la réalisation des gestes est attendue. Le plongeur doit être efficace dans sa communication.'
  FROM referentiel WHERE niveau = 'N1' AND version_mft = 'PE20 (2025-12)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Exécution des signes conventionnels', 'Identification et réalisation de l''ensemble des signes conventionnels : OK, monter, descendre, ça ne va pas, mi-pression, réserve, panne d''air, essoufflement, froid, fin de plongée/d''exercice.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B8';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation)
SELECT id, 'B9', 'Évoluer en sécurité', 9, FALSE, FALSE,
       'Le plongeur est familiarisé à la mise en œuvre des procédures liées aux différentes situations auxquelles il est confronté.', 'Le plongeur sait réagir aux différentes situations. Il exécute la procédure demandée sans hésitation, de manière automatique et sans erreur. Il accepte la procédure du guide de palanquée calmement. Il interprète le signe correctement, l''action est immédiate : apport d''une source d''air, aide à l''équipier, sollicitation du GP.',
       'Protocoles et procédures : connaissance des codes de communication et des réponses possibles dans le cadre de procédures normales et anormales. Règle en cas de perte de palanquée.', 'L''ensemble des situations nécessitant une intervention du GP doit être évalué. Le plongeur est familiarisé avec la procédure mise en œuvre par le GP, il l''accepte en gardant son calme. L''accoutumance doit reposer sur la répétition et la variété des situations d''évaluation.'
  FROM referentiel WHERE niveau = 'N1' AND version_mft = 'PE20 (2025-12)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Application des procédures mises en œuvre par le GP', 'Application des procédures mises en œuvre par le GP. Familiarisation avec les procédures usuelles mises en œuvre par le GP : réserve, froid. Familiarisation avec la mise en œuvre des procédures en situation d''incident : panne d''air (réalisation d''une apnée expiratoire sur une distance de 10 m à l''horizontale, utilisation de l''octopus du GP), essoufflement, crampe, malaise.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B9';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Intervention en relais', 'Intervention en relais auprès d''un équipier en difficulté : passage de l''octopus et simulation d''échange d''embout en cas de panne d''air.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B9';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation)
SELECT id, 'B10', 'Retourner en surface', 10, FALSE, FALSE,
       'Le plongeur gère son retour en surface en toute sécurité en respectant les consignes du GP.', 'Le plongeur est attentif à la cohésion de la palanquée. Il est à l''écoute du GP et réactif à ses consignes. Il est capable de revenir en surface et de se signaler en cas de perte de sa palanquée.',
       'Accidents : principes des barotraumatismes et prévention. Faire le lien avec les notions de physique simples pour expliquer les variations de volume, notamment concernant la zone de 0 à 10 m. Les règles d''approche de la surface sont explicitées. Un accent particulier est mis sur la surpression pulmonaire. Désaturation : principe de l''accident de désaturation, courbe de plongée sans palier, connaissance de différents outils (ordinateur et table fédérale) : lecture simple des informations et utilisation basique. Procédures de remontée anormale y compris la remontée isolée.', 'Le plongeur sait gérer sa remontée en totale autonomie ou au sein d''une palanquée. Il sait également se mettre en sécurité en surface, seul ou en palanquée. Pour la remontée en expiration, aucun critère de temps n''est recherché, la réalisation sans stress et en respectant une vitesse correcte de remontée est recherchée.'
  FROM referentiel WHERE niveau = 'N1' AND version_mft = 'PE20 (2025-12)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Maîtrise de la vitesse de remontée', 'Maîtrise de la vitesse de remontée en utilisant les palmes et le gilet (avec et sans repères visuels).'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B10';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Tenue d''un palier', 'Tenue d''un palier y compris en pleine eau.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B10';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Tour d''horizon', 'Capacité à assurer sa sécurité en sortie d''eau (tour d''horizon et gonflage du gilet en surface).'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B10';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Gonflage du gilet en surface', 'Capacité à assurer sa sécurité en sortie d''eau (tour d''horizon et gonflage du gilet en surface).'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B10';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 5, 'Remontée en expiration contrôlée', 'Remontée en expiration, embout en bouche, d''une profondeur n''excédant pas 6 m : rejet continu d''air tout au long de la remontée après un départ du fond, sans précipitation, sur une inspiration normale.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B10';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation)
SELECT id, 'B11', 'Connaissances théoriques', 11, TRUE, FALSE,
       'Les connaissances des niveaux antérieurs sont considérées comme maîtrisées. L''évaluation peut permettre de vérifier ce point.', NULL,
       NULL, 'Les connaissances théoriques sont évaluées à l''oral, lors des mises en situations pratiques. Il n''y a pas d''examen écrit. L''accent est mis sur la prévention.'
  FROM referentiel WHERE niveau = 'N1' AND version_mft = 'PE20 (2025-12)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Notions de physique', 'Principes de physique simples, flottabilité, variations de pression et de volume, influence du milieu sur la perception des couleurs, des distances et des tailles. Influence du milieu sur la perception des sons. Ces principes sont présentés sans calcul.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B11';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Accidents', 'Principes des barotraumatismes et leur prévention. Causes et prévention de l''essoufflement.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B11';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Procédures de désaturation', 'Principe de l''accident de désaturation, courbe de plongée sans palier, connaissance de différents moyens de décompression (ordinateur et table fédérale). La table fédérale sert de support pédagogique (durée, profondeur, palier, vitesse de remontée). Information sur l''utilisation basique des ordinateurs de plongée (connaissance de son ordinateur). Procédures de remontée anormale, y compris la remontée isolée.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B11';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Froid et dangers du milieu', 'Connaissance des risques et de la prévention.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B11';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 5, 'Réglementation', 'Prérogatives du plongeur, documents pour plonger. Réglementation relative aux espaces d''évolution, à la plongée en autonomie et à la responsabilité. Respect des consignes de l''encadrant. Présentation de la FFESSM, information sur l''organisation de la plongée. Utilisation du carnet de plongée numérique.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B11';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 6, 'Milieu et environnement', 'Charte internationale du plongeur responsable, connaissances minimales du milieu subaquatique. Respect du milieu (palmage, stabilisation...).'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND b.code = 'B11';
