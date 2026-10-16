-- Demonstration (profil dev) : l'heure d'arrivee des voyages retour du
-- sejour a Port-Cros (V117, colonne de V85).
UPDATE sejour_participant SET depart_heure_arrivee = TIME '21:35:00'
 WHERE depart_numero = 'AF7527'
   AND sortie_id = (SELECT id FROM sortie WHERE nom = 'Séjour à Port-Cros');

UPDATE sejour_participant SET depart_heure_arrivee = TIME '22:37:00'
 WHERE depart_numero = 'TGV 6178'
   AND sortie_id = (SELECT id FROM sortie WHERE nom = 'Séjour à Port-Cros');
