// D8 — Prêter pour une sortie.
// Tournage du 2026-10-19, 13e série, sortie datée d'après le jour du tournage (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

// L'inspection TIV du bloc B-02 de démonstration tombe 15 jours après le
// démarrage du backend : la sortie, 20 jours après le tournage, la dépasse.
const jour = decalage => {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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
    await dater('#debut', jour(20));
    await dater('#fin', jour(21));
    await toucher(page.getByRole('button', { name: 'Créer puis choisir les plongées' }), { apres: 1500 });
    await toucher(page.locator('dialog[open]').getByRole('button', { name: 'Annuler' }), { apres: 800 });

    await page.goto(`${APPLI}/materiel/prets`);
    await pause(1200);
    await toucher(page.getByRole('button', { name: 'Nouveau prêt' }), { apres: 900 });
    await rechercherEtChoisir('emprunteur', 'Yanis', 'Yanis Roux');
    await legende('On choisit la sortie : le retour prévu se cale sur son dernier jour.', 0);
    await choisir('#sortie', 'Week-end de la Toussaint', { exact: false });
    await pause(1200);
    await legende('Le bloc B-02 : son inspection TIV tombe avant la fin de la sortie…', 0);
    await toucher(page.locator('form, main').getByRole('button', { name: 'Blocs' }).first(), { apres: 800 });
    await cocher(page.locator('label.case').filter({ hasText: 'B-02' }).locator('input'));
    await toucher(page.getByRole('button', { name: 'Enregistrer le prêt' }), { apres: 1200 });
    await page.locator('dialog[open] .alerte').first().scrollIntoViewIfNeeded();
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
