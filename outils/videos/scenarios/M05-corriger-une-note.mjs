// M5 — Corriger une note et retrouver l'historique.
import { ouvrirGrille, ouvrirBloc, critere, noter } from '../grille.mjs';

export default {
  id: 'M5',
  titre: 'Corriger une note et retrouver l\'historique',
  compte: 'e2@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, choisirDerniereSeance } = g;

    await ouvrirGrille(g, 'Anis Dulac');
    await legende('Séance du jour choisie, comme d\'habitude.', 0);
    await choisirDerniereSeance();

    await ouvrirBloc(g, 'Évoluer dans l\'eau - Se ventiler');
    await critere(page, 'Vidage du masque').scrollIntoViewIfNeeded();
    await legende('Le vidage de masque était « en cours », avec un commentaire de Tiago.', 3500);
    await legende('Anis l\'a réussi ce soir : on le passe en acquis.', 0);
    await noter(g, 'Vidage du masque', 'Acquis');

    await legende('Rien n\'est jamais effacé : chaque note s\'ajoute à l\'historique.', 0);
    const ligne = critere(page, 'Vidage du masque');
    await toucher(ligne.getByRole('button', { name: 'Voir l’historique' }), { apres: 1500 });
    await legende('Qui a noté quoi, et quand. Utile pour le suivi… et pour le prochain encadrant.', 4000);
    await toucher(ligne.getByRole('button', { name: 'Masquer l’historique' }), { apres: 600 });

    await legende('Et si on se trompe de ligne ?', 0);
    await noter(g, 'Lâcher et reprise d\'embout', 'Acquis');
    await legende('Il suffit de toucher le bon état : la correction s\'ajoute à la suite.', 0);
    await noter(g, 'Lâcher et reprise d\'embout', 'Non abordé');
    const autre = critere(page, 'Lâcher et reprise d\'embout');
    await toucher(autre.getByRole('button', { name: 'Voir l’historique' }), { apres: 1200 });
    await autre.locator('.historique .entree-historique').last()
      .evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    await pause(1000);
    await legende('L\'erreur et sa correction restent visibles : c\'est voulu.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
