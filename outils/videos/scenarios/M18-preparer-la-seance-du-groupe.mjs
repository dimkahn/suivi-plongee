// M18 — Préparer la séance de son groupe : le programme d'exercices.
// Tournage du 2026-10-12, 12e série (changer cette date dans tous les scénarios les fait tous retourner).
// Séance du lundi 21 septembre en piscine, comme M17 : Hugo Lemaire (groupe
// Débutants) y est noté présent dans les données de démo. e2 est référent
// des Débutants : leur programme est le sien ; celui de « Prépa N2 » ne
// s'ouvre qu'en lecture.
import { ouvrirGrille, critere } from '../grille.mjs';

export default {
  id: 'M18',
  titre: 'Préparer la séance de son groupe',
  public: 'Moniteur',
  resume: 'Chaque groupe prépare ses exercices et les critères qu\'ils font travailler ; la fiche de chaque élève les reprend.',
  compte: 'e2@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, saisir, choisir, menu, vignette, choisirSeanceDu } = g;

    await page.goto(`${process.env.APPLI ?? 'http://localhost:4200'}/eleves`);
    await pause(1000);
    await legende('Chaque groupe d\'entraînement prépare sa séance. Tout part de « Présences ».', 0);
    await menu('Présences');

    await legende('Choisissez la séance : ici, la piscine du lundi 21 septembre.', 0);
    await choisirSeanceDu('21/09/2026');
    await legende('Filtrez sur votre groupe.', 0);
    await toucher(page.getByRole('button', { name: 'Débutants', exact: true }), { apres: 1200 });

    await legende('Sous le programme du mois, « Exercices de la séance ». Touchez « Préparer le programme ».', 0);
    await toucher(page.getByRole('link', { name: 'Préparer le programme' }), { apres: 1800 });

    await legende('Votre groupe est déjà choisi. Les autres groupes et le programme commun sont à côté.', 4000);

    await legende('On part des exercices des compétences : « + Ajouter des exercices des compétences ».', 0);
    await toucher(page.getByRole('button', { name: '+ Ajouter des exercices des compétences' }), { apres: 1200 });
    const base = page.locator('dialog[open]');
    const parCompetence = base.getByRole('button', { name: 'Par compétence', exact: true });
    if (await parCompetence.count() > 0) {
      await legende('La formation du groupe est proposée d\'office, avec les exercices que le parcours prévoit ce mois-ci.', 4500);
      await legende('On peut aussi chercher par compétence.', 0);
      await toucher(parCompetence, { apres: 1000 });
    }
    await legende('La formation que prépare le groupe est proposée d\'office. Choisissez la compétence…', 0);
    await choisir(base.locator('#base-competence'), 'Évoluer dans l\'eau - Se ventiler', { exact: false });
    await legende('… puis le temps : initiation, perfectionnement ou maîtrise.', 0);
    await toucher(base.getByRole('button', { name: 'Initiation', exact: true }), { apres: 900 });
    await toucher(base.locator('label').filter({ hasText: 'Vidage de masque, paliers 1 à 3' }).locator('input'), { apres: 900 });
    await toucher(base.getByRole('button', { name: /^Ajouter \d+ exercice/ }), { apres: 1500 });
    let exercice = page.locator('li.exercice').last();
    await legende('L\'exercice arrive avec son numéro, ses critères, son déroulement et son critère de réussite.', 4000);
    await legende('« Fiche complète » ouvre ses conseils, ses photos et ses vidéos.', 3000);
    await saisir(exercice.getByLabel('Durée (min)'), '15');

    await legende('Pour la nage ou l\'échauffement : un exercice libre.', 0);
    await toucher(page.getByRole('button', { name: /^\+ Exercice libre/ }), { apres: 900 });
    exercice = page.locator('li.exercice').last();
    await saisir(exercice.getByLabel('Intitulé de l\'exercice 2'), 'Palmage 200 m');
    await toucher(exercice.getByRole('button', { name: 'Perfectionnement', exact: true }), { apres: 700 });
    await toucher(exercice.getByRole('button', { name: 'Choisir les critères' }), { apres: 1200 });
    await cocherCritere(g, exercice, 'Palmage ventral en surface');
    await toucher(exercice.getByRole('button', { name: 'Fermer la liste des critères' }), { apres: 900 });
    await legende('Avec une phase et des critères, il sert aussi à noter.', 3000);
    await legende('Monter, descendre, supprimer : l\'ordre est celui de la séance.', 3000);
    await vignette();

    await legende('Enregistrez. Préparer un programme ne note aucun élève.', 0);
    await toucher(page.getByRole('button', { name: 'Enregistrer le programme' }), { apres: 1500 });
    await page.getByText('Programme enregistré.').scrollIntoViewIfNeeded();
    await pause(2000);

    await legende('Le programme d\'un autre groupe se consulte, mais seuls ses encadrants le préparent.', 0);
    await toucher(page.locator('.programmes').getByRole('button', { name: /^Prépa N2/ }), { apres: 2500 });
    await legende('Le programme commun sert à toute la séance : échauffement, sortie sans groupes.', 3500);

    await legende('Dans la fiche de Hugo, du groupe Débutants, choisissez la séance du 21 septembre.', 0);
    await ouvrirGrille(g, 'Hugo Lemaire');
    await choisirSeanceDu('21/09/2026');
    await legende('Les exercices de son groupe s\'affichent avec la séance, et sous chacun les critères à évaluer.', 0);
    await page.locator('section.exercices-seance').scrollIntoViewIfNeeded();
    await pause(1500);
    await page.locator('.criteres-exercice').first().scrollIntoViewIfNeeded();
    await pause(3000);
    await legende('On note directement l\'exercice : NA non abordé, ECA en cours d\'acquisition ou A acquis. Les boutons montrent où en est l\'élève dans cet exercice.', 5000);
    await legende('L\'état de la compétence est rappelé à côté de son nom : non travaillée, en cours d\'acquisition ou acquise.', 4000);
    await legende('« Commenter » et « Voir l\'historique » sont là aussi.', 3000);
    await legende('Les mêmes critères restent dans leur compétence, plus bas.', 0);
    await toucher(page.getByRole('button', { name: /^Ouvrir (les \d+ compétences travaillées|la compétence travaillée)$/ }), { apres: 1200 });
    await legende('Ils y portent le nom de l\'exercice.', 0);
    await critere(page, 'Vidage du masque').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy({ top: 120, behavior: 'smooth' }));
    await pause(3500);
    await legende('Dans « Noter les présents », un bouton coche d\'un coup les critères des exercices.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};

/** Coche un critère dans la liste de l'exercice, en ouvrant son bloc s'il est fermé. */
async function cocherCritere({ page, toucher }, exercice, savoirFaire) {
  const bloc = exercice.locator('details.bloc-choix').filter({ has: page.getByText(savoirFaire, { exact: true }) });
  if (!(await bloc.evaluate(el => el.open))) await toucher(bloc.locator('summary'), { apres: 700 });
  await toucher(bloc.locator('label').filter({ hasText: savoirFaire }).locator('input'), { apres: 700 });
}
