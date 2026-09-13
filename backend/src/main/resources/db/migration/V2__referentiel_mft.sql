-- ============================================================
--  Referentiel de competences MFT : plongeur N1, N2 et N3
--  Genere par outils/generer_referentiel.py - ne pas editer a la main.
--  Source : MFT CTN FFESSM - https://mft.readthedocs.io/fr/latest/
-- ============================================================

-- ---------- N1 (MFT 2016-11-15) ----------
INSERT INTO referentiel (niveau, version_mft, date_application, source, actif,
        age_minimum, niveau_prerequis, qualification_requise, milieu_naturel_exclusif,
        niveau_encadrant_validation, niveau_encadrant_delivrance,
        profondeur_max_validation, profondeur_max_formation, prerogative_profondeur)
VALUES ('N1', '2016-11-15', DATE '2016-11-15', 'MFT CTN FFESSM - https://mft.readthedocs.io/fr/latest/', TRUE,
        14, NULL, NULL, FALSE,
        'E1', 'E3',
        6, 20, 20);

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C1', 'Utiliser l''équipement de plongée', 1, FALSE, FALSE
  FROM referentiel WHERE niveau = 'N1' AND version_mft = '2016-11-15';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'S''équiper du matériel individuel.', 'Choisit un équipement et un lestage adaptés aux conditions et à la nature de la plongée.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C1';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Gréer et dégréer l''ensemble bloc / gilet / détendeur.', 'Monte le matériel sans erreur et effectue les réglages nécessaires.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C1';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Tester et vérifier le fonctionnement de l''équipement.', 'Contrôle le bon fonctionnement, vérifie la quantité d''air, ajuste son lestage, signale tout défaut.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C1';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Entretenir le matériel.', 'Rince avec les précautions d''usage, sait décontaminer un détendeur, range correctement.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C1';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 5, 'Embarquer sur un navire support de plongée.', 'Porte et range son équipement sans risque pour lui-même et son entourage.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C1';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C2', 'Évoluer en environnement aquatique et subaquatique', 2, FALSE, FALSE
  FROM referentiel WHERE niveau = 'N1' AND version_mft = '2016-11-15';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Se mettre à l''eau et remonter sur le support.', 'Utilise une technique adaptée au support et aux conditions ; prévient les incidents de cette phase.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C2';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'S''immerger.', 'Choisit une technique d''immersion adaptée au contexte et équilibre ses oreilles.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C2';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Se déplacer en surface et en immersion.', 'Palmage adapté au contexte ; une distance d''environ 50 m doit pouvoir être parcourue.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C2';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Se ventiler en surface et en immersion.', 'Utilise tuba ou détendeur selon le besoin ; ne bloque pas l''expiration à la remontée (REC de 6 m).'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C2';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 5, 'Éliminer l''eau du masque en immersion.', 'Maintient une ventilation normale au contact de l''eau et évacue l''eau sans stress.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C2';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 6, 'S''équilibrer en surface et à toute profondeur.', 'Ajuste sa flottabilité au gilet et au poumon-ballast, en statique comme en dynamique.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C2';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C3', 'Évoluer en palanquée guidée', 3, FALSE, FALSE
  FROM referentiel WHERE niveau = 'N1' AND version_mft = '2016-11-15';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Comprendre et respecter les consignes du GP.', 'Applique sans erreur les conditions d''évolution fixées ; interroge le GP en cas de doute.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C3';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Surveiller son stock d''air.', 'Suit la pression du bloc et informe le GP aux valeurs convenues.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C3';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Se positionner selon les situations et les conditions.', 'Reste au contact du GP et des équipiers, se place dans son champ de vision en cas d''intervention.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C3';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Assurer sa remontée en palanquée.', 'Respecte la vitesse de remontée et les paliers éventuels, avec ou sans appui.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C3';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C6', 'Participer à la sécurité en plongée', 4, FALSE, FALSE
  FROM referentiel WHERE niveau = 'N1' AND version_mft = '2016-11-15';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Connaître les risques de l''activité et leur prévention.', 'Cite pour lui-même les mesures de prévention et les procédures de sécurité courantes.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C6';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Demander et recevoir l''aide du GP ou d''un équipier.', 'Demande de l''aide dès que nécessaire, assure sa flottabilité, adopte un comportement conforme.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C6';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Gérer une remontée isolée après perte de palanquée.', 'Remonte à vitesse normale, tour d''horizon, se signale en surface et attend une prise en charge.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C6';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Prendre en charge un équipier en difficulté en attendant le GP.', 'Réagit au signe conventionnel, évite d''augmenter la profondeur, fournit air ou aide adaptée (simulation).'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C6';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C7', 'Connaître et respecter l''environnement marin', 5, FALSE, FALSE
  FROM referentiel WHERE niveau = 'N1' AND version_mft = '2016-11-15';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Évoluer en limitant son impact sur le milieu.', 'Maîtrise flottabilité et palmage, évite tout contact avec la faune et la flore, ne nourrit ni ne harcèle.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C7';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Développer sa capacité d''observation.', 'Évite les gestes brusques, approche discrètement, échange avec le GP après la plongée.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C7';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Connaître la charte internationale du plongeur responsable.', 'Applique les gestes et attitudes décrits dans la charte.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C7';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Reconnaître les principales espèces rencontrées.', 'Décrit et nomme les animaux couramment observés pendant la formation.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C7';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C8', 'Connaissances en appui des compétences', 6, TRUE, FALSE
  FROM referentiel WHERE niveau = 'N1' AND version_mft = '2016-11-15';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Équipement du plongeur : rôles, montage, entretien, hygiène.', 'S''équipe sans erreur, règle et teste le matériel, identifie et signale les dysfonctionnements.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C8';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Procédures de désaturation.', 'Connaît la courbe de plongée sans palier et les différents moyens de désaturation.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C8';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Risques de l''activité, prévention et bonnes pratiques.', 'Cite les principaux risques et les mesures de prévention, avec des notions de physique simples.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C8';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Réglementation relative à l''activité.', 'Prérogatives du N1, documents nécessaires, carnet et passeport de plongée, cadre fédéral.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = '2016-11-15' AND b.code = 'C8';

