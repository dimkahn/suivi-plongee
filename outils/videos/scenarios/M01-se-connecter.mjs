// M1 — Se connecter et s'y retrouver.
// Tournage du 2026-10-11, 2e série (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'M1',
  titre: 'Se connecter et s\'y retrouver',
  public: 'Moniteur',
  resume: 'Se connecter depuis son téléphone, trouver les écrans dans le menu, récupérer un mot de passe oublié.',
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

    await legende('Vous arrivez sur « Aujourd\'hui » : la séance du jour, où va votre groupe, l\'appel. Voir la vidéo M23.', 4000);

    await legende('En bas de l\'écran, à portée du pouce : Aujourd\'hui, Présences, Élèves et Planning.', 3500);
    await legende('Tout le reste est derrière « Plus ».', 0);
    const plus = page.locator('nav.onglets').getByRole('button', { name: 'Plus' });
    await toucher(plus, { apres: 800 });
    await legende('Trombinoscope, fiches de sécurité, groupes…', 3500);
    await legende('« Préparer hors ligne » avant d\'aller au bassin, s\'il n\'y a pas de réseau.', 3500);
    await legende('« Aide » : les questions fréquentes et les vidéos. Votre nom : votre compte (photo, e-mail, mot de passe).', 4000);
    await toucher(plus, { apres: 600 });

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
