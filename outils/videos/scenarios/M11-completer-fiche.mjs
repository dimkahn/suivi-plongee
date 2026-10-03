// M11 — Compléter la fiche après la plongée.
// Tournage du 2026-10-03 (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'M11',
  titre: 'Compléter la fiche après la plongée',
  public: 'Moniteur',
  resume: 'Au retour de plongée : heures, profondeurs, durées et paliers réalisés, palanquée par palanquée.',
  compte: 'e2@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, saisir, menu, vignette } = g;
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await menu('Fiches de sécurité');
    await legende('Dimanche, à la gravière : la fiche a été établie avant la plongée.', 0);
    await saisir('#filtre-lieu', 'Gravière');
    await pause(1200);
    const ligne = page.locator('li').filter({ hasText: '27/09/2026' }).first();
    await toucher(ligne.getByRole('link', { name: 'Compléter au retour de plongée' }), { apres: 1800 });

    await legende('Pendant la plongée, « Marquer l\'immersion » puis « Marquer la sortie » notent l\'heure.', 4500);
    await legende('Après coup, on saisit ce qui a été réalisé.', 0);
    const palanquee = n => page.locator('section.carte')
      .filter({ has: page.getByRole('heading', { name: `Palanquée ${n}`, exact: true }) });
    const p1 = palanquee(1);
    await saisir(p1.getByLabel('Profondeur réalisée (m)'), '28');
    await saisir(p1.getByLabel('Durée réalisée (min)'), '29');
    await saisir(p1.getByLabel('Paliers'), '3 min à 3 m');
    await p1.getByLabel('Immersion (correction manuelle)').fill('10:05');
    await p1.getByLabel('Sortie (correction manuelle)').fill('10:34');
    await pause(1000);
    const p2 = palanquee(2);
    await saisir(p2.getByLabel('Profondeur réalisée (m)'), '18');
    await saisir(p2.getByLabel('Durée réalisée (min)'), '33');
    await saisir(p2.getByLabel('Paliers'), '3 min à 3 m');
    await vignette();
    await toucher(page.getByRole('button', { name: 'Enregistrer les paramètres réalisés' }), { apres: 2000 });
    await legende('La fiche est complète. Elle s\'exporte en PDF ou en tableur pour les archives du club.', 4500);
    await legende(null, 0);
    await pause(500);
  }
};