-- ---------- N2 (MFT 2015-01-02) ----------
INSERT INTO referentiel (niveau, version_mft, date_application, source, actif,
        age_minimum, niveau_prerequis, qualification_requise, milieu_naturel_exclusif,
        niveau_encadrant_validation, niveau_encadrant_delivrance,
        profondeur_max_validation, profondeur_max_formation, prerogative_profondeur)
VALUES ('N2', '2015-01-02', DATE '2015-01-02', 'MFT CTN FFESSM - https://mft.readthedocs.io/fr/latest/', TRUE,
        16, 'N1', NULL, TRUE,
        'E2', 'E3',
        20, 40, 40);

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C1', 'Utiliser l''équipement de plongée', 1, FALSE, FALSE
  FROM referentiel WHERE niveau = 'N2' AND version_mft = '2015-01-02';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'S''équiper du matériel individuel.', 'Choisit équipement et lestage adaptés ; le lestage est déterminant en vue de la plongée à 40 m.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C1';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Gréer et dégréer l''ensemble bloc / gilet / détendeur.', 'Monte le matériel sans erreur et effectue les réglages nécessaires.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C1';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Tester et vérifier le fonctionnement de l''équipement.', 'Contrôle son matériel, vérifie son air et prend connaissance de l''équipement de ses équipiers.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C1';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Entretenir le matériel.', 'Rince avec les précautions d''usage, sait décontaminer un détendeur, range correctement.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C1';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 5, 'Embarquer sur un navire support de plongée.', 'Porte et range son équipement sans risque ni gêne pour les autres.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C1';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C2', 'Évoluer en environnement aquatique et subaquatique', 2, FALSE, FALSE
  FROM referentiel WHERE niveau = 'N2' AND version_mft = '2015-01-02';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Se mettre à l''eau et remonter sur le support.', 'Utilise une technique adaptée au support et aux conditions ; prévient les incidents de cette phase.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C2';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'S''immerger.', 'Choisit une technique d''immersion adaptée au contexte et équilibre ses oreilles.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C2';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Se déplacer en surface et en immersion.', 'Palmage adapté au contexte ; une distance d''environ 250 m doit pouvoir être parcourue.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C2';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Se ventiler en surface et en immersion.', 'Utilise tuba ou détendeur selon le besoin ; ne bloque pas l''expiration à la remontée (REC de 10 m).'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C2';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 5, 'Éliminer l''eau du masque en immersion.', 'Maintient une ventilation normale au contact de l''eau et évacue l''eau spontanément, sans stress.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C2';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 6, 'S''équilibrer en surface et à toute profondeur.', 'Ajuste sa flottabilité au gilet et au poumon-ballast et adapte sa ventilation à la profondeur.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C2';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 7, 'Maîtriser la vitesse de descente et de remontée.', 'Combine un palmage minimal et une gestion progressive du gilet ; arrive au fond pratiquement équilibré.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C2';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C3', 'Évoluer en palanquée guidée', 3, FALSE, FALSE
  FROM referentiel WHERE niveau = 'N2' AND version_mft = '2015-01-02';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Comprendre et respecter les consignes du GP.', 'Applique sans erreur les conditions d''évolution fixées ; comportement responsable dans la palanquée.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C3';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Surveiller son stock d''air.', 'Suit la pression du bloc et informe le GP aux valeurs convenues.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C3';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Se positionner selon les situations et les conditions.', 'Reste au contact, vérifie régulièrement la situation du GP et des équipiers.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C3';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C4', 'Planifier et organiser la plongée en autonomie', 4, FALSE, FALSE
  FROM referentiel WHERE niveau = 'N2' AND version_mft = '2015-01-02';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Comprendre le site de plongée et les conditions environnementales.', 'Décrit la topographie et les conditions probables à partir du briefing du DP et de sa propre observation.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C4';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Comprendre et respecter les directives du DP.', 'Identifie zone et conditions d''évolution, interroge le DP, l''informe de tout élément utile.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C4';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Prendre connaissance de l''expérience, de l''équipement et des attentes des équipiers.', 'Échange et se concerte, s''informe du fonctionnement du matériel de ses équipiers.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C4';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Décider du profil de plongée et des procédures, prévoir les variantes.', 'Convient du déroulement avec ses équipiers, choisit le protocole de décompression, vérifie l''autonomie en air.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C4';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C5', 'Maîtriser, adapter l''évolution en immersion', 5, FALSE, FALSE
  FROM referentiel WHERE niveau = 'N2' AND version_mft = '2015-01-02';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Se diriger en utilisant le milieu et les instruments.', 'Mémorise la topographie, maîtrise son itinéraire et émerge à moins de 50 m du point prévu.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C5';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Appliquer les bonnes pratiques d''évolution et les procédures définies.', 'Surveille ses équipiers, respecte vitesses et paliers, évite les profils à risque, signale ses paliers au parachute, arrêt et tour d''horizon à 3 m.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C5';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C6', 'Participer à la sécurité des équipiers', 6, FALSE, TRUE
  FROM referentiel WHERE niveau = 'N2' AND version_mft = '2015-01-02';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Se rappeler les mesures de prévention des risques avant l''immersion.', 'Cite les procédures de sécurité, y compris remontée lente ou rapide et paliers interrompus.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C6';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Identifier les comportements et circonstances susceptibles de générer une situation dangereuse.', 'Interprète les signes conventionnels et les manifestations visibles d''un plongeur en difficulté.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C6';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Réagir individuellement et collectivement à une situation anormale.', 'Fournit une source d''air (simulation), prend le contrôle de la remontée aux gilets, sécurise en surface et participe à la sortie de l''eau.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C6';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C7', 'Connaître et respecter l''environnement marin', 7, FALSE, FALSE
  FROM referentiel WHERE niveau = 'N2' AND version_mft = '2015-01-02';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Évoluer en limitant son impact sur le milieu.', 'Gère ses instruments source de perturbation et explore dans le respect du milieu, en l''absence de GP.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C7';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Développer sa capacité d''observation.', 'Approche sans effrayer, reconnaît les types d''habitats, partage ses observations avec la palanquée.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C7';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Connaître la charte internationale du plongeur responsable.', 'Applique les gestes et attitudes décrits dans la charte.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C7';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Reconnaître les principaux groupes rencontrés.', 'Identifie des représentants des groupes les plus couramment rencontrés en formation.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C7';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C8', 'Connaissances en appui des compétences', 8, TRUE, FALSE
  FROM referentiel WHERE niveau = 'N2' AND version_mft = '2015-01-02';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Équipement du plongeur : rôles, montage, entretien, hygiène.', 'S''équipe sans erreur, règle et teste le matériel, sait décontaminer un détendeur.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C8';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Réglementation relative à l''activité.', 'Prérogatives du N2, documents nécessaires, carnet et passeport de plongée, cadre fédéral.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C8';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Notions physiques utiles à la pratique.', 'Effets du milieu, fonctionnement du matériel, calcul d''une autonomie en air ou d''une flottabilité.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C8';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Incidents, accidents et risques liés à l''autonomie.', 'Causes, symptômes, prévention et conduite à tenir.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C8';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 5, 'Outils et procédures de décompression, planification d''une plongée.', 'Tables et ordinateur, plongées consécutives et successives, remontées anormales, calcul de consommation.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = '2015-01-02' AND b.code = 'C8';

