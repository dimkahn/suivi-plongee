// A11 — Tenir le planning des soirées.
// Tournage du 2026-10-03 (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'A11',
  titre: 'Tenir le planning des soirées',
  public: 'Administrateur',
  resume: 'La grille groupes × soirées qui remplace le tableur : fosse, F6, activité, absence, DP fosse et DP piscine.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, saisir, administration, rechercherEtChoisir, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await administration('Planning du bassin');
    await legende('Une ligne par groupe, une colonne par soirée : comme le tableur du lundi.', 3500);
    await legende('Une case grisée = la ligne attitrée du groupe. On ne note que les écarts.', 4000);
    await vignette();
    await legende('Les débutants occupent deux lignes : « 5+6 ». Les sorties en milieu naturel n\'y figurent pas.', 4000);
    await legende('Un prénom rayé dans une case : un encadrant du groupe absent ce soir-là.', 3500);

    await legende('Ce soir-là, la Prépa N2 descend en fosse :', 0);
    const casePrepaN2 = page.locator('button.case[aria-label^="Prépa N2, "]').nth(3);
    await toucher(casePrepaN2, { apres: 900 });
    const dialogue = page.locator('dialog[open]');
    await toucher(dialogue.locator('label.option').filter({ hasText: /^\s*Fosse/ }).first(), { apres: 600 });
    await toucher(dialogue.getByRole('button', { name: 'Enregistrer' }), { apres: 1500 });

    await legende('Les lignes « DP fosse » et « DP piscine » : le directeur de plongée de chaque bassin, et une note pour tous.', 0);
    await toucher(page.locator('button.case.dp-piscine').nth(3), { apres: 900 });
    await rechercherEtChoisir('dp-piscine', 'Flo', 'Flora');
    await saisir('#note', 'Piscine fermée à 21 h 30.');
    await toucher(page.locator('dialog[open]').getByRole('button', { name: 'Enregistrer' }), { apres: 1500 });
    await legende('Les encadrants voient aussitôt leur soirée sur leur téléphone (« Planning »).', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
