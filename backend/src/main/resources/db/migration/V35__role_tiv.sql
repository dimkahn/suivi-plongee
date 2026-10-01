-- ============================================================
--  Role TIV (technicien en inspection visuelle) : remplit la fiche
--  d'inspection des blocs (V34) et consulte le materiel, sans gerer
--  l'inventaire ni les prets, reserves au directeur technique.
--  Donne par un ADMIN dans l'ecran Moniteurs, cumule avec MONITEUR.
-- ============================================================

ALTER TABLE utilisateur_role DROP CONSTRAINT ck_role;
ALTER TABLE utilisateur_role ADD CONSTRAINT ck_role
    CHECK (role IN ('ADMIN', 'MONITEUR', 'ELEVE', 'DIRECTEUR_TECHNIQUE', 'TIV'));
