-- ============================================================
--  Voiture de location d'un séjour : le mail de réservation du
--  loueur (instructions de retrait, numéro de réservation...),
--  collé en HTML par un organisateur.
--
--  Le serveur ne garde que le HTML nettoyé (NettoyageHtml) : texte,
--  titres, listes, tableaux et liens ; ni script, ni formulaire, ni
--  image, ni mise en forme (style). Lu par les encadrants, et dans
--  le carnet par le conducteur et les passagers de cette voiture
--  seulement (le mail peut porter le nom et le téléphone de celui
--  qui a réservé).
-- ============================================================

ALTER TABLE sejour_voiture ADD COLUMN location_html TEXT;
