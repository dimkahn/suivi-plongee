// A13 — Adapter une progression type.
// Tournage du 2026-10-06 (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'A13',
  titre: 'Adapter une progression type',
  public: 'Administrateur',
  resume: 'L\'année d\'un niveau découpée en périodes de mois : ce qui est « au programme » et ce qui est « en retard ».',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, saisir, administration, defiler, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await administration('Progressions types');
    await legende('La progression N1 du club : des périodes de mois, avec les blocs travaillés.', 3500);
    await defiler(600, 2000);
    await legende('En mois et pas en dates : elle resert d\'une saison à l\'autre.', 3500);
    await legende('Elle fait apparaître « Au programme » dans les grilles, et calcule les blocs « En retard ».', 4500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await pause(700);
    await legende('Pour essayer une variante sans toucher à celle en service : « Dupliquer ».', 0);
    await toucher(page.getByRole('button', { name: 'Dupliquer' }).first(), { apres: 1800 });
    await toucher(page.getByRole('button', { name: 'Modifier' }).first(), { apres: 1200 });
    const nom = page.locator('#nom');
    await nom.fill('');
    await saisir(nom, 'N1 – essai saison 2027-2028');
    await vignette();
    await legende('Chaque période : ses mois, son milieu, ses conseils aux moniteurs, ses blocs cochés.', 4000);
    await toucher(page.getByRole('button', { name: 'Enregistrer' }).first(), { apres: 1800 });
    await legende('On la choisit ensuite pour une saison, dans « Saisons ».', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
