import { Component, OnDestroy, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { libellePreparation } from '../../core/niveaux';
import { CACI_LIMITES, CASES_CACI, couleurCaci, libelleCaci, libelleMedecinCaci } from '../../core/caci';
import { ApiService } from '../../core/api.service';
import { ReseauService } from '../../core/reseau.service';
import { GroupeEntrainementVue, LigneRoster, RosterVue } from '../../core/modeles';
import { DialogueComponent } from '../../core/dialogue.component';
import { FiltreGroupe, FiltreGroupeComponent, passeFiltreGroupe } from '../../core/filtre-groupe.component';
import { DateFrPipe } from '../../core/date-fr';

const LIBELLES: Record<string, string> = {
  NAGE: 'Nage', BLOC: 'Bloc', THEORIE: 'Théorie', PLONGEE: 'Plongée',
  ABSENT: 'ABS', EXCUSE: 'Excusé', PRESENT: 'Présent'
};

@Component({
  selector: 'app-roster',
  imports: [RouterLink, FormsModule, DateFrPipe, FiltreGroupeComponent, DialogueComponent],
  template: `
    <h1>Infos élèves</h1>
    <p class="secondaire">Vue d'ensemble de la saison : présence par séance, CACI, volume de séances.</p>

    @if (roster(); as r) {
      @if (groupes().length > 0) {
        <app-filtre-groupe class="filtres" [groupes]="groupes()" [ids]="eleveIds()"
                           [(valeur)]="groupeFiltre" />
      }

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
            Aucun élève {{ libelleGroupeFiltre() }}
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
                <th class="entete-seance">
                  <span class="date-seance">{{ s.date | dateFr }}</span>
                  @if (s.lieu) { <span class="lieu-seance">{{ s.lieu }}</span> }
                  <span class="milieu-seance" [class.naturel]="s.milieu === 'NATUREL'">
                    {{ s.milieu === 'NATUREL' ? 'Naturel' : 'Piscine' }}
                  </span>
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (e of elevesFiltres(); track e.cursusId) {
              <tr>
                <td class="figee">
                  <a class="eleve-cellule" [routerLink]="['/cursus', e.cursusId]">
                    @if (urlPhoto(e.eleveId); as url) {
                      <img class="avatar" [src]="url" [alt]="e.eleve" width="40" height="40">
                    } @else {
                      <div class="avatar silhouette" aria-hidden="true">{{ initiales(e.eleve) }}</div>
                    }
                    <div class="identite-cellule">
                      <span class="nom">{{ e.eleve }}</span>
                    </div>
                  </a>
                </td>
                <td>{{ libellePreparation(e.niveau) }}</td>
                @let couleur = couleurCaci(e.caciFinValidite);
                <td class="cellule-caci">
                  <button type="button" class="bouton-caci" [class]="couleur ? 'caci-' + couleur : 'alerte-cellule'"
                          [title]="libelleCaci(e.caciFinValidite)"
                          [attr.aria-label]="libelleCaci(e.caciFinValidite) + ' — détail du CACI de ' + e.eleve"
                          (click)="caciOuvert.set(e)">
                    {{ couleur ? 'OK' : '⚠' }}
                  </button>
                </td>
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

    <!-- Détail du CACI : dates et cases cochées par le médecin, en lecture seule (saisie dans le dossier de l'élève). -->
    <app-dialogue [ouvert]="caciOuvert() !== null" [titre]="'CACI de ' + (caciOuvert()?.eleve ?? '')"
                  (fermer)="caciOuvert.set(null)">
      @if (caciOuvert(); as e) {
        @let couleur = couleurCaci(e.caciFinValidite);
        <p class="etat-caci" [class]="couleur ? 'caci-' + couleur : 'alerte-cellule'">{{ libelleCaci(e.caciFinValidite) }}</p>
        <p>
          Date de l'examen :
          <strong>{{ e.caciDateExamen ? (e.caciDateExamen | dateFr) : 'non renseignée' }}</strong>
          <br>Médecin : <strong>{{ libelleMedecinCaci(e.caciMedecin) }}</strong>
        </p>
        @if (e.caciActivites.includes(caciLimites)) {
          <div class="alerte" role="note">
            Le médecin a fixé des limites et préconisations : lisez le certificat papier avant la séance.
          </div>
        }
        @if (e.caciActivites.length === 0) {
          <p class="secondaire">Les cases cochées sur le CACI n'ont pas été saisies dans le dossier.</p>
        }
        @for (g of casesCaci; track g.titre) {
          <h3 class="titre-cases">{{ g.titre }}</h3>
          <ul class="cases-caci">
            @for (c of g.cases; track c.code) {
              @let cochee = e.caciActivites.includes(c.code);
              <li [class.cochee]="cochee">
                <span class="marque" role="img" [attr.aria-label]="cochee ? 'cochée' : 'non cochée'">{{ cochee ? '☑' : '☐' }}</span>
                {{ c.libelle }}
              </li>
            }
          </ul>
        }
        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" (click)="caciOuvert.set(null)">Fermer</button>
        </div>
      }
    </app-dialogue>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .filtres { margin-top: var(--pas-3); }
    .etiquette-recherche { display: block; margin: var(--pas-2) 0 4px; font-weight: 700; font-size: .9375rem; }
    /* Espacement porté par le champ : il vaut pour le tableau comme pour le message « aucun élève ». */
    .recherche { max-width: 320px; margin-bottom: var(--pas-3); }
    .tableau-scroll { overflow-x: auto; }
    table { border-collapse: collapse; white-space: nowrap; }
    th, td {
      padding: 8px 12px; border-bottom: 1px solid var(--trait); text-align: left; font-size: .875rem;
    }
    thead th { color: var(--craie); font-weight: 700; vertical-align: bottom; }
    /* Date, lieu et milieu empilés ; le lieu passe à la ligne plutôt que
       d'élargir la colonne. Mêmes couleurs de milieu que le calendrier. */
    .entete-seance { white-space: normal; min-width: 88px; max-width: 120px; }
    .date-seance { display: block; color: var(--encre); }
    .lieu-seance { display: block; font-weight: 400; font-size: .75rem; overflow-wrap: anywhere; }
    .milieu-seance {
      display: inline-block; margin-top: 2px; padding: 1px 6px; border-radius: 4px;
      background: var(--accent-clair); color: var(--encre); font-size: .6875rem; font-weight: 700;
    }
    .milieu-seance.naturel { background: var(--profond); color: #fff; }
    .figee { position: sticky; left: 0; min-width: 200px; }
    /* Toute la cellule est cliquable, pas seulement le nom : le lien porte le
       remplissage de la cellule. */
    td.figee { padding: 0; }
    .eleve-cellule {
      display: flex; align-items: center; gap: var(--pas); min-height: 44px; padding: 8px 12px;
      color: inherit; text-decoration: none;
    }
    .eleve-cellule:hover, .eleve-cellule:focus-visible { background: var(--fond); }
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
    .identite-cellule .nom { font-weight: 700; color: var(--profond); text-decoration: underline; }
    .alerte-cellule { color: #B3261E; font-weight: 700; }
    /* Échéance du CACI : plus d'un mois, moins d'un mois, moins de 15 jours. */
    .caci-vert { color: var(--acquis); font-weight: 700; }
    .caci-orange { color: var(--en-cours); font-weight: 700; }
    .caci-rouge { color: #B3261E; font-weight: 700; }
    .absence { color: var(--craie); }
    /* La case CACI ouvre le détail : toute la cellule est cliquable, 44 px au moins. */
    td.cellule-caci { padding: 0; }
    .bouton-caci {
      min-width: 56px; min-height: 44px; padding: 8px 12px; border: 0; background: none;
      font: inherit; font-weight: 700; cursor: pointer; text-decoration: underline dotted;
    }
    .bouton-caci:hover, .bouton-caci:focus-visible { background: var(--fond); }
    .etat-caci { font-weight: 700; }
    .titre-cases { margin: var(--pas-2) 0 4px; font-size: 1rem; }
    .cases-caci { list-style: none; margin: 0; padding: 0; }
    .cases-caci li { padding: 4px 0; color: var(--craie); }
    .cases-caci li.cochee { color: var(--encre); font-weight: 700; }
    .marque { display: inline-block; width: 1.5em; font-size: 1.125rem; }
  `]
})
export class RosterComponent implements OnDestroy {
  readonly couleurCaci = couleurCaci;
  readonly libelleCaci = libelleCaci;
  readonly casesCaci = CASES_CACI;
  readonly caciLimites = CACI_LIMITES;
  readonly libelleMedecinCaci = libelleMedecinCaci;
  /** Élève dont on consulte le détail du CACI. */
  caciOuvert = signal<LigneRoster | null>(null);
  private api = inject(ApiService);
  private reseau = inject(ReseauService);

