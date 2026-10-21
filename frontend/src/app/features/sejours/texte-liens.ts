/** Un morceau d'un texte libre : du texte, ou une adresse web à ouvrir. */
export interface MorceauTexte {
  texte: string;
  /** L'adresse à ouvrir, null pour du texte simple. */
  lien: string | null;
}

/** Une adresse http(s), sans la ponctuation qui la termine dans une phrase. */
const ADRESSE = /https?:\/\/[^\s<>"]+[^\s<>".,;:!?)»]/g;

/** « lafont-assurances.com » pour « https://www.lafont-assurances.com/… ». */
function nomDuSite(adresse: string): string {
  return adresse.replace(/^https?:\/\/(www\.)?/, '').split(/[/?#]/)[0];
}

/**
 * Un texte libre de l'organisateur (le conseil d'assurance du séjour)
 * découpé pour l'écran : ses adresses http(s) deviennent des liens,
 * libellés du nom du site (l'adresse entière est illisible sur un
 * téléphone), le reste du texte simple. Rien d'autre n'est interprété.
 */
export function texteAvecLiens(texte: string): MorceauTexte[] {
  const morceaux: MorceauTexte[] = [];
  let debut = 0;
  for (const m of texte.matchAll(ADRESSE)) {
    if (m.index > debut) morceaux.push({ texte: texte.slice(debut, m.index), lien: null });
    morceaux.push({ texte: nomDuSite(m[0]), lien: m[0] });
    debut = m.index + m[0].length;
  }
  if (debut < texte.length) morceaux.push({ texte: texte.slice(debut), lien: null });
  return morceaux;
}
