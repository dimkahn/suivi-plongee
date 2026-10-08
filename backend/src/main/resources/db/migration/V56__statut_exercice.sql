-- ============================================================
--  Une note porte sur l'exercice réalisé (choix du club, 2026) :
--  un exercice d'initiation ou de perfectionnement peut être
--  « acquis » sans que le critère le soit. On garde donc deux
--  états par note :
--  - evaluation.statut : l'état du critère qui en découle (lu,
--    comme avant, par la validation des blocs et la délivrance) ;
--  - evaluation.statut_exercice : l'état de l'exercice noté, tel
--    que le moniteur l'a saisi ; null pour une note sans exercice.
--  Le critère ne passe à acquis que sur un exercice de maîtrise
--  (EvaluationService).
--
--  Reprise : les notes déjà prises sur un exercice gardent leur
--  état comme état de l'exercice (jusqu'ici, les deux étaient égaux).
-- ============================================================

ALTER TABLE evaluation ADD COLUMN statut_exercice VARCHAR(20);

UPDATE evaluation SET statut_exercice = statut WHERE exercice_id IS NOT NULL;
