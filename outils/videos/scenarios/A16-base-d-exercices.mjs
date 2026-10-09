// A16 — La base d'exercices.
// Tournage du 2026-10-09, 5e série (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'A16',
  titre: 'La base d\'exercices',
  public: 'Administrateur',
  resume: 'Les exercices de chaque compétence du N1 et du N2, par phase, et les critères qu\'ils font travailler.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, administration, defiler, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await administration('Base d\'exercices');
    await legende('Pour chaque compétence : ses exercices d\'initiation, de perfectionnement et de maîtrise.', 4500);
    await legende('Sous chaque exercice, les critères qu\'il fait travailler.', 3500);
    await vignette();
    await toucher(page.getByRole('button', { name: 'Modifier', exact: true }).first(), { apres: 1500 });
    await legende('« Modifier » : numéro, phase, intitulé, et les critères travaillés, au moins un.', 4500);
    await defiler(400, 2000);
    await legende('Seul un exercice de maîtrise fait passer ses critères à « Acquis ».', 4000);
    await toucher(page.getByRole('button', { name: 'Annuler' }).first(), { apres: 1000 });
    await legende('Un exercice déjà noté ne se supprime pas : on le désactive.', 3500);
    await legende('Le N2 a aussi sa base : 9 exercices par compétence, PA20 et PE40, avec leurs schémas.', 0);
    await page.locator('select#version').selectOption({ label: 'N2 · MFT PA20 | PE40 (2026-05)' });
    await pause(2500);
    await legende('Au N2, les exercices de maîtrise se font en milieu naturel : en fosse, ils ne comptent qu\'à l\'entraînement.', 5000);
    await legende(null, 0);
    await pause(500);
  }
};
