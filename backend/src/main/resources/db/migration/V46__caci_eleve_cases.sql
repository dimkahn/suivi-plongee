-- ============================================================
--  CACI d'un eleve, d'apres le modele FFESSM « Version Juin 2026 » :
--  date de l'examen, qualite du medecin (generaliste, du sport,
--  medecine subaquatique, federal, autre) et cases cochees
--  (ensemble des activites, ou seulement scaphandre / apnee /
--  apnee au-dela de 6 m / nage avec accessoires ; competition ;
--  limites et preconisations). Codes separes par des virgules
--  (ActiviteCaci).
--
--  Toujours pas le certificat lui-meme, ni le texte ecrit par le
--  medecin (activites en competition, detail des limites) : la case
--  « limites » renvoie l'encadrant au certificat papier. Vide pour
--  les dossiers existants (a completer au prochain CACI).
-- ============================================================

ALTER TABLE eleve ADD COLUMN caci_date_examen DATE;
ALTER TABLE eleve ADD COLUMN caci_medecin VARCHAR(30);
ALTER TABLE eleve ADD COLUMN caci_activites VARCHAR(400);

ALTER TABLE eleve_aud ADD COLUMN caci_date_examen DATE;
ALTER TABLE eleve_aud ADD COLUMN caci_medecin VARCHAR(30);
ALTER TABLE eleve_aud ADD COLUMN caci_activites VARCHAR(400);
