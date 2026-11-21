/** Un mois d'une liste datée : « Juin 2027 », ses éléments, et s'il est entièrement passé. */
export interface Mois<T> {
  cle: string;
  libelle: string;
  elements: T[];
  passe: boolean;
}

/**
 * Les éléments regroupés par mois, dans l'ordre où ils viennent (le tri reste
 * celui de l'écran). {@code date} : « AAAA-MM-JJ » ; {@code aujourdhui} aussi.
 * Un mois est passé s'il finit avant le mois d'aujourd'hui.
 */
export function parMois<T>(elements: readonly T[], date: (e: T) => string, aujourdhui: string): Mois<T>[] {
  const moisCourant = aujourdhui.slice(0, 7);
  const groupes: Mois<T>[] = [];
  for (const e of elements) {
    const cle = date(e).slice(0, 7);
    let g = groupes.find(x => x.cle === cle);
    if (!g) {
      g = { cle, libelle: libelleMois(cle), elements: [], passe: cle < moisCourant };
      groupes.push(g);
    }
    g.elements.push(e);
  }
  return groupes;
}

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre',
  'Novembre', 'Décembre'];

function libelleMois(cle: string): string {
  return `${MOIS[Number(cle.slice(5, 7)) - 1]} ${cle.slice(0, 4)}`;
}
