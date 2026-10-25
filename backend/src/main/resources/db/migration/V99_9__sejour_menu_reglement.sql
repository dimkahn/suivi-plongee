-- ============================================================
--  L'addition d'un repas au restaurant (demande du club, 2026) :
--  quand tout le monde a choisi, un organisateur la paie et
--  l'appli saisit une dépense par personne, à son montant, dans
--  les frais du séjour. La dépense garde son menu : l'addition
--  est payée tant qu'une de ses dépenses existe (rien d'autre
--  n'est stocké). Supprimer le menu laisse les frais.
-- ============================================================

ALTER TABLE sejour_depense ADD COLUMN menu_id BIGINT REFERENCES sejour_menu(id) ON DELETE SET NULL;
CREATE INDEX idx_sejour_depense_menu ON sejour_depense (menu_id);
