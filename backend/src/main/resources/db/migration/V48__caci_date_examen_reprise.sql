-- ============================================================
--  CACI : la fin de validite se deduit desormais de la date de
--  l'examen (examen + 1 an, Caci.finValidite) ; seule la date de
--  l'examen se saisit. Pour les dossiers qui n'avaient que la fin
--  de validite, on en deduit la date de l'examen (fin - 1 an), pour
--  qu'une prochaine modification du dossier ne l'efface pas.
-- ============================================================

UPDATE eleve
   SET caci_date_examen = CAST(certificat_valide_jusqu_au - INTERVAL '1' YEAR AS DATE)
 WHERE caci_date_examen IS NULL AND certificat_valide_jusqu_au IS NOT NULL;

UPDATE utilisateur
   SET caci_date_examen = CAST(certificat_valide_jusqu_au - INTERVAL '1' YEAR AS DATE)
 WHERE caci_date_examen IS NULL AND certificat_valide_jusqu_au IS NOT NULL;
