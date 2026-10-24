// M25 — Moniteur du séjour : saisir une dépense, pour soi ou pour un élève, avec la photo de la note.
// Tournage du 2026-10-24, 15e série, les élèves notent aussi leurs frais (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'M25',
  titre: 'Noter une dépense du séjour',
  public: 'Moniteur',
  resume: 'Inscrit au séjour, le moniteur ouvre les frais par l\'encart en haut de la page et note ce qu\'il a payé, ou ce qu\'un élève a payé, avec la photo de la note, ou ce que le club a avancé.',
  compte: 'e2@club.fr',

  async jouer({ page, pause, legende, toucher, saisir, choisir, menu, vignette, selon }) {
    await page.goto(`${APPLI}/aujourdhui`);
    await pause(1000);
    await legende(selon({
      telephone: 'Flora part au séjour à Port-Cros. « Plus », puis « Séjours ».',
      ordinateur: 'Flora part au séjour à Port-Cros. Dans le menu en haut, « Séjours ».'
    }), 0);
    await menu('Séjours');
    await toucher(page.locator('main a').filter({ hasText: 'Séjour à Port-Cros' }).first(), { apres: 1500 });
    await legende('Tout en haut, l\'encart « Frais du séjour » : le total dépensé, et ce qu\'elle doit ou ce qu\'on lui doit.', 4000);
    await legende('« Gérer les frais » : son solde, puis qui doit combien à qui, et les dépenses.', 0);
    await toucher(page.getByRole('button', { name: 'Gérer les frais' }), { apres: 3000 });

    await legende('Camille, élève, a payé les glaces et a donné la note à Flora, qui la saisit pour elle.', 0);
    await toucher(page.getByRole('button', { name: 'Ajouter une dépense' }), { apres: 900 });
    await saisir('#d-libelle', 'Glaces sur le port');
    await saisir('#d-montant', '18,00');
    await choisir('#d-payeur', 'Camille Berthier');
    await legende(selon({
      telephone: '« Prendre une photo » ouvre l\'appareil photo sur la note ; « Choisir dans mes photos », la galerie du téléphone.',
      ordinateur: '« Choisir dans mes photos » prend une photo de la note déjà sur l\'ordinateur ; au téléphone, « Prendre une photo » ouvre l\'appareil photo.'
    }), 4500);
    await legende('L\'appli lit sur la photo le montant total, la date et la catégorie, et remplit les cases vides : on vérifie.', 4500);
    await legende('Par défaut, partagée entre tout le monde. « Choisir qui partage » : seulement ceux qui en ont profité.', 0);
    await toucher(page.getByRole('button', { name: 'Choisir qui partage' }), { apres: 1200 });
    await toucher(page.getByRole('button', { name: 'Les plongeurs' }), { apres: 1500 });
    await vignette();
    await toucher(page.getByRole('button', { name: 'Enregistrer' }), { apres: 2000 });
    await legende('Les comptes se recalculent aussitôt. Flora ne modifie que ce qu\'elle a saisi.', 4000);
    await legende('Le club a payé le gonflage des blocs ? « Payé par » : « Le club ». Chacun lui doit sa part.', 0);
    await toucher(page.getByRole('button', { name: 'Ajouter une dépense' }), { apres: 900 });
    await saisir('#d-libelle', 'Gonflage des blocs');
    await saisir('#d-montant', '36,00');
    await choisir('#d-payeur', 'Le club');
    await toucher(page.getByRole('button', { name: 'Enregistrer' }), { apres: 2500 });
    await legende('Dans « Qui doit combien à qui » : « … doit … au club ». Un moniteur du séjour note le remboursement.', 4500);
    await legende('Tous les participants, élèves compris, notent aussi ce qu\'ils ont payé : par le lien et le code reçus par e-mail.', 4500);
    await legende(null, 0);
    await pause(500);
  }
};
