// A6 — Créer le dossier d'un élève.
// Tournage du 2026-10-19, 14e série, carte « Élèves » de l'administration, inscription au club OK / KO (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'A6',
  titre: 'Créer le dossier d\'un élève',
  public: 'Administrateur',
  resume: 'Le dossier d\'un élève : identité, CACI, contact d\'urgence, autorisation de pratiquer, droit à l\'image, et l\'inscription au club de la saison.',
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
    await legende('Du CACI, la date de l\'examen suffit : il vaut un an. Aucune donnée de santé n\'est gardée.', 0);
    await dater('#caciExamen', '2026-09-20');
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
    await legende('Sur chaque carte, l\'inscription au club de la saison : OK en vert, KO en rouge.', 3500);
    await legende('Anis a réglé son inscription : un appui sur sa pastille la passe à OK.', 0);
    await toucher(page.locator('li.carte').filter({ hasText: 'Anis Dulac' })
      .getByRole('button', { name: /Inscription .* KO/ }), { apres: 3000 });
    await legende('Le filtre « Inscription au club » retrouve ceux qui ne sont pas à jour.', 0);
    await choisir('#filtre-inscription', 'KO : pas à jour');
    await pause(3000);
    await choisir('#filtre-inscription', 'Tous');
    await legende('Un élève qui quitte le club s\'archive : son historique reste.', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
