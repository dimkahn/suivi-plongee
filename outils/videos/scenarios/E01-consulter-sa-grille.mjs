// E1 — Compte élève : consulter sa propre grille.
// Tournage du 2026-10-09, 2e série (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'E1',
  titre: 'Consulter sa progression',
  public: 'Élève',
  resume: 'L\'élève suit sa propre grille de compétences depuis son téléphone, sans rien pouvoir saisir.',
  compte: 'eleve@club.fr',

  async jouer({ page, pause, legende, toucher, defiler, vignette }) {
    await page.goto(`${APPLI}/cursus`);
    await pause(1500);
    await legende('Camille est élève : son compte ne voit que sa propre formation.', 0);
    await pause(2000);
    await toucher(page.locator('main').getByText('Camille Berthier').first(), { apres: 1800 });
    await legende('Sa grille N2 : ce qui est acquis, ce qui reste à travailler, ce qui est au programme.', 4000);
    await vignette();
    await toucher(page.getByRole('button', { name: 'Tout ouvrir' }), { apres: 900 });
    await defiler(700, 1800);
    await legende('Les notes et commentaires des moniteurs, en lecture seule.', 3500);
    await legende('Le bouton « Exporter en PDF » lui donne aussi sa fiche de suivi.', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
