// M1 — Se connecter et s'y retrouver.
import { APPLI } from '../commun.mjs';

export default {
  id: 'M1',
  titre: 'Se connecter et s\'y retrouver',
  compte: 'e2@club.fr',
  connecte: false,

  async jouer({ page, pause, legende, toucher, saisir, menu }) {
    await page.goto(`${APPLI}/connexion`);
    await pause(800);
    await legende('Sur votre téléphone, ouvrez l\'adresse de l\'appli du club.', 3000);

    await legende('Votre adresse e-mail…', 0);
    await saisir('#email', 'e2@club.fr');
    await legende('… et votre mot de passe.', 0);
    await saisir('#mdp', 'plongee2026');
    await legende('« Se souvenir de moi » : restez connecté sur votre téléphone. '
      + 'Décochez sur un appareil partagé.', 4000);
    await toucher(page.getByRole('button', { name: 'Se connecter' }), { apres: 1500 });

    await legende('Vous arrivez sur « Infos élèves » : les élèves de la saison en un coup d\'œil.', 3500);

    await legende('Tout le reste est dans le menu, en haut à droite.', 0);
    await toucher(page.getByRole('button', { name: 'Menu' }), { apres: 800 });
    await legende('Planning du bassin, présences, trombinoscope, fiches de sécurité…', 3500);
    await legende('« Préparer hors ligne » avant d\'aller au bassin, s\'il n\'y a pas de réseau.', 3500);
    await legende('Votre nom : votre compte (photo, e-mail, mot de passe).', 3000);
    await toucher(page.getByRole('button', { name: 'Menu' }), { apres: 600 });

    await legende('Astuce : ajoutez l\'appli à l\'écran d\'accueil du téléphone, '
      + 'elle s\'ouvrira comme une application.', 4000);

    await legende('Mot de passe oublié ? Déconnectons-nous pour voir.', 0);
    await menu('Se déconnecter');
    await toucher(page.getByRole('button', { name: 'Mot de passe oublié ?' }));
    await saisir('#email-oubli', 'e2@club.fr');
    await toucher(page.getByRole('button', { name: 'Envoyer le lien' }), { apres: 1200 });
    await legende('Un lien de réinitialisation part par e-mail. Il suffit de le suivre.', 4000);
    await legende(null, 0);
    await pause(600);
  }
};
