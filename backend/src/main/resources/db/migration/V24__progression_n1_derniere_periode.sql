-- ============================================================
--  Correction de la proposition N1 de V22 : sa derniere periode
--  (mai-juin, milieu naturel) reprenait les onze blocs, ce qui
--  repoussait l'echeance de chacun au 30 juin et rendait le retard
--  sans objet. Le N1 PE20 se valide en piscine ou en fosse (6 m) :
--  seuls restent en fin de saison la mise a l'eau depuis le bateau
--  (ordre 2) et le respect du milieu (ordre 7), propres au milieu
--  naturel. Les autres blocs sont attendus a la fin de leur derniere
--  periode en piscine / fosse.
--
--  Ne touche que la progression installee par V22, reperee par son
--  nom : une progression renommee ou recreee par l'admin est laissee
--  telle quelle.
-- ============================================================

DELETE FROM periode_progression_bloc
 WHERE periode_id IN (
        SELECT pp.id
          FROM periode_progression pp
          JOIN progression_type p ON p.id = pp.progression_id
          JOIN referentiel r ON r.id = p.referentiel_id
         WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)'
           AND p.nom = 'N1 – progression type du club' AND pp.rang = 5)
   AND bloc_id IN (
        SELECT b.id
          FROM bloc_competence b
          JOIN referentiel r ON r.id = b.referentiel_id
         WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)'
           AND b.ordre NOT IN (2, 7));

UPDATE periode_progression
   SET note = 'Plongées en mer ou en lac : mise à l''eau depuis le bateau, découverte et respect du milieu. Les autres compétences, validables en piscine ou en fosse, sont attendues avant.'
 WHERE rang = 5
   AND progression_id IN (
        SELECT p.id
          FROM progression_type p
          JOIN referentiel r ON r.id = p.referentiel_id
         WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)'
           AND p.nom = 'N1 – progression type du club');
