-- ============================================================
--  Signature electronique de la fiche de securite par son DP
--  (demande du club, octobre 2026).
--
--  signataire_id / signee_le : qui a signe et quand ; vides tant
--  que la fiche n'est pas signee. Signee, la fiche ne se modifie
--  plus (FicheSecuriteService).
--  empreinte : HMAC-SHA256 (hexadecimal) du contenu de la fiche au
--  moment de la signature (conditions, palanquees, plongeurs,
--  profils, signataire et date), scelle par une cle du serveur qui
--  n'est pas en base : une modification faite directement en base
--  apres la signature ne retombe plus sur la meme empreinte
--  (EmpreinteFicheSecurite).
-- ============================================================

ALTER TABLE fiche_securite ADD COLUMN signataire_id BIGINT REFERENCES utilisateur(id);
ALTER TABLE fiche_securite ADD COLUMN signee_le TIMESTAMP;
ALTER TABLE fiche_securite ADD COLUMN empreinte VARCHAR(64);

ALTER TABLE fiche_securite_aud ADD COLUMN signataire_id BIGINT;
ALTER TABLE fiche_securite_aud ADD COLUMN signee_le TIMESTAMP;
ALTER TABLE fiche_securite_aud ADD COLUMN empreinte VARCHAR(64);
