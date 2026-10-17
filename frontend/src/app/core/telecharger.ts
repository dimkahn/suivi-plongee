import { HttpErrorResponse } from '@angular/common/http';

/** Fait télécharger au navigateur un fichier reçu du serveur (PDF, Excel…). */
export function telechargerFichier(blob: Blob, nom: string): void {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.click();
  URL.revokeObjectURL(url);
}

/**
 * Message d'un refus du serveur pour une réponse attendue en fichier : le
 * `ProblemDetail` arrive alors en blob, à relire comme du JSON.
 */
export async function detailErreurFichier(e: HttpErrorResponse): Promise<string | null> {
  try {
    return JSON.parse(await (e.error as Blob).text()).detail ?? null;
  } catch {
    return null;
  }
}
