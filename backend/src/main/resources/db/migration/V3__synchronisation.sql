-- ============================================================
--  Support de la saisie hors ligne.
--
--  Une saisie faite au bord du bassin peut etre rejouee plusieurs fois
--  (reseau coupe en cours de requete, relance de l'application, onglet
--  duplique). La reference generee par le client rend l'operation
--  idempotente : rejouer la meme saisie ne cree pas de doublon.
-- ============================================================

ALTER TABLE evaluation ADD COLUMN reference_client VARCHAR(36);

CREATE UNIQUE INDEX uq_evaluation_reference_client
    ON evaluation (reference_client);
