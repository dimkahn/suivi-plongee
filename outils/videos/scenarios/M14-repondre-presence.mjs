// M14 — Dire si je suis présent à une soirée.
// Tournage du 2026-10-03 (changer cette date dans tous les scénarios les fait tous retourner).
export default {
  id: 'M14',
  titre: 'Dire si je suis présent à une soirée',
  public: 'Moniteur',
  resume: 'Dire en un toucher si l\'on sera là aux prochaines soirées.',
  compte: 'e2@club.fr',

  async jouer({ page, pause, legende, toucher, menu }) {
    await page.goto(`${process.env.APPLI ?? 'http://localhost:4200'}/eleves`);
    await pause(1000);
    await menu('Planning');

    await legende('« Vous serez là ? » : l\'admin compose les groupes avec vos réponses.', 3500);
    await page.locator('.ma-reponse').scrollIntoViewIfNeeded();
    await legende('On voit déjà qui a répondu. Vous, pas encore.', 3000);
    await legende('Un toucher suffit.', 0);
    await toucher(page.locator('.ma-reponse').getByRole('button', { name: 'Présent' }), { apres: 1500 });
    await legende('Enregistré : votre nom rejoint la liste des présents, et passe en gras sous votre groupe.', 3500);

    await legende('Pour les soirées suivantes, répondez dans le tableau : ✓ présent, ✗ absent.', 0);
    const lignes = page.locator('.a-venir tbody tr');
    await lignes.nth(1).scrollIntoViewIfNeeded();
    await pause(1500);
    await toucher(lignes.nth(1).getByRole('button', { name: /^Présent le/ }), { apres: 900 });
    await toucher(lignes.nth(2).getByRole('button', { name: /^Absent le/ }), { apres: 900 });
    await toucher(lignes.nth(3).getByRole('button', { name: /^Présent le/ }), { apres: 1200 });
    await legende('Un empêchement ? Changez votre réponse à tout moment.', 0);
    await toucher(lignes.nth(1).getByRole('button', { name: /^Absent le/ }), { apres: 1500 });

    await legende('Sans réponse, personne ne vous suppose présent ni absent.', 3500);
    await legende('La réponse demande du réseau : elle n\'est pas gardée hors ligne.', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
