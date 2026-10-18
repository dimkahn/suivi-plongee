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

/**
 * Plongeur ajouté par « + Plongeur » resté tel quel : rien de saisi, aucun
 * dossier choisi. Il disparaît quand on ferme sa fenêtre, et n'est pas envoyé.
 */
export function ligneVide(m: PlongeurVue): boolean {
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
    return { palanquees: nettoyees, erreur: `Palanquée ${p.numero} : ${manque}. Touchez sa ligne pour le compléter ou le retirer.` };
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
                                 cible: number | null,
                                 profil?: { profondeurPrevue: number | null; dureePrevue: number | null }): PalanqueeVue[] {
  const plongeur = palanquees[source].membres[membre];
  const liste = palanquees.map((p, i) =>
    i === source ? { ...p, membres: p.membres.filter((_, j) => j !== membre) } : p);
  if (cible === null) {
    const numero = Math.max(0, ...palanquees.map(p => p.numero)) + 1;
    return [...liste, {
      numero, profondeurPrevue: profil?.profondeurPrevue ?? null, dureePrevue: profil?.dureePrevue ?? null,
      profondeurRealisee: null, dureeRealisee: null,
      paliers: null, heureImmersion: null, heureSortie: null, membres: [plongeur]
    }];
  }
  return liste.map((p, i) => i === cible ? { ...p, membres: [...p.membres, plongeur] } : p);
}

/** Palanquée sans plongeur ni profil prévu : celle qu'ouvre une fiche neuve. */
function palanqueeVierge(p: PalanqueeVue): boolean {
  return p.membres.every(ligneVide) && p.profondeurPrevue == null && p.dureePrevue == null;
}

/**
 * Copie, à la suite des palanquées de la fiche, des palanquées prises sur la
 * fiche d'une autre séance : leurs plongeurs (avec aptitude, fonction, gaz…)
 * et leur profil prévu, numérotés après les palanquées déjà là. Ce qui a été
 * plongé ce jour-là (profil réalisé, observations) ne se reprend pas. Une
 * palanquée restée vierge laisse sa place. Rien n'est enregistré ici.
 */
export function reprendrePalanquees(actuelles: PalanqueeVue[], reprises: PalanqueeVue[]): PalanqueeVue[] {
  const gardees = actuelles.filter(p => !palanqueeVierge(p));
  let numero = Math.max(0, ...gardees.map(p => p.numero));
  const copies = reprises.map(p => ({
    numero: ++numero, profondeurPrevue: p.profondeurPrevue, dureePrevue: p.dureePrevue,
    profondeurRealisee: null, dureeRealisee: null, paliers: null, heureImmersion: null, heureSortie: null,
    membres: p.membres.map(m => ({ ...m, observations: null }))
  }));
  return [...gardees, ...copies];
}

/** Aptitude d'un encadrant possible : E1 à E4 (mais pas « PE40 »), MF1/MF2, GP, N4, N5. */
export const APTITUDE_ENCADRANT = /(^|[^P])E[1-4]|MF[12]|GP|N[45]/i;

/**
 * Peut-il encadrer ou guider une palanquée : compte moniteur du club, ou
 * aptitude d'encadrant sur la fiche. Quand on en ajoute un, l'écran demande
 * sa fonction plutôt que de le laisser « Plongeur » par défaut.
 */
export function estEncadrantPossible(m: { utilisateurId: number | null; aptitude: string | null }): boolean {
  return m.utilisateurId !== null || APTITUDE_ENCADRANT.test(m.aptitude ?? '');
}

/**
 * Profondeur encadrée et en autonomie de chaque code d'aptitude, comme
 * AptitudePlongeur côté serveur (proposition des palanquées) : N1 = PE20,
 * N2 = PE40 + PA20, N3 = PE60 + PA60, N4/N5/GP 60 m, E1 au moins N2.
 */
const PREROGATIVES: Record<string, [encadree: number | null, autonome: number | null]> = {
  PE12: [12, null], PE20: [20, null], N1: [20, null], PE40: [40, null], PE60: [60, null],
  PA20: [null, 20], PA40: [null, 40], PA60: [null, 60],
  N2: [40, 20], E1: [40, 20], N3: [60, 60], N4: [60, 60], N5: [60, 60], GP: [60, 60],
  E2: [60, 60], E3: [60, 60], E4: [60, 60], MF1: [60, 60], MF2: [60, 60]
};

const CODES_APTITUDE = /PA20|PA40|PA60|PE12|PE20|PE40|PE60|MF1|MF2|GP|E[1-4]|N[1-5]|NIVEAU ?[1-5]/g;

