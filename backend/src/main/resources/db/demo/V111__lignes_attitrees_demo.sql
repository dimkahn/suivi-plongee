-- Demonstration : les lignes attitrees ecrites par V104 et V107 dans
-- l'ancienne colonne passent dans groupe_entrainement_espace (V37), et les
-- debutants de la saison 2026-2027 occupent deux lignes, 5 et 6.

INSERT INTO groupe_entrainement_espace (groupe_id, espace_id)
SELECT id, espace_attitre_id FROM groupe_entrainement WHERE espace_attitre_id IS NOT NULL;

UPDATE groupe_entrainement SET espace_attitre_id = NULL;

INSERT INTO groupe_entrainement_espace (groupe_id, espace_id)
SELECT g.id, e.id
  FROM groupe_entrainement g
  JOIN saison s ON s.id = g.saison_id
  JOIN espace_bassin e ON e.nom = 'Ligne 5'
 WHERE s.libelle = '2026-2027' AND g.nom = 'Débutants';
