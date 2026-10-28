import { Observable } from 'rxjs';
import { peutSignerDepuisLaListe, signatureAVenir } from '../../core/fiche-securite';

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

/** Un geste à faire sur la fiche d'une plongée, dans l'ordre où il se fait. */
export interface ActionFiche {
  action: 'etablir' | 'completer' | 'signer';
  plongee: PlongeeSejourVue;
}

const ORDRE_ACTIONS: ActionFiche['action'][] = ['etablir', 'completer', 'signer'];

/**
 * L'encart « À faire » du séjour (demande du club, 2026) : les fiches à
 * établir pour qui peut les établir ; pour le DP, ses fiches de plongées
 * passées à compléter au retour et à signer (mêmes règles que les liens de
 * l'onglet). Ses fiches de plongées à venir sont seulement annoncées.
 * Simple confort : le serveur revérifie tout.
 */
export function actionsAFaire(vue: FichesSecuriteSejourVue, moiId: number | undefined, aujourdhui: string):
  { actions: ActionFiche[]; signaturesAVenir: PlongeeSejourVue[] } {
  const plongees = plongeesParJour(vue.plongees).flatMap(j => j.plongees);
  const actions = plongees.flatMap((p): ActionFiche[] => {
    if (!p.fiche) return vue.peutEtablir ? [{ action: 'etablir', plongee: p }] : [];
    const aSigner = { date: p.date, ficheSecurite: p.fiche, ficheSignee: p.signee, ficheDpId: p.dpId };
    if (!peutSignerDepuisLaListe(aSigner, moiId, aujourdhui)) return [];
    return [...(p.realise ? [] : [{ action: 'completer' as const, plongee: p }]), { action: 'signer', plongee: p }];
  });
  return {
    actions: actions.sort((a, b) => ORDRE_ACTIONS.indexOf(a.action) - ORDRE_ACTIONS.indexOf(b.action)),
    signaturesAVenir: plongees.filter(p =>
      signatureAVenir({ date: p.date, ficheSecurite: p.fiche, ficheSignee: p.signee, ficheDpId: p.dpId }, moiId, aujourdhui))
  };
}

/** Le brouillon de « Ajouter une plongée » : le premier jour du séjour, à son lieu, en milieu naturel. */
export function nouvellePlongee(dateDebut: string, lieu: string | null): DemandePlongee {
  return { date: dateDebut, ordre: null, milieu: 'NATUREL', lieu, site: null, profondeurMax: null, commentaire: null };
}
