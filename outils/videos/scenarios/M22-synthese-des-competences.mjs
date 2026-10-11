// M22 — La synthèse des compétences d'un groupe d'entraînement.
// Tournage du 2026-10-11, 1re série (changer cette date dans tous les scénarios les fait tous retourner).
// Groupe Débutants (V107) : élèves N1 notés en septembre.
export default {
  id: 'M22',
  titre: 'La synthèse des compétences d\'un groupe',
  public: 'Moniteur',
  resume: 'L\'avancement de tous les élèves d\'un groupe d\'un coup d\'œil : une ligne par élève, une case par compétence.',
  compte: 'e2@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, defiler } = g;

    await page.goto(`${process.env.APPLI ?? 'http://localhost:4200'}/eleves`);
    await pause(1000);
    await legende('Où en est tout le groupe ? Dans « Infos élèves », touchez le bouton du groupe.', 0);
    await toucher(page.getByRole('button', { name: 'Débutants', exact: true }), { apres: 1200 });

    await legende('Puis « Synthèse des compétences du groupe ».', 0);
    await toucher(page.getByRole('link', { name: 'Synthèse des compétences du groupe' }), { apres: 1800 });

    await legende('Une ligne par élève, une case par compétence : tout le groupe d\'un coup d\'œil.', 0);
    await page.locator('table.tableau').first().scrollIntoViewIfNeeded();
    await pause(3500);
    await legende('« Bilan » : les compétences validées et la part des critères acquis.', 3500);
    await legende('Dans chaque case : ✓ validée, 5 sur 5 à valider, sinon les critères acquis sur le total. En orange avec « ! », en retard sur la progression.', 0);
    await page.locator('.defilement').first().evaluate(el => el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' }));
    await pause(4500);

    await legende('La dernière ligne compte les élèves qui ont validé chaque compétence.', 0);
    await defiler(300);
    await pause(3500);

    await legende('Les boutons du haut passent d\'un groupe à l\'autre, et « Imprimer » donne une version papier.', 4500);
    await legende('Touchez une case ou un nom : la grille de l\'élève s\'ouvre, pour le noter ou valider la compétence.', 0);
    await toucher(page.locator('table.tableau tbody th a').first(), { apres: 2000 });
    await legende(null, 0);
    await pause(500);
  }
};
