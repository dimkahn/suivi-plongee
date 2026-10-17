// M12 — Groupes de plongeurs pour un séjour.
// Tournage du 2026-10-17, 15e série, trois niveaux par plongeur (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'M12',
  titre: 'Groupes de plongeurs pour un séjour',
  public: 'Moniteur',
  resume: 'Saisir une fois les plongeurs d\'un séjour (ceux du club d\'un geste, un extérieur en quelques champs), puis reprendre le groupe dans chaque fiche de sécurité. Seuls le créateur de la liste et les organisateurs qu\'il désigne la modifient.',
  compte: 'e2@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, saisir, menu, rechercherEtChoisir, vignette } = g;
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await legende('Un séjour, c\'est plusieurs plongées avec les mêmes plongeurs. « Plus », puis « Séjours ».', 0);
    await menu('Séjours');
    await legende('En haut de la page : « Groupes de plongeurs ».', 0);
    await toucher(page.getByRole('link', { name: /Groupes de plongeurs/ }), { apres: 1200 });
    await legende('On saisit la liste une seule fois : « Nouveau groupe ».', 0);
    await toucher(page.getByRole('button', { name: 'Nouveau groupe' }), { apres: 800 });
    await saisir('#nom-groupe', 'Séjour mer — mai 2027');

    await legende('Un plongeur du club se cherche en haut : ses niveaux et son e-mail viennent de son dossier.', 0);
    for (const prenom of ['Camille', 'Mateo', 'Flora']) {
      await rechercherEtChoisir('ajout-connu', prenom);
    }
    await legende('Chacun tient sur une ligne, le dernier ajouté en tête de liste.', 3500);

    await legende('Un plongeur d\'un autre club : « + Plongeur extérieur au club », sa ligne s\'ouvre en tête.', 0);
    await toucher(page.getByRole('button', { name: '+ Plongeur extérieur au club' }), { apres: 600 });
    const detail = page.locator('.detail-membre').first();
    await saisir(detail.getByLabel('Prénom'), 'Anis');
    await saisir(detail.getByLabel('Nom', { exact: true }), 'Ferry');
    await legende('Trois niveaux à part : niveau de plongeur, niveau d\'encadrement, niveau préparé.', 0);
    await saisir(detail.getByLabel('Niveau de plongeur'), 'N4');
    await saisir(detail.getByLabel('Niveau d\'encadrement'), 'E1');
    await saisir(detail.getByLabel('Niveau préparé'), 'E2');
    await saisir(detail.getByLabel('E-mail'), 'anis.ferry@exemple.fr');
    await toucher(page.getByRole('button', { name: /^Fermer le détail de Anis/ }), { apres: 800 });
    await vignette();
    await toucher(page.getByRole('button', { name: 'Créer le groupe' }), { apres: 1800 });

    await legende('Vous en êtes le créateur : vous seul, et les organisateurs que vous choisissez, la modifiez.', 0);
    await toucher(page.getByRole('button', { name: 'Choisir les organisateurs' }).last(), { apres: 2500 });
    await toucher(page.getByRole('button', { name: 'Annuler' }), { apres: 800 });
    await legende('Les autres moniteurs la voient en lecture seule et la reprennent dans leurs fiches de sécurité.', 4500);
    await legende('Dans chaque fiche de sécurité du séjour, choisissez ce groupe : ses plongeurs arrivent d\'un coup.', 4500);
    await legende('Inscrit au séjour, chaque plongeur y reste lié : son nom ou son e-mail corrigé ici l\'est aussi dans le séjour.', 4500);
    await legende(null, 0);
    await pause(500);
  }
};
