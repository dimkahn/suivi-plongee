// A7 — Inscrire un élève en formation.
// Tournage du 2026-10-09, 2e série (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'A7',
  titre: 'Inscrire un élève en formation',
  public: 'Administrateur',
  resume: 'N1, N2 ou N3 : le référentiel est figé à l\'inscription, avec un groupe d\'entraînement.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, saisir, choisir, administration, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await administration('Inscriptions');
    await toucher(page.getByRole('button', { name: 'Nouvelle inscription' }));
    await choisir('#saison', '2026-2027', { exact: false });
    await legende('On cherche l\'élève ; l\'appli suggère le niveau d\'après son parcours.', 0);
    await saisir('#eleve', 'Pet');
    await toucher(page.locator('#liste-eleves button').filter({ hasText: 'Nathan' }).first(), { apres: 900 });
    await choisir('#niveau', 'N1', { exact: false });
    await legende('Le groupe du niveau préparé est proposé d\'office ; ses référents suivront l\'élève.', 3500);
    await vignette();
    await toucher(page.getByRole('button', { name: 'Inscrire' }), { apres: 2000 });
    await legende('Le référentiel MFT actif est figé : une révision fédérale en cours d\'année ne le change pas.', 4500);
    await legende('« Modifier » change le statut ou le niveau, tant qu\'aucune compétence n\'est notée.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
