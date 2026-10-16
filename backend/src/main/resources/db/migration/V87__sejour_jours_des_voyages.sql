-- ============================================================
--  Séjour (V75), suite : le jour de départ du voyage aller et le jour
--  d'arrivée du voyage retour.
--
--  L'arrivée porte l'heure de départ de l'avion ou du train (V78), le
--  départ l'heure d'arrivée du voyage retour (V85), mais pas leur jour :
--  l'écran le devinait (départ plus tard que l'arrivée = la veille). Un
--  vol long, avec escale ou décalage horaire, part deux jours avant ou
--  arrive deux jours après : le jour se saisit maintenant.
--
--  Vide = comme avant : le jour de l'arrivée (ou du départ), la veille
--  pour un vol de nuit.
-- ============================================================

ALTER TABLE sejour_participant ADD COLUMN arrivee_date_depart DATE;
ALTER TABLE sejour_participant ADD COLUMN depart_date_arrivee DATE;
