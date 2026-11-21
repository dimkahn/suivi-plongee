import { Injectable, signal } from '@angular/core';
import { MAGASIN_CACHE, ecrire, lire } from '../../core/base-locale';

/** Les encarts du haut de la page du séjour qu'on peut replier pour atteindre plus vite les onglets. */
export type EncartRepliable = 'aujourdhui' | 'mon-sejour';

const CLE = 'preference:replis-sejour';

/**
 * Replié ou non : le choix gardé sur ce téléphone, sinon (jamais rien choisi)
 * « Mon séjour » replié pour un organisateur, qui vient surtout organiser :
 * sa carte poussait le programme plus de deux écrans plus bas.
 */
export function encartReplie(enregistres: ReadonlySet<EncartRepliable> | null, encart: EncartRepliable,
                             organise: boolean): boolean {
  if (enregistres) return enregistres.has(encart);
  return organise && encart === 'mon-sejour';
}
const ENCARTS: readonly EncartRepliable[] = ['aujourdhui', 'mon-sejour'];

/**
 * Les encarts repliés, gardés sur l'appareil (IndexedDB, comme le reste : pas
 * de localStorage) et valables pour tous les séjours (demande du club, 2026).
 */
@Injectable({ providedIn: 'root' })
export class ReplisSejourService {
  /** Le choix gardé sur ce téléphone ; null tant que rien n'a été choisi (réglage par défaut). */
  readonly replies = signal<ReadonlySet<EncartRepliable> | null>(null);

  constructor() {
    lire<{ cle: string; valeur: string[] }>(MAGASIN_CACHE, CLE)
      .then(e => {
        if (Array.isArray(e?.valeur)) {
          this.replies.set(new Set(ENCARTS.filter(x => e.valeur.includes(x))));
        }
      })
      .catch(() => { /* navigateur sans IndexedDB : tout déplié */ });
  }

  replie(encart: EncartRepliable, organise = false): boolean {
    return encartReplie(this.replies(), encart, organise);
  }

  /** Le premier choix fige aussi l'autre encart tel qu'il est montré. */
  choisir(encart: EncartRepliable, replie: boolean, organise = false): void {
    const s = new Set(ENCARTS.filter(e => this.replie(e, organise)));
    if (replie) s.add(encart); else s.delete(encart);
    this.replies.set(s);
    void ecrire(MAGASIN_CACHE, { cle: CLE, valeur: [...s], majLe: Date.now() }).catch(() => {});
  }
}
