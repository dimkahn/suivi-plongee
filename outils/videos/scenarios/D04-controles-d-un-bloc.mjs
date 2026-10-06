// D4 — Les contrôles d'un bloc.
// Tournage du 2026-10-06 (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'D4',
  titre: 'Les contrôles d\'un bloc',
  public: 'Directeur technique',
  resume: 'Inspection visuelle (TIV) et requalification : un bloc à régulariser redevient prêtable.',
  compte: 'e3@club.fr',

  async jouer({ page, pause, legende, toucher, saisir, dater, choisir, vignette }) {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    await page.goto(`${APPLI}/materiel`);
    await pause(1200);
    await legende('Le bloc B-03 est « à régulariser » : TIV et requalification dépassées.', 0);
    await toucher(page.getByText('Bloc B-03').first(), { apres: 1800 });
    await legende('Tant qu\'il l\'est, l\'appli refuse de le prêter.', 3500);
    await legende('Retour de requalification :', 0);
    await page.getByRole('heading', { name: 'Journal' }).scrollIntoViewIfNeeded();
    await toucher(page.getByRole('button', { name: 'Ajouter une entrée au journal' }), { apres: 800 });
    await choisir('#typeIntervention', 'Requalification (épreuve hydraulique)');
    await dater('#dateIntervention', aujourdhui);
    await saisir('#intervenant', 'Centre de requalification agréé');
    await choisir('#resultat', 'Conforme');
    await toucher(page.getByRole('button', { name: 'Ajouter au journal' }), { apres: 1800 });
    await legende('Puis l\'inspection visuelle, par un TIV du club :', 0);
    await toucher(page.getByRole('button', { name: 'Ajouter une entrée au journal' }), { apres: 800 });
    await choisir('#typeIntervention', 'Inspection visuelle (TIV)');
    await dater('#dateIntervention', aujourdhui);
    await saisir('#intervenant', 'TIV Gwendoline Marchand n° 12345');
    await choisir('#resultat', 'Conforme');
    await toucher(page.getByRole('button', { name: 'Ajouter au journal' }), { apres: 1800 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await pause(1200);
    await vignette();
    await legende('Le bloc est de nouveau disponible. Un contrôle « non conforme » l\'aurait bloqué.', 4500);
    await legende('Régime TIV : requalification tous les 6 ans ; hors TIV, tous les 2 ans.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
