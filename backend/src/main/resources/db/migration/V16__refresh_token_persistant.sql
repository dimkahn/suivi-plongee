-- ============================================================
--  « Se souvenir de moi ».
--
--  Un jeton persistant est pose dans un cookie qui survit a la fermeture
--  du navigateur (duree app.jwt.duree-refresh-jours) ; sinon, cookie de
--  session et duree courte cote serveur (app.jwt.duree-session-heures).
--  Le choix est porte par le jeton pour survivre a sa rotation.
--
--  Les jetons deja emis l'ont ete en mode persistant : DEFAULT TRUE.
-- ============================================================

ALTER TABLE refresh_token ADD COLUMN persistant BOOLEAN NOT NULL DEFAULT TRUE;
