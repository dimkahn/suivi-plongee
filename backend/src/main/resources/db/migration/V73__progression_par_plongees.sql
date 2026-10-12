-- ============================================================
--  Progression type découpée par plongées (2026) : pour un centre de
--  plongée en mer, où un N1 se passe en quelques jours et où chaque
--  élève commence le jour où il arrive, une progression ne se lit plus
--  au calendrier mais au numéro de plongée en milieu naturel de
--  l'élève (étape « plongée 3 », « plongées 5 à 6 »).
--
--  progression_type.decoupage : MOIS (toutes les progressions
--  existantes, rien ne change pour elles) ou PLONGEES. Une période
--  porte soit sa plage de mois, soit sa plage de plongées, selon le
--  découpage de sa progression (règle tenue par ProgressionService).
-- ============================================================

ALTER TABLE progression_type ADD COLUMN decoupage VARCHAR(20) NOT NULL DEFAULT 'MOIS';
ALTER TABLE progression_type ADD CONSTRAINT ck_progression_decoupage
    CHECK (decoupage IN ('MOIS', 'PLONGEES'));

ALTER TABLE periode_progression ALTER COLUMN mois_debut DROP NOT NULL;
ALTER TABLE periode_progression ALTER COLUMN mois_fin DROP NOT NULL;
ALTER TABLE periode_progression ADD COLUMN plongee_debut INTEGER;
ALTER TABLE periode_progression ADD COLUMN plongee_fin INTEGER;
ALTER TABLE periode_progression ADD CONSTRAINT ck_periode_plongees
    CHECK (plongee_debut IS NULL OR (plongee_debut >= 1 AND plongee_fin >= plongee_debut));
