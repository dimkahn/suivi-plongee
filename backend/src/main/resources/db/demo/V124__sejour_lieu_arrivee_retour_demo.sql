-- Demonstration (profil dev) : le lieu d'arrivee des voyages retour du
-- sejour a Port-Cros (V117, colonne de V89).
UPDATE sejour_participant SET depart_lieu_arrivee = 'Paris-Orly'
 WHERE depart_numero = 'AF7527'
   AND sortie_id = (SELECT id FROM sortie WHERE nom = 'Séjour à Port-Cros');

UPDATE sejour_participant SET depart_lieu_arrivee = 'Paris Gare de Lyon'
 WHERE depart_numero = 'TGV 6178'
   AND sortie_id = (SELECT id FROM sortie WHERE nom = 'Séjour à Port-Cros');
