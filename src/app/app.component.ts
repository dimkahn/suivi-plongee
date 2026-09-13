import { Component, ViewChild, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { FileAttenteService } from './core/file-attente.service';
import { BandeauSyncComponent } from './features/synchronisation/bandeau-sync.component';

@Component({
  selector: 'app-racine',
  imports: [RouterOutlet, RouterLink, BandeauSyncComponent],
  template: `
    @if (pret()) {
      @if (auth.connecte()) {
        <header>
          <a routerLink="/cursus" class="marque">Suivi des formations</a>
          <div class="identite">
            @if (auth.estMoniteur()) {
              <button type="button" class="bouton-discret" (click)="bandeau?.precharger()">
                Préparer hors ligne
              </button>
            }
            <span>{{ auth.session()?.nomComplet }}</span>
            @if (auth.niveau(); as n) { <span class="niveau">{{ n }}</span> }
            <button type="button" class="bouton-discret" (click)="deconnecter()">
              Se déconnecter
            </button>
          </div>
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
      gap: var(--pas-2); flex-wrap: wrap;
      padding: var(--pas-2) var(--pas-3);
      background: var(--profond); color: #fff;
    }
    .marque { color: #fff; text-decoration: none; font-weight: 700; }
    .identite { display: flex; align-items: center; gap: var(--pas-2); font-size: .9375rem; }
    .identite .bouton-discret { background: transparent; color: #fff; border-color: rgba(255,255,255,.4); }
    .niveau {
      border: 1px solid rgba(255,255,255,.5); border-radius: var(--r-s);
      padding: 2px 8px; font-weight: 700; font-size: .8125rem;
    }
    main { max-width: 1120px; margin: 0 auto; padding: var(--pas-3); }
    @media (max-width: 600px) { main { padding: var(--pas-2); } }
  `]
})
export class AppComponent {
  auth = inject(AuthService);
  private file = inject(FileAttenteService);

  @ViewChild(BandeauSyncComponent) bandeau?: BandeauSyncComponent;

  pret = signal(false);

  constructor() {
    // La file démarre avant l'authentification : des saisies peuvent attendre
    // depuis la session précédente, et il faut les compter même si le
    // rafraîchissement du jeton échoue.
    void this.file.demarrer();

    this.auth.reprendre().subscribe({
      next: () => this.pret.set(true),
      error: () => this.pret.set(true)
    });
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
