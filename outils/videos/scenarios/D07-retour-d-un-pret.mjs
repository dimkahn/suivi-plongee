// D7 — Retour et annulation d'un prêt.
// Tournage du 2026-11-10, 14e série, retour depuis la fiche ouverte au scanner (QR code ou tag NFC) (changer cette date dans tous les scénarios les fait tous retourner).
import { APPLI } from '../commun.mjs';

export default {
  id: 'D7',
  titre: 'Retour d\'un prêt',
  public: 'Directeur technique',
  resume: 'Scanner le matériel rendu (QR code ou tag NFC), enregistrer le retour depuis sa fiche, signaler un incident ou mettre un équipement hors service.',
  compte: 'e3@club.fr',

  async jouer({ page, pause, legende, toucher, saisir, cocher, vignette }) {
    await page.goto(`${APPLI}/materiel/scanner`);
    await pause(1200);
    await legende('Camille rapporte le matériel de son week-end : on scanne le premier équipement.', 0);
    await legende('Visez le QR code de l\'étiquette, ou approchez le dos du téléphone du tag NFC : la fiche s\'ouvre toute seule.', 4500);
    await legende('Étiquette illisible ? Sa référence suffit.', 0);
    await saisir('#reference', 'B-01');
    await toucher(page.getByRole('button', { name: 'Ouvrir' }), { apres: 1500 });
    await legende('La fiche montre à qui il est prêté : « Enregistrer le retour ».', 0);
    await toucher(page.getByRole('button', { name: 'Enregistrer le retour' }), { apres: 1200 });
    const dialogue = page.locator('dialog[open]');
    await legende('Le prêt se rend en entier : tout le matériel de Camille est dans la fenêtre.', 3500);
    await legende('Pour chaque équipement : un incident éventuel.', 0);
    await saisir(dialogue.locator('input[id^="incident-"]').nth(2), 'Purge basse qui colle');
    await legende('Et si besoin, hors service : il ne sera plus proposé au prêt.', 3500);
    await legende('Un détendeur déclaré depuis un séjour par son emprunteur porte « Désinfection au retour » : on le désinfecte, et on le coche ici.', 4500);
    await vignette();
    await toucher(dialogue.getByRole('button', { name: 'Valider le retour' }), { apres: 2000 });
    await legende('L\'incident est inscrit au journal de l\'équipement. « Scanner le matériel suivant » enchaîne sur le prochain.', 4500);
    await page.goto(`${APPLI}/materiel/prets`);
    await pause(1200);
    await legende('Dans « Prêts », « Enregistrer le retour » fait la même chose, sans scanner.', 3500);
    await toucher(page.getByRole('tab', { name: 'Rendus' }), { apres: 1500 });
    await legende('Les prêts rendus restent consultables, avec leurs photos.', 3500);
    await legende('« Annuler le prêt » sert seulement à défaire une erreur de saisie, avant tout retour.', 4000);
    await legende(null, 0);
    await pause(500);
  }
};
