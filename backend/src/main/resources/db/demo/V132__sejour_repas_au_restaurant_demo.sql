-- Demonstration (profil dev) : le sejour a Port-Cros (V117, du 4 au 7 juin
-- 2027) avec deux repas au restaurant (V99_7), le diner du samedi 5 et le
-- dejeuner du dimanche 6. Rend visibles l'onglet « Courses » et sa liste.
INSERT INTO sejour_repas_au_restaurant (sortie_id, jour, repas)
SELECT id, DATE '2027-06-05', 'DINER' FROM sortie WHERE nom = 'Séjour à Port-Cros';
INSERT INTO sejour_repas_au_restaurant (sortie_id, jour, repas)
SELECT id, DATE '2027-06-06', 'DEJEUNER' FROM sortie WHERE nom = 'Séjour à Port-Cros';
