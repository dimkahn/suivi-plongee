// M19 — N2 et N3 : l'entraînement en piscine et fosse, à part de l'évaluation en milieu naturel.
// Tournage du 2026-10-05 (changer cette date dans tous les scénarios les fait tous retourner).
// Camille (N2) : week-end à la Gravière du Fort les 26-27/09 (V107), fosse
// les lundis de septembre, notée à l'entraînement par Gwendoline (V113).
import { ouvrirGrille, ouvrirBloc, critere, noter } from '../grille.mjs';

const BLOC = 'S\'équiper et se déséquiper - Se mettre à l\'eau et en sortir';

export default {
  id: 'M19',
  titre: 'N2 et N3 : fosse et milieu naturel',
  public: 'Moniteur',
  resume: 'Suivre les exercices d\'un N2 ou d\'un N3 en piscine et en fosse, à part de l\'évaluation en milieu naturel qui fait acquérir les compétences.',
  compte: 'e3@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, vignette } = g;

    await legende('Au N2 et au N3, les compétences s\'acquièrent en milieu naturel.', 0);
    await ouvrirGrille(g, 'Camille Berthier');
    await legende('La grille tient deux suivis : l\'évaluation en milieu naturel, et l\'entraînement en piscine et en fosse.', 4500);

    await legende('Sa dernière séance est la plongée à la Gravière : les boutons notent l\'évaluation.', 0);
    await page.locator('.alerte', { hasText: 'milieu naturel' }).scrollIntoViewIfNeeded();
    await pause(3500);

    await ouvrirBloc(g, BLOC);
    const capelage = critere(page, 'Capelage et décapelage');
    await capelage.scrollIntoViewIfNeeded();
    await legende('Sous chaque critère, l\'autre suivi est rappelé : capelage acquis en fosse, encore en cours en milieu naturel.', 5000);

    await legende('Choisissez une séance en piscine ou en fosse : ici, la fosse du lundi 21 septembre.', 0);
    await toucher(page.locator('button#seance'), { apres: 900 });
    const calendrier = page.locator('dialog[open]');
    await toucher(calendrier.getByRole('button', { name: /^21\/09\/2026/ }), { apres: 1200 });

    await legende('Le bandeau bleu le dit : vous notez maintenant le suivi d\'entraînement.', 0);
    await page.locator('.alerte.entrainement').scrollIntoViewIfNeeded();
    await pause(4000);
    await vignette();

    await legende('Saut droit et bascule arrière : réussis en fosse ce soir-là.', 0);
    await critere(page, 'Saut droit et bascule arrière - Remontée à l\'échelle').scrollIntoViewIfNeeded();
    await noter(g, 'Saut droit et bascule arrière - Remontée à l\'échelle', 'Acquis');
    await legende('Acquis à l\'entraînement… mais toujours « non abordé » en milieu naturel : il reste à le montrer en plongée.', 5000);

    await legende('Chaque bloc compte les deux : acquis en milieu naturel, et en piscine ou fosse.', 0);
    await page.locator('section.bloc', { hasText: BLOC }).locator('.detail').scrollIntoViewIfNeeded();
    await pause(4000);

    await legende('Seul le milieu naturel valide une compétence et ouvre la délivrance du brevet.', 4000);
    await legende('« Noter les présents » d\'une soirée en fosse va, lui aussi, au suivi d\'entraînement.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
