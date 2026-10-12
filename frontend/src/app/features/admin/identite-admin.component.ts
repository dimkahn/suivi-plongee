import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DialogueComponent } from '../../core/dialogue.component';
import { DemandeIdentite, IdentiteService, IdentiteVue } from '../../core/identite.service';

/** Couleurs d'origine (styles.css) : proposées dans le sélecteur tant qu'aucune n'est choisie. */
const COULEURS_ORIGINE = { couleurPrincipale: '#0891B2', couleurFoncee: '#0C3547', couleurAccent: '#F97316' } as const;
type CleCouleur = keyof typeof COULEURS_ORIGINE;

/**
 * Identité de la structure qui utilise l'appli (une installation par club ou
 * centre) : nom imprimé sur les documents, nom court de l'appli installée,
 * texte de la page de connexion, trois couleurs et logo. Un champ vide garde
 * l'identité d'origine. ADMIN seulement, réseau obligatoire.
 */
@Component({
  selector: 'app-identite-admin',
  imports: [FormsModule, DialogueComponent],
  template: `
    <h1>Identité de la structure</h1>
    <p class="secondaire">
      Le nom, le logo et les couleurs de votre club ou de votre centre : sur la page de connexion, en haut
      de chaque écran, sur l'icône de l'appli installée sur un téléphone et en tête des documents (fiche
      de sécurité, compte rendu TIV, courriels). Un champ laissé vide garde l'identité d'origine de l'appli.
    </p>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (identite.identite(); as i) {
      <section class="carte apercu" aria-label="Identité actuelle">
        <img class="logo" [src]="identite.logo()" alt="Logo actuel" width="96" height="96">
        <dl>
          <dt>Nom</dt><dd>{{ i.nom ?? 'd’origine (nom réglé à l’installation)' }}</dd>
          <dt>Nom court</dt><dd>{{ i.nomCourt ?? 'd’origine (« Suivi plongée »)' }}</dd>
          <dt>Texte d'accueil</dt><dd>{{ i.presentation ?? 'd’origine' }}</dd>
          <dt>Couleurs</dt>
          <dd class="couleurs">
            @for (c of couleurs; track c.cle) {
              <span class="couleur">
                <span class="pastille" [style.background]="i[c.cle] ?? origine[c.cle]"></span>
                {{ c.libelle }} : {{ i[c.cle] ?? 'd’origine' }}
              </span>
            }
          </dd>
          <dt>Logo</dt><dd>{{ i.logoPersonnalise ? 'déposé' : 'd’origine' }}</dd>
        </dl>
        <div class="actions">
          <button type="button" class="bouton-principal" (click)="ouvrir(i)">Modifier</button>
          <label class="bouton-discret fichier">
            {{ envoi() ? 'Envoi…' : 'Changer le logo' }}
            <input type="file" accept="image/png,image/jpeg" (change)="deposer($event)" [disabled]="envoi()">
          </label>
          @if (i.logoPersonnalise) {
            <button type="button" class="bouton-discret" (click)="logoDOrigine()" [disabled]="envoi()">
              Revenir au logo d'origine
            </button>
          }
        </div>
        <p class="aide">
          Logo : une image PNG (fond transparent de préférence) ou JPEG, carrée si possible. Elle est réduite
          à 512 px et sert aussi d'icône à l'appli installée.
        </p>
      </section>
    } @else {
      <p class="secondaire">Chargement…</p>
    }

    <app-dialogue [ouvert]="edition() !== null" titre="Modifier l'identité" [erreur]="erreur()"
                  (fermer)="edition.set(null)">
      @if (edition(); as f) {
        <div class="formulaire">
          <label for="nom">Nom de la structure</label>
          <input id="nom" type="text" maxlength="200" [ngModel]="f.nom ?? ''" (ngModelChange)="f.nom = $event || null"
                 placeholder="ex. Centre de plongée des Calanques">
          <p class="aide">Imprimé en tête de la fiche de sécurité et des comptes rendus.</p>

          <label for="nom-court">Nom court</label>
          <input id="nom-court" type="text" maxlength="60" [ngModel]="f.nomCourt ?? ''"
                 (ngModelChange)="f.nomCourt = $event || null" placeholder="ex. Calanques">
          <p class="aide">Sous l'icône de l'appli installée sur un téléphone.</p>

          <label for="presentation">Texte d'accueil</label>
          <textarea id="presentation" rows="3" maxlength="1000" [ngModel]="f.presentation ?? ''"
                    (ngModelChange)="f.presentation = $event || null"></textarea>
          <p class="aide">Sous le titre de la page de connexion.</p>

          @for (c of couleurs; track c.cle) {
            <span class="etiquette">{{ c.libelle }}</span>
            <div class="choix-couleur">
              <input type="color" [attr.aria-label]="c.libelle" [value]="f[c.cle] ?? origine[c.cle]"
                     (input)="f[c.cle] = $any($event.target).value.toUpperCase()">
              <span>{{ f[c.cle] ?? 'd’origine' }}</span>
              @if (f[c.cle]) {
                <button type="button" class="bouton-discret" (click)="f[c.cle] = null">Couleur d'origine</button>
              }
            </div>
            <p class="aide">{{ c.aide }}</p>
          }

          <div class="actions-dialogue">
            <button type="button" class="bouton-principal" (click)="enregistrer()" [disabled]="envoi()">
              {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
            <button type="button" class="bouton-discret" (click)="edition.set(null)">Annuler</button>
          </div>
        </div>
      }
    </app-dialogue>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .apercu { padding: var(--pas-3); margin-top: var(--pas-2); }
    .logo { display: block; width: 96px; height: 96px; object-fit: contain; margin-bottom: var(--pas-2); }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px var(--pas-2); margin: 0; }
    dt { font-weight: 700; }
    dd { margin: 0; }
    .couleurs { display: flex; flex-direction: column; gap: 4px; }
    .couleur { display: inline-flex; align-items: center; gap: var(--pas); }
    .pastille { width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--trait); flex: none; }
    .actions { display: flex; flex-wrap: wrap; gap: var(--pas); margin-top: var(--pas-3); }
    .actions .bouton-principal { width: auto; }
    .fichier { display: inline-flex; align-items: center; min-height: 44px; cursor: pointer; }
    .fichier input { position: absolute; width: 1px; height: 1px; opacity: 0; }
    .formulaire { display: flex; flex-direction: column; gap: 2px; }
    .formulaire label, .etiquette { font-weight: 700; font-size: .875rem; margin-top: var(--pas); }
    .formulaire input[type=text], .formulaire textarea { margin: 0; }
    .choix-couleur { display: flex; align-items: center; gap: var(--pas); flex-wrap: wrap; }
    .choix-couleur input { width: 64px; height: 44px; padding: 2px; margin: 0; }
    .aide { margin: 2px 0 0; }
    @media (max-width: 600px) {
      dl { grid-template-columns: 1fr; }
      dd { margin-bottom: var(--pas); }
    }
  `]
})
export class IdentiteAdminComponent {
  identite = inject(IdentiteService);

