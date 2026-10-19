import { AccordValidationVue } from './modeles';

/**
 * Ce que l'encadrant connecté peut faire pour valider une compétence (choix
 * du club, 2026) : la valider seul (référent du groupe, élève sans groupe),
 * proposer ou accepter la validation parmi les encadrants du groupe, attendre
 * les autres après avoir donné son accord, ou seulement lire (hors du groupe).
 * Le serveur reste juge : ce n'est que l'affichage du bouton.
 */
export type ModeValidation = 'SEUL' | 'PROPOSER' | 'ACCEPTER' | 'ACCORD_DONNE' | 'HORS_GROUPE';

export interface EtatAccords {
  mode: ModeValidation;
  /** Accords des encadrants du groupe déjà donnés, sur {@link accordsRequis} nécessaires. */
  accords: number;
  accordsRequis: number;
}

export function modeValidation(
  grille: { referentIds?: number[]; votantIds?: number[]; accordsRequis?: number },
  bloc: { accords?: AccordValidationVue[] },
  moi: number | null | undefined
): EtatAccords {
  const votants = grille.votantIds ?? [];
  const accordsRequis = votants.length === 0 ? 0 : grille.accordsRequis ?? 0;
  const donnes = (bloc.accords ?? []).filter(a => votants.includes(a.moniteurId));
  const etat = (mode: ModeValidation): EtatAccords => ({ mode, accords: donnes.length, accordsRequis });

  if (votants.length === 0 || (moi != null && (grille.referentIds ?? []).includes(moi))) return etat('SEUL');
  if (moi == null || !votants.includes(moi)) return etat('HORS_GROUPE');
  if (donnes.some(a => a.moniteurId === moi)) return etat('ACCORD_DONNE');
  return etat(donnes.length === 0 ? 'PROPOSER' : 'ACCEPTER');
}
