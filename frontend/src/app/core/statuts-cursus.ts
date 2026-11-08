/**
 * Statuts d'un cursus (une formation N1, N2 ou N3), comme `Cursus.Statut`
 * côté serveur. « Brevet obtenu ailleurs » : l'élève a passé ce niveau dans
 * une autre structure ; sa formation se clôt ici, sans délivrance du club.
 */
export const STATUTS_CURSUS = ['EN_COURS', 'VALIDE', 'DELIVRE', 'SUSPENDU', 'ABANDON', 'OBTENU_AILLEURS'] as const;

const LIBELLES: Record<string, string> = {
  EN_COURS: 'En cours', VALIDE: 'Validé', DELIVRE: 'Brevet délivré',
  SUSPENDU: 'Suspendu', ABANDON: 'Abandon', OBTENU_AILLEURS: 'Brevet obtenu ailleurs'
};

export function libelleStatutCursus(statut: string): string {
  return LIBELLES[statut] ?? statut;
}
