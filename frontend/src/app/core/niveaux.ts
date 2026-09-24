/**
 * Libellé d'un niveau visé par une formation en cours : « PN1 » (préparation
 * N1) plutôt que « N1 », qui laisserait croire que l'élève a déjà le brevet.
 */
export function libellePreparation(niveau: string): string {
  return 'P' + niveau;
}
