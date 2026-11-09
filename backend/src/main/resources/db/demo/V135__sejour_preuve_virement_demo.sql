-- Demonstration (profil dev, H2) : la preuve d'un virement (V99_15) de
-- Camille a Gwendoline pour les frais du sejour a Port-Cros (V117, V118),
-- en attente de confirmation : l'organisateur (e3@club.fr) la voit dans
-- « Virements a confirmer », Camille lit « Preuve envoyee, a confirmer ».
-- Un petit PDF fictif, sans numero de compte.
INSERT INTO sejour_preuve_virement (sortie_id, de_id, a_id, montant_centimes, jour, contenu, type_contenu)
SELECT s.id, de.id, a.id, 5000, DATE '2027-06-09', STRINGTOUTF8('%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 420 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 120>>stream
BT /F1 18 Tf 20 150 Td (Virement effectue - DEMO) Tj 0 -30 Td (50,00 EUR) Tj 0 -30 Td (Frais Port-Cros) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R/Size 6>>
%%EOF
'), 'application/pdf'
  FROM sortie s
  JOIN sejour_participant de ON de.sortie_id = s.id AND de.prenom = 'Camille'
  JOIN sejour_participant a ON a.sortie_id = s.id AND a.prenom = 'Gwendoline'
 WHERE s.nom = 'Séjour à Port-Cros';
