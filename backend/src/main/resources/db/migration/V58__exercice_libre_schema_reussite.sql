-- ============================================================
--  Programme d'une séance : un exercice libre reçoit, comme un
--  exercice de la base, un critère de réussite et un schéma
--  (choix du club, 2026). Un exercice tiré de la base garde ceux
--  de la base (colonnes laissées vides).
--
--  Le programme se remplace d'un bloc (suppression puis réinsertion
--  des exercice_seance) : le schéma vit donc dans sa propre table,
--  rattachée à la séance, et l'exercice n'en garde que l'id. Un
--  schéma que plus aucun exercice ne cite est effacé à un
--  enregistrement suivant (ProgrammeSeanceService), après un délai
--  qui laisse à un autre encadrant le temps d'enregistrer le sien.
--  Comme schema_exercice, table à part : l'image ne doit jamais
--  alourdir la lecture du programme ni de la grille.
-- ============================================================

CREATE TABLE schema_programme (
    id             BIGSERIAL PRIMARY KEY,
    seance_id      BIGINT      NOT NULL REFERENCES seance(id) ON DELETE CASCADE,
    contenu        BYTEA       NOT NULL,
    type_contenu   VARCHAR(30) NOT NULL,
    cree_le        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_schema_programme_type CHECK (type_contenu IN ('image/jpeg', 'image/png'))
);

CREATE INDEX ix_schema_programme_seance ON schema_programme(seance_id);

ALTER TABLE exercice_seance ADD COLUMN critere_reussite TEXT;
ALTER TABLE exercice_seance ADD COLUMN schema_id BIGINT REFERENCES schema_programme(id) ON DELETE SET NULL;
