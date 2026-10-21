import type { AuthService } from '../../core/auth.service';
import { Manuel } from './manuel';
import { MANUELS } from './manuels';

/**
 * Ce que le compte connecté peut ouvrir, pour ne lui montrer que l'aide qui
 * le concerne. Confort d'affichage comme les gardes (core/gardes.ts) : les
 * mêmes droits, dans les mêmes mots.
 */
export interface Droits {
  connecte: boolean;
  /** Moniteur ou administrateur (gardeEncadrant). */
  encadrant: boolean;
  admin: boolean;
  /** Matériel, prêts et sorties : directeur technique ou administrateur (gardeMateriel). */
  materiel: boolean;
  /** Inventaire, fiche d'un équipement et inspections : le TIV en plus (gardeInspectionBlocs). */
  inspection: boolean;
  /** Fiches de sécurité : les encadrants et la sécurité surface (gardeFichesSecurite). */
  fichesSecurite: boolean;
}

/**
 * Les publics qu'un manuel peut nommer dans son en-tête (« pour: inspection »).
 * « sans-compte » : même sans connexion, pour l'aide des écrans publics.
 */
export type Public = 'sans-compte' | 'tous' | 'encadrant' | 'admin' | 'materiel' | 'inspection' | 'fiches-securite';

/** Le public d'une rubrique, quand le manuel n'en nomme pas. « tous » : tout compte connecté. */
const PUBLIC_DE_LA_RUBRIQUE: Record<string, Public> = {
  'Découverte': 'tous',
  'Élève': 'tous',
  'Moniteur': 'encadrant',
  'Administrateur': 'admin',
  'Directeur technique': 'materiel'
};

function publicPermis(p: string, d: Droits): boolean {
  // L'aide des écrans ouverts sans compte (connexion, séjour par lien) reste publique.
  if (p === 'sans-compte') return true;
  if (!d.connecte) return false;
  switch (p) {
    case 'tous': return true;
    case 'encadrant': return d.encadrant;
    case 'admin': return d.admin;
    case 'materiel': return d.materiel;
    case 'inspection': return d.inspection;
    case 'fiches-securite': return d.fichesSecurite;
    default: return false;
  }
}

function publicDeLaRubrique(rubrique: string): Public | null {
  return PUBLIC_DE_LA_RUBRIQUE[rubrique] ?? null;
}

/** Un manuel se lit si l'un de ses publics (« pour: », sinon celui de sa rubrique) est permis. */
export function manuelPermis(m: Manuel, d: Droits): boolean {
  const publics = m.pour.length ? m.pour : [publicDeLaRubrique(m.rubrique) ?? 'admin'];
  return publics.some(p => publicPermis(p, d));
}

/** Une vidéo se regarde si sa rubrique est permise, ou si un manuel permis la cite. */
export function videoPermise(v: { id: string; public: string }, d: Droits): boolean {
  const rubrique = publicDeLaRubrique(v.public);
  return (rubrique !== null && publicPermis(rubrique, d))
    || MANUELS.some(m => m.videos.includes(v.id) && manuelPermis(m, d));
}

/** Les droits du compte connecté. */
export function droitsDe(auth: AuthService): Droits {
  return {
    connecte: auth.connecte(),
    encadrant: auth.estMoniteur() || auth.estAdmin(),
    admin: auth.estAdmin(),
    materiel: auth.gereMateriel(),
    inspection: auth.inspecteBlocs(),
    fichesSecurite: auth.completeFichesSecurite()
  };
}
