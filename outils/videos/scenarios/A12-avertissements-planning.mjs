// A12 — Lire les avertissements du planning.
// Tournage du 2026-10-09, 2e série (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'A12',
  titre: 'Les avertissements du planning',
  public: 'Administrateur',
  resume: 'Fosse trop pleine, débutants sans limite à 6 m, pas d\'E3 présent : le planning prévient, sans bloquer.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, administration, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await administration('Planning du bassin');
    await legende('Le ⚠ au-dessus d\'une soirée signale quelque chose à vérifier.', 3500);
    await legende('Mettons les débutants en fosse, sans limite de profondeur :', 0);
    const caseDebutants = page.locator('button.case[aria-label^="Débutants, "]').nth(5);
    await toucher(caseDebutants, { apres: 900 });
    const dialogue = page.locator('dialog[open]');
    await toucher(dialogue.locator('label.option').filter({ hasText: /^\s*Fosse/ }).first(), { apres: 600 });
    await toucher(dialogue.getByRole('button', { name: 'Enregistrer' }), { apres: 1800 });
    await legende('Aussitôt, un avertissement : un groupe N1 en fosse sans limite à 6 m.', 0);
    await page.getByRole('heading', { name: 'À vérifier' }).scrollIntoViewIfNeeded();
    await pause(3500);
    await vignette();
    await legende('Les autres : fosse au-delà de sa capacité, ligne donnée à deux groupes, encadrants tous absents…', 4500);
    await legende('… et aucun E3 parmi les encadrants présents : il faut un directeur de plongée.', 4000);

    await legende('Un encadrant prévient par téléphone ? Répondez à sa place, dans la soirée.', 0);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await pause(700);
    await toucher(page.locator('button.case.dp-fosse').nth(5), { apres: 900 });
    const soiree = page.locator('dialog[open]');
    await toucher(soiree.getByRole('button', { name: 'Tiago Nogueira présent' }), { apres: 800 });
    await toucher(soiree.getByRole('button', { name: 'Gwendoline Marchand présent' }), { apres: 1200 });
    await toucher(soiree.getByRole('button', { name: 'Annuler' }), { apres: 1200 });
    await legende('Les avertissements guident, ils ne bloquent jamais : la décision reste au club.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
