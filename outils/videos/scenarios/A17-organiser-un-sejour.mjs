// A17 — Organiser un séjour : les cinq onglets (programme et fiches de sécurité ; qui et où : participants, transports, logements ; repas : régimes, courses, restaurant ; frais ; pratique : affaires, infos, matériel).
// Tournage du 2026-10-26, 49e série, la signature de la fiche par son DP depuis le séjour (« Vous la signerez comme DP à partir du … » avant la plongée), « Prévenir les participants… » (notification sur le téléphone, sinon e-mail), le QR code de connexion d'un participant (une minute), cinq onglets au lieu de dix avec un sommaire par onglet, « Partager et organiser… » dans le bandeau, l'encart des frais retiré, la présentation d'une journée du programme (titre, trajet, photos des lieux, à découvrir, conseil, hébergement), « Payer l'addition » sans attendre tout le monde (fenêtre ouverte, payeur cherché parmi tous les participants), « Modifier » le menu du restaurant à la main, « Payer l'addition » du restaurant (la part de chacun dans les frais, sauf qui paie de son côté), l'onglet « Fiches de sécurité » (état de chaque fiche, ajouter une plongée, tout imprimer), le menu du restaurant (import Excel, choix de chacun, commande complète), la liste de courses et les repas au restaurant, le trombinoscope du séjour exporté en image et le niveau des encadrants sous leur photo, la photo d'un invité et « Montrer aux participants » dans une fenêtre, le trombinoscope dans le bandeau et ouvert aux participants, la photo d'un invité, le trombinoscope par groupe de plongeurs, les frais avancés par le club, le séjour sans réseau (copie du téléphone, rendez-vous ajouté hors ligne), attestations d'assurance des participants, « Voir comme un participant », carte d'embarquement d'un passager, voitures séparées des vols, une carte par vol dans « Transports » avec ses passagers, terminal, enregistrement et dossier du vol commun, « Modifier » de l'hébergement, une combinaison déclarée (le gilet est déjà prêté), qui n'a rien emprunté (changer cette date dans tous les scénarios les fait tous retourner).
// Tourné avec Gwendoline (e3@club.fr), créatrice du séjour de démonstration (V120) : un ADMIN n'y a que la lecture.
import { APPLI } from '../commun.mjs';

