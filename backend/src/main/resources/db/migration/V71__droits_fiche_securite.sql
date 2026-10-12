-- ============================================================
--  Droits sur la fiche de securite (choix du club, 2026).
--  Etablir ou modifier une fiche : E3, E4, administrateurs, et les
--  moniteurs qui recoivent le role FICHE_SECURITE (donne par un ADMIN
--  dans l'ecran Moniteurs, cumule avec MONITEUR).
--  Completer la fiche au retour de plongee : tous les moniteurs, et les
--  comptes SECURITE_SURFACE (personne qui n'est pas moniteur du club,
--  creee par un ADMIN dans l'ecran Moniteurs, sans autre droit).
-- ============================================================

ALTER TABLE utilisateur_role DROP CONSTRAINT ck_role;
ALTER TABLE utilisateur_role ADD CONSTRAINT ck_role
    CHECK (role IN ('ADMIN', 'MONITEUR', 'ELEVE', 'DIRECTEUR_TECHNIQUE', 'TIV',
                    'FICHE_SECURITE', 'SECURITE_SURFACE'));
