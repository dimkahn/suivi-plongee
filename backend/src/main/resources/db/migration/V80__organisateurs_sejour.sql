-- ============================================================
--  Qui modifie un sejour (choix du club, 2026) : son createur (celui qui a
--  cree la sortie) et les organisateurs qu'il a designes. Les autres
--  encadrants le lisent avec leur compte, les participants par le lien et
--  le code ; etre ADMIN ou directeur technique ne suffit plus pour le
--  modifier (un ADMIN peut seulement changer la liste des organisateurs,
--  pour reprendre un sejour dont le createur a quitte le club).
--
--  Les sorties deja creees : une ligne de sejour pour chacune, et le
--  createur retrouve dans l'historique Envers de la sortie (revision de
--  creation, dont l'acteur est l'e-mail du compte). Introuvable (sortie
--  saisie en SQL, compte supprime) = pas de createur : un ADMIN designe
--  alors les organisateurs.
-- ============================================================

ALTER TABLE sejour ADD COLUMN createur_id BIGINT REFERENCES utilisateur(id) ON DELETE SET NULL;

CREATE TABLE sejour_organisateur (
    sortie_id       BIGINT NOT NULL REFERENCES sortie(id) ON DELETE CASCADE,
    utilisateur_id  BIGINT NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
    PRIMARY KEY (sortie_id, utilisateur_id)
);

INSERT INTO sejour (sortie_id)
SELECT s.id FROM sortie s WHERE NOT EXISTS (SELECT 1 FROM sejour j WHERE j.sortie_id = s.id);

UPDATE sejour SET createur_id = (
    SELECT MIN(u.id)
      FROM sortie_aud a
      JOIN revision_audit r ON r.id = a.rev
      JOIN utilisateur u ON u.email = r.acteur
     WHERE a.id = sejour.sortie_id AND a.revtype = 0);
