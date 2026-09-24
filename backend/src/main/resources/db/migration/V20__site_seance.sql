-- Site de plongee, distinct du lieu : le lieu est l'endroit ou l'on se rend
-- (carriere, port, piscine), le site est le point de plongee precis (une
-- epave, un tombant...). Facultatif, recherche avec le lieu et le
-- commentaire (affiche « Info complementaire »).
ALTER TABLE seance ADD COLUMN site VARCHAR(120);

-- Seance est @Audited (Envers) : la table d'historique doit suivre la meme colonne.
ALTER TABLE seance_aud ADD COLUMN site VARCHAR(120);
