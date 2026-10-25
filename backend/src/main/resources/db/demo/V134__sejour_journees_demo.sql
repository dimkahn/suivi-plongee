-- Demonstration (profil dev) : la presentation des journees du sejour a
-- Port-Cros (V117, V99_10), comme un carnet de voyage : titre, trajet, ce
-- qu'on y verra, un conseil, l'hebergement. Sans photo : elles s'ajoutent
-- depuis l'ecran (onglet « Programme », « Présenter la journée »).
INSERT INTO sejour_journee (sortie_id, jour, titre, trajet, descriptif, conseil, hebergement)
SELECT id, DATE '2027-06-04', 'Jour 1 — Port-Cros, la Gabinière', 'Hyères → Port-Cros · 40 min de bateau',
       'Le parc national de Port-Cros protège la mer depuis 1963 : mérous, posidonies et gorgonies. '
       || 'La Gabinière, îlot au sud de l''île, est le site le plus réputé.',
       'Être au ponton à 8 h : le bateau n''attend pas. Prévoir une protection solaire respectueuse des récifs.',
       'Gîte des Salins — 3 chambres, 4 nuits ; payé'
  FROM sortie WHERE nom = 'Séjour à Port-Cros';

INSERT INTO sejour_journee (sortie_id, jour, titre, trajet, descriptif, conseil, hebergement)
SELECT id, DATE '2027-06-05', 'Jour 2 — Épave du Donator', 'Hyères → Porquerolles · 30 min de bateau',
       'Cargo coulé en 1945 par 50 m de fond, couvert de gorgonies rouges : réservé aux N2 et plus. '
       || 'Les autres plongent sur le sec de la Pointe du Vaisseau.',
       'Plongée profonde : bien dormir la veille, rien de gazeux au petit-déjeuner.',
       'Gîte des Salins — 2ᵉ nuit'
  FROM sortie WHERE nom = 'Séjour à Port-Cros';
