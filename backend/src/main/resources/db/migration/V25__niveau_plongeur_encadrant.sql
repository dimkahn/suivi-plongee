-- ============================================================
--  Niveau de plongeur d'un encadrant (N1 a N5), distinct de son
--  niveau d'encadrement : un E1 (initiateur) peut n'etre que N2.
--  Saisi par un ADMIN (ecran Moniteurs), affiche avec le niveau
--  d'encadrement dans les listes de choix de plongeurs. Nullable :
--  inconnu tant que l'admin ne l'a pas renseigne.
-- ============================================================

ALTER TABLE utilisateur ADD COLUMN niveau_plongeur VARCHAR(2);
ALTER TABLE utilisateur ADD CONSTRAINT ck_niveau_plongeur
    CHECK (niveau_plongeur IN ('N1','N2','N3','N4','N5'));
ALTER TABLE utilisateur_aud ADD COLUMN niveau_plongeur VARCHAR(2);
