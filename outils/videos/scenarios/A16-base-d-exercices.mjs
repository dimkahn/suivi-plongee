// A16 — La base d'exercices.
// Tournage du 2026-10-08 (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'A16',
  titre: 'La base d\'exercices',
  public: 'Administrateur',
  resume: 'Les exercices de chaque compétence, par phase, et les critères qu\'ils font travailler.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, administration, defiler, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await administration('Base d\'exercices');
    await legende('Pour chaque compétence du N1 : ses exercices d\'initiation, de perfectionnement et de maîtrise.', 4500);
    await legende('Sous chaque exercice, les critères qu\'il fait travailler.', 3500);
    await vignette();
    await toucher(page.getByRole('button', { name: 'Modifier', exact: true }).first(), { apres: 1500 });
    await legende('« Modifier » : numéro, phase, intitulé, et les critères travaillés, au moins un.', 4500);
    await defiler(400, 2000);
    await legende('Seul un exercice de maîtrise fait passer ses critères à « Acquis ».', 4000);
    await toucher(page.getByRole('button', { name: 'Annuler' }).first(), { apres: 1000 });
    await legende('Un exercice déjà noté ne se supprime pas : on le désactive.', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
