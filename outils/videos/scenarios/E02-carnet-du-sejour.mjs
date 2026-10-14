// E2 — Compte élève : le carnet du séjour.
// Tournage du 2026-10-14, 13e série (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'E2',
  titre: 'Le carnet du séjour',
  public: 'Élève',
  resume: 'La veille du départ, le rappel de son vol et de l\'heure à laquelle être à l\'aéroport ; pendant le séjour, le programme du jour. Puis son vol, sa voiture, sa chambre, le programme, les affaires à prévoir et ses frais, sur son téléphone ; elle y complète ses informations.',
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
    await legende('Le jour du retour, il rappelle de même l\'heure du vol, et la veille ses comptes à régler.', 4000);

    await legende('« Mon séjour » tient sur une ligne ; elle la touche pour le détail : vols, voiture, chambre.', 0);
    await toucher(page.locator('.mon-voyage summary'), { apres: 3500 });
    await legende('« Modifier mes informations » : son vol et son heure de départ, ses repas, la personne à prévenir.', 0);
    await toucher(page.getByRole('button', { name: 'Modifier mes informations' }), { apres: 3500 });
    await toucher(page.getByRole('button', { name: 'Annuler' }), { apres: 800 });
    await legende('Puis le programme, jour par jour.', 0);
    await defiler(600, 2000);
    await legende('« Pratique » : ce qu\'il faut emporter, et les infos pratiques.', 0);
    await toucher(page.getByRole('tab', { name: 'Pratique' }), { apres: 3500 });
    await enHaut();
    await legende('Les frais sont en haut de la page : « Voir les frais ». Ce qu\'elle doit et à qui, puis les dépenses.', 0);
    await toucher(page.getByRole('button', { name: 'Voir les frais' }), { apres: 3500 });
    await legende('Elle a payé quelque chose ? Elle donne la note à un moniteur du séjour, qui la saisit pour elle.', 4000);
    await legende('« Imprimer le carnet » : tout sur une page, à garder sans réseau.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
