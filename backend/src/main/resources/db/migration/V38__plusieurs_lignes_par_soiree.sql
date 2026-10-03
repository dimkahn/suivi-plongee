-- ============================================================
--  Planning du bassin : un groupe peut occuper plusieurs lignes d'eau
--  un soir donne (par exemple les lignes 5 et 6 au lieu de sa ligne 2).
--
--  affectation_groupe.espace_id garde le premier espace de la consigne
--  (la fosse, ou la premiere ligne) ; les lignes en plus vont dans cette
--  table de liaison. Les consignes existantes et les donnees de
--  demonstration, qui n'ecrivent que espace_id, restent valables telles
--  quelles.
-- ============================================================

CREATE TABLE affectation_groupe_ligne (
    affectation_id  BIGINT NOT NULL REFERENCES affectation_groupe(id) ON DELETE CASCADE,
    espace_id       BIGINT NOT NULL REFERENCES espace_bassin(id) ON DELETE CASCADE,
    PRIMARY KEY (affectation_id, espace_id)
);
