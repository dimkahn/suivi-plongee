import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Fichiers des vidéos, hors de l'appli : servis par Caddy depuis un dossier
 * du serveur (VIDEOS dans le .env, voir docker-compose.prod.yml), publiés
 * par outils/videos/publier.sh. En développement, ng serve les relaie vers
 * outils/videos/apercu.mjs (proxy.conf.json).
 */
export const DOSSIER_VIDEOS = '/medias/videos/';

/** Une vidéo de catalogue.json, écrit par outils/videos/enregistrer.mjs. */
export interface Video {
  id: string;
  titre: string;
  public: string;
  resume: string;
  format: 'telephone' | 'ordinateur';
  webm: string | null;
  mp4: string | null;
  vignette: string | null;
  duree: number | null;
  /** Les sous-titres de la vidéo, dans l'ordre : sa transcription. */
  texte?: string[];
  /** Vrai si la vidéo porte la voix off (les sous-titres lus à voix haute). */
  voix?: boolean;
  /**
   * Change à chaque tournage. Ajoutée à l'adresse des fichiers : une vidéo
   * retournée garde son nom, et le navigateur montrerait sinon celle qu'il a
   * en cache.
   */
  version?: string | null;
  /**
   * Chaque vidéo est tournée au format téléphone et au format ordinateur :
   * leurs fichiers, null pour un format pas encore tourné. Absent d'un
   * catalogue d'avant les deux formats (seuls les champs ci-dessus, dans
   * `format`). Lire avec `fichiersVideo` (core/format-aide.ts).
   */
  formats?: Partial<Record<'telephone' | 'ordinateur', FichiersVideo | null>>;
}

/** Les fichiers d'une vidéo dans un format. */
export interface FichiersVideo {
  webm: string | null;
  mp4: string | null;
  vignette: string | null;
  duree: number | null;
  texte?: string[];
  voix?: boolean;
  version?: string | null;
}

export interface Catalogue {
  publics: string[];
  videos: Video[];
}

/** Le catalogue publié ; une erreur s'il ne l'est pas encore. */
export function chargerCatalogue(http: HttpClient): Promise<Catalogue> {
  return firstValueFrom(http.get<Catalogue>(DOSSIER_VIDEOS + 'catalogue.json'));
}

/** Adresse d'un fichier (vidéo ou aperçu) de la vidéo `v` (ou de ses fichiers d'un format), avec sa version. */
export function urlVideo(fichier: string, v: { version?: string | null }): string {
  return DOSSIER_VIDEOS + encodeURIComponent(fichier) + (v.version ? '?v=' + encodeURIComponent(v.version) : '');
}

export function dureeVideo(secondes: number): string {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return m > 0 ? `${m} min ${String(s).padStart(2, '0')}` : `${s} s`;
}