export default {
  id: 'A17',
  titre: 'Organiser un séjour',
  public: 'Administrateur',
  resume: 'Seuls le créateur du séjour et les organisateurs qu\'il désigne le modifient, et ils peuvent le voir comme un participant ; « Partager et organiser… » rassemble les gestes du bandeau, puis les cinq onglets du séjour, chacun avec son sommaire : les participants (un plongeur inscrit avec son groupe y reste lié, qui a joint son attestation d\'assurance, le conseil d\'assurance à leur montrer, le trombinoscope par groupe de plongeurs, ouvert aux participants avec les seules photos qu\'on leur montre, le niveau des encadrants, exporté en image, et la photo d\'un invité, ajoutée dans une fenêtre), demander à chacun ses informations (et lui ouvrir le carnet tenu à jour par le lien), le QR code d\'une minute qui connecte un participant sur son téléphone, puis les vols, une carte par avion avec ses passagers (jour et heure de départ de l\'aller, jour, heure et lieu d\'arrivée du retour, terminal, ouverture de l\'enregistrement, numéro de dossier, carte d\'embarquement jointe) et les voitures, les chambres, les régimes, le programme (chaque journée présentée comme un carnet de voyage : titre, trajet, photos des lieux, à découvrir, conseil, hébergement), le partage des frais (dont ceux avancés par le club), le matériel du club emprunté (déclaré pour un participant), la liste de courses (repas au restaurant choisis jour par jour, quantités selon les présents et les régimes), le menu du restaurant (importé d\'un fichier Excel fabriqué par une IA, corrigé à la main, le choix de chacun, la commande complète, l\'addition payée et la part de chacun mise dans les frais), les fiches de sécurité des plongées (leur état jour par jour, la signature par le directeur de plongée, une plongée ajoutée, toutes les fiches imprimées d\'un coup) et les affaires, l\'envoi du carnet par e-mail aux seules personnes choisies, prévenir les participants d\'un changement par une notification sur leur téléphone (sinon par e-mail), la version imprimable du carnet ; sans réseau, le séjour lu sur le téléphone et modifié, envoyé au retour du réseau ; pendant le séjour, l\'encart « Aujourd\'hui ».',
  compte: 'e3@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, saisir, dater, menu, defiler, enHaut, vignette, reseau }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await legende('Menu « Séjours » : chaque sortie a son séjour.', 0);
    await menu('Séjours');
    await toucher(page.locator('main a').filter({ hasText: 'Séjour à Port-Cros' }).first(), { apres: 1500 });
    await legende('Gwendoline a créé la sortie : elle est la créatrice du séjour, et seule à pouvoir le modifier.', 4500);
    await legende('Sous le titre, le bandeau « Organisation » : qui organise, et « Vous pouvez modifier » ou « Lecture seule ».', 4500);
    await legende('À côté de « Version imprimable », « Partager et organiser… » rassemble les autres gestes, pour garder le bandeau sur une ligne.', 0);
    await toucher(page.locator('.ouvrir-actions'), { apres: 2500 });
    await legende('« Choisir les organisateurs » : elle coche les moniteurs qui l\'aident. Les autres le lisent seulement.', 0);
    await toucher(page.getByRole('button', { name: 'Choisir les organisateurs' }), { apres: 4000 });
    await toucher(page.getByRole('button', { name: 'Annuler' }), { apres: 800 });
    await legende('Les participants, eux, le lisent par le lien et le code reçus par e-mail.', 4000);
    await legende('« Voir comme un participant » : le séjour tel qu\'ils le voient, sans les téléphones, les régimes ni les dossiers des autres, et sans rien à modifier.', 0);
    await toucher(page.locator('.ouvrir-actions'), { apres: 1200 });
    await toucher(page.getByRole('button', { name: /Voir comme un participant/ }), { apres: 4000 });
    await legende('« Revenir à l\'organisation », dans le bandeau, lui rend la main.', 0);
    await toucher(page.getByRole('button', { name: /Revenir à l'organisation/ }), { apres: 2500 });
    await legende('Puis cinq onglets, qui tiennent sur l\'écran du téléphone : Programme, Qui et où, Repas, Frais, Pratique.', 4500);
    await legende('Un rond orange signale ce qui reste à régler : ici, dans « Qui et où ».', 4000);

    await legende('« Qui et où » : en haut, les participants, une ligne par personne, avec ce qu\'elle n\'a pas encore donné.', 0);
    await toucher(page.getByRole('tab', { name: 'Qui et où' }), { apres: 2500 });
    await legende('Les boutons du haut descendent directement aux participants, aux arrivées et départs, aux voitures ou aux logements.', 4000);
    await legende('On touche un nom pour voir sa fiche : vol, repas, personne à prévenir.', 0);
    await toucher(page.locator('.liste-participants summary').first(), { apres: 3000 });
    await legende('Un plongeur inscrit avec son groupe de plongeurs y reste lié : nom, prénom et e-mail suivent d\'un côté à l\'autre.', 4500);
    await legende('En haut de la liste, combien ont joint leur attestation d\'assurance. Chacun la joint depuis « Mon séjour » ; dans sa fiche, « Ouvrir » la montre, à lui et aux seuls organisateurs.', 6000);
    await page.locator('.conseil-assurance').scrollIntoViewIfNeeded();
    await legende('Dessous, le conseil d\'assurance : ce que voit chaque participant qui n\'a pas encore joint la sienne. « Modifier », et « Reprendre le message type » propose celui de Lafont.', 0);
    await toucher(page.locator('.conseil-assurance').getByRole('button', { name: 'Modifier' }), { apres: 4000 });
    await toucher(page.getByRole('button', { name: 'Annuler' }), { apres: 800 });
    await enHaut();
    await legende('Dans « Partager et organiser… », « Trombinoscope » : les visages des participants, pour mettre un nom sur chacun dès le premier jour.', 0);
    await toucher(page.locator('.ouvrir-actions'), { apres: 1200 });
    await toucher(page.locator('.ouvrir-trombinoscope'), { apres: 3000 });
    await legende('Un bouton par groupe de plongeurs : on ne garde que ceux du groupe. Sous un encadrant, son niveau d\'encadrement, et son niveau de plongeur s\'il est E1. Pas de photo sans le droit à l\'image : les initiales à la place.', 0);
    await legende('Tous les participants le voient aussi, mais sans les photos : sous chacune, « Montrer aux participants », avec l\'accord de la personne ou de ses parents.', 5500);
    await toucher(page.getByRole('group', { name: 'Filtrer par groupe de plongeurs' }).getByRole('button').nth(1), { apres: 4000 });
    await legende('« Exporter en image » : une image PNG du groupe affiché, titrée du nom du séjour. On peut cacher certaines photos derrière une icône.', 0);
    await toucher(page.locator('.exporter-image'), { apres: 5000 });
    await toucher(page.locator('app-export-trombinoscope').getByRole('button', { name: 'Annuler' }), { apres: 800 });
    await legende('Jules, invité, n\'a ni dossier ni compte au club : « Ajouter une photo », avec son accord coché. Elle est effacée après le séjour.', 0);
    await toucher(page.getByRole('button', { name: 'Sans groupe' }), { apres: 1500 });
    await toucher(page.getByRole('button', { name: /Ajouter une photo de Jules/ }), { apres: 4500 });
    await toucher(page.locator('.ajout-photo').getByRole('button', { name: 'Annuler' }), { apres: 800 });
    await toucher(page.getByRole('button', { name: 'Fermer' }).first(), { apres: 800 });
    await legende('Pas besoin de tout saisir : « Demander les informations… », en haut de la liste des participants, leur envoie un e-mail.', 4500);
    await legende('Les moniteurs complètent dans l\'appli ; les autres par un lien et un code, sans mot de passe.', 4500);
    await legende('Par ce lien, ils lisent aussi le carnet du séjour, toujours à jour : programme, voitures, chambres, affaires.', 4500);
    await legende('Jules est à côté d\'elle, avec son téléphone : dans sa fiche, « QR code de connexion ».', 0);
    await toucher(page.locator('.liste-participants li').filter({ hasText: 'Jules' }).locator('summary'), { apres: 1500 });
    await toucher(page.locator('.liste-participants li').filter({ hasText: 'Jules' }).locator('.bouton-qr-connexion'), { apres: 2000 });
    await legende('Il le scanne avec l\'appareil photo de son téléphone : son séjour s\'ouvre, déjà connecté, sans e-mail ni code, jusqu\'à un mois après le séjour.', 5000);
    await legende('Le QR code ne vaut qu\'une minute, compte à rebours affiché, et une seule fois. Pas pour un moniteur, qui a son compte.', 4500);
    await toucher(page.locator('dialog[open]').getByRole('button', { name: 'Fermer' }).last(), { apres: 800 });

    await legende('Dessous, les arrivées et les départs, regroupés par vol ou par train, pour savoir qui aller chercher.', 0);
    await toucher(page.locator('.sommaire-onglet').getByRole('button', { name: 'Arrivées et départs' }), { apres: 2500 });
    await legende('Chaque vol a sa carte : heures de départ et d\'arrivée, terminal, compagnie, ouverture de l\'enregistrement. Dessous, qui est dans l\'avion, avec son numéro de dossier.', 6000);
    await page.locator('.carte-passager').first().scrollIntoViewIfNeeded();
    await legende('Flora a joint sa carte d\'embarquement à son vol : le bouton « Carte d\'embarquement », à côté de son nom, l\'ouvre. Seuls elle et les organisateurs la voient.', 5500);
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
    await page.locator('#voitures-sejour').scrollIntoViewIfNeeded();
    await pause(3500);
    await legende('Chacun n\'est que dans une seule voiture : celui qui conduit ou qui a déjà une place ailleurs est grisé.', 0);
    await toucher(page.locator('li.carte').filter({ hasText: 'Voiture de Gwendoline' })
      .getByRole('button', { name: 'Modifier' }), { apres: 4000 });
    await toucher(page.getByRole('button', { name: 'Annuler' }), { apres: 800 });
    await enHaut();

    await legende('Puis les logements : le gîte, ses chambres et leurs occupants. Au-dessus, en orange : Mateo n\'a pas encore de chambre.', 0);
    await toucher(page.locator('.sommaire-onglet').getByRole('button', { name: 'Logements' }), { apres: 3000 });
    await toucher(page.locator('#logements-sejour').getByRole('button', { name: 'Modifier', exact: true }).first(), { apres: 1000 });
    await legende('Mateo prend la chambre 3.', 0);
    const chambre3 = page.locator('fieldset').filter({ hasText: 'Chambre 3' });
    await chambre3.scrollIntoViewIfNeeded();
    await toucher(chambre3.getByLabel('Mateo Vasquez'), { apres: 800 });
    await toucher(page.getByRole('button', { name: 'Enregistrer' }), { apres: 1800 });
    await vignette();

    await legende('« Pratique », tout en bas : le matériel du club emprunté pour le séjour. Chacun déclare le sien, comme ses frais.', 0);
    await toucher(page.getByRole('tab', { name: 'Pratique' }), { apres: 1200 });
    await toucher(page.locator('.sommaire-onglet').getByRole('button', { name: 'Matériel emprunté' }), { apres: 2500 });
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

    await legende('« Repas » : en haut, le nombre de couverts et les régimes, pour la cuisine.', 0);
    await toucher(page.getByRole('tab', { name: 'Repas' }), { apres: 3500 });
    await legende('Dessous, les courses : les repas du séjour, jour par jour, et combien sont à table, selon les arrivées et les départs.', 0);
    await toucher(page.locator('.sommaire-onglet').getByRole('button', { name: 'Courses' }), { apres: 3500 });
    await legende('« Choisir les repas au restaurant » : on coche ceux que l\'on ne prépare pas. Ici, en plus, le dîner du dimanche.', 0);
    await toucher(page.locator('.choisir-restaurant'), { apres: 1500 });
    await toucher(page.locator('dialog[open]').getByLabel('Dîner du Dimanche 06/06/2027 au restaurant'), { apres: 1500 });
    await toucher(page.getByRole('button', { name: 'Enregistrer' }), { apres: 2500 });
    await legende('Dessous, la liste de courses, rayon par rayon, qui suit les régimes de chacun : œufs pour un végétarien, pain sans gluten…', 0);
    await page.locator('app-sejour-courses .rayons').scrollIntoViewIfNeeded();
    await pause(5000);
    await legende('Dans le magasin, on coche ce qui est dans le chariot. « Copier la liste » la met dans un message au groupe.', 4500);
    await enHaut();

    await legende('Puis le restaurant : le menu du samedi soir. Chacun y choisit son plat, dans l\'appli ou par le lien.', 0);
    await toucher(page.locator('.sommaire-onglet').getByRole('button', { name: 'Restaurant' }), { apres: 3000 });
    await legende('« Choisir mes plats » : on coche ce qu\'on veut, avec le prix, puis « Enregistrer ».', 0);
    await toucher(page.locator('.choisir-plats').first(), { apres: 1500 });
    const choix = page.locator('dialog[open]');
    await toucher(choix.getByRole('checkbox', { name: /Soupe de poissons/ }), { apres: 800 });
    await toucher(choix.getByRole('checkbox', { name: /Risotto aux champignons/ }), { apres: 800 });
    await toucher(choix.getByRole('checkbox', { name: /Tarte au citron/ }), { apres: 1500 });
    await toucher(choix.getByRole('button', { name: 'Enregistrer' }), { apres: 2500 });
    await legende('Pour l\'organisatrice seulement, la commande complète : combien de chaque plat, le total, le choix de chacun et qui n\'a pas encore choisi.', 0);
    await page.locator('app-sejour-restaurant .commande').first().scrollIntoViewIfNeeded();
    await pause(5500);
    await legende('« Choisir pour … » choisit à la place d\'un enfant ou d\'un invité. « Copier la commande » la met dans un message pour le restaurant.', 5000);
    await page.locator('app-sejour-restaurant .addition').first().scrollIntoViewIfNeeded();
    await legende('« Payer l\'addition », sans attendre tout le monde : on choisit qui paie, et chacun est noté dans les frais pour ce qu\'il a pris.', 0);
    await toucher(page.locator('.payer-addition').first(), { apres: 3000 });
    await legende('« Qui paie l\'addition ? » : on tape le nom de n\'importe quel participant, ou « Le club ».', 4500);
    await legende('On décoche qui paie sa part de son côté. Ceux qui n\'ont pas choisi n\'ont rien dans les frais. Les choix ne changent plus ensuite.', 6000);
    await toucher(page.locator('dialog[open]').getByRole('button', { name: 'Annuler' }), { apres: 800 });
    await enHaut();
    await legende('« Importer un menu » : le jour, le repas, le restaurant et le fichier Excel du menu.', 0);
    await toucher(page.locator('.importer-menu'), { apres: 2000 });
    await legende('Le fichier, une IA le fabrique d\'une photo du menu : « Comment fabriquer le fichier ? » donne le texte à lui copier.', 0);
    await toucher(page.locator('dialog[open] .prompt summary'), { apres: 5500 });
    await toucher(page.locator('dialog[open]').getByRole('button', { name: 'Annuler' }), { apres: 800 });
    await legende('L\'IA a mal lu un prix, ou il y a un plat du jour ? « Modifier » : chaque plat se corrige, se déplace, se retire, et « Ajouter un plat » en ajoute un.', 0);
    await toucher(page.locator('.modifier-menu').first(), { apres: 3000 });
    await legende('Un plat gardé garde les choix déjà faits, à son nouveau prix.', 0);
    await page.locator('dialog[open] .ajouter-plat').scrollIntoViewIfNeeded();
    await pause(3500);
    await toucher(page.locator('dialog[open]').getByRole('button', { name: 'Annuler' }), { apres: 800 });

    await legende('Sous le programme, les fiches de sécurité : les plongées du séjour, jour par jour, et où en est la fiche de chacune.', 0);
    await toucher(page.getByRole('tab', { name: 'Programme' }), { apres: 1200 });
    await toucher(page.locator('.sommaire-onglet').getByRole('button', { name: 'Fiches de sécurité' }), { apres: 3500 });
    await legende('« Établir la fiche » ou « Modifier la fiche » ouvre la fiche habituelle ; son retour ramène ici. « Compléter au retour » après la plongée.', 5500);
    await page.locator('.signature-a-venir').first().scrollIntoViewIfNeeded();
    await legende('Gwendoline est DP de la première plongée : elle la signera d\'ici, « ✍ Signer la fiche », dès le jour de la plongée.', 5000);
    await legende('« Imprimer toutes les fiches » : celles du séjour dans un seul PDF, deux plongées du même jour par feuille.', 4500);
    await legende('Une plongée manque ? « Ajouter une plongée » : le jour, le site, la profondeur. Elle paraît aussitôt au programme.', 0);
    await toucher(page.locator('.ajouter-plongee'), { apres: 2000 });
    await saisir('#plongee-site', 'La Gabinière');
    await saisir('#plongee-profondeur', '25');
    await toucher(page.locator('dialog[open]').getByRole('button', { name: 'Ajouter' }), { apres: 2500 });
    await legende('Tant qu\'elle n\'a pas de fiche, « Supprimer la plongée » la retire.', 3500);
    await enHaut();

    await legende('« Pratique », en haut : les affaires à prévoir, et les infos pratiques. « Partir de la liste type » remplit la liste d\'un coup.', 0);
    await toucher(page.getByRole('tab', { name: 'Pratique' }), { apres: 3500 });

    await legende('« Programme » : les rendez-vous, les plongées de la sortie, et la présentation de chaque journée.', 0);
    await toucher(page.getByRole('tab', { name: 'Programme' }), { apres: 1200 });
    await toucher(page.getByRole('button', { name: 'Ajouter un rendez-vous' }), { apres: 800 });
    await dater('#e-jour', '2027-06-06');
    await saisir('#e-debut', '1900');
    await saisir('#e-titre', 'Apéritif sur la plage');
    await saisir('#e-lieu', 'Plage de l\'Almanarre');
    await toucher(page.getByRole('button', { name: 'Enregistrer' }), { apres: 1800 });
    await legende('Les deux premiers jours sont présentés comme un carnet de voyage : le titre du jour, le trajet, puis « À découvrir », un conseil et l\'hébergement.', 0);
    await defiler(400, 4000);
    await legende('« Présenter la journée » sous le dimanche : son titre, son trajet, et deux photos des lieux.', 0);
    await toucher(page.locator('app-journee-programme').filter({ hasText: 'Apéritif sur la plage' })
      .getByRole('button', { name: 'Présenter la journée' }), { apres: 1200 });
    await saisir('#j-titre', 'Jour 3 — Plongée de nuit à Bagaud');
    await saisir('#j-trajet', 'Port-Cros → île de Bagaud · 10 min de bateau');
    // Deux images d'illustration dessinées dans la page (mer et plage), comme des photos du téléphone.
    const images = await page.evaluate(() => [['#0E7490', '#67E8F9'], ['#FDE68A', '#0891B2']].map(([haut, bas]) => {
      const c = document.createElement('canvas');
      c.width = 800; c.height = 600;
      const g = c.getContext('2d');
      const d = g.createLinearGradient(0, 0, 0, 600);
      d.addColorStop(0, haut); d.addColorStop(1, bas);
      g.fillStyle = d; g.fillRect(0, 0, 800, 600);
      return c.toDataURL('image/png').split(',')[1];
    }));
    await page.locator('#j-photos').setInputFiles(images.map((b, i) => ({
      name: `bagaud-${i + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(b, 'base64')
    })));
    await pause(3000);
    await legende('Des paysages seulement, sans personne reconnaissable : quatre photos au plus, allégées par le téléphone.', 4500);
    await saisir('#j-descriptif', 'Un îlot interdit au débarquement, des tombants couverts de gorgonies, et la nuit les poulpes de sortie.');
    await saisir('#j-conseil', 'Une lampe chacun et une de secours ; repas léger avant de partir.');
    await saisir('#j-hebergement', 'Gîte des Salins — 3ᵉ nuit');
    await toucher(page.locator('dialog[open]').getByRole('button', { name: 'Enregistrer' }), { apres: 2000 });
    await legende('Le jour se lit comme une page de carnet : les photos deux par deux, puis le programme, ce qu\'on y découvre, le conseil et où l\'on dort. Les participants le voient ainsi, dans l\'appli et par le lien.', 0);
    await page.locator('app-journee-programme').filter({ hasText: 'Jour 3 — Plongée de nuit' }).scrollIntoViewIfNeeded();
    await pause(5000);
    await enHaut();

    await legende('« Frais » : qui a avancé quoi, pour qui. L\'appli calcule qui doit combien à qui.', 0);
    await toucher(page.getByRole('tab', { name: 'Frais' }), { apres: 3500 });
    await legende('Mateo rembourse Gwendoline : « C\'est remboursé », et les comptes se mettent à jour.', 0);
    const remboursement = page.locator('.remboursement').filter({ hasText: 'Mateo' }).filter({ hasText: 'Gwendoline' }).first();
    await toucher(remboursement.getByRole('button', { name: 'C\'est remboursé' }), { apres: 1000 });
    await toucher(page.getByRole('button', { name: 'Enregistrer' }), { apres: 2500 });
    await legende('Le club a avancé le bateau du samedi : « Payé par » « Le club ». Chaque plongeur lui doit sa part, « … doit … au club ».', 5000);
    await legende('Les dépenses, une ligne chacune. On en touche une pour voir le partage et la photo de la note.', 0);
    const depense = page.locator('.depense summary').first();
    await depense.scrollIntoViewIfNeeded();
    await toucher(depense, { apres: 3500 });
    await legende('Le compte de chacun est replié en bas, dans « Détail des comptes ».', 3500);
    await legende('Les participants notent aussi leurs frais, dans l\'appli ou par le lien reçu par e-mail.', 4500);
    await enHaut();
    await legende('« Partager et organiser… », « Envoyer le carnet… » : chacun reçoit son vol, sa voiture, sa chambre, le programme, les affaires et ses frais.', 0);
    await toucher(page.locator('.ouvrir-actions'), { apres: 1200 });
    await toucher(page.getByRole('button', { name: 'Envoyer le carnet…' }), { apres: 2500 });
    await legende('On choisit à qui l\'envoyer : quelqu\'un ne l\'a pas reçu ? « Personne », puis on coche lui seul.', 0);
    await toucher(page.locator('dialog[open]').getByRole('button', { name: 'Personne', exact: true }), { apres: 1200 });
    await toucher(page.locator('.liste-vol input[type=checkbox]:not([disabled])').first(), { apres: 2500 });
    await legende('Même choix pour « Demander les informations… », en haut de la liste des participants. Ici, on n\'envoie rien.', 0);
    await toucher(page.getByRole('button', { name: 'Annuler' }), { apres: 1500 });
    await legende('Un changement de programme ? « Partager et organiser… », « Prévenir les participants… ».', 0);
    await toucher(page.locator('.ouvrir-actions'), { apres: 1200 });
    await toucher(page.locator('.prevenir-participants'), { apres: 2500 });
    await legende('Chaque participant qui a activé les notifications sur son téléphone reçoit un message : de nouvelles informations, ouvrez l\'appli. En le touchant, il arrive sur le séjour.', 5500);
    await saisir('#message-notification', 'Le rendez-vous de samedi passe à 8 h');
    await legende('Un court message s\'ajoute au besoin. La fenêtre dit qui a activé les notifications ; les autres reçoivent un e-mail, si la case reste cochée.', 5500);
    await toucher(page.locator('dialog[open]').getByRole('button', { name: 'Annuler' }), { apres: 1200 });
    await legende('« Version imprimable » : le carnet mis en page pour le papier, en tableaux.', 0);
    await toucher(page.getByRole('link', { name: 'Version imprimable' }), { apres: 2500 });
    await legende('On coche les rubriques à imprimer. Les téléphones, repas et personnes à prévenir n\'y sont que si on le demande.', 4500);
    await defiler(700, 2500);
    await legende('« Imprimer ou enregistrer en PDF », puis on revient au séjour.', 0);
    await page.goBack();
    await pause(1500);
    await legende('Au gîte ou sur l\'île, plus de réseau ? Le séjour déjà ouvert sur le téléphone s\'ouvre quand même.', 0);
    await reseau(false);
    await menu('Séjours');
    await toucher(page.locator('main a').filter({ hasText: 'Séjour à Port-Cros' }).first(), { apres: 1500 });
    await page.locator('.bandeau-hors-ligne').waitFor();
    await legende('« Hors ligne » : le séjour tel qu\'il était à la dernière ouverture. On le modifie comme d\'habitude.', 0);
    await toucher(page.getByRole('tab', { name: 'Programme' }), { apres: 1000 });
    await toucher(page.getByRole('button', { name: 'Ajouter un rendez-vous' }), { apres: 800 });
    await dater('#e-jour', '2027-06-05');
    await saisir('#e-debut', '1230');
    await saisir('#e-titre', 'Pique-nique au fort');
    await toucher(page.getByRole('button', { name: 'Enregistrer' }), { apres: 1500 });
    await page.locator('.bandeau-hors-ligne').scrollIntoViewIfNeeded();
    await legende('Le rendez-vous se voit tout de suite, et l\'encart le liste : « gardée sur ce téléphone ». Dépenses et remboursements aussi.', 5000);
    await legende('Le réseau revient : tout part tout seul, dans l\'ordre. Un refus du serveur s\'affiche dans le bandeau.', 0);
    await reseau(true);
    await pause(4000);
    await legende('Pendant le séjour, un encart « Aujourd\'hui » en haut de la page : le programme du jour, les vols à prendre, et la veille un rappel.', 5000);
    await legende('Pas d\'information médicale dans l\'appli : seulement des choix de table.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
