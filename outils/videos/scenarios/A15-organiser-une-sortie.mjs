// A15 — Organiser une sortie.
import { APPLI } from '../commun.mjs';

export default {
  id: 'A15',
  titre: 'Organiser une sortie',
  public: 'Administrateur',
  resume: 'Un week-end en mer : dates, lieu, et ses plongées créées d\'un coup.',
  compte: 'presidente@club.fr',
  format: 'ordinateur',

  async jouer({ page, pause, legende, toucher, saisir, dater, administration, vignette }) {
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await administration('Sorties');
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
    await legende('Elles sont créées et rattachées à la sortie, en un geste.', 3500);
    await vignette();
    await legende('Les moniteurs y établiront les fiches de sécurité ; le matériel prêté s\'y rattache.', 4500);
    await legende(null, 0);
    await pause(500);
  }
};
