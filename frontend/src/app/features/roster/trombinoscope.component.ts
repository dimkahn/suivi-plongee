import { Component, OnDestroy, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { LigneTrombinoscope, LigneTrombinoscopeMoniteur } from '../../core/modeles';

type FiltreNiveau = 'TOUS' | 'N1' | 'N2' | 'N3';
type Population = 'ELEVES' | 'MONITEURS';

@Component({
  selector: 'app-trombinoscope',
  imports: [RouterLink, FormsModule],
  template: `
    <h1>Trombinoscope</h1>

    <div class="onglets" role="group" aria-label="Élèves ou moniteurs">
      <button type="button" class="bouton-discret" [class.actif]="population() === 'ELEVES'"
              [attr.aria-pressed]="population() === 'ELEVES'" (click)="population.set('ELEVES')">
        Élèves
      </button>
      <button type="button" class="bouton-discret" [class.actif]="population() === 'MONITEURS'"
              [attr.aria-pressed]="population() === 'MONITEURS'" (click)="afficherMoniteurs()">
        Moniteurs
      </button>
    </div>

    @if (population() === 'ELEVES') {
      <p class="secondaire">Par niveau, saison courante. Sans photo si le droit à l'image n'a pas été recueilli.</p>

      <div class="filtres" role="group" aria-label="Filtrer par niveau">
        @for (choix of niveaux; track choix) {
          <button type="button" class="bouton-discret" [class.actif]="niveauFiltre() === choix"
                  [attr.aria-pressed]="niveauFiltre() === choix" (click)="niveauFiltre.set(choix)">
            {{ choix === 'TOUS' ? 'Tous' : choix }}
          </button>
        }
      </div>
    } @else {
      <p class="secondaire">Encadrants actifs du club. Sans photo si le droit à l'image n'a pas été recueilli.</p>
    }

    <label for="filtreNom" class="etiquette-recherche">Nom ou prénom</label>
    <input id="filtreNom" type="text" class="recherche"
           [placeholder]="population() === 'ELEVES' ? 'Rechercher un élève…' : 'Rechercher un moniteur…'"
           [ngModel]="filtreNom()" (ngModelChange)="filtreNom.set($event)">

    @if (population() === 'MONITEURS') {
      @if (moniteurs() === null) {
        <p class="vide">Chargement…</p>
      } @else if (erreurMoniteurs()) {
        <div class="carte vide"><p>{{ erreurMoniteurs() }}</p></div>
      } @else if (moniteursFiltres().length === 0) {
        <div class="carte vide"><p>Aucun moniteur ne correspond à cette recherche.</p></div>
      } @else {
        <div class="grille">
          @for (m of moniteursFiltres(); track m.id) {
            <div class="carte fiche">
              @if (m.aPhoto) {
                <img [src]="urlPhotoMoniteur(m.id)" [alt]="m.nomComplet" width="120" height="120">
              } @else {
                <div class="silhouette" [attr.aria-label]="m.nomComplet">{{ initiales(m.nomComplet) }}</div>
              }
              <span class="nom">{{ m.nomComplet }}</span>
              <span class="secondaire">{{ m.niveauEncadrement ?? 'Niveau non renseigné' }}</span>
              @if (!m.autorisationImage) {
                <span class="secondaire">Droit à l'image non recueilli</span>
              }
            </div>
          }
        </div>
      }
    } @else if (chargement()) {
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
    .onglets { display: flex; gap: var(--pas); margin: var(--pas-2) 0; }
    .onglets .bouton-discret.actif { background: var(--profond); color: #fff; border-color: var(--profond); }
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

  population = signal<Population>('ELEVES');
  /** Chargés au premier passage sur l'onglet : la plupart des consultations concernent les élèves. */
  moniteurs = signal<LigneTrombinoscopeMoniteur[] | null>(null);
  erreurMoniteurs = signal<string | null>(null);
  private urlsPhotosMoniteurs = signal<Map<number, string>>(new Map());

  moniteursFiltres = computed(() => {
    const recherche = this.normaliser(this.filtreNom());
    const liste = this.moniteurs() ?? [];
    return recherche ? liste.filter(m => this.normaliser(m.nomComplet).includes(recherche)) : liste;
  });

  afficherMoniteurs(): void {
    this.population.set('MONITEURS');
    if (this.moniteurs() !== null) return;
    this.api.trombinoscopeMoniteurs().subscribe({
      next: lignes => {
        this.moniteurs.set(lignes);
        for (const m of lignes) {
          if (m.aPhoto) this.chargerPhotoMoniteur(m.id);
        }
      },
      error: () => {
        this.erreurMoniteurs.set('Impossible de charger le trombinoscope des moniteurs.');
        this.moniteurs.set([]);
      }
    });
  }

  private chargerPhotoMoniteur(id: number): void {
    this.api.photoMoniteur(id).subscribe({
      next: blob => {
        const copie = new Map(this.urlsPhotosMoniteurs());
        copie.set(id, URL.createObjectURL(blob));
        this.urlsPhotosMoniteurs.set(copie);
      },
      error: () => { /* pas de photo consultable : la silhouette reste affichée */ }
    });
  }

  urlPhotoMoniteur(id: number): string {
    return this.urlsPhotosMoniteurs().get(id) ?? '';
  }

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
    for (const url of this.urlsPhotosMoniteurs().values()) URL.revokeObjectURL(url);
  }
}
