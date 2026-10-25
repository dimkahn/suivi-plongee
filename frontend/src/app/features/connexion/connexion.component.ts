import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { MAGASIN_CACHE, ecrire } from '../../core/base-locale';
import { cleJetonLienSejour } from '../sejours/sejour-hors-ligne';
import { IdentiteService } from '../../core/identite.service';

@Component({
  selector: 'app-connexion',
  imports: [FormsModule],
  template: `
    <div class="accueil">
      <div class="carte panneau">
        <img class="logo" [src]="identite.logo()"
             [alt]="identite.nom() ?? altOrigine"
             width="120" height="120">
        <h1>Suivi des formations de plongée</h1>
        @if (identite.identite()?.presentation; as presentation) {
          <p class="secondaire">{{ presentation }}</p>
        } @else {
          <p class="secondaire">
            Les compétences N1, N2 et N3 du MFT, saisies au bord du bassin
            et validées par les encadrants du club.
          </p>
        }

        @if (sejour()) {
          @if (erreur()) { <div class="alerte" role="alert">{{ erreur() }}</div> }
          @if (etapeSejour() === 'email') {
            <p class="secondaire">
              Élève, parent ou invité d'un séjour du club : donnez l'adresse e-mail que vous avez
              donnée à l'organisateur, vous recevrez un code à 6 chiffres. Pas de compte ni de mot de passe.
            </p>
            <label for="email-sejour">Adresse e-mail</label>
            <input id="email-sejour" type="email" name="email-sejour" autocomplete="email"
                   [(ngModel)]="email" (keyup.enter)="demanderCodeSejour()">
            <button type="button" class="bouton-principal" (click)="demanderCodeSejour()" [disabled]="envoi()">
              {{ envoi() ? 'Envoi…' : 'Recevoir le code' }}
            </button>
          } @else {
            <p class="secondaire">
              Si cette adresse est celle d'un participant, un code vient d'y partir (pensez aux
              indésirables). Il est valable 10 minutes.
            </p>
            <label for="code-sejour">Code reçu par e-mail</label>
            <input id="code-sejour" name="code-sejour" inputmode="numeric" autocomplete="one-time-code" maxlength="6"
                   [(ngModel)]="codeSejour" (keyup.enter)="entrerSejour()">
            <button type="button" class="bouton-principal" (click)="entrerSejour()" [disabled]="envoi()">
              {{ envoi() ? 'Entrée…' : 'Entrer' }}
            </button>
            <button type="button" class="lien-oubli" (click)="etapeSejour.set('email')">
              Changer d'adresse ou renvoyer
            </button>
          }

          <button type="button" class="lien-oubli" (click)="basculerSejour()">
            Retour à la connexion
          </button>

        } @else if (!oubli()) {
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

          <button type="button" class="lien-oubli lien-sejour" (click)="basculerSejour()">
            Participant à un séjour ? Entrer avec un code reçu par e-mail
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
    .logo { display: block; width: 120px; height: 120px; object-fit: contain; margin: 0 auto var(--pas-3); }
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
      display: block; width: 100%; margin-top: var(--pas-2); padding: 0; min-height: 44px;
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
  private http = inject(HttpClient);
  identite = inject(IdentiteService);
  /** Texte du logo d'origine, tant qu'aucun nom de structure n'est réglé. */
  readonly altOrigine = "Club de plongée de la Police et de la Justice du Val-d'Oise";
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

  /** L'entrée d'un participant de séjour sans compte (élève, invité) : e-mail, puis code reçu. */
  sejour = signal(false);
  etapeSejour = signal<'email' | 'code'>('email');
  codeSejour = '';

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
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        // 422 : compte reconnu mais pas encore ouvert (compte élève) ; sinon, identifiants refusés.
        this.erreur.set(e.status === 422 && e.error?.detail ? e.error.detail : 'E-mail ou mot de passe incorrect.');
      }
    });
  }

  basculerSejour(): void {
    this.sejour.set(!this.sejour());
    this.etapeSejour.set('email');
    this.erreur.set(null);
  }

  /** Toujours la même réponse du serveur : la page ne dit pas qui participe à un séjour. */
  async demanderCodeSejour(): Promise<void> {
    if (!this.email.trim()) {
      this.erreur.set('Indiquez votre adresse e-mail.');
      return;
    }
    this.envoi.set(true);
    this.erreur.set(null);
    try {
      await firstValueFrom(this.http.post('/api/public/sejours/code', { email: this.email.trim() }));
      this.codeSejour = '';
      this.etapeSejour.set('code');
    } catch (e) {
      this.erreur.set((e as HttpErrorResponse).error?.detail ?? "Le code n'a pas pu être envoyé (réseau nécessaire).");
    } finally {
      this.envoi.set(false);
    }
  }

  /** Le bon code donne l'adresse du séjour et son jeton : la page du séjour s'ouvre déjà connectée. */
  async entrerSejour(): Promise<void> {
    this.envoi.set(true);
    this.erreur.set(null);
    try {
      const c = await firstValueFrom(this.http.post<{ sejour: string; jeton: string }>('/api/public/sejours/connexion',
        { email: this.email.trim(), code: this.codeSejour.trim() }));
      await ecrire(MAGASIN_CACHE, { cle: cleJetonLienSejour(c.sejour), valeur: c.jeton });
      await this.router.navigate(['/sejour', c.sejour]);
    } catch (e) {
      this.erreur.set((e as HttpErrorResponse).error?.detail ?? "L'entrée n'a pas abouti (réseau nécessaire).");
    } finally {
      this.envoi.set(false);
    }
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
