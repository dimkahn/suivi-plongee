import { PhaseExercice } from './modeles';

/** Exercice ni dans la base ni au programme, saisi sur place : la note copie intitulé et phase. */
export interface ExerciceHorsListe {
  intitule: string;
  phase: PhaseExercice;
}

/** Même limite que le serveur (evaluation.exercice_libre). */
export const LONGUEUR_MAX_EXERCICE = 200;

/**
 * Ce qui manque pour noter un exercice hors liste, ou null. La phase est
 * exigée : seule une maîtrise acquise rend le critère acquis.
 */
export function refusExerciceHorsListe(intitule: string, phase: PhaseExercice | null): string | null {
  const nom = intitule.trim();
  if (!nom) return 'Donnez l’intitulé de l’exercice réalisé.';
  if (nom.length > LONGUEUR_MAX_EXERCICE) {
    return `L’intitulé d’un exercice ne dépasse pas ${LONGUEUR_MAX_EXERCICE} caractères.`;
  }
  if (!phase) return 'Choisissez la phase de l’exercice : initiation, perfectionnement ou maîtrise.';
  return null;
}
