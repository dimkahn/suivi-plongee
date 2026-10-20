-- Demonstration (profil dev, H2) : une carte d'embarquement (V98) pour le
-- vol aller de Flora (e2@club.fr) au sejour a Port-Cros (V117), pour que le
-- bouton « Carte d'embarquement » paraisse a cote d'elle dans l'onglet
-- Transports des organisateurs. Un petit PDF fictif, sans vrai code-barres.
INSERT INTO sejour_carte_embarquement (participant_id, sens, contenu, type_contenu)
SELECT p.id, 'ARRIVEE', STRINGTOUTF8('%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 420 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 132>>stream
BT /F1 18 Tf 20 150 Td (Carte d''embarquement - DEMO) Tj 0 -30 Td (AF7520 Paris-Orly - Toulon) Tj 0 -30 Td (VASSEUR FLORA) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R/Size 6>>
%%EOF
'), 'application/pdf'
  FROM sejour_participant p JOIN sortie s ON s.id = p.sortie_id
 WHERE s.nom = 'Séjour à Port-Cros' AND p.email = 'e2@club.fr';
