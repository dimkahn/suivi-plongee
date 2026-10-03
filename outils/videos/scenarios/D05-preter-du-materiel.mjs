// D5 — Prêter du matériel.
// Tournage du 2026-10-03 (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'D5',
  titre: 'Prêter du matériel',
  public: 'Directeur technique',
  resume: 'Un prêt en quelques touchers, avec la désinfection du détendeur confirmée à chaque changement d\'utilisateur.',
  compte: 'e3@club.fr',

  async jouer({ page, pause, legende, toucher, saisir, dater, cocher, rechercherEtChoisir, vignette }) {
    await page.goto(`${APPLI}/materiel/prets`);
    await pause(1200);
    await legende('Les prêts en cours et rendus. « Nouveau prêt » :', 0);
    await toucher(page.getByRole('button', { name: 'Nouveau prêt' }), { apres: 900 });
    await rechercherEtChoisir('emprunteur', 'Léa', 'Léa Morel');
    await saisir('#motif', 'Fosse de Villeneuve');
    const aujourdhui = new Date();
    const dans = n => new Date(aujourdhui.getTime() + n * 864e5).toISOString().slice(0, 10);
    await dater('#retourPrevu', dans(5));
    await legende('On choisit le matériel dans l\'inventaire.', 0);
    await toucher(page.locator('form, main').getByRole('button', { name: 'Détendeurs' }).first(), { apres: 800 });
    await cocher(page.locator('label.case').filter({ hasText: 'D-02' }).locator('input'));
    await toucher(page.locator('form, main').getByRole('button', { name: 'Combinaisons' }).first(), { apres: 800 });
    await cocher(page.locator('label.case').filter({ hasText: 'C-02' }).locator('input'));
    await legende('Un détendeur change d\'utilisateur : sa désinfection est obligatoire (Code du sport).', 0);
    await cocher(page.locator('input[name="desinfectes"]'));
    await vignette();
    await toucher(page.getByRole('button', { name: 'Enregistrer le prêt' }), { apres: 2000 });
    await legende('La désinfection est inscrite au journal du détendeur, à la date du prêt.', 4000);
    await legende('Un matériel en retard de révision reste prêtable, avec un avertissement ; un bloc hors échéance, non.', 5000);
    await legende(null, 0);
    await pause(500);
  }
};
