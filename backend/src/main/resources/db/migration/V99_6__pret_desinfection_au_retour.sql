-- Un participant d'un séjour déclare lui-même le détendeur qu'il a emprunté
-- (demande du club, 2026), sans pouvoir attester sa désinfection : elle
-- s'atteste au retour, par celui qui reçoit le matériel, et entre alors au
-- journal du détendeur (Code du sport, art. A322-81). Vrai pour un tel prêt,
-- rendu ou non.
ALTER TABLE pret ADD COLUMN desinfection_au_retour BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE pret_aud ADD COLUMN desinfection_au_retour BOOLEAN;
