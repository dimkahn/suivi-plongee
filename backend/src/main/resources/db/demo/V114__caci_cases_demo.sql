-- ============================================================
--  Demo : date de l'examen et cases cochees du CACI (V46) pour les
--  eleves de demo qui ont une fin de validite : examen un an avant,
--  plongee en scaphandre en loisir. Camille (N2) a aussi l'apnee,
--  Sonia (N3) la competition et l'encadrement.
-- ============================================================

UPDATE eleve
   SET caci_date_examen = CAST(certificat_valide_jusqu_au - INTERVAL '1' YEAR AS DATE),
       caci_activites = 'PLONGEE_SCAPHANDRE,LOISIR'
 WHERE certificat_valide_jusqu_au IS NOT NULL
   AND CAST(certificat_valide_jusqu_au - INTERVAL '1' YEAR AS DATE) <= CURRENT_DATE;

UPDATE eleve SET caci_activites = 'PLONGEE_SCAPHANDRE,APNEE,LOISIR'
 WHERE numero_licence = 'A-01-000010' AND caci_activites IS NOT NULL;

UPDATE eleve SET caci_activites = 'PLONGEE_SCAPHANDRE,LOISIR,COMPETITION,ENSEIGNEMENT_ENCADREMENT'
 WHERE numero_licence = 'A-01-000012' AND caci_activites IS NOT NULL;
