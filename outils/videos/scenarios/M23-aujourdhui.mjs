// M23 — La page « Aujourd'hui » : la séance du jour en un coup d'œil.
// Tournage du 2026-10-12, 12e série (changer cette date dans tous les scénarios les fait tous retourner).
// La page montre la séance du jour du tournage, ou la prochaine : le texte
// ne cite ni date ni lieu, et chaque geste vérifie que son bouton existe.
export default {
  id: 'M23',
  titre: 'La page « Aujourd\'hui »',
  public: 'Moniteur',
  resume: 'En ouvrant l\'appli : où va son groupe au bassin, sa réponse de présence, et de quoi faire l\'appel, préparer le programme et la fiche de sécurité.',
  compte: 'e2@club.fr',

  async jouer({ page, pause, legende, toucher, vignette, format }) {
    await page.goto(`${process.env.APPLI ?? 'http://localhost:4200'}/`);
    await pause(1500);
    await legende('En ouvrant l\'appli, « Aujourd\'hui » : la séance du jour, ou la prochaine.', 3500);
    await legende('Sous le titre, la date et vos groupes d\'entraînement.', 3000);
    await vignette();

    const bassin = page.locator('section', { has: page.getByRole('heading', { name: 'Au bassin' }) });
    if (await bassin.count() > 0) {
      await bassin.scrollIntoViewIfNeeded();
      await legende('« Au bassin » : la ligne d\'eau ou la fosse de votre groupe, le DP fosse et le DP piscine.', 4000);
      const present = bassin.locator('.ma-reponse').getByRole('button', { name: 'Présent' });
      if (await present.count() > 0) {
        await legende('« Vous serez là ? » : un toucher répond pour la soirée, comme dans « Planning ».', 0);
        await toucher(present, { apres: 1500 });
      }
    }

    const carte = page.locator('section.bloc-accueil', { has: page.locator('.actions') }).first();
    await carte.scrollIntoViewIfNeeded();
    await legende('Puis une carte par séance : le lundi, la piscine et la fosse.', 3500);
    if (await carte.locator('.bilan').count() > 0) {
      await legende('Le bilan de vos groupes : présents, et présents pas encore évalués.', 3500);
    }
    await legende('Programme d\'exercices, fiche de sécurité en milieu naturel : tout part d\'ici.', 3500);
    await legende('En milieu naturel, le jour même, « Compléter au retour de plongée » ouvre la saisie du profil réalisé.', 4000);
    await legende('Le premier bouton ouvre la feuille de présence de la séance, filtrée sur votre groupe.', 0);
    await toucher(carte.locator('.actions a').first(), { apres: 2500 });

    if (format === 'telephone') {
      await legende('Sur téléphone, « Aujourd\'hui » est aussi le premier onglet, en bas de l\'écran.', 0);
      await toucher(page.locator('nav.onglets').getByText('Aujourd’hui', { exact: true }), { apres: 2000 });
    } else {
      await legende('« Aujourd\'hui » est aussi la première entrée du menu, en haut.', 0);
      await toucher(page.locator('#menu-principal').getByText('Aujourd’hui', { exact: true }), { apres: 2000 });
    }
    await legende('Après « Préparer hors ligne », la page s\'ouvre même sans réseau.', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
