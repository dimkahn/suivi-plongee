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

/** Case « de l'ensemble des activités subaquatiques fédérales », exclusive des cases « ou bien seulement ». */
export const CACI_ENSEMBLE = 'ENSEMBLE_ACTIVITES';
/** Case « avec les limites et préconisations suivantes » : le détail n'est que sur le papier. */
export const CACI_LIMITES = 'LIMITES_PRECONISATIONS';

/**
 * Cases à cocher du CACI FFESSM (modèle « Version Juin 2026 »), dans l'ordre
 * du formulaire (enum ActiviteCaci côté serveur). On ne garde que les cases,
 * jamais le texte écrit par le médecin à côté.
 */
export const CASES_CACI: { titre: string; seulement: boolean; cases: { code: string; libelle: string }[] }[] = [
  {
    titre: 'Pratique autorisée',
    seulement: false,
    cases: [{ code: CACI_ENSEMBLE, libelle: "De l'ensemble des activités subaquatiques fédérales" }]
  },
  {
    titre: 'Ou bien seulement',
    seulement: true,
    cases: [
      { code: 'PLONGEE_SCAPHANDRE', libelle: 'Des activités de plongée en scaphandre autonome' },
      { code: 'APNEE', libelle: 'Des activités en apnée' },
      { code: 'APNEE_PROFONDEUR_6M', libelle: "De l'apnée en profondeur au-delà de 6 m" },
      { code: 'NAGE_AVEC_ACCESSOIRES', libelle: 'Des activités de nage avec accessoires' }
    ]
  },
  {
    titre: 'Autres cases',
    seulement: false,
    cases: [
      { code: 'COMPETITION', libelle: 'En compétition (activités écrites sur le certificat)' },
      { code: CACI_LIMITES, libelle: 'Avec des limites et préconisations (détail sur le certificat)' }
    ]
  }
];

/** Qualité du médecin signataire (enum MedecinCaci côté serveur). */
export const MEDECINS_CACI: { code: string; libelle: string }[] = [
  { code: 'GENERALISTE', libelle: 'Médecin généraliste' },
  { code: 'DU_SPORT', libelle: 'Médecin du sport' },
  { code: 'MEDECINE_SUBAQUATIQUE', libelle: 'Diplômé de médecine subaquatique' },
  { code: 'FEDERAL', libelle: 'Médecin fédéral' },
  { code: 'AUTRE', libelle: 'Autre médecin' }
];

export function libelleMedecinCaci(code: string | null | undefined): string {
  return MEDECINS_CACI.find(m => m.code === code)?.libelle ?? 'non renseigné';
}

export function libelleCaci(finValidite: string | null | undefined): string {
  switch (etatCaci(finValidite)) {
    case 'absent': return 'CACI non renseigné';
    case 'expire': return `CACI expiré depuis le ${dateFr(finValidite)}`;
    case 'bientot': return `CACI expire le ${dateFr(finValidite)}`;
    default: return `CACI valide jusqu'au ${dateFr(finValidite)}`;
  }
}
