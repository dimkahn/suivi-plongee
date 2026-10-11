import { Pipe, PipeTransform } from '@angular/core';

/**
 * Un nombre suivi de son mot accordé : « 1 présent », « 3 présents »,
 * « 0 élève » (zéro reste au singulier, comme en français courant). Le
 * pluriel par défaut ajoute un « s » ; le donner pour les autres cas
 * (« saisie refusée » → « saisies refusées »). Remplace les « (s) » qui
 * se lisent mal sur un téléphone.
 */
export function pluriel(n: number, singulier: string, pluriel = singulier + 's'): string {
  return `${n} ${n > 1 ? pluriel : singulier}`;
}

@Pipe({ name: 'pluriel' })
export class PlurielPipe implements PipeTransform {
  transform(n: number, singulier: string, plurielDonne?: string): string {
    return pluriel(n, singulier, plurielDonne);
  }
}
