// D2 — Ajouter un équipement.
import { APPLI } from '../commun.mjs';

export default {
  id: 'D2',
  titre: 'Ajouter un équipement',
  public: 'Directeur technique',
  resume: 'Enregistrer un bloc neuf : caractéristiques, régime TIV, dates de contrôle.',
  compte: 'e3@club.fr',

  async jouer({ page, pause, legende, toucher, saisir, dater, choisir, cocher, menu, vignette }) {
    await page.goto(`${APPLI}/materiel`);
    await pause(1200);
    await legende('Un bloc neuf arrive au club : « Ajouter un équipement ».', 0);
    await toucher(page.getByRole('link', { name: 'Ajouter un équipement' }), { apres: 1500 });
    await legende('Un seul formulaire pour les quatre types : les champs suivent le type choisi.', 0);
    await toucher(page.locator('label.choix').filter({ hasText: 'Bloc' }).first(), { apres: 800 });
    await saisir('#reference', 'B-04');
    await saisir('#marque', 'Roth');
    await saisir('#numeroSerie', 'RO-512877');
    await saisir('#volume', '12');
    await choisir('#matiere', 'Acier', { exact: false });
    await saisir('#pressionService', '232');
    await saisir('#pressionEpreuve', '348');
    await dater('#premiereEpreuve', '2026-09-01');
    await dater('#achat', '2026-09-15');
    await legende('Les dates de contrôle font démarrer les échéances.', 0);
    await dater('#derniereTiv', '2026-09-15');
    await vignette();
    await toucher(page.getByRole('button', { name: 'Enregistrer' }).first(), { apres: 2000 });
    await legende('Prochaine inspection, prochaine requalification : l\'appli les calcule.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
