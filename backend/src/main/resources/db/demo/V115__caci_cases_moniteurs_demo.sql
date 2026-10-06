-- ============================================================
--  Demo : detail du CACI des encadrants (V47), a cote des fins de
--  validite de V101. La presidente : medecin federal, ensemble des
--  activites ; e3 : generaliste, scaphandre et apnee seulement, avec
--  des limites a lire sur le certificat papier.
--  Les autres : date de l'examen deduite de la fin de validite, comme
--  le fait V48 sur une base reelle (les demos passent apres elle).
-- ============================================================

UPDATE utilisateur
   SET caci_date_examen = DATEADD('YEAR', -1, certificat_valide_jusqu_au)
 WHERE caci_date_examen IS NULL AND certificat_valide_jusqu_au IS NOT NULL;

UPDATE utilisateur
   SET caci_date_examen = DATEADD('MONTH', -4, CURRENT_DATE),
       caci_medecin = 'FEDERAL',
       caci_activites = 'ENSEMBLE_ACTIVITES'
 WHERE email = 'presidente@club.fr';

UPDATE utilisateur
   SET caci_date_examen = DATEADD('DAY', -353, CURRENT_DATE),
       caci_medecin = 'GENERALISTE',
       caci_activites = 'PLONGEE_SCAPHANDRE,APNEE,LIMITES_PRECONISATIONS'
 WHERE email = 'e3@club.fr';
