-- ============================================================
--  Trois progressions types proposees au club, une par niveau, sur la
--  version courante du referentiel (N1 PE20, N2 PA20 | PE40, N3
--  PA40 | PE60). Point de depart a adapter depuis /admin/progressions,
--  pas une prescription federale.
--
--  Blocs designes par leur ordre au sein du referentiel (V10). Tout
--  passe par INSERT ... SELECT : si un referentiel ou un bloc a ete
--  supprime ou renumerote depuis l'ecran d'admin, la ligne concernee
--  n'est simplement pas creee, la migration n'echoue pas.
--
--  Genere une fois ; ne plus editer ce fichier apres application.
-- ============================================================

-- ---------- N1 (PE20 (2025-12)) ----------
INSERT INTO progression_type (referentiel_id, nom, description)
SELECT r.id, 'N1 – progression type du club', 'Proposition de départ sur une saison de septembre à juin : piscine et fosse jusqu''en avril, milieu naturel en fin de saison. À adapter par le club.'
  FROM referentiel r
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)';

INSERT INTO periode_progression (progression_id, rang, intitule, mois_debut, mois_fin, milieu, note)
SELECT p.id, 1, 'Découverte du scaphandre', 9, 10, 'ARTIFICIEL',
       'Piscine : s''équiper, se mettre à l''eau, premiers signes, ventilation sur détendeur, palmage.'
  FROM progression_type p JOIN referentiel r ON r.id = p.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND p.nom = 'N1 – progression type du club';

INSERT INTO periode_progression_bloc (periode_id, bloc_id)
SELECT pp.id, b.id
  FROM periode_progression pp
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN referentiel r ON r.id = p.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND p.nom = 'N1 – progression type du club' AND pp.rang = 1
   AND b.ordre IN (1, 2, 4, 5, 8);

INSERT INTO periode_progression (progression_id, rang, intitule, mois_debut, mois_fin, milieu, note)
SELECT p.id, 2, 'Immersion, ventilation et communication', 11, 12, 'ARTIFICIEL',
       'Piscine puis premières fosses : techniques d''immersion, vidage de masque, lâcher-reprise d''embout. Théorie : matériel, pressions, signes.'
  FROM progression_type p JOIN referentiel r ON r.id = p.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND p.nom = 'N1 – progression type du club';

INSERT INTO periode_progression_bloc (periode_id, bloc_id)
SELECT pp.id, b.id
  FROM periode_progression pp
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN referentiel r ON r.id = p.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND p.nom = 'N1 – progression type du club' AND pp.rang = 2
   AND b.ordre IN (3, 4, 5, 8, 11);

INSERT INTO periode_progression (progression_id, rang, intitule, mois_debut, mois_fin, milieu, note)
SELECT p.id, 3, 'Fosse : équilibre et retour en surface', 1, 2, 'ARTIFICIEL',
       'Stabilisation au poumon-ballast puis au gilet, remontée contrôlée. Théorie : barotraumatismes, flottabilité.'
  FROM progression_type p JOIN referentiel r ON r.id = p.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND p.nom = 'N1 – progression type du club';

INSERT INTO periode_progression_bloc (periode_id, bloc_id)
SELECT pp.id, b.id
  FROM periode_progression pp
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN referentiel r ON r.id = p.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND p.nom = 'N1 – progression type du club' AND pp.rang = 3
   AND b.ordre IN (3, 6, 10, 11);

INSERT INTO periode_progression (progression_id, rang, intitule, mois_debut, mois_fin, milieu, note)
SELECT p.id, 4, 'Sécurité et plongée en palanquée', 3, 4, 'ARTIFICIEL',
       'Partage d''air, situations d''essoufflement ou de masque inondé, évolution en palanquée derrière le GP. Révisions en fosse.'
  FROM progression_type p JOIN referentiel r ON r.id = p.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND p.nom = 'N1 – progression type du club';

INSERT INTO periode_progression_bloc (periode_id, bloc_id)
SELECT pp.id, b.id
  FROM periode_progression pp
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN referentiel r ON r.id = p.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND p.nom = 'N1 – progression type du club' AND pp.rang = 4
   AND b.ordre IN (1, 2, 6, 8, 9, 10, 11);

INSERT INTO periode_progression (progression_id, rang, intitule, mois_debut, mois_fin, milieu, note)
SELECT p.id, 5, 'Milieu naturel et validation', 5, 6, 'NATUREL',
       'Plongées en mer ou en lac : environnement, mise à l''eau depuis le bateau, puis plongées de validation de toutes les compétences.'
  FROM progression_type p JOIN referentiel r ON r.id = p.referentiel_id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND p.nom = 'N1 – progression type du club';

