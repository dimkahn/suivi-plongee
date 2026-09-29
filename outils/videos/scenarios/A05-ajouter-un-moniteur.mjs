// A5 — Ajouter un moniteur.
import { APPLI } from '../commun.mjs';

export default {
  id: 'A5',
  titre: 'Ajouter un moniteur',
  public: 'Administrateur',
  resume: 'Créer le compte d\'un encadrant : niveau d\'encadrement, niveau de plongeur, rôles, CACI.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, saisir, dater, choisir, cocher, administration, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await administration('Moniteurs');
    await legende('La liste des encadrants, avec l\'état de leur CACI.', 3000);
    await toucher(page.getByRole('button', { name: 'Nouveau moniteur' }));
    await saisir('#prenom', 'Julien');
    await saisir('#nom', 'Robin');
    await saisir('#email', 'julien.robin@club.fr');
    await legende('Niveau d\'encadrement et niveau de plongeur sont distincts : un E1 peut n\'être que N2.', 0);
    await choisir('#niveau', 'E2', { exact: false });
    await choisir('#niveau-plongeur', 'N4', { exact: false });
    await dater('#caci', '2027-08-31');
    await legende('Deux rôles en plus, à cocher si besoin : administrateur, directeur technique (matériel).', 4000);
    await vignette();
    await toucher(page.getByRole('button', { name: 'Ajouter le moniteur' }), { apres: 2000 });
    await legende('Julien reçoit un e-mail pour choisir son mot de passe.', 3500);
    await legende('Ici aussi : désactiver un compte, renvoyer un lien, recueillir le droit à l\'image.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
