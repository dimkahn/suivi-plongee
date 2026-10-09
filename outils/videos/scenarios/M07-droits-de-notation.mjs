// M7 — Ce qu'on a le droit de noter.
// Tournage du 2026-10-09, 2e série (changer cette date dans tous les scénarios les fait tous retourner).
import { ouvrirGrille } from '../grille.mjs';

export default {
  id: 'M7',
  titre: 'Ce qu\'on a le droit de noter',
  public: 'Moniteur',
  resume: 'Chaque encadrant note les niveaux de son encadrement : un E1 consulte une grille N2 sans pouvoir y toucher.',
  compte: 'e1@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, defiler, vignette } = g;
    await legende('Tiago est E1 : il encadre et note le N1.', 3000);
    await legende('Il ouvre la grille de Camille, qui prépare le N2.', 0);
    await ouvrirGrille(g, 'Camille Berthier');
    await page.locator('.alerte').first().scrollIntoViewIfNeeded();
    await legende('Un bandeau l\'explique : le N2 se note à partir de E2.', 3500);
    await vignette();
    await toucher(page.getByRole('button', { name: 'Tout ouvrir' }), { apres: 900 });
    await defiler(600, 1500);
    await legende('La grille reste consultable, mais les boutons sont grisés.', 3500);
    await legende('Même règle au serveur : impossible de contourner l\'écran.', 3500);

    await legende('Sur le N1 d\'Anis, en revanche, Tiago note normalement.', 0);
    await ouvrirGrille(g, 'Anis Dulac');
    await pause(1500);
    await legende('E1 → N1 · E2 → jusqu\'au N2 · E3 et plus → jusqu\'au N3.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
