import { PhaseExercice } from './modeles';

/**
 * Le MFT veut que chaque critère d'une compétence soit validé (choix du club,
 * 2026) : un critère qui a un exercice de maîtrise actif doit être couvert par
 * un exercice de maîtrise obligatoire, sans quoi la compétence pourrait se
 * valider sans lui. Rend les critères qui ne le sont pas.
 */
export function criteresSansObligatoire<C extends { id: number }>(
  criteres: C[],
  exercices: { phase: PhaseExercice; actif: boolean; critereIds?: number[]; obligatoire?: boolean }[]
): C[] {
  const actives = exercices.filter(e => e.actif && e.phase === 'MAITRISE');
  const deMaitrise = new Set(actives.flatMap(e => e.critereIds ?? []));
  const couverts = new Set(actives.filter(e => e.obligatoire).flatMap(e => e.critereIds ?? []));
  return criteres.filter(c => deMaitrise.has(c.id) && !couverts.has(c.id));
}
