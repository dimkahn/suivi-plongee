// D9 — Mise au rebut.
// Tournage du 2026-10-03 (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'D9',
  titre: 'Mise au rebut',
  public: 'Directeur technique',
  resume: 'Retirer définitivement un équipement, en gardant sa fiche trois ans comme l\'exige le Code du sport.',
  compte: 'e3@club.fr',

  async jouer({ page, pause, legende, toucher, saisir, dater, cocher, vignette }) {
    await page.goto(`${APPLI}/materiel`);
    await pause(1200);
    await legende('Le gilet G-02 est hors service ; la pièce n\'existe plus.', 0);
    await toucher(page.getByText('Gilet stabilisateur G-02').first(), { apres: 1800 });
    await page.getByRole('heading', { name: 'Mise au rebut' }).scrollIntoViewIfNeeded();
    await legende('En bas de sa fiche : « Mise au rebut », avec la date et le motif.', 0);
    await dater('#dateRebut', new Date().toISOString().slice(0, 10));
    await saisir('#motifRebut', 'Inflateur irréparable, pièce plus fabriquée.');
    await toucher(page.getByRole('button', { name: 'Mettre au rebut' }), { apres: 2000 });
    await vignette();
    await legende('Il disparaît de l\'inventaire et des prêts, mais sa fiche est gardée trois ans.', 4000);
    await toucher(page.getByRole('link', { name: '← Matériel' }), { apres: 1500 });
    await cocher(page.getByLabel('Afficher le matériel au rebut'));
    await pause(2000);
    await legende('Une erreur ? « Annuler la mise au rebut » depuis sa fiche.', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
