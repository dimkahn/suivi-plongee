// Repères dans la grille de compétences, partagés par les scénarios M4 à M6.

/** Ouvre la grille d'un élève depuis « Infos élèves ». */
export async function ouvrirGrille({ page, pause, toucher }, eleve) {
  await page.goto(`${process.env.APPLI ?? 'http://localhost:4200'}/eleves`);
  await pause(1200);
  await toucher(page.getByRole('link', { name: eleve }), { apres: 1800 });
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

/** Touche l'état voulu (« Non abordé », « En cours », « Acquis ») d'un critère et attend l'enregistrement. */
export async function noter({ page, pause, toucher }, savoirFaire, etat) {
  const ligne = critere(page, savoirFaire);
  await toucher(ligne.locator('.etats').getByRole('button', { name: etat, exact: true }), { apres: 300 });
  await ligne.locator('.enregistrement').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  await pause(900);
}
