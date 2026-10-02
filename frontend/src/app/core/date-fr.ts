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
  return dateDansJours(0);
}

/** Date du jour décalée de quelques jours, au format ISO, en heure locale. */
export function dateDansJours(jours: number): string {
  const d = new Date();
  d.setDate(d.getDate() + jours);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** « le 10/10/2026 » ou « du 10/10/2026 au 11/10/2026 ». */
export function periode(debut: string, fin: string | null): string {
  return !fin || fin === debut ? `le ${dateFr(debut)}` : `du ${dateFr(debut)} au ${dateFr(fin)}`;
}

@Pipe({ name: 'dateFr' })
export class DateFrPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    return dateFr(iso);
  }
}
