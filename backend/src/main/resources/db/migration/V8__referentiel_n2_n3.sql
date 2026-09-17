-- ============================================================
--  Revisions PA20|PE40 (mai 2026, N2) et PA40|PE60 (decembre 2025, N3) du
--  referentiel : le N2 et le N3 se scindent chacun en deux qualifications
--  (PA20/PE40 pour le N2, PA40/PE60 pour le N3, plus des "competences
--  complementaires N3") au lieu d'un seul jeu de blocs C1-C9. PA60
--  (plongeur autonome a 60 m, sans DP) est une qualification supplementaire
--  obtenue apres le N3 : non importee ici, hors perimetre du brevet N3.
--
--  Choix de modelisation (voir CLAUDE.md) : un seul Referentiel par niveau,
--  comme avant, plutot que de faire de chaque qualification un "niveau" a
--  part entiere (ce qui aurait touche Cursus, HabilitationService,
--  RegleDelivranceService...). Chaque bloc porte juste une etiquette
--  d'affichage dans la nouvelle colonne "regroupement" ("Commun", "PA20",
--  "PE40", "PA40", "PE60", "N3") : aucun suivi separe de la progression par
--  qualification, tout se valide sous un meme cursus N2 ou N3.
--
--  Genere par outils/generer_referentiel.py - ne pas editer le SQL a la
--  main ; regenerer et ajouter une nouvelle migration pour toute correction.
--  Sources : Manuel de Formation Technique - Plongeur Niveau 2 - PA20 | PE40
--  (CTN FFESSM, version mai 2026) et Plongeur Niveau 3 - PA40 | PE60 | PA60
--  (CTN FFESSM, version decembre 2025).
-- ============================================================

ALTER TABLE bloc_competence ADD COLUMN regroupement VARCHAR(40);

-- ---------- N2 (MFT PA20 | PE40 (2026-05)) ----------
INSERT INTO referentiel (niveau, version_mft, date_application, source, actif,
        age_minimum, niveau_prerequis, qualification_requise, milieu_naturel_exclusif,
        niveau_encadrant_validation, niveau_encadrant_delivrance,
        profondeur_max_validation, profondeur_max_formation, prerogative_profondeur)
