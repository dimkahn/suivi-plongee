-- Demonstration (profil dev) : la reservation des vols de Camille
-- (eleve@club.fr) au sejour a Port-Cros (V117, colonnes de V96) : terminal,
-- ouverture de l'enregistrement en ligne, numero de dossier (fictif) et lien.
UPDATE sejour_participant
   SET arrivee_terminal = '1', arrivee_dossier = 'DEMO42',
       arrivee_lien_enregistrement = 'https://wwws.airfrance.fr',
       arrivee_ouverture_enregistrement = TIMESTAMP '2027-06-02 17:00:00',
       depart_dossier = 'DEMO42',
       depart_lien_enregistrement = 'https://wwws.airfrance.fr',
       depart_ouverture_enregistrement = TIMESTAMP '2027-06-06 20:10:00'
 WHERE email = 'eleve@club.fr'
   AND sortie_id = (SELECT id FROM sortie WHERE nom = 'Séjour à Port-Cros');

-- Le terminal de depart d'Orly est le meme pour tous ceux du vol AF7520.
UPDATE sejour_participant SET arrivee_terminal = '1'
 WHERE arrivee_numero = 'AF7520'
   AND sortie_id = (SELECT id FROM sortie WHERE nom = 'Séjour à Port-Cros');
