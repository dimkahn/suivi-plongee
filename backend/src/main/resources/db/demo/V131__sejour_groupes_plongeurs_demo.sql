-- Demonstration (profil dev) : les plongeurs du sejour a Port-Cros (V117)
-- ranges en deux groupes de plongeurs de la saison 2026-2027, crees par
-- Gwendoline (e3@club.fr), et chaque participant lie a sa ligne du groupe
-- (V79). Jules, accompagnant, reste hors groupe. Rend visibles le filtre par
-- groupe du trombinoscope du sejour et « Groupe « … » » dans les fiches.
INSERT INTO groupe_plongeurs (nom, saison_id, date_creation, createur_id)
SELECT 'Port-Cros — encadrants', s.id, DATE '2027-05-01', u.id
  FROM saison s, utilisateur u WHERE s.libelle = '2026-2027' AND u.email = 'e3@club.fr';
INSERT INTO groupe_plongeurs (nom, saison_id, date_creation, createur_id)
SELECT 'Port-Cros — élèves', s.id, DATE '2027-05-01', u.id
  FROM saison s, utilisateur u WHERE s.libelle = '2026-2027' AND u.email = 'e3@club.fr';

INSERT INTO membre_groupe_plongeurs (groupe_id, eleve_id, utilisateur_id, nom, prenom, aptitude)
SELECT g.id, p.eleve_id, p.utilisateur_id, p.nom, p.prenom, 'PA60'
  FROM groupe_plongeurs g, sejour_participant p JOIN sortie s ON s.id = p.sortie_id
 WHERE g.nom = 'Port-Cros — encadrants' AND s.nom = 'Séjour à Port-Cros' AND p.prenom IN ('Gwendoline', 'Flora');
INSERT INTO membre_groupe_plongeurs (groupe_id, eleve_id, utilisateur_id, nom, prenom, aptitude)
SELECT g.id, p.eleve_id, p.utilisateur_id, p.nom, p.prenom, 'PE20'
  FROM groupe_plongeurs g, sejour_participant p JOIN sortie s ON s.id = p.sortie_id
 WHERE g.nom = 'Port-Cros — élèves' AND s.nom = 'Séjour à Port-Cros' AND p.plongeur
   AND p.eleve_id IS NOT NULL;

UPDATE sejour_participant SET membre_groupe_id = (
    SELECT m.id FROM membre_groupe_plongeurs m JOIN groupe_plongeurs g ON g.id = m.groupe_id
     WHERE g.nom LIKE 'Port-Cros — %'
       AND (m.eleve_id = sejour_participant.eleve_id OR m.utilisateur_id = sejour_participant.utilisateur_id))
 WHERE sortie_id = (SELECT id FROM sortie WHERE nom = 'Séjour à Port-Cros')
   AND (eleve_id IS NOT NULL OR utilisateur_id IS NOT NULL);
