-- ============================================================
--  Les repas d'un séjour pris au restaurant (ou que l'on n'a pas
--  à préparer), choisis par l'organisateur pour la liste de
--  courses (demande du club, 2026). Tous les autres repas, du
--  premier au dernier jour de la sortie, sont à faire soi-même.
--
--  repas : PETIT_DEJEUNER, DEJEUNER ou DINER (RepasSejour).
--  La liste se remplace d'un bloc ; elle disparaît avec la sortie.
-- ============================================================

CREATE TABLE sejour_repas_au_restaurant (
    sortie_id  BIGINT NOT NULL REFERENCES sortie(id) ON DELETE CASCADE,
    jour       DATE NOT NULL,
    repas      VARCHAR(20) NOT NULL,
    PRIMARY KEY (sortie_id, jour, repas)
);
