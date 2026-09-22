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

/** Date du jour au format ISO (AAAA-MM-JJ), en heure locale de l'appareil (pas en UTC). */
export function dateDuJour(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Pipe({ name: 'dateFr' })
export class DateFrPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    return dateFr(iso);
  }
}
