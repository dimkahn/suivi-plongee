import { Observable } from 'rxjs';

// ----------------------------------------------------------------
//  Les fiches de sécurité d'un séjour (FichesSecuriteSejourController) :
//  une ligne par plongée de la sortie, avec l'état de sa fiche.
// ----------------------------------------------------------------

/** {@code supprimable} : ni fiche, ni présence, ni évaluation (le serveur revérifie). */
export interface PlongeeSejourVue {
  seanceId: number;
  date: string;
  ordre: number;
  milieu: 'NATUREL' | 'ARTIFICIEL';
  lieu: string | null;
  site: string | null;
  profondeurMax: number | null;
  commentaire: string | null;
  fiche: boolean;
  signee: boolean;
  dpId: number | null;
  dp: string | null;
  palanquees: number;
  plongeurs: number;
  realise: boolean;
  supprimable: boolean;
}

/** Les droits guident l'écran : ajouter (organisateurs), établir les fiches, supprimer une fiche (ADMIN). */
export interface FichesSecuriteSejourVue {
  peutAjouter: boolean;
  peutEtablir: boolean;
  peutSupprimerFiche: boolean;
  plongees: PlongeeSejourVue[];
}

/** {@code ordre} null : la plongée suivante de ce jour-là. */
export interface DemandePlongee {
  date: string;
  ordre: number | null;
  milieu: 'NATUREL' | 'ARTIFICIEL';
  lieu: string | null;
  site: string | null;
  profondeurMax: number | null;
  commentaire: string | null;
}

export interface PortFichesSecurite {
  lire(): Observable<FichesSecuriteSejourVue>;
  ajouter(d: DemandePlongee): Observable<FichesSecuriteSejourVue>;
  supprimer(seanceId: number): Observable<FichesSecuriteSejourVue>;
  /** La fiche seule (ADMIN) : la plongée reste ; la liste est relue ensuite. */
  supprimerFiche(seanceId: number): Observable<unknown>;
  pdf(seanceId: number, regrouper: boolean): Observable<Blob>;
  pdfSejour(regrouper: boolean): Observable<Blob>;
}

export interface JourFiches {
  jour: string;
  plongees: PlongeeSejourVue[];
}

/** Les plongées rangées par jour, puis par n° de plongée. */
export function plongeesParJour(plongees: PlongeeSejourVue[]): JourFiches[] {
  const jours = new Map<string, PlongeeSejourVue[]>();
  [...plongees]
    .sort((a, b) => a.date.localeCompare(b.date) || a.ordre - b.ordre || a.seanceId - b.seanceId)
    .forEach(p => jours.set(p.date, [...(jours.get(p.date) ?? []), p]));
  return [...jours].map(([jour, liste]) => ({ jour, plongees: liste }));
}

/** Où en est la fiche, et le ton de son étiquette (`.etiquette-etat`). */
export function etatFiche(p: PlongeeSejourVue): { libelle: string; ton: 'neutre' | 'attention' | 'ok' | 'fort' } {
  if (p.signee) return { libelle: 'Signée', ton: 'ok' };
  if (p.fiche && p.realise) return { libelle: 'Complétée au retour', ton: 'fort' };
  if (p.fiche) return { libelle: 'Établie', ton: 'neutre' };
  return { libelle: 'À établir', ton: 'attention' };
}

/** Le brouillon de « Ajouter une plongée » : le premier jour du séjour, à son lieu, en milieu naturel. */
export function nouvellePlongee(dateDebut: string, lieu: string | null): DemandePlongee {
  return { date: dateDebut, ordre: null, milieu: 'NATUREL', lieu, site: null, profondeurMax: null, commentaire: null };
}
