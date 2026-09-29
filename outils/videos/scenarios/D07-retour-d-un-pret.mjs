// D7 — Retour et annulation d'un prêt.
import { APPLI } from '../commun.mjs';

export default {
  id: 'D7',
  titre: 'Retour d\'un prêt',
  public: 'Directeur technique',
  resume: 'Enregistrer le retour, signaler un incident ou mettre un équipement hors service.',
  compte: 'e3@club.fr',

  async jouer({ page, pause, legende, toucher, saisir, cocher, vignette }) {
    await page.goto(`${APPLI}/materiel/prets`);
    await pause(1200);
    await legende('Camille rapporte le matériel de son week-end.', 0);
    const pret = page.locator('li, .carte').filter({ hasText: 'Camille Berthier' }).last();
    await toucher(pret.getByRole('button', { name: 'Enregistrer le retour' }), { apres: 1200 });
    await legende('Pour chaque équipement : un incident éventuel.', 0);
    await saisir(pret.locator('input[id^="incident-"]').nth(2), 'Purge basse qui colle');
    await legende('Et si besoin, hors service : il ne sera plus proposé au prêt.', 3500);
    await vignette();
    await toucher(pret.getByRole('button', { name: 'Valider le retour' }), { apres: 2000 });
    await legende('L\'incident est inscrit au journal de l\'équipement.', 3500);
    await toucher(page.getByRole('tab', { name: 'Rendus' }), { apres: 1500 });
    await legende('Les prêts rendus restent consultables, avec leurs photos.', 3500);
    await legende('« Annuler le prêt » sert seulement à défaire une erreur de saisie, avant tout retour.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
