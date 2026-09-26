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

/** Une période peut enjamber le changement d'année (novembre à février). */
function couvre(p: { moisDebut: number; moisFin: number }, mois: number): boolean {
  return p.moisDebut <= p.moisFin
    ? mois >= p.moisDebut && mois <= p.moisFin
    : mois >= p.moisDebut || mois <= p.moisFin;
}

/** La première période (dans l'ordre) qui couvre le mois d'une date AAAA-MM-JJ, ou null. */
export function periodeDuMois<P extends { moisDebut: number; moisFin: number }>(periodes: P[], date: string): P | null {
  const mois = Number(date.slice(5, 7));
  return periodes.find(p => couvre(p, mois)) ?? null;
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
 * chevauchent. Un niveau sans période ce mois-là n'apparaît pas.
 */
export function programmeDuJour(progressions: ProgressionVue[], date: string): ProgrammeNiveau[] {
  const resultat: ProgrammeNiveau[] = [];
  for (const p of progressions) {
    const periode = periodeDuMois(p.periodes, date);
    if (periode) resultat.push({ niveau: p.niveau, progression: p.nom, periode });
  }
  return resultat.sort((a, b) => a.niveau.localeCompare(b.niveau));
}
