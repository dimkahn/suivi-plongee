// M24 — Le parcours de formation et la fiche d'un exercice.
// Tournage du 2026-10-19, 12e série (changer cette date dans tous les scénarios les fait tous retourner).
// Parcours N1 de la saison de démo (progression type rattachée par V107) ;
// le texte ne cite aucun exercice précis, chaque geste vérifie que son
// élément existe.
export default {
  id: 'M24',
  titre: 'Le parcours de formation',
  public: 'Moniteur',
  resume: 'L\'année de chaque niveau étape par étape, les exercices prévus de l\'initiation à la maîtrise (dont les obligatoires pour valider), et la fiche complète de chaque exercice.',
  compte: 'e2@club.fr',

  async jouer({ page, pause, legende, toucher, menu, defiler, vignette }) {
    await page.goto(`${process.env.APPLI ?? 'http://localhost:4200'}/`);
    await pause(1200);
    await legende('Quels exercices faire avec vos élèves ce mois-ci ? Menu « Plus », puis « Parcours ».', 0);
    await menu('Parcours');
    await pause(1500);
    await legende('Choisissez le niveau. La progression de la saison en cours s\'ouvre d\'office.', 3500);
    await vignette();

    const enCours = page.locator('li.periode.en-cours');
    if (await enCours.count() > 0) {
      await enCours.scrollIntoViewIfNeeded();
      await legende('Chaque étape : ses mois, son milieu, les conseils du club. Celle du mois est marquée « En ce moment ».', 4500);
    } else {
      await defiler(400, 1500);
      await legende('Chaque étape : ses mois, son milieu, les conseils du club.', 3500);
    }
    await legende('Puis ses exercices, par compétence : I initiation, P perfectionnement, M maîtrise.', 4000);
    await legende('À droite, ce que l\'exercice a déjà : schéma, photos, vidéo.', 3500);
    const obligatoire = page.locator('a.exercice .obligatoire').first();
    if (await obligatoire.count() > 0) {
      await obligatoire.scrollIntoViewIfNeeded();
      await legende('« Obligatoire pour valider » : l\'élève doit avoir acquis cet exercice de maîtrise pour valider sa compétence.', 4500);
    }

    const exercice = (await enCours.count() > 0 ? enCours : page.locator('li.periode')).locator('a.exercice').first();
    if (await exercice.count() > 0) {
      await legende('Touchez un exercice : sa fiche complète s\'ouvre.', 0);
      await toucher(exercice, { apres: 1800 });
      await legende('Les critères qu\'il travaille, son déroulement et son critère de réussite.', 4000);
      await defiler(450, 1500);
      await legende('Les conseils de l\'encadrant : points de vigilance, erreurs fréquentes, comment y remédier.', 4500);
      await defiler(450, 1500);
      await legende('Le schéma, et les photos et vidéos ajoutées par le club.', 3500);
      await defiler(600, 1500);
      await legende('Les étapes du parcours où il est prévu, et en bas l\'exercice précédent et le suivant.', 4000);
      const suivant = page.locator('nav.voisins a').last();
      if (await suivant.count() > 0) await toucher(suivant, { apres: 2000 });
    }
    await legende('La fiche s\'ouvre aussi depuis le programme de la séance et depuis la fiche de suivi d\'un élève.', 4500);
    await legende(null, 0);
    await pause(500);
  }
};
