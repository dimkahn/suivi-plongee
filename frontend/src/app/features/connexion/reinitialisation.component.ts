import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

/**
 * Cible du lien envoyé par « mot de passe oublié » ou par l'invitation d'un
 * moniteur créé par un ADMIN (même mécanisme de jeton pour les deux).
 */
@Component({
  selector: 'app-reinitialisation',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="accueil">
      <div class="carte panneau">
        <h1>{{ invitation() ? 'Bienvenue : choisissez votre mot de passe' : 'Choisir un mot de passe' }}</h1>
        @if (invitation() && !jetonAbsent() && !succes()) {
          <p class="secondaire">
            Votre compte moniteur a été créé. Choisissez votre mot de passe pour l'activer.
          </p>
        }

        @if (jetonAbsent()) {
          <div class="alerte">
            Ce lien est incomplet. Redemandez un lien de réinitialisation
            depuis l'écran de connexion.
          </div>
        } @else if (succes()) {
          <div class="succes">
            Mot de passe enregistré. Vous pouvez maintenant vous connecter.
          </div>
          <a routerLink="/connexion" class="bouton-principal">Se connecter</a>
        } @else {
          @if (erreur()) { <div class="alerte">{{ erreur() }}</div> }

          <p class="secondaire">Au moins 10 caractères.</p>

          <label for="mdp">Nouveau mot de passe</label>
          <input id="mdp" type="password" name="mdp" autocomplete="new-password"
                 [(ngModel)]="motDePasse" (keyup.enter)="valider()">

          <label for="mdp2">Confirmer le mot de passe</label>
          <input id="mdp2" type="password" name="mdp2" autocomplete="new-password"
                 [(ngModel)]="confirmation" (keyup.enter)="valider()">

          <button type="button" class="bouton-principal" (click)="valider()" [disabled]="envoi()">
            {{ envoi() ? 'Enregistrement…' : 'Enregistrer le mot de passe' }}
          </button>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .accueil { min-height: 100dvh; display: grid; place-items: center; padding: var(--pas-3); }
    .panneau { width: 100%; max-width: 420px; padding: var(--pas-4) var(--pas-3); }
    h1 { margin-bottom: var(--pas); font-size: 1.375rem; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .bouton-principal {
      display: block; width: 100%; margin-top: var(--pas-3); text-align: center;
      text-decoration: none;
    }
    .succes {
      background: #e6f4ea; color: #1e4620; border-radius: var(--r-s); padding: var(--pas-2);
    }
  `]
})
export class ReinitialisationComponent {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  private jeton = this.route.snapshot.queryParamMap.get('jeton');
  jetonAbsent = signal(!this.jeton);
  invitation = signal(this.route.snapshot.queryParamMap.get('invitation') === '1');

  motDePasse = '';
  confirmation = '';
  envoi = signal(false);
  erreur = signal<string | null>(null);
  succes = signal(false);

  valider(): void {
    if (!this.jeton) return;
    if (this.motDePasse.length < 10) {
      this.erreur.set('Le mot de passe doit compter au moins 10 caractères.');
      return;
    }
    if (this.motDePasse !== this.confirmation) {
      this.erreur.set('Les deux mots de passe ne correspondent pas.');
      return;
    }

    this.envoi.set(true);
    this.erreur.set(null);
    this.auth.reinitialiserMotDePasse(this.jeton, this.motDePasse).subscribe({
      next: () => { this.envoi.set(false); this.succes.set(true); },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.erreur.set(e.error?.detail ?? 'Ce lien est invalide ou a expiré.');
      }
    });
  }
}
