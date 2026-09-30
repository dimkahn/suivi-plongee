-- ============================================================
--  Compléments de la fiche d'un équipement, repris du classeur
--  « Historique Blocs » tenu jusqu'ici par le club :
--  - proprietaire : NULL = le club. Des membres confient leur bloc
--    au TIV du club, qui le suit comme les autres (« BRUNET »...).
--  - constructeur : le fabricant de la bouteille (Roth, Heiser...),
--    distinct de la marque qui la vend (Beuchat, Spiro, Vieux
--    Plongeur...). Sert surtout aux blocs, laissé libre pour les autres.
--  - ancienne_reference : l'ancien marquage, quand le club a renuméroté
--    son matériel (colonnes « Ancien N° » et « old » du classeur).
--  - numero_robinet : le numéro gravé sur le robinet ; sa marque reste
--    dans robinetterie.
-- ============================================================

ALTER TABLE equipement ADD COLUMN proprietaire VARCHAR(80);
ALTER TABLE equipement ADD COLUMN constructeur VARCHAR(80);
ALTER TABLE equipement ADD COLUMN ancienne_reference VARCHAR(30);
ALTER TABLE equipement ADD COLUMN numero_robinet VARCHAR(60);

ALTER TABLE equipement_aud ADD COLUMN proprietaire VARCHAR(80);
ALTER TABLE equipement_aud ADD COLUMN constructeur VARCHAR(80);
ALTER TABLE equipement_aud ADD COLUMN ancienne_reference VARCHAR(30);
ALTER TABLE equipement_aud ADD COLUMN numero_robinet VARCHAR(60);
