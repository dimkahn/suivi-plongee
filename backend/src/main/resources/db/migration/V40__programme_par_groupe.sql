-- ============================================================
--  Programme d'exercices par groupe d'entrainement : chaque groupe
--  de la saison prepare sa propre seance (ses encadrants attitres,
--  ou un admin). groupe_id null : programme commun a toute la
--  seance (seance sans groupes, sortie en milieu naturel...) ; les
--  exercices deja saisis avec V39 y restent.
--
--  La fiche de suivi d'un eleve montre le programme de son groupe
--  et le programme commun. Supprimer un groupe emporte ses
--  programmes.
-- ============================================================

ALTER TABLE exercice_seance
    ADD COLUMN groupe_id BIGINT REFERENCES groupe_entrainement(id) ON DELETE CASCADE;

CREATE INDEX ix_exercice_seance_groupe ON exercice_seance(groupe_id);
