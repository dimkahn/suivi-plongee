-- ============================================================
--  Demo : suivi d'entrainement en fosse de Camille (N2), note par
--  Gwendoline (E3) les lundis de septembre (V45). Il reste a part de
--  l'evaluation en milieu naturel du week-end a la Graviere (V107) :
--  « Capelage et decapelage » y est acquis en fosse, en cours en
--  milieu naturel ; le saut droit n'est travaille qu'en fosse.
-- ============================================================

INSERT INTO evaluation (cursus_id, critere_id, seance_id, moniteur_id, statut, date_evaluation,
                        commentaire, entrainement)
SELECT c.id, cr.id, se.id, u.id, n.statut, n.jour, n.commentaire, TRUE
  FROM (VALUES (1, DATE '2026-09-14', 'ACQUIS',   CAST(NULL AS VARCHAR(200))),
               (2, DATE '2026-09-14', 'EN_COURS', 'Décapelage en surface encore hésitant.'),
               (2, DATE '2026-09-21', 'ACQUIS',   NULL),
               (3, DATE '2026-09-21', 'EN_COURS', 'Bascule arrière à refaire depuis le bord.')
       ) AS n(critere_ordre, jour, statut, commentaire)
  JOIN eleve e ON e.numero_licence = 'A-01-000010'
  JOIN saison s ON s.libelle = '2026-2027'
  JOIN cursus c ON c.eleve_id = e.id AND c.saison_id = s.id
  JOIN bloc_competence b ON b.referentiel_id = c.referentiel_id
       AND b.ordre = (SELECT MIN(b2.ordre) FROM bloc_competence b2 WHERE b2.referentiel_id = c.referentiel_id)
  JOIN critere cr ON cr.bloc_id = b.id AND cr.ordre = n.critere_ordre
  JOIN seance se ON se.saison_id = s.id AND se.date_seance = n.jour AND se.lieu = 'Fosse'
  JOIN utilisateur u ON u.email = 'e3@club.fr';
