-- ============================================================
--  Coordonnées de l'élève et personne à prévenir en cas d'urgence.
--  Ce ne sont pas des données de santé : seulement un nom et un
--  téléphone, jamais un lien de parenté ni un motif médical.
-- ============================================================

ALTER TABLE eleve ADD COLUMN email VARCHAR(180);
ALTER TABLE eleve ADD COLUMN telephone VARCHAR(20);
ALTER TABLE eleve ADD COLUMN contact_urgence_nom VARCHAR(120);
ALTER TABLE eleve ADD COLUMN contact_urgence_telephone VARCHAR(20);

ALTER TABLE eleve_aud ADD COLUMN email VARCHAR(180);
ALTER TABLE eleve_aud ADD COLUMN telephone VARCHAR(20);
ALTER TABLE eleve_aud ADD COLUMN contact_urgence_nom VARCHAR(120);
ALTER TABLE eleve_aud ADD COLUMN contact_urgence_telephone VARCHAR(20);
