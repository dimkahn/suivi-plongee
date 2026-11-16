-- ============================================================
--  Le justificatif d'une dépense de séjour peut être un PDF (facture
--  reçue par e-mail), plus seulement une photo JPEG ou PNG de la note
--  (demande du club, 2026-11).
--  La contrainte de V77 n'a pas de nom (et H2 et PostgreSQL ne lui
--  donnent pas le même) : on passe par une nouvelle colonne, dont la
--  contrainte est nommée, et l'ancienne part avec la sienne.
-- ============================================================

ALTER TABLE sejour_depense_photo ADD COLUMN type_fichier VARCHAR(30);
UPDATE sejour_depense_photo SET type_fichier = type_contenu;
ALTER TABLE sejour_depense_photo DROP COLUMN type_contenu;
ALTER TABLE sejour_depense_photo ALTER COLUMN type_fichier SET NOT NULL;
ALTER TABLE sejour_depense_photo RENAME COLUMN type_fichier TO type_contenu;
ALTER TABLE sejour_depense_photo ADD CONSTRAINT ck_sejour_depense_photo_type
    CHECK (type_contenu IN ('application/pdf', 'image/jpeg', 'image/png'));
