-- ============================================================
--  Statut de cursus OBTENU_AILLEURS (demande du club, 2026) : un élève
--  en formation a passé son brevet dans une autre structure. Sa
--  formation se clôt ici sans compter comme une délivrance du club ;
--  la fiche élève prend ce niveau (dernier_niveau, posé par l'appli).
--  cursus_aud n'a pas de contrainte sur le statut : rien à y changer.
-- ============================================================

ALTER TABLE cursus DROP CONSTRAINT ck_cursus_statut;
ALTER TABLE cursus ADD CONSTRAINT ck_cursus_statut
    CHECK (statut IN ('EN_COURS','VALIDE','DELIVRE','SUSPENDU','ABANDON','OBTENU_AILLEURS'));
