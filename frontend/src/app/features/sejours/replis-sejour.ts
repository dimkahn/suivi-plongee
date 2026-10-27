import { Injectable, signal } from '@angular/core';
import { MAGASIN_CACHE, ecrire, lire } from '../../core/base-locale';

/** Les encarts du haut de la page du séjour qu'on peut replier pour atteindre plus vite les onglets. */
export type EncartRepliable = 'aujourdhui' | 'mon-sejour';

const CLE = 'preference:replis-sejour';
const ENCARTS: readonly EncartRepliable[] = ['aujourdhui', 'mon-sejour'];

/**
 * Les encarts repliés, gardés sur l'appareil (IndexedDB, comme le reste : pas
 * de localStorage) et valables pour tous les séjours (demande du club, 2026).
 */
@Injectable({ providedIn: 'root' })
export class ReplisSejourService {
  readonly replies = signal<ReadonlySet<EncartRepliable>>(new Set());

  constructor() {
    lire<{ cle: string; valeur: string[] }>(MAGASIN_CACHE, CLE)
      .then(e => {
        if (Array.isArray(e?.valeur)) {
          this.replies.set(new Set(ENCARTS.filter(x => e.valeur.includes(x))));
        }
      })
      .catch(() => { /* navigateur sans IndexedDB : tout déplié */ });
  }

  replie(encart: EncartRepliable): boolean {
    return this.replies().has(encart);
  }

  choisir(encart: EncartRepliable, replie: boolean): void {
    const s = new Set(this.replies());
    if (replie) s.add(encart); else s.delete(encart);
    this.replies.set(s);
    void ecrire(MAGASIN_CACHE, { cle: CLE, valeur: [...s], majLe: Date.now() }).catch(() => {});
  }
}
