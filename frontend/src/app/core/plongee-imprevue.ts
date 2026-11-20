import type { Ecriture, EcritureEnAttente } from './file-ecritures.service';
import type { FicheSecuriteVue, SeanceVue } from './modeles';

// ----------------------------------------------------------------
//  La plongée imprévue d'un séjour, ajoutée sans réseau par un
//  organisateur ou un DP (demande du club, 2026-11-21). Elle attend dans
//  la file des écritures (`FileEcrituresService`) sous un n° provisoire,
//  sa fiche et son profil réalisé derrière elle ; créée par le serveur,
//  elle leur passe son vrai n° de séance.
// ----------------------------------------------------------------

export type EcriturePlongee = Extract<Ecriture, { type: 'plongee' }>;

/** Un n° tiré par le téléphone, négatif : le serveur n'en donne jamais. */
export function nouveauNumeroProvisoire(): number {
  return -Date.now();
}

export function estProvisoire(seanceId: number): boolean {
  return seanceId < 0;
}

/** La séance telle que l'écran de la fiche l'attend ; `ordre` : celui qu'elle prendra dans sa journée. */
export function seanceProvisoire(e: EcriturePlongee, ordre: number): SeanceVue {
  const d = e.demande;
  return {
    id: e.seanceId, date: d.date, ordre, milieu: d.milieu, lieu: d.lieu, site: d.site,
    profondeurMax: d.profondeurMax, commentaire: d.commentaire, modifiable: true,
    ficheSecurite: false, ficheSignee: false, ficheDpId: null
  };
}

/** Le n° de la plongée dans sa journée : demandé, sinon la suivante de celles connues ce jour-là. */
export function ordreProvisoire(e: EcriturePlongee, ordresDuJour: number[]): number {
  return e.demande.ordre ?? Math.max(0, ...ordresDuJour) + 1;
}

/** La séance d'une plongée imprévue en attente, à la suite de celles connues de son jour ; null sans plongée. */
export function seanceImprevue(e: EcriturePlongee | undefined, seances: SeanceVue[]): SeanceVue | null {
  if (!e) return null;
  return seanceProvisoire(e, ordreProvisoire(e, seances.filter(s => s.date === e.demande.date).map(s => s.ordre)));
}

/** La fiche d'une plongée que le serveur ne connaît pas encore : tout reste à établir. */
export function ficheVide(): FicheSecuriteVue {
  return {
    id: null, dpId: null, dp: null, meteo: null, etatMer: null, visibilite: null, courant: null, maree: null,
    temperatureEau: null, securiteSurface: null, planSecours: null, observations: null, palanquees: [],
    seancesLiees: [], sortie: null, signature: null
  };
}

/**
 * Ce qui attendait la plongée provisoire passe sur la séance créée : nouvelle
 * clé, même rang d'envoi (la fiche reste avant son profil réalisé).
 */
export function rattacherALaSeance(entrees: EcritureEnAttente[], provisoire: number, reelle: number)
  : { retirees: string[]; rattachees: EcritureEnAttente[] } {
  // Seules une fiche et son profil réalisé attendent une plongée imprévue : une clé par type et séance.
  const aRattacher = entrees.filter(e => e.ecriture.seanceId === provisoire
    && (e.ecriture.type === 'fiche' || e.ecriture.type === 'realise'));
  return {
    retirees: aRattacher.map(e => e.cle),
    rattachees: aRattacher.map(e => ({
      ...e, ecriture: { ...e.ecriture, seanceId: reelle }, cle: `${e.ecriture.type}:${reelle}`
    }))
  };
}
