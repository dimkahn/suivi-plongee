-- Abandon de la notion de code de bloc (C1..C9, B1..B11, ...) : ce n'a jamais
-- ete un identifiant partage de sens entre niveaux ou revisions (voir
-- CLAUDE.md), et aucune regle metier ne s'appuyait dessus (le booleen
-- valider_en_dernier porte a lui seul la regle "dernier bloc a valider").
-- Les blocs sont desormais identifies par leur position (ordre) au sein du
-- referentiel, deja NOT NULL et deja porteuse de cet ordre d'affichage.
ALTER TABLE bloc_competence DROP CONSTRAINT uq_bloc;
ALTER TABLE bloc_competence DROP COLUMN code;
ALTER TABLE bloc_competence ADD CONSTRAINT uq_bloc UNIQUE (referentiel_id, ordre);
