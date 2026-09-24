import { Component, OnDestroy, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { libellePreparation } from '../../core/niveaux';
import { ApiService } from '../../core/api.service';
import { RosterVue } from '../../core/modeles';
import { DateFrPipe } from '../../core/date-fr';

const LIBELLES: Record<string, string> = {
  NAGE: 'Nage', BLOC: 'Bloc', THEORIE: 'Théorie', PLONGEE: 'Plongée',
  ABSENT: 'ABS', EXCUSE: 'Excusé', PRESENT: 'Présent'
};

type FiltreNiveau = 'TOUS' | 'N1' | 'N2' | 'N3';

@Component({
  selector: 'app-roster',
  imports: [RouterLink, FormsModule, DateFrPipe],
  template: `
    <h1>Infos élèves</h1>
    <p class="secondaire">Vue d'ensemble de la saison : présence par séance, CACI, volume de séances.</p>

    @if (roster(); as r) {
      <div class="filtres" role="group" aria-label="Filtrer par niveau">
        @for (choix of niveaux; track choix) {
          <button type="button" class="bouton-discret"
                  [class.actif]="niveauFiltre() === choix"
                  [attr.aria-pressed]="niveauFiltre() === choix"
                  (click)="niveauFiltre.set(choix)">
            {{ choix === 'TOUS' ? 'Tous' : libellePreparation(choix) }}
          </button>
        }
      </div>

      <label for="filtreNom" class="etiquette-recherche">Nom ou prénom</label>
      <input id="filtreNom" type="text" class="recherche" placeholder="Rechercher un élève…"
             [ngModel]="filtreNom()" (ngModelChange)="filtreNom.set($event)">
    }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (erreur()) {
      <div class="carte vide"><p>{{ erreur() }}</p></div>
    } @else if (roster(); as r) {
      @if (elevesFiltres().length === 0) {
        <div class="carte vide">
          <p>
            Aucun élève {{ niveauFiltre() === 'TOUS' ? '' : 'en ' + niveauFiltre() + ' ' }}
            {{ filtreNom() ? 'ne correspond à « ' + filtreNom() + ' »' : 'sur cette saison' }}.
          </p>
        </div>
      } @else {
      <div class="tableau-scroll">
        <table>
          <thead>
            <tr>
              <th class="figee">Élève</th>
              <th>Niveau</th>
              <th>CACI</th>
              <th>Bloc</th>
              <th>Nage</th>
              @for (s of r.seances; track s.id) {
                <th>{{ s.date | dateFr }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (e of elevesFiltres(); track e.cursusId) {
              <tr>
                <td class="figee">
                  <div class="eleve-cellule">
                    @if (urlPhoto(e.eleveId); as url) {
                      <img class="avatar" [src]="url" [alt]="e.eleve" width="40" height="40">
                    } @else {
                      <div class="avatar silhouette" aria-hidden="true">{{ initiales(e.eleve) }}</div>
                    }
                    <div class="identite-cellule">
                      <a [routerLink]="['/cursus', e.cursusId]">{{ e.eleve }}</a>
                      @if (e.moniteurReferent) {
                        <span class="secondaire">{{ e.moniteurReferent }}</span>
                      }
                    </div>
                  </div>
                </td>
                <td>{{ libellePreparation(e.niveau) }}</td>
                <td [class.alerte-cellule]="!e.caciValide">{{ e.caciValide ? 'OK' : '⚠' }}</td>
                <td>{{ e.seancesBloc }}</td>
                <td>{{ e.seancesNage }}</td>
                @for (s of r.seances; track s.id) {
                  <td [class.absence]="e.presencesParSeance[s.id] === 'ABSENT'">
                    {{ libelle(e.presencesParSeance[s.id]) }}
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .filtres { display: flex; gap: var(--pas); margin-top: var(--pas-3); flex-wrap: wrap; }
    .filtres .bouton-discret.actif {
      background: var(--profond); color: #fff; border-color: var(--profond);
    }
    .etiquette-recherche { display: block; margin: var(--pas-2) 0 4px; font-weight: 700; font-size: .9375rem; }
    /* Espacement porté par le champ : il vaut pour le tableau comme pour le message « aucun élève ». */
    .recherche { max-width: 320px; margin-bottom: var(--pas-3); }
    .tableau-scroll { overflow-x: auto; }
    table { border-collapse: collapse; white-space: nowrap; }
    th, td {
      padding: 8px 12px; border-bottom: 1px solid var(--trait); text-align: left; font-size: .875rem;
    }
    thead th { color: var(--craie); font-weight: 700; }
    .figee { position: sticky; left: 0; min-width: 200px; }
    .eleve-cellule { display: flex; align-items: center; gap: var(--pas); }
    .avatar {
      flex: none; width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background: var(--fond);
    }
    .silhouette {
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-titres), sans-serif; font-size: .8125rem; font-weight: 700; color: var(--craie);
    }
    th.figee { background: var(--fond); }
    td.figee { background: var(--carte); }
    .identite-cellule { display: flex; flex-direction: column; gap: 2px; white-space: normal; }
    .identite-cellule a { font-weight: 700; }
    .alerte-cellule { color: #B3261E; font-weight: 700; }
    .absence { color: var(--craie); }
  `]
})
export class RosterComponent implements OnDestroy {
  private api = inject(ApiService);

