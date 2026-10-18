// M10 — Établir une fiche de sécurité avant la mise à l'eau.
// Tournage du 2026-10-18, 12e série, fonction en sélecteur compact, MOD et ppO2 max d'un nitrox, palanquées compactes et fenêtre du plongeur, palanquées fermées par défaut, une seule fenêtre pour le profil et la fonction, palanquées ouvertes ou fermées, palanquée au nom de son encadrant, profil demandé à la création, plongeur refusé au-delà de son aptitude, fonction demandée à l'ajout d'un encadrant, reprendre une palanquée d'une autre séance, bouton rond des actions sur téléphone, déplacer un plongeur, détails repliés (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'M10',
  titre: 'Établir une fiche de sécurité',
  public: 'Moniteur',
  resume: 'Avant la mise à l\'eau : directeur de plongée, conditions, palanquées et plongeurs ; reprendre une palanquée d\'une autre séance ; dupliquer et lier une seconde séance.',
  compte: 'e2@club.fr',

  async jouer(g) {
    const { page, pause, legende, toucher, saisir, menu, rechercherEtChoisir, suggestion, vignette, defiler } = g;
    await page.goto(`${APPLI}/eleves`);
    await pause(1000);
    await legende('« Plus », puis « Fiches de sécurité » : les séances en milieu naturel ou à plus de 6 m.', 0);
    await menu('Fiches de sécurité');
    await legende('On retrouve la séance par sa date.', 0);
    await toucher(page.locator('#filtre-date'), { apres: 900 });
    const dialogue = page.locator('dialog[open]');
    await toucher(dialogue.locator('button.jour[aria-label*="séance"]:not([disabled])').first(), { apres: 1200 });
    await page.keyboard.press('Escape').catch(() => {});
    await pause(600);
    await legende('Établir la fiche : les E3, E4, ou un moniteur qui en a reçu le droit, comme Flora ici.', 0);
    await toucher(page.getByRole('link', { name: 'Établir la fiche' }).first(), { apres: 1800 });

    await legende('Le directeur de plongée : seuls les E3 et E4 sont proposés.', 0);
    await rechercherEtChoisir('dp', 'Gwen', 'Gwendoline');
    await legende('Les conditions du jour…', 0);
    await saisir('#temperatureEau', '27 degrés');
    await saisir('#securiteSurface', 'Maître-nageur au bord, trousse de secours au poste.');
    await saisir('#planSecours', 'SAMU (15), DAE à l\'accueil de la piscine.');

    // La première palanquée, par son rang : son titre devient le nom de son encadrant.
    const palanquee = page.locator('section.carte')
      .filter({ has: page.getByRole('heading', { name: /^Palanquée/ }) }).first();
    await palanquee.scrollIntoViewIfNeeded();
    await legende('Puis les palanquées : une est prête, « + Palanquée » en ajoute d\'autres.', 0);
    await legende('Chaque palanquée est compacte : son profil prévu se modifie sur place.', 0);
    await saisir(palanquee.getByLabel('Profondeur prévue (m)'), '6');
    await saisir(palanquee.getByLabel('Durée prévue (min)'), '20');
    await legende('« + Plongeur » ouvre sa fenêtre : pour un plongeur du club, aptitude et niveau préparé se remplissent seuls.', 0);
    const fenetre = page.locator('dialog[open]');
    await toucher(palanquee.getByRole('button', { name: '+ Plongeur' }), { apres: 600 });
    await suggestion(fenetre.locator('.selecteur-connu'), 'Léa');
    await toucher(fenetre.getByRole('button', { name: 'OK', exact: true }), { apres: 600 });
    await toucher(palanquee.getByRole('button', { name: '+ Plongeur' }), { apres: 600 });
    await suggestion(fenetre.locator('.selecteur-connu'), 'Flora');
    await legende('Flora peut encadrer : sa fenêtre invite à choisir sa fonction, d\'un geste.', 0);
    await pause(1200);
    await toucher(fenetre.locator('.segments').getByRole('button', { name: 'Encadrant', exact: true }),
      { apres: 600 });
    await legende('Gaz, désaturation, observations : rangés sous « Détails », ouverts d\'un geste.', 0);
    await toucher(fenetre.locator('.details-plongeur summary'), { apres: 1200 });
    await legende('Un nitrox : la fiche calcule sa profondeur maximale d\'utilisation (MOD), à la ppO2 choisie.', 0);
    await saisir(fenetre.getByLabel('Gaz'), 'Nitrox 32');
    await pause(1500);
    await toucher(fenetre.locator('.choix-ppo2').getByRole('button', { name: '1,6' }), { apres: 1800 });
    await toucher(fenetre.getByRole('button', { name: 'OK', exact: true }), { apres: 600 });
    await legende('La palanquée porte maintenant le nom de Flora ; un plongeur par ligne.', 0);
    await palanquee.getByRole('heading', { name: /^Palanquée de Flora/ }).scrollIntoViewIfNeeded();
    await pause(2200);
    await vignette();
    await legende('Pour modifier un plongeur, on touche sa ligne : sa fenêtre s\'ouvre.', 0);
    await toucher(palanquee.locator('.modifier-plongeur').first(), { apres: 1500 });
    await legende('Changer de palanquée : on touche le bouton, puis sa nouvelle palanquée.', 0);
    await toucher(fenetre.getByRole('button', { name: /Changer de palanquée/ }), { apres: 2500 });
    await toucher(page.locator('.barre-placement').getByRole('button', { name: 'Annuler' }), { apres: 800 });

    await legende('Une autre palanquée : « + Palanquée », dans le bouton rond.', 0);
    await toucher(page.getByRole('button', { name: 'Actions de la fiche' }), { apres: 900 });
    await toucher(page.locator('.menu-actions').getByRole('menuitem', { name: '+ Palanquée' }), { apres: 900 });
    await legende('On donne d\'abord sa profondeur et sa durée prévues.', 0);
    await saisir('#nouvelle-profondeur', '20');
    await saisir('#nouvelle-duree', '40');
    await legende('Un plongeur dont l\'aptitude ne permet pas cette profondeur y sera refusé.', 0);
    await legende('En y plaçant un encadrant, la même fenêtre demande aussi sa fonction : rien d\'autre.', 0);
    await toucher(page.getByRole('button', { name: 'Créer la palanquée' }), { apres: 1500 });

    await legende('Les mêmes palanquées qu\'à une autre plongée ? « Reprendre une palanquée d\'une autre séance ».', 0);
    await toucher(page.getByRole('button', { name: 'Actions de la fiche' }), { apres: 900 });
    await toucher(page.locator('.menu-actions').getByRole('menuitem', { name: /Reprendre une palanquée/ }), { apres: 900 });
    await legende('On cherche la séance par sa date ou son lieu, puis on coche les palanquées à recopier.', 0);
    await toucher(page.locator('#reprise-seance'), { apres: 900 });
    await toucher(page.locator('#reprise-seance-liste li[role="option"] button').first(), { apres: 1200 });
    await toucher(page.locator('dialog[open] .choix-palanquees-dup input[type="checkbox"]').first(), { apres: 900 });
    await legende('Plongeurs et profil prévu arrivent à la suite ; ce qui a été plongé ce jour-là, non.', 0);
    await toucher(page.getByRole('button', { name: 'Ajouter à cette fiche' }), { apres: 1800 });

    await legende('En bas, toujours visible : « Modifications non enregistrées » tant qu\'on n\'a pas enregistré.', 2000);
    await legende('Tous les boutons de la fiche sont dans le bouton rond, en bas à gauche.', 0);
    await toucher(page.getByRole('button', { name: 'Actions de la fiche' }), { apres: 1800 });
    await legende('Enregistrez : la fiche est gardée, même sans réseau, et le DP la retrouve.', 0);
    await toucher(page.locator('.menu-actions').getByRole('menuitem', { name: 'Enregistrer la fiche' }), { apres: 2000 });
    await legende('Le même bouton propose « Imprimer (PDF) » : la fiche, aussitôt, sur le modèle du club.', 0);
    await toucher(page.getByRole('button', { name: 'Actions de la fiche' }), { apres: 2500 });
    await toucher(page.getByRole('button', { name: 'Fermer les actions de la fiche' }), { apres: 600 });

    await legende('Une seconde rotation, ou un second bateau, le même jour ? « Dupliquer et lier ».', 0);
    await toucher(page.getByRole('button', { name: 'Dupliquer et lier…' }), { apres: 1200 });
    await legende('Son directeur de plongée, son n° de plongée (déjà le suivant)…', 0);
    await rechercherEtChoisir('dup-dp', 'Gwen', 'Gwendoline');
    await legende('… et une info pour distinguer les deux séances.', 0);
    await saisir('#dup-info-origine', '1re rotation');
    await saisir('#dup-info', '2e rotation');
    await legende('Cochez les palanquées qui passent sur la nouvelle séance : elles quittent celle-ci.', 0);
    await page.locator('dialog[open] .choix-palanquees-dup').scrollIntoViewIfNeeded();
    await pause(1500);
    await toucher(page.getByRole('button', { name: 'Créer la séance liée' }), { apres: 1500 });
    await legende('Les deux séances sont liées : « Ouvrir sa fiche » passe de l\'une à l\'autre.', 0);
    await page.locator('.seance-liee').first().scrollIntoViewIfNeeded();
    await pause(2500);

    await legende('Au retour de plongée, on la complète : c\'est la vidéo suivante.', 3500);
    await legende(null, 0);
    await pause(500);
  }
};
