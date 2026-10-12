// A1 — Tour de l'administration.
// Tournage du 2026-10-12, 13e série (changer cette date dans tous les scénarios les fait tous retourner).
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
    await legende('Les écrans sont rangés par moment de l\'année.', 3000);
    const rubriques = [
      ['Début de saison', 'Début de saison, dans l\'ordre : la saison, ses séances, les inscriptions, puis les groupes.', [
        ['Saisons', 'Ouvrir la saison, choisir les progressions suivies.'],
        ['Séances', 'Le calendrier : à la main, ou toute l\'année d\'un coup.'],
        ['Inscriptions', 'Qui prépare quel niveau, dans quel groupe.'],
        ['Groupes d\'entraînement', 'Les groupes du lundi soir, leurs référents, leurs encadrants et leur ligne d\'eau.']
      ]],
      ['Chaque semaine', 'Chaque semaine : les soirées au bassin et les sorties.', [
        ['Planning du bassin', 'Soir par soir : où va chaque groupe.'],
        ['Sorties', 'Les week-ends et séjours en milieu naturel.']
      ]],
      ['Personnes', 'Les personnes :', [
        ['Moniteurs', 'Les comptes des encadrants : niveau, rôles, CACI.'],
        ['Élèves', 'Les dossiers : autorisations, droit à l\'image, photo, tailles de matériel.']
      ]],
      ['Contenu pédagogique', 'Puis le contenu pédagogique, qui se règle rarement :', [
        ['Référentiel MFT', 'Les compétences fédérales, niveau par niveau.'],
        ['Progressions types', 'Chaque niveau découpé en périodes de mois, ou en plongées pour un stage en mer.']
      ]],
      ['Structure', 'Enfin la structure, réglée une fois à l\'installation :', [
        ['Identité de la structure', 'Le nom, le logo et les couleurs du club, jusque sur les documents.']
      ]]
    ];
    for (const [titre, phrase, cartes] of rubriques) {
      await page.getByRole('heading', { name: titre, exact: true }).scrollIntoViewIfNeeded();
      await legende(phrase, 2500);
      for (const [carte, texte] of cartes) {
        const el = page.locator('main a').filter({ hasText: carte }).first();
        await el.scrollIntoViewIfNeeded();
        await el.hover();
        await legende(`${carte} : ${texte}`, 3000);
      }
    }
    await legende(null, 0);
    await pause(500);
  }
};
