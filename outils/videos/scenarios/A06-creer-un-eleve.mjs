// A6 — Créer le dossier d'un élève.
// Tournage du 2026-10-06 (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'A6',
  titre: 'Créer le dossier d\'un élève',
  public: 'Administrateur',
  resume: 'Le dossier d\'un élève : identité, CACI, contact d\'urgence, autorisation de pratiquer et droit à l\'image.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, saisir, dater, choisir, cocher, administration, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await administration('Élèves');
    await toucher(page.getByRole('button', { name: 'Nouvel élève' }));
    await saisir('#prenom', 'Nathan');
    await saisir('#nom', 'Petit');
    await dater('#naissance', '2011-02-17');
    await legende('Du certificat médical, seule la date de fin de validité est gardée : aucune donnée de santé.', 0);
    await dater('#caci', '2027-09-20');
    await saisir('#telephone', '06 00 00 00 51');
    await saisir('#contactUrgenceNom', 'Sophie Petit (mère)');
    await saisir('#contactUrgenceTelephone', '06 00 00 00 52');
    await saisir('#tailleGilet', 'S');
    await legende('Nathan est mineur : l\'autorisation du responsable légal couvre la pratique…', 0);
    await cocher(page.locator('input[name="autorisationLegale"]').first());
    await legende('… le droit à l\'image est un accord à part. Sans lui, pas de photo.', 4000);
    await vignette();
    await legende('Sa formation sera choisie à l\'inscription (vidéo suivante).', 0);
    await choisir('#saisonCreation', 'Aucune', { exact: false });
    await toucher(page.getByRole('button', { name: 'Ajouter l\'élève' }), { apres: 2000 });
    await legende('Un élève qui quitte le club s\'archive : son historique reste.', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