-- ---------- N3 (MFT 2016-01-01) ----------
INSERT INTO referentiel (niveau, version_mft, date_application, source, actif,
        age_minimum, niveau_prerequis, qualification_requise, milieu_naturel_exclusif,
        niveau_encadrant_validation, niveau_encadrant_delivrance,
        profondeur_max_validation, profondeur_max_formation, prerogative_profondeur)
VALUES ('N3', '2016-01-01', DATE '2016-01-01', 'MFT CTN FFESSM - https://mft.readthedocs.io/fr/latest/', TRUE,
        18, 'N2', 'RIFAP', TRUE,
        'E3', 'E3',
        40, 60, 60);

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C4', 'Planifier et organiser la plongée', 1, FALSE, FALSE
  FROM referentiel WHERE niveau = 'N3' AND version_mft = '2016-01-01';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Évaluer les caractéristiques du site et les conditions de plongée.', 'Comprend la topographie et les conditions à partir du DP et de sa propre analyse ; la partage avec ses équipiers.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C4';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'S''approprier et respecter les directives du DP.', 'Comprend les paramètres de zone et de conditions, interroge le DP, l''informe de tout élément utile.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C4';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'S''intéresser au profil des équipiers.', 'Dialogue sur l''expérience, l''équipement et les attentes ; sait utiliser le matériel de ses équipiers.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C4';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Prévoir les phases de la plongée et les variantes utiles.', 'Élabore le profil prévu, définit le protocole de décompression, vérifie l''autonomie en air nécessaire.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C4';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C5', 'Maîtriser, adapter l''évolution en immersion', 2, FALSE, FALSE
  FROM referentiel WHERE niveau = 'N3' AND version_mft = '2016-01-01';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Se diriger en utilisant le milieu et les instruments.', 'Maîtrise son itinéraire, sait où il se trouve à tout moment et retrouve le mouillage.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C5';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Respecter des pratiques et des procédures d''évolution sécurisantes.', 'Surveille ses équipiers, respecte les paramètres du DP et les procédures de décompression, évite les profils à risque, arrêt et tour d''horizon à 3 m.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C5';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C6', 'Participer à la sécurité en plongée', 3, FALSE, FALSE
  FROM referentiel WHERE niveau = 'N3' AND version_mft = '2016-01-01';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Se préparer à prévenir les risques avant l''immersion.', 'Connaît les mesures de prévention et les procédures de sécurité à appliquer.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C6';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Identifier les situations anormales et les demandes d''aide des équipiers.', 'Réagit sans délai au signe conventionnel et connaît les signes visibles d''un plongeur en difficulté.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C6';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Intervenir pour un équipier en difficulté.', 'Maintient l''immersion si possible, apporte l''aide nécessaire, prend le contrôle de la remontée aux gilets et sécurise en surface.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C6';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C7', 'Connaître et respecter l''environnement marin', 4, FALSE, FALSE
  FROM referentiel WHERE niveau = 'N3' AND version_mft = '2016-01-01';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Évoluer en limitant son impact sur le milieu.', 'Gère ses instruments source de perturbation ; acquis du N2 à perfectionner.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C7';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Développer sa capacité d''observation.', 'Identifie traces et indices de présence animale, connaît les caractéristiques des milieux explorés.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C7';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Connaître la charte internationale du plongeur responsable.', 'Applique les gestes et attitudes décrits dans la charte.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C7';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Identifier les grands groupes d''animaux et de végétaux.', 'Identifie, décrit et nomme des représentants des principaux groupes, par clés de détermination.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C7';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C8', 'Connaissances en appui des compétences', 5, TRUE, FALSE
  FROM referentiel WHERE niveau = 'N3' AND version_mft = '2016-01-01';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Équipement du plongeur : rôles, montage, entretien, hygiène.', 'S''équipe sans erreur, règle et teste le matériel, signale le matériel hors d''état.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C8';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Réglementation relative à l''activité.', 'Prérogatives du N3, documents, matériel de secours et armement du bateau, cadre fédéral.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C8';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Notions physiques utiles à la pratique.', 'Effets du milieu, fonctionnement du matériel, calcul d''une autonomie en air ou d''une flottabilité.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C8';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Incidents, accidents et risques liés à l''autonomie.', 'Causes, symptômes, prévention et conduite à tenir.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C8';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 5, 'Outils et procédures de décompression, planification d''une plongée.', 'Tables et ordinateur, plongées consécutives et successives, remontées anormales, calcul de consommation.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C8';

INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)
SELECT id, 'C9', 'Choisir un site de plongée', 6, FALSE, FALSE
  FROM referentiel WHERE niveau = 'N3' AND version_mft = '2016-01-01';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 1, 'Prendre en compte l''expérience des équipiers et le support surface.', 'Recueille ces informations, analyse le contexte et prévoit un site approprié.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C9';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 2, 'Recueillir les informations sur le site et sur le trajet.', 'Cartes marines, bulletins météo, annuaire des marées, courants, mouillage, fréquentation, durée du trajet.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C9';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 3, 'Analyser les conditions environnementales sur site.', 'Vérifie sur place la faisabilité de la plongée prévue, y compris le matériel de sécurité disponible.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C9';
INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)
SELECT b.id, 4, 'Planifier et organiser la plongée en l''absence de DP.', 'Établit la fiche de sécurité et les paramètres, définit le protocole de décompression, applique les procédures du plan de secours.'
  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = '2016-01-01' AND b.code = 'C9';

