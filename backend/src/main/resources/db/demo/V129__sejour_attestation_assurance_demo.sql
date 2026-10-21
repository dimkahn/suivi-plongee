-- Demonstration (profil dev, H2) : une attestation d'assurance (V99) pour
-- Flora (e2@club.fr) au sejour a Port-Cros (V117), pour que l'onglet
-- Participants des organisateurs en compte une. Un petit PDF fictif.
INSERT INTO sejour_attestation_assurance (participant_id, contenu, type_contenu)
SELECT p.id, STRINGTOUTF8('%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 420 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 128>>stream
BT /F1 18 Tf 20 150 Td (Attestation d''assurance - DEMO) Tj 0 -30 Td (Contrat fictif 000000) Tj 0 -30 Td (VASSEUR FLORA) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R/Size 6>>
%%EOF
'), 'application/pdf'
  FROM sejour_participant p JOIN sortie s ON s.id = p.sortie_id
 WHERE s.nom = 'Séjour à Port-Cros' AND p.email = 'e2@club.fr';

-- Le conseil d'assurance du sejour, montre a ceux qui n'ont pas joint la leur.
UPDATE sejour SET conseil_assurance = 'Pour celles et ceux qui ne l''ont pas déjà fait, une assurance complémentaire (Loisir 1 minimum) est fortement recommandée. Vous pouvez souscrire avec votre numéro de licencié sur https://www.espaceclient.lafont-assurances.com/espace-client/contrat.aspx
Pour toute question, n''hésitez pas à nous contacter.'
 WHERE sortie_id = (SELECT id FROM sortie WHERE nom = 'Séjour à Port-Cros');
