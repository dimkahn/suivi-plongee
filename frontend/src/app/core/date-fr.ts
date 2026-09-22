import { Pipe, PipeTransform } from '@angular/core';

/**
 * Date ISO renvoyée par le serveur (2026-10-12) → format français
 * JJ/MM/AAAA (12/10/2026). Les valeurs vides restent vides. Pour
 * l'affichage uniquement : les formulaires et l'API gardent le format ISO.
 */
export function dateFr(iso: string | null | undefined): string {
  if (!iso) return '';
  const [a, m, j] = iso.slice(0, 10).split('-');
  return j && m && a ? `${j}/${m}/${a}` : iso;
}

@Pipe({ name: 'dateFr' })
export class DateFrPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    return dateFr(iso);
  }
}
