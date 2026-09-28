-- ============================================================
--  Tailles de l'élève pour le prêt de matériel : gilet
--  stabilisateur et combinaison. Texte libre (S, M, XL, T3, 12 ans...),
--  comme equipement.taille : les fabricants n'ont pas de grille commune.
--  Ce ne sont pas des mensurations ni des données de santé.
-- ============================================================

ALTER TABLE eleve ADD COLUMN taille_gilet VARCHAR(20);
ALTER TABLE eleve ADD COLUMN taille_combinaison VARCHAR(20);

ALTER TABLE eleve_aud ADD COLUMN taille_gilet VARCHAR(20);
ALTER TABLE eleve_aud ADD COLUMN taille_combinaison VARCHAR(20);
