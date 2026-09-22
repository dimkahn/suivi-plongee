-- ============================================================
--  Validite du CACI des encadrants.
--
--  Comme pour l'eleve : on ne stocke que la date de fin de validite,
--  jamais le certificat medical lui-meme. Saisie par un ADMIN.
--  Utilisateur est audite (Envers) : la colonne existe aussi dans _aud.
-- ============================================================

ALTER TABLE utilisateur ADD COLUMN certificat_valide_jusqu_au DATE;
ALTER TABLE utilisateur_aud ADD COLUMN certificat_valide_jusqu_au DATE;
