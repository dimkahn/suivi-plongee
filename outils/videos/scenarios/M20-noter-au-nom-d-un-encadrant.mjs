// M20 — Référent du groupe : noter au nom d'un encadrant qui ne l'a pas fait.
// Tournage du 2026-10-12, 12e série (changer cette date dans tous les scénarios les fait tous retourner).
// Flora (e2) est référente du groupe Débutants (V110), où Tiago (e1) encadre aussi.
import { ouvrirGrille, ouvrirBloc, critere, noter } from '../grille.mjs';

export default {
  id: 'M20',
  titre: 'Noter au nom d\'un autre encadrant',
  public: 'Moniteur',
  resume: 'Référent du groupe : rattraper la note d\'un encadrant qui ne l\'a pas saisie, sous son nom.',
  compte: 'e2@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, choisirDerniereSeance } = g;

    await legende('Tiago a fait travailler Anis ce soir, mais n\'a pas eu le temps de le noter.', 0);
    await ouvrirGrille(g, 'Anis Dulac');
    await choisirDerniereSeance();

    await legende('Flora est référente du groupe d\'Anis : la grille lui propose « Noter au nom de ».', 0);
    const choix = page.locator('select#noter-pour');
    await choix.scrollIntoViewIfNeeded();
    await pause(2500);
    await choix.selectOption({ label: 'Tiago Nogueira (E1)' });
    await pause(1200);
    await legende('Un bandeau rappelle au nom de qui partent les notes.', 3500);

    await ouvrirBloc(g, 'Évoluer dans l\'eau - Se ventiler');
    const tuba = 'Ventilation sur tuba et vidage du tuba';
    await critere(page, tuba).scrollIntoViewIfNeeded();
    await legende('Elle note ce que Tiago lui a rapporté, comme d\'habitude, sur l\'exercice réalisé.', 0);
    await noter(g, tuba, 'En cours', 'Ventilation et vidage du tuba');
    await legende('La note porte le nom de Tiago.', 3000);

    await legende('L\'historique garde que c\'est Flora qui l\'a saisie.', 0);
    const ligne = critere(page, tuba);
    await toucher(ligne.getByRole('button', { name: 'Voir l’historique' }), { apres: 1500 });
    await pause(3000);
    await toucher(ligne.getByRole('button', { name: 'Masquer l’historique' }), { apres: 600 });

    await legende('Revenez sur « Moi-même » pour noter de nouveau à votre nom.', 0);
    await choix.scrollIntoViewIfNeeded();
    await choix.selectOption({ label: 'Moi-même' });
    await pause(2000);
    await legende('Seuls les référents du groupe le peuvent, pour un encadrant qui a le niveau de noter ce brevet.', 4500);
    await legende(null, 0);
    await pause(500);
  }
};