  readonly libellePreparation = libellePreparation;

  roster = signal<RosterVue | null>(null);
  chargement = signal(true);
  erreur = signal<string | null>(null);
  /** Groupes d'entraînement de la saison ouverte (ceux du planning du bassin). */
  groupes = signal<GroupeEntrainementVue[]>([]);
  groupeFiltre = signal<FiltreGroupe>('TOUS');
  filtreNom = signal('');

  eleveIds = computed(() => (this.roster()?.eleves ?? []).map(e => e.eleveId));

  /** Complète « Aucun élève… » : « dans Prépa N2 », « sans groupe », ou rien. */
  libelleGroupeFiltre = computed(() => {
    const f = this.groupeFiltre();
    if (f === 'TOUS') return '';
    if (f === 'SANS') return 'sans groupe';
    return 'dans ' + (this.groupes().find(g => g.id === f)?.nom ?? 'ce groupe');
  });

  elevesFiltres = computed(() => {
    const r = this.roster();
    if (!r) return [];
    const parGroupe = r.eleves.filter(e => passeFiltreGroupe(e.eleveId, this.groupeFiltre(), this.groupes()));
    const recherche = this.normaliser(this.filtreNom());
    return recherche ? parGroupe.filter(e => this.normaliser(e.eleve).includes(recherche)) : parGroupe;
  });

