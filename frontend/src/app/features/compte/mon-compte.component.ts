import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';

type Section = 'identite' | 'email' | 'motDePasse';

/**
 * Le moniteur modifie lui-même son identité, son e-mail et son mot de passe.
 * Le niveau d'encadrement est affiché mais reste réservé à l'administrateur :
 * c'est lui qui détermine quels niveaux on a le droit de noter.
 */
@Component({
  selector: 'app-mon-compte',
  imports: [FormsModule],
  template: `
    <h1>Mon compte</h1>
    @if (auth.niveau(); as n) {
      <p class="secondaire">
        Niveau d'encadrement : <strong>{{ n }}</strong>. Pour le faire évoluer,
        adressez-vous à un administrateur du club.
      </p>
    }

    <section class="carte panneau">
      <h2>Identité</h2>
      @if (messages().identite; as m) { <div [class]="m.ok ? 'succes' : 'alerte'" role="status">{{ m.texte }}</div> }

      <label for="prenom">Prénom</label>
      <input id="prenom" type="text" name="prenom" autocomplete="given-name" [(ngModel)]="prenom">

      <label for="nom">Nom</label>
      <input id="nom" type="text" name="nom" autocomplete="family-name" [(ngModel)]="nom">

      <label for="licence">N° de licence</label>
      <input id="licence" type="text" name="licence" [(ngModel)]="numeroLicence" placeholder="Facultatif">

      <button type="button" class="bouton-principal" (click)="enregistrerIdentite()" [disabled]="envoi() === 'identite'">
        {{ envoi() === 'identite' ? 'Enregistrement…' : 'Enregistrer' }}
      </button>
    </section>

    <section class="carte panneau">
      <h2>E-mail de connexion</h2>
      <p class="secondaire">Actuellement : {{ auth.session()?.email }}</p>
      @if (messages().email; as m) { <div [class]="m.ok ? 'succes' : 'alerte'" role="status">{{ m.texte }}</div> }

      <label for="email">Nouvel e-mail</label>
      <input id="email" type="email" name="email" autocomplete="email" [(ngModel)]="nouvelEmail">

      <label for="mdp-email">Mot de passe actuel</label>
      <input id="mdp-email" type="password" name="mdpEmail" autocomplete="current-password"
             [(ngModel)]="motDePasseEmail">

      <button type="button" class="bouton-principal" (click)="changerEmail()" [disabled]="envoi() === 'email'">
        {{ envoi() === 'email' ? 'Enregistrement…' : "Changer d'e-mail" }}
      </button>
    </section>

    <section class="carte panneau">
      <h2>Mot de passe</h2>
      <p class="secondaire">
        Au moins 10 caractères. Vos sessions ouvertes sur d'autres appareils seront fermées.
      </p>
      @if (messages().motDePasse; as m) { <div [class]="m.ok ? 'succes' : 'alerte'" role="status">{{ m.texte }}</div> }

      <label for="mdp-actuel">Mot de passe actuel</label>
      <input id="mdp-actuel" type="password" name="mdpActuel" autocomplete="current-password"
             [(ngModel)]="motDePasseActuel">

      <label for="mdp-nouveau">Nouveau mot de passe</label>
      <input id="mdp-nouveau" type="password" name="mdpNouveau" autocomplete="new-password"
             [(ngModel)]="nouveauMotDePasse">

      <label for="mdp-confirmation">Confirmer le nouveau mot de passe</label>
      <input id="mdp-confirmation" type="password" name="mdpConfirmation" autocomplete="new-password"
             [(ngModel)]="confirmation">

      <button type="button" class="bouton-principal" (click)="changerMotDePasse()"
              [disabled]="envoi() === 'motDePasse'">
        {{ envoi() === 'motDePasse' ? 'Enregistrement…' : 'Changer le mot de passe' }}
      </button>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .panneau { max-width: 480px; padding: var(--pas-3); margin: var(--pas-3) 0; }
    .panneau h2 { margin-bottom: var(--pas); }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .bouton-principal { width: 100%; margin-top: var(--pas-3); }
    .succes {
      background: var(--acquis-clair); color: var(--acquis); border-radius: var(--r-s);
      padding: var(--pas-2); font-weight: 700;
    }
  `]
})
export class MonCompteComponent {
  auth = inject(AuthService);

  prenom = this.auth.session()?.prenom ?? '';
  nom = this.auth.session()?.nom ?? '';
  numeroLicence = this.auth.session()?.numeroLicence ?? '';

  nouvelEmail = '';
  motDePasseEmail = '';

  motDePasseActuel = '';
  nouveauMotDePasse = '';
  confirmation = '';

  envoi = signal<Section | null>(null);
  messages = signal<Partial<Record<Section, { ok: boolean; texte: string }>>>({});

  enregistrerIdentite(): void {
    if (!this.prenom.trim() || !this.nom.trim()) {
      this.message('identite', false, 'Prénom et nom sont obligatoires.');
      return;
    }
    this.envoyer('identite',
      this.auth.modifierIdentite({ nom: this.nom, prenom: this.prenom, numeroLicence: this.numeroLicence || null }),
      'Identité enregistrée.');
  }

  changerEmail(): void {
    if (!this.nouvelEmail.trim() || !this.motDePasseEmail) {
      this.message('email', false, 'Saisissez le nouvel e-mail et votre mot de passe actuel.');
      return;
    }
    this.envoyer('email', this.auth.changerEmail(this.nouvelEmail, this.motDePasseEmail),
      'E-mail modifié : utilisez-le désormais pour vous connecter.',
      () => { this.nouvelEmail = ''; this.motDePasseEmail = ''; });
  }

  changerMotDePasse(): void {
    if (this.nouveauMotDePasse.length < 10) {
      this.message('motDePasse', false, 'Le mot de passe doit compter au moins 10 caractères.');
      return;
    }
    if (this.nouveauMotDePasse !== this.confirmation) {
      this.message('motDePasse', false, 'Les deux mots de passe ne correspondent pas.');
      return;
    }
    this.envoyer('motDePasse', this.auth.changerMotDePasse(this.motDePasseActuel, this.nouveauMotDePasse),
      'Mot de passe modifié.',
      () => { this.motDePasseActuel = ''; this.nouveauMotDePasse = ''; this.confirmation = ''; });
  }

  private envoyer(section: Section, requete: ReturnType<AuthService['modifierIdentite']>,
                  succes: string, apres?: () => void): void {
    this.envoi.set(section);
    this.message(section, true, null);
    requete.subscribe({
      next: () => {
        this.envoi.set(null);
        apres?.();
        this.message(section, true, succes);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(null);
        this.message(section, false, e.error?.detail ?? "La modification n'a pas pu être enregistrée.");
      }
    });
  }

  private message(section: Section, ok: boolean, texte: string | null): void {
    const suivants = { ...this.messages() };
    if (texte) suivants[section] = { ok, texte };
    else delete suivants[section];
    this.messages.set(suivants);
  }
}
