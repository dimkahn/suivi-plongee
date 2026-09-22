-- Donnees de demonstration (profil dev uniquement) : fin de validite du
-- CACI des encadrants, pour montrer chaque cas dans /admin/moniteurs.
-- Dates relatives au jour du lancement, pour rester parlantes dans le temps.
UPDATE utilisateur SET certificat_valide_jusqu_au = DATEADD('MONTH', 8, CURRENT_DATE) WHERE email = 'presidente@club.fr';
UPDATE utilisateur SET certificat_valide_jusqu_au = DATEADD('DAY', 12, CURRENT_DATE)  WHERE email = 'e3@club.fr';
UPDATE utilisateur SET certificat_valide_jusqu_au = DATEADD('DAY', -20, CURRENT_DATE) WHERE email = 'e2@club.fr';
-- e1@club.fr : laisse non renseigne.
