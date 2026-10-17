-- ============================================================
--  Séjour (V75), suite : le lieu (aéroport, gare) où arrive le voyage
--  retour.
--
--  L'aller porte le lieu d'où part l'avion ou le train (V78), le retour
--  seulement l'heure (V85) et le jour (V87) où il arrive : qui va
--  chercher qui au retour, et où, demandait d'écrire l'aéroport dans les
--  remarques.
--
--  Vide = comme avant, le lieu n'est pas montré.
-- ============================================================

ALTER TABLE sejour_participant ADD COLUMN depart_lieu_arrivee VARCHAR(120);
