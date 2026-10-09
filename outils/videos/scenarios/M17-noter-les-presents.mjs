// M17 — Noter les présents en une fois, depuis la feuille de présence.
// Tournage du 2026-10-09, 2e série (changer cette date dans tous les scénarios les fait tous retourner).
// Séance du lundi 21 septembre en piscine : les présences y sont déjà
// (données de démo), l'appel du 28 reste à M3.
import { critere } from '../grille.mjs';

export default {
  id: 'M17',
  titre: 'Noter les présents en une fois',
  public: 'Moniteur',
  resume: 'Tout le groupe a travaillé le même exercice : une seule notation pour tous les présents, un commentaire par critère.',
  compte: 'e2@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, saisir, menu, vignette } = g;

    await page.goto(`${process.env.APPLI ?? 'http://localhost:4200'}/eleves`);
    await pause(1000);
    await legende('Tout le groupe a fait le même exercice ? Notez-le en une fois, depuis « Présences ».', 0);
    await menu('Présences');

    await legende('Choisissez la séance : ici, la piscine du lundi 21 septembre.', 0);
    await toucher(page.locator('button#seance'), { apres: 900 });
    const calendrier = page.locator('dialog[open]');
    const jour = calendrier.locator('button.jour:not(.hors-mois)')
      .filter({ has: page.locator('.numero').getByText('21', { exact: true }) });
    await toucher(jour, { apres: 900 });
    await toucher(calendrier.locator('.seances-du-jour button').first(), { apres: 1200 });

    await legende('Filtrez sur votre groupe, puis faites l\'appel si ce n\'est pas déjà fait.', 0);
    await toucher(page.getByRole('button', { name: 'Débutants', exact: true }), { apres: 1500 });

    await legende('Touchez « Noter les présents ».', 0);
    await toucher(page.getByRole('button', { name: 'Noter les présents' }), { apres: 1500 });
    const dialogue = page.locator('dialog[open]');

    await legende('Les présents du groupe sont tous cochés. Décochez celui qui n\'a pas fait l\'exercice.', 4000);
    await vignette();

    await legende('Votre groupe a préparé la séance ? Un bouton coche d\'un coup les critères de ses exercices.', 4000);
    await legende('Sinon, cochez le ou les critères travaillés. Les blocs « Au programme » du mois viennent en premier.', 0);
    await cocherCritere(g, dialogue, 'Palmage ventral en surface');
    await legende('Chaque critère coché demande son commentaire : il s\'ajoutera à la fiche de chaque élève.', 0);
    await saisir(dialogue.getByLabel('Commentaire : Palmage ventral en surface'), '200 m sans s\'arrêter, bon rythme.');
    await pause(800);

    await legende('Un deuxième critère ? Même chose, avec son propre commentaire.', 0);
    await cocherCritere(g, dialogue, 'Vidage du masque');
    await legende('Tant qu\'un commentaire manque, « Valider la notation » reste grisé.', 3000);
    await saisir(dialogue.getByLabel('Commentaire : Vidage du masque'), 'Masque à moitié plein, à genoux au fond.');
    await pause(800);

    await legende('Rien ne recule : un critère acquis reste acquis, un critère en cours reste en cours.', 4000);
    await legende('Un critère non abordé passe « en cours ». Le commentaire s\'ajoute dans tous les cas.', 4000);
    await legende('La notation groupée demande le réseau.', 0);
    await toucher(dialogue.getByRole('button', { name: 'Valider la notation' }), { apres: 2000 });
    await legende('Le bilan s\'affiche en haut de la feuille de présence.', 0);
    await page.getByText(/^Notation enregistrée pour/).scrollIntoViewIfNeeded();
    await pause(3500);

    await legende('Dans la fiche de Hugo, le vidage de masque est passé « en cours », avec le commentaire.', 0);
    await page.goto(`${process.env.APPLI ?? 'http://localhost:4200'}/eleves`);
    await pause(1200);
    await toucher(page.getByRole('link', { name: 'Hugo Lemaire' }), { apres: 1800 });
    await toucher(page.getByRole('button', { name: 'Tout ouvrir' }), { apres: 1200 });
    await critere(page, 'Vidage du masque').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy({ top: 150, behavior: 'smooth' }));
    await pause(3500);
    await legende('Pour noter un élève à part, sa grille reste là, comme avant.', 3500);
    await legende(null, 0);
    await pause(500);
  }
};

/** Coche un critère dans « Noter les présents », en ouvrant son bloc s'il est fermé. */
async function cocherCritere({ page, toucher }, dialogue, savoirFaire) {
  const bloc = dialogue.locator('details.bloc').filter({ has: page.getByText(savoirFaire, { exact: true }) });
  if (!(await bloc.evaluate(el => el.open))) await toucher(bloc.locator('summary'), { apres: 700 });
  await toucher(bloc.locator('label').filter({ hasText: savoirFaire }).locator('input'), { apres: 700 });
}
