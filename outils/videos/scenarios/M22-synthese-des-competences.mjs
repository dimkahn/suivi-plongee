// M22 — La synthèse des compétences d'un groupe d'entraînement, puis d'un élève.
// Tournage du 2026-10-12, 5e série (changer cette date dans tous les scénarios les fait tous retourner).
// Groupe Débutants (V107) : élèves N1 notés en septembre.
export default {
  id: 'M22',
  titre: 'La synthèse des compétences d\'un groupe ou d\'un élève',
  public: 'Moniteur',
  resume: 'L\'avancement de tous les élèves d\'un groupe d\'un coup d\'œil (NT, ECA, A), puis la fiche de synthèse d\'un élève.',
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
    await legende('La photo de chaque élève, puis le nombre de compétences acquises.', 3500);
    await legende('Dans chaque case, l\'état de la compétence : NT non travaillée, ECA en cours d\'acquisition, A acquise.', 0);
    await page.locator('.defilement').first().evaluate(el => el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' }));
    await pause(4500);

    await legende('La dernière ligne compte les élèves qui ont acquis chaque compétence.', 0);
    await defiler(300);
    await pause(3500);

    await legende('Les boutons du haut passent d\'un groupe à l\'autre, et « Imprimer » donne une version papier.', 4500);
    await legende('Touchez une case ou un nom : la grille de l\'élève s\'ouvre, pour le noter ou valider la compétence.', 0);
    await toucher(page.locator('table.tableau tbody th a').first(), { apres: 2000 });

    await legende('Pour un seul élève, « Synthèse A / ECA / NT », sous son nom.', 0);
    await toucher(page.getByRole('link', { name: 'Synthèse A / ECA / NT' }), { apres: 1800 });
    await legende('En haut, combien de compétences sont acquises, en cours, non travaillées.', 3500);
    await legende('Dessous, un camembert de toutes les compétences : chaque part se remplit jusqu\'au pourcentage de ses critères acquis.', 0);
    await page.locator('.camembert').scrollIntoViewIfNeeded();
    await pause(4500);
    await legende('Puis un cercle par compétence, au même numéro, avec son nom et son pourcentage.', 0);
    await page.locator('.camemberts').scrollIntoViewIfNeeded();
    await pause(3500);
    await legende('Puis la liste de chacune ; pour celles en cours, l\'état de chaque critère.', 0);
    await defiler(600, 2000);
    await defiler(600, 2000);
    await legende('« Imprimer » en fait un bilan papier pour l\'élève.', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
