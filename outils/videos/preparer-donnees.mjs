// Dernière touche avant de tourner les vidéos, par l'API, sur un backend
// fraîchement démarré en profil dev.
//
// La saison 2026-2027 (élèves, groupes, présences, notes, planning) vient
// désormais des données de démonstration elles-mêmes (V107). Il ne reste
// ici que ce qu'une migration SQL ne porte pas bien : des portraits
// dessinés (jamais des photos de vraies personnes) pour le trombinoscope,
// avec le droit à l'image recueilli pour certains élèves seulement.
//
// Pour repartir de zéro, redémarrer le backend (base H2 en mémoire).
//
//   node preparer-donnees.mjs            (API sur http://localhost:8080)
//   API=http://autre:8080 node preparer-donnees.mjs

import { dessinerPortraits } from './portraits.mjs';

const API = process.env.API ?? 'http://localhost:8080';
const MOT_DE_PASSE = 'plongee2026';

async function connexion(email) {
  const r = await fetch(`${API}/api/auth/connexion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, motDePasse: MOT_DE_PASSE, seSouvenir: false })
  });
  if (!r.ok) throw new Error(`Connexion impossible pour ${email} (${r.status}). Le backend tourne-t-il en profil dev ?`);
  return (await r.json()).jetonAcces;
}

async function appel(jeton, methode, chemin, corps) {
  const r = await fetch(`${API}${chemin}`, {
    method: methode,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
    body: corps === undefined ? undefined : JSON.stringify(corps)
  });
  const texte = await r.text();
  if (!r.ok) {
    let detail = texte;
    try { detail = JSON.parse(texte).detail ?? texte; } catch { /* texte brut */ }
    throw new Error(`${methode} ${chemin} → ${r.status} : ${detail}`);
  }
  return texte ? JSON.parse(texte) : null;
}

/** Dépôt d'une image PNG (champ « fichier », comme le fait l'appli). */
async function deposer(jeton, chemin, png) {
  const donnees = new FormData();
  donnees.append('fichier', new Blob([png], { type: 'image/png' }), 'portrait.png');
  const r = await fetch(`${API}${chemin}`, {
    method: 'POST', headers: { Authorization: `Bearer ${jeton}` }, body: donnees
  });
  if (!r.ok) throw new Error(`POST ${chemin} → ${r.status} : ${await r.text()}`);
}

// Anis, Hugo et Camille restent sans photo : leur carte montre « Droit à
// l'image non recueilli » (vidéo M15). Flora (e2) dépose la sienne dans M2.
const AVEC_PHOTO = [
  ['eleve', 'Léa Morel', 1, 'queue'], ['eleve', 'Yanis Roux', 2, 'courte'],
  ['eleve', 'Chloé Garnier', 3, 'longue'], ['eleve', 'Mateo Vasquez', 4, 'courte'],
  ['eleve', 'Sonia Perrot', 5, 'longue'],
  ['moniteur', 'e1@club.fr', 6, 'courte'], ['moniteur', 'e3@club.fr', 7, 'queue'],
  ['moniteur', 'presidente@club.fr', 8, 'longue']
];

async function main() {
  const jeton = await connexion('presidente@club.fr');

  const saisons = await appel(jeton, 'GET', '/api/saisons');
  if (!saisons.some(s => s.libelle === '2026-2027' && s.ouverte)) {
    throw new Error('La saison 2026-2027 n\'est pas ouverte : données de démonstration antérieures à V107 ?');
  }

  const eleves = await appel(jeton, 'GET', '/api/eleves');
  const moniteurs = await appel(jeton, 'GET', '/api/admin/moniteurs');
  const chemin = (sorte, qui) => {
    if (sorte === 'eleve') {
      const e = eleves.find(x => `${x.prenom} ${x.nom}` === qui);
      if (!e) throw new Error(`Élève ${qui} introuvable.`);
      return `/api/eleves/${e.id}`;
    }
    const m = moniteurs.find(x => x.email === qui);
    if (!m) throw new Error(`Moniteur ${qui} introuvable.`);
    return `/api/admin/moniteurs/${m.id}`;
  };

  const images = await dessinerPortraits(AVEC_PHOTO.map(([, , n, coupe]) => [n, coupe]));
  for (const [k, [sorte, qui]] of AVEC_PHOTO.entries()) {
    const base = chemin(sorte, qui);
    await appel(jeton, 'PUT', `${base}/autorisation-image`, { autorisationImage: true });
    await deposer(jeton, `${base}/photo`, images[k]);
  }
  console.log(`${AVEC_PHOTO.length} portraits dessinés déposés (droit à l'image recueilli).`);
  console.log('\nPrêt à tourner. Compte : e2@club.fr (Flora Vasseur, E2), mot de passe plongee2026.');
}

main().catch(e => {
  console.error(`\nÉchec de la préparation : ${e.message}`);
  process.exit(1);
});