INSERT INTO periode_progression_bloc (periode_id, bloc_id)
SELECT pp.id, b.id
  FROM periode_progression pp
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN referentiel r ON r.id = p.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)' AND p.nom = 'N1 – progression type du club' AND pp.rang = 5
   AND b.ordre IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11);

-- ---------- N2 (PA20 | PE40 (2026-05)) ----------
INSERT INTO progression_type (referentiel_id, nom, description)
SELECT r.id, 'N2 – progression type du club', 'Proposition de départ. Les compétences du N2 ne se valident qu''en milieu naturel : l''hiver en fosse sert de préparation, les validations se font en fin de saison. À adapter par le club.'
  FROM referentiel r
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)';

INSERT INTO periode_progression (progression_id, rang, intitule, mois_debut, mois_fin, milieu, note)
SELECT p.id, 1, 'Reprise et remise à niveau', 9, 10, 'ARTIFICIEL',
       'Fosse : équipement, lestage, immersion, palmage. Théorie : organisation de la plongée, prérogatives PA20 et PE40.'
  FROM progression_type p JOIN referentiel r ON r.id = p.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND p.nom = 'N2 – progression type du club';

INSERT INTO periode_progression_bloc (periode_id, bloc_id)
SELECT pp.id, b.id
  FROM periode_progression pp
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN referentiel r ON r.id = p.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND p.nom = 'N2 – progression type du club' AND pp.rang = 1
   AND b.ordre IN (1, 2, 12, 13);

INSERT INTO periode_progression (progression_id, rang, intitule, mois_debut, mois_fin, milieu, note)
SELECT p.id, 2, 'Stabilisation, matériel et communication', 11, 12, 'ARTIFICIEL',
       'Stabilisation, matériel des équipiers, communication avec le GP. Théorie : accidents barotraumatiques et de désaturation.'
  FROM progression_type p JOIN referentiel r ON r.id = p.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND p.nom = 'N2 – progression type du club';

INSERT INTO periode_progression_bloc (periode_id, bloc_id)
SELECT pp.id, b.id
  FROM periode_progression pp
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN referentiel r ON r.id = p.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND p.nom = 'N2 – progression type du club' AND pp.rang = 2
   AND b.ordre IN (4, 8, 9, 12, 13);

INSERT INTO periode_progression (progression_id, rang, intitule, mois_debut, mois_fin, milieu, note)
SELECT p.id, 3, 'Remontée, planification et autonomie', 1, 2, 'ARTIFICIEL',
       'Remontée contrôlée et paliers, évolution à deux. Théorie : ordinateurs et tables, planifier une plongée autonome.'
  FROM progression_type p JOIN referentiel r ON r.id = p.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND p.nom = 'N2 – progression type du club';

INSERT INTO periode_progression_bloc (periode_id, bloc_id)
SELECT pp.id, b.id
  FROM periode_progression pp
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN referentiel r ON r.id = p.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND p.nom = 'N2 – progression type du club' AND pp.rang = 3
   AND b.ordre IN (5, 6, 10, 12);

INSERT INTO periode_progression (progression_id, rang, intitule, mois_debut, mois_fin, milieu, note)
SELECT p.id, 4, 'Assistance et relais', 3, 4, 'ARTIFICIEL',
       'Remontée d''un équipier, relais sur un équipier en difficulté, panne d''air. Théorie : réglementation, environnement.'
  FROM progression_type p JOIN referentiel r ON r.id = p.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND p.nom = 'N2 – progression type du club';

INSERT INTO periode_progression_bloc (periode_id, bloc_id)
SELECT pp.id, b.id
  FROM periode_progression pp
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN referentiel r ON r.id = p.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND p.nom = 'N2 – progression type du club' AND pp.rang = 4
   AND b.ordre IN (3, 7, 11, 13);

INSERT INTO periode_progression (progression_id, rang, intitule, mois_debut, mois_fin, milieu, note)
SELECT p.id, 5, 'Milieu naturel : PA20 puis PE40', 5, 6, 'NATUREL',
       'Plongées en milieu naturel : autonomie à 20 m puis plongées encadrées jusqu''à 40 m. Assistance (PA20) et relais (PE40) validés en dernier.'
  FROM progression_type p JOIN referentiel r ON r.id = p.referentiel_id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND p.nom = 'N2 – progression type du club';

