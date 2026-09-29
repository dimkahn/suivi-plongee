// A8 — Garder un élève breveté sans formation.
import { APPLI } from '../commun.mjs';

export default {
  id: 'A8',
  titre: 'Garder un plongeur breveté sans formation',
  public: 'Administrateur',
  resume: 'Un plongeur déjà breveté qui s\'entraîne avec le club sans viser de niveau : le maintien.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, saisir, choisir, dater, cocher, administration, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await administration('Élèves');
    await legende('Inès arrive d\'un autre club, déjà N2. Elle veut s\'entraîner, pas passer de niveau.', 0);
    await toucher(page.getByRole('button', { name: 'Nouvel élève' }));
    await saisir('#prenom', 'Inès');
    await saisir('#nom', 'Faure');
    await dater('#naissance', '1996-07-08');
    await dater('#caci', '2027-06-30');
    await saisir('#niveau', 'N2');
    await cocher(page.locator('input[name="autorisationLegale"]').first());
    await legende('Pour cette saison : « Aucune formation — maintien », dans le groupe N2+.', 0);
    await choisir('#saisonCreation', '2026-2027', { exact: false });
    await choisir('#formationCreation', 'Aucune formation', { exact: false });
    await choisir('#groupeCreation', 'N2+', { exact: false });
    await vignette();
    await toucher(page.getByRole('button', { name: 'Ajouter l\'élève' }), { apres: 2000 });
    await legende('Dans « Inscriptions », les maintiens ont leur propre liste.', 0);
    await administration('Inscriptions');
    await page.getByRole('heading', { name: 'Maintien, sans formation' }).scrollIntoViewIfNeeded();
    await pause(3500);
    await legende('Pas de grille ni de présences pour elles : seulement l\'appartenance au club et au groupe.', 4500);
    await legende(null, 0);
    await pause(500);
  }
};
