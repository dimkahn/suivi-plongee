-- ============================================================
--  Schéma d'un exercice de la base : une image (PNG ou JPEG) qui
--  montre l'organisation dans l'eau. Table séparée, comme
--  photo_eleve : l'image ne doit jamais alourdir les lectures de la
--  base d'exercices (grille, programme), qui ne disent que si un
--  schéma existe. Remplaçable depuis /admin/exercices ; disparaît
--  avec l'exercice.
--
--  Contenu initial : V53 (migration Java), les schémas du document
--  du club pour le N1, découpés exercice par exercice.
-- ============================================================

CREATE TABLE schema_exercice (
    exercice_id    BIGINT PRIMARY KEY REFERENCES exercice_competence(id) ON DELETE CASCADE,
    contenu        BYTEA       NOT NULL,
    type_contenu   VARCHAR(30) NOT NULL,
    mise_a_jour_le TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_schema_exercice_type CHECK (type_contenu IN ('image/jpeg', 'image/png'))
);
