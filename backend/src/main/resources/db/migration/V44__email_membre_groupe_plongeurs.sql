-- ============================================================
--  E-mail d'un plongeur d'un groupe de sejour : en fin de sejour,
--  chacun recoit par courriel les parametres des seules plongees
--  ou il figure (temps, profondeur, palanquee, site). Facultatif :
--  vide, l'e-mail du dossier (eleve ou encadrant) sert a la place.
-- ============================================================

ALTER TABLE membre_groupe_plongeurs ADD COLUMN email VARCHAR(255);
