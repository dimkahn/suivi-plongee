// M26 — Le directeur de plongée signe sa fiche de sécurité.
// Tournage du 2026-10-24, 2e série, page de signature au format de la fiche imprimée, étiquette « Signée » dans la liste, dépassements en rouge (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'M26',
  titre: 'Signer la fiche de sécurité',
  public: 'Moniteur',
  resume: 'Après la plongée, le directeur de plongée relit sa fiche telle qu\'elle s\'imprime et la signe dans l\'appli : elle ne se modifie plus, elle s\'imprime, et l\'appli vérifie que rien n\'a changé depuis.',
  compte: 'e3@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, saisir, menu, vignette } = g;
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await menu('Fiches de sécurité');
    await legende('Samedi, à la gravière : Gwendoline était directrice de plongée, la fiche est complète.', 0);
    await saisir('#filtre-lieu', 'Gravière');
    await pause(1200);
    const ligne = () => page.locator('li').filter({ hasText: '26/09/2026' }).first();
    await legende('Seul le directeur de plongée de la fiche voit « Signer la fiche », une fois la plongée passée.', 0);
    await toucher(ligne().getByRole('link', { name: /Signer la fiche/ }), { apres: 1800 });

    await page.locator('.feuille img').waitFor();
    await legende('La page montre la fiche telle qu\'elle s\'imprime. Une profondeur ou une durée au-delà du prévu y est en rouge.', 4500);
    await toucher(page.locator('.actions-bas button.bouton-signer'), { apres: 1200 });
    await legende('L\'appli prévient : signée, la fiche ne pourra plus être modifiée ni complétée, par personne.', 3500);
    await toucher(page.locator('dialog[open]').getByRole('button', { name: 'Je signe la fiche' }), { apres: 1800 });

    await page.locator('.signature').scrollIntoViewIfNeeded();
    await legende('En haut, qui a signé et quand ; sur la feuille, la case signature dit « signée électroniquement ».', 4000);
    await vignette();
    await legende('À chaque ouverture, l\'appli vérifie que le contenu est bien celui qui a été signé ; sinon, une alerte rouge.', 5000);

    await menu('Fiches de sécurité');
    await saisir('#filtre-lieu', 'Gravière');
    await pause(1200);
    await ligne().locator('.etiquette.signee').scrollIntoViewIfNeeded();
    await legende('Dans la liste, l\'étiquette « Signée » : la fiche ne se modifie plus, elle se relit et s\'imprime.', 4500);
    await legende(null, 0);
    await pause(500);
  }
};
