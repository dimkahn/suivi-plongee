// M4 — Noter un élève pendant la séance.
// Tournage du 2026-10-12, 11e série (changer cette date dans tous les scénarios les fait tous retourner).
import { ouvrirGrille, critere, noter } from '../grille.mjs';

export default {
  id: 'M4',
  titre: 'Noter un élève pendant la séance',
  public: 'Moniteur',
  resume: 'Choisir la séance, noter les critères au programme, laisser un commentaire pour le prochain encadrant.',
  compte: 'e2@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, saisir, defiler, choisirDerniereSeance } = g;

    await legende('Dans « Infos élèves », touchez le nom de l\'élève.', 0);
    await ouvrirGrille(g, 'Anis Dulac');

    await legende('Sa grille : niveau préparé, critères acquis, séances suivies.', 3500);
    await legende('La jauge descend vers la profondeur du brevet à mesure qu\'il progresse.', 3500);

    await legende('Sa dernière séance où il était présent est déjà choisie ; touchez-la pour en changer.', 0);
    await choisirDerniereSeance();
    await legende('Seules les séances où l\'élève est noté présent sont proposées : faites l\'appel d\'abord.', 4000);
    await legende('Référent du groupe ? « Noter au nom de » rattrape la note d\'un encadrant : laissez « Moi-même » pour noter à votre nom.', 4500);

    await legende('« Au programme » : les compétences que la progression prévoit ce mois-ci.', 0);
    await page.locator('section.programme').scrollIntoViewIfNeeded();
    await pause(3000);
    await toucher(page.getByRole('button', { name: /^Ouvrir (les \d+ compétences|la compétence) au programme$/ }), { apres: 1200 });
    await legende('Si son groupe a préparé la séance, ses exercices s\'affichent aussi, chacun avec ses critères à noter juste dessous.', 4500);

    await legende('Trois états, en sigles sur les boutons : NA non abordé, ECA en cours d\'acquisition, A acquis. La légende est en haut de la fiche.', 0);
    await critere(page, 'Palmage dorsal').scrollIntoViewIfNeeded();
    await pause(2500);
    await legende('Tiago l\'avait noté « en cours » la semaine dernière. Aujourd\'hui, il réussit le parcours de surface.', 0);
    await noter(g, 'Palmage dorsal', 'Acquis', 'Parcours de surface en PMT');
    await legende('La note porte sur l\'exercice réalisé : « 1. Exercice », juste au-dessus des boutons. S\'il manque, l\'appli le demande au moment de noter.', 4500);
    await legende('Une fois l\'exercice choisi, les boutons notent l\'exercice : NA, ECA ou A.', 4000);
    await legende('L\'état du critère s\'affiche à part, sous son nom, et celui de la compétence à côté de son titre.', 4000);
    await legende('Seul un exercice de maîtrise, comme celui-ci, fait passer le critère à « Acquis ».', 3500);
    await legende('Votre nom et la date s\'affichent sous le critère.', 3000);

    await legende('Le palmage de sustentation est en cours, sur l\'exercice d\'initiation…', 0);
    await noter(g, 'Palmage de sustentation', 'En cours', 'Palmage de sustentation');
    await legende('… on laisse un mot pour le prochain encadrant.', 0);
    const ligne = critere(page, 'Palmage de sustentation');
    await toucher(ligne.getByRole('button', { name: 'Commenter' }), { apres: 500 });
    await saisir(ligne.locator('textarea'), 'Tient 30 s, jambes trop pliées.');
    await toucher(ligne.getByRole('button', { name: 'Enregistrer le commentaire' }), { apres: 1500 });
    await legende('Le commentaire reste affiché sous le critère.', 3000);

    await legende('Une compétence marquée « En retard » a passé l\'échéance prévue par la progression.', 3500);
    await legende('Pas de réseau ? La note est gardée sur le téléphone, « En attente d\'envoi ».', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
