/**
 * Sépare les séances passées (avant `jour`) de celles à venir (ce jour compris),
 * sans changer leur ordre. L'administration n'affiche par défaut que les
 * séances à venir ; les passées restent consultables à la demande.
 */
export function separerSeancesPassees<T extends { date: string }>(
  seances: readonly T[], jour: string): { aVenir: T[]; passees: T[] } {
  return {
    aVenir: seances.filter(s => s.date >= jour),
    passees: seances.filter(s => s.date < jour)
  };
}