  readonly origine = COULEURS_ORIGINE;
  readonly couleurs: { cle: CleCouleur; libelle: string; aide: string }[] = [
    { cle: 'couleurPrincipale', libelle: 'Couleur principale', aide: 'Liens, boutons, titres de cartes.' },
    { cle: 'couleurFoncee', libelle: 'Couleur foncée', aide: 'Bandeau du haut, fond de l\'icône de l\'appli.' },
    { cle: 'couleurAccent', libelle: 'Couleur d\'accent', aide: 'Ce qui doit attirer l\'œil : alertes douces, repères.' }
  ];

  edition = signal<DemandeIdentite | null>(null);
  envoi = signal(false);
  message = signal<string | null>(null);
  erreur = signal<string | null>(null);

  constructor() {
    // À jour même si la copie gardée sur l'appareil date un peu.
    void this.identite.charger();
  }

  ouvrir(i: IdentiteVue): void {
    this.erreur.set(null);
    this.edition.set({
      nom: i.nom, nomCourt: i.nomCourt, presentation: i.presentation,
      couleurPrincipale: i.couleurPrincipale, couleurFoncee: i.couleurFoncee, couleurAccent: i.couleurAccent
    });
  }

  enregistrer(): void {
    const f = this.edition();
    if (!f) return;
    this.envoi.set(true);
    this.erreur.set(null);
    this.identite.modifier(f).subscribe({
      next: i => {
        this.envoi.set(false);
        this.edition.set(null);
        this.identite.appliquer(i);
        this.message.set('Identité enregistrée.');
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.erreur.set(err.error?.detail ?? "L'identité n'a pas pu être enregistrée.");
      }
    });
  }

  deposer(evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    const fichier = champ.files?.[0];
    champ.value = '';
    if (!fichier) return;
    this.envoi.set(true);
    this.message.set(null);
    this.identite.deposerLogo(fichier).subscribe({
      next: i => {
        this.envoi.set(false);
        this.identite.appliquer(i);
        this.message.set('Logo enregistré.');
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(err.error?.detail ?? "Le logo n'a pas pu être enregistré.");
      }
    });
  }

  logoDOrigine(): void {
    this.envoi.set(true);
    this.message.set(null);
    this.identite.supprimerLogo().subscribe({
      next: i => {
        this.envoi.set(false);
        this.identite.appliquer(i);
        this.message.set('Logo d\'origine rétabli.');
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(err.error?.detail ?? "Le logo n'a pas pu être retiré.");
      }
    });
  }
}
