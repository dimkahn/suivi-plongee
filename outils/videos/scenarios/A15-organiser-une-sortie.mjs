// A15 — Organiser une sortie.
// Tournage du 2026-11-21 : la sortie se gère dans « ⋯ Organiser » du séjour (plus de menu « Gérer la sortie ») ; 2026-11-19 : créée dans « Séjours », gérée depuis le séjour (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'A15',
  titre: 'Organiser une sortie',
  public: 'Administrateur',
  resume: 'Un week-end en mer : dates, lieu, et ses plongées créées d\'un coup.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, saisir, dater, menu, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await legende('Une sortie se crée dans « Séjours » : « Nouvelle sortie ».', 0);
    await menu('Séjours');
    await toucher(page.getByRole('button', { name: 'Nouvelle sortie' }));
    await saisir('#nom', 'Week-end en mer — Marseille');
    await saisir('#lieu', 'Marseille');
    await dater('#debut', '2027-05-15');
    await dater('#fin', '2027-05-16');
    await saisir('#remarques', 'Départ le vendredi soir, hébergement au centre UCPA.');
    await toucher(page.getByRole('button', { name: 'Créer puis choisir les plongées' }), { apres: 1800 });
    await legende('Ses plongées : deux par jour, sur le site prévu.', 0);
    const plongeesParJour = page.locator('input[id^="plongees-"]').first();
    await plongeesParJour.fill('');
    await saisir(plongeesParJour, '2');
    await saisir(page.locator('input[id^="site-"]').first(), 'Îles du Frioul');
    await saisir(page.locator('input[id^="profondeur-"]').first(), '20');
    await toucher(page.getByRole('button', { name: 'Créer les plongées' }), { apres: 1800 });
    await legende('Elles sont créées et rattachées à la sortie, en un geste, et son séjour s\'ouvre.', 3500);
    await vignette();
    await legende('Les moniteurs y établiront les fiches de sécurité ; le matériel prêté s\'y rattache.', 4500);
    await legende('En haut du séjour, « Organiser », rubrique « La sortie » : ses dates, ses plongées, ses fiches de sécurité.', 0);
    await toucher(page.locator('.ouvrir-actions'), { apres: 3500 });
    await legende('« Imprimer les fiches de sécurité » : les deux plongées du jour sur une feuille, ou une feuille par plongée. « Supprimer la sortie » est tout en bas.', 5000);
    await toucher(page.locator('dialog[open]').getByRole('button', { name: 'Fermer' }), { apres: 600 });
    await legende('Le séjour : vols, voitures, chambres, repas et programme. Voir la vidéo A17.', 4500);
    await legende('Qui crée la sortie est le créateur du séjour : lui seul le modifie, avec les organisateurs qu\'il choisit.', 4500);
    await legende(null, 0);
    await pause(500);
  }
};
