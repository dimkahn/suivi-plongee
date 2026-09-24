import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-connexion',
  imports: [FormsModule],
  template: `
    <div class="accueil">
      <div class="carte panneau">
        <img class="logo" src="logo-club.png"
             alt="Club de plongée de la Police et de la Justice du Val-d'Oise" width="120" height="120">
        <h1>Suivi des formations de plongée</h1>
        <p class="secondaire">
          Les compétences N1, N2 et N3 du MFT, saisies au bord du bassin
          et validées par les encadrants du club.
        </p>

        @if (!oubli()) {
          @if (erreur()) { <div class="alerte">{{ erreur() }}</div> }

          <label for="email">Adresse e-mail</label>
          <input id="email" type="email" name="email" autocomplete="username"
                 [(ngModel)]="email" (keyup.enter)="connecter()">

          <label for="mdp">Mot de passe</label>
          <input id="mdp" type="password" name="mdp" autocomplete="current-password"
                 [(ngModel)]="motDePasse" (keyup.enter)="connecter()">

          <label class="case">
            <input type="checkbox" name="seSouvenir" [(ngModel)]="seSouvenir">
            Se souvenir de moi
          </label>
          <p class="aide">
            Décochez sur un appareil partagé : la session s'arrêtera à la fermeture du navigateur.
          </p>

          <button type="button" class="bouton-principal" (click)="connecter()" [disabled]="envoi()">
            {{ envoi() ? 'Connexion…' : 'Se connecter' }}
          </button>

          <button type="button" class="lien-oubli" (click)="basculerOubli()">
            Mot de passe oublié ?
          </button>
        } @else {
          <p class="secondaire">
            Indiquez votre e-mail : si un compte lui correspond, un lien de
            réinitialisation vous sera envoyé.
          </p>

          @if (confirmationOubli()) {
            <div class="succes">
              Si un compte existe pour cette adresse, un lien vient d'être envoyé.
            </div>
          } @else {
            <label for="email-oubli">Adresse e-mail</label>
            <input id="email-oubli" type="email" name="email-oubli" autocomplete="username"
                   [(ngModel)]="email" (keyup.enter)="demanderReinitialisation()">

            <button type="button" class="bouton-principal" (click)="demanderReinitialisation()"
                    [disabled]="envoi()">
              {{ envoi() ? 'Envoi…' : 'Envoyer le lien' }}
            </button>
          }

          <button type="button" class="lien-oubli" (click)="basculerOubli()">
            Retour à la connexion
          </button>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .accueil { min-height: 100dvh; display: grid; place-items: center; padding: var(--pas-3); }
    .panneau { width: 100%; max-width: 420px; padding: var(--pas-4) var(--pas-3); }
    .logo { display: block; width: 120px; height: 120px; margin: 0 auto var(--pas-3); }
    h1 { margin-bottom: var(--pas); font-size: 1.375rem; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .case {
      display: flex; align-items: center; gap: var(--pas); min-height: 44px;
      margin-bottom: 0; font-weight: 400; cursor: pointer;
    }
    .case input { width: 24px; height: 24px; margin: 0; flex: none; }
    .aide { margin: 0; color: var(--craie); font-size: .8125rem; }
    .bouton-principal { width: 100%; margin-top: var(--pas-3); }
    .lien-oubli {
      display: block; width: 100%; margin-top: var(--pas-2); padding: 0; min-height: auto;
      background: none; border: none; color: var(--profond); font-size: .875rem;
      text-decoration: underline; text-align: center;
    }
    .succes {
      background: #e6f4ea; color: #1e4620; border-radius: var(--r-s); padding: var(--pas-2);
    }
  `]
})
export class ConnexionComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  email = '';
  motDePasse = '';
  /** Coché par défaut : l'appli sert surtout sur le téléphone personnel du moniteur. */
  seSouvenir = true;
  envoi = signal(false);
  erreur = signal<string | null>(null);

  oubli = signal(false);
  confirmationOubli = signal(false);

  connecter(): void {
    if (!this.email || !this.motDePasse) {
      this.erreur.set('Renseignez votre e-mail et votre mot de passe.');
      return;
    }
    this.envoi.set(true);
    this.erreur.set(null);
    this.auth.connexion(this.email, this.motDePasse, this.seSouvenir).subscribe({
      next: () => {
        const retour = this.route.snapshot.queryParamMap.get('retour');
        this.router.navigateByUrl(retour ?? '/');
      },
      error: () => {
        this.envoi.set(false);
        this.erreur.set('E-mail ou mot de passe incorrect.');
      }
    });
  }

  basculerOubli(): void {
    this.oubli.set(!this.oubli());
    this.confirmationOubli.set(false);
    this.erreur.set(null);
  }

  demanderReinitialisation(): void {
    if (!this.email) return;
    this.envoi.set(true);
    this.auth.motDePasseOublie(this.email).subscribe({
      // Meme reponse que le serveur : succes affiche que le compte existe ou non.
      next: () => { this.envoi.set(false); this.confirmationOubli.set(true); },
      error: () => { this.envoi.set(false); this.confirmationOubli.set(true); }
    });
  }
}
