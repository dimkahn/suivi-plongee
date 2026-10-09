// M16 — Infos élèves.
// Tournage du 2026-10-09, 4e série (changer cette date dans tous les scénarios les fait tous retourner).
export default {
  id: 'M16',
  titre: 'Infos élèves',
  public: 'Moniteur',
  resume: 'Toute la saison sur un écran : CACI, séances suivies, contacts d\'urgence.',
  compte: 'e2@club.fr',

  async jouer({ page, pause, legende, toucher, saisir, defiler, enHaut }) {
    await page.goto(`${process.env.APPLI ?? 'http://localhost:4200'}/eleves`);
    await pause(1200);
    await legende('« Infos élèves » : la page d\'accueil. Toute la saison sur un seul écran.', 3500);
    await page.locator('table').scrollIntoViewIfNeeded();
    await legende('Pour chaque élève : son niveau préparé et son CACI.', 3500);
    await legende('CACI : vert, plus d\'un mois ; orange, moins d\'un mois ; rouge, moins de 15 jours ; ⚠ expiré.', 5000);

    await legende('Faites glisser le tableau vers la gauche : séances bloc et nage, puis chaque date.', 0);
    const tableau = page.locator('table').locator('xpath=..');
    for (let i = 0; i < 6; i++) {
      await tableau.evaluate(el => el.scrollBy({ left: 90, behavior: 'smooth' }));
      await pause(350);
    }
    await pause(2500);
    await tableau.evaluate(el => el.scrollTo({ left: 0, behavior: 'smooth' }));
    await pause(800);

    await enHaut();
    await legende('Les boutons filtrent par groupe d\'entraînement.', 0);
    await toucher(page.getByRole('button', { name: 'Débutants', exact: true }), { apres: 1800 });
    await legende('La recherche retrouve un élève par son nom ou son prénom.', 0);
    await saisir(page.getByPlaceholder(/Rechercher/), 'mor');
    await pause(1200);

    await legende('Touchez son nom pour ouvrir sa fiche.', 0);
    await toucher(page.getByRole('link', { name: 'Léa Morel', exact: true }), { apres: 1800 });
    await legende('« Informations supplémentaires » : téléphone et contact d\'urgence.', 0);
    await toucher(page.getByRole('button', { name: 'Informations supplémentaires' }), { apres: 1200 });
    await page.locator('.infos-supplementaires').scrollIntoViewIfNeeded();
    await pause(3500);
    await legende('Aucune donnée de santé n\'est enregistrée : seule la date de fin du certificat.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
