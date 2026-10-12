import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { MAGASIN_CACHE, ecrire, lire } from './base-locale';

/**
 * Identité de la structure (une installation par club ou centre) : nom,
 * texte d'accueil, couleurs, logo. Un champ null reprend l'identité
 * d'origine (styles.css, logo-club.png) : rien ne change tant que l'admin
 * n'a rien réglé.
 */
export interface IdentiteVue {
  nom: string | null;
  nomCourt: string | null;
  presentation: string | null;
  couleurPrincipale: string | null;
  couleurFoncee: string | null;
  couleurAccent: string | null;
  logoPersonnalise: boolean;
  /** Change à chaque modification : casse le cache du logo et des icônes. */
  version: number;
}

export type DemandeIdentite = Omit<IdentiteVue, 'logoPersonnalise' | 'version'>;

const CLE_CACHE = 'identite';
const TITRE_ORIGINE = 'Suivi des formations';

/**
 * Lue au démarrage, sans connexion (page de connexion comprise), gardée sur
 * l'appareil pour le hors ligne, puis appliquée à la page : couleurs (jetons
 * de styles.css), titre de l'onglet, manifeste de l'appli installable.
 */
@Injectable({ providedIn: 'root' })
export class IdentiteService {
  private http = inject(HttpClient);

  readonly identite = signal<IdentiteVue | null>(null);

  /** Logo déposé (adresse versionnée) ou celui embarqué dans l'appli. */
  readonly logo = computed(() => {
    const i = this.identite();
    return i?.logoPersonnalise ? `/api/identite/logo.png?v=${i.version}` : 'logo-club.png';
  });

  /** Nom de la structure, ou null : l'écran garde alors ses textes d'origine. */
  readonly nom = computed(() => this.identite()?.nom ?? null);

  async charger(): Promise<void> {
    try {
      const i = await firstValueFrom(this.http.get<IdentiteVue>('/api/identite'));
      await ecrire(MAGASIN_CACHE, { cle: CLE_CACHE, valeur: i, majLe: Date.now() });
      this.appliquer(i);
    } catch {
      const garde = await lire<{ valeur: IdentiteVue }>(MAGASIN_CACHE, CLE_CACHE).catch(() => undefined);
      if (garde) this.appliquer(garde.valeur);
    }
  }

  modifier(demande: DemandeIdentite): Observable<IdentiteVue> {
    return this.http.put<IdentiteVue>('/api/identite', demande);
  }

  deposerLogo(fichier: Blob): Observable<IdentiteVue> {
    const corps = new FormData();
    corps.append('fichier', fichier);
    return this.http.put<IdentiteVue>('/api/identite/logo', corps);
  }

  supprimerLogo(): Observable<IdentiteVue> {
    return this.http.delete<IdentiteVue>('/api/identite/logo');
  }

  /** Après une modification : la page prend tout de suite la nouvelle identité. */
  appliquer(i: IdentiteVue): void {
    this.identite.set(i);
    const racine = document.documentElement.style;
    const jeton = (nom: string, valeur: string | null) =>
      valeur ? racine.setProperty(nom, valeur) : racine.removeProperty(nom);
    jeton('--profond', i.couleurPrincipale);
    jeton('--profond-fonce', i.couleurFoncee);
    jeton('--accent', i.couleurAccent);
    jeton('--accent-clair', i.couleurAccent ? `color-mix(in srgb, ${i.couleurAccent} 55%, white)` : null);
    jeton('--ombre', i.couleurPrincipale
      ? `0 4px 24px color-mix(in srgb, ${i.couleurPrincipale} 15%, transparent)` : null);

    document.title = i.nom ? `${TITRE_ORIGINE} – ${i.nom}` : TITRE_ORIGINE;
    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (theme) theme.content = i.couleurFoncee ?? '#0C3547';

    // L'appli installée prend le nom, la couleur et le logo de la structure ;
    // sans réglage, le manifeste d'origine reste en place.
    const personnalisee = !!(i.nom || i.nomCourt || i.couleurFoncee || i.logoPersonnalise);
    const manifeste = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (manifeste) {
      manifeste.href = personnalisee ? `/api/identite/manifest.webmanifest?v=${i.version}` : 'manifest.webmanifest';
    }
    const pomme = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (pomme) {
      pomme.href = i.logoPersonnalise ? `/api/identite/icone/180.png?v=${i.version}` : 'icones/apple-touch-icon.png';
    }
  }
}
