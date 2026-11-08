-- ============================================================
--  Base d'exercices et référentiels relus contre les MFT
--  (N2 PA20 | PE40 de mai 2026, N3 PA40 | PE60 de décembre 2025).
--
--  1. N3 : « Intervenir et porter assistance à un plongeur en difficulté »
--     se valide en fin de formation (MFT N3, fiche de suivi), comme ses
--     deux homologues du N2.
--  2. N2 : la validation se fait dans l'espace 0-20 m par un E2 (MFT).
--     8.8 « Ventilation en profondeur » ramené à 20 m ; 9.7 (plongée
--     progressive jusqu'à 40 m sous un E3) n'est plus obligatoire, 9.8
--     (consignes inattendues du GP) le devient pour « Communiquer avec le
--     guide de palanquée ». Les deux restent dans la base.
--  3. N3 : 3.9 « Nage capelée de 300 m » obligatoire : le MFT en fait le
--     critère d'évaluation de la condition physique.
--  4. N2 : « Évoluer en autonomie » exige la résolution d'au moins un
--     problème de table (MFT). 5.6 n'était qu'un perfectionnement : le
--     problème de table entre dans 5.9, maîtrise en milieu naturel, qui
--     devient obligatoire.
--
--  Les notes déjà prises gardent leur phase et leur état.
-- ============================================================

-- 1. N3 : assistance validée en fin de formation
UPDATE bloc_competence SET valider_en_dernier = TRUE
 WHERE intitule = 'Intervenir et porter assistance à un plongeur en difficulté'
   AND referentiel_id IN (SELECT id FROM referentiel WHERE niveau = 'N3' AND version_mft = 'PA40 | PE60 (2025-12)');

-- 2. N2 : obligatoires dans l'espace de validation 0-20 m, par un E2
UPDATE exercice_competence
   SET deroulement = 'Milieu naturel, jusqu''à 20 m. Ventilation adaptée à un effort normal à modéré, passage tuba-embout en surface, lâcher et reprise d''embout au fond, expiration à la remontée.',
       critere_reussite = 'Ventilation régulée à toutes les étapes, aucun essoufflement.',
       conseils = 'Validation dans l''espace 0-20 m par un E2 (MFT). Dans l''espace 0-40 m, la formation se poursuit progressivement sous la responsabilité d''un E3 (exercice 11.9 et 9.7). Surveiller la consommation ; remonter au moindre doute.'
 WHERE numero = '8.8'
   AND bloc_id IN (SELECT b.id FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
                    WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)');

UPDATE exercice_competence SET obligatoire = FALSE
 WHERE numero = '9.7'
   AND bloc_id IN (SELECT b.id FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
                    WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)');

UPDATE exercice_competence SET obligatoire = TRUE
 WHERE numero = '9.8'
   AND bloc_id IN (SELECT b.id FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
                    WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)');

-- 3. N3 : nage capelée de 300 m obligatoire
UPDATE exercice_competence SET obligatoire = TRUE
 WHERE numero = '3.9'
   AND bloc_id IN (SELECT b.id FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
                    WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)');

-- 4. N2 : problème de table dans l'exercice de maîtrise 5.9, obligatoire
--    (5.6 reste l'entraînement au sec ; trois maîtrises par compétence)
UPDATE exercice_competence
   SET intitule = 'Autonomie en conditions variées et problème de table',
       obligatoire = TRUE,
       deroulement = 'Milieu naturel : visibilité réduite, courant, site nouveau. Gestion de la désaturation partagée dans la palanquée ; questions orales sur des situations concrètes. Au bord ou au bateau, résolution d''au moins un problème de table fédérale (pas d''utilisation planifiée, pas de lecture inverse, pas d''altitude ni de mélange autre que l''air, pas d''oxygène en surface ou au palier).',
       critere_reussite = 'Décisions adaptées, réponses justes, problème de table résolu et expliqué.'
 WHERE numero = '5.9'
   AND bloc_id IN (SELECT b.id FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id
                    WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)');
