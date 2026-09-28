-- Demonstration (profil dev) : le week-end a Blaisy de la saison de demo,
-- avec ses deux plongees (V100).
INSERT INTO sortie (nom, lieu, date_debut, date_fin, remarques)
VALUES ('Week-end à Blaisy', 'Carrière de Blaisy', DATE '2025-10-11', DATE '2025-10-12',
        'Départ du club le samedi à 7 h.');

INSERT INTO sortie_seance (sortie_id, seance_id)
SELECT so.id, se.id
  FROM sortie so, seance se
 WHERE so.nom = 'Week-end à Blaisy' AND se.milieu = 'NATUREL'
   AND se.date_seance BETWEEN DATE '2025-10-11' AND DATE '2025-10-12';
