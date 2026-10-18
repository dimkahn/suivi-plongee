import { signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { DemandeDeclarationPret, EquipementSejourVue, PortPrets, PretSejourVue, PretsSejourVue, TypeEquipement } from './sejour-api';

/** Minuscules, sans accents : « Détendeur » et « detendeur » se valent. */
function simplifier(texte: string): string {
  return texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Le matériel disponible d'un type (ou de tous), dont la référence, l'ancienne ou la description contient la recherche. */
export function filtrerDisponibles(liste: EquipementSejourVue[], type: TypeEquipement | null,
                                   recherche: string): EquipementSejourVue[] {
  const cherche = simplifier(recherche);
  return liste.filter(e => (type === null || e.type === type)
    && (cherche === '' || simplifier(`${e.reference} ${e.ancienneReference ?? ''} ${e.description}`).includes(cherche)));
}

/** Un détendeur choisi : il faut confirmer sa désinfection (Code du sport, art. A322-81). */
export function contientUnDetendeur(ids: number[], liste: EquipementSejourVue[]): boolean {
  return liste.some(e => e.type === 'DETENDEUR' && ids.includes(e.id));
}

/** Ce que la carte « Mon séjour » dit du matériel : la question, « rien emprunté », ou ses emprunts. */
export type MonMateriel = { etat: 'question' } | { etat: 'rien' } | { etat: 'emprunts'; prets: PretSejourVue[] };

/** Ses emprunts d'abord ; sinon sa réponse « rien emprunté » ; sinon la question, s'il peut déclarer. */
export function monMateriel(vue: PretsSejourVue | null, moiId: number): MonMateriel | null {
  if (!vue) return null;
  const prets = vue.prets.filter(p => p.participantId === moiId);
  if (prets.length > 0) return { etat: 'emprunts', prets };
  if (vue.rienEmprunte) return { etat: 'rien' };
  return vue.droits.peutDeclarer ? { etat: 'question' } : null;
}

/**
 * Le matériel du séjour, partagé par la carte « Mon séjour » et l'onglet
 * « Matériel » : chaque réponse du serveur met à jour la même vue.
 */
export class PretsDuSejour {
  readonly vue = signal<PretsSejourVue | null>(null);

  constructor(private readonly port: PortPrets) {}

  lire(): Observable<PretsSejourVue> {
    return this.suivre(this.port.lire());
  }

  declarer(d: DemandeDeclarationPret): Observable<PretsSejourVue> {
    return this.suivre(this.port.declarer(d));
  }

  annuler(pretId: number): Observable<PretsSejourVue> {
    return this.suivre(this.port.annuler(pretId));
  }

  rienEmprunte(rien: boolean): Observable<PretsSejourVue> {
    return this.suivre(this.port.rienEmprunte(rien));
  }

  private suivre(appel: Observable<PretsSejourVue>): Observable<PretsSejourVue> {
    return appel.pipe(tap(v => this.vue.set(v)));
  }
}
