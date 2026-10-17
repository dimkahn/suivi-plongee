/**
 * Un plongeur d'un groupe de séjour a trois niveaux distincts (V90) : son
 * niveau de plongeur (`aptitude`), son niveau d'encadrement et le niveau
 * qu'il prépare. Une fiche de sécurité n'a qu'une case « aptitude » : les deux
 * premiers y sont réunis à la reprise d'un groupe, et séparés de nouveau quand
 * on crée un groupe depuis la fiche.
 */

/** Codes d'encadrement, rangés à part du niveau de plongeur. */
const CODE_ENCADREMENT = /^(E[1-4]|MF[12])$/i;

function nettoyer(texte: string | null | undefined): string | null {
  const t = (texte ?? '').trim();
  return t === '' ? null : t;
}

/** « E1 · N3 » : l'encadrement d'abord, c'est lui qui dit qui peut encadrer. */
export function aptitudeSurFiche(m: { aptitude: string | null; niveauEncadrement?: string | null }): string | null {
  const parties = [nettoyer(m.niveauEncadrement), nettoyer(m.aptitude)].filter(p => p !== null);
  return parties.length ? parties.join(' · ') : null;
}

/** L'inverse : « E1 · N3 » donne N3 en niveau de plongeur et E1 en encadrement. */
export function separerAptitude(texte: string | null): { aptitude: string | null; niveauEncadrement: string | null } {
  const mots = (texte ?? '').split(/[\s·,/]+/).filter(m => m !== '');
  return {
    aptitude: nettoyer(mots.filter(m => !CODE_ENCADREMENT.test(m)).join(' ')),
    niveauEncadrement: nettoyer(mots.filter(m => CODE_ENCADREMENT.test(m)).join(' '))
  };
}
