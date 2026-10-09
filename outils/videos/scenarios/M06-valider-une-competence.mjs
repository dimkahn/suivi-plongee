// M6 — Valider une compétence (un bloc entier).
// Tournage du 2026-10-09, 3e série (changer cette date dans tous les scénarios les fait tous retourner).
import { ouvrirGrille, ouvrirBloc, bloc, critere, noter } from '../grille.mjs';

export default {
  id: 'M6',
  titre: 'Valider une compétence',
  public: 'Moniteur',
  resume: 'Valider un bloc de compétences quand tous ses critères sont acquis, et comprendre les refus.',
  compte: 'e2@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, choisirDerniereSeance } = g;

    await ouvrirGrille(g, 'Anis Dulac');
    await choisirDerniereSeance();

    await ouvrirBloc(g, 'S\'équiper et se déséquiper');
    await bloc(page, 'S\'équiper et se déséquiper').scrollIntoViewIfNeeded();
    await legende('Une compétence regroupe plusieurs critères. Ici, deux sur trois sont acquis.', 4000);

    await legende('Anis a choisi et réglé son matériel seul : dernier critère acquis.', 0);
    await noter(g, 'Choix de son matériel personnel', 'Acquis', 'Matériel personnel et lestage adapté');

    const b = bloc(page, 'S\'équiper et se déséquiper');
    await b.scrollIntoViewIfNeeded();
    await legende('Tous les critères sont acquis : le bouton « Valider la compétence » apparaît.', 3500);
    await toucher(b.getByRole('button', { name: 'Valider la compétence' }), { apres: 2000 });
    await b.scrollIntoViewIfNeeded();
    await legende('Validée, avec la date et votre nom. Les critères de ce bloc ne se modifient plus.', 4500);

    await legende('Le serveur vérifie les règles du MFT : certaines validations seront refusées, avec la raison.', 4500);
    await legende('Par exemple, au N2 et au N3, tout se valide en milieu naturel.', 0);
    await ouvrirGrille(g, 'Camille Berthier');
    await page.locator('.alerte', { hasText: 'milieu naturel' }).scrollIntoViewIfNeeded();
    await pause(4000);
    await legende('Vous ne notez que les niveaux de votre encadrement : E1 le N1, E2 jusqu\'au N2, E3 jusqu\'au N3.', 4500);
    await legende(null, 0);
    await pause(500);
  }
};
