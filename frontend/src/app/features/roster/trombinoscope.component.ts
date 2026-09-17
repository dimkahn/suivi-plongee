import { Component, OnDestroy, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { LigneTrombinoscope } from '../../core/modeles';

type FiltreNiveau = 'TOUS' | 'N1' | 'N2' | 'N3';

@Component({
  selector: 'app-trombinoscope',
  imports: [RouterLink, FormsModule],
  template: `
    <h1>Trombinoscope</h1>
    <p class="secondaire">Par niveau, saison courante. Sans photo si le droit à l'image n'a pas été recueilli.</p>

    <div class="filtres" role="group" aria-label="Filtrer par niveau">
      @for (choix of niveaux; track choix) {
        <button type="button" class="bouton-discret" [class.actif]="niveauFiltre() === choix"
                [attr.aria-pressed]="niveauFiltre() === choix" (click)="niveauFiltre.set(choix)">
          {{ choix === 'TOUS' ? 'Tous' : choix }}
        </button>
      }
    </div>

    <label for="filtreNom" class="etiquette-recherche">Nom ou prénom</label>
    <input id="filtreNom" type="text" class="recherche" placeholder="Rechercher un élève…"
           [ngModel]="filtreNom()" (ngModelChange)="filtreNom.set($event)">

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (erreur()) {
      <div class="carte vide"><p>{{ erreur() }}</p></div>
    } @else if (lignesFiltrees().length === 0) {
      <div class="carte vide"><p>Aucun élève ne correspond à cette sélection.</p></div>
    } @else {
      <div class="grille">
        @for (l of lignesFiltrees(); track l.eleveId) {
          <a class="carte fiche" [routerLink]="['/cursus', l.cursusId]">
            @if (l.aPhoto) {
              <img [src]="urlPhoto(l.eleveId)" [alt]="l.eleve" width="120" height="120">
            } @else {
              <div class="silhouette" [attr.aria-label]="l.eleve">
                {{ initiales(l.eleve) }}
              </div>
            }
            <span class="nom">{{ l.eleve }}</span>
            <span class="secondaire">{{ l.niveau }}</span>
            @if (!l.autorisationImage) {
              <span class="secondaire">Droit à l'image non recueilli</span>
            }
          </a>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .filtres { display: flex; gap: var(--pas); margin: var(--pas-3) 0; flex-wrap: wrap; }
    .filtres .bouton-discret.actif { background: var(--profond); color: #fff; border-color: var(--profond); }
    .etiquette-recherche { display: block; margin: 0 0 4px; font-weight: 700; font-size: .9375rem; }
    .recherche { max-width: 320px; margin-bottom: var(--pas-3); }

    .grille {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--pas-2);
    }
    .fiche {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: var(--pas-2); text-decoration: none; color: inherit; text-align: center;
    }
    .fiche img, .silhouette {
      width: 120px; height: 120px; border-radius: 50%; object-fit: cover; background: var(--fond);
    }
    .silhouette {
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-titres), sans-serif; font-size: 2rem; font-weight: 700; color: var(--craie);
    }
    .nom { font-weight: 700; margin-top: 4px; }
  `]
})
export class TrombinoscopeComponent implements OnDestroy {
  private api = inject(ApiService);

  readonly niveaux: FiltreNiveau[] = ['TOUS', 'N1', 'N2', 'N3'];

  lignes = signal<LigneTrombinoscope[]>([]);
  chargement = signal(true);
  erreur = signal<string | null>(null);
  niveauFiltre = signal<FiltreNiveau>('TOUS');
  filtreNom = signal('');

  lignesFiltrees = computed(() => {
    const niveau = this.niveauFiltre();
    const parNiveau = niveau === 'TOUS' ? this.lignes() : this.lignes().filter(l => l.niveau === niveau);
    const recherche = this.normaliser(this.filtreNom());
    return recherche ? parNiveau.filter(l => this.normaliser(l.eleve).includes(recherche)) : parNiveau;
  });

  /** Casse et accents ignorés : « Loic » retrouve « Loïc » sur un clavier qui ne les tape pas facilement. */
  private normaliser(texte: string): string {
    return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  }

  private urlsPhotos = signal<Map<number, string>>(new Map());

  constructor() {
    this.api.trombinoscope().subscribe({
      next: lignes => {
        this.lignes.set(lignes);
        this.chargement.set(false);
        for (const l of lignes) {
          if (l.aPhoto) this.chargerPhoto(l.eleveId);
        }
      },
      error: () => {
        this.erreur.set('Impossible de charger le trombinoscope.');
        this.chargement.set(false);
      }
    });
  }

  private chargerPhoto(eleveId: number): void {
    this.api.photoEleve(eleveId).subscribe({
      next: blob => {
        const copie = new Map(this.urlsPhotos());
        copie.set(eleveId, URL.createObjectURL(blob));
        this.urlsPhotos.set(copie);
      },
      error: () => { /* pas de photo consultable : la silhouette reste affichée */ }
    });
  }

  urlPhoto(eleveId: number): string {
    return this.urlsPhotos().get(eleveId) ?? '';
  }

  initiales(nom: string): string {
    return nom.split(' ').filter(Boolean).map(m => m[0]).slice(0, 2).join('').toUpperCase();
  }

  ngOnDestroy(): void {
    for (const url of this.urlsPhotos().values()) URL.revokeObjectURL(url);
  }
}
