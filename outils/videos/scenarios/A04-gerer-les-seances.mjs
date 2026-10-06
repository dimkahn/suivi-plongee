// A4 — Gérer les séances à la main.
// Tournage du 2026-10-06 (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'A4',
  titre: 'Gérer les séances à la main',
  public: 'Administrateur',
  resume: 'Ajouter une séance exceptionnelle, la modifier, voir le calendrier et le programme du mois.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, saisir, dater, choisir, administration, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await administration('Séances');
    await legende('Chaque séance porte le programme de la progression du mois.', 3500);
    await legende('Une séance en plus : « Nouvelle séance ».', 0);
    await toucher(page.getByRole('button', { name: 'Nouvelle séance' }));
    await dater('#date', '2027-03-13');
    await choisir('#milieu', 'Piscine / fosse', { exact: false });
    await saisir('#lieu', 'Fosse');
    await saisir('#profondeur', '10');
    await saisir('#commentaire', 'Samedi matin : préparation au milieu naturel.');
    await vignette();
    await toucher(page.getByRole('button', { name: 'Créer la séance' }), { apres: 1800 });
    await legende('Milieu et profondeur se figent dès qu\'une présence ou une note y est rattachée.', 4000);
    await legende('« Exercices » ouvre le programme de la séance, préparé groupe par groupe par les encadrants.', 4000);
    await legende('La vue « Calendrier » montre le mois d\'un coup d\'œil.', 0);
    await toucher(page.getByRole('button', { name: 'Calendrier' }), { apres: 2500 });
    await legende('« Séjour de plongée » crée d\'un coup les plongées d\'un séjour (voir « Organiser une sortie »).', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
