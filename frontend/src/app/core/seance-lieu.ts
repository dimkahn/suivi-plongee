/** Ce qu'il faut d'une séance pour décrire où elle a lieu. */
interface OuSeance {
  lieu: string | null;
  site: string | null;
}

/**
 * « Carrière de Blaisy · La Vierge » : le lieu, puis le site de plongée
 * s'il est renseigné. Chaîne vide si ni l'un ni l'autre.
 */
export function lieuEtSite(s: OuSeance): string {
  return [s.lieu, s.site].filter(v => v && v.trim()).join(' · ');
}

/** Casse et accents ignorés : « blaisy » retrouve « Carrière de Blaisy ». */
export function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/** Une séance correspond si le texte cherché figure dans son lieu, son site ou son info complémentaire. */
export function correspondLieuSiteInfo(s: OuSeance & { commentaire: string | null }, recherche: string): boolean {
  const cherche = normaliser(recherche);
  return !cherche || [s.lieu, s.site, s.commentaire].some(v => v && normaliser(v).includes(cherche));
}
