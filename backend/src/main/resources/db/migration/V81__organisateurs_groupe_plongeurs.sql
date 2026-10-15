-- ============================================================
--  Qui modifie un groupe de plongeurs (choix du club, 2026) : le compte
--  qui a cree la liste et les organisateurs qu'il a designes, comme pour
--  un sejour (V80). Les autres encadrants la lisent et la reprennent dans
--  leurs fiches de securite ; etre ADMIN ne suffit pas pour la modifier
--  (un ADMIN peut seulement changer la liste des organisateurs, pour
--  reprendre un groupe dont le createur est inconnu ou a quitte le club).
--
--  Les groupes deja crees : pas d'historique (groupe_plongeurs n'est pas
--  audite), donc pas de createur connu ; un ADMIN designe leurs
--  organisateurs.
-- ============================================================

ALTER TABLE groupe_plongeurs ADD COLUMN createur_id BIGINT REFERENCES utilisateur(id) ON DELETE SET NULL;

CREATE TABLE groupe_plongeurs_organisateur (
    groupe_id       BIGINT NOT NULL REFERENCES groupe_plongeurs(id) ON DELETE CASCADE,
    utilisateur_id  BIGINT NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
    PRIMARY KEY (groupe_id, utilisateur_id)
);
