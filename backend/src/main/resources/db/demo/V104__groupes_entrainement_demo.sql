-- Demonstration (profil dev) : groupes d'entrainement de la saison de demo,
-- sur le modele du planning du club (noms fictifs cote encadrants).
INSERT INTO groupe_entrainement (saison_id, nom, ordre, niveau_prepare, espace_attitre_id)
SELECT s.id, g.nom, g.ordre, g.niveau, e.id
  FROM saison s
  JOIN (VALUES ('Débutants', 1, 'N1', 'Ligne 6'),
               ('Perfect N1', 2, NULL, 'Ligne 1'),
               ('Prépa N2',  3, 'N2', 'Ligne 3'),
               ('N2+',       4, NULL, 'Ligne 2'),
               ('Prépa N3',  5, 'N3', 'Ligne 4')) AS g(nom, ordre, niveau, ligne) ON TRUE
  JOIN espace_bassin e ON e.nom = g.ligne
 WHERE s.libelle = '2025-2026';

INSERT INTO groupe_entrainement_encadrant (groupe_id, utilisateur_id)
SELECT g.id, u.id
  FROM groupe_entrainement g
  JOIN (VALUES ('Débutants', 'e1@club.fr'), ('Débutants', 'e2@club.fr'),
               ('Prépa N2', 'e3@club.fr'), ('Prépa N3', 'presidente@club.fr')) AS a(groupe, email)
    ON a.groupe = g.nom
  JOIN utilisateur u ON u.email = a.email;
