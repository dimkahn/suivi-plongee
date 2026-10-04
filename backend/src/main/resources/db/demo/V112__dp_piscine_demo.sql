-- ============================================================
--  Demo : un DP piscine sur les soirees deja renseignees de la
--  saison 2026-2027 (leur ancien responsable est devenu DP fosse,
--  V41). La prochaine soiree n'en a pas encore : a designer.
-- ============================================================

UPDATE soiree_planning
   SET dp_piscine_id = (SELECT id FROM utilisateur WHERE email = 'e2@club.fr')
 WHERE date_soiree < CURRENT_DATE
   AND saison_id = (SELECT id FROM saison WHERE libelle = '2026-2027');
