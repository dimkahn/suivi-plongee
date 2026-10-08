-- ============================================================
--  Programme d'une séance : un exercice libre (hors base des
--  compétences) peut lui aussi être rangé en initiation,
--  perfectionnement ou maîtrise (choix du club, 2026). Facultatif :
--  null pour un échauffement ou une nage. Un exercice tiré de la
--  base prend la phase de la base (colonne laissée vide).
-- ============================================================

ALTER TABLE exercice_seance ADD COLUMN phase VARCHAR(20);

ALTER TABLE exercice_seance ADD CONSTRAINT ck_exercice_seance_phase
    CHECK (phase IS NULL OR phase IN ('INITIATION', 'PERFECTIONNEMENT', 'MAITRISE'));
