/** Un nom tel qu'affiché (« Camille Berthier »), ou le prénom et le nom séparés. */
export type NomPersonne = string | { prenom: string; nom: string };

/** Les initiales d'un nom (« Camille Berthier » → « CB »), pour une vignette sans photo. */
export function initiales(nom: NomPersonne): string {
  if (typeof nom !== 'string') return ((nom.prenom[0] ?? '') + (nom.nom[0] ?? '')).toUpperCase();
  return nom.split(' ').filter(Boolean).map(m => m[0]).slice(0, 2).join('').toUpperCase();
}
