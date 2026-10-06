// A2 — Ouvrir une nouvelle saison.
// Tournage du 2026-10-06 (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'A2',
  titre: 'Ouvrir une nouvelle saison',
  public: 'Administrateur',
  resume: 'Créer la saison, ajuster ses dates, choisir les progressions types qu\'elle suit.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, saisir, dater, choisir, administration, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await legende('Administration, « Saisons ».', 0);
    await administration('Saisons');
    await legende('La saison en cours est ouverte ; les précédentes restent consultables, fermées.', 3500);
    await toucher(page.getByRole('button', { name: 'Nouvelle saison' }));
    await saisir('#libelle', '2027-2028');
    await dater('#debut', '2027-09-01');
    await dater('#fin', '2028-06-30');
    await toucher(page.getByRole('button', { name: 'Créer la saison' }), { apres: 1500 });

    const carte = page.locator('main section, main li, main .carte').filter({ hasText: '2027-2028' }).last();
    await carte.scrollIntoViewIfNeeded();
    await legende('Chaque saison suit une progression type par niveau.', 0);
    await toucher(carte.getByRole('button', { name: 'Choisir les progressions' }), { apres: 900 });
    const dialogue = page.locator('dialog[open]');
    for (const select of await dialogue.locator('select').all()) {
      await choisir(select, 'N', { exact: false });
    }
    await vignette();
    await toucher(dialogue.getByRole('button', { name: 'Enregistrer' }), { apres: 1500 });
    await legende('Une nouvelle saison est créée ouverte : elle devient la saison courante de toute l\'appli.', 4500);
    await legende('Préparée en avance ? Refermez-la jusqu\'à la rentrée ; « Rouvrir » le jour venu.', 0);
    await toucher(carte.getByRole('button', { name: 'Fermer' }), { apres: 1500 });
    await legende('À la rentrée : ouvrir la nouvelle saison, fermer l\'ancienne. Rien n\'est rétroactif.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
