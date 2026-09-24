import { Component, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { RecadragePhotoComponent } from '../../core/recadrage-photo.component';
import { etatCaci, libelleCaci } from '../../core/caci';

type Section = 'identite' | 'email' | 'motDePasse' | 'photo';

/**
 * Le moniteur modifie lui-même son identité, son e-mail, son mot de passe et
 * sa photo du trombinoscope.
 * Le niveau d'encadrement est affiché mais reste réservé à l'administrateur :
 * c'est lui qui détermine quels niveaux on a le droit de noter.
 */
@Component({
  selector: 'app-mon-compte',
  imports: [FormsModule, RecadragePhotoComponent],
  template: `
    <h1>Mon compte</h1>
    @if (auth.niveau(); as n) {
      <p class="secondaire">
        Niveau d'encadrement : <strong>{{ n }}</strong>. Pour le faire évoluer,
        adressez-vous à un administrateur du club.
      </p>
    }

    <p [class]="'caci caci-' + etatCaci(auth.session()?.certificatValideJusquAu)">
      {{ libelleCaci(auth.session()?.certificatValideJusquAu) }}
      <span class="secondaire">— date saisie par un administrateur, à qui remettre un nouveau certificat.</span>
    </p>

    @if (auth.estMoniteur()) {
      <section class="carte panneau">
        <h2>Ma photo</h2>
        <p class="secondaire">
          Elle apparaît dans le trombinoscope des moniteurs, visible des encadrants du club.
          En la déposant, vous acceptez cet affichage ; vous pouvez la retirer à tout moment.
        </p>
        @if (messages().photo; as m) { <div [class]="m.ok ? 'succes' : 'alerte'" role="status">{{ m.texte }}</div> }

        <div class="photo">
          @if (urlPhoto(); as url) {
            <img class="avatar" [src]="url" alt="Ma photo" width="120" height="120">
          } @else {
            <div class="avatar silhouette" aria-label="Pas de photo">{{ initiales() }}</div>
          }
          <div class="actions-photo">
            <label class="bouton-discret upload">
              {{ urlPhoto() ? 'Changer ma photo' : 'Déposer ma photo' }}
              <input type="file" accept="image/jpeg,image/png" hidden (change)="choisirPhoto($event)">
            </label>
            @if (urlPhoto()) {
              <button type="button" class="bouton-discret danger" (click)="retirerPhoto()"
                      [disabled]="envoi() === 'photo'">
                Retirer ma photo
              </button>
            }
          </div>
        </div>
      </section>
    }

    @if (fichierARecadrer(); as f) {
      <app-recadrage-photo [fichier]="f" titre="Recadrer ma photo" [enCours]="envoi() === 'photo'"
                           (valide)="deposerPhoto($event)" (annule)="fichierARecadrer.set(null)"
                           (illisible)="imageIllisible()" />
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
    .caci { font-weight: 700; }
    .caci .secondaire { font-weight: 400; }
    .caci-valide { color: var(--acquis); }
    .caci-bientot { color: var(--en-cours); }
    .caci-expire, .caci-absent { color: #B3261E; }
    .photo { display: flex; align-items: center; gap: var(--pas-3); flex-wrap: wrap; }
    .avatar {
      width: 120px; height: 120px; border-radius: 50%; object-fit: cover; background: var(--fond); flex: none;
    }
    .silhouette {
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-titres), sans-serif; font-size: 2rem; font-weight: 700; color: var(--craie);
    }
    .actions-photo { display: flex; flex-direction: column; gap: var(--pas); }
    .upload { margin: 0; cursor: pointer; font-size: inherit; }
    .danger { color: #B3261E; border-color: #B3261E; }
    .succes {
      background: var(--acquis-clair); color: var(--acquis); border-radius: var(--r-s);
      padding: var(--pas-2); font-weight: 700;
    }
  `]
})
export class MonCompteComponent implements OnDestroy {
  auth = inject(AuthService);
  private api = inject(ApiService);
  readonly etatCaci = etatCaci;
  readonly libelleCaci = libelleCaci;

  prenom = this.auth.session()?.prenom ?? '';
  nom = this.auth.session()?.nom ?? '';
  numeroLicence = this.auth.session()?.numeroLicence ?? '';

  nouvelEmail = '';
  motDePasseEmail = '';

  motDePasseActuel = '';
  nouveauMotDePasse = '';
  confirmation = '';

  urlPhoto = signal<string | null>(null);
  fichierARecadrer = signal<File | null>(null);

  envoi = signal<Section | null>(null);
  messages = signal<Partial<Record<Section, { ok: boolean; texte: string }>>>({});

  constructor() {
    if (this.auth.estMoniteur()) this.chargerPhoto();
  }

  initiales(): string {
    const s = this.auth.session();
    return ((s?.prenom?.[0] ?? '') + (s?.nom?.[0] ?? '')).toUpperCase();
  }

  private chargerPhoto(): void {
    this.api.maPhoto().subscribe({
      next: blob => this.remplacerPhoto(URL.createObjectURL(blob)),
      error: () => this.remplacerPhoto(null) // 404 : pas encore de photo
    });
  }

  private remplacerPhoto(url: string | null): void {
    const ancienne = this.urlPhoto();
    if (ancienne) URL.revokeObjectURL(ancienne);
    this.urlPhoto.set(url);
  }

  /** Ouvre le recadrage : la photo n'est envoyée qu'une fois validée (voir {@link deposerPhoto}). */
  choisirPhoto(evenement: Event): void {
    const entree = evenement.target as HTMLInputElement;
    const fichier = entree.files?.[0];
    entree.value = ''; // permet de rechoisir le même fichier plus tard
    if (!fichier) return;
    this.message('photo', true, null);
    this.fichierARecadrer.set(fichier);
  }

  imageIllisible(): void {
    this.fichierARecadrer.set(null);
    this.message('photo', false, "Cette image n'a pas pu être lue.");
  }

  async deposerPhoto(fichier: File): Promise<void> {
    this.envoi.set('photo');
    try {
      await firstValueFrom(this.api.deposerMaPhoto(fichier));
      this.remplacerPhoto(URL.createObjectURL(fichier));
      this.fichierARecadrer.set(null);
      this.message('photo', true, 'Photo enregistrée.');
    } catch (err) {
      this.message('photo', false, (err as HttpErrorResponse).error?.detail ?? "La photo n'a pas pu être déposée.");
    } finally {
      this.envoi.set(null);
    }
  }

  retirerPhoto(): void {
    if (!confirm('Retirer votre photo du trombinoscope ?')) return;
    this.envoi.set('photo');
    this.api.retirerMaPhoto().subscribe({
      next: () => {
        this.envoi.set(null);
        this.remplacerPhoto(null);
        this.message('photo', true, 'Photo retirée.');
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(null);
        this.message('photo', false, e.error?.detail ?? "La photo n'a pas pu être retirée.");
      }
    });
  }

  ngOnDestroy(): void {
    this.remplacerPhoto(null);
  }

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
