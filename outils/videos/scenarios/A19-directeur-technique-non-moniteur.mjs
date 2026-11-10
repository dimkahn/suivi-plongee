// A19 — Directeur technique qui n'est pas moniteur : un compte limité au matériel, aux prêts et aux sorties.
// Tournage du 2026-11-10, 1re série (changer cette date dans tous les scénarios les fait tous retourner).
// Démo V136 : Bastien Morvan (materiel@club.fr), directeur technique non moniteur.
import { APPLI } from '../commun.mjs';

export default {
  id: 'A19',
  titre: 'Directeur technique qui n\'est pas moniteur',
  public: 'Administrateur',
  resume: 'Un compte pour une personne qui gère le matériel sans être moniteur : matériel, prêts et sorties, rien d\'autre ; désactivation et lien de mot de passe.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, saisir, administration, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await legende('Administration, rubrique « Personnes » : « Directeurs techniques non moniteurs ».', 0);
    await administration('Directeurs techniques non moniteurs');
    await legende('Pour une personne qui gère le matériel du club sans être moniteur.', 3500);
    await legende('Elle ne fait que le matériel, les prêts et les sorties : ni élèves, ni notation, ni planning, ni séjours.', 4500);
    await toucher(page.getByRole('button', { name: 'Nouveau directeur technique' }));
    await saisir('#dt-prenom', 'Inès');
    await saisir('#dt-nom', 'Garnier');
    await saisir('#dt-email', 'ines.garnier@club.fr');
    await vignette();
    await toucher(page.getByRole('button', { name: 'Créer le compte' }), { apres: 2000 });
    await legende('Inès reçoit un e-mail pour choisir son mot de passe.', 3500);
    await legende('« Désactiver » met fin à son accès. Pas de suppression : ses écritures au journal du matériel et aux prêts font foi.', 5000);
    await legende('Un directeur technique qui est aussi moniteur se gère dans « Moniteurs ».', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
