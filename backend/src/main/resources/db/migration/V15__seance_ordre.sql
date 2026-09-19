-- Rang de la seance dans sa journee (1, 2, 3...), pour distinguer plusieurs
-- seances a la meme date et numeroter la plongee sur la fiche de securite.
-- Defaut a 1 : les seances existantes restent la seule/premiere de leur jour.
ALTER TABLE seance ADD COLUMN ordre INT NOT NULL DEFAULT 1;

-- Seance est @Audited (Envers) : la table d'historique doit suivre la meme colonne.
ALTER TABLE seance_aud ADD COLUMN ordre INT;

-- Aptitude que le DP accorde pour la sortie, distincte du niveau/brevet detenu
-- (colonne "aptitude" existante) : le DP peut restreindre ou elargir la
-- prerogative selon les conditions du jour.
ALTER TABLE membre_palanquee ADD COLUMN aptitude_donnee_par_dp VARCHAR(60);
