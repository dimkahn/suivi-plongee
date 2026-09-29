// A3 — Générer les séances de l'année.
import { APPLI } from '../commun.mjs';

export default {
  id: 'A3',
  titre: 'Générer les séances de l\'année',
  public: 'Administrateur',
  resume: 'Toute l\'année en une fois : jours de la semaine, vacances scolaires et jours fériés retirés d\'office.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, saisir, choisir, cocher, administration, defiler, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await administration('Séances');
    await legende('Plutôt que créer chaque lundi à la main : « Générer toutes les séances d\'une saison ».', 0);
    await toucher(page.getByText('Générer toutes les séances d\'une saison').first(), { apres: 1500 });
    const saison = page.locator('main select').first();
    const cible = (await saison.locator('option').allTextContents()).find(o => o.startsWith('2027-2028'))
      ? '2027-2028' : '2026-2027';
    await choisir(saison, cible, { exact: false });
    await legende('Les vacances de la zone viennent du calendrier officiel de l\'Éducation nationale.', 0);
    await choisir(page.locator('main select').nth(1), 'Zone C', { exact: false });
    await page.getByRole('button', { name: 'Lundi', exact: true }).scrollIntoViewIfNeeded();
    await legende('Les jours de la semaine : le lundi est coché d\'office ; un toucher ajoute ou retire un jour.', 4000);
    await legende('Puis la séance elle-même.', 0);
    await saisir(page.getByLabel('Lieu', { exact: true }), 'Piscine');
    await saisir(page.getByLabel('Profondeur max (m)'), '2');
    await toucher(page.getByRole('button', { name: 'Prévisualiser' }), { apres: 3000 });
    await legende('L\'aperçu, mois par mois : ce qui sera créé, ce qui est retiré et pourquoi.', 0);
    await vignette();
    await defiler(700, 2500);
    await pause(2500);
    await legende('Deux séances le même soir (piscine et fosse) ? Générez deux fois.', 3500);
    await legende('Un bouton « Créer les … séances » valide le tout. Ici, on s\'arrête à l\'aperçu.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
