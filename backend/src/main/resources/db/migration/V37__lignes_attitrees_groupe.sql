-- ============================================================
--  Plusieurs lignes attitrees par groupe d'entrainement.
--
--  Un groupe nombreux occupe parfois deux lignes d'eau (par exemple
--  les debutants sur les lignes 5 et 6). Les lignes attitrees passent
--  dans une table de liaison, comme les encadrants et les referents.
--
--  La colonne groupe_entrainement.espace_attitre_id reste en base,
--  inutilisee : les donnees de demonstration V104 et V107, qui passent
--  apres cette migration, l'ecrivent encore ; V111 recopie leurs
--  valeurs dans la nouvelle table.
-- ============================================================

CREATE TABLE groupe_entrainement_espace (
    groupe_id  BIGINT NOT NULL REFERENCES groupe_entrainement(id) ON DELETE CASCADE,
    espace_id  BIGINT NOT NULL REFERENCES espace_bassin(id) ON DELETE CASCADE,
    PRIMARY KEY (groupe_id, espace_id)
);

INSERT INTO groupe_entrainement_espace (groupe_id, espace_id)
SELECT id, espace_attitre_id FROM groupe_entrainement WHERE espace_attitre_id IS NOT NULL;

UPDATE groupe_entrainement SET espace_attitre_id = NULL;
