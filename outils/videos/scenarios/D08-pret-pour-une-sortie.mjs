// D8 — Prêter pour une sortie.
import { APPLI } from '../commun.mjs';

export default {
  id: 'D8',
  titre: 'Prêter pour une sortie',
  public: 'Directeur technique',
  resume: 'Rattacher les prêts à une sortie : retour prévu au dernier jour, et les échéances vérifiées jusque-là.',
  compte: 'e3@club.fr',

  async jouer({ page, pause, legende, toucher, saisir, dater, choisir, cocher, rechercherEtChoisir, vignette }) {
    await page.goto(`${APPLI}/materiel`);
    await pause(1200);
    await legende('Le directeur technique gère aussi les sorties : « Sorties ».', 0);
    await toucher(page.getByRole('link', { name: 'Sorties' }), { apres: 1500 });
    await toucher(page.getByRole('button', { name: 'Nouvelle sortie' }), { apres: 800 });
    await saisir('#nom', 'Week-end de la Toussaint');
    await saisir('#lieu', 'Gravière du Fort');
    await dater('#debut', '2026-10-24');
    await dater('#fin', '2026-10-25');
    await toucher(page.getByRole('button', { name: 'Créer puis choisir les plongées' }), { apres: 1500 });
    await toucher(page.getByRole('button', { name: 'Fermer' }).first(), { apres: 800 });

    await page.goto(`${APPLI}/materiel/prets`);
    await pause(1200);
    await toucher(page.getByRole('button', { name: 'Nouveau prêt' }), { apres: 900 });
    await rechercherEtChoisir('emprunteur', 'Yanis', 'Yanis Roux');
    await legende('On choisit la sortie : le retour prévu se cale sur son dernier jour.', 0);
    await choisir('#sortie', 'Week-end de la Toussaint', { exact: false });
    await pause(1200);
    await legende('Le bloc B-02 : son inspection TIV tombe avant le 25 octobre…', 0);
    await toucher(page.locator('form, main').getByRole('button', { name: 'Blocs' }).first(), { apres: 800 });
    await cocher(page.locator('label.case').filter({ hasText: 'B-02' }).locator('input'));
    await toucher(page.getByRole('button', { name: 'Enregistrer le prêt' }), { apres: 1200 });
    await page.locator('main .alerte').first().scrollIntoViewIfNeeded();
    await pause(800);
    await vignette();
    await legende('… l\'appli refuse, et dit pourquoi : l\'échéance doit couvrir tout le prêt.', 5000);
    await legende('On le remplace par un bloc à jour.', 0);
    await cocher(page.locator('label.case').filter({ hasText: 'B-02' }).locator('input'), false);
    await cocher(page.locator('label.case').filter({ hasText: 'B-04' }).locator('input'));
    await toucher(page.getByRole('button', { name: 'Enregistrer le prêt' }), { apres: 2000 });
    await legende('Prêt enregistré, rattaché à la sortie.', 3000);
    await legende(null, 0);
    await pause(500);
  }
};
