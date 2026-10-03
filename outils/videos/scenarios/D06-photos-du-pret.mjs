// D6 — Photos avant et après le prêt.
// Tournage du 2026-10-03 (changer cette date dans tous les scénarios les fait tous retourner).
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APPLI } from '../commun.mjs';
import { dessinerMateriel } from '../portraits.mjs';

export default {
  id: 'D6',
  titre: 'Photos avant et après le prêt',
  public: 'Directeur technique',
  resume: 'Photographier l\'état du matériel à la remise et au retour : ces photos font foi.',
  compte: 'e3@club.fr',

  async jouer({ page, pause, legende, toucher, saisir, choisir, vignette }) {
    const dossier = await mkdtemp(join(tmpdir(), 'materiel-'));
    const fichiers = [];
    for (const [k, image] of (await dessinerMateriel()).entries()) {
      const f = join(dossier, `photo-${k + 1}.jpg`);
      await writeFile(f, image);
      fichiers.push(f);
    }

    await page.goto(`${APPLI}/materiel/prets`);
    await pause(1200);
    await legende('À la remise du matériel, on le photographie : rayures, accrocs, état général.', 0);
    const bouton = page.getByRole('button', { name: /^Photos/ }).first();
    const carte = page.locator('li, .carte').filter({ has: bouton }).first();
    await toucher(bouton, { apres: 1200 });
    await legende('On photographie le matériel, jamais les personnes.', 3500);
    const equipement = carte.locator('select').first();
    await toucher(equipement, { apres: 200 });
    await equipement.selectOption({ index: 1 });
    await pause(600);
    await saisir(carte.locator('input[id$="legende"]').first(), 'Rayure déjà présente');
    const [choix] = await Promise.all([
      page.waitForEvent('filechooser'),
      toucher(carte.getByText('Prendre ou choisir des photos').first(), { apres: 300 })
    ]);
    await choix.setFiles(fichiers);
    await pause(3000);
    await vignette();
    await legende('Le téléphone réduit les photos avant l\'envoi : pas besoin de bon réseau.', 4000);
    await legende('Tant que le prêt est en cours, on peut retirer une photo ratée. Ensuite, elles font foi.', 4500);
    await legende('Au retour, même geste dans la rubrique « au retour ».', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
