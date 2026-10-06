-- ============================================================
--  CACI d'un moniteur : memes informations que pour un eleve (V46),
--  saisies par un ADMIN dans l'ecran Moniteurs : date de l'examen,
--  qualite du medecin et cases cochees du formulaire FFESSM.
--  Jamais le certificat, ni le texte ecrit par le medecin.
-- ============================================================

ALTER TABLE utilisateur ADD COLUMN caci_date_examen DATE;
ALTER TABLE utilisateur ADD COLUMN caci_medecin VARCHAR(30);
ALTER TABLE utilisateur ADD COLUMN caci_activites VARCHAR(400);

ALTER TABLE utilisateur_aud ADD COLUMN caci_date_examen DATE;
ALTER TABLE utilisateur_aud ADD COLUMN caci_medecin VARCHAR(30);
ALTER TABLE utilisateur_aud ADD COLUMN caci_activites VARCHAR(400);
