import { ChangeDetectionStrategy, Component, effect, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogueComponent } from './dialogue.component';
import { dessinerTrombinoscope, nomFichierTrombinoscope } from './image-trombinoscope';

/** Une carte du trombinoscope à mettre sur l'image. */
export interface PersonneExport {
  id: number;
  nom: string;
  sousTitre: string;
  /** Adresse (blob:) de la photo affichée ; null = pas de photo. */
  photo: string | null;
}

/**
 * La fenêtre « Exporter en image » d'un trombinoscope (club, séjour) : le
 * titre, les photos à remplacer par une icône, puis le PNG téléchargé. Les
 * personnes et leurs photos sont celles que l'écran affiche déjà ; qui peut
 * exporter reste décidé par l'écran.
 */
@Component({
  selector: 'app-export-trombinoscope',
  imports: [FormsModule, DialogueComponent],
  template: `
    <app-dialogue [ouvert]="ouvert()" titre="Exporter en image" [erreur]="erreur()" (fermer)="fermer.emit()">
      <label for="titreExport">Titre de l'image</label>
      <input id="titreExport" type="text" [ngModel]="titre()" (ngModelChange)="titre.set($event)">

      <p class="secondaire">
        Les {{ personnes().length }} personnes affichées, dans cet ordre. Cochez celles dont la photo
        doit être remplacée par une icône (celles qui n'ont pas de photo l'ont déjà).
      </p>
      <div class="choix-masque">
        <button type="button" class="bouton-discret" (click)="masquerTout(true)">Tout masquer</button>
        <button type="button" class="bouton-discret" (click)="masquerTout(false)">Ne rien masquer</button>
      </div>
      <ul class="liste-export">
        @for (p of personnes(); track p.id) {
          <li>
            <label class="case">
              <input type="checkbox" [disabled]="!p.photo"
                     [checked]="!p.photo || masques().has(p.id)" (change)="basculerMasque(p.id)">
              <span>
                {{ p.nom }}
                @if (!p.photo) { <span class="secondaire"> — pas de photo</span> }
              </span>
            </label>
          </li>
        }
      </ul>

      <div class="actions-dialogue">
        <button type="button" class="bouton-discret" (click)="fermer.emit()">Annuler</button>
        <button type="button" class="bouton-principal" (click)="exporter()" [disabled]="enCours()">
          {{ enCours() ? 'Préparation…' : "Télécharger l'image" }}
        </button>
      </div>
    </app-dialogue>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .case { display: flex; align-items: center; gap: var(--pas); min-height: 44px; }
    .case input { width: auto; flex: none; margin: 0; }
    .choix-masque { display: flex; gap: var(--pas); flex-wrap: wrap; margin: var(--pas) 0; }
    .liste-export { list-style: none; padding: 0; margin: 0 0 var(--pas-2); }
  `]
})
export class ExportTrombinoscopeComponent {
  readonly ouvert = input(false);
  readonly personnes = input.required<PersonneExport[]>();
  /** Le titre proposé à l'ouverture (groupe affiché, nom du séjour…), modifiable. */
  readonly titreInitial = input('');
  readonly fermer = output<void>();

  titre = signal('');
  /** Personnes dont la photo est remplacée par l'icône sur l'image (choix de l'export en cours). */
  masques = signal<Set<number>>(new Set());
  enCours = signal(false);
  erreur = signal<string | null>(null);

  constructor() {
    // Chaque ouverture repart du titre proposé, sans masque ni erreur.
    effect(() => {
      if (!this.ouvert()) return;
      untracked(() => {
        this.titre.set(this.titreInitial());
        this.masques.set(new Set());
        this.erreur.set(null);
      });
    });
  }

  basculerMasque(id: number): void {
    const copie = new Set(this.masques());
    if (!copie.delete(id)) copie.add(id);
    this.masques.set(copie);
  }

  masquerTout(masquer: boolean): void {
    this.masques.set(masquer ? new Set(this.personnes().map(p => p.id)) : new Set());
  }

  async exporter(): Promise<void> {
    this.enCours.set(true);
    this.erreur.set(null);
    try {
      const titre = this.titre().trim() || 'Trombinoscope';
      const personnes = this.personnes().map(p => ({
        nom: p.nom, sousTitre: p.sousTitre, photo: this.masques().has(p.id) ? null : p.photo
      }));
      const blob = await dessinerTrombinoscope(titre, personnes);
      const url = URL.createObjectURL(blob);
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = nomFichierTrombinoscope(titre);
      lien.click();
      URL.revokeObjectURL(url);
      this.fermer.emit();
    } catch (e) {
      this.erreur.set((e as Error).message || "L'image n'a pas pu être fabriquée.");
    } finally {
      this.enCours.set(false);
    }
  }
}
