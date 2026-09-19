-- ============================================================
--  Dernier niveau de plongee connu d'un eleve (ex. "N2"), declaratif :
--  pre-remplit l'aptitude d'un membre de palanquee ou d'un groupe de
--  plongeurs quand l'eleve n'a pas encore de cursus DELIVRE dans
--  l'application (brevet obtenu avant l'usage de l'outil, ou dans un
--  autre club). Un cursus delivre ici reste prioritaire.
-- ============================================================

ALTER TABLE eleve ADD COLUMN dernier_niveau VARCHAR(20);
ALTER TABLE eleve_aud ADD COLUMN dernier_niveau VARCHAR(20);
