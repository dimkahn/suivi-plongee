-- Démonstration (profil dev) : un problème signalé pendant une séance par
-- un moniteur (demande du club, 2026-11-19), sur le gilet G-01 prêté pour
-- la saison. Il ne se prête plus jusqu'à ce que le directeur technique le
-- déclare réparé : visible dans l'inventaire (« Problèmes signalés ») et sur
-- sa fiche. Le problème décrit le matériel, jamais la personne.
INSERT INTO intervention_equipement (equipement_id, type, date_intervention, description, saisi_par_id)
SELECT e.id, 'SIGNALEMENT', DATEADD('DAY', -1, CURRENT_DATE),
       'Le direct system fuit quand on gonfle le gilet.', u.id
  FROM equipement e
  JOIN utilisateur u ON u.email = 'e1@club.fr'
 WHERE e.reference = 'G-01';
