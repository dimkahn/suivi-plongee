-- Demonstration (profil dev) : le menu du restaurant du diner du samedi
-- 5 juin 2027 au sejour a Port-Cros (V117, V132), tel qu'importe d'un
-- classeur Excel (V99_8). Camille (compte eleve@club.fr) a deja choisi :
-- rend visibles l'onglet « Restaurant », son choix et la commande complete.
INSERT INTO sejour_menu (sortie_id, jour, repas, restaurant)
SELECT id, DATE '2027-06-05', 'DINER', 'La Trinquette' FROM sortie WHERE nom = 'Séjour à Port-Cros';

INSERT INTO sejour_menu_plat (menu_id, rang, categorie, nom, description, prix_centimes)
SELECT m.id, v.rang, v.categorie, v.nom, v.description, v.prix
  FROM sejour_menu m JOIN sortie s ON s.id = m.sortie_id
 CROSS JOIN (VALUES
       (0, 'Entrée', 'Soupe de poissons', 'Rouille et croûtons', 950),
       (1, 'Entrée', 'Salade de chèvre chaud', 'Miel et noix', 900),
       (2, 'Plat', 'Daurade grillée', 'Légumes du jour', 2100),
       (3, 'Plat', 'Risotto aux champignons', NULL, 1700),
       (4, 'Plat', 'Menu enfant : poisson pané, frites', NULL, 1100),
       (5, 'Dessert', 'Tarte au citron', NULL, 750),
       (6, 'Dessert', 'Glace deux boules', 'Vanille, chocolat ou fraise', 600),
       (7, 'Boisson', 'Carafe de rosé (50 cl)', NULL, 1400),
       (8, 'Boisson', 'Sirop à l''eau', NULL, 300)
     ) AS v(rang, categorie, nom, description, prix)
 WHERE s.nom = 'Séjour à Port-Cros' AND m.jour = DATE '2027-06-05' AND m.repas = 'DINER';

INSERT INTO sejour_menu_choix (plat_id, participant_id)
SELECT pl.id, p.id
  FROM sejour_menu_plat pl JOIN sejour_menu m ON m.id = pl.menu_id
  JOIN sortie s ON s.id = m.sortie_id
  JOIN sejour_participant p ON p.sortie_id = s.id AND p.prenom = 'Camille'
 WHERE s.nom = 'Séjour à Port-Cros' AND pl.nom IN ('Salade de chèvre chaud', 'Daurade grillée', 'Glace deux boules');
