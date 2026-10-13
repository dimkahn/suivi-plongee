// E2 — Compte élève : le carnet du séjour.
// Tournage du 2026-10-13, 12e série (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'E2',
  titre: 'Le carnet du séjour',
  public: 'Élève',
  resume: 'Son vol, sa voiture, sa chambre, le programme, les affaires à prévoir et ses frais, sur son téléphone ; elle y complète ses informations.',
  compte: 'eleve@club.fr',

  async jouer({ page, pause, legende, toucher, menu, defiler, vignette }) {
    await page.goto(`${APPLI}/cursus`);
    await pause(1500);
    await legende('Camille part en séjour avec le club. « Plus », puis « Séjours ».', 0);
    await menu('Séjours');
    await toucher(page.locator('main a').filter({ hasText: 'Séjour à Port-Cros' }).first(), { apres: 1500 });
    await legende('« Mon séjour » tient sur une ligne ; elle la touche pour le détail : vols, voiture, chambre.', 0);
    await toucher(page.locator('.mon-voyage summary'), { apres: 3500 });
    await vignette();
    await legende('« Modifier mes informations » : son vol, ses repas, la personne à prévenir.', 0);
    await toucher(page.getByRole('button', { name: 'Modifier mes informations' }), { apres: 3500 });
    await toucher(page.getByRole('button', { name: 'Annuler' }), { apres: 800 });
    await legende('Puis le programme, jour par jour.', 0);
    await defiler(600, 2000);
    await legende('« Pratique » : ce qu\'il faut emporter, et les infos pratiques.', 0);
    await toucher(page.getByRole('tab', { name: 'Pratique' }), { apres: 3500 });
    await legende('« Frais » : en tête, ce qu\'elle doit et à qui ; puis les dépenses du séjour.', 0);
    await toucher(page.getByRole('tab', { name: 'Frais' }), { apres: 3500 });
    await legende('Elle a payé quelque chose ? Elle donne la note à un moniteur du séjour, qui la saisit pour elle.', 4000);
    await legende('« Imprimer le carnet » : tout sur une page, à garder sans réseau.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
