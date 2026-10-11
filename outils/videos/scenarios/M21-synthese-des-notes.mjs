// M21 — La synthèse des notes d'une séance, pour un niveau.
// Tournage du 2026-10-11, 5e série (changer cette date dans tous les scénarios les fait tous retourner).
// Séance du lundi 21 septembre en piscine : Tiago y a noté plusieurs élèves
// du groupe Débutants (V107).
export default {
  id: 'M21',
  titre: 'La synthèse des notes d\'une séance',
  public: 'Moniteur',
  resume: 'Tout ce qui a été noté pendant une séance pour un niveau : critère par critère, élève par élève, et qui reste à évaluer.',
  compte: 'e2@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, menu, defiler, choisirSeanceDu } = g;

    await page.goto(`${process.env.APPLI ?? 'http://localhost:4200'}/eleves`);
    await pause(1000);
    await legende('Que s\'est-il noté pendant la séance ? Tout commence dans « Présences ».', 0);
    await menu('Présences');

    await legende('Choisissez la séance : ici, la piscine du lundi 21 septembre.', 0);
    await choisirSeanceDu('21/09/2026');
    await toucher(page.getByRole('button', { name: 'Débutants', exact: true }), { apres: 1200 });

    await legende('Touchez « Synthèse des notes » : elle s\'ouvre sur le niveau du groupe filtré.', 0);
    await toucher(page.getByRole('link', { name: 'Synthèse des notes' }), { apres: 1800 });
    await legende('En haut, le bilan : présents, élèves évalués, et ceux qui ne l\'ont pas encore été.', 4000);

    await legende('Le tableau : une ligne par élève, une colonne par critère noté avec l\'état de l\'exercice réalisé, et les commentaires.', 0);
    await page.locator('table.tableau').scrollIntoViewIfNeeded();
    await pause(3500);
    await legende('Devant chaque nom, la photo de l\'élève ; dessous, l\'encadrant qui l\'a noté et ce qu\'il a fait ce soir-là.', 0);
    await page.locator('.defilement').evaluate(el => el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' }));
    await pause(3500);

    await legende('Par critère : combien d\'élèves ont l\'exercice acquis, en cours ou non abordé.', 0);
    await toucher(page.getByRole('tab', { name: 'Par critère' }), { apres: 1200 });
    await page.locator('section.critere').first().scrollIntoViewIfNeeded();
    await pause(3500);
    await legende('Puis, pour chacun, l\'exercice noté, l\'état de la compétence s\'il diffère, l\'encadrant et ses commentaires.', 0);
    await defiler(400);
    await pause(3000);

    await legende('Par élève : les notes de chacun sur la séance.', 0);
    await page.getByRole('tab', { name: 'Par élève' }).scrollIntoViewIfNeeded();
    await toucher(page.getByRole('tab', { name: 'Par élève' }), { apres: 1500 });
    await legende('« Pas encore évalué » signale un présent qui n\'a reçu aucune note.', 4000);
    await legende('Touchez un nom pour ouvrir sa grille sur cette séance.', 3500);

    await legende('Les autres niveaux présents ce soir-là s\'affichent d\'une touche, et « Imprimer » donne une version papier.', 4500);
    await legende(null, 0);
    await pause(500);
  }
};
