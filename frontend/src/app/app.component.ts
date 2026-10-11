import { Component, ViewChild, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { FileAttenteService } from './core/file-attente.service';
import { FileEcrituresService } from './core/file-ecritures.service';
import { MiseAJourService } from './core/mise-a-jour.service';
import { BandeauSyncComponent } from './features/synchronisation/bandeau-sync.component';
import { DialogueComponent } from './core/dialogue.component';

/**
 * Tag déployé, fixé à la compilation (`ng build --define`, voir le
 * Dockerfile du frontend) ; « dev » hors des images de production. Avec le
 * service worker, c'est la version réellement chargée sur le téléphone.
 */
declare const VERSION_APPLI: string;

/** Un onglet de la barre du bas (téléphone) : les écrans de tous les jours, au pouce. */
interface Onglet {
  lien: string;
  libelle: string;
  /** Tracé SVG (24 × 24, trait) de l'icône. */
  icone: string;
}

const ICONES = {
  presences: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  eleves: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  planning: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
  materiel: 'M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7',
  formation: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  aide: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01'
};

@Component({
  selector: 'app-racine',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BandeauSyncComponent, DialogueComponent],
  host: { '(document:keydown.escape)': 'fermerMenu()' },
  template: `
    @if (pret()) {
      @if (auth.connecte()) {
        <header>
          <a routerLink="/" class="marque" (click)="fermerMenu()">
            <img src="logo-club.png" alt="" width="44" height="44">
            <span>Suivi des formations</span>
          </a>

          <!-- Tout le menu. Sur grand écran, dans l'en-tête ; sur téléphone, il s'ouvre au-dessus
               de la barre du bas par « Plus ». -->
          <nav id="menu-principal" class="identite" [class.ouvert]="menuOuvert()" aria-label="Menu">
            @if (auth.estMoniteur() || auth.estAdmin()) {
              <a routerLink="/eleves" routerLinkActive="actif" class="bouton-discret" (click)="fermerMenu()">
                Infos élèves
              </a>
              <a routerLink="/planning" routerLinkActive="actif" class="bouton-discret" (click)="fermerMenu()">
                Planning
              </a>
              <a routerLink="/presences" routerLinkActive="actif" class="bouton-discret" (click)="fermerMenu()">
                Présences
              </a>
              <a routerLink="/trombinoscope" routerLinkActive="actif" class="bouton-discret" (click)="fermerMenu()">
                Trombinoscope
              </a>
              <a routerLink="/fiches-securite" routerLinkActive="actif" class="bouton-discret" (click)="fermerMenu()">
                Fiches de sécurité
              </a>
              <a routerLink="/groupes" routerLinkActive="actif" class="bouton-discret" (click)="fermerMenu()">
                Groupes
              </a>
            }
            @if (auth.inspecteBlocs()) {
              <a routerLink="/materiel" routerLinkActive="actif" class="bouton-discret" (click)="fermerMenu()">
                Matériel
              </a>
            }
            @if (auth.estAdmin()) {
              <a routerLink="/admin" routerLinkActive="actif" class="bouton-discret" (click)="fermerMenu()">
                Administration
              </a>
            }
            <span class="separateur" aria-hidden="true"></span>
            @if (auth.estMoniteur()) {
              <button type="button" class="bouton-discret" (click)="bandeau?.precharger(); fermerMenu()">
                Préparer hors ligne
              </button>
            }
            <a routerLink="/aide" routerLinkActive="actif" class="bouton-discret" (click)="fermerMenu()"
               title="Questions fréquentes, manuels et vidéos d'aide">
              Aide
            </a>
            <a routerLink="/mon-compte" routerLinkActive="actif" class="qui" (click)="fermerMenu()"
               title="Mon compte : nom, e-mail, mot de passe">
              {{ auth.session()?.nomComplet }}
              @if (auth.niveau(); as n) { <span class="niveau">{{ n }}</span> }
            </a>
            <button type="button" class="bouton-discret" (click)="deconnecter(); fermerMenu()">
              Se déconnecter
            </button>
          </nav>
        </header>

        @if (menuOuvert()) {
          <div class="voile" aria-hidden="true" (click)="fermerMenu()"></div>
        }
        <nav class="onglets" aria-label="Accès rapide">
          @for (o of onglets(); track o.lien) {
            <a [routerLink]="o.lien" routerLinkActive="actif" class="onglet" (click)="fermerMenu()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="o.icone" /></svg>
              <span>{{ o.libelle }}</span>
            </a>
          }
          <button type="button" class="onglet" [class.actif]="menuOuvert()" aria-controls="menu-principal"
                  [attr.aria-expanded]="menuOuvert()" (click)="menuOuvert.set(!menuOuvert())">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path [attr.d]="menuOuvert() ? 'M6 6l12 12M18 6L6 18' : 'M4 6h16M4 12h16M4 18h16'" />
            </svg>
            <span>Plus</span>
          </button>
        </nav>
      }

      @if (miseAJour.disponible()) {
        <div class="bandeau-version" role="status">
          <span>Une nouvelle version de l'application est disponible.</span>
          <button type="button" (click)="miseAJour.appliquer()">Mettre à jour</button>
        </div>
      }

      <app-bandeau-sync />

      <main [class.avec-onglets]="auth.connecte()"><router-outlet /></main>
      <footer class="version" [class.avec-onglets]="auth.connecte()">Version {{ version }}</footer>

      <app-dialogue [ouvert]="confirmationDeconnexion()" titre="Se déconnecter ?"
                    (fermer)="confirmationDeconnexion.set(false)">
        <p>
          {{ enAttente() > 1 ? enAttente() + ' saisies ne sont pas encore envoyées.'
                             : 'Une saisie n’est pas encore envoyée.' }}
          Elles restent sur cet appareil et partiront à votre prochaine connexion, avec du réseau.
        </p>
        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" (click)="confirmationDeconnexion.set(false)">
            Rester connecté
          </button>
          <button type="button" class="bouton-discret" (click)="confirmerDeconnexion()">Se déconnecter quand même</button>
        </div>
      </app-dialogue>
    } @else {
      <p class="vide">Ouverture de la session…</p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    header {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--pas-2); position: relative;
      padding: var(--pas-2) var(--pas-3);
      background: linear-gradient(135deg, var(--profond-fonce), var(--profond)); color: #fff;
    }
    .marque {
      display: flex; align-items: center; gap: var(--pas); min-height: 44px;
      color: #fff; text-decoration: none; font-weight: 700;
    }
    .marque img { flex: none; width: 44px; height: 44px; }

    .identite { display: flex; align-items: center; gap: var(--pas-2); font-size: .9375rem; flex-wrap: wrap; }
    .identite .bouton-discret {
      background: transparent; color: #fff; border-color: rgba(255,255,255,.4);
      text-decoration: none;
    }
    .identite .bouton-discret.actif {
      background: rgba(255,255,255,.18); border-color: #fff; font-weight: 700;
    }
    .separateur { display: none; }
    .qui {
      display: flex; align-items: center; gap: var(--pas); min-height: 44px;
      color: #fff; text-decoration: underline; text-decoration-color: rgba(255,255,255,.4);
      text-underline-offset: 4px;
    }
    .qui.actif { font-weight: 700; text-decoration-color: #fff; }
    .niveau {
      border: 1px solid rgba(255,255,255,.5); border-radius: var(--r-s);
      padding: 2px 8px; font-weight: 700; font-size: .8125rem;
    }
    /* La barre du bas n'existe que sur téléphone. */
    .onglets, .voile { display: none; }
    .bandeau-version {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--pas-2); flex-wrap: wrap;
      padding: 10px var(--pas-3); font-size: .9375rem;
      background: var(--en-cours-clair); color: var(--en-cours);
    }
    .bandeau-version button { min-height: 44px; }
    main { max-width: 1120px; margin: 0 auto; padding: var(--pas-3); }
    .version { text-align: center; color: var(--craie); font-size: 0.75rem; padding: var(--pas-2); }
    @media (max-width: 600px) { main { padding: var(--pas-2); } }

    /*
     * Sous 860px, une barre d'onglets en bas d'écran, à portée du pouce : les
     * écrans de tous les jours, et « Plus » qui ouvre le reste du menu
     * au-dessus d'elle (plutôt qu'un menu en haut, loin de la main).
     */
    @media (max-width: 860px) {
      header { padding: var(--pas) var(--pas-2); }
      .identite {
        display: none; position: fixed; left: 0; right: 0; z-index: 31;
        bottom: var(--hauteur-onglets);
        max-height: calc(100dvh - var(--hauteur-onglets) - 48px); overflow-y: auto;
        flex-direction: column; align-items: stretch; flex-wrap: nowrap; gap: 0;
        background: var(--profond-fonce); padding: var(--pas) var(--pas-3);
        border-radius: var(--r) var(--r) 0 0; box-shadow: 0 -8px 16px rgba(0,0,0,.25);
      }
      .identite.ouvert { display: flex; }
      .identite .bouton-discret {
        justify-content: flex-start; text-align: left; width: 100%; border: none; border-radius: 0;
        padding: var(--pas-2) 0; border-bottom: 1px solid rgba(255,255,255,.15);
      }
      .separateur { display: block; height: var(--pas-2); }
      .qui { padding: var(--pas-2) 0; border-bottom: 1px solid rgba(255,255,255,.15); }

      .voile { display: block; position: fixed; inset: 0; z-index: 30; background: rgba(15, 23, 42, .4); }
      .onglets {
        display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 32;
        padding-bottom: env(safe-area-inset-bottom, 0px);
        background: var(--carte); border-top: 1px solid var(--trait);
        box-shadow: 0 -4px 12px rgba(15, 23, 42, .08);
      }
      .onglet {
        flex: 1 1 0; min-width: 0; height: 64px; padding: 6px 2px 4px;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
        border: none; border-radius: 0; background: none; color: var(--craie);
        font: inherit; font-size: .75rem; font-weight: 700; text-decoration: none;
      }
      .onglet span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .onglet svg {
        width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2;
        stroke-linecap: round; stroke-linejoin: round;
      }
      .onglet.actif { color: var(--profond); }
      .onglet.actif svg { stroke-width: 2.5; }
      /* La page ne passe pas sous la barre. */
      main.avec-onglets { padding-bottom: calc(var(--pas-3) + var(--hauteur-onglets)); }
      .version.avec-onglets { display: none; }
    }
  `]
})
export class AppComponent {
  readonly version = VERSION_APPLI;
  auth = inject(AuthService);
  private file = inject(FileAttenteService);
  private ecritures = inject(FileEcrituresService);
  miseAJour = inject(MiseAJourService);

