// A10 — Composer les groupes d'entraînement.
// Tournage du 2026-10-03 (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'A10',
  titre: 'Composer les groupes d\'entraînement',
  public: 'Administrateur',
  resume: 'Les groupes de la saison, leurs référents et encadrants attitrés, leurs lignes d\'eau, et le rangement des élèves.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, saisir, cocher, administration, rechercherEtChoisir, defiler, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await administration('Groupes d\'entraînement');
    await legende('Chaque groupe : son niveau préparé, ses lignes d\'eau attitrées, ses référents et ses encadrants.', 4000);
    await legende('Un nouveau groupe pour les N1 tout frais :', 0);
    await toucher(page.getByRole('button', { name: 'Nouveau groupe' }));
    await saisir('#nom-groupe', 'Perfect N1');
    await legende('Cochez sa ligne d\'eau attitrée ; un groupe nombreux peut en avoir plusieurs.', 0);
    await cocher(page.locator('.lignes-attitrees').getByLabel('Ligne 1', { exact: true }));
    await legende('Le référent est un encadrant attitré qui suit, en plus, les élèves du groupe.', 0);
    await rechercherEtChoisir('ajout-referent', 'Tia', 'Tiago');
    await legende('Les autres encadrants attitrés viennent en renfort, chaque lundi.', 0);
    await rechercherEtChoisir('ajout-encadrant', 'Flo', 'Flora');
    await pause(1500);
    await toucher(page.getByRole('button', { name: 'Enregistrer' }), { apres: 1800 });
    await legende('Le référent s\'affiche en tête, ici comme dans le planning des moniteurs.', 3500);

    await legende('Plus bas, les élèves de la saison : chacun dans un groupe au plus.', 0);
    await page.getByRole('heading', { name: 'Élèves de la saison' }).scrollIntoViewIfNeeded();
    await pause(2500);
    await vignette();
    await legende('Le rangement est suggéré d\'après le niveau préparé ; un adhérent sans formation se range à la main.', 4500);
    await defiler(500, 1500);
    await legende('Les lignes d\'eau et la fosse (capacité, profondeur) se règlent en bas de page.', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
