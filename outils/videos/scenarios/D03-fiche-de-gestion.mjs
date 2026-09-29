// D3 — La fiche de gestion d'un EPI.
import { APPLI } from '../commun.mjs';

export default {
  id: 'D3',
  titre: 'La fiche de gestion d\'un EPI',
  public: 'Directeur technique',
  resume: 'Le journal d\'un détendeur : révisions, réparations, désinfections. On ajoute, on ne modifie jamais.',
  compte: 'e3@club.fr',

  async jouer({ page, pause, legende, toucher, saisir, dater, choisir, defiler, vignette }) {
    await page.goto(`${APPLI}/materiel`);
    await pause(1200);
    await legende('Le détendeur D-02 : sa révision est dépassée.', 0);
    await toucher(page.getByText('Détendeur D-02').first(), { apres: 1800 });
    await legende('Sa fiche tient lieu de fiche de gestion d\'EPI (Code du sport) : à garder 3 ans après le rebut.', 4500);
    await legende('Il revient de révision : on l\'inscrit au journal.', 0);
    await page.getByRole('heading', { name: 'Journal' }).scrollIntoViewIfNeeded();
    await choisir('#typeIntervention', 'Révision');
    await dater('#dateIntervention', new Date().toISOString().slice(0, 10));
    await saisir('#intervenant', 'Plongée Services');
    await choisir('#resultat', 'Conforme');
    await saisir('#descriptionIntervention', 'Kit de révision constructeur, membranes changées.');
    await toucher(page.getByRole('button', { name: 'Ajouter au journal' }), { apres: 2000 });
    await vignette();
    await legende('Une erreur ? Elle se corrige par une nouvelle ligne : le journal ne se modifie pas.', 4000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await pause(800);
    await legende('Les échéances sont à jour. « Imprimer la fiche » pour le classeur du club.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
