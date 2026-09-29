// M9 — Travailler sans réseau au bord du bassin.
import { APPLI } from '../commun.mjs';
import { critere } from '../grille.mjs';

export default {
  id: 'M9',
  titre: 'Travailler sans réseau au bord du bassin',
  public: 'Moniteur',
  resume: 'Préparer le téléphone avant de partir, noter sans réseau, et laisser l\'appli tout envoyer au retour.',
  compte: 'e2@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, menu, reseau, vignette, choisirDerniereSeance, defiler } = g;
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await legende('Pas de réseau à la piscine ? Avant de partir, avec du réseau : menu, « Préparer hors ligne ».', 0);
    await menu('Préparer hors ligne');
    await page.locator('app-bandeau-sync').getByText(/Disponibles hors ligne/).waitFor({ timeout: 30000 });
    await legende('Grilles, feuilles de présence, fiches de sécurité et planning sont sur le téléphone.', 4500);

    // Ouvre une fois les écrans en ligne : le code de chaque écran est ainsi
    // déjà chargé quand le réseau disparaît (comme après une première visite).
    await toucher(page.getByRole('link', { name: 'Léa Morel' }), { apres: 1200 });
    await page.goBack();
    await pause(800);

    await legende('Au bord du bassin : plus de réseau.', 0);
    await reseau(false);
    await pause(1500);
    await legende('L\'appli s\'ouvre quand même : on retrouve la grille de Léa.', 0);
    await toucher(page.getByRole('link', { name: 'Léa Morel' }), { apres: 1800 });
    await legende('« Grille consultée hors ligne » : la version embarquée avant de partir.', 3500);
    await choisirDerniereSeance();
    await toucher(page.getByRole('button', { name: /^Ouvrir les \d+ blocs au programme$/ }), { apres: 1000 });
    await legende('On note comme d\'habitude…', 0);
    const ligne = critere(page, 'Palmage dorsal');
    await toucher(ligne.locator('.etats').getByRole('button', { name: 'Acquis', exact: true }), { apres: 1500 });
    await legende('… la note attend sur le téléphone : « En attente d\'envoi ».', 3500);
    await vignette();
    await page.locator('app-bandeau-sync').scrollIntoViewIfNeeded().catch(() => {});
    await legende('Le bandeau en haut compte les saisies qui attendent.', 3500);

    await legende('De retour au vestiaire, le réseau revient…', 0);
    await reseau(true);
    await pause(4000);
    await ligne.scrollIntoViewIfNeeded();
    await legende('… et tout part tout seul. Rien à faire.', 4000);
    await legende('Si le serveur refuse une note (règle du MFT), un bandeau le dit : rien ne se perd en silence.', 5000);
    await legende(null, 0);
    await pause(500);
  }
};
