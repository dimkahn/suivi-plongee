-- Demonstration (profil dev) : l'heure et le lieu de depart des voyages
-- aller du sejour a Port-Cros (V117, colonnes de V78), pour l'encart
-- « Aujourd'hui » et son conseil « soyez a l'aeroport vers... ».
UPDATE sejour_participant SET arrivee_heure_depart = TIME '17:05:00', arrivee_lieu_depart = 'Paris-Orly'
 WHERE arrivee_numero = 'AF7520'
   AND sortie_id = (SELECT id FROM sortie WHERE nom = 'Séjour à Port-Cros');

UPDATE sejour_participant SET arrivee_heure_depart = TIME '16:58:00', arrivee_lieu_depart = 'Paris Gare de Lyon'
 WHERE arrivee_numero = 'TGV 6171'
   AND sortie_id = (SELECT id FROM sortie WHERE nom = 'Séjour à Port-Cros');
