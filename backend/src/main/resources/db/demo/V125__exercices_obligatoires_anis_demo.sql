-- Démo (vidéo M6) : « S'équiper » a trois exercices de maîtrise obligatoires
-- (V93) : 1.7 gréage, 1.8 capelage, 1.9 matériel personnel. Les deux
-- premiers critères d'Anis étaient notés acquis sans exercice ; Tiago les
-- reprend le 21/09 sur leurs exercices de maîtrise. Dans la vidéo, Anis
-- acquiert 1.9 et la compétence se valide.
INSERT INTO evaluation (cursus_id, critere_id, seance_id, moniteur_id, statut, date_evaluation,
                        exercice_id, statut_exercice)
SELECT c.id, cr.id, se.id, u.id, 'ACQUIS', DATE '2026-09-21', x.id, 'ACQUIS'
  FROM (VALUES ('Gréage et dégréage', '1.7'), ('Capelage et décapelage', '1.8')) AS n(savoir_faire, numero)
  JOIN eleve e ON e.numero_licence = 'A-01-000011'
  JOIN saison s ON s.libelle = '2026-2027'
  JOIN cursus c ON c.eleve_id = e.id AND c.saison_id = s.id
  JOIN bloc_competence b ON b.referentiel_id = c.referentiel_id
  JOIN critere cr ON cr.bloc_id = b.id AND cr.savoir_faire = n.savoir_faire
  JOIN exercice_competence x ON x.bloc_id = b.id AND x.numero = n.numero
  JOIN seance se ON se.saison_id = s.id AND se.date_seance = DATE '2026-09-21' AND se.lieu = 'Piscine'
  JOIN utilisateur u ON u.email = 'e1@club.fr';
