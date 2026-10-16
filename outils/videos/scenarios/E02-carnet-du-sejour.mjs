// E2 — Compte élève : le carnet du séjour.
// Tournage du 2026-10-16, 18e série, ancien numéro du matériel (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'E2',
  titre: 'Le carnet du séjour',
  public: 'Élève',
  resume: 'La veille du départ, le rappel de son vol et de l\'heure à laquelle être à l\'aéroport ; pendant le séjour, le programme du jour et sa palanquée, avec la fonction de chacun. Puis la carte « Mon séjour », une case par sujet (vols, voiture, chambre, comptes, informations) qui ouvre son détail, le programme, les affaires à prévoir et ses frais, sur son téléphone ; elle y complète ses informations (dont le jour et l\'heure d\'arrivée de son vol retour) et déclare le gilet du club qu\'elle a emprunté.',
  compte: 'eleve@club.fr',

  async jouer({ page, pause, legende, toucher, menu, defiler, enHaut, vignette }) {
    // L'encart « Aujourd'hui » ne paraît qu'autour du séjour de démonstration (juin 2027) :
    // l'horloge de la page est avancée à la veille du départ, puis au premier jour de plongée.
    await page.clock.setFixedTime(new Date('2027-06-02T19:00:00'));
    await page.goto(`${APPLI}/cursus`);
    await pause(1500);
    await legende('Camille part en séjour avec le club. « Plus », puis « Séjours ».', 0);
    await menu('Séjours');
    await toucher(page.locator('main a').filter({ hasText: 'Séjour à Port-Cros' }).first(), { apres: 1500 });
    await legende('C\'est la veille du départ : en haut, le rappel de son vol, et l\'heure à laquelle être à l\'aéroport.', 4500);
    await legende('Deux heures avant pour un avion, trente minutes pour un train. Et les papiers à ne pas oublier.', 4500);
    await vignette();

    await page.clock.setFixedTime(new Date('2027-06-04T07:30:00'));
    await page.reload();
    await pause(1500);
    await legende('Pendant le séjour, l\'encart « Aujourd\'hui » donne le programme du jour : rendez-vous et plongées.', 4500);
    await legende('Sous la plongée, sa palanquée, lue sur la fiche de sécurité : l\'encadrante, les autres plongeurs, et le niveau de chacun.', 5000);
    await legende('Le jour du retour, il rappelle de même l\'heure du vol, et la veille ses comptes à régler.', 4000);

    await legende('« Mon séjour » : une case par sujet. Ses vols aller et retour, sa voiture, sa chambre, ses comptes, ses informations.', 5000);
    await legende('Toucher une case ouvre le détail : ici sa chambre, dans l\'onglet Hébergement.', 0);
    await toucher(page.locator('app-mon-sejour .tuile').filter({ hasText: 'Chambre' }), { apres: 3500 });
    await enHaut();
    await legende("« Modifier mes informations » : son vol aller, le jour et l'heure de son départ, le jour et l'heure d'arrivée du retour, ses repas, la personne à prévenir.", 0);
    await toucher(page.getByRole('button', { name: 'Modifier mes informations' }), { apres: 3500 });
    await toucher(page.getByRole('button', { name: 'Annuler' }), { apres: 800 });
    await legende('Puis le programme, jour par jour.', 0);
    await defiler(600, 2000);
    await legende('« Pratique » : ce qu\'il faut emporter, et les infos pratiques.', 0);
    await toucher(page.getByRole('tab', { name: 'Pratique' }), { apres: 3500 });
    await legende('Elle a emprunté un gilet du club : onglet « Matériel », « Déclarer un emprunt ».', 0);
    await toucher(page.getByRole('tab', { name: 'Matériel' }), { apres: 1500 });
    await toucher(page.getByRole('button', { name: 'Déclarer un emprunt' }), { apres: 1500 });
    await legende('Elle choisit « Gilets », ou tape la référence ou l\'ancien numéro de l\'étiquette, coche le sien, et enregistre. Le directeur technique le retrouve dans ses prêts.', 0);
    await toucher(page.getByRole('button', { name: 'Gilets' }), { apres: 1500 });
    await toucher(page.locator('.choix input[type=checkbox]').first(), { apres: 1500 });
    await toucher(page.getByRole('button', { name: 'Enregistrer' }), { apres: 3000 });
    await legende('Un détendeur, lui, se déclare par un moniteur du séjour : il atteste sa désinfection.', 4000);
    await enHaut();
    await legende('Les frais sont en haut de la page : « Voir les frais ». Ce qu\'elle doit et à qui, puis les dépenses.', 0);
    await toucher(page.getByRole('button', { name: 'Voir les frais' }), { apres: 3500 });
    await legende('Elle a payé quelque chose ? Elle donne la note à un moniteur du séjour, qui la saisit pour elle.', 4000);
    await legende('En haut de la page, « Version imprimable » : le carnet mis en page pour le papier, à garder sans réseau.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
