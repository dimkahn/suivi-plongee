-- La réservation de chaque voyage d'un participant au séjour (demande du
-- club, 2026) : terminal de départ, moment où ouvre l'enregistrement en
-- ligne, numéro de dossier et lien vers l'enregistrement de la compagnie.
-- Le dossier et le lien permettent de modifier ou d'annuler le billet :
-- seuls le voyageur et les organisateurs du séjour les lisent (filtré par
-- SejourService).
ALTER TABLE sejour_participant ADD COLUMN arrivee_terminal VARCHAR(30);
ALTER TABLE sejour_participant ADD COLUMN arrivee_dossier VARCHAR(30);
ALTER TABLE sejour_participant ADD COLUMN arrivee_lien_enregistrement VARCHAR(500);
ALTER TABLE sejour_participant ADD COLUMN arrivee_ouverture_enregistrement TIMESTAMP;
ALTER TABLE sejour_participant ADD COLUMN depart_terminal VARCHAR(30);
ALTER TABLE sejour_participant ADD COLUMN depart_dossier VARCHAR(30);
ALTER TABLE sejour_participant ADD COLUMN depart_lien_enregistrement VARCHAR(500);
ALTER TABLE sejour_participant ADD COLUMN depart_ouverture_enregistrement TIMESTAMP;
