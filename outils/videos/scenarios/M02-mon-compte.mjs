// M2 — Mon compte : photo, e-mail, mot de passe.
// Tournage du 2026-10-09, 2e série (changer cette date dans tous les scénarios les fait tous retourner).
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dessinerPortraits } from '../portraits.mjs';

export default {
  id: 'M2',
  titre: 'Mon compte',
  public: 'Moniteur',
  resume: 'Déposer sa photo, retrouver son niveau et son CACI, changer son e-mail ou son mot de passe.',
  compte: 'e2@club.fr',

  async jouer({ page, pause, legende, toucher, defiler, enHaut, menu }) {
    // Portrait dessiné de Flora, préparé avant le tournage.
    const [png] = await dessinerPortraits([[9, 'longue']]);
    const fichier = join(await mkdtemp(join(tmpdir(), 'portrait-')), 'ma-photo.png');
    await writeFile(fichier, png);

    await page.goto(`${process.env.APPLI ?? 'http://localhost:4200'}/eleves`);
    await pause(1200);
    await legende('Votre compte : touchez votre nom dans le menu.', 0);
    await toucher(page.getByRole('button', { name: 'Menu' }), { apres: 700 });
    await toucher(page.locator('#menu-principal a.qui'), { apres: 1500 });

    await legende('En haut : votre niveau d\'encadrement et la date de votre CACI.', 3500);
    await legende('Ils sont saisis par un administrateur : c\'est à lui qu\'on remet un nouveau certificat.', 4000);

    await legende('Votre photo apparaît dans le trombinoscope des moniteurs.', 3000);
    await legende('La déposer vaut accord pour cet affichage ; vous pouvez la retirer à tout moment.', 3500);
    const [choix] = await Promise.all([
      page.waitForEvent('filechooser'),
      toucher(page.getByText('Déposer ma photo'), { apres: 300 })
    ]);
    await choix.setFiles(fichier);
    await pause(1200);
    await legende('Recadrez si besoin, puis validez.', 2500);
    await toucher(page.getByRole('button', { name: 'Valider' }), { apres: 2000 });
    await legende('C\'est fait.', 2000);

    await legende('Plus bas : votre numéro de licence…', 0);
    await defiler(420);
    await pause(1500);
    await legende('… l\'e-mail qui sert à vous connecter…', 0);
    await defiler(420);
    await pause(2000);
    await legende('… et votre mot de passe : 10 caractères au moins. '
      + 'Vos autres appareils seront déconnectés.', 0);
    await defiler(500);
    await pause(4000);
    await legende('Votre nom est sur les fiches de sécurité et l\'historique des notes : '
      + 'pour le corriger, voyez un administrateur.', 4500);
    await enHaut();
    await legende(null, 0);
    await pause(500);
  }
};