  readonly niveaux: FiltreNiveau[] = ['TOUS', 'N1', 'N2', 'N3'];
  readonly libellePreparation = libellePreparation;

  roster = signal<RosterVue | null>(null);
  chargement = signal(true);
  erreur = signal<string | null>(null);
  niveauFiltre = signal<FiltreNiveau>('TOUS');
  filtreNom = signal('');

  elevesFiltres = computed(() => {
    const r = this.roster();
    if (!r) return [];
    const niveau = this.niveauFiltre();
    const parNiveau = niveau === 'TOUS' ? r.eleves : r.eleves.filter(e => e.niveau === niveau);
    const recherche = this.normaliser(this.filtreNom());
    return recherche ? parNiveau.filter(e => this.normaliser(e.eleve).includes(recherche)) : parNiveau;
  });

  /** Casse et accents ignorés : « Loic » retrouve « Loïc » sur un clavier qui ne les tape pas facilement. */
  private normaliser(texte: string): string {
    return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  }

  constructor() {
    this.api.roster().subscribe({
      next: r => {
        this.roster.set(r);
        this.chargement.set(false);
        for (const e of r.eleves) {
          if (e.aPhoto) this.chargerPhoto(e.eleveId);
        }
      },
      error: () => {
        this.erreur.set("Impossible de charger la vue d'ensemble.");
        this.chargement.set(false);
      }
    });
  }

  /** Un élève inscrit à deux formations la même saison n'a qu'une photo : on ne la charge qu'une fois. */
  private urlsPhotos = signal<Map<number, string>>(new Map());
  private photosDemandees = new Set<number>();

  private chargerPhoto(eleveId: number): void {
    if (this.photosDemandees.has(eleveId)) return;
    this.photosDemandees.add(eleveId);
    this.api.photoEleve(eleveId).subscribe({
      next: blob => {
        const copie = new Map(this.urlsPhotos());
        copie.set(eleveId, URL.createObjectURL(blob));
        this.urlsPhotos.set(copie);
      },
      error: () => { /* pas de photo consultable : les initiales restent affichées */ }
    });
  }

  urlPhoto(eleveId: number): string | null {
    return this.urlsPhotos().get(eleveId) ?? null;
  }

  initiales(nom: string): string {
    return nom.split(' ').filter(Boolean).map(m => m[0]).slice(0, 2).join('').toUpperCase();
  }

  ngOnDestroy(): void {
    for (const url of this.urlsPhotos().values()) URL.revokeObjectURL(url);
  }

  libelle(code: string | undefined): string {
    if (!code) return '–';
    return LIBELLES[code] ?? code;
  }
}
