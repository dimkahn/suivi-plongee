import { Component, ElementRef, OnDestroy, computed, inject, signal, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { libellePreparation } from '../../core/niveaux';
import { ApiService } from '../../core/api.service';
import { ReseauService } from '../../core/reseau.service';
import { AuthService } from '../../core/auth.service';
import { RecadragePhotoComponent } from '../../core/recadrage-photo.component';
import { GroupeEntrainementVue, LigneTrombinoscope, LigneTrombinoscopeMoniteur } from '../../core/modeles';
import { FiltreGroupe, FiltreGroupeComponent, passeFiltreGroupe } from '../../core/filtre-groupe.component';

type Population = 'ELEVES' | 'MONITEURS';

/** Carte dont le menu est ouvert : un élève (fiche, modification, photo) ou un moniteur (photo seulement). */
type Cible =
  | { sorte: 'ELEVE'; ligne: LigneTrombinoscope }
  | { sorte: 'MONITEUR'; ligne: LigneTrombinoscopeMoniteur };

function idCible(c: Cible): number {
  return c.sorte === 'ELEVE' ? c.ligne.eleveId : c.ligne.id;
}

@Component({
  selector: 'app-trombinoscope',
  imports: [RouterLink, FormsModule, NgTemplateOutlet, FiltreGroupeComponent, RecadragePhotoComponent],
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
      <p class="secondaire">Par groupe d'entraînement, saison courante. Sans photo si le droit à l'image n'a pas été recueilli.</p>

      @if (groupes().length > 0) {
        <app-filtre-groupe class="filtres" [groupes]="groupes()" [ids]="eleveIds()"
                           [(valeur)]="groupeFiltre" />
      }
    } @else {
      <p class="secondaire">Encadrants actifs du club, filtrables par groupe d'entraînement de la saison courante. Sans photo si le droit à l'image n'a pas été recueilli.</p>

      @if (groupes().length > 0) {
        <app-filtre-groupe class="filtres" [groupes]="groupes()" [ids]="moniteurIds()" membres="ENCADRANTS"
                           [(valeur)]="groupeFiltreMoniteurs" />
      }
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
        <div class="carte vide"><p>Aucun moniteur ne correspond à cette sélection.</p></div>
      } @else {
        <div class="grille">
          @for (m of moniteursFiltres(); track m.id) {
            <!-- Un admin peut ajouter la photo qui manque ; sinon la carte n'est qu'un affichage. -->
            @if (auth.estAdmin() && !m.aPhoto) {
              <button type="button" class="carte fiche" (click)="ouvrirActions({ sorte: 'MONITEUR', ligne: m })"
                      [attr.aria-label]="'Ajouter une photo pour ' + m.nomComplet">
                <ng-container [ngTemplateOutlet]="contenuFicheMoniteur" [ngTemplateOutletContext]="{ $implicit: m }" />
              </button>
            } @else {
              <div class="carte fiche">
                <ng-container [ngTemplateOutlet]="contenuFicheMoniteur" [ngTemplateOutletContext]="{ $implicit: m }" />
              </div>
            }
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
          <!-- Un admin a plusieurs gestes possibles (menu) ; un moniteur n'a que la fiche de suivi. -->
          @if (auth.estAdmin()) {
            <button type="button" class="carte fiche" (click)="ouvrirActions({ sorte: 'ELEVE', ligne: l })"
                    [attr.aria-label]="'Actions pour ' + l.eleve">
              <ng-container [ngTemplateOutlet]="contenuFiche" [ngTemplateOutletContext]="{ $implicit: l }" />
            </button>
          } @else {
            <a class="carte fiche" [routerLink]="['/cursus', l.cursusId]">
              <ng-container [ngTemplateOutlet]="contenuFiche" [ngTemplateOutletContext]="{ $implicit: l }" />
            </a>
          }
        }
      </div>
    }

    <ng-template #contenuFicheMoniteur let-m>
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
    </ng-template>

    <ng-template #contenuFiche let-l>
      @if (l.aPhoto) {
        <img [src]="urlPhoto(l.eleveId)" [alt]="l.eleve" width="120" height="120">
      } @else {
        <div class="silhouette" [attr.aria-label]="l.eleve">
          {{ initiales(l.eleve) }}
        </div>
      }
      <span class="nom">{{ l.eleve }}</span>
      <span class="secondaire">{{ libellePreparation(l.niveau) }}</span>
      @if (!l.autorisationImage) {
        <span class="secondaire">Droit à l'image non recueilli</span>
      }
    </ng-template>

    <dialog #dialogueActions class="dialogue-seance" aria-labelledby="titre-actions"
            (close)="choisi.set(null)">
      @if (choisi(); as c) {
        <div class="entete-dialogue">
          <h2 id="titre-actions">{{ nomCible(c) }}</h2>
          <button type="button" class="bouton-discret" (click)="fermerActions()" aria-label="Fermer">✕</button>
        </div>
        <p class="secondaire">
          {{ c.sorte === 'ELEVE' ? libellePreparation(c.ligne.niveau) : (c.ligne.niveauEncadrement ?? 'Niveau non renseigné') }}
        </p>

        @if (messageActions(); as m) { <div class="alerte" role="status">{{ m }}</div> }

        @if (c.sorte === 'ELEVE') {
          <div class="actions-eleve">
            <a class="bouton-principal" [routerLink]="['/cursus', c.ligne.cursusId]" (click)="fermerActions()">
              Fiche de suivi
            </a>
            <a class="bouton-discret" routerLink="/admin/eleves"
               [queryParams]="{ modifier: c.ligne.eleveId, retour: '/trombinoscope' }" (click)="fermerActions()">
              Modifier l'élève
            </a>
          </div>
        }

        @if (!c.ligne.aPhoto) {
          <section class="photo" [class.seule]="c.sorte === 'MONITEUR'">
            <h3>Photo</h3>
            @if (!c.ligne.autorisationImage) {
              <p class="secondaire">
                Pas de photo sans le droit à l'image@if (c.sorte === 'ELEVE') {, distinct de l'autorisation de pratiquer}.
              </p>
              <label class="case">
                <input type="checkbox" [(ngModel)]="consentementConfirme">
                @if (c.sorte === 'ELEVE') {
                  Le droit à l'image a été recueilli (accord de l'élève, ou de son responsable légal s'il est mineur)
                } @else {
                  Le moniteur a donné son accord pour paraître dans le trombinoscope
                }
              </label>
              <button type="button" class="bouton-discret" (click)="recueillirDroitImage(c)"
                      [disabled]="!consentementConfirme || envoi()">
                {{ envoi() ? 'Enregistrement…' : "Enregistrer le droit à l'image" }}
              </button>
            } @else {
              <label class="bouton-discret upload">
                Prendre ou choisir une photo
                <input type="file" accept="image/*" hidden (change)="choisirPhoto($event)">
              </label>
            }
          </section>
        }
      }
    </dialog>

    @if (recadrage(); as r) {
      <app-recadrage-photo [fichier]="r.fichier" [titre]="'Recadrer la photo de ' + nomCible(r.cible)"
                           [enCours]="envoi()" (valide)="deposerPhoto($event)"
                           (annule)="recadrage.set(null)" (illisible)="imageIllisible()" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .onglets { display: flex; gap: var(--pas); margin: var(--pas-2) 0; }
    .onglets .bouton-discret.actif { background: var(--profond); color: #fff; border-color: var(--profond); }
    .filtres { margin: var(--pas-3) 0; }
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
    button.fiche { width: 100%; font: inherit; border: none; cursor: pointer; }
    .nom { font-weight: 700; margin-top: 4px; }

    .actions-eleve { display: grid; gap: var(--pas); margin: var(--pas-2) 0; }
    .actions-eleve a { display: flex; align-items: center; justify-content: center; text-decoration: none;
                       min-height: 44px; }
    .actions-eleve .bouton-discret { border: 1px solid var(--trait); border-radius: var(--r-s); color: inherit; }
    .photo { border-top: 1px solid var(--trait); padding-top: var(--pas-2); display: grid; gap: var(--pas); }
    .photo h3 { margin: 0; }
    .photo.seule { border-top: none; padding-top: 0; }
    .case { display: flex; align-items: flex-start; gap: var(--pas); min-height: 44px; }
    .case input { width: auto; flex: none; margin-top: 4px; }
    .upload { display: flex; align-items: center; justify-content: center; min-height: 44px; cursor: pointer;
              border: 1px solid var(--trait); border-radius: var(--r-s); }
  `]
})
export class TrombinoscopeComponent implements OnDestroy {
  private api = inject(ApiService);
  private reseau = inject(ReseauService);
  auth = inject(AuthService);
  private dialogueActions = viewChild<ElementRef<HTMLDialogElement>>('dialogueActions');

  /** Carte dont le menu d'actions est ouvert (admins seulement). */
  choisi = signal<Cible | null>(null);
  messageActions = signal<string | null>(null);
  envoi = signal(false);
  consentementConfirme = false;
  recadrage = signal<{ cible: Cible; fichier: File } | null>(null);

  readonly libellePreparation = libellePreparation;

  lignes = signal<LigneTrombinoscope[]>([]);
  chargement = signal(true);
  erreur = signal<string | null>(null);
  /** Groupes d'entraînement de la saison ouverte (ceux du planning du bassin). */
  groupes = signal<GroupeEntrainementVue[]>([]);
  groupeFiltre = signal<FiltreGroupe>('TOUS');
  filtreNom = signal('');

  eleveIds = computed(() => this.lignes().map(l => l.eleveId));

  lignesFiltrees = computed(() => {
    const parGroupe = this.lignes().filter(l => passeFiltreGroupe(l.eleveId, this.groupeFiltre(), this.groupes()));
    const recherche = this.normaliser(this.filtreNom());
    return recherche ? parGroupe.filter(l => this.normaliser(l.eleve).includes(recherche)) : parGroupe;
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

  /** Filtre propre à l'onglet Moniteurs : on y retrouve les encadrants attitrés de chaque groupe. */
  groupeFiltreMoniteurs = signal<FiltreGroupe>('TOUS');
  moniteurIds = computed(() => (this.moniteurs() ?? []).map(m => m.id));

  moniteursFiltres = computed(() => {
    const parGroupe = (this.moniteurs() ?? [])
      .filter(m => passeFiltreGroupe(m.id, this.groupeFiltreMoniteurs(), this.groupes(), 'ENCADRANTS'));
    const recherche = this.normaliser(this.filtreNom());
    return recherche ? parGroupe.filter(m => this.normaliser(m.nomComplet).includes(recherche)) : parGroupe;
  });

  afficherMoniteurs(): void {
    this.population.set('MONITEURS');
    if (this.moniteurs() !== null) return;
    this.api.trombinoscopeMoniteurs().then(
      lignes => {
        this.moniteurs.set(lignes);
        for (const m of lignes) {
          if (m.aPhoto) this.chargerPhotoMoniteur(m.id);
        }
      },
      () => {
        this.erreurMoniteurs.set(this.reseau.enLigne()
          ? 'Impossible de charger le trombinoscope des moniteurs.'
          : 'Trombinoscope des moniteurs non disponible hors ligne : utilisez « Préparer hors ligne » quand vous avez du réseau.');
        this.moniteurs.set([]);
      }
    );
  }

  private chargerPhotoMoniteur(id: number): void {
    this.api.photoMoniteur(id).then(
      blob => {
        const copie = new Map(this.urlsPhotosMoniteurs());
        copie.set(id, URL.createObjectURL(blob));
        this.urlsPhotosMoniteurs.set(copie);
      },
      () => { /* pas de photo consultable : la silhouette reste affichée */ }
    );
  }

  urlPhotoMoniteur(id: number): string {
    return this.urlsPhotosMoniteurs().get(id) ?? '';
  }

  constructor() {
    this.api.groupesEntrainementSaisonOuverte().then(g => this.groupes.set(g), () => {});
    this.api.trombinoscope().then(
      lignes => {
        this.lignes.set(lignes);
        this.chargement.set(false);
        for (const l of lignes) {
          if (l.aPhoto) this.chargerPhoto(l.eleveId);
        }
      },
      () => {
        this.erreur.set(this.reseau.enLigne()
          ? 'Impossible de charger le trombinoscope.'
          : 'Trombinoscope non disponible hors ligne : utilisez « Préparer hors ligne » quand vous avez du réseau.');
        this.chargement.set(false);
      }
    );
  }

  private chargerPhoto(eleveId: number): void {
    this.api.photoEleve(eleveId).then(
      blob => {
        const copie = new Map(this.urlsPhotos());
        copie.set(eleveId, URL.createObjectURL(blob));
        this.urlsPhotos.set(copie);
      },
      () => { /* pas de photo consultable : la silhouette reste affichée */ }
    );
  }

  urlPhoto(eleveId: number): string {
    return this.urlsPhotos().get(eleveId) ?? '';
  }

  nomCible(c: Cible): string {
    return c.sorte === 'ELEVE' ? c.ligne.eleve : c.ligne.nomComplet;
  }

  ouvrirActions(c: Cible): void {
    this.choisi.set(c);
    this.messageActions.set(null);
    this.consentementConfirme = false;
    this.dialogueActions()?.nativeElement.showModal();
  }

  fermerActions(): void {
    this.dialogueActions()?.nativeElement.close();
  }

  /** Relit la carte dans sa liste : l'état a pu changer depuis l'ouverture du menu. */
  private fraiche(c: Cible): Cible {
    if (c.sorte === 'ELEVE') {
      const ligne = this.lignes().find(x => x.eleveId === c.ligne.eleveId);
      return ligne ? { sorte: 'ELEVE', ligne } : c;
    }
    const ligne = (this.moniteurs() ?? []).find(x => x.id === c.ligne.id);
    return ligne ? { sorte: 'MONITEUR', ligne } : c;
  }

  /** Met à jour la carte dans sa liste et dans le menu ouvert. */
  private majCible(c: Cible, maj: { aPhoto?: boolean; autorisationImage?: boolean }): void {
    if (c.sorte === 'ELEVE') {
      this.lignes.set(this.lignes().map(x => x.eleveId === c.ligne.eleveId ? { ...x, ...maj } : x));
    } else {
      this.moniteurs.set((this.moniteurs() ?? []).map(x => x.id === c.ligne.id ? { ...x, ...maj } : x));
    }
    const ouverte = this.choisi();
    if (ouverte && ouverte.sorte === c.sorte && idCible(ouverte) === idCible(c)) {
      this.choisi.set(this.fraiche(c));
    }
  }

  async recueillirDroitImage(c: Cible): Promise<void> {
    if (!this.consentementConfirme) return;
    this.envoi.set(true);
    this.messageActions.set(null);
    try {
      await firstValueFrom(c.sorte === 'ELEVE'
        ? this.api.changerAutorisationImage(c.ligne.eleveId, true)
        : this.api.changerAutorisationImageMoniteur(c.ligne.id, true));
      this.majCible(c, { autorisationImage: true });
    } catch (e) {
      this.messageActions.set((e as HttpErrorResponse).error?.detail
        ?? (this.reseau.enLigne() ? "Le droit à l'image n'a pas pu être enregistré." : 'Pas de réseau : réessayez plus tard.'));
    } finally {
      this.envoi.set(false);
    }
  }

  /** Ouvre le recadrage ; la photo n'est envoyée qu'une fois validée. */
  choisirPhoto(evenement: Event): void {
    const entree = evenement.target as HTMLInputElement;
    const fichier = entree.files?.[0];
    entree.value = '';
    const c = this.choisi();
    if (!fichier || !c) return;
    this.messageActions.set(null);
    // Le dialogue modal passerait au-dessus du recadrage : on le ferme le temps de recadrer.
    this.fermerActions();
    this.recadrage.set({ cible: c, fichier });
  }

  imageIllisible(): void {
    const r = this.recadrage();
    this.recadrage.set(null);
    if (r) this.rouvrir(r.cible, "Cette image n'a pas pu être lue.");
  }

  /** Rouvre le menu avec un message (échec pendant le recadrage ou l'envoi). */
  private rouvrir(c: Cible, message: string): void {
    this.ouvrirActions(this.fraiche(c));
    this.messageActions.set(message);
  }

  async deposerPhoto(fichier: File): Promise<void> {
    const r = this.recadrage();
    if (!r) return;
    const c = r.cible;
    this.envoi.set(true);
    try {
      if (c.sorte === 'ELEVE') {
        await firstValueFrom(this.api.deposerPhotoEleve(c.ligne.eleveId, fichier));
      } else {
        await firstValueFrom(this.api.deposerPhotoMoniteur(c.ligne.id, fichier));
      }
      this.recadrage.set(null);
      this.majCible(c, { aPhoto: true });
      if (c.sorte === 'ELEVE') this.chargerPhoto(c.ligne.eleveId);
      else this.chargerPhotoMoniteur(c.ligne.id);
    } catch (e) {
      this.recadrage.set(null);
      this.rouvrir(c, (e as HttpErrorResponse).error?.detail
        ?? (this.reseau.enLigne() ? "La photo n'a pas pu être déposée." : 'Pas de réseau : réessayez plus tard.'));
    } finally {
      this.envoi.set(false);
    }
  }

  initiales(nom: string): string {
    return nom.split(' ').filter(Boolean).map(m => m[0]).slice(0, 2).join('').toUpperCase();
  }

  ngOnDestroy(): void {
    for (const url of this.urlsPhotos().values()) URL.revokeObjectURL(url);
    for (const url of this.urlsPhotosMoniteurs().values()) URL.revokeObjectURL(url);
  }
}
