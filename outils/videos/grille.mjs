// Repères dans la grille de compétences, partagés par les scénarios M4 à M6.

/** Ouvre la grille d'un élève depuis « Infos élèves ». */
export async function ouvrirGrille({ page, pause, toucher }, eleve) {
  await page.goto(`${process.env.APPLI ?? 'http://localhost:4200'}/eleves`);
  await pause(1200);
  // exact : chaque case séance de la ligne est aussi un lien « Noter <élève> sur la séance du… ».
  await toucher(page.getByRole('link', { name: eleve, exact: true }), { apres: 1800 });
}

/** Le bloc dont l'intitulé est exactement `intitule`. */
export function bloc(page, intitule) {
  return page.locator('section.bloc').filter({ has: page.locator('.intitule').getByText(intitule, { exact: true }) });
}

/** La ligne du critère dont le savoir-faire est exactement `savoirFaire`. */
export function critere(page, savoirFaire) {
  return page.locator('section.bloc li').filter({ has: page.getByText(savoirFaire, { exact: true }) });
}

/** Ouvre un bloc fermé (touche son intitulé). */
export async function ouvrirBloc({ page, toucher }, intitule) {
  const b = bloc(page, intitule);
  if (!(await b.evaluate(el => el.classList.contains('ouvert')))) {
    await toucher(b.locator('.bascule-bloc'), { apres: 900 });
  }
}

/**
 * Dans la fenêtre « Exercice réalisé », touche l'exercice dont l'intitulé
 * contient `intitule`. La fenêtre ne s'ouvre que si aucun exercice n'est
 * encore choisi pour ce critère : sinon, rien à faire.
 */
export async function choisirExercice({ page, pause, toucher }, intitule) {
  const choix = page.locator('dialog[open] button.choix-exo').filter({ hasText: intitule });
  const ouverte = await choix.first().waitFor({ timeout: 3000 }).then(() => true, () => false);
  if (!ouverte) return;
  await pause(1500);
  await toucher(choix.first(), { apres: 300 });
}

/**
 * Touche l'état voulu (« Non abordé », « En cours », « Acquis ») d'un critère
 * et attend l'enregistrement. Au N1, la note porte sur un exercice (choix du
 * club, 2026) : `exercice` est l'intitulé de l'exercice réalisé, choisi dans
 * la fenêtre qui s'ouvre ; seul un exercice de maîtrise rend le critère acquis.
 */
export async function noter(g, savoirFaire, etat, exercice = null) {
  const { page, pause, toucher } = g;
  const ligne = critere(page, savoirFaire);
  await toucher(ligne.locator('.etats').getByRole('button', { name: etat, exact: true }), { apres: 300 });
  if (exercice) await choisirExercice(g, exercice);
  await ligne.locator('.enregistrement').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  await pause(900);
}
