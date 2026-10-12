-- ============================================================
--  Identité de la structure (2026) : une installation par club ou
--  centre, chacune avec son nom, son logo et ses couleurs, réglés par
--  un ADMIN dans /admin/identite.
--
--  Une seule ligne (id = 1). Tout est vide au départ : vide = l'identité
--  d'origine de l'appli, celle du club pour qui elle a été écrite (logo
--  et couleurs embarqués, nom de la variable CLUB_NOM). Une
--  installation existante ne voit donc aucun changement tant que son
--  admin ne remplit rien.
--
--  Le logo est stocké ici (PNG, réduit par le serveur) plutôt que dans
--  une table à part comme photo_eleve : une seule image, lue rarement
--  (exports, page de connexion, icônes).
-- ============================================================

CREATE TABLE identite_structure (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),
    nom                 VARCHAR(200),
    nom_court           VARCHAR(60),
    presentation        TEXT,
    couleur_principale  VARCHAR(7),
    couleur_foncee      VARCHAR(7),
    couleur_accent      VARCHAR(7),
    logo                BYTEA,
    mise_a_jour_le      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO identite_structure (id) VALUES (1);
