// A17 — Organiser un séjour : les six onglets (programme, participants et repas, transports, hébergement, frais, pratique).
// Tournage du 2026-10-15, 15e série, choix des destinataires des e-mails du séjour (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'A17',
  titre: 'Organiser un séjour',
  public: 'Administrateur',
  resume: 'L\'encart des frais en haut de la page, puis les six onglets du séjour : les participants (un plongeur inscrit avec son groupe y reste lié), demander à chacun ses informations (et lui ouvrir le carnet tenu à jour par le lien), puis les vols et les voitures, les chambres, les régimes, le programme, le partage des frais et les affaires, l\'envoi du carnet par e-mail aux seules personnes choisies ; pendant le séjour, l\'encart « Aujourd\'hui ».',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, saisir, dater, menu, defiler, enHaut, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await legende('Menu « Séjours » : chaque sortie a son séjour.', 0);
    await menu('Séjours');
    await toucher(page.locator('main a').filter({ hasText: 'Séjour à Port-Cros' }).first(), { apres: 1500 });
    await legende('Tout en haut, l\'encart « Frais du séjour » : le total dépensé, et « Gérer les frais » pour les ouvrir.', 4500);
    await legende('Puis six onglets, « Frais » en premier. Un rond orange signale ce qui reste à régler : ici, dans « Hébergement ».', 4500);

    await legende('« Participants » : une ligne par personne, avec ce qu\'elle n\'a pas encore donné.', 0);
    await toucher(page.getByRole('tab', { name: 'Participants' }), { apres: 2500 });
    await legende('On touche un nom pour voir sa fiche : vol, repas, personne à prévenir.', 0);
    await toucher(page.locator('.liste-participants summary').first(), { apres: 3000 });
    await legende('Un plongeur inscrit avec son groupe de plongeurs y reste lié : nom, prénom et e-mail suivent d\'un côté à l\'autre.', 4500);
    await legende('Pas besoin de tout saisir : « Demander à chacun ses informations » leur envoie un e-mail.', 4500);
    await legende('Les moniteurs complètent dans l\'appli ; les autres par un lien et un code, sans mot de passe.', 4500);
    await legende('Par ce lien, ils lisent aussi le carnet du séjour, toujours à jour : programme, voitures, chambres, affaires.', 4500);
    await legende('En bas, les repas : le nombre de couverts et les régimes, pour la cuisine.', 0);
    await defiler(900, 3000);
    await enHaut();

    await legende('« Transports » : les arrivées et les départs, regroupés par vol ou par train, pour savoir qui aller chercher.', 0);
    await toucher(page.getByRole('tab', { name: 'Transports' }), { apres: 2500 });
    await legende('Plusieurs personnes sur le même vol ? On le saisit une fois, et on coche qui le prend.', 0);
    await toucher(page.getByRole('button', { name: /Ajouter des personnes à ce vol/ }).first(), { apres: 3500 });
    await legende('Pour une arrivée, l\'heure de départ de l\'avion : le jour venu, chacun voit à quelle heure être à l\'aéroport.', 0);
    await page.locator('#vc-heure-depart').scrollIntoViewIfNeeded();
    await pause(4000);
    await toucher(page.getByRole('button', { name: 'Annuler' }), { apres: 800 });
    await legende('Dessous, les voitures : le conducteur, ses passagers et les places qui restent.', 0);
    await defiler(700, 3500);
    await legende('Chacun n\'est que dans une seule voiture : celui qui conduit ou qui a déjà une place ailleurs est grisé.', 0);
    await toucher(page.locator('li.carte').filter({ hasText: 'Voiture de Gwendoline' })
      .getByRole('button', { name: 'Modifier' }), { apres: 4000 });
    await toucher(page.getByRole('button', { name: 'Annuler' }), { apres: 800 });
    await enHaut();

    await legende('« Hébergement » : le gîte, ses chambres et leurs occupants. En haut, Mateo n\'a pas encore de chambre.', 0);
    await toucher(page.getByRole('tab', { name: 'Hébergement' }), { apres: 3000 });
    await toucher(page.getByRole('button', { name: 'Modifier' }).first(), { apres: 1000 });
    await legende('Mateo prend la chambre 3.', 0);
    const chambre3 = page.locator('fieldset').filter({ hasText: 'Chambre 3' });
    await chambre3.scrollIntoViewIfNeeded();
    await toucher(chambre3.getByLabel('Mateo Vasquez'), { apres: 800 });
    await toucher(page.getByRole('button', { name: 'Enregistrer' }), { apres: 1800 });
    await vignette();

    await legende('« Pratique » : les affaires à prévoir, et les infos pratiques. « Partir de la liste type » remplit la liste d\'un coup.', 0);
    await toucher(page.getByRole('tab', { name: 'Pratique' }), { apres: 3500 });

    await legende('« Programme » : les rendez-vous, et les plongées de la sortie.', 0);
    await toucher(page.getByRole('tab', { name: 'Programme' }), { apres: 1200 });
    await toucher(page.getByRole('button', { name: 'Ajouter un rendez-vous' }), { apres: 800 });
    await dater('#e-jour', '2027-06-06');
    await saisir('#e-debut', '1900');
    await saisir('#e-titre', 'Apéritif sur la plage');
    await saisir('#e-lieu', 'Plage de l\'Almanarre');
    await toucher(page.getByRole('button', { name: 'Enregistrer' }), { apres: 1800 });
    await defiler(400, 1500);
    await enHaut();

    await legende('« Gérer les frais » : qui a avancé quoi, pour qui. L\'appli calcule qui doit combien à qui.', 0);
    await toucher(page.getByRole('button', { name: 'Gérer les frais' }), { apres: 3500 });
    await legende('Mateo rembourse Gwendoline : « C\'est remboursé », et les comptes se mettent à jour.', 0);
    const remboursement = page.locator('.remboursement').filter({ hasText: 'Mateo' }).first();
    await toucher(remboursement.getByRole('button', { name: 'C\'est remboursé' }), { apres: 1000 });
    await toucher(page.getByRole('button', { name: 'Enregistrer' }), { apres: 2500 });
    await legende('Les dépenses, une ligne chacune. On en touche une pour voir le partage et la photo de la note.', 0);
    const depense = page.locator('.depense summary').first();
    await depense.scrollIntoViewIfNeeded();
    await toucher(depense, { apres: 3500 });
    await legende('Le compte de chacun est replié en bas, dans « Détail des comptes ».', 3500);
    await legende('Les participants notent aussi leurs frais, dans l\'appli ou par le lien reçu par e-mail.', 4500);
    await enHaut();
    await legende('« Envoyer le carnet par e-mail » : chacun reçoit son vol, sa voiture, sa chambre, le programme, les affaires et ses frais.', 0);
    await toucher(page.getByRole('button', { name: 'Envoyer le carnet par e-mail' }), { apres: 2500 });
    await legende('On choisit à qui l\'envoyer : quelqu\'un ne l\'a pas reçu ? « Personne », puis on coche lui seul.', 0);
    await toucher(page.getByRole('button', { name: 'Personne' }), { apres: 1200 });
    await toucher(page.locator('.liste-vol input[type=checkbox]:not([disabled])').first(), { apres: 2500 });
    await legende('Même choix pour « Demander à chacun ses informations ». Ici, on n\'envoie rien.', 0);
    await toucher(page.getByRole('button', { name: 'Annuler' }), { apres: 1500 });
    await legende('Pendant le séjour, un encart « Aujourd\'hui » en haut de la page : le programme du jour, les vols à prendre, et la veille un rappel.', 5000);
    await legende('Pas d\'information médicale dans l\'appli : seulement des choix de table.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
