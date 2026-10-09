// M8 — Vue d'ensemble d'un élève : matrice et fiche PDF.
// Tournage du 2026-10-09, 2e série (changer cette date dans tous les scénarios les fait tous retourner).
import { ouvrirGrille } from '../grille.mjs';

export default {
  id: 'M8',
  titre: 'Vue d\'ensemble d\'un élève',
  public: 'Moniteur',
  resume: 'La vue globale, séance par séance comme l\'ancien tableur, et la fiche de suivi en PDF.',
  compte: 'e2@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, defiler, cocher, vignette } = g;
    await ouvrirGrille(g, 'Anis Dulac');
    await legende('Sous le nom de l\'élève : « Vue globale (toutes les séances) ».', 0);
    await toucher(page.getByRole('link', { name: 'Vue globale (toutes les séances)' }), { apres: 1800 });
    await legende('Une colonne par séance, une ligne par critère : comme l\'onglet de l\'élève dans l\'ancien tableur.', 4500);
    await vignette();
    const tableau = page.locator('table').first().locator('xpath=..');
    await tableau.evaluate(el => el.scrollBy({ left: 400, behavior: 'smooth' }));
    await pause(2000);
    await legende('Par défaut, seulement les séances où il a été noté.', 3000);
    await legende('Pour préparer la prochaine séance : seulement ce qui n\'est pas encore acquis.', 0);
    await cocher(page.getByLabel('Seulement les critères non acquis'));
    await pause(2500);
    await defiler(500, 1500);

    await legende('Retour à la grille, et « Exporter en PDF » : la fiche de suivi à imprimer ou envoyer.', 0);
    await page.goBack();
    await pause(1500);
    const bouton = page.getByRole('button', { name: 'Exporter en PDF' });
    await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
      toucher(bouton, { apres: 2500 })
    ]);
    await legende('Le PDF arrive dans les téléchargements du téléphone. Il demande le réseau.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