VALUES ('N2', 'PA20 | PE40 (2026-05)', DATE '2026-05-01', 'Manuel de Formation Technique - Plongeur Niveau 2 - PA20 | PE40, Commission Technique Nationale FFESSM, version mai 2026', TRUE,
        15, 'N1', NULL, TRUE,
        'E2', 'E3',
        20, 40, 40);

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C1', 'S''équiper et se déséquiper - Se mettre à l''eau et en sortir', 1, FALSE, FALSE,
       'Le plongeur est capable de mettre en œuvre son équipement de manière autonome et d''en vérifier le bon fonctionnement, de se mettre à l''eau, de sortir de l''eau efficacement et en autonomie.', 'Le plongeur porte une attention particulière au bon fonctionnement de son matériel, à l''équipement des équipiers. Il respecte les consignes du DP et met en œuvre les techniques avec rapidité et aisance.',
       'Rappel des principes d''entretien et de fonctionnement du matériel, d''hygiène et de désinfection. Prévention de l''essoufflement en lien avec une utilisation déficiente du matériel. Flottabilité et lestage adapté à la plongée profonde.', 'Evaluation en contrôle continu en cours de formation. Le plongeur doit être autonome dans la gestion de son matériel et de son équipement, il doit être attentif au matériel de ses équipiers. Le plongeur maîtrise les techniques usuelles de mise à l''eau et de sortie de l''eau, du bord ou d''une embarcation, dans des contextes de milieux naturels variés. Il a le souci de la sécurité globale de la palanquée.', 'Commun'
  FROM referentiel WHERE niveau = 'N2' AND version_mft = 'PA20 | PE40 (2026-05)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Gréage et dégréage', 'Perfectionnement des techniques acquises au N1: choix du matériel adapté à la plongée, montage sans erreur, réglages corrects en surface.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C1';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Capelage et décapelage', 'Perfectionnement des techniques acquises au N1: choix du matériel adapté à la plongée, montage sans erreur, réglages corrects en surface.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C1';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Saut droit et bascule arrière - Remontée à l''échelle', 'Mise à l''eau et sortie de l''eau adaptées au lieu et aux conditions de plongée, aisance de pratique.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C1';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C2', 'S''immerger - Se propulser - Se ventiler', 2, FALSE, FALSE,
       'Le plongeur est capable de s''immerger selon la technique définie par le DP ou le GP, dans le respect de ses consignes et dans toutes les conditions de pratique. Il assure ses déplacements de manière autonome en surface comme dans sa zone d''immersion.', 'Le plongeur est capable de gérer ses efforts afin d''éviter les incidents, pour lui comme pour ses équipiers de la palanquée.',
       'Prévention des accidents notamment en zone profonde : essoufflement, accident de désaturation, narcose, froid. Flottabilité et lestage.', 'Nages de surface : distances de l''ordre de 250 m pour le PMT et 100 m pour le capelé. Les capacités physiques sont développées pour répondre aux exigences de la plongée. La qualité et l''efficacité des gestes techniques demeurent essentiels. Pas d''épreuve chronométrée, seule la capacité à effectuer un parcours en surface dans de bonnes conditions physiques doit être le critère retenu. Pour la REC, lors des situations d''évaluation, aucun critère de temps n''est recherché. La réalisation sans stress et en respectant une vitesse correcte de remontée est primordiale. En revanche, l''automatisme de l''expiration contrôlée est vérifié lors de toutes les situations d''apprentissage technique nécessitant une remontée. Descente, remontée : maintien un niveau d''immersion durablement et sans difficulté.', 'Commun'
  FROM referentiel WHERE niveau = 'N2' AND version_mft = 'PA20 | PE40 (2026-05)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Canard et phoque', 'Renforcement et perfectionnement des techniques d''immersion acquises, adaptées aux conditions de la plongée et réalisées efficacement (rapidité et maintien de la cohésion de la palanquée).'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C2';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Palmages', 'Optimisation des techniques de palmage acquises pour limiter les risques d''accident, notamment en zone profonde.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C2';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Remontée en expiration contrôlée REC', 'Remontée en expiration, embout en bouche, sur un trajet vertical n''excédant pas 10 m (rejet d''air tout au long de la remontée après un départ du fond stabilisé, sans précipitation, sur une inspiration normale).'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C2';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Descente et remontée', 'Evolution équilibrée à la descente, au fond, en profondeur, à la remontée au palier par l''utilisation combinée du gilet et du poumon ballast.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C2';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C3', 'Respecter le milieu et l''environnement', 3, FALSE, FALSE,
       'Le plongeur adopte une attitude éco-responsable, il évolue dans le respect de l''environnement subaquatique et en connaissance du milieu.', 'Le plongeur évolue en limitant son impact sur l''environnement. Il adopte une attitude respectueuse à l''égard de la faune et de la flore : il limite l''éclairage et les nuisances sonores, il est le plus discret possible, il refuse le nourrissage. Il développe sa capacité d''observation.',
       'Connaissance du milieu (faune et flore courantes, risques et dangers du milieu). Connaissance liée au respect de l''environnement, à l''impact du plongeur sur le milieu (respect de la tranquillité de la faune, absence de dégradation). Présentation de la Charte internationale du plongeur responsable.', 'Au cours des plongées en milieu naturel, le comportement respectueux et responsable du plongeur est évalué. Il sait décrire et nommer les espèces les plus fréquemment rencontrées.', 'Commun'
  FROM referentiel WHERE niveau = 'N2' AND version_mft = 'PA20 | PE40 (2026-05)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Aisance aquatique', 'Réalisation de déplacements équilibrés, sans appui, avec un palmage et une stabilisation maitrisés.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C3';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C4', 'Être attentif au matériel de ses équipiers', 4, FALSE, FALSE,
       'Le plongeur est capable d''adapter son matériel en fonction de la plongée, il connaît le matériel de ses équipiers et leur mise en œuvre.', 'Le plongeur est autonome dans le choix du matériel, il a le réflexe de présenter son matériel à ses équipiers et de se renseigner sur le matériel des autres membres de la palanquée. Le principe de la co-gestion de la palanquée doit rester à l''esprit du plongeur dans sa manière de gérer et d''utiliser le matériel.',
       'Réglementation sur le matériel obligatoire en plongée autonome. Notions simples de physique pour expliquer et comprendre les principes de fonctionnement des détendeurs (pression, forces, équilibre des forces, débit continu, ...).', 'Le plongeur est capable de présenter à ses équipiers son matériel et en connaît les principes de fonctionnement. Il est capable de comprendre le fonctionnement du matériel de ses équipiers. Il est capable de restituer oralement les principes de fonctionnement d''un détendeur (détente et asservissement).', 'PA20'
  FROM referentiel WHERE niveau = 'N2' AND version_mft = 'PA20 | PE40 (2026-05)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Mise en œuvre de son propre matériel', 'Adaptation du lestage à son équipement. Contrôle du bon fonctionnement de son matériel et information à ses équipiers.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C4';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Connaissance du matériel des équipiers', 'Connaissance du moyen de désaturation utilisé par ses équipiers. Connaissance du fonctionnement de leur gilet, de la localisation de leur détendeur de secours et de leur moyen de contrôle de la pression d''air.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C4';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C5', 'Évoluer en autonomie', 5, FALSE, FALSE,
       'Le plongeur sait évoluer en immersion en toute autonomie dans le souci de la sécurité de la palanquée et dans le respect des choix de planification.', 'Les plongeurs autonomes étant coresponsables, une attention constante doit être portée à la communication avec les autres membres de la palanquée, à leur surveillance régulière, au contrôle des différents paramètres de plongée prédéfinis sur le plan de l''autonomie en air et de la désaturation. Une vigilance accrue est attendue dans la gestion de la désaturation.',
       'Information sur la modélisation de la désaturation. Le plongeur sait utiliser son ordinateur de plongée : il identifie les différents affichages et paramètres (durée, profondeur instantanée et maximale, durée maximale de plongée sans palier, paliers facultatifs et obligatoires, durée de la remontée, indicateur de vitesse, alarmes...), il connait les critères de conservatisme, il sait utiliser le mode planification et carnet de plongée. Il connait les valeurs limites de GF (gradient factor) pour la plongée à l''air (GF bas = GF haut = entre 85 et 90%). Le plongeur est capable de gérer la désaturation au sein d''une palanquée utilisant des moyens différents. Connaissance de la table fédérale et de ses principes de fonctionnement. Connaissance des obligations règlementaires et des incidences sur les responsabilités civiles et pénales partagées des plongeurs.', 'Les comportements doivent être évalués tout au long de la formation et au travers de mises en situations variées (milieu, condition de visibilité, courant, ...). Le plongeur est capable de respecter la vitesse de remontée, les paliers et de mettre en place un parachute. Il participe activement à la gestion de la désaturation, intègre les consignes du DP et tient compte des différents matériels. Pour la partie théorique, ces connaissances sont à vérifier de manière orale, ciblées sur des situations concrètes, pratiques et réalistes. Résolution d''au moins un problème de table (pas d''utilisation planifiée, pas de lecture inverse, pas d''utilisation en altitude ni de mélanges autres que l''air, pas de respiration d''O2 en surface ou au palier).', 'PA20'
  FROM referentiel WHERE niveau = 'N2' AND version_mft = 'PA20 | PE40 (2026-05)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Sécurité de la palanquée', 'Connaissance du fonctionnement de son instrument de désaturation, lecture des principaux paramètres : durée et profondeurs, vitesse de remontée, durée de plongée sans palier, durée et profondeur des paliers, etc. Participation à la cohésion de la palanquée : respect de la vitesse de remontée, tenue du palier, cohabitation de différents moyens de désaturation. Mise en œuvre de la sécurité pour la sortie de l''eau, lancement du parachute.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C5';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C6', 'Planifier la plongée en fonction des consignes du DP', 6, FALSE, FALSE,
       'Le plongeur est capable de planifier sa plongée en autonomie avec ses équipiers en respectant les consignes du directeur de plongée.', 'Le plongeur a le souci de la gestion collégiale de la planification. Il s''attache au respect du cadre réglementaire et à celui défini par le directeur de plongée. Il prend en compte l''expérience de ses équipiers. En immersion, il porte une attention constante à la mise en œuvre du parcours, à la prise de repères.',
       'Réglementation relative aux espaces d''évolution, à la plongée en autonomie et à la responsabilité. Gestion de procédures de désaturation différentes au sein d''une même palanquée (capable d''identifier ce type de situation avant la plongée et d''agir en conséquence). Notions de physique permettant de calculer l''autonomie et la consommation du plongeur en profondeur et au palier en litre/minute et en bar/minute.', 'Le plongeur est capable, en s''appuyant sur un cas concret, de présenter une proposition de planification. Il peut préciser les procédures qu''il souhaite mettre en place à chaque étape de l''immersion. Le contrôle se fait en cours de formation, avec le souci de varier les situations d''évaluation et d''en conserver la dimension pratique. Il sait réaliser des calculs simples de consommation et d''autonomie. Il peut réaliser un aller-retour au compas sur une distance courte (20 à 30 m), il sait suivre un court trajet prédéfini.', 'PA20'
  FROM referentiel WHERE niveau = 'N2' AND version_mft = 'PA20 | PE40 (2026-05)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Compréhension des directives du DP', 'Identification des consignes de durée et de profondeur, connaissance des conditions de fin de plongée et des règles de désaturation imposées : pression du bloc en fin de plongée, paliers éventuels, durée totale de remontée maximale.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C6';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Compréhension de la topologie du site de plongée, orientation', 'Compréhension de la géographie du site ainsi que des repères à utiliser pour l''orientation. Utilisation d''un compas.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C6';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Détermination du profil de la plongée et des différentes procédures en immersion', 'En concertation avec ses équipiers : définition du profil de plongée et du choix des paramètres en fonction du cadre fixé par le DP (pas de paliers profonds à l''air), prise en compte des différents moyens de désaturation présents dans la palanquée, détermination du protocole de contrôle des consommations.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C6';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C7', 'Intervenir et porter assistance à un plongeur en difficulté', 7, FALSE, TRUE,
       'Le plongeur est capable d''identifier une situation anormale et d''adopter un comportement adapté pour y remédier efficacement jusqu''à la prise en charge par le DP.', 'La réaction est rapide, sans brutalité, la prise en charge est calme et sécurisante. Le plongeur qui intervient a le souci du confort de l''assisté, il adopte une attitude rassurante.',
       'Causes, symptômes, prévention et conduites à tenir pour l''ensemble des accidents : barotraumatismes, accident de désaturation, essoufflement, froid, malaises, etc. Concernant les accidents de désaturation, en particulier, les facteurs favorisants, les profils de plongée à risque, l''acclimatation à la désaturation (plongée de réadaptation).', 'Toutes les situations qui nécessitent une intervention sont travaillées. L''assistance doit être réalisée dans au moins deux situations différentes, chacune étant réalisée intégralement, au moins deux fois. Le plongeur doit réaliser une bonne interprétation de la situation, une prise en charge rapide et efficace, une remontée régulière à une vitesse adaptée aux moyens de désaturation utilisés, un arrêt marqué dans la zone 5 à 3 m et une sortie d''eau sécurisée. Le palmage est autorisé mais l''utilisation optimale des gilets doit être privilégiée. L''évaluation des connaissances relatives à la prévention des accidents de désaturation se fait à travers l''étude de cas pratiques.', 'PA20'
  FROM referentiel WHERE niveau = 'N2' AND version_mft = 'PA20 | PE40 (2026-05)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Observation, compréhension et réaction face à un incident', 'Interprétation des signes conventionnels d''un équipier. Réaction aux manifestations observables en l''absence de signe conventionnel (ventilation anormale, agitation, inconscience, débit continu,...). Prise en charge du plongeur en difficulté. Si nécessaire, passage de l''octopus, assistance et remontée à l''aide des moyens disponibles, gilets et palmes.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C7';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C8', 'Se ventiler - S''équilibrer', 8, FALSE, FALSE,
       'Le plongeur gère et adapte sa ventilation en fonction de la profondeur. Il maitrise sa stabilisation dans toutes les situations, de manière autonome.', 'Le plongeur fait preuve de rapidité et d''efficacité dans la mise en œuvre des différentes techniques et compétences aquatiques.',
       'Prévention des accidents : accident de désaturation, narcose, essoufflement. Consommation : incidence de la profondeur sur la consommation et l''autonomie, démontrée à partir d''un calcul. Flottabilité : loi de Mariotte, compréhension de l''incidence de la profondeur sur la flottabilité.', 'Le plongeur montre sa capacité à gérer et réguler sa ventilation dans un contexte d''effort normal à modéré. Il est capable de vider son masque dans des situations variées et sans stress à 20 m.', 'PE40'
  FROM referentiel WHERE niveau = 'N2' AND version_mft = 'PA20 | PE40 (2026-05)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Ventilation en surface et en immersion', 'Maîtrise de toutes les techniques, quelle que soit la profondeur : passage embout tuba, lâcher-reprise d''embout, expiration à la remontée. Adaptation de la ventilation et de la gestion de l''effort en profondeur.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C8';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Vidage du masque', 'Maintien d''une ventilation normale et de la stabilité pendant le VDM. Perfectionnement de la technique jusqu''à une profondeur de 20 m.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C8';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Stabilisation', 'Maintien d''une ventilation normale et de la stabilité pendant le VDM. Perfectionnement de la technique jusqu''à une profondeur de 20 m.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C8';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C9', 'Communiquer avec le guide de palanquée', 9, FALSE, FALSE,
       'Le plongeur est en mesure de comprendre et d''échanger les informations utiles à la gestion de la plongée par le GP.', 'Le plongeur comprend les consignes du GP. Il informe spontanément le GP à terre et en plongée, de tous les paramètres utiles à la plongée, en particulier sa consommation et sa désaturation. Le GP attend de sa part une vigilance accrue dans tous les moments de la plongée. Il est capable d''analyser ses propres sensations, son ressenti, d''adapter son propre comportement et de prévenir le GP (narcose, essoufflement, ...).',
       'Risques de la plongée profonde : narcose, froid, essoufflement, consommation, désaturation. Le plongeur sait utiliser son ordinateur de plongée : il identifie les différents affichages et paramètres (durée, profondeur instantanée et maximale, durée maximale de plongée sans palier, paliers facultatifs et obligatoires, durée de la remontée, indicateur de vitesse, alarmes...), il connait les critères de conservatisme, il sait utiliser le mode planification, connaît les valeurs limites de GF (gradient factor) pour la plongée à l''air (GF bas = GF haut = entre 85 et 90%).', 'L''évaluation est réalisée en situations pratiques réelles, l''ensemble des situations de communication est évaluée. Les échanges sont clairs, les réactions rapides et adaptées.', 'PE40'
  FROM referentiel WHERE niveau = 'N2' AND version_mft = 'PA20 | PE40 (2026-05)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Connaissance de tous les signes et codes', 'Connaissance de tous les signes, réactivation des acquis du code de communication et acquisition des signes propres à la plongée profonde : narcose, consommation, paramètres de désaturation.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C9';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C10', 'Retourner en surface', 10, FALSE, FALSE,
       'Le plongeur connait le fonctionnement de ses moyens de décompression et les utilise à bon escient en plongée. Il est capable de réaliser et de gérer sa remontée vers la surface en toutes circonstances.', 'Le plongeur est attentif à l''évolution de ses paramètres. La fréquence du contrôle des instruments doit être adaptée à la profondeur. Il fait preuve d''initiative en communiquant ses paramètres au GP sans attendre d''être sollicité par ce dernier. Il respecte les consignes du GP spécifiques au déroulement de la plongée. En cas de remontée isolée, le plongeur assure sa propre sécurité : vitesse, paliers, approche surface, sortie de l''eau.',
       'Connaissance du fonctionnement de son moyen de désaturation. Connaissance du fonctionnement de la table fédérale. Notions de physique simples : flottabilité, loi de Mariotte (compréhension des variations de volume). Accidentologie : prévention des barotraumatismes et de l''accident de désaturation.', 'L''évaluation doit être réalisée tout au long de la formation. Le plongeur démontre sa capacité à identifier et à communiquer les paramètres utiles à la procédure de désaturation. L''évaluation de la connaissance des principes de fonctionnement de la table fédérale (palier, vitesse de remontée, différents types de plongée, ...), est orale ou écrite, sans recours aux exercices de calcul de table. Le plongeur démontre sa capacité à remonter seul en toute sécurité. Il est capable de restituer les paramètres de sa plongée au DP.', 'PE40'
  FROM referentiel WHERE niveau = 'N2' AND version_mft = 'PA20 | PE40 (2026-05)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Gestion de la désaturation', 'Identification de tous les paramètres de son moyen de désaturation utiles à la gestion de la plongée : profondeur, temps, durée sans palier, durée totale de remontée, paliers. Communication au GP et suivi des consignes de celui-ci. Maitrise des fonctionnalités de son instrument de désaturation.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C10';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Gestion d''une remontée isolée', 'Réalisation du retour en surface en respectant la vitesse de remontée et les paliers inhérents à la plongée effectuée.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C10';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C11', 'Intervenir en relais sur un équipier en difficulté', 11, FALSE, TRUE,
       'Le plongeur est capable d''identifier et de prendre en charge un équipier en difficulté, en attendant l''intervention du guide de palanquée.', 'Le plongeur analyse et réagit sans ambiguïté au signe d''un équipier. Il agit calmement et rapidement dès perception de la situation nécessitant une intervention. Toute intervention ne doit pas augmenter la profondeur, la flottabilité est assurée lorsque cela est nécessaire. Il a le souci d''assurer un certain confort durant la prise en charge : mise en bouche du détendeur, quantité d''air fusante, etc.',
       'Protocoles et procédures : il connait les codes de communication et les réponses possibles dans le cadre de procédures normales et exceptionnelles. Recommandations fédérales et procédures de rattrapage en cas de remontée anormale.', 'Les situations évaluées qui nécessitent l''intervention du plongeur avant celle du GP doivent être variées. Le plongeur réagit rapidement et réalise une action adaptée à la situation : prise en charge du plongeur assisté, maintien de la profondeur, passage d''embout et déplacement jusqu''au GP.', 'PE40'
  FROM referentiel WHERE niveau = 'N2' AND version_mft = 'PA20 | PE40 (2026-05)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Intervention en relais', 'Intervention en relais auprès d''un équipier. Maintien du niveau d''immersion et présentation de son deuxième détendeur en cas de panne d''air, prise en charge de l''équipier jusqu''à l''intervention du GP.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C11';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C12', 'Connaissances théoriques PA20', 12, TRUE, FALSE,
       'Les connaissances des niveaux antérieurs sont considérées comme maîtrisées. L''évaluation peut permettre de vérifier ce point.', NULL,
       NULL, NULL, 'PA20'
  FROM referentiel WHERE niveau = 'N2' AND version_mft = 'PA20 | PE40 (2026-05)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Théorie de l''activité', 'Flottabilité, variations de pression et de volume. Incidence de la profondeur sur la consommation et l''autonomie, prévention de la panne d''air, notion de marge de sécurité (consommation en profondeur et au palier en litre/minute et en bar/minute). Les calculs viennent en appui de la démonstration et ne constituent pas un outil d''évaluation.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C12';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Accidents', 'Rappels des préventions orientés vers l''autonomie (prise en compte des équipiers) pour l''accident de désaturation, les barotraumatismes, l''essoufflement et le froid. Différentes conduites à tenir en lien avec les prérogatives (intervention jusqu''à la prise en charge par le DP). Causes, symptômes, prévention et conduite à tenir pour l''ensemble des accidents.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C12';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Procédures de désaturation', 'Connaissance des différents moyens de désaturation, fonctionnement des tables de plongée (le calcul vient en appui des démonstrations, il ne sert pas de moyen d''évaluation). Fonctionnement de l''ordinateur, principe et règles de cohabitation des différentes procédures (paliers, vitesse, personnalisation,...).'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C12';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Matériel', 'Connaissance du fonctionnement du premier étage d''un détendeur : information sur le principe de détente, l''asservissement, la compensation, le débit continu. Règles d''entretien et précautions d''utilisation de l''ensemble de son matériel (rinçage, stockage, ...).'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C12';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 5, 'Réglementation', 'Prérogatives du plongeur, documents nécessaires à la pratique de la plongée. Règlementation relative aux espaces d''évolution, à la plongée en autonomie et à la responsabilité. Règlementation sur le matériel obligatoire en plongée autonome. Connaissance des ressources et recherche de l''information : différentes autorités, clubs locaux, etc. Connaissance du cadre fédéral (organes déconcentrés, commissions, ...).'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C12';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 6, 'Milieu et environnement', 'Charte internationale du plongeur responsable, connaissance minimale du milieu subaquatique : le comportement respectueux et responsable du plongeur est évalué. Connaissance des risques et dangers du milieu (faune, épaves, grottes, ...). Identification des espèces courantes.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C12';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C13', 'Connaissances théoriques PE40', 13, TRUE, FALSE,
       'Les connaissances des niveaux antérieurs sont considérées comme maîtrisées. L''évaluation peut permettre de vérifier ce point.', NULL,
       NULL, NULL, 'PE40'
  FROM referentiel WHERE niveau = 'N2' AND version_mft = 'PA20 | PE40 (2026-05)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Théorie de l''activité', 'Flottabilité, variations de pression et de volume. Flottabilité et lestage, prise en compte de l''augmentation de la profondeur d''évolution et impact sur l''équilibre. Consommation : incidence de la profondeur sur la consommation et l''autonomie, prévention de la panne d''air, notion de marge de sécurité. Notions sur les pressions partielles : seuils de toxicité des gaz. Les calculs viennent en appui de la démonstration et ne constituent pas un outil d''évaluation.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C13';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Accidents', 'Prévention des accidents liés à la profondeur : accident de désaturation, essoufflement, froid, narcose. Sensibilisation à l''accroissement des risques liés à la profondeur. Connaissance des risques et dangers du milieu.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C13';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Procédures de désaturation', 'Rappel de la courbe de plongée sans palier. Connaissance du fonctionnement de l''ordinateur ciblé sur son utilisation, identification des paramètres utiles : durée, profondeur, paliers, durée totale de remontée, vitesse de remontée. Notions de personnalisation.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C13';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Réglementation', 'Prérogatives du plongeur, documents nécessaires à la pratique de la plongée. Règlementation relative aux espaces d''évolution, à la plongée en autonomie et à la responsabilité. Connaissance du cadre fédéral (organes déconcentrés, commissions, ...).'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C13';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 5, 'Milieu et environnement', 'Charte internationale du plongeur responsable, connaissances minimales du milieu subaquatique. Sensibilisation aux risques et dangers du milieu. Identification des espèces courantes.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND b.code = 'C13';

