// D10 — La fiche d'inspection TIV d'un bloc.
import { APPLI } from '../commun.mjs';

export default {
  id: 'D10',
  titre: 'La fiche d\'inspection TIV d\'un bloc',
  public: 'Directeur technique',
  resume: 'Le TIV du club remplit la fiche d\'évaluation et de suivi d\'une bouteille, puis imprime le compte rendu.',
  compte: 'e2@club.fr',

  async jouer({ page, pause, legende, toucher, saisir, dater, defiler, vignette }) {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const question = libelle => page.locator('.questions li').filter({ hasText: libelle });

    await page.goto(`${APPLI}/materiel`);
    await pause(1200);
    await legende('Un TIV a l\'entrée « Matériel » : il voit les blocs, sans gérer l\'inventaire ni les prêts.', 0);
    await pause(2500);
    await legende('Le bloc B-02 : son inspection visuelle arrive à échéance.', 0);
    await toucher(page.getByText('Bloc B-02').first(), { apres: 1800 });
    await toucher(page.getByRole('link', { name: 'Remplir la fiche d\'inspection TIV' }), { apres: 1500 });

    await legende('Date, motif, nom et n° de TIV : ils seront repris à la prochaine fiche.', 0);
    await saisir('#tivNumero', '12345');
    await legende('Les filetages de la bouteille et du robinet : un mauvais appairage est le risque majeur.', 0);
    await saisir('#filetageBouteille', 'M25×2');
    await saisir('#filetageRobinet', 'M25×2');
    await saisir('#marquage', 'Poinçon 03/2024');

    await legende('Chaque question part de la réponse d\'une bouteille saine : on ne touche que les défauts.', 0);
    await defiler(700, 2500);
    await legende('Filetage légèrement oxydé : la décision de la fiche est proposée, « À nettoyer ».', 0);
    await toucher(question('Filetage légèrement oxydé').getByRole('button', { name: 'Oui' }), { apres: 1200 });
    await dater('#realise-FILETAGE_LEGEREMENT_OXYDE', aujourdhui);
    await pause(1500);

    await legende('Un défaut grave interdit l\'avis favorable : l\'appli le signale aussitôt.', 0);
    await toucher(question('Corrosion feuilletante localisée').getByRole('button', { name: 'Oui' }), { apres: 2500 });
    await legende('Fausse alerte : on revient sur « Non ».', 0);
    await toucher(question('Corrosion feuilletante localisée').getByRole('button', { name: 'Non' }), { apres: 1200 });

    await page.getByRole('heading', { name: 'Décision' }).scrollIntoViewIfNeeded();
    await pause(800);
    await legende('Avis favorable : le bloc repart pour douze mois.', 0);
    await saisir('#observations', 'Filetage du col nettoyé.');
    await legende('Défavorable, il n\'est plus prêté ; rebuté, il est mis au rebut. Les deux demandent une observation.', 0);
    await toucher(page.getByRole('button', { name: 'Enregistrer la fiche' }), { apres: 2000 });

    await vignette();
    await legende('Le compte rendu, numéroté, se relit et s\'imprime pour être signé.', 0);
    await pause(1500);
    await defiler(1200, 4000);
    await legende('Une fiche enregistrée ne se modifie plus : une erreur se corrige par une nouvelle inspection.', 0);
    await defiler(1200, 3000);
    await legende('Pensez aussi à enregistrer la visite sur le dispositif fédéral en ligne.', 3500);
    await toucher(page.getByRole('link', { name: '← Fiche du bloc B-02' }), { apres: 1500 });
    await page.getByRole('heading', { name: 'Journal' }).scrollIntoViewIfNeeded();
    await legende('Dans le journal du bloc, « Voir la fiche d\'inspection » la retrouve.', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
