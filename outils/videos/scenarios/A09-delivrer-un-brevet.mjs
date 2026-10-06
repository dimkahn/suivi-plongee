// A9 — Clore une formation : brevet délivré.
// Tournage du 2026-10-06 (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'A9',
  titre: 'Clore une formation : brevet délivré',
  public: 'Administrateur',
  resume: 'En fin de formation, passer l\'inscription à « Brevet délivré » : la grille est archivée, la fiche prend le niveau.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, saisir, choisir, administration, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await administration('Inscriptions');
    await legende('Sonia a réussi son N3.', 0);
    await saisir('#filtre-nom', 'Sonia');
    await pause(800);
    const ligne = page.locator('main li, main .carte').filter({ hasText: 'Sonia Perrot' }).last();
    await toucher(ligne.getByRole('button', { name: 'Modifier' }));
    const dialogue = page.locator('dialog[open]');
    await choisir(dialogue.locator('#statut-edition'), 'Brevet délivré');
    await vignette();
    await toucher(dialogue.getByRole('button', { name: 'Enregistrer' }), { apres: 2000 });
    await legende('La formation est close : sa grille passe en lecture seule, telle qu\'elle a été validée.', 4000);
    await legende('Son dossier prend le niveau N3 : il sera proposé à sa prochaine inscription.', 4000);
    await legende('Autres statuts : suspendu (reprise la saison suivante), abandon.', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
