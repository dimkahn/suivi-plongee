import { EquipementSejourVue, TypeEquipement } from './sejour-api';

/** Minuscules, sans accents : « Détendeur » et « detendeur » se valent. */
function simplifier(texte: string): string {
  return texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Le matériel disponible d'un type (ou de tous), dont la référence, l'ancienne ou la description contient la recherche. */
export function filtrerDisponibles(liste: EquipementSejourVue[], type: TypeEquipement | null,
                                   recherche: string): EquipementSejourVue[] {
  const cherche = simplifier(recherche);
  return liste.filter(e => (type === null || e.type === type)
    && (cherche === '' || simplifier(`${e.reference} ${e.ancienneReference ?? ''} ${e.description}`).includes(cherche)));
}

/** Un détendeur choisi : il faut confirmer sa désinfection (Code du sport, art. A322-81). */
export function contientUnDetendeur(ids: number[], liste: EquipementSejourVue[]): boolean {
  return liste.some(e => e.type === 'DETENDEUR' && ids.includes(e.id));
}
