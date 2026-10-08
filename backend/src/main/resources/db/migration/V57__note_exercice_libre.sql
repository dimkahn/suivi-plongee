-- ============================================================
--  Une note peut porter sur un exercice libre du programme de la
--  séance (choix du club, 2026), pourvu qu'il travaille le critère
--  noté et qu'il ait une phase. Le programme se remplace d'un bloc,
--  sans historique : la note en garde donc une copie, comme une
--  trace, et non un lien vers exercice_seance.
--  - evaluation.exercice_libre : intitulé de l'exercice libre ;
--  - evaluation.phase_exercice : sa phase (INITIATION,
--    PERFECTIONNEMENT, MAITRISE), qui fait l'état du critère comme
--    celle d'un exercice de la base.
--  Null pour une note sans exercice ou sur un exercice de la base.
-- ============================================================

ALTER TABLE evaluation ADD COLUMN exercice_libre VARCHAR(200);
ALTER TABLE evaluation ADD COLUMN phase_exercice VARCHAR(20);
