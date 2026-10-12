// A17 — Organiser un séjour : vols, voitures, chambres, repas, affaires, programme.
// Tournage du 2026-10-12, 12e série (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'A17',
  titre: 'Organiser un séjour',
  public: 'Administrateur',
  resume: 'Les vols de chacun, qui conduit quelle voiture, qui dort où, les régimes, les affaires, le programme et le partage des frais.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, saisir, dater, menu, defiler, enHaut, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await legende('Menu « Séjours » : chaque sortie a son séjour.', 0);
    await menu('Séjours');
    await toucher(page.locator('main a').filter({ hasText: 'Séjour à Port-Cros' }).first(), { apres: 1500 });
    await legende('En haut, ce qui reste à régler : ici, Mateo n\'a pas encore de chambre.', 4000);

    await legende('« Arrivées et départs » : les participants regroupés par vol ou par train, pour savoir qui aller chercher.', 0);
    await toucher(page.getByRole('tab', { name: 'Arrivées et départs' }), { apres: 3500 });
    await legende('« Voitures » : le conducteur et ses passagers, et les places qui restent.', 0);
    await toucher(page.getByRole('tab', { name: 'Voitures' }), { apres: 3500 });

    await legende('« Chambres » : le gîte, ses chambres et leurs occupants.', 0);
    await toucher(page.getByRole('tab', { name: 'Chambres' }), { apres: 1500 });
    await toucher(page.getByRole('button', { name: 'Modifier' }).first(), { apres: 1000 });
    await legende('Mateo prend la chambre 3.', 0);
    const chambre3 = page.locator('fieldset').filter({ hasText: 'Chambre 3' });
    await chambre3.scrollIntoViewIfNeeded();
    await toucher(chambre3.getByLabel('Mateo Vasquez'), { apres: 800 });
    await toucher(page.getByRole('button', { name: 'Enregistrer' }), { apres: 1800 });
    await vignette();

    await legende('« Repas » : le nombre de couverts et les régimes de chacun, pour la cuisine.', 0);
    await toucher(page.getByRole('tab', { name: 'Repas' }), { apres: 3500 });
    await legende('« Affaires » : papiers, plongée, séjour. « Partir de la liste type » la remplit d\'un coup.', 0);
    await toucher(page.getByRole('tab', { name: 'Affaires' }), { apres: 3500 });

    await legende('« Programme » : les rendez-vous, et les plongées de la sortie.', 0);
    await toucher(page.getByRole('tab', { name: 'Programme' }), { apres: 1200 });
    await toucher(page.getByRole('button', { name: 'Ajouter un rendez-vous' }), { apres: 800 });
    await dater('#e-jour', '2027-06-06');
    await saisir('#e-debut', '1900');
    await saisir('#e-titre', 'Apéritif sur la plage');
    await saisir('#e-lieu', 'Plage de l\'Almanarre');
    await toucher(page.getByRole('button', { name: 'Enregistrer' }), { apres: 1800 });
    await defiler(400, 1500);
    await enHaut();

    await legende('« Frais » : qui a avancé quoi, pour qui. L\'appli calcule qui doit combien à qui.', 0);
    await toucher(page.getByRole('tab', { name: 'Frais' }), { apres: 3500 });
    await legende('Mateo rembourse Gwendoline : « C\'est remboursé », et les comptes se mettent à jour.', 0);
    const remboursement = page.locator('.remboursement').filter({ hasText: 'Mateo' }).first();
    await toucher(remboursement.getByRole('button', { name: 'C\'est remboursé' }), { apres: 1000 });
    await toucher(page.getByRole('button', { name: 'Enregistrer' }), { apres: 2500 });
    await enHaut();
    await legende('« Envoyer le carnet par e-mail » : chacun reçoit son vol, sa voiture, sa chambre, le programme, les affaires et ses frais.', 5000);
    await legende('Pas d\'information médicale dans l\'appli : seulement des choix de table.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
