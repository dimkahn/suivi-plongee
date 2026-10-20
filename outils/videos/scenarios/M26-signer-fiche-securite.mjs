// M26 — Le directeur de plongée signe sa fiche de sécurité.
// Tournage du 2026-10-20, 1re série, signature électronique du DP, fiche verrouillée et contrôle d'intégrité (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'M26',
  titre: 'Signer la fiche de sécurité',
  public: 'Moniteur',
  resume: 'Après la plongée, le directeur de plongée signe sa fiche dans l\'appli : elle ne se modifie plus, et l\'appli vérifie que rien n\'a changé depuis.',
  compte: 'e3@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, saisir, menu, vignette, format } = g;
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await menu('Fiches de sécurité');
    await legende('Samedi, à la gravière : Gwendoline était directrice de plongée, la fiche est complète.', 0);
    await saisir('#filtre-lieu', 'Gravière');
    await pause(1200);
    const ligne = page.locator('li').filter({ hasText: '26/09/2026' }).first();
    await toucher(ligne.getByRole('link', { name: 'Modifier la fiche' }), { apres: 1800 });

    await legende('Seul le directeur de plongée de la fiche voit « Signer la fiche », une fois la plongée passée.', 0);
    if (format === 'telephone') {
      await toucher(page.getByRole('button', { name: 'Actions de la fiche' }), { apres: 900 });
      await toucher(page.locator('.menu-actions').getByRole('menuitem', { name: /Signer la fiche/ }), { apres: 1200 });
    } else {
      await toucher(page.locator('button.bouton-signer.action-ordinateur'), { apres: 1200 });
    }
    await legende('L\'appli prévient : signée, la fiche ne pourra plus être modifiée ni complétée, par personne.', 3500);
    await toucher(page.locator('dialog[open]').getByRole('button', { name: 'Je signe la fiche' }), { apres: 1800 });

    await page.locator('.signature').scrollIntoViewIfNeeded();
    await legende('En haut, qui a signé et quand. Les champs sont grisés : plus rien ne se modifie.', 4000);
    await vignette();
    await legende('À chaque ouverture, l\'appli vérifie que le contenu est bien celui qui a été signé ; sinon, une alerte rouge.', 5000);
    await legende('Sur la fiche imprimée, la case signature dit « signée électroniquement », avec la date.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