-- ---------- N3 (MFT PA40 | PE60 (2025-12)) ----------
INSERT INTO referentiel (niveau, version_mft, date_application, source, actif,
        age_minimum, niveau_prerequis, qualification_requise, milieu_naturel_exclusif,
        niveau_encadrant_validation, niveau_encadrant_delivrance,
        profondeur_max_validation, profondeur_max_formation, prerogative_profondeur)
VALUES ('N3', 'PA40 | PE60 (2025-12)', DATE '2025-12-01', 'Manuel de Formation Technique - Plongeur Niveau 3 - PA40 | PE60 | PA60, Commission Technique Nationale FFESSM, version decembre 2025', TRUE,
        17, 'N2', 'RIFAP', TRUE,
        'E3', 'E3',
        40, 60, 60);

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C1', 'Planifier la plongée', 1, FALSE, FALSE,
       'Le plongeur est capable de planifier sa plongée en autonomie, avec ses équipiers et en respectant les consignes du directeur de plongée.', 'Le plongeur a le souci de la gestion collégiale de la planification. Il est particulièrement vigilant au respect du cadre réglementaire et à celui défini par le directeur de plongée. Les spécificités de la zone d''évolution doivent l''inciter à une préparation minutieuse de la plongée qui s''appuie sur la prise en compte de l''expérience de ses équipiers.',
       'Réglementation relative aux espaces d''évolution, à la plongée en autonomie et à la responsabilité (matériel obligatoire). Connaissance des principes des modèles utilisés dans les différents moyens de désaturation (incidence de l''application des GF sur les paliers). Notions de physique permettant de calculer l''autonomie du plongeur et sa consommation en profondeur et au palier en litre/minute et en bar/minute.', 'Le plongeur est capable de présenter et d''argumenter la planification d''une plongée dans la zone de 20 à 40 m dans le respect des consignes du DP. Le contrôle se fait en cours de formation, avec le souci de varier les situations d''évaluation et d''en conserver la dimension pratique. Les calculs de consommation et d''autonomie sont adaptés à la zone d''évolution.', 'PA40'
  FROM referentiel WHERE niveau = 'N3' AND version_mft = 'PA40 | PE60 (2025-12)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Prise en compte des directives du DP', 'Intégration des consignes du DP dans la planification : respect strict des profondeurs et temps de plongée, consignes pour les paliers et le retour en surface, informations sur le site, etc.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C1';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Compréhension de la topologie du site orientation', 'Prise en considération des contraintes de la topologie du site dans la planification de la plongée. Définition des moyens d''orientation appropriés : instruments, orientation instinctive.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C1';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Determination du profil de la plongée et des différentes procédures en immersion', 'En concertation avec les équipiers : définition du profil de plongée et choix des paramètres en fonction du cadre fixé par le DP, intégration de toutes les spécificités des moyens de désaturation présents dans la palanquée, anticipation au cours de la préparation de la plongée, détermination du protocole de contrôle des consommations et de celui du retour en surface, ordinaire ou avec incident.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C1';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C2', 'Évoluer en autonomie (PA40)', 2, FALSE, FALSE,
       'Le plongeur est capable d''évoluer en immersion et en surface en autonomie, dans le souci de la sécurité de la palanquée et dans le respect des choix de planification, conformément à ses prérogatives dans sa zone d''évolution.', 'Le plongeur a le souci de la maîtrise de son itinéraire tout au long de la plongée (efficacité pour rejoindre la zone d''intérêt, capacité à se situer dans son déplacement, retour à proximité du bateau, ...). Comme au PA20, les plongeurs autonomes sont co-responsables, ils portent une attention constante à la communication avec les autres membres de la palanquée, à leur surveillance régulière, au contrôle des différents paramètres de plongée prédéfinis sur le plan de l''autonomie en air et de la désaturation. Une vigilance accrue est attendue dans la gestion de la désaturation en raison de la spécificité de la zone d''évolution (gestion des paliers). Il évite les comportements « à risques » : profils de plongée inversés, yoyo, plongées répétitives, etc. Il est soucieux du déroulement des paliers et à la sécurité du retour en surface. Il signale l''exécution de paliers en pleine eau avec un parachute de signalisation, il rejoint la surface en respectant un arrêt et un tour d''horizon de sécurité à 3 m, etc.',
       'Perfectionnement de l''utilisation d''un instrument d''orientation sur des parcours variés. Connaissance de l''existence de différents modèles de désaturation. Connaissance du principe de fonctionnement d''un ordinateur et des règles d''utilisation en plongée (profils, nombre de plongées, ...). Gestion de la désaturation au sein d''une palanquée utilisant des moyens différents.', 'L''évaluation s''effectue à une profondeur proche de 40 m, en proposant au moins deux situations différentes. L''évaluation des capacités à utiliser un ordinateur de plongée s''effectue à partir de l''analyse de cas concrets, de captures d''écrans. Les situations proposées doivent induire des comportements adaptés.', 'PA40'
  FROM referentiel WHERE niveau = 'N3' AND version_mft = 'PA40 | PE60 (2025-12)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Orientation', 'Perfectionnement des compétences, orientation sur des parcours variés en utilisant le milieu (courant, relief, lumière, etc…), en identifiant des points remarquables et également en utilisant un instrument.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C2';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Évolution subaquatique', 'Mise en œuvre d''une communication adaptée avec les membres de sa palanquée : connaissance du code de communication, surveillance et intervention éventuelle, maintien de la cohésion de la palanquée. Prise en compte des imprévus (problèmes humains, environnementaux, matériels) et adaptation du déroulement de la plongée aux contraintes choisies ou qui s''imposent.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C2';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Désaturation', 'Connaissance et parfaite maîtrise de son moyen de désaturation en vue d''une application des procédures de désaturation adaptées : vitesse de remontée, paliers, cohésion de la palanquée. Prise en compte de la diversité des moyens de désaturation utilisés dans la palanquée.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C2';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C3', 'Intervenir et porter assistance à un plongeur en difficulté', 3, FALSE, FALSE,
       'Le plongeur est capable d''identifier une situation anormale et d''adopter un comportement adapté pour y remédier efficacement.', 'La réaction est rapide, sans brutalité, la prise en charge est calme et sécurisante. Le plongeur qui intervient a le souci du confort de l''assisté, il adopte une attitude rassurante. Au regard des spécificités de la zone d''évolution, le plongeur se doit d''être constamment attentif à ses co-équipiers. Une bonne condition physique est garante d''une sécurité active au sein de la palanquée.',
       'Causes, symptômes, prévention et conduites à tenir pour l''ensemble des accidents (barotraumatismes, accident de désaturation, essoufflement, oedème pulmonaire d''immersion, narcose, froid, malaises, ...).', 'Toutes les situations qui nécessitent une intervention sont évaluées à 40 m. L''assistance doit être réalisée dans au moins deux situations différentes, chacune étant réalisée intégralement, au moins deux fois. Le plongeur doit réaliser une bonne interprétation de la situation, une prise en charge rapide et efficace, une remontée régulière à une vitesse adaptée aux moyens de désaturation utilisés, un arrêt marqué dans la zone 5 à 3 m et une sortie d''eau sécurisée. Une sortie rapide de la zone d''évolution jusqu''à 30 m est acceptée dans la mesure où elle est suivie d''une régulation de la vitesse. Le palmage est autorisé mais l''utilisation optimale des gilets doit être privilégiée. Les capacités physiques sont développées pour répondre aux exigences de la plongée profonde. Elles sont évaluées par une nage capelée : il ne s''agit pas d''une épreuve chronométrée, la capacité à effectuer un parcours en surface de 300 m dans de bonnes conditions physiques constitue le critère d''évaluation.', 'PA40'
  FROM referentiel WHERE niveau = 'N3' AND version_mft = 'PA40 | PE60 (2025-12)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Observation, compréhension et réaction face à un incident', 'Interprétation des signes conventionnels. Réaction aux manifestations observables en l''absence de signe conventionnel (ventilation anormale, agitation, perte de vigilance, inconscience, ...). Prise en charge du plongeur en difficulté. Si nécessaire, passage de l''octopus, assistance et remontée à l''aide des moyens disponibles, gilets et palmes. Maîtrise de la vitesse de remontée et de la réalisation du palier en situation d''assistance.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C3';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C4', 'S''adapter à la profondeur', 4, FALSE, FALSE,
       'Le plongeur est capable d''évoluer en sécurité et d''adapter son comportement en fonction de la profondeur.', 'La mise en œuvre des prérogatives dans la zone de 40 à 60 m se réalise de manière progressive et adaptée. Les comportements attendus sont identiques à ceux acquis au PE40. L''ensemble de ces comportements est entretenu et le plongeur est sensibilisé à la nécessité de prendre en considération les contraintes liées à la plongée en zone profonde : contrôle de la consommation, prévention des incidents et accidents, communication spécifique, retour en surface et gestion de la désaturation.',
       'Sensibilisation à l''accroissement des risques liés à la profondeur (consommation, essoufflement, narcose, froid, désaturation) afin d''adapter son comportement en terme de prévention et de réaction (vigilance, réactivité, ...). Accident de désaturation : mécanismes et principaux symptômes, manifestations plus rares (cutis marmorata), prévention (respect des procédures, facteurs favorisants, comportements avant, pendant et après la plongée, profils de plongée à risques, acclimatation à la désaturation) et traitement (se limiter à la prise en charge enseignée au RIFAP).', 'L''évaluation est réalisée en situation pratique à une profondeur qui n''excède pas 40 m par un E3 minimum. Les éléments d''information théoriques sont intégrés à la pratique. L''exercice des prérogatives dans la zone de 40 à 60 m, à l''occasion de plongées encadrées par un E4, permet la mise en œuvre des compétences de manière progressive.', 'PE60'
  FROM referentiel WHERE niveau = 'N3' AND version_mft = 'PA40 | PE60 (2025-12)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Stabilisation', 'Adaptation de la maîtrise de la stabilisation par la prise en compte de l''augmentation de la profondeur et de ses incidences. Utilisation combinée du gilet et du poumon ballast : évolution équilibrée à la descente, au fond, en profondeur, à la remontée, au palier.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C4';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Mise en œuvre de l''ensemble des autres techniques', 'Entretien et perfectionnement des compétences acquises au PE40 : réalisation des techniques de ventilation, de déplacement, de communication avec le GP et ses équipiers, d''intervention en relai auprès d''un équipier en difficulté.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C4';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C5', 'Organiser la plongée', 5, FALSE, FALSE,
       'Le plongeur est capable d''organiser et de mettre œuvre une plongée dans la zone de 0 à 40 m en l''absence de DP et dans le respect de la réglementation, conformément à ses prérogatives.', 'L''organisation de la plongée est mise en œuvre avec la rigueur et le sérieux qui président aux conditions de sécurité optimales, dans le respect des différentes réglementations.',
       'Connaissance des risques et dangers du milieu. Connaissance des obligations réglementaires et des incidences sur la responsabilité civile et pénale partagées des plongeurs. Connaissance des ressources et recherche de l''information : différentes autorités, clubs locaux, etc.', 'L''évaluation repose sur la mise en œuvre complète d''une organisation de plongée, dans 2 ou 3 situations différentes a minima. La faisabilité et la pertinence des choix d''organisation constituent les critères principaux de la validation des compétences.', 'N3'
  FROM referentiel WHERE niveau = 'N3' AND version_mft = 'PA40 | PE60 (2025-12)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Choix du site', 'Prise d''informations météorologiques (vent, courant, houle, ...). Connaissance de la topologie, analyse du site et de ses particularités (courant, vent, marée, possibilités de mouillage du bateau, ...), connaissance des conditions réglementaires (restrictions de mouillage, zone protégée ou interdite, ...).'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C5';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Organisation des conditions de la plongée', 'Prise d''informations météorologiques. En cas d''utilisation d''une embarcation, vérification de sa conformité à la réglementation. Choix des modalités de plongée : surveillance surface, rotation des palanquées, etc.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C5';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Sécurisation de l''activité', 'Rédaction de la fiche de sécurité, utilisation du pavillon alpha. Vérification du matériel de secours et d''oxygénothérapie, des moyens de communication, ... (cf. RIFAP Plongée). Adaptation des conditions de plongée à l''environnement : météo, courant, vent, etc.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C5';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C6', 'Évoluer en autonomie (0-60 m)', 6, FALSE, FALSE,
       'Le plongeur est capable d''évoluer en immersion et en surface en autonomie dans le souci de la sécurité de la palanquée et dans le respect des choix de planification, conformément à ses prérogatives entre 0 et 60 m.', 'Les techniques sont semblables à celles du PA40 mais le comportement du plongeur doit être adapté aux impératifs de la plongée dans l''espace de 0 à 60 m. Une attention particulière doit être portée sur : la consommation, la planification et la gestion de la désaturation, les risques accrus (narcose, froid, essoufflement, ...), la communication et la co-gestion de la palanquée.',
       'Perfectionnement de l''utilisation d''un instrument d''orientation sur des parcours variés. Consommation en profondeur et au palier en litre/minute et en bar/minute. Le plongeur sait utiliser son ordinateur de plongée. Il identifie les différents affichages et paramètres, il connait les critères de conservatisme, sait utiliser le mode planification, connaît les valeurs limites de GF pour la plongée à l''air (GF bas = GF haut = 85 à 90%). Le plongeur est capable de gérer la désaturation au sein d''une palanquée utilisant des moyens différents.', 'L''évaluation s''effectue en proposant au moins deux situations différentes. Si elle s''effectue à une profondeur maximale de 40 m, le comportement attendu doit correspondre aux exigences des conditions de pratique de l''espace de 40 à 60 m.', 'N3'
  FROM referentiel WHERE niveau = 'N3' AND version_mft = 'PA40 | PE60 (2025-12)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Orientation', 'Perfectionnement des compétences, orientation sur des parcours variés en utilisant le milieu (courant, relief, lumière, etc…), en identifiant des points remarquables et également en utilisant un instrument.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C6';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Évolution subaquatique', 'Mise en œuvre d''une communication adaptée avec les membres de sa palanquée : connaissance du code de communication, surveillance et intervention éventuelle, maintien de la cohésion de la palanquée. Prise en compte des imprévus (problèmes humains, environnementaux, matériels) et adaptation du déroulement de la plongée aux contraintes choisies ou qui s''imposent.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C6';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Désaturation', 'Connaissance et parfaite maîtrise de son moyen de désaturation en vue d''une application des procédures de désaturation adaptées : vitesse de remontée, paliers, cohésion de la palanquée. Prise en compte de la diversité des moyens de désaturation utilisés dans la palanquée.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C6';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C7', 'Respecter le milieu et l''environnement', 7, FALSE, FALSE,
       'Le plongeur adopte une attitude éco-responsable, il évolue dans le respect de l''environnement subaquatique et en connaissance du milieu.', 'Le plongeur évolue en limitant son impact sur l''environnement. Il adopte une attitude respectueuse à l''égard de la faune et de la flore : il limite l''éclairage et les nuisances sonores, il est le plus discret possible, il refuse le nourrissage. Il développe sa capacité d''observation.',
       'Connaissance du milieu (faune et flore courantes, risques et dangers du milieu). Connaissance liée au respect de l''environnement, à l''impact du plongeur sur le milieu (respect de la tranquillité de la faune, absence de dégradation). Présentation de la Charte internationale du plongeur responsable.', 'Au cours des plongées en milieu naturel, le comportement respectueux et responsable du plongeur est évalué. Il sait décrire et nommer les espèces les plus fréquemment rencontrées.', 'Commun'
  FROM referentiel WHERE niveau = 'N3' AND version_mft = 'PA40 | PE60 (2025-12)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Aisance aquatique', 'Perfectionnement des acquis du PA20 dans la réalisation de déplacements équilibrés, sans appui, avec un palmage et une stabilisation maitrisés.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C7';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, regroupement)
