// A14 — Le référentiel MFT.
import { APPLI } from '../commun.mjs';

export default {
  id: 'A14',
  titre: 'Le référentiel MFT',
  public: 'Administrateur',
  resume: 'Les compétences fédérales de chaque niveau, leurs règles, et la prudence avant de corriger un référentiel en service.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, administration, defiler, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await administration('Référentiel MFT');
    await legende('Une version datée du MFT par niveau, avec ses règles : âge, prérequis, encadrant requis…', 4000);
    await legende('Ces règles sont appliquées par le serveur à chaque note et chaque validation.', 3500);
    await toucher(page.getByRole('button', { name: 'N2', exact: true }), { apres: 1500 });
    await legende('Le N2 se scinde en qualifications : PA20 (autonome à 20 m) et PE40 (encadré à 40 m).', 4000);
    await vignette();
    await defiler(800, 2500);
    await legende('Chaque bloc et chaque critère peut être corrigé ici…', 0);
    await toucher(page.getByRole('button', { name: 'Modifier', exact: true }).first(), { apres: 1500 });
    await legende('… mais attention : la correction s\'applique aussi aux élèves en cours de formation.', 4500);
    await toucher(page.getByRole('button', { name: 'Annuler' }).first(), { apres: 1000 });
    await legende('Une nouvelle révision fédérale s\'importe plutôt comme une nouvelle version.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
