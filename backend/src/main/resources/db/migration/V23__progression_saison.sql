-- ============================================================
--  Progressions suivies par une saison : au plus une par referentiel
--  (regle tenue par ProgressionService, le referentiel n'etant pas une
--  colonne de cette table). Une seance affiche, pour chacune, la periode
--  qui couvre son mois. Choix de l'admin depuis /admin/saisons : aucune
--  progression n'est rattachee d'office a une saison par une migration.
-- ============================================================

CREATE TABLE progression_saison (
    saison_id       BIGINT NOT NULL REFERENCES saison(id) ON DELETE CASCADE,
    progression_id  BIGINT NOT NULL REFERENCES progression_type(id) ON DELETE CASCADE,
    PRIMARY KEY (saison_id, progression_id)
);
