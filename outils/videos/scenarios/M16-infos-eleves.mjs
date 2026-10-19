// M16 — Infos élèves.
// Tournage du 2026-10-12, 12e série (changer cette date dans tous les scénarios les fait tous retourner).
export default {
  id: 'M16',
  titre: 'Infos élèves',
  public: 'Moniteur',
  resume: 'Toute la saison sur un écran : progression, CACI, séances suivies, contacts d\'urgence.',
  compte: 'e2@club.fr',

  async jouer({ page, pause, legende, toucher, saisir, defiler, enHaut, selon }) {
    await page.goto(`${process.env.APPLI ?? 'http://localhost:4200'}/eleves`);
    await pause(1200);
    await legende(selon({
      telephone: '« Infos élèves », l\'onglet « Élèves » sur téléphone : toute la saison sur un seul écran.',
      ordinateur: '« Infos élèves », dans le menu en haut : toute la saison sur un seul écran.'
    }), 3500);
    await page.locator('table').scrollIntoViewIfNeeded();
    await legende('Sous chaque nom, la barre de progression de sa formation : la part des critères acquis.', 0);
    await page.locator('.avancement').first().scrollIntoViewIfNeeded();
    await pause(4000);
    await legende('Pour chaque élève : son niveau préparé et son CACI.', 3500);
    await legende('CACI : vert, plus d\'un mois ; orange, moins d\'un mois ; rouge, moins de 15 jours ; ⚠ expiré.', 5000);

    await legende(selon({
      telephone: 'Faites glisser le tableau vers la gauche : séances bloc et nage, puis chaque date.',
      ordinateur: 'Plus large que l\'écran, le tableau défile sur le côté : séances bloc et nage, puis chaque date.'
    }), 0);
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
    await legende('Dessous, « Synthèse des compétences du groupe » montre l\'avancement de tout le groupe : voir la vidéo M22.', 4000);
    await legende('La recherche retrouve un élève par son nom ou son prénom.', 0);
    await saisir(page.getByPlaceholder(/Rechercher/), 'mor');
    await pause(1200);

    await legende('Touchez son nom pour ouvrir sa fiche.', 0);
    await toucher(page.getByRole('link', { name: 'Léa Morel', exact: true }), { apres: 1800 });
    await legende('« Plus d\'actions », puis « Informations supplémentaires » : téléphone et contact d\'urgence.', 0);
    await toucher(page.getByRole('button', { name: /^Plus d'actions/ }), { apres: 900 });
    await toucher(page.getByRole('menuitem', { name: 'Informations supplémentaires' }), { apres: 1200 });
    await page.locator('.infos-supplementaires').scrollIntoViewIfNeeded();
    await pause(3500);
    await legende('Aucune donnée de santé n\'est enregistrée : seule la date de fin du certificat.', 4000);
    await toucher(page.getByRole('dialog').locator('.actions-dialogue').getByRole('button', { name: 'Fermer' }), { apres: 900 });

    await legende('Les tailles de gilet et de combinaison se corrigent par « Plus d\'actions », puis « Modifier les tailles ».', 0);
    await toucher(page.getByRole('button', { name: /^Plus d'actions/ }), { apres: 900 });
    await toucher(page.getByRole('menuitem', { name: 'Modifier les tailles' }), { apres: 2500 });
    await toucher(page.getByRole('button', { name: 'Annuler' }), { apres: 900 });
    await legende(null, 0);
    await pause(500);
  }
};
