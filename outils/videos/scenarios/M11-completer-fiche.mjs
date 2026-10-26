// M11 — Compléter la fiche après la plongée.
// Tournage du 2026-10-26, 18e série, recherche d'une palanquée toujours affichée,dépassement du prévu en rouge, signature du DP annoncée à la fin, un bouton à la fois, annuler, bilan en haut, durée calculée, palanquées au nom de leur encadrant, encadré « Imprimer ou archiver » et barre d'enregistrement (changer cette date dans tous les scénarios les fait tous retourner).
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

    await legende('En haut, toujours visible : combien de palanquées à immerger, à l\'eau, sorties.', 3500);
    // Une palanquée porte le nom de son encadrant (« Palanquée de … ») : on la prend par son rang.
    const palanquee = n => page.locator('section.carte')
      .filter({ has: page.getByRole('heading', { name: /^Palanquée/ }) }).nth(n - 1);
    const p2 = palanquee(2);
    await legende('Un seul bouton à la fois : « Immersion maintenant », puis « Sortie maintenant ».', 0);
    await toucher(p2.getByRole('button', { name: /Immersion maintenant/ }), { apres: 1500 });
    await legende('Touché par erreur ? « Annuler », quelques secondes.', 0);
    await toucher(p2.getByRole('button', { name: /Annuler/ }), { apres: 1500 });
    await legende('Une palanquée qui dépasse sa durée prévue passe en tête, en rouge.', 3500);

    await legende('Heures notées sur papier ? « Corriger les heures », et la durée se calcule.', 0);
    const p1 = palanquee(1);
    await toucher(p1.locator('.corriger-heures summary'), { apres: 800 });
    await p1.getByLabel('Immersion', { exact: true }).fill('10:05');
    await p1.getByLabel('Sortie', { exact: true }).fill('10:34');
    await toucher(p1.getByRole('button', { name: /Durée réalisée d'après ces heures/ }), { apres: 1200 });
    await legende('Puis la profondeur et les paliers.', 0);
    await saisir(p1.getByLabel('Profondeur réalisée (m)'), '28');
    await saisir(p1.getByLabel('Paliers'), '3 min à 3 m');
    await pause(1000);
    await saisir(p2.getByLabel('Profondeur réalisée (m)'), '22');
    await saisir(p2.getByLabel('Durée réalisée (min)'), '33');
    await saisir(p2.getByLabel('Paliers'), '3 min à 3 m');
    await p2.locator('.depassement').scrollIntoViewIfNeeded();
    await legende('22 m pour 20 m prévus : au-delà du prévu, la valeur passe en rouge, ici comme sur la fiche imprimée.', 4000);
    await legende('En bas : « Modifications non enregistrées » tant qu\'on n\'a pas enregistré.', 2500);
    await vignette();
    await toucher(page.getByRole('button', { name: 'Enregistrer les paramètres réalisés' }), { apres: 2000 });
    await page.locator('section.impression').scrollIntoViewIfNeeded();
    await legende('La fiche est complète. « Imprimer ou archiver » : PDF ou tableur, sur le modèle du club, les deux plongées du jour sur une page, une colonne par encadrant.', 5500);
    await legende('Tous les moniteurs peuvent la compléter, et aussi une sécurité surface qui n\'est pas moniteur.', 4500);
    await legende('Complète, le directeur de plongée la signe : ensuite, plus rien ne se modifie.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
