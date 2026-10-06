-- ============================================================
--  CACI d'un eleve : date de l'examen et cases cochees par le
--  medecin sur le formulaire FFESSM (activites et modes de
--  pratique couverts : plongee en scaphandre, apnee, competition,
--  encadrement...). Codes separes par des virgules (ActiviteCaci).
--
--  Toujours pas le certificat lui-meme, ni restriction ni remarque
--  du medecin : seulement ce qui est couvert. Vide pour les dossiers
--  existants (a completer au prochain CACI).
-- ============================================================

ALTER TABLE eleve ADD COLUMN caci_date_examen DATE;
ALTER TABLE eleve ADD COLUMN caci_activites VARCHAR(400);

ALTER TABLE eleve_aud ADD COLUMN caci_date_examen DATE;
ALTER TABLE eleve_aud ADD COLUMN caci_activites VARCHAR(400);
