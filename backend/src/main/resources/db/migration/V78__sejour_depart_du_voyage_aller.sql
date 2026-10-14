-- ============================================================
--  Séjour (V75), suite : l'heure et le lieu de départ du voyage aller.
--
--  L'arrivée d'un participant (arrivee_*) porte l'heure et le lieu où il
--  arrive sur place (qui aller chercher, et quand). Pour lui conseiller
--  l'heure à laquelle être à l'aéroport ou à la gare le jour du départ
--  (encart « Aujourd'hui » du séjour), il faut aussi l'heure à laquelle
--  part son avion ou son train, et d'où. Le retour (depart_*) porte déjà
--  l'heure et le lieu de départ.
--
--  Une heure de départ plus tardive que l'heure d'arrivée = départ la
--  veille (vol de nuit), calculé par l'écran.
-- ============================================================

ALTER TABLE sejour_participant ADD COLUMN arrivee_heure_depart TIME;
ALTER TABLE sejour_participant ADD COLUMN arrivee_lieu_depart VARCHAR(120);
