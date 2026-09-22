import { dateDuJour, dateFr } from './date-fr';

/** À partir de combien de jours avant l'échéance on prévient. */
export const JOURS_AVANT_ECHEANCE = 30;

export type EtatCaci = 'valide' | 'bientot' | 'expire' | 'absent';

/**
 * État du CACI d'après sa date de fin de validité (ISO). Sert uniquement à
 * l'affichage : ne jamais y voir un contrôle, le serveur reste la référence.
 */
export function etatCaci(finValidite: string | null | undefined): EtatCaci {
  if (!finValidite) return 'absent';
  const aujourdhui = dateDuJour();
  if (finValidite < aujourdhui) return 'expire';
  const limite = new Date();
  limite.setDate(limite.getDate() + JOURS_AVANT_ECHEANCE);
  const limiteIso = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`;
  return finValidite <= limiteIso ? 'bientot' : 'valide';
}

export function libelleCaci(finValidite: string | null | undefined): string {
  switch (etatCaci(finValidite)) {
    case 'absent': return 'CACI non renseigné';
    case 'expire': return `CACI expiré depuis le ${dateFr(finValidite)}`;
    case 'bientot': return `CACI expire le ${dateFr(finValidite)}`;
    default: return `CACI valide jusqu'au ${dateFr(finValidite)}`;
  }
}
