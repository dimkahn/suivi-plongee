// X1 — L'appli en 3 minutes.
import { APPLI } from '../commun.mjs';
import { critere } from '../grille.mjs';

export default {
  id: 'X1',
  titre: 'L\'appli en 3 minutes',
  public: 'Découverte',
  resume: 'Le tour de l\'appli pour qui la découvre : grille, présences, planning, fiches de sécurité, matériel.',
  compte: 'e3@club.fr',

  async jouer({ page, pause, legende, toucher, menu, defiler, enHaut, vignette, choisirDerniereSeance }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1200);
    await legende('L\'appli du club remplace le classeur partagé : elle se manie au téléphone, au bord du bassin.', 4000);
    await legende('« Infos élèves » : toute la saison, CACI, séances suivies.', 3500);
    await vignette();

    await legende('Un nom ouvre la grille de compétences du MFT.', 0);
    await toucher(page.getByRole('link', { name: 'Chloé Garnier' }), { apres: 1800 });
    await choisirDerniereSeance();
    await toucher(page.getByRole('button', { name: /^Ouvrir les \d+ blocs au programme$/ }), { apres: 1000 });
    const ligne = critere(page, 'Capelage et décapelage');
    await toucher(ligne.locator('.etats').getByRole('button', { name: 'Acquis', exact: true }), { apres: 1500 });
    await legende('Un toucher par critère ; les règles du MFT sont vérifiées par le serveur.', 3500);

    await legende('« Présences » : l\'appel de la séance.', 0);
    await menu('Présences');
    await pause(1500);
    await defiler(400, 1200);
    await enHaut();

    await legende('« Planning » : où va chaque groupe ce soir, et qui sera là.', 0);
    await menu('Planning');
    await pause(3000);

    await legende('« Fiches de sécurité » : la fiche du directeur de plongée, prête avant la mise à l\'eau.', 0);
    await menu('Fiches de sécurité');
    await pause(2500);

    await legende('« Matériel » : l\'inventaire, les contrôles et les prêts du club.', 0);
    await menu('Matériel');
    await pause(3000);

    await legende('Sans réseau ? « Préparer hors ligne », et tout part au retour du réseau.', 4000);
    await legende('Chaque écran a sa vidéo, rangée par rôle : moniteur, administrateur, directeur technique.', 4500);
    await legende(null, 0);
    await pause(500);
  }
};
