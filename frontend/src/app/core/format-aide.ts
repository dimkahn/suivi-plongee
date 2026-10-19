import { Injectable, signal } from '@angular/core';
import { MAGASIN_CACHE, ecrire, lire } from './base-locale';
import type { FichiersVideo, Video } from '../features/videos/catalogue';

/**
 * Les vidéos d'aide sont tournées au format téléphone et au format
 * ordinateur, et les manuels ont des passages propres à chacun (« Plus »
 * en bas de l'écran ou le menu en haut). L'utilisateur choisit celui qu'il
 * veut voir (choix du club, 2026) ; par défaut, celui de son appareil.
 */
export type FormatAide = 'telephone' | 'ordinateur';

export const FORMATS_AIDE: { valeur: FormatAide; libelle: string }[] = [
  { valeur: 'telephone', libelle: 'Téléphone' },
  { valeur: 'ordinateur', libelle: 'Ordinateur' }
];

/** Même limite que la barre d'onglets de l'appli (860 px) : en dessous, l'appli est celle du téléphone. */
export function formatParDefaut(largeur: number): FormatAide {
  return largeur <= 860 ? 'telephone' : 'ordinateur';
}

/** Les fichiers à montrer : ceux du format voulu, sinon ceux de l'autre ; null si la vidéo n'est pas tournée. */
export function fichiersVideo(v: Video, voulu: FormatAide): (FichiersVideo & { format: FormatAide }) | null {
  if (!v.formats) {
    // Catalogue d'avant les deux formats : une seule vidéo, dans le format du scénario.
    if (!v.webm && !v.mp4) return null;
    return { format: v.format, webm: v.webm, mp4: v.mp4, vignette: v.vignette, duree: v.duree,
             version: v.version, texte: v.texte, voix: v.voix };
  }
  const autre: FormatAide = voulu === 'telephone' ? 'ordinateur' : 'telephone';
  for (const format of [voulu, autre]) {
    const f = v.formats[format];
    if (f && (f.webm || f.mp4)) return { format, ...f };
  }
  return null;
}

const CLE = 'preference:format-aide';

/** Le format choisi, gardé sur l'appareil (IndexedDB, comme le reste : pas de localStorage). */
@Injectable({ providedIn: 'root' })
export class FormatAideService {
  readonly format = signal<FormatAide>(formatParDefaut(typeof window === 'undefined' ? 1280 : window.innerWidth));

  constructor() {
    lire<{ cle: string; valeur: FormatAide }>(MAGASIN_CACHE, CLE)
      .then(e => { if (e?.valeur === 'telephone' || e?.valeur === 'ordinateur') this.format.set(e.valeur); })
      .catch(() => { /* navigateur sans IndexedDB : le format de l'appareil */ });
  }

  choisir(format: FormatAide): void {
    this.format.set(format);
    void ecrire(MAGASIN_CACHE, { cle: CLE, valeur: format, majLe: Date.now() }).catch(() => {});
  }
}
