// M4 — Noter un élève pendant la séance.
import { ouvrirGrille, critere, noter } from '../grille.mjs';

export default {
  id: 'M4',
  titre: 'Noter un élève pendant la séance',
  compte: 'e2@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, saisir, defiler, choisirDerniereSeance } = g;

    await legende('Dans « Infos élèves », touchez le nom de l\'élève.', 0);
    await ouvrirGrille(g, 'Anis Dulac');

    await legende('Sa grille : niveau préparé, critères acquis, séances suivies.', 3500);
    await legende('La jauge descend vers la profondeur du brevet à mesure qu\'il progresse.', 3500);

    await legende('Avant de noter, choisissez la séance du jour.', 0);
    await choisirDerniereSeance();

    await legende('« Au programme » : les compétences que la progression prévoit ce mois-ci.', 0);
    await page.locator('section.programme').scrollIntoViewIfNeeded();
    await pause(3000);
    await toucher(page.getByRole('button', { name: /^Ouvrir les \d+ blocs au programme$/ }), { apres: 1200 });

    await legende('Chaque critère a trois états : non abordé, en cours, acquis.', 0);
    await critere(page, 'Palmage dorsal').scrollIntoViewIfNeeded();
    await pause(2500);
    await legende('Tiago l\'avait noté « en cours » la semaine dernière. Aujourd\'hui, c\'est acquis.', 0);
    await noter(g, 'Palmage dorsal', 'Acquis');
    await legende('Votre nom et la date s\'affichent sous le critère.', 3000);

    await legende('Le palmage de sustentation est en cours…', 0);
    await noter(g, 'Palmage de sustentation', 'En cours');
    await legende('… on laisse un mot pour le prochain encadrant.', 0);
    const ligne = critere(page, 'Palmage de sustentation');
    await toucher(ligne.getByRole('button', { name: 'Commenter' }), { apres: 500 });
    await saisir(ligne.locator('textarea'), 'Tient 30 s, jambes trop pliées.');
    await toucher(ligne.getByRole('button', { name: 'Enregistrer le commentaire' }), { apres: 1500 });
    await legende('Le commentaire reste affiché sous le critère.', 3000);

    await legende('Un bloc marqué « En retard » a passé l\'échéance prévue par la progression.', 3500);
    await legende('Pas de réseau ? La note est gardée sur le téléphone, « En attente d\'envoi ».', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
