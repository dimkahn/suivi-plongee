-- ============================================================
--  Niveau d'encadrement prepare par un moniteur en formation
--  (ex. un E2 stagiaire E3). Saisi par un ADMIN (ecran Moniteurs),
--  toujours au-dessus du niveau detenu. Un stagiaire E3 encadre
--  comme un E3 dans la proposition automatique des palanquees
--  (choix du club, 2026), sous la responsabilite de son tuteur.
--  Nullable : ne prepare rien.
-- ============================================================

ALTER TABLE utilisateur ADD COLUMN niveau_encadrement_prepare VARCHAR(2);
ALTER TABLE utilisateur ADD CONSTRAINT ck_niveau_encadrement_prepare
    CHECK (niveau_encadrement_prepare IN ('E1','E2','E3','E4'));
ALTER TABLE utilisateur_aud ADD COLUMN niveau_encadrement_prepare VARCHAR(2);
