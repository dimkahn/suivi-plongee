-- Fiche de securite : pression partielle d'oxygene maximale retenue pour un
-- plongeur au melange (nitrox...) : 1,4, 1,5 ou 1,6 bar. Avec la fraction
-- d'oxygene lue dans le champ gaz, elle donne la profondeur maximale
-- d'utilisation (MOD) affichee sur la fiche. Vide pour l'air ou quand elle
-- n'est pas precisee (1,4 par defaut a l'ecran).
ALTER TABLE membre_palanquee ADD COLUMN ppo2_max DECIMAL(2, 1);
