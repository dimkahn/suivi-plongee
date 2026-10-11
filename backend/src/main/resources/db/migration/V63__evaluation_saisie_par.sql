-- ============================================================
--  Un référent de groupe peut noter au nom d'un autre encadrant
--  qui ne l'a pas fait (choix du club, 2026). La note porte alors
--  le nom de cet encadrant (moniteur_id), et garde la trace de
--  celui qui l'a réellement saisie :
--  - evaluation.saisi_par_id : le référent qui a saisi la note ;
--    null quand le moniteur a noté lui-même (cas habituel).
-- ============================================================

ALTER TABLE evaluation ADD COLUMN saisi_par_id BIGINT REFERENCES utilisateur(id);
