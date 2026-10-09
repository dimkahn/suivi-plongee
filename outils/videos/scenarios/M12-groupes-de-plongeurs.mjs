// M12 — Groupes de plongeurs pour un séjour.
// Tournage du 2026-10-09, 2e série (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'M12',
  titre: 'Groupes de plongeurs pour un séjour',
  public: 'Moniteur',
  resume: 'Saisir une fois les plongeurs d\'un séjour, puis reprendre le groupe dans chaque fiche de sécurité.',
  compte: 'e2@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, saisir, menu, vignette } = g;
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await legende('Un séjour, c\'est plusieurs plongées avec les mêmes plongeurs. Menu, « Groupes ».', 0);
    await menu('Groupes');
    await legende('On saisit la liste une seule fois : « Nouveau groupe ».', 0);
    await toucher(page.getByRole('button', { name: 'Nouveau groupe' }), { apres: 800 });
    await saisir('#nomNouveauGroupe', 'Séjour mer — mai 2027');
    const plongeurs = [
      ['Mateo', 'Vasquez', 'N2', ''],
      ['Camille', 'Berthier', 'N1', 'N2'],
      ['Flora', 'Vasseur', 'E2', '']
    ];
    for (const [prenom, nom, aptitude, preparee] of plongeurs) {
      await toucher(page.getByRole('button', { name: '+ Plongeur' }).first(), { apres: 500 });
      const ligne = page.locator('input[placeholder="Prénom"]').last().locator('xpath=..');
      await saisir(ligne.getByPlaceholder('Prénom'), prenom);
      await saisir(ligne.getByPlaceholder('Nom', { exact: true }), nom);
      await saisir(ligne.getByPlaceholder('Aptitude (ex. N2, E2…)'), aptitude);
      if (preparee) await saisir(ligne.getByPlaceholder('Qualification préparée'), preparee);
    }
    await vignette();
    await toucher(page.getByRole('button', { name: 'Créer le groupe' }), { apres: 1800 });
    await legende('Dans chaque fiche de sécurité du séjour, choisissez ce groupe : ses plongeurs arrivent d\'un coup.', 4500);
    await legende('Il suffit ensuite de les répartir dans les palanquées.', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
