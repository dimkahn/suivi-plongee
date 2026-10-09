// M10 — Établir une fiche de sécurité avant la mise à l'eau.
// Tournage du 2026-10-09, 2e série (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'M10',
  titre: 'Établir une fiche de sécurité',
  public: 'Moniteur',
  resume: 'Avant la mise à l\'eau : directeur de plongée, conditions, palanquées et plongeurs.',
  compte: 'e2@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, saisir, menu, rechercherEtChoisir, suggestion, vignette, defiler } = g;
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await legende('Menu, « Fiches de sécurité » : les séances en milieu naturel ou à plus de 6 m.', 0);
    await menu('Fiches de sécurité');
    await legende('On retrouve la séance par sa date.', 0);
    await toucher(page.locator('#filtre-date'), { apres: 900 });
    const dialogue = page.locator('dialog[open]');
    await toucher(dialogue.locator('button.jour[aria-label*="séance"]:not([disabled])').first(), { apres: 1200 });
    await page.keyboard.press('Escape').catch(() => {});
    await pause(600);
    await toucher(page.getByRole('link', { name: 'Établir la fiche' }).first(), { apres: 1800 });

    await legende('Le directeur de plongée : seuls les E3 et E4 sont proposés.', 0);
    await rechercherEtChoisir('dp', 'Gwen', 'Gwendoline');
    await legende('Les conditions du jour…', 0);
    await saisir('#temperatureEau', '27 degrés');
    await saisir('#securiteSurface', 'Maître-nageur au bord, trousse de secours au poste.');
    await saisir('#planSecours', 'SAMU (15), DAE à l\'accueil de la piscine.');

    const palanquee = page.locator('section.carte')
      .filter({ has: page.getByRole('heading', { name: 'Palanquée 1', exact: true }) });
    await palanquee.scrollIntoViewIfNeeded();
    await legende('Puis les palanquées : une est prête, « + Palanquée » en ajoute d\'autres.', 0);
    await saisir(palanquee.getByLabel('Profondeur prévue (m)'), '6');
    await saisir(palanquee.getByLabel('Durée prévue (min)'), '20');
    await legende('Un plongeur du club : son aptitude et son niveau préparé se remplissent seuls.', 0);
    await toucher(palanquee.getByRole('button', { name: '+ Plongeur' }), { apres: 600 });
    await suggestion(palanquee.locator('.selecteur-connu').last(), 'Léa');
    await toucher(palanquee.getByRole('button', { name: '+ Plongeur' }), { apres: 600 });
    await suggestion(palanquee.locator('.selecteur-connu').last(), 'Flora');
    await palanquee.locator('select').last().selectOption('ENCADRANT');
    await pause(1200);
    await vignette();

    await legende('Enregistrez : la fiche est gardée, même sans réseau, et le DP la retrouve.', 0);
    await toucher(page.getByRole('button', { name: 'Enregistrer la fiche' }), { apres: 2000 });
    await legende('Au retour de plongée, on la complète : c\'est la vidéo suivante.', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
