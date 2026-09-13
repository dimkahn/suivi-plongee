-- ============================================================
--  Trombinoscope : photo d'un élève, distincte du consentement.
--
--  autorisation_image est un consentement a part entiere, different
--  d'autorisation_legale (qui ne couvre que la pratique de la plongee) :
--  le club suit des mineurs, une photo ne s'affiche jamais sans ce
--  consentement explicite.
-- ============================================================

ALTER TABLE eleve ADD COLUMN autorisation_image BOOLEAN NOT NULL DEFAULT FALSE;

-- Table separee : la photo (potentiellement volumineuse) ne doit jamais
-- alourdir les lectures courantes d'un Eleve (jointures cursus, roster...).
CREATE TABLE photo_eleve (
    eleve_id       BIGINT PRIMARY KEY REFERENCES eleve(id) ON DELETE CASCADE,
    contenu        BYTEA       NOT NULL,
    type_contenu   VARCHAR(30) NOT NULL,
    mise_a_jour_le TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_photo_type CHECK (type_contenu IN ('image/jpeg', 'image/png'))
);
