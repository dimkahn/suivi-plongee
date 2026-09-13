import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../core/api.service';
import { SeanceVue } from '../../core/modeles';

@Component({
  selector: 'app-seance-creation',
  imports: [FormsModule],
  template: `
    <h1>Nouvelle séance</h1>
    <p class="secondaire">
      Ouvre une séance sur la saison courante, pour y rattacher présences et
      notations.
    </p>

    <div class="carte panneau">
      @if (erreur()) { <div class="alerte">{{ erreur() }}</div> }
      @if (confirmation()) { <div class="succes">Séance du {{ confirmation() }} créée.</div> }

      <label for="date">Date</label>
      <input id="date" type="date" name="date" [(ngModel)]="dateSeance">

      <label for="milieu">Milieu</label>
      <select id="milieu" name="milieu" [(ngModel)]="milieu">
        <option value="ARTIFICIEL">Piscine / fosse (artificiel)</option>
        <option value="NATUREL">Mer / lac / carrière (naturel)</option>
      </select>

      <label for="lieu">Lieu</label>
      <input id="lieu" type="text" name="lieu" [(ngModel)]="lieu" placeholder="Facultatif">

      <label for="profondeur">Profondeur max (m)</label>
      <input id="profondeur" type="number" name="profondeur" min="0"
             [(ngModel)]="profondeurMax" placeholder="Facultatif">

      <label for="commentaire">Commentaire</label>
      <textarea id="commentaire" name="commentaire" rows="3"
                [(ngModel)]="commentaire" placeholder="Facultatif"></textarea>

      <button type="button" class="bouton-principal" (click)="creer()" [disabled]="envoi()">
        {{ envoi() ? 'Création…' : 'Créer la séance' }}
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .panneau { max-width: 480px; padding: var(--pas-3); margin-top: var(--pas-3); }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    textarea { resize: vertical; }
    .bouton-principal { width: 100%; margin-top: var(--pas-3); }
    .succes {
      background: #e6f4ea; color: #1e4620; border-radius: var(--r-s);
      padding: var(--pas-2); margin-bottom: var(--pas-2);
    }
  `]
})
export class SeanceCreationComponent {
  private api = inject(ApiService);

  dateSeance = '';
  milieu: 'ARTIFICIEL' | 'NATUREL' = 'ARTIFICIEL';
  lieu = '';
  profondeurMax: number | null = null;
  commentaire = '';

  envoi = signal(false);
  erreur = signal<string | null>(null);
  confirmation = signal<string | null>(null);

  creer(): void {
    if (!this.dateSeance) {
      this.erreur.set('La date de la séance est obligatoire.');
      return;
    }
    this.envoi.set(true);
    this.erreur.set(null);
    this.confirmation.set(null);

    this.api.creerSeance({
      dateSeance: this.dateSeance,
      milieu: this.milieu,
      lieu: this.lieu || null,
      profondeurMax: this.profondeurMax,
      commentaire: this.commentaire || null
    }).subscribe({
      next: (s: SeanceVue) => {
        this.envoi.set(false);
        this.confirmation.set(s.date);
        this.reinitialiser();
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        // Le back-end renvoie le détail métier dans le champ `detail` du ProblemDetail.
        this.erreur.set(err.error?.detail ?? "La création de la séance a échoué.");
      }
    });
  }

  private reinitialiser(): void {
    this.dateSeance = '';
    this.lieu = '';
    this.profondeurMax = null;
    this.commentaire = '';
  }
}
