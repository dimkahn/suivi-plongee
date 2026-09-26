import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ProgressionResume, ProgressionVue, SaisonVue } from '../../core/modeles';
import { DateFrPipe } from '../../core/date-fr';

@Component({
  selector: 'app-saisons',
  imports: [FormsModule, DateFrPipe],
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
                  <span class="secondaire">Du {{ s.dateDebut | dateFr }} au {{ s.dateFin | dateFr }}</span>
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

              <div class="progressions">
                <span class="titre-progressions">Progressions suivies</span>
                @if (editionProgressions() === s.id) {
                  @for (g of groupesProgressions(); track g.referentielId) {
                    <label [for]="'progression-' + s.id + '-' + g.referentielId">{{ g.libelle }}</label>
                    <select [id]="'progression-' + s.id + '-' + g.referentielId"
                            [(ngModel)]="choixProgressions[g.referentielId]">
                      <option [ngValue]="null">Aucune</option>
                      @for (p of g.progressions; track p.id) { <option [ngValue]="p.id">{{ p.nom }}</option> }
                    </select>
                  } @empty {
                    <p class="secondaire">Aucune progression type : créez-en depuis « Progressions types ».</p>
                  }
                  <div class="actions">
                    <button type="button" class="bouton-principal" (click)="enregistrerProgressions(s)"
                            [disabled]="envoi()">
                      {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
                    </button>
                    <button type="button" class="bouton-discret" (click)="editionProgressions.set(null)">
                      Annuler
                    </button>
                  </div>
                } @else {
                  @let suivies = progressionsSuivies().get(s.id) ?? [];
                  @if (suivies.length === 0) {
                    <span class="secondaire">Aucune : les séances n'affichent pas de programme.</span>
                  } @else {
                    <ul class="liste-progressions">
                      @for (p of suivies; track p.id) {
                        <li>{{ p.nom }} <span class="secondaire">({{ p.niveau }} · MFT {{ p.versionMft }})</span></li>
                      }
                    </ul>
                  }
                  <div class="actions">
                    <button type="button" class="bouton-discret" (click)="commencerProgressions(s)">
                      Choisir les progressions
                    </button>
                  </div>
                }
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
    .actions .bouton-principal { width: auto; margin-top: 0; }
    .progressions { margin-top: var(--pas-2); padding-top: var(--pas-2); border-top: 1px solid var(--trait); }
    .titre-progressions { display: block; font-weight: 700; font-size: .9375rem; margin-bottom: 4px; }
    .liste-progressions { display: block; padding-left: 1.25rem; list-style: disc; }
    .liste-progressions li { padding: 2px 0; }

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

  /** Toutes les progressions types, et celles que suit chaque saison. */
  progressions = signal<ProgressionResume[]>([]);
  progressionsSuivies = signal<Map<number, ProgressionVue[]>>(new Map());
  editionProgressions = signal<number | null>(null);
  /** Progression choisie par référentiel pendant l'édition ; null = aucune. */
  choixProgressions: Record<number, number | null> = {};

  /** Une liste de choix par référentiel : une saison en suit au plus une progression. */
  groupesProgressions = computed(() => {
    const groupes = new Map<number, { referentielId: number; libelle: string; progressions: ProgressionResume[] }>();
    for (const p of this.progressions()) {
      if (!groupes.has(p.referentielId)) {
        groupes.set(p.referentielId, {
          referentielId: p.referentielId, libelle: `${p.niveau} · MFT ${p.versionMft}`, progressions: []
        });
      }
      groupes.get(p.referentielId)!.progressions.push(p);
    }
    return [...groupes.values()];
  });

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    this.chargement.set(true);
    try {
      this.liste.set(await firstValueFrom(this.api.saisons()));
      await this.chargerProgressions();
    } catch {
      this.message.set('Impossible de charger les saisons.');
    } finally {
      this.chargement.set(false);
    }
  }

  /** Facultatif : un échec ici laisse l'écran des saisons utilisable. */
  private async chargerProgressions(): Promise<void> {
    try {
      this.progressions.set(await firstValueFrom(this.api.progressions()));
      const suivies = new Map<number, ProgressionVue[]>();
      await Promise.all(this.liste().map(async s =>
        suivies.set(s.id, await firstValueFrom(this.api.progressionsSaison(s.id)))));
      this.progressionsSuivies.set(suivies);
    } catch {
      this.message.set('Impossible de charger les progressions suivies par les saisons.');
    }
  }

  commencerProgressions(s: SaisonVue): void {
    this.message.set(null);
    this.choixProgressions = {};
    for (const g of this.groupesProgressions()) this.choixProgressions[g.referentielId] = null;
    for (const p of this.progressionsSuivies().get(s.id) ?? []) this.choixProgressions[p.referentielId] = p.id;
    this.editionProgressions.set(s.id);
  }

  enregistrerProgressions(s: SaisonVue): void {
    const ids = Object.values(this.choixProgressions).filter((id): id is number => id != null);
    this.envoi.set(true);
    this.message.set(null);
    this.api.definirProgressionsSaison(s.id, ids).subscribe({
      next: suivies => {
        this.envoi.set(false);
        this.progressionsSuivies.set(new Map(this.progressionsSuivies()).set(s.id, suivies));
        this.editionProgressions.set(null);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "Le choix des progressions n'a pas pu être enregistré.");
      }
    });
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
          this.progressionsSuivies.set(new Map(this.progressionsSuivies()).set(s.id, []));
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
