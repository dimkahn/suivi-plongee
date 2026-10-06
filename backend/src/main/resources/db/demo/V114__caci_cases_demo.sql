-- ============================================================
--  Demo : date de l'examen, medecin et cases cochees du CACI (V46)
--  pour les eleves de demo qui ont une fin de validite : examen un
--  an avant, ensemble des activites par un generaliste. Camille
--  (N2) : scaphandre et apnee seulement ; Sonia (N3) : medecin
--  federal, avec la competition et des limites a lire sur le papier.
-- ============================================================

UPDATE eleve
   SET caci_date_examen = CAST(certificat_valide_jusqu_au - INTERVAL '1' YEAR AS DATE),
       caci_medecin = 'GENERALISTE',
       caci_activites = 'ENSEMBLE_ACTIVITES'
 WHERE certificat_valide_jusqu_au IS NOT NULL
   AND CAST(certificat_valide_jusqu_au - INTERVAL '1' YEAR AS DATE) <= CURRENT_DATE;

UPDATE eleve SET caci_activites = 'PLONGEE_SCAPHANDRE,APNEE'
 WHERE numero_licence = 'A-01-000010' AND caci_activites IS NOT NULL;

UPDATE eleve SET caci_medecin = 'FEDERAL',
                 caci_activites = 'ENSEMBLE_ACTIVITES,COMPETITION,LIMITES_PRECONISATIONS'
 WHERE numero_licence = 'A-01-000012' AND caci_activites IS NOT NULL;
