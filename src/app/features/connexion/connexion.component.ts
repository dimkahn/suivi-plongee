import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-connexion',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="accueil">
      <div class="carte panneau">
        <h1>Suivi des formations de plongée</h1>
        <p class="secondaire">
          Les compétences N1, N2 et N3 du MFT, saisies au bord du bassin
          et validées par les encadrants du club.
        </p>

        @if (erreur()) { <div class="alerte">{{ erreur() }}</div> }

        <label for="email">Adresse e-mail</label>
        <input id="email" type="email" name="email" autocomplete="username"
               [(ngModel)]="email" (keyup.enter)="connecter()">

        <label for="mdp">Mot de passe</label>
        <input id="mdp" type="password" name="mdp" autocomplete="current-password"
               [(ngModel)]="motDePasse" (keyup.enter)="connecter()">

        <button type="button" class="bouton-principal" (click)="connecter()" [disabled]="envoi()">
          {{ envoi() ? 'Connexion…' : 'Se connecter' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .accueil { min-height: 100dvh; display: grid; place-items: center; padding: var(--pas-3); }
    .panneau { width: 100%; max-width: 420px; padding: var(--pas-4) var(--pas-3); }
    h1 { margin-bottom: var(--pas); font-size: 1.375rem; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .bouton-principal { width: 100%; margin-top: var(--pas-3); }
  `]
})
export class ConnexionComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  motDePasse = '';
  envoi = signal(false);
  erreur = signal<string | null>(null);

  connecter(): void {
    if (!this.email || !this.motDePasse) {
      this.erreur.set('Renseignez votre e-mail et votre mot de passe.');
      return;
    }
    this.envoi.set(true);
    this.erreur.set(null);
    this.auth.connexion(this.email, this.motDePasse).subscribe({
      next: () => this.router.navigate(['/cursus']),
      error: () => {
        this.envoi.set(false);
        this.erreur.set('E-mail ou mot de passe incorrect.');
      }
    });
  }
}
