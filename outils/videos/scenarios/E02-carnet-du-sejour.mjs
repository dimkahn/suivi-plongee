// E2 — Compte élève : le carnet du séjour.
// Tournage du 2026-10-12, 12e série (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'E2',
  titre: 'Le carnet du séjour',
  public: 'Élève',
  resume: 'Son vol, sa voiture, sa chambre, le programme et les affaires à prévoir, sur son téléphone.',
  compte: 'eleve@club.fr',

  async jouer({ page, pause, legende, toucher, menu, defiler, vignette }) {
    await page.goto(`${APPLI}/cursus`);
    await pause(1500);
    await legende('Camille part en séjour avec le club. « Plus », puis « Séjours ».', 0);
    await menu('Séjours');
    await toucher(page.locator('main a').filter({ hasText: 'Séjour à Port-Cros' }).first(), { apres: 1500 });
    await legende('« Mon séjour » : son vol aller et retour, sa voiture depuis l\'aéroport, sa chambre.', 4500);
    await vignette();
    await legende('Puis le programme, jour par jour.', 0);
    await defiler(600, 2000);
    await legende('« Affaires » : ce qu\'il faut emporter.', 0);
    await toucher(page.getByRole('tab', { name: 'Affaires' }), { apres: 3500 });
    await legende('« Imprimer le carnet » : tout sur une page, à garder sans réseau.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