  @ViewChild(BandeauSyncComponent) bandeau?: BandeauSyncComponent;

  pret = this.auth.sessionResolue;
  menuOuvert = signal(false);

  /** Trois onglets au plus, selon le compte ; « Plus » donne tout le reste. */
  readonly onglets = computed<Onglet[]>(() => {
    if (this.auth.estMoniteur() || this.auth.estAdmin()) {
      return [
        { lien: '/presences', libelle: 'Présences', icone: ICONES.presences },
        { lien: '/eleves', libelle: 'Élèves', icone: ICONES.eleves },
        { lien: '/planning', libelle: 'Planning', icone: ICONES.planning }
      ];
    }
    if (this.auth.inspecteBlocs()) {
      return [{ lien: '/materiel', libelle: 'Matériel', icone: ICONES.materiel },
              { lien: '/aide', libelle: 'Aide', icone: ICONES.aide }];
    }
    return [{ lien: '/cursus', libelle: 'Ma formation', icone: ICONES.formation },
            { lien: '/aide', libelle: 'Aide', icone: ICONES.aide }];
  });

  constructor() {
    // La file démarre avant l'authentification : des saisies peuvent attendre
    // depuis la session précédente, et il faut les compter même si le
    // rafraîchissement du jeton échoue.
    void this.file.demarrer();
    void this.ecritures.demarrer();

    this.auth.initialiser();
    this.miseAJour.demarrer();
  }

  fermerMenu(): void {
    this.menuOuvert.set(false);
  }

  /** Saisies pas encore envoyées : on prévient plutôt que de les laisser en plan sans le dire. */
  readonly enAttente = computed(() => this.file.enAttente().length + this.ecritures.enAttente().length);
  confirmationDeconnexion = signal(false);

  deconnecter(): void {
    if (this.enAttente() > 0) {
      this.confirmationDeconnexion.set(true);
      return;
    }
    this.auth.deconnexion();
  }

  confirmerDeconnexion(): void {
    this.confirmationDeconnexion.set(false);
    this.auth.deconnexion();
  }
}
