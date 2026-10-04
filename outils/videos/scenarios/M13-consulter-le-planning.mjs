// M13 — Consulter le planning du bassin.
// Tournage du 2026-10-03 (changer cette date dans tous les scénarios les fait tous retourner).
export default {
  id: 'M13',
  titre: 'Consulter le planning du bassin',
  public: 'Moniteur',
  resume: 'Où est mon groupe ce soir ? Ligne d\'eau, fosse, DP fosse et DP piscine, avertissements.',
  compte: 'e2@club.fr',

  async jouer({ page, pause, legende, toucher, defiler, enHaut, menu }) {
    await page.goto(`${process.env.APPLI ?? 'http://localhost:4200'}/eleves`);
    await pause(1000);
    await legende('Le planning remplace le tableur du lundi soir : menu, puis « Planning ».', 0);
    await menu('Planning');

    await legende('En haut, la prochaine soirée : son DP fosse, son DP piscine et une note éventuelle.', 4000);
    await legende('Puis chaque groupe et son espace : le chiffre est la ligne d\'eau, « 5+6 » pour un groupe sur deux lignes.', 4000);
    await page.locator('.soiree').getByText('Votre groupe').scrollIntoViewIfNeeded();
    await legende('Sous chaque groupe, ses encadrants attitrés, le référent en premier.', 3500);
    await legende('En gras, ceux qui ont répondu présent ; rayés, ceux qui seront absents.', 3500);
    await legende('Ce soir, les débutants vont en fosse limitée à 6 m : « F6 ».', 3500);
    await legende('« À savoir » signale ce qui cloche : ici, un groupe dont l\'encadrant sera absent.', 4000);

    await enHaut();
    await legende('Les flèches passent d\'une soirée à l\'autre.', 0);
    await toucher(page.getByRole('button', { name: 'Soirée suivante' }), { apres: 1500 });
    await toucher(page.getByRole('button', { name: 'Soirée suivante' }), { apres: 1500 });
    await toucher(page.getByRole('button', { name: 'Soirée précédente' }), { apres: 1200 });
    await toucher(page.getByRole('button', { name: 'Soirée précédente' }), { apres: 1200 });

    await legende('Plus bas : vos prochaines soirées, avec l\'espace de votre groupe.', 0);
    await page.locator('.a-venir').scrollIntoViewIfNeeded();
    await pause(3500);
    await toucher(page.locator('.a-venir button.plus'), { apres: 1200 });
    await legende('Toute la saison, d\'un coup.', 0);
    await defiler(900, 2000);
    await legende('La légende en bas de page rappelle les abréviations.', 0);
    await page.locator('footer.version').scrollIntoViewIfNeeded();
    await pause(3000);
    await legende('Préparé hors ligne, le planning se consulte même sans réseau au bassin.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
