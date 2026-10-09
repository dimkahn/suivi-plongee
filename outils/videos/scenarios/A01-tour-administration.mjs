// A1 — Tour de l'administration.
// Tournage du 2026-10-09, 2e série (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'A1',
  titre: 'Tour de l\'administration',
  public: 'Administrateur',
  resume: 'Ce que contient chaque écran d\'administration, et dans quel ordre s\'en servir en début de saison.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, menu, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1200);
    await legende('Un compte administrateur voit tout ce que voit un moniteur, plus « Administration ».', 0);
    await menu('Administration');
    await vignette();
    const cartes = [
      ['Moniteurs', 'Les comptes des encadrants : niveau, rôles, CACI.'],
      ['Élèves', 'Les dossiers : autorisations, droit à l\'image, photo, tailles de matériel.'],
      ['Saisons', 'Ouvrir la saison, choisir les progressions suivies.'],
      ['Séances', 'Le calendrier : à la main, ou toute l\'année d\'un coup.'],
      ['Inscriptions', 'Qui prépare quel niveau, dans quel groupe.'],
      ['Groupes d\'entraînement', 'Les groupes du lundi soir, leurs référents, leurs encadrants et leur ligne d\'eau.'],
      ['Planning du bassin', 'Soir par soir : où va chaque groupe.'],
      ['Sorties', 'Les week-ends et séjours en milieu naturel.'],
      ['Référentiel MFT', 'Les compétences fédérales, niveau par niveau.'],
      ['Progressions types', 'L\'année de chaque niveau découpée en périodes.']
    ];
    for (const [carte, texte] of cartes) {
      const el = page.locator('main a').filter({ hasText: carte }).first();
      await el.scrollIntoViewIfNeeded();
      await el.hover();
      await legende(`${carte} : ${texte}`, 3000);
    }
    await legende('En début de saison : saison, séances, élèves et inscriptions, groupes, planning.', 4500);
    await legende(null, 0);
    await pause(500);
  }
};