/** La plus grande des profondeurs du texte libre (encadrée seulement si `autonomie` est faux) ; null si aucun code. */
function profondeurDuTexte(texte: string | null, autonomie: boolean): number | null {
  const codes = (texte ?? '').toUpperCase().match(CODES_APTITUDE) ?? [];
  const profondeurs = codes
    .flatMap(c => {
      const [encadree, autonome] = PREROGATIVES[c.replace(/NIVEAU ?/, 'N')] ?? [null, null];
      return autonomie ? [encadree, autonome] : [encadree];
    })
    .filter((p): p is number => p !== null);
  return profondeurs.length > 0 ? Math.max(...profondeurs) : null;
}

/**
 * Jusqu'où le plongeur peut descendre : la plus étendue de ses prérogatives,
 * encadré ou autonome, et pour un élève en formation la profondeur encadrée
 * du niveau qu'il prépare. Null si rien n'est reconnu : on ne devine jamais.
 */
export function profondeurPermise(m: { aptitude: string | null; qualificationPreparee: string | null }): number | null {
  const permises = [profondeurDuTexte(m.aptitude, true), profondeurDuTexte(m.qualificationPreparee, false)]
    .filter((p): p is number => p !== null);
  return permises.length > 0 ? Math.max(...permises) : null;
}

/**
 * Raison de refuser l'ajout du plongeur à la palanquée : son aptitude ne
 * permet pas la profondeur prévue. Null si l'ajout est permis, ou si on ne
 * peut pas en juger (pas de profondeur prévue, aptitude non reconnue).
 */
export function refusAjout(p: PalanqueeVue, m: PlongeurVue): string | null {
  const max = profondeurPermise(m);
  if (!p.profondeurPrevue || max === null || p.profondeurPrevue <= max) return null;
  const nom = `${m.prenom} ${m.nom}`.trim() || 'Ce plongeur';
  return `Ajout refusé : ${nom}${m.aptitude ? ' (' + m.aptitude + ')' : ''} a une aptitude limitée à ${max} m, `
    + `${nomPalanquee(p).replace(/^Palanquée/, 'la palanquée')} est prévue à ${p.profondeurPrevue} m.`;
}

/**
 * « Palanquée de Flora DUPONT » : une palanquée se reconnaît à son encadrant
 * (à défaut, son guide de palanquée). Sans l'un ni l'autre (autonomes,
 * palanquée neuve), elle garde son numéro.
 */
export function nomPalanquee(p: PalanqueeVue): string {
  for (const fonction of ['ENCADRANT', 'GUIDE_PALANQUEE']) {
    const chef = p.membres.find(m => m.fonction === fonction && (rempli(m.prenom) || rempli(m.nom)));
    if (chef) return `Palanquée de ${`${chef.prenom.trim()} ${chef.nom.trim()}`.trim()}`;
  }
  return `Palanquée ${p.numero}`;
}

const FONCTIONS_AFFICHEES: Partial<Record<PlongeurVue['fonction'], string>> = {
  ENCADRANT: 'Encadrant', GUIDE_PALANQUEE: 'Guide de palanquée'
};

/** « Flora VASSEUR · E2 · Encadrant » : la ligne d'un plongeur dans sa palanquée, la fonction seulement si elle compte. */
export function libelleMembre(m: PlongeurVue): string {
  return [
    `${m.prenom.trim()} ${m.nom.trim()}`.trim() || 'Plongeur sans nom',
    rempli(m.aptitude) ? m.aptitude!.trim() : null,
    FONCTIONS_AFFICHEES[m.fonction] ?? null
  ].filter(v => v).join(' · ');
}

/**
 * Ce que demande la fenêtre d'ajout, rien de plus : le profil prévu pour une
 * nouvelle palanquée, la fonction d'un plongeur qui peut encadrer et n'en a
 * pas encore (« Plongeur »).
 */
export function questionsAjout(nouvellePalanquee: boolean, plongeur: PlongeurVue | null): { profil: boolean; fonction: boolean } {
  return {
    profil: nouvellePalanquee,
    fonction: plongeur !== null && plongeur.fonction === 'PLONGEUR' && estEncadrantPossible(plongeur)
  };
}

/** Une nouvelle palanquée se crée avec sa profondeur et sa durée prévues. */
export function erreurProfilPrevu(profondeur: number | null, duree: number | null): string | null {
  if (!profondeur || profondeur <= 0) return 'Indiquez la profondeur prévue.';
  if (!duree || duree <= 0) return 'Indiquez la durée prévue.';
  return null;
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
