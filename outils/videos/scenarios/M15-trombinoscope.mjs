// M15 — Le trombinoscope.
// Tournage du 2026-10-03 (changer cette date dans tous les scénarios les fait tous retourner).
export default {
  id: 'M15',
  titre: 'Le trombinoscope',
  public: 'Moniteur',
  resume: 'Mettre un nom sur un visage : élèves par groupe et encadrants du club.',
  compte: 'e2@club.fr',

  async jouer({ page, pause, legende, toucher, saisir, defiler, enHaut, menu }) {
    await page.goto(`${process.env.APPLI ?? 'http://localhost:4200'}/eleves`);
    await pause(1000);
    await legende('Mettre un nom sur un visage : menu, puis « Trombinoscope ».', 0);
    await menu('Trombinoscope');

    await legende('Les élèves de la saison, rangés par groupe d\'entraînement.', 0);
    await defiler(500, 1500);
    await pause(1500);
    await legende('Pas de photo sans le droit à l\'image : il est distinct de l\'autorisation de plonger.', 4500);
    await enHaut();

    await legende('Filtrez sur un groupe…', 0);
    await toucher(page.getByRole('button', { name: 'Débutants', exact: true }), { apres: 1800 });
    await legende('… ou cherchez un prénom.', 0);
    await saisir(page.getByPlaceholder(/Rechercher/), 'Léa');
    await pause(1200);
    await legende('Touchez la carte pour ouvrir sa grille de compétences.', 0);
    await toucher(page.locator('a.carte.fiche').first(), { apres: 2000 });
    await pause(1500);
    await page.goBack();
    await pause(1200);

    await legende('L\'onglet « Moniteurs » montre les encadrants du club.', 0);
    await toucher(page.getByRole('button', { name: 'Moniteurs', exact: true }), { apres: 2500 });
    await legende('Votre photo se dépose depuis « Mon compte ».', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
