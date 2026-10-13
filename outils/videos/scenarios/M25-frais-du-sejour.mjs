// M25 — Moniteur du séjour : saisir une dépense, pour soi ou pour un élève, avec la photo de la note.
// Tournage du 2026-10-13, 12e série (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'M25',
  titre: 'Noter une dépense du séjour',
  public: 'Moniteur',
  resume: 'Inscrit au séjour, le moniteur note ce qu\'il a payé, ou ce qu\'un élève a payé, avec la photo de la note.',
  compte: 'e2@club.fr',

  async jouer({ page, pause, legende, toucher, saisir, choisir, menu, vignette }) {
    await page.goto(`${APPLI}/aujourdhui`);
    await pause(1000);
    await legende('Flora part au séjour à Port-Cros. « Plus », puis « Séjours ».', 0);
    await menu('Séjours');
    await toucher(page.locator('main a').filter({ hasText: 'Séjour à Port-Cros' }).first(), { apres: 1500 });
    await legende('« Frais » : les dépenses de chacun et qui doit combien à qui.', 0);
    await toucher(page.getByRole('tab', { name: 'Frais' }), { apres: 2500 });

    await legende('Camille, élève, a payé les glaces : elle donne la note à Flora, qui la saisit pour elle.', 0);
    await toucher(page.getByRole('button', { name: 'Ajouter une dépense' }), { apres: 900 });
    await saisir('#d-libelle', 'Glaces sur le port');
    await saisir('#d-montant', '18,00');
    await choisir('#d-payeur', 'Camille Berthier');
    await legende('« Prendre une photo » ouvre l\'appareil photo sur la note ; « Choisir dans mes photos », la galerie du téléphone.', 4500);
    await legende('Partagée entre tout le monde, ou seulement ceux qui en ont profité.', 0);
    await toucher(page.getByRole('button', { name: 'Les plongeurs' }), { apres: 1500 });
    await vignette();
    await toucher(page.getByRole('button', { name: 'Enregistrer' }), { apres: 2000 });
    await legende('Les comptes se recalculent aussitôt. Flora ne modifie que ce qu\'elle a saisi.', 4000);
    await legende('Les participants qui ne sont pas moniteurs reçoivent un lien et un code par e-mail pour noter les leurs.', 4500);
    await legende(null, 0);
    await pause(500);
  }
};
