/** « B-12 » ; « B-12 (ancien n° 12) » pour un matériel renuméroté : partout, son ancien numéro le suit. */
export function nomEquipement(e: { reference: string; ancienneReference?: string | null }): string {
  return e.ancienneReference ? `${e.reference} (ancien n° ${e.ancienneReference})` : e.reference;
}
