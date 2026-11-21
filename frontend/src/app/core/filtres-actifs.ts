/**
 * Le nombre de filtres qui ne sont pas à leur valeur par défaut, affiché sur
 * « Filtres (2) » quand ils sont repliés : on voit qu'une liste est filtrée.
 */
export function nombreFiltresActifs(valeurs: readonly unknown[], parDefaut: readonly unknown[]): number {
  return valeurs.filter((v, i) => v !== parDefaut[i]).length;
}
