// M3 — Faire l'appel d'une séance.
export default {
  id: 'M3',
  titre: 'Faire l\'appel d\'une séance',
  public: 'Moniteur',
  resume: 'La feuille de présence d\'une séance en moins d\'une minute : nage, bloc ou théorie pour chaque élève.',
  compte: 'e2@club.fr',

  async jouer({ page, pause, legende, toucher, saisir, defiler, enHaut, menu, choisirDerniereSeance }) {
    await page.goto(`${process.env.APPLI ?? 'http://localhost:4200'}/eleves`);
    await pause(1000);
    await legende('Au bord du bassin : menu, puis « Présences ».', 0);
    await menu('Présences');

    await legende('D\'abord la séance. Touchez « Changer » pour ouvrir le calendrier.', 0);
    await choisirDerniereSeance();
    await legende('Les jours marqués portent une séance. Le lundi, la piscine et la fosse sont deux séances distinctes.', 4000);
    await legende('Un élève prévient de sa venue ? Les présences s\'annoncent jusqu\'à une semaine avant la séance.', 4000);

    await legende('« Au programme » : ce que la progression du club prévoit ce mois-ci.', 3500);

    await legende('Filtrez sur votre groupe d\'entraînement.', 0);
    await toucher(page.getByRole('button', { name: 'Débutants', exact: true }), { apres: 1200 });

    const cartes = page.locator('ul.eleves li');
    await legende('Touchez un élève, puis ce qu\'il a fait : nage, bloc ou théorie.', 0, { enHaut: true });
    for (const [k, choix] of [[0, 'Bloc'], [1, 'Nage'], [2, 'Bloc'], [3, 'Théorie']]) {
      await toucher(cartes.nth(k).locator('.zone-identite'), { apres: 600 });
      await toucher(page.locator('.barre-choix').getByRole('button', { name: choix }), { apres: 900 });
    }
    await legende('Chaque choix est enregistré tout de suite. Pas de bouton « Enregistrer ».', 3500, { enHaut: true });
    await legende('Un élève sans choix est absent.', 3000, { enHaut: true });
    await legende('L\'appel d\'abord : seul un élève noté présent peut être évalué sur la séance.', 3500, { enHaut: true });

    await legende('Erreur ? Touchez de nouveau le choix actif pour l\'effacer.', 0, { enHaut: true });
    await toucher(cartes.nth(3).locator('.zone-identite'), { apres: 600 });
    await toucher(page.locator('.barre-choix').getByRole('button', { name: 'Théorie' }), { apres: 1500 });

    await legende('Le compteur en haut de la liste fait le bilan.', 0);
    await page.locator('.bilan').scrollIntoViewIfNeeded();
    await pause(3000);
    await legende('Sans réseau, les choix restent sur le téléphone et partent au retour du réseau.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