INSERT INTO periode_progression_bloc (periode_id, bloc_id)
SELECT pp.id, b.id
  FROM periode_progression pp
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN referentiel r ON r.id = p.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)' AND p.nom = 'N2 – progression type du club' AND pp.rang = 5
   AND b.ordre IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13);

-- ---------- N3 (PA40 | PE60 (2025-12)) ----------
INSERT INTO progression_type (referentiel_id, nom, description)
SELECT r.id, 'N3 – progression type du club', 'Proposition de départ. Les compétences du N3 ne se valident qu''en milieu naturel : l''hiver en fosse et en salle sert de préparation. À adapter par le club.'
  FROM referentiel r
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)';

INSERT INTO periode_progression (progression_id, rang, intitule, mois_debut, mois_fin, milieu, note)
SELECT p.id, 1, 'Reprise, prérogatives et planification', 9, 10, 'ARTIFICIEL',
       'Fosse : aisance et stabilisation. Théorie : prérogatives N3, PA40 et PE60, planification et consommation.'
  FROM progression_type p JOIN referentiel r ON r.id = p.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND p.nom = 'N3 – progression type du club';

INSERT INTO periode_progression_bloc (periode_id, bloc_id)
SELECT pp.id, b.id
  FROM periode_progression pp
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN referentiel r ON r.id = p.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND p.nom = 'N3 – progression type du club' AND pp.rang = 1
   AND b.ordre IN (1, 2, 8);

INSERT INTO periode_progression (progression_id, rang, intitule, mois_debut, mois_fin, milieu, note)
SELECT p.id, 2, 'Assistance', 11, 12, 'ARTIFICIEL',
       'Remontée d''un plongeur en difficulté, panne d''air, remontée à deux. Théorie : accidents de décompression, narcose, essoufflement.'
  FROM progression_type p JOIN referentiel r ON r.id = p.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND p.nom = 'N3 – progression type du club';

INSERT INTO periode_progression_bloc (periode_id, bloc_id)
SELECT pp.id, b.id
  FROM periode_progression pp
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN referentiel r ON r.id = p.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND p.nom = 'N3 – progression type du club' AND pp.rang = 2
   AND b.ordre IN (3, 8);

INSERT INTO periode_progression (progression_id, rang, intitule, mois_debut, mois_fin, milieu, note)
SELECT p.id, 3, 'Profondeur et organisation', 1, 2, 'ARTIFICIEL',
       'Théorie : organiser une plongée en autonomie, matériel de sécurité, adaptation à la profondeur. Parachute de palier en fosse.'
  FROM progression_type p JOIN referentiel r ON r.id = p.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND p.nom = 'N3 – progression type du club';

INSERT INTO periode_progression_bloc (periode_id, bloc_id)
SELECT pp.id, b.id
  FROM periode_progression pp
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN referentiel r ON r.id = p.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND p.nom = 'N3 – progression type du club' AND pp.rang = 3
   AND b.ordre IN (4, 5, 8);

INSERT INTO periode_progression (progression_id, rang, intitule, mois_debut, mois_fin, milieu, note)
SELECT p.id, 4, 'Autonomie et environnement', 3, 4, 'ARTIFICIEL',
       'Orientation, évolution en autonomie. Théorie : environnement, révision de l''examen théorique.'
  FROM progression_type p JOIN referentiel r ON r.id = p.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND p.nom = 'N3 – progression type du club';

INSERT INTO periode_progression_bloc (periode_id, bloc_id)
SELECT pp.id, b.id
  FROM periode_progression pp
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN referentiel r ON r.id = p.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND p.nom = 'N3 – progression type du club' AND pp.rang = 4
   AND b.ordre IN (2, 6, 7, 8);

INSERT INTO periode_progression (progression_id, rang, intitule, mois_debut, mois_fin, milieu, note)
SELECT p.id, 5, 'Milieu naturel : PA40, PE60 et N3', 5, 6, 'NATUREL',
       'Plongées en milieu naturel : autonomie jusqu''à 40 m, descente progressive vers 60 m encadrée, organisation complète d''une plongée par la palanquée.'
  FROM progression_type p JOIN referentiel r ON r.id = p.referentiel_id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND p.nom = 'N3 – progression type du club';

INSERT INTO periode_progression_bloc (periode_id, bloc_id)
SELECT pp.id, b.id
  FROM periode_progression pp
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN referentiel r ON r.id = p.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id
 WHERE r.niveau = 'N3' AND r.version_mft = 'PA40 | PE60 (2025-12)' AND p.nom = 'N3 – progression type du club' AND pp.rang = 5
   AND b.ordre IN (1, 2, 3, 4, 5, 6, 7, 8);
