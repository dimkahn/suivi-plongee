-- ============================================================
--  Séjour (V75), suite : l'heure d'arrivée du voyage retour.
--
--  Le départ d'un participant (depart_*) porte l'heure et le lieu d'où
--  part son avion ou son train. Pour savoir à quelle heure il arrive chez
--  lui (qui va le chercher à l'aéroport ou à la gare, et quand), il faut
--  aussi l'heure d'arrivée du voyage retour, comme l'aller porte déjà
--  l'heure de départ (V78).
--
--  Une heure d'arrivée plus matinale que l'heure de départ = arrivée le
--  lendemain (vol de nuit).
-- ============================================================

ALTER TABLE sejour_participant ADD COLUMN depart_heure_arrivee TIME;
