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
}

export interface Catalogue {
  publics: string[];
  videos: Video[];
}

/** Le catalogue publié ; une erreur s'il ne l'est pas encore. */
export function chargerCatalogue(http: HttpClient): Promise<Catalogue> {
  return firstValueFrom(http.get<Catalogue>(DOSSIER_VIDEOS + 'catalogue.json'));
}

export function urlVideo(fichier: string): string {
  return DOSSIER_VIDEOS + encodeURIComponent(fichier);
}

export function dureeVideo(secondes: number): string {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return m > 0 ? `${m} min ${String(s).padStart(2, '0')}` : `${s} s`;
}
