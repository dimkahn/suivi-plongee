// M1 — Se connecter et s'y retrouver.
// Tournage du 2026-10-14, 12e série (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'M1',
  titre: 'Se connecter et s\'y retrouver',
  public: 'Moniteur',
  resume: 'Se connecter depuis son téléphone ou son ordinateur, trouver les écrans dans le menu, récupérer un mot de passe oublié.',
  compte: 'e2@club.fr',
  connecte: false,

  async jouer({ page, pause, legende, toucher, saisir, format, selon }) {
    await page.goto(`${APPLI}/connexion`);
    await pause(800);
    await legende(selon({
      telephone: 'Sur votre téléphone, ouvrez l\'adresse de l\'appli du club.',
      ordinateur: 'Sur votre ordinateur, ouvrez l\'adresse de l\'appli du club. Au bord du bassin, ce sera le téléphone.'
    }), 3000);

    await legende('Votre adresse e-mail…', 0);
    await saisir('#email', 'e2@club.fr');
    await legende('… et votre mot de passe.', 0);
    await saisir('#mdp', 'plongee2026');
    await legende(selon({ telephone: '« Se souvenir de moi » : restez connecté sur votre téléphone. ',
                          ordinateur: '« Se souvenir de moi » : restez connecté sur cet ordinateur. ' })
      + 'Décochez sur un appareil partagé.', 4000);
    await toucher(page.getByRole('button', { name: 'Se connecter' }), { apres: 1500 });

    await legende('Vous arrivez sur « Aujourd\'hui » : la séance du jour, où va votre groupe, l\'appel. Voir la vidéo M23.', 4000);

    if (format === 'telephone') {
      await legende('En bas de l\'écran, à portée du pouce : Aujourd\'hui, Présences, Élèves et Planning.', 3500);
      await legende('Tout le reste est derrière « Plus ».', 0);
      const plus = page.locator('nav.onglets').getByRole('button', { name: 'Plus' });
      await toucher(plus, { apres: 800 });
      await legende('Trombinoscope, fiches de sécurité, séjours…', 3500);
    } else {
      await legende('Tous les écrans sont dans le menu, en haut : Aujourd\'hui, Infos élèves, Planning, Présences…', 3500);
      await legende('Trombinoscope, fiches de sécurité, séjours…', 3500);
    }
    await legende('« Préparer hors ligne » avant d\'aller au bassin, s\'il n\'y a pas de réseau.', 3500);
    await legende('« Aide » : les questions fréquentes et les vidéos. '
      + 'Votre nom : votre compte (photo, e-mail, mot de passe), et « Se déconnecter ».', 4500);
    if (format === 'telephone') {
      await toucher(page.locator('nav.onglets').getByRole('button', { name: 'Plus' }), { apres: 600 });
    }

    await legende('Sur chaque écran, « Comment faire ? », en haut à droite, ouvre les manuels et vidéos de cet écran.', 0);
    await toucher(page.getByRole('button', { name: 'Comment faire ?' }), { apres: 1500 });
    await legende('Votre saisie reste en place derrière la fenêtre : « Revenir à l\'écran » la retrouve.', 3500);
    await toucher(page.getByRole('dialog').getByRole('button', { name: 'Revenir à l\'écran' }), { apres: 800 });
    await legende('En haut à gauche des autres écrans, « ← … » remonte d\'un cran, toujours au même endroit.', 4000);

    await legende(selon({
      telephone: 'Astuce : ajoutez l\'appli à l\'écran d\'accueil du téléphone, elle s\'ouvrira comme une application.',
      ordinateur: 'Astuce : sur le téléphone, ajoutez l\'appli à l\'écran d\'accueil, elle s\'ouvrira comme une application.'
    }), 4000);

    await legende('Mot de passe oublié ? Déconnectons-nous pour voir : votre nom, puis « Se déconnecter » tout en bas.', 0);
    const plusFin = page.locator('nav.onglets').getByRole('button', { name: 'Plus' });
    if (await plusFin.isVisible()) await toucher(plusFin, { apres: 700 });
    await toucher(page.locator('#menu-principal a.qui'), { apres: 1200 });
    await toucher(page.locator('main').getByRole('button', { name: 'Se déconnecter' }), { apres: 1200 });
    await toucher(page.getByRole('button', { name: 'Mot de passe oublié ?' }));
    await saisir('#email-oubli', 'e2@club.fr');
    await toucher(page.getByRole('button', { name: 'Envoyer le lien' }), { apres: 1200 });
    await legende('Un lien de réinitialisation part par e-mail. Il suffit de le suivre.', 4000);
    await legende(null, 0);
    await pause(600);
  }
};
