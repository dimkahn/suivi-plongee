// M3 — Faire l'appel d'une séance.
// Tournage du 2026-10-11, 6e série (changer cette date dans tous les scénarios les fait tous retourner).
export default {
  id: 'M3',
  titre: 'Faire l\'appel d\'une séance',
  public: 'Moniteur',
  resume: 'La feuille de présence d\'une séance : le détail des exercices préparés (replié d\'office), nage, bloc ou théorie pour chaque élève, le bilan du groupe filtré, puis qui reste à évaluer et le bouton « Noter », d\'où l\'on revient à la feuille.',
  compte: 'e2@club.fr',

  async jouer({ page, pause, legende, toucher, menu, choisirDerniereSeance }) {
    await page.goto(`${process.env.APPLI ?? 'http://localhost:4200'}/eleves`);
    await pause(1000);
    await legende('Au bord du bassin : menu, puis « Présences ».', 0);
    await menu('Présences');
    await legende('Un doute ? « Comment faire ? » rappelle les règles de l\'appel.', 3000);

    await legende('La feuille s\'ouvre sur la séance du jour, sinon sur la prochaine.', 3500);
    await legende('Une autre séance ? Touchez « Changer » pour ouvrir le calendrier.', 0);
    await choisirDerniereSeance();
    await legende('Les jours marqués portent une séance. Le lundi, la piscine et la fosse sont deux séances distinctes.', 4000);
    await legende('Un élève prévient de sa venue ? Les présences s\'annoncent jusqu\'à une semaine avant la séance.', 4000);

    await legende('« Au programme » : ce que la progression du club prévoit ce mois-ci.', 3500);
    await legende('Dessous, « Exercices de la séance », replié pour laisser la place à l\'appel. Touchez le titre pour voir ce que chaque groupe a préparé.', 0);
    await toucher(page.locator('.bascule-exercices'), { apres: 1500 });
    const exercice = page.locator('section.exercices .titre-exercice');
    if (await exercice.count() > 0) {
      await legende('Touchez un exercice : déroulement, critère de réussite, critères travaillés et schéma.', 0);
      await toucher(exercice.first(), { apres: 3500 });
      await toucher(exercice.first(), { apres: 600 });
    }
    await legende('Touchez de nouveau le titre pour replier la partie.', 0);
    await toucher(page.locator('.bascule-exercices'), { apres: 2000 });

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

    await legende('Le compteur en haut de la liste fait le bilan du groupe filtré ; il reste en haut de l\'écran quand la liste défile.', 0);
    await page.locator('.bilan').scrollIntoViewIfNeeded();
    await pause(3000);

    await legende('Séance passée : il compte aussi les présents qui n\'ont encore reçu aucune note.', 3500);
    await legende('« Synthèse des notes » réunit tout ce qui a été noté pour un niveau : voir la vidéo M21.', 0);
    await page.getByRole('link', { name: 'Synthèse des notes' }).scrollIntoViewIfNeeded();
    await pause(3500);
    await legende('« Voir les présents sans évaluation » n\'affiche plus qu\'eux.', 0);
    await toucher(page.getByRole('button', { name: 'Voir les présents sans évaluation' }), { apres: 1500 });
    await legende('« Pas encore évalué » ouvre la grille de l\'élève, pour le noter avant de partir.', 0);
    await cartes.first().locator('.non-note').scrollIntoViewIfNeeded();
    await pause(3500);
    await toucher(page.getByRole('button', { name: 'Voir tous les élèves' }), { apres: 1000 });
    await legende('Un présent déjà noté a un bouton « Noter » : sa grille s\'ouvre sur cette séance.', 0);
    const noter = page.locator('ul.eleves .noter');
    if (await noter.count() > 0) {
      await noter.first().scrollIntoViewIfNeeded();
      await pause(2000);
      await toucher(noter.first(), { apres: 2500 });
      await legende('En haut de sa fiche, le nom de l\'élève suivant passe directement au présent suivant du groupe, sans repasser par la feuille.', 4500, { enHaut: true });
      await legende('Une fois l\'élève noté, « Retour à la feuille de présence » ramène sur la même séance et le même groupe.', 0, { enHaut: true });
      await toucher(page.locator('.retour-presences'), { apres: 2500 });
    } else {
      await pause(3500);
    }
    await legende('Sans réseau, les choix restent sur le téléphone et partent au retour du réseau.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
