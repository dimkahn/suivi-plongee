// A18 — Comptes de sécurité surface : séances confiées, fin d'accès, réactivation.
// Tournage du 2026-10-20, 1re série (changer cette date dans tous les scénarios les fait tous retourner).
// Démo V127 : Yann (surface@club.fr) a le séjour à Port-Cros ; l'accès de Maëlle (week-end de rentrée) est terminé.
import { APPLI } from '../commun.mjs';

export default {
  id: 'A18',
  titre: 'Comptes de sécurité surface',
  public: 'Administrateur',
  resume: 'Un compte pour une personne qui n\'est pas moniteur du club : les séances dont elle complétera la fiche (une sortie entière ou une à une), la date de fin d\'accès après laquelle il se désactive seul, et la réactivation pour d\'autres séances.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, saisir, choisir, administration, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await legende('Administration, rubrique « Personnes » : « Sécurité surface ».', 0);
    await administration('Sécurité surface');
    await legende('Pour une personne qui n\'est pas moniteur du club : elle ne fait que compléter les fiches au retour de plongée.', 4500);
    await legende('Chaque compte dit ses séances et sa date de fin d\'accès.', 3500);
    await toucher(page.getByRole('button', { name: 'Nouveau compte sécurité surface' }));
    await saisir('#surface-prenom', 'Inès');
    await saisir('#surface-nom', 'Garnier');
    await saisir('#surface-email', 'ines.garnier@club.fr');
    await legende('Les séances confiées : toutes les plongées d\'une sortie d\'un coup…', 0);
    await choisir('#surface-sortie', 'Séjour à Port-Cros', { exact: false });
    await pause(1500);
    await legende('… ou une à une, en cochant. Elle ne verra que ces fiches-là.', 3500);
    await legende('La date de fin d\'accès est proposée une semaine après la dernière plongée : le compte se désactive seul le lendemain.', 5000);
    await vignette();
    await toucher(page.getByRole('button', { name: 'Créer le compte' }), { apres: 2000 });
    await legende('Inès reçoit un e-mail pour choisir son mot de passe.', 3500);
    await legende('L\'accès de Maëlle est terminé : « Réactiver », pour d\'autres séances et une nouvelle date.', 0);
    await toucher(page.locator('li').filter({ hasText: 'Maëlle' }).getByRole('button', { name: 'Réactiver' }), { apres: 3500 });
    await toucher(page.getByRole('button', { name: 'Annuler' }), { apres: 800 });
    await legende('« Désactiver » met fin à un accès avant la date prévue.', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
