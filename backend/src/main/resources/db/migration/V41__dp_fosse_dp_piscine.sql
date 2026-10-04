-- ============================================================
--  Planning du bassin : deux directeurs de plongee par soiree,
--  le DP fosse et le DP piscine, a la place du seul "responsable
--  de seance".
--
--  La colonne responsable_id garde son nom (les donnees de demo
--  V107 l'ecrivent) et porte desormais le DP fosse : les
--  responsables deja renseignes deviennent DP fosse. Le DP
--  piscine est une colonne nouvelle, vide au depart.
-- ============================================================

ALTER TABLE soiree_planning
    ADD COLUMN dp_piscine_id BIGINT REFERENCES utilisateur(id) ON DELETE SET NULL;
