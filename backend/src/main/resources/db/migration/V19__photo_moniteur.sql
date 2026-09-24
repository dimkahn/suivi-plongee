-- ============================================================
--  Trombinoscope des moniteurs : photo d'un encadrant.
--
--  Comme pour l'eleve (V5), le droit a l'image est un consentement a
--  part entiere, recueilli par un ADMIN : une photo n'est ni acceptee
--  ni affichee sans lui, et le retirer supprime la photo.
--  Utilisateur est audite (Envers) : la colonne existe aussi dans _aud.
-- ============================================================

ALTER TABLE utilisateur ADD COLUMN autorisation_image BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE utilisateur_aud ADD COLUMN autorisation_image BOOLEAN;

-- Table separee : la photo ne doit jamais alourdir le chargement d'un
-- Utilisateur (fait a chaque requete authentifiee par JwtAuthFilter).
CREATE TABLE photo_utilisateur (
    utilisateur_id BIGINT PRIMARY KEY REFERENCES utilisateur(id) ON DELETE CASCADE,
    contenu        BYTEA       NOT NULL,
    type_contenu   VARCHAR(30) NOT NULL,
    mise_a_jour_le TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_photo_utilisateur_type CHECK (type_contenu IN ('image/jpeg', 'image/png'))
);
