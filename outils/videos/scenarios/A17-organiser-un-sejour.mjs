// A17 — Organiser un séjour : les sept onglets (programme, participants et repas, transports, hébergement, frais, matériel, pratique).
// Tournage du 2026-10-20, 24e série, terminal, enregistrement et dossier du vol commun, « Modifier » de l'hébergement, une combinaison déclarée (le gilet est déjà prêté), qui n'a rien emprunté (changer cette date dans tous les scénarios les fait tous retourner).
// Tourné avec Gwendoline (e3@club.fr), créatrice du séjour de démonstration (V120) : un ADMIN n'y a que la lecture.
import { APPLI } from '../commun.mjs';

export default {
  id: 'A17',
  titre: 'Organiser un séjour',
  public: 'Administrateur',
  resume: 'Seuls le créateur du séjour et les organisateurs qu\'il désigne le modifient ; l\'encart des frais en haut de la page, puis les sept onglets du séjour : les participants (un plongeur inscrit avec son groupe y reste lié), demander à chacun ses informations (et lui ouvrir le carnet tenu à jour par le lien), puis les vols (jour et heure de départ de l\'aller, jour, heure et lieu d\'arrivée du retour, terminal, ouverture de l\'enregistrement, numéro de dossier) et les voitures, les chambres, les régimes, le programme, le partage des frais, le matériel du club emprunté (déclaré pour un participant) et les affaires, l\'envoi du carnet par e-mail aux seules personnes choisies, la version imprimable du carnet ; pendant le séjour, l\'encart « Aujourd\'hui ».',
  compte: 'e3@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, saisir, dater, menu, defiler, enHaut, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await legende('Menu « Séjours » : chaque sortie a son séjour.', 0);
    await menu('Séjours');
    await toucher(page.locator('main a').filter({ hasText: 'Séjour à Port-Cros' }).first(), { apres: 1500 });
    await legende('Gwendoline a créé la sortie : elle est la créatrice du séjour, et seule à pouvoir le modifier.', 4500);
    await legende('Sous le titre, le bandeau « Organisation » : qui organise, et « Vous pouvez modifier » ou « Lecture seule ».', 4500);
    await legende('« Choisir les organisateurs » : elle coche les moniteurs qui l\'aident. Les autres le lisent seulement.', 0);
    await toucher(page.getByRole('button', { name: 'Choisir les organisateurs' }), { apres: 4000 });
    await toucher(page.getByRole('button', { name: 'Annuler' }), { apres: 800 });
    await legende('Les participants, eux, le lisent par le lien et le code reçus par e-mail.', 4000);
    await legende('Tout en haut, l\'encart « Frais du séjour » : le total dépensé, et « Gérer les frais » pour les ouvrir.', 4500);
    await legende('Puis sept onglets, « Frais » en premier. Un rond orange signale ce qui reste à régler : ici, dans « Hébergement ».', 4500);

    await legende('« Participants » : une ligne par personne, avec ce qu\'elle n\'a pas encore donné.', 0);
    await toucher(page.getByRole('tab', { name: 'Participants' }), { apres: 2500 });
    await legende('On touche un nom pour voir sa fiche : vol, repas, personne à prévenir.', 0);
    await toucher(page.locator('.liste-participants summary').first(), { apres: 3000 });
    await legende('Un plongeur inscrit avec son groupe de plongeurs y reste lié : nom, prénom et e-mail suivent d\'un côté à l\'autre.', 4500);
    await legende('Pas besoin de tout saisir : « Demander les informations… », en haut de la page, leur envoie un e-mail.', 4500);
    await legende('Les moniteurs complètent dans l\'appli ; les autres par un lien et un code, sans mot de passe.', 4500);
    await legende('Par ce lien, ils lisent aussi le carnet du séjour, toujours à jour : programme, voitures, chambres, affaires.', 4500);
    await legende('En bas, les repas : le nombre de couverts et les régimes, pour la cuisine.', 0);
    await defiler(900, 3000);
    await enHaut();

    await legende('« Transports » : les arrivées et les départs, regroupés par vol ou par train, pour savoir qui aller chercher.', 0);
    await toucher(page.getByRole('tab', { name: 'Transports' }), { apres: 2500 });
    await legende('Plusieurs personnes sur le même vol ? On le saisit une fois, et on coche qui le prend.', 0);
    await toucher(page.getByRole('button', { name: /Ajouter des personnes à ce vol/ }).first(), { apres: 3500 });
    await legende('Pour une arrivée, le jour et l\'heure de départ de l\'avion : le jour venu, chacun voit à quelle heure être à l\'aéroport.', 0);
    await page.locator('#vc-date-depart').scrollIntoViewIfNeeded();
    await pause(4000);
    await legende('Un vol long qui part l\'avant-veille ? On saisit son jour de départ, l\'encart du jour le suit.', 4000);
    await legende('Le terminal et l\'ouverture de l\'enregistrement en ligne valent pour tous. Le numéro de dossier, laissé vide, reste celui de chacun ; une réservation de groupe ? Un seul dossier pour tous.', 0);
    await page.locator('#vc-terminal').scrollIntoViewIfNeeded();
    await pause(5500);
    await toucher(page.getByRole('button', { name: 'Annuler' }), { apres: 800 });
    await legende('Pour un retour, le jour, l\'heure et l\'aéroport ou la gare d\'arrivée : on sait quand et où aller chercher chacun.', 0);
    await toucher(page.getByRole('button', { name: /Ajouter des personnes à ce (vol|train)/ }).last(), { apres: 2500 });
    await page.locator('#vc-lieu-arrivee').scrollIntoViewIfNeeded();
    await pause(3500);
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
    await toucher(page.getByRole('button', { name: 'Modifier', exact: true }).first(), { apres: 1000 });
    await legende('Mateo prend la chambre 3.', 0);
    const chambre3 = page.locator('fieldset').filter({ hasText: 'Chambre 3' });
    await chambre3.scrollIntoViewIfNeeded();
    await toucher(chambre3.getByLabel('Mateo Vasquez'), { apres: 800 });
    await toucher(page.getByRole('button', { name: 'Enregistrer' }), { apres: 1800 });
    await vignette();

    await legende('« Matériel » : le matériel du club emprunté pour le séjour. Chacun déclare le sien, comme ses frais.', 0);
    await toucher(page.getByRole('tab', { name: 'Matériel' }), { apres: 2500 });
    await legende('Sous les emprunts : qui a répondu n\'avoir rien emprunté, et qui n\'a pas encore répondu, à relancer.', 0);
    await page.locator('app-sejour-materiel .reponses').scrollIntoViewIfNeeded();
    await pause(4000);
    await legende('L\'organisatrice déclare aussi pour un autre : « Déclarer un emprunt », qui, le jour, puis le matériel.', 0);
    await toucher(page.getByRole('button', { name: 'Déclarer un emprunt' }), { apres: 1500 });
    await toucher(page.getByRole('button', { name: 'Combinaisons' }), { apres: 1500 });
    await legende('Seul le matériel disponible est proposé : ni déjà prêté, ni hors échéance jusqu\'à la fin du séjour.', 0);
    await toucher(page.locator('.choix input[type=checkbox]').first(), { apres: 2500 });
    await toucher(page.getByRole('button', { name: 'Enregistrer' }), { apres: 2500 });
    await legende('C\'est un vrai prêt : le directeur technique le retrouve dans ses prêts, et note le retour.', 4500);

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
    await legende('« Envoyer le carnet… » : chacun reçoit son vol, sa voiture, sa chambre, le programme, les affaires et ses frais.', 0);
    await toucher(page.getByRole('button', { name: 'Envoyer le carnet…' }), { apres: 2500 });
    await legende('On choisit à qui l\'envoyer : quelqu\'un ne l\'a pas reçu ? « Personne », puis on coche lui seul.', 0);
    await toucher(page.locator('dialog[open]').getByRole('button', { name: 'Personne', exact: true }), { apres: 1200 });
    await toucher(page.locator('.liste-vol input[type=checkbox]:not([disabled])').first(), { apres: 2500 });
    await legende('Même choix pour « Demander les informations… ». Ici, on n\'envoie rien.', 0);
    await toucher(page.getByRole('button', { name: 'Annuler' }), { apres: 1500 });
    await legende('« Version imprimable » : le carnet mis en page pour le papier, en tableaux.', 0);
    await toucher(page.getByRole('link', { name: 'Version imprimable' }), { apres: 2500 });
    await legende('On coche les rubriques à imprimer. Les téléphones, repas et personnes à prévenir n\'y sont que si on le demande.', 4500);
    await defiler(700, 2500);
    await legende('« Imprimer ou enregistrer en PDF », puis on revient au séjour.', 0);
    await page.goBack();
    await pause(1500);
    await legende('Pendant le séjour, un encart « Aujourd\'hui » en haut de la page : le programme du jour, les vols à prendre, et la veille un rappel.', 5000);
    await legende('Pas d\'information médicale dans l\'appli : seulement des choix de table.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
