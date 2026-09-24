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

/** En deçà, l'échéance est imminente (rouge) ; entre ce seuil et {@link JOURS_AVANT_ECHEANCE}, orange. */
export const JOURS_URGENCE = 15;

export type CouleurCaci = 'vert' | 'orange' | 'rouge';

/**
 * Couleur d'un CACI encore valide selon le temps restant : plus d'un mois
 * vert, moins d'un mois orange, moins de 15 jours rouge. null s'il est
 * expiré ou non renseigné (l'écran affiche alors un avertissement).
 */
export function couleurCaci(finValidite: string | null | undefined): CouleurCaci | null {
  const etat = etatCaci(finValidite);
  if (etat === 'absent' || etat === 'expire') return null;
  const jours = Math.round((Date.parse(finValidite!) - Date.parse(dateDuJour())) / 86_400_000);
  if (jours < JOURS_URGENCE) return 'rouge';
  return jours <= JOURS_AVANT_ECHEANCE ? 'orange' : 'vert';
}

export function libelleCaci(finValidite: string | null | undefined): string {
  switch (etatCaci(finValidite)) {
    case 'absent': return 'CACI non renseigné';
    case 'expire': return `CACI expiré depuis le ${dateFr(finValidite)}`;
    case 'bientot': return `CACI expire le ${dateFr(finValidite)}`;
    default: return `CACI valide jusqu'au ${dateFr(finValidite)}`;
  }
}
