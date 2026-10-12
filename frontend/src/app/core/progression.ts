import { PeriodeProgressionVue, ProgressionVue } from './modeles';

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];

/** Ordre d'une saison du club : de la rentrée à l'été. */
export const MOIS_SAISON = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];

export function nomMois(m: number): string {
  return NOMS_MOIS[m - 1];
}

/** « septembre – octobre », ou un seul mois. */
export function plageMois(debut: number, fin: number): string {
  return debut === fin ? nomMois(debut) : `${nomMois(debut)} – ${nomMois(fin)}`;
}

/** « plongée 3 », « plongées 5 – 6 ». */
export function plagePlongees(debut: number, fin: number): string {
  return debut === fin ? `plongée ${debut}` : `plongées ${debut} – ${fin}`;
}

/** Bornes d'une période : mois (progression par mois) ou numéros de plongée (par plongées). */
interface Plage {
  moisDebut: number | null;
  moisFin: number | null;
  plongeeDebut?: number | null;
  plongeeFin?: number | null;
}

/** Libellé d'une période, quel que soit le découpage de sa progression. */
export function plagePeriode(p: Plage): string {
  if (p.plongeeDebut != null && p.plongeeFin != null) return plagePlongees(p.plongeeDebut, p.plongeeFin);
  if (p.moisDebut != null && p.moisFin != null) return plageMois(p.moisDebut, p.moisFin);
  return '';
}

/**
 * Une période peut enjamber le changement d'année (novembre à février). Une
 * étape d'une progression par plongées ne couvre aucun mois.
 */
function couvre(p: Plage, mois: number): boolean {
  if (p.moisDebut == null || p.moisFin == null) return false;
  return p.moisDebut <= p.moisFin
    ? mois >= p.moisDebut && mois <= p.moisFin
    : mois >= p.moisDebut || mois <= p.moisFin;
}

/** La première période (dans l'ordre) qui couvre le mois d'une date AAAA-MM-JJ, ou null. */
export function periodeDuMois<P extends Plage>(periodes: P[], date: string): P | null {
  const mois = Number(date.slice(5, 7));
  return periodes.find(p => couvre(p, mois)) ?? null;
}

/**
 * Progression par plongées : la première étape qui contient la plongée n
 * (1 = première plongée en milieu naturel de l'élève). Au-delà de la
 * dernière étape, la dernière : l'élève qui fait une plongée de plus en est
 * toujours à la validation.
 */
export function periodeDeLaPlongee<P extends Plage>(periodes: P[], n: number): P | null {
  const etapes = periodes.filter(p => p.plongeeDebut != null && p.plongeeFin != null);
  return etapes.find(p => n >= p.plongeeDebut! && n <= p.plongeeFin!)
    ?? (etapes.length && n > Math.max(...etapes.map(p => p.plongeeFin!)) ? etapes[etapes.length - 1] : null);
}

/** Ce qui est au programme d'un niveau à une date donnée. */
export interface ProgrammeNiveau {
  niveau: ProgressionVue['niveau'];
  progression: string;
  periode: PeriodeProgressionVue;
}

/**
 * Pour chaque progression suivie par la saison, la période qui couvre le
 * mois de la date (AAAA-MM-JJ) ; la première dans l'ordre si plusieurs se
 * chevauchent. Un niveau sans période ce mois-là n'apparaît pas, ni une
 * progression par plongées : chaque élève y est à sa propre étape, montrée
 * dans sa fiche de suivi.
 */
export function programmeDuJour(progressions: ProgressionVue[], date: string): ProgrammeNiveau[] {
  const resultat: ProgrammeNiveau[] = [];
  for (const p of progressions) {
    const periode = periodeDuMois(p.periodes, date);
    if (periode) resultat.push({ niveau: p.niveau, progression: p.nom, periode });
  }
  return resultat.sort((a, b) => a.niveau.localeCompare(b.niveau));
}