SELECT id, 'C8', 'Connaissances théoriques PA40 - N3', 8, TRUE, FALSE,
       'Les connaissances des niveaux antérieurs sont considérées comme maîtrisées. L''évaluation peut permettre de vérifier ce point.', NULL,
       NULL, NULL, 'PA40 - N3'
  FROM referentiel WHERE niveau = 'N3' AND version_mft = 'PA40 | PE60 (2025-12)';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Théorie de l''activité', 'Notions de physique en lien avec les prérogatives, calculs de consommation et d''autonomie en gaz permettant de planifier la plongée (consommation en profondeur et au palier en litre/minute et en bar/minute).'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C8';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Accidents', 'Causes, symptômes, prévention et conduite à tenir pour l''ensemble des accidents. Les mécanismes sont précisés pour permettre une bonne compréhension des phénomènes dans le cadre des prérogatives d''autonomie. L''accent est mis sur les accidents en lien avec la zone d''évolution : narcose, froid, essoufflement, accident de désaturation. La prévention et la conduite à tenir constituent les éléments fondamentaux à acquérir.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C8';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Procédures de désaturation', 'Connaissance du modèle de Haldane et dérivés. Principe du modèle (M-values et GF), jeux de paramètres (Bühlmann, ZHL-16C, RGBM). Non-modélisation des plongées successives, principe de la majoration. Connaissance du principe de fonctionnement d''un ordinateur et des règles d''utilisation en plongée, principes et règles de cohabitation de différentes procédures.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C8';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Réglementation', 'Prérogatives et responsabilités du plongeur, réglementation relative aux espaces d''évolution, à la plongée en autonomie (avec et sans DP) et à la responsabilité. Connaissance du cadre fédéral.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C8';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 5, 'Milieu et environnement', 'Charte internationale du plongeur responsable, connaissances du milieu subaquatique (le comportement respectueux et responsable du plongeur est évalué). Connaissance des dangers du milieu.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND b.code = 'C8';

