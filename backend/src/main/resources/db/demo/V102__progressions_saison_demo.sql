-- Demonstration (profil dev) : la saison de demo suit les progressions
-- proposees par V22, pour voir le programme sur les seances.
INSERT INTO progression_saison (saison_id, progression_id)
SELECT s.id, p.id
  FROM saison s, progression_type p
 WHERE s.libelle = '2025-2026';
