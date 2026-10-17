-- ============================================================
--  Niveau d'encadrement d'un plongeur d'un groupe de sejour,
--  distinct de son niveau de plongeur (colonne aptitude) et du
--  niveau qu'il prepare (qualification_preparee) : un E1 peut
--  n'etre que N2. Texte libre comme les deux autres (E1, MF1...),
--  pre-rempli depuis le dossier, saisi pour un exterieur.
-- ============================================================

ALTER TABLE membre_groupe_plongeurs ADD COLUMN niveau_encadrement VARCHAR(120);
