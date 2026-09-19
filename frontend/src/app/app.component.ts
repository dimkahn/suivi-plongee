import { Component, ViewChild, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { FileAttenteService } from './core/file-attente.service';
import { BandeauSyncComponent } from './features/synchronisation/bandeau-sync.component';

@Component({
  selector: 'app-racine',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BandeauSyncComponent],
  template: `
    @if (pret()) {
      @if (auth.connecte()) {
        <header>
          <a routerLink="/cursus" class="marque" (click)="fermerMenu()">Suivi des formations</a>

          <button type="button" class="bouton-menu" (click)="menuOuvert.set(!menuOuvert())"
                  [attr.aria-expanded]="menuOuvert()" aria-controls="menu-principal" aria-label="Menu">
            <span class="barres" [class.ouvert]="menuOuvert()"></span>
          </button>

          <nav id="menu-principal" class="identite" [class.ouvert]="menuOuvert()">
            @if (auth.estMoniteur() || auth.estAdmin()) {
              <a routerLink="/eleves" routerLinkActive="actif" class="bouton-discret" (click)="fermerMenu()">
                Infos élèves
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
            @if (auth.estAdmin()) {
              <a routerLink="/seances" routerLinkActive="actif" class="bouton-discret" (click)="fermerMenu()">
                Séances
              </a>
              <a routerLink="/admin" routerLinkActive="actif" class="bouton-discret" (click)="fermerMenu()">
                Administration
              </a>
            }
            @if (auth.estMoniteur()) {
              <button type="button" class="bouton-discret" (click)="bandeau?.precharger(); fermerMenu()">
                Préparer hors ligne
              </button>
            }
            <span class="qui">
              {{ auth.session()?.nomComplet }}
              @if (auth.niveau(); as n) { <span class="niveau">{{ n }}</span> }
            </span>
            <button type="button" class="bouton-discret" (click)="deconnecter(); fermerMenu()">
              Se déconnecter
            </button>
          </nav>
        </header>
      }

      <app-bandeau-sync />

      <main><router-outlet /></main>
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
    .marque { color: #fff; text-decoration: none; font-weight: 700; }

    .bouton-menu {
      display: none; width: 44px; height: 44px; padding: 0; flex: none;
      background: transparent; border: 1px solid rgba(255,255,255,.4); border-radius: var(--r-s);
      align-items: center; justify-content: center;
    }
    .barres, .barres::before, .barres::after {
      display: block; width: 20px; height: 2px; background: #fff; border-radius: 1px;
      transition: transform .2s ease, opacity .2s ease;
    }
    .barres { position: relative; }
    .barres::before, .barres::after { content: ''; position: absolute; left: 0; }
    .barres::before { top: -6px; }
    .barres::after { top: 6px; }
    .barres.ouvert { background: transparent; }
    .barres.ouvert::before { top: 0; transform: rotate(45deg); }
    .barres.ouvert::after { top: 0; transform: rotate(-45deg); }

    .identite { display: flex; align-items: center; gap: var(--pas-2); font-size: .9375rem; flex-wrap: wrap; }
    .identite .bouton-discret {
      background: transparent; color: #fff; border-color: rgba(255,255,255,.4);
      text-decoration: none;
    }
    .identite .bouton-discret.actif {
      background: rgba(255,255,255,.18); border-color: #fff; font-weight: 700;
    }
    .qui { display: flex; align-items: center; gap: var(--pas); }
    .niveau {
      border: 1px solid rgba(255,255,255,.5); border-radius: var(--r-s);
      padding: 2px 8px; font-weight: 700; font-size: .8125rem;
    }
    main { max-width: 1120px; margin: 0 auto; padding: var(--pas-3); }
    @media (max-width: 600px) { main { padding: var(--pas-2); } }

    /* Sous 860px, le menu passe derriere un bouton plutot que de se
       tasser en enchainant les retours a la ligne dans le header. */
    @media (max-width: 860px) {
      .bouton-menu { display: flex; }
      .identite {
        display: none; position: absolute; top: 100%; left: 0; right: 0; z-index: 10;
        flex-direction: column; align-items: stretch; gap: 0;
        background: var(--profond-fonce); padding: var(--pas-2) var(--pas-3);
        box-shadow: 0 8px 16px rgba(0,0,0,.2);
      }
      .identite.ouvert { display: flex; }
      .identite .bouton-discret {
        justify-content: flex-start; text-align: left; width: 100%; border: none; border-radius: 0;
        padding: var(--pas-2) 0; border-bottom: 1px solid rgba(255,255,255,.15);
      }
      .qui { padding: var(--pas-2) 0; border-bottom: 1px solid rgba(255,255,255,.15); }
    }
  `]
})
export class AppComponent {
  auth = inject(AuthService);
  private file = inject(FileAttenteService);

  @ViewChild(BandeauSyncComponent) bandeau?: BandeauSyncComponent;

  pret = this.auth.sessionResolue;
  menuOuvert = signal(false);

  constructor() {
    // La file démarre avant l'authentification : des saisies peuvent attendre
    // depuis la session précédente, et il faut les compter même si le
    // rafraîchissement du jeton échoue.
    void this.file.demarrer();

    this.auth.initialiser();
  }

  fermerMenu(): void {
    this.menuOuvert.set(false);
  }

  /** On prévient plutôt que de perdre silencieusement des saisies. */
  deconnecter(): void {
    const attente = this.file.enAttente().length;
    if (attente > 0) {
      const suite = confirm(
        `${attente} saisie(s) ne sont pas encore envoyées. ` +
        `Elles resteront sur cet appareil jusqu'à votre prochaine connexion. Se déconnecter ?`);
      if (!suite) return;
    }
    this.auth.deconnexion();
  }
}
