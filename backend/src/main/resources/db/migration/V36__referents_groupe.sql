-- ============================================================
--  Referents d'un groupe d'entrainement, a la place du moniteur
--  referent de chaque eleve.
--
--  Un groupe a des encadrants attitres (groupe_entrainement_encadrant,
--  V26) ; parmi eux, un ou plusieurs referents, qui suivent les eleves
--  du groupe. Un referent est toujours aussi un encadrant attitre :
--  regle tenue par GroupeEntrainementService, pour que le planning
--  (capacite de la fosse, presences, avertissements) n'ait qu'une liste
--  a lire.
--
--  Le moniteur referent porte par chaque cursus disparait : les eleves
--  sont maintenant ranges dans des groupes, il faisait doublon.
-- ============================================================

CREATE TABLE groupe_entrainement_referent (
    groupe_id       BIGINT NOT NULL REFERENCES groupe_entrainement(id) ON DELETE CASCADE,
    utilisateur_id  BIGINT NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
    PRIMARY KEY (groupe_id, utilisateur_id)
);

ALTER TABLE cursus DROP COLUMN moniteur_referent_id;
ALTER TABLE cursus_aud DROP COLUMN moniteur_referent_id;