  /** Casse et accents ignorés : « Loic » retrouve « Loïc » sur un clavier qui ne les tape pas facilement. */
  private normaliser(texte: string): string {
    return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  }

  constructor() {
    // Facultatif : sans groupe (ou hors ligne sans cache), pas de filtre.
    this.api.groupesEntrainementSaisonOuverte().then(g => this.groupes.set(g), () => {});
    this.api.roster().then(
      r => {
        this.roster.set(r);
        this.chargement.set(false);
        for (const e of r.eleves) {
          if (e.aPhoto) this.chargerPhoto(e.eleveId);
        }
      },
      () => {
        this.erreur.set(this.reseau.enLigne()
          ? "Impossible de charger la vue d'ensemble."
          : "Infos élèves non disponibles hors ligne : utilisez « Préparer hors ligne » quand vous avez du réseau.");
        this.chargement.set(false);
      }
    );
  }

  /** Un élève inscrit à deux formations la même saison n'a qu'une photo : on ne la charge qu'une fois. */
  private urlsPhotos = signal<Map<number, string>>(new Map());
  private photosDemandees = new Set<number>();

  private chargerPhoto(eleveId: number): void {
    if (this.photosDemandees.has(eleveId)) return;
    this.photosDemandees.add(eleveId);
    this.api.photoEleve(eleveId).then(
      blob => {
        const copie = new Map(this.urlsPhotos());
        copie.set(eleveId, URL.createObjectURL(blob));
        this.urlsPhotos.set(copie);
      },
      () => { /* pas de photo consultable : les initiales restent affichées */ }
    );
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
