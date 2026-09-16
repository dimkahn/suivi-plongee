import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { SaisonVue } from '../../core/modeles';

@Component({
  selector: 'app-saisons',
  imports: [FormsModule],
  template: `
    <h1>Saisons</h1>
    <p class="secondaire">
      Une saison fermée sort seulement des saisons proposées par défaut : rien n'est rétroactif.
    </p>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <section class="carte panneau">
      <h2>Nouvelle saison</h2>
      <label for="libelle">Libellé</label>
      <input id="libelle" type="text" name="libelle" [(ngModel)]="libelle" placeholder="2026-2027">
      <label for="debut">Début</label>
      <input id="debut" type="date" name="debut" [(ngModel)]="dateDebut">
      <label for="fin">Fin</label>
      <input id="fin" type="date" name="fin" [(ngModel)]="dateFin">
      <button type="button" class="bouton-principal" (click)="creer()" [disabled]="envoi()">
        {{ envoi() ? 'Création…' : 'Créer la saison' }}
      </button>
    </section>

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (liste().length === 0) {
      <div class="carte vide"><p>Aucune saison enregistrée.</p></div>
    } @else {
      <ul>
        @for (s of liste(); track s.id) {
          <li class="carte">
            @if (enEdition() === s.id) {
              <label [for]="'libelle-' + s.id">Libellé</label>
              <input [id]="'libelle-' + s.id" type="text" [(ngModel)]="brouillon.libelle">
              <label [for]="'debut-' + s.id">Début</label>
              <input [id]="'debut-' + s.id" type="date" [(ngModel)]="brouillon.dateDebut">
              <label [for]="'fin-' + s.id">Fin</label>
              <input [id]="'fin-' + s.id" type="date" [(ngModel)]="brouillon.dateFin">
              <div class="actions">
                <button type="button" class="bouton-principal" (click)="enregistrer(s)" [disabled]="envoi()">
                  {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
                </button>
                <button type="button" class="bouton-discret" (click)="annulerEdition()">Annuler</button>
              </div>
            } @else {
              <div class="ligne">
                <div class="identite">
                  <span class="nom">{{ s.libelle }}</span>
                  <span class="secondaire">Du {{ s.dateDebut }} au {{ s.dateFin }}</span>
                </div>
                <span class="etat" [class.actif]="s.ouverte" [class.inactif]="!s.ouverte">
                  {{ s.ouverte ? 'Ouverte' : 'Fermée' }}
                </span>
              </div>
              <div class="actions">
                <button type="button" class="bouton-discret" (click)="commencerEdition(s)">
                  Modifier les dates
                </button>
                <button type="button" class="bouton-discret" (click)="changerOuverture(s)">
                  {{ s.ouverte ? 'Fermer' : 'Rouvrir' }}
                </button>
              </div>
            }
          </li>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .panneau { max-width: 480px; padding: var(--pas-3); margin: var(--pas-3) 0; }
    .panneau h2 { margin-bottom: 4px; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .bouton-principal { width: 100%; margin-top: var(--pas-3); }

    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2); }
    li { padding: var(--pas-2); }
    .ligne { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas-2); }
    .identite { display: flex; flex-direction: column; gap: 2px; }
    .nom { font-weight: 700; }
    .etat { flex: none; padding: 2px 10px; border-radius: var(--r-s); font-size: .8125rem; font-weight: 700; }
    .etat.actif { background: var(--acquis-clair); color: var(--acquis); }
    .etat.inactif { background: #EEF2F4; color: var(--craie); }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }

    @media (max-width: 600px) {
      .ligne { flex-direction: column; }
    }
  `]
})
export class SaisonsComponent {
  private api = inject(ApiService);

  liste = signal<SaisonVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  envoi = signal(false);

  libelle = '';
  dateDebut = '';
  dateFin = '';

  enEdition = signal<number | null>(null);
  brouillon = { libelle: '', dateDebut: '', dateFin: '' };

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    this.chargement.set(true);
    try {
      this.liste.set(await firstValueFrom(this.api.saisons()));
    } catch {
      this.message.set('Impossible de charger les saisons.');
    } finally {
      this.chargement.set(false);
    }
  }

  creer(): void {
    if (!this.libelle || !this.dateDebut || !this.dateFin) {
      this.message.set('Libellé, début et fin sont obligatoires.');
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    this.api.creerSaison({ libelle: this.libelle, dateDebut: this.dateDebut, dateFin: this.dateFin })
      .subscribe({
        next: s => {
          this.envoi.set(false);
          this.liste.set([s, ...this.liste()]);
          this.libelle = '';
          this.dateDebut = '';
          this.dateFin = '';
        },
        error: (e: HttpErrorResponse) => {
          this.envoi.set(false);
          this.message.set(e.error?.detail ?? "La création n'a pas pu être enregistrée.");
        }
      });
  }

  changerOuverture(s: SaisonVue): void {
    this.message.set(null);
    this.api.changerOuvertureSaison(s.id, !s.ouverte).subscribe({
      next: maj => this.liste.set(this.liste().map(x => x.id === maj.id ? maj : x)),
      error: (e: HttpErrorResponse) =>
        this.message.set(e.error?.detail ?? "L'action n'a pas pu être enregistrée.")
    });
  }

  commencerEdition(s: SaisonVue): void {
    this.message.set(null);
    this.brouillon = { libelle: s.libelle, dateDebut: s.dateDebut, dateFin: s.dateFin };
    this.enEdition.set(s.id);
  }

  annulerEdition(): void {
    this.enEdition.set(null);
  }

  enregistrer(s: SaisonVue): void {
    if (!this.brouillon.libelle || !this.brouillon.dateDebut || !this.brouillon.dateFin) {
      this.message.set('Libellé, début et fin sont obligatoires.');
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    this.api.modifierSaison(s.id, this.brouillon).subscribe({
      next: maj => {
        this.envoi.set(false);
        this.liste.set(this.liste().map(x => x.id === maj.id ? maj : x));
        this.enEdition.set(null);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "La modification n'a pas pu être enregistrée.");
      }
    });
  }
}
