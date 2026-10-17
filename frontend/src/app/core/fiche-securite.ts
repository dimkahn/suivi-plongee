import { PalanqueeVue, PlongeurVue } from './modeles';

/** Un texte fait de blancs vaut une case vide. */
function rempli(texte: string | null | undefined): boolean {
  return (texte ?? '').trim() !== '';
}

/**
 * Le plongeur a-t-il un des champs repliés sous « Détails » sur la fiche
 * (aptitude donnée par le DP, qualification préparée, gaz, désaturation,
 * observations) ? Si oui, ils restent dépliés : rien de saisi n'est caché.
 */
export function aDesDetails(m: PlongeurVue): boolean {
  return [m.aptitudeDonneeParDp, m.qualificationPreparee, m.gaz, m.moyenDesaturation, m.observations].some(rempli);
}

/**
 * Empreinte du formulaire de la fiche, pour savoir s'il reste des
 * modifications non enregistrées. Une case vidée (« » ou blancs) vaut une
 * case jamais remplie : effacer ce qu'on vient de taper ne compte pas.
 */
export function empreinteFiche(entete: object, palanquees: PalanqueeVue[]): string {
  return JSON.stringify({ entete, palanquees }, (_cle, valeur) =>
    typeof valeur === 'string' && !rempli(valeur) ? null : valeur);
}

/** Ligne « + Plongeur » restée telle quelle : rien de saisi, aucun dossier choisi. */
function ligneVide(m: PlongeurVue): boolean {
  return m.eleveId === null && m.utilisateurId === null && !rempli(m.nom) && !rempli(m.prenom)
    && !rempli(m.aptitude) && !aDesDetails(m);
}

/**
 * Les palanquées telles qu'envoyées au serveur : sans les lignes de plongeur
 * restées vides, et avec un message clair si un plongeur n'a pas de nom ou de
 * prénom (le serveur les exige) plutôt qu'un refus incompréhensible.
 */
export function palanqueesAEnregistrer(palanquees: PalanqueeVue[]): { palanquees: PalanqueeVue[]; erreur: string | null } {
  const nettoyees = palanquees.map(p => ({ ...p, membres: p.membres.filter(m => !ligneVide(m)) }));
  for (const p of nettoyees) {
    const incomplet = p.membres.find(m => !rempli(m.nom) || !rempli(m.prenom));
    if (!incomplet) continue;
    const manque = !rempli(incomplet.nom) && !rempli(incomplet.prenom) ? "un plongeur n'a ni nom ni prénom"
      : !rempli(incomplet.nom) ? `${incomplet.prenom.trim()} n'a pas de nom`
      : `${incomplet.nom.trim()} n'a pas de prénom`;
    return { palanquees: nettoyees, erreur: `Palanquée ${p.numero} : ${manque}. Complétez-le ou retirez la ligne (✕).` };
  }
  return { palanquees: nettoyees, erreur: null };
}

/**
 * Déplace un plongeur, avec tout ce qui est saisi pour lui, en dernier dans
 * la palanquée `cible` (indice), ou dans une nouvelle palanquée au numéro
 * suivant si `cible` est null. La palanquée quittée reste, même vide : le DP
 * la retire s'il le veut.
 */
export function deplacerPlongeur(palanquees: PalanqueeVue[], source: number, membre: number,
                                 cible: number | null): PalanqueeVue[] {
  const plongeur = palanquees[source].membres[membre];
  const liste = palanquees.map((p, i) =>
    i === source ? { ...p, membres: p.membres.filter((_, j) => j !== membre) } : p);
  if (cible === null) {
    const numero = Math.max(0, ...palanquees.map(p => p.numero)) + 1;
    return [...liste, {
      numero, profondeurPrevue: null, dureePrevue: null, profondeurRealisee: null, dureeRealisee: null,
      paliers: null, heureImmersion: null, heureSortie: null, membres: [plongeur]
    }];
  }
  return liste.map((p, i) => i === cible ? { ...p, membres: [...p.membres, plongeur] } : p);
}

/** « 3 plongeurs · 20 m · 40 min » : de quoi relire une palanquée d'un coup d'œil. */
export function resumePalanquee(p: PalanqueeVue): string {
  const nombre = p.membres.filter(m => rempli(m.nom) || rempli(m.prenom)).length;
  return [
    nombre === 0 ? 'aucun plongeur' : nombre === 1 ? '1 plongeur' : `${nombre} plongeurs`,
    p.profondeurPrevue ? `${p.profondeurPrevue} m` : null,
    p.dureePrevue ? `${p.dureePrevue} min` : null
  ].filter(v => v).join(' · ');
}
