// D1 — L'inventaire du matériel.
import { APPLI } from '../commun.mjs';

export default {
  id: 'D1',
  titre: 'L\'inventaire du matériel',
  public: 'Directeur technique',
  resume: 'Blocs, détendeurs, gilets et combinaisons : leur état, et ce qui arrive à échéance.',
  compte: 'e3@club.fr',

  async jouer({ page, pause, legende, toucher, saisir, menu, defiler, enHaut, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await legende('Le directeur technique a une entrée de plus dans le menu : « Matériel ».', 0);
    await menu('Matériel');
    await legende('En haut, les compteurs : disponible, prêté, à régulariser, hors service.', 3500);
    await vignette();
    await legende('« À surveiller » : les échéances proches ou dépassées, calculées par l\'appli.', 0);
    await page.getByRole('heading', { name: 'À surveiller' }).scrollIntoViewIfNeeded();
    await pause(4000);
    await legende('TIV tous les 12 mois, requalification des blocs, révisions fabricant.', 3500);
    await legende('Filtrez par type, ou cherchez une référence.', 0);
    await toucher(page.getByRole('button', { name: 'Détendeurs' }), { apres: 1200 });
    await defiler(400, 1200);
    await enHaut();
    await toucher(page.getByRole('button', { name: 'Tout' }), { apres: 600 });
    await saisir('#recherche', 'B-0');
    await pause(1500);
    await legende('Chaque ligne ouvre la fiche de l\'équipement : sa fiche de gestion.', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
