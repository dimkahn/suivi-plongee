# À faire : ouvrir l'appli aux clubs commerciaux

Plan établi le 18 octobre 2026. L'appli sert aujourd'hui un club associatif
FFESSM ; ce plan l'ouvre aux structures commerciales (centres de plongée),
sans rien changer pour le club.

## Déjà prêt

- Identité réglable par structure (`/admin/identite`), une installation par structure.
- Progressions découpées par plongées (V73) et modèle « centre en mer » (`modeles/centre-mer.sql`).
- Notation, fiche de sécurité, palanquées, hors ligne, matériel (TIV, journal légal) : le Code du sport vaut pour les deux.

## Ce qui suppose un club associatif

- Élèves inscrits à l'année, adhésion par saison (`inscription_club`, `adhesion_saison`) → clients de passage.
- Comptes élèves fermés → le client doit réserver, payer, voir ses plongées.
- Moniteurs bénévoles classés E1-E4 → salariés ou indépendants, diplômes d'État, PADI/SSI.
- Cursus N1-N3 FFESSM seulement → baptêmes, explorations, PADI, SSI, spécialités.
- Pas d'argent en jeu (sauf partage des frais) → prix, paiement, factures, TVA.
- Séjour entre membres → séjour vendu (acompte, annulation).
- Prêt de matériel gratuit → location, caution, dommages.
- Saison de bassin → créneaux bateau quotidiens, capacité par bateau.

## Étapes

### 1. Décisions de cadrage
- [ ] Une installation par centre, ou une offre en ligne partagée entre plusieurs centres (séparer les données de chaque centre dans toutes les tables : chantier à part, à décider avant l'étape 2).
- [ ] Fédérations et organismes à couvrir : FFESSM (structure commerciale agréée), PADI, SSI.
- [ ] Facturation faite par l'appli, ou branchée sur un outil existant (caisse, facturation).
- [ ] Prestataire de paiement (Stripe, SumUp, PayPlug…).
- [ ] Trouver un centre pilote.
- [ ] Noter les choix dans `docs/decisions/`.

### 2. Mode de structure
- [ ] Réglage « association / commercial » dans `identite_structure`.
- [ ] Écrans affichés ou masqués selon le mode ; le club actuel ne voit rien changer (tests de non-régression d'abord).

### 3. Clients et comptes clients
- [ ] Fiche client : identité, niveau déclaré et justificatif (carte, carnet), nombre de plongées, date de la dernière, CACI (dates seulement), assurance.
- [ ] Compte client en mode commercial : création en autonomie, réservations, factures, carnet de plongée.
- [ ] Mineurs : autorisation parentale, règles actuelles (droit à l'image, aucun champ de santé).
- [ ] Questionnaire de santé : seulement la case « rempli » et sa date, jamais les réponses.

### 4. Catalogue, tarifs, sorties bateau, réservation au comptoir (sans paiement)
- [ ] Produits : baptême, exploration, formation, spécialité, forfait 5/10 plongées, location, nitrox, séjour.
- [ ] Tarifs : TTC, taux de TVA, enfant, groupe, haute saison, codes promo.
- [ ] Forfaits et cartes de plongées, solde décompté à chaque plongée.
- [ ] Sorties bateau : créneau, site, bateau, capacité, niveau minimum.
- [ ] Réservation au comptoir par le personnel, liste d'attente.
- [ ] Annulation : conditions générales de vente, remboursement ou avoir, annulation météo.
- [ ] La sortie bateau crée sa fiche de sécurité ; palanquées proposées à partir des clients inscrits.

### 5. Paiement et facturation
- [ ] Paiement en ligne : acompte, solde ; terminal de paiement sur place.
- [ ] Factures, avoirs, reçus : numérotation continue, mentions obligatoires, TVA, journal en ajout seul.
- [ ] Réforme de la facture électronique (2026-2027) : vérifier avec un comptable, envisager une plateforme agréée.
- [ ] Caisse du jour, export comptable (FEC ou CSV).

### 6. Réservation en ligne par le client
- [ ] Choix du créneau, contrôle du niveau et du CACI, paiement.
- [ ] Widget de réservation à intégrer au site du centre.
- [ ] E-mails automatiques : confirmation, rappel la veille, demande d'avis, CACI qui expire.
- [ ] Consentement aux e-mails commerciaux, séparé des e-mails de réservation.

### 7. Personnel
- [ ] Diplômes professionnels et échéances : DEJEPS, BEES, DE, carte professionnelle, PADI/SSI à jour.
- [ ] Habilitations calculées à partir de ces diplômes (étendre `HabilitationService`, qui ne lit que E1-E4).
- [ ] Rôles : gérant, accueil, moniteur, capitaine.
- [ ] Planning du personnel, relevé des heures et plongées encadrées (pas la paie).

### 8. Formations et certifications
- [ ] Catalogues PADI et SSI (âges, profondeurs, prérequis), en réutilisant notation et grille.
- [ ] Délivrance : numéro et date de la carte émise par l'organisme.
- [ ] Carnet de plongée du client, tiré des sorties.

### 9. Location de matériel, gonflage, nitrox
- [ ] Location payante, caution, tailles, dommages facturés.
- [ ] Règles actuelles gardées (désinfection des détendeurs, échéances bloquantes).
- [ ] Gonflage et nitrox vendus par plongée.

### 10. Bateau, pilotage, obligations
- [ ] Bateaux (capacité, armement de sécurité, capitaine) et sites (profondeur, niveau, coordonnées).
- [ ] Annulation ou report météo d'une sortie, toutes réservations à la fois.
- [ ] Tableau de bord : chiffre d'affaires, remplissage, plongées par moniteur, locations.
- [ ] CGV, mentions légales, RC, déclaration d'établissement d'APS.
- [ ] RGPD commercial : base légale, durées de conservation, accès et effacement.

Les étapes 2 à 4 suffisent pour montrer un produit à un centre ; l'étape 5 le rend vendable.
