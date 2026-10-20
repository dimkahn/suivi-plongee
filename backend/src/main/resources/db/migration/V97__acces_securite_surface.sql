-- ============================================================
--  Comptes « sécurité surface » limités dans le temps et aux
--  séances confiées (choix du club, 2026) : créés pour une sortie,
--  une séance ou quelques séances, ils ne voient et ne complètent
--  que les fiches de ces séances, et ne se connectent plus après
--  utilisateur.acces_jusqu_au (inclus). Null : pas de limite
--  (moniteurs, et comptes de sécurité surface d'avant cette
--  migration, à reprendre dans l'écran Sécurité surface).
--  La séance supprimée disparaît de la liste du compte.
-- ============================================================

ALTER TABLE utilisateur ADD COLUMN acces_jusqu_au DATE;
ALTER TABLE utilisateur_aud ADD COLUMN acces_jusqu_au DATE;

CREATE TABLE securite_surface_seance (
    utilisateur_id BIGINT NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
    seance_id      BIGINT NOT NULL REFERENCES seance(id) ON DELETE CASCADE,
    PRIMARY KEY (utilisateur_id, seance_id)
);
CREATE INDEX ix_securite_surface_seance_seance ON securite_surface_seance(seance_id);
