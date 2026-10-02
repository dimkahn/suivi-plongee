-- Demonstration (profil dev) : un referent par groupe qui a des encadrants,
-- choisi parmi ses encadrants attitres, sur les deux saisons de demo.
INSERT INTO groupe_entrainement_referent (groupe_id, utilisateur_id)
SELECT g.id, u.id
  FROM groupe_entrainement g
  JOIN (VALUES ('Débutants', 'e2@club.fr'), ('Prépa N2', 'e3@club.fr'),
               ('Prépa N3', 'presidente@club.fr')) AS r(groupe, email)
    ON r.groupe = g.nom
  JOIN utilisateur u ON u.email = r.email
  JOIN groupe_entrainement_encadrant ge ON ge.groupe_id = g.id AND ge.utilisateur_id = u.id;
