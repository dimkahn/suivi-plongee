-- ============================================================
--  Theorie en plus de la nage ou du bloc (choix du club, 2026).
--  Une seance peut combiner un atelier dans l'eau (NAGE ou BLOC) et
--  de la theorie, ou n'etre que de la theorie (atelier THEORIE, comme
--  avant). La colonne dit si l'eleve a fait de la theorie, quel que
--  soit l'atelier : toujours vraie pour l'atelier THEORIE.
-- ============================================================

ALTER TABLE participation ADD COLUMN theorie BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE participation SET theorie = TRUE WHERE atelier = 'THEORIE';
