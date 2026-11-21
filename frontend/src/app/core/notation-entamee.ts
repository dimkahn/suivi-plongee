/**
 * Vrai si fermer « Noter les présents » perdrait quelque chose : un critère
 * coché ou un commentaire écrit (gardé même si son critère a été décoché).
 */
export function notationEntamee(criteresCoches: ReadonlySet<number>, commentaires: ReadonlyMap<number, string>): boolean {
  return criteresCoches.size > 0 || [...commentaires.values()].some(texte => texte.trim() !== '');
}
