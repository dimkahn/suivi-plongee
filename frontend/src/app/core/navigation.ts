import { DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Params, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from './auth.service';

/** Le lien « ← … » de la barre de page : où remonter depuis l'écran ouvert. */
export interface Retour {
  libelle: string;
  lien: string;
  parametres?: Params;
}

/** Le nom des écrans du menu, pour un retour vers l'un d'eux (?retour=/trombinoscope). */
const NOMS_ECRANS: Record<string, string> = {
  '/aujourdhui': 'Aujourd’hui',
  '/eleves': 'Infos élèves',
  '/planning': 'Planning',
  '/presences': 'Présences',
  '/trombinoscope': 'Trombinoscope',
  '/fiches-securite': 'Fiches de sécurité',
  '/groupes': 'Groupes',
  '/sejours': 'Séjours',
  '/parcours': 'Parcours de formation',
  '/materiel': 'Matériel',
  '/admin': 'Administration',
  '/cursus': 'Ma formation'
};

/**
 * Le chemin de retour de chaque écran, au même endroit pour toute l'appli :
 * on remonte toujours d'un cran dans l'arborescence (la fiche d'un bloc vers
 * le Matériel, la vue globale vers la fiche de suivi), jamais à la page
 * vue juste avant, qui dépend du chemin pris. Les écrans du menu n'ont pas
 * de retour : le menu y mène. Le contexte utile (séance, groupe) suit dans
 * les paramètres de l'adresse.
 *
 * Un écran qui ne connaît son parent qu'une fois chargé (la fiche
 * d'inspection TIV, rattachée à un bloc) le précise par `preciserRetour`.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private router = inject(Router);
  private auth = inject(AuthService);

  private url = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url }
  );

  /** L'adresse de l'écran ouvert, sans paramètres : « /cursus/12 ». */
  readonly chemin = computed(() => this.url().split(/[?#]/)[0]);
  private parametres = computed(() => this.router.parseUrl(this.url()).queryParams);

  private precise = signal<Signal<Retour | null> | null>(null);

  readonly retour = computed<Retour | null>(() => {
    const precise = this.precise()?.();
    if (precise) return precise;
    return this.retourParDefaut(this.chemin().split('/').filter(s => s), this.parametres());
  });

  /**
   * Pour l'écran qui l'appelle (dans son constructeur), le retour devient
   * `retour` tant qu'il est ouvert ; null : celui par défaut.
   */
  preciserRetour(retour: Signal<Retour | null>): void {
    this.precise.set(retour);
    inject(DestroyRef).onDestroy(() => {
      if (this.precise() === retour) this.precise.set(null);
    });
  }

  private retourParDefaut(s: string[], q: Params): Retour | null {
    const encadrant = this.auth.estMoniteur() || this.auth.estAdmin();
    const connecte = this.auth.connecte();
    const presences = (seance: unknown, groupe: unknown): Retour => ({
      libelle: 'Feuille de présence', lien: '/presences',
      parametres: { seance: seance ?? null, groupe: /^\d+$/.test(String(groupe ?? '')) ? groupe : null }
    });

    switch (s[0]) {
      case 'reinitialiser-mot-de-passe':
        return { libelle: 'Connexion', lien: '/connexion' };
      case 'aide':
        if (q['m']) return { libelle: 'Toutes les questions', lien: '/aide', parametres: { q: q['q'] ?? null } };
        return connecte ? null : { libelle: 'Se connecter', lien: '/connexion' };
      case 'videos':
        return connecte ? { libelle: 'Aide', lien: '/aide' } : { libelle: 'Se connecter', lien: '/connexion' };

      case 'cursus':
        if (s.length === 2) {
          if (q['depuis'] === 'presences') return presences(q['seance'], q['groupe']);
          return encadrant ? { libelle: 'Infos élèves', lien: '/eleves' } : { libelle: 'Ma formation', lien: '/cursus' };
        }
        // Vue globale, synthèse : la fiche de suivi, avec la séance et l'origine qu'elle avait.
        if (s.length === 3) return { libelle: 'Fiche de suivi', lien: `/cursus/${s[1]}`, parametres: q };
        return null;
      case 'seances':
        return s.length === 3 ? presences(s[1], q['groupe']) : null;
      case 'exercices':
        return { libelle: 'Parcours de formation', lien: '/parcours' };
      case 'fiches-securite':
        if (s.length === 2) return { libelle: 'Fiches de sécurité', lien: '/fiches-securite' };
        // La sécurité surface n'ouvre pas la fiche elle-même : elle remonte à la liste.
        if (s.length === 3) return encadrant
          ? { libelle: 'Fiche de sécurité', lien: `/fiches-securite/${s[1]}` }
          : { libelle: 'Fiches de sécurité', lien: '/fiches-securite' };
        return null;
      case 'sejours':
        return s.length === 2 ? { libelle: 'Séjours', lien: '/sejours' } : null;
      case 'groupes':
        return { libelle: 'Séjours', lien: '/sejours' };
      case 'groupes-entrainement':
        return { libelle: 'Infos élèves', lien: '/eleves', parametres: { groupe: q['groupe'] ?? null } };

      case 'admin': {
        if (s.length === 1) return null;
        const retour = typeof q['retour'] === 'string' ? q['retour'] : '';
        if (retour.startsWith('/') && !retour.startsWith('//')) {
          const [lien, requete] = retour.split('?');
          return {
            libelle: NOMS_ECRANS[lien] ?? 'Retour', lien,
            parametres: Object.fromEntries(new URLSearchParams(requete ?? ''))
          };
        }
        if (s[1] === 'seances' && s[2] === 'generer') return { libelle: 'Séances', lien: '/admin/seances' };
        // Les sorties sont ouvertes au directeur technique, qui n'a pas l'administration.
        if (s[1] === 'sorties' && !this.auth.estAdmin()) return { libelle: 'Prêts de matériel', lien: '/materiel/prets' };
        return { libelle: 'Administration', lien: '/admin' };
      }

      case 'materiel':
        // L'administrateur l'ouvre depuis « Administration » ; le DT et le TIV, depuis le menu.
        if (s.length === 1) return this.auth.estAdmin() ? { libelle: 'Administration', lien: '/admin' } : null;
        if (s.length === 3 && s[2] === 'tiv') return { libelle: 'Fiche du bloc', lien: `/materiel/${s[1]}` };
        return { libelle: 'Matériel', lien: '/materiel' };

      default:
        return null;
    }
  }
}
