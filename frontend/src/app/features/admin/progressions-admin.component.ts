import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import {
  BlocReferentielVue, DemandePeriodeProgression, DemandeProgression, ProgressionResume, ProgressionVue,
  ReferentielVue
} from '../../core/modeles';

const NIVEAUX = ['N1', 'N2', 'N3'] as const;
type Niveau = typeof NIVEAUX[number];

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];
/** Ordre d'une saison du club : de la rentrée à l'été. */
const MOIS_SAISON = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];

/** Une période en cours d'édition ; `cle` suit la ligne quand on la déplace. */
interface PeriodeEditee extends DemandePeriodeProgression {
  cle: number;
}

interface FormulaireProgression extends Omit<DemandeProgression, 'periodes'> {
  periodes: PeriodeEditee[];
}

let prochaineCle = 1;

function periodeEditee(p: DemandePeriodeProgression): PeriodeEditee {
  return { ...p, cle: prochaineCle++ };
}

function formulaireDepuis(p: ProgressionVue): FormulaireProgression {
  return {
    referentielId: p.referentielId, nom: p.nom, description: p.description,
    periodes: p.periodes.map(pe => periodeEditee({
      id: pe.id, intitule: pe.intitule, moisDebut: pe.moisDebut, moisFin: pe.moisFin,
      milieu: pe.milieu, note: pe.note, blocIds: pe.blocs.map(b => b.id)
    }))
  };
}

@Component({
  selector: 'app-progressions-admin',
  imports: [FormsModule],
  template: `
    <h1>Progressions types</h1>
    <p class="secondaire">
      L'année de formation d'un niveau découpée en périodes, avec les blocs du référentiel
      travaillés dans chacune. Une progression est rattachée à une version du référentiel MFT.
    </p>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <nav class="onglets">
      @for (n of niveaux; track n) {
        <button type="button" class="onglet" [class.actif]="selectionNiveau() === n"
                (click)="selectionnerNiveau(n)">
          {{ n }}
        </button>
      }
    </nav>

    @if (chargement()) {
      <p class="secondaire">Chargement…</p>
    } @else {
      <div class="barre">
        @if (progressionsDuNiveau().length > 0) {
          <label for="progression">Progression</label>
          <select id="progression" [ngModel]="selectionId()"
                  (ngModelChange)="selectionnerProgression($event)" [disabled]="edition() !== null">
            @for (p of progressionsDuNiveau(); track p.id) {
              <option [ngValue]="p.id">{{ p.nom }} · MFT {{ p.versionMft }}</option>
            }
          </select>
        } @else {
          <p class="secondaire">Aucune progression pour le {{ selectionNiveau() }}.</p>
        }
        <button type="button" class="bouton-discret" (click)="commencerCreation()"
                [disabled]="edition() !== null">
          Nouvelle progression
        </button>
      </div>

      @if (creation(); as c) {
        <section class="carte fiche formulaire">
          <h2>Nouvelle progression {{ selectionNiveau() }}</h2>
          <label for="nouveau-referentiel">Référentiel</label>
          <select id="nouveau-referentiel" [(ngModel)]="c.referentielId">
            @for (r of referentielsDuNiveau(); track r.id) {
              <option [ngValue]="r.id">MFT {{ r.versionMft }}{{ r.actif ? '' : ' (inactif)' }}</option>
            }
          </select>
          <label for="nouveau-nom">Nom</label>
          <input id="nouveau-nom" type="text" [(ngModel)]="c.nom" placeholder="ex. N1 – saison piscine">
          <div class="actions">
            <button type="button" class="bouton-principal" (click)="creer()" [disabled]="envoi()">
              {{ envoi() ? 'Création…' : 'Créer puis ajouter les périodes' }}
            </button>
            <button type="button" class="bouton-discret" (click)="creation.set(null)">Annuler</button>
          </div>
        </section>
      }

      @if (edition(); as f) {
        <section class="carte fiche formulaire">
          <h2>Modifier la progression</h2>
          <label for="nom">Nom</label>
          <input id="nom" type="text" [(ngModel)]="f.nom">
          <label for="description">Description</label>
          <textarea id="description" rows="2" [ngModel]="f.description ?? ''"
                    (ngModelChange)="f.description = $event || null"></textarea>

          <h3>Périodes</h3>
          @for (p of f.periodes; track p.cle; let i = $index, premier = $first, dernier = $last) {
            <fieldset class="periode-edition">
              <legend>Période {{ i + 1 }}</legend>
              <label [for]="'intitule-' + p.cle">Intitulé</label>
              <input [id]="'intitule-' + p.cle" type="text" [(ngModel)]="p.intitule">

              <div class="mois">
                <div>
                  <label [for]="'debut-' + p.cle">De</label>
                  <select [id]="'debut-' + p.cle" [(ngModel)]="p.moisDebut">
                    @for (m of moisSaison; track m) { <option [ngValue]="m">{{ nomMois(m) }}</option> }
                  </select>
                </div>
                <div>
                  <label [for]="'fin-' + p.cle">À</label>
                  <select [id]="'fin-' + p.cle" [(ngModel)]="p.moisFin">
                    @for (m of moisSaison; track m) { <option [ngValue]="m">{{ nomMois(m) }}</option> }
                  </select>
                </div>
                <div>
                  <label [for]="'milieu-' + p.cle">Milieu</label>
                  <select [id]="'milieu-' + p.cle" [(ngModel)]="p.milieu">
                    <option [ngValue]="null">Indifférent</option>
                    <option ngValue="ARTIFICIEL">Piscine / fosse</option>
                    <option ngValue="NATUREL">Milieu naturel</option>
                  </select>
                </div>
              </div>

              <label [for]="'note-' + p.cle">Contenu, conseils aux moniteurs</label>
              <textarea [id]="'note-' + p.cle" rows="3" [ngModel]="p.note ?? ''"
                        (ngModelChange)="p.note = $event || null"></textarea>

              <span class="etiquette">Blocs travaillés</span>
              <div class="blocs-choix">
                @for (b of blocsReferentiel(); track b.id) {
                  <label class="case">
                    <input type="checkbox" [checked]="p.blocIds.includes(b.id)"
                           (change)="basculerBloc(p, b.id)">
                    {{ b.intitule }}
                    @if (b.regroupement) { <span class="regroupement">{{ b.regroupement }}</span> }
                  </label>
                }
              </div>

              <div class="actions">
                <button type="button" class="bouton-discret" (click)="deplacer(i, -1)" [disabled]="premier">
                  Monter
                </button>
                <button type="button" class="bouton-discret" (click)="deplacer(i, 1)" [disabled]="dernier">
                  Descendre
                </button>
                <button type="button" class="bouton-discret danger" (click)="retirerPeriode(i)">
                  Retirer la période
                </button>
              </div>
            </fieldset>
          }
          <button type="button" class="bouton-discret ajout" (click)="ajouterPeriode()">
            Ajouter une période
          </button>

          <div class="actions">
            <button type="button" class="bouton-principal" (click)="enregistrer()" [disabled]="envoi()">
              {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
            <button type="button" class="bouton-discret" (click)="edition.set(null)">Annuler</button>
          </div>
        </section>
      } @else if (detail(); as d) {
        <section class="carte fiche">
          <div class="entete">
            <span class="nom">{{ d.nom }}</span>
            <span class="secondaire">{{ d.niveau }} · MFT {{ d.versionMft }}</span>
          </div>
          @if (d.description) { <p>{{ d.description }}</p> }
          <div class="actions">
            <button type="button" class="bouton-discret" (click)="commencerEdition(d)">Modifier</button>
            <button type="button" class="bouton-discret" (click)="copier(d)">Dupliquer</button>
            <button type="button" class="bouton-discret danger" (click)="supprimer(d)">Supprimer</button>
          </div>

          @if (d.periodes.length === 0) {
            <p class="secondaire">Aucune période : utilisez « Modifier » pour en ajouter.</p>
          }
          <ol class="periodes">
            @for (p of d.periodes; track p.id) {
              <li class="periode">
                <div class="entete-periode">
                  <span class="plage">{{ plage(p.moisDebut, p.moisFin) }}</span>
                  @if (p.milieu) {
                    <span class="milieu">{{ p.milieu === 'NATUREL' ? 'Milieu naturel' : 'Piscine / fosse' }}</span>
                  }
                </div>
                <span class="intitule">{{ p.intitule }}</span>
                @if (p.note) { <p class="note">{{ p.note }}</p> }
                @if (p.blocs.length > 0) {
                  <ul class="blocs">
                    @for (b of p.blocs; track b.id) { <li>{{ b.intitule }}</li> }
                  </ul>
                } @else {
                  <p class="secondaire">Aucun bloc désigné.</p>
                }
              </li>
            }
          </ol>
        </section>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .onglets { display: flex; gap: var(--pas); margin: var(--pas-3) 0 var(--pas-2); }
    .onglet {
      min-height: 44px; padding: 0 var(--pas-3); border-radius: var(--r-s);
      border: 1px solid var(--trait); background: #fff; font-weight: 700; cursor: pointer;
    }
    .onglet.actif { background: var(--profond); color: #fff; border-color: var(--profond); }
    .barre { display: flex; align-items: center; gap: var(--pas-2); margin-bottom: var(--pas-2); flex-wrap: wrap; }
    .barre label { font-weight: 700; }
    .barre select { margin: 0; max-width: 100%; }
    .barre p { margin: 0; }
    .fiche { padding: var(--pas-3); margin-bottom: var(--pas-3); }
    .entete { display: flex; flex-direction: column; gap: 2px; margin-bottom: var(--pas-2); }
    .entete .nom { font-weight: 700; font-size: 1.0625rem; }
    h2 { margin: 0 0 var(--pas-2); font-size: 1.0625rem; }
    h3 { margin: var(--pas-3) 0 var(--pas); font-size: 1rem; }

    .periodes { list-style: none; margin: var(--pas-2) 0 0; padding: 0; display: grid; gap: var(--pas-2); }
    .periode { padding: var(--pas-2); border: 1px solid var(--trait); border-radius: var(--r-s); }
    .entete-periode { display: flex; gap: var(--pas); flex-wrap: wrap; align-items: baseline; }
    .plage { color: var(--profond); font-weight: 700; text-transform: capitalize; }
    .milieu {
      padding: 0 8px; font-size: .8125rem; border-radius: var(--r-s);
      border: 1px solid var(--profond); color: var(--profond);
    }
    .intitule { display: block; margin-top: 2px; font-weight: 700; }
    .note { margin: var(--pas) 0 0; font-size: .9375rem; }
    .blocs { margin: var(--pas) 0 0; padding-left: 1.25rem; display: grid; gap: 2px; font-size: .9375rem; }

    .formulaire { display: flex; flex-direction: column; gap: 2px; }
    .formulaire label, .etiquette { font-weight: 700; font-size: .875rem; margin-top: var(--pas); }
    .formulaire input, .formulaire textarea, .formulaire select { margin: 0; }
    .formulaire textarea { resize: vertical; }
    .periode-edition {
      margin: 0 0 var(--pas-2); padding: var(--pas-2);
      border: 1px solid var(--trait); border-radius: var(--r-s);
      display: flex; flex-direction: column; gap: 2px; min-width: 0;
    }
    .periode-edition legend { font-weight: 700; color: var(--profond); padding: 0 4px; }
    .mois { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--pas); }
    .mois > div { display: flex; flex-direction: column; gap: 2px; }
    .blocs-choix { display: grid; gap: 0; }
    .case {
      display: flex; align-items: center; gap: var(--pas); min-height: 44px;
      font-weight: 400 !important; margin-top: 0 !important; font-size: .9375rem !important;
    }
    .case input { width: auto; flex: none; }
    .regroupement {
      padding: 0 6px; font-size: .75rem; border-radius: var(--r-s);
      border: 1px solid var(--profond); color: var(--profond);
    }
    .ajout { align-self: flex-start; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }
    .actions .bouton-principal { width: auto; }
    .danger { color: #B3261E; border-color: #B3261E; }
    @media (max-width: 600px) {
      .mois { grid-template-columns: 1fr 1fr; }
      .mois > div:last-child { grid-column: 1 / -1; }
    }
  `]
})
export class ProgressionsAdminComponent {
  private api = inject(ApiService);
  readonly niveaux = NIVEAUX;
  readonly moisSaison = MOIS_SAISON;

  liste = signal<ProgressionResume[]>([]);
  referentiels = signal<ReferentielVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  envoi = signal(false);
  selectionNiveau = signal<Niveau>('N1');
  selectionId = signal<number | null>(null);
  detail = signal<ProgressionVue | null>(null);
  /** Blocs du référentiel de la progression affichée, pour les cases à cocher de l'édition. */
  blocsReferentiel = signal<BlocReferentielVue[]>([]);
  edition = signal<FormulaireProgression | null>(null);
  creation = signal<{ referentielId: number | null; nom: string } | null>(null);

  progressionsDuNiveau = computed(() => this.liste().filter(p => p.niveau === this.selectionNiveau()));
  referentielsDuNiveau = computed(() => this.referentiels()
    .filter(r => r.niveau === this.selectionNiveau())
    .sort((a, b) => Number(b.actif) - Number(a.actif) || b.dateApplication.localeCompare(a.dateApplication)));

  constructor() {
    void this.charger();
  }

  nomMois(m: number): string {
    return NOMS_MOIS[m - 1];
  }

  plage(debut: number, fin: number): string {
    return debut === fin ? this.nomMois(debut) : `${this.nomMois(debut)} – ${this.nomMois(fin)}`;
  }

  private async charger(idASelectionner?: number): Promise<void> {
    this.chargement.set(true);
    try {
      const [liste, referentiels] = await Promise.all([
        firstValueFrom(this.api.progressions()),
        firstValueFrom(this.api.referentielsTous())
      ]);
      this.liste.set(liste);
      this.referentiels.set(referentiels);
      const cible = liste.find(p => p.id === idASelectionner);
      if (cible) {
        this.selectionNiveau.set(cible.niveau);
        await this.selectionnerProgression(cible.id);
      } else {
        await this.selectionnerNiveau(this.selectionNiveau());
      }
    } catch {
      this.message.set('Impossible de charger les progressions.');
    } finally {
      this.chargement.set(false);
    }
  }

  async selectionnerNiveau(niveau: Niveau): Promise<void> {
    if (this.edition()) return;
    this.selectionNiveau.set(niveau);
    this.creation.set(null);
    const premiere = this.progressionsDuNiveau()[0];
    if (premiere) await this.selectionnerProgression(premiere.id);
    else { this.selectionId.set(null); this.detail.set(null); }
  }

  async selectionnerProgression(id: number): Promise<void> {
    this.selectionId.set(id);
    this.message.set(null);
    try {
      const d = await firstValueFrom(this.api.progression(id));
      this.detail.set(d);
    } catch {
      this.message.set('Impossible de charger cette progression.');
    }
  }

  commencerCreation(): void {
    this.message.set(null);
    const r = this.referentielsDuNiveau()[0];
    this.creation.set({ referentielId: r?.id ?? null, nom: '' });
  }

  creer(): void {
    const c = this.creation();
    if (!c) return;
    if (!c.nom.trim() || c.referentielId == null) {
      this.message.set('Choisissez un référentiel et donnez un nom à la progression.');
      return;
    }
    this.envoi.set(true);
    this.api.creerProgression({ referentielId: c.referentielId, nom: c.nom, description: null, periodes: [] })
      .subscribe({
        next: async p => {
          this.envoi.set(false);
          this.creation.set(null);
          await this.charger(p.id);
          await this.commencerEdition(p);
        },
        error: (err: HttpErrorResponse) => {
          this.envoi.set(false);
          this.message.set(err.error?.detail ?? "La progression n'a pas pu être créée.");
        }
      });
  }

  async commencerEdition(p: ProgressionVue): Promise<void> {
    this.message.set(null);
    try {
      const r = await firstValueFrom(this.api.referentiel(p.referentielId));
      this.blocsReferentiel.set([...r.blocs].sort((a, b) => a.ordre - b.ordre));
      this.edition.set(formulaireDepuis(p));
    } catch {
      this.message.set('Impossible de charger les blocs du référentiel.');
    }
  }

  basculerBloc(p: PeriodeEditee, blocId: number): void {
    p.blocIds = p.blocIds.includes(blocId) ? p.blocIds.filter(id => id !== blocId) : [...p.blocIds, blocId];
  }

  deplacer(i: number, sens: -1 | 1): void {
    const f = this.edition();
    if (!f) return;
    const periodes = [...f.periodes];
    [periodes[i], periodes[i + sens]] = [periodes[i + sens], periodes[i]];
    this.edition.set({ ...f, periodes });
  }

  retirerPeriode(i: number): void {
    const f = this.edition();
    if (!f) return;
    this.edition.set({ ...f, periodes: f.periodes.filter((_, j) => j !== i) });
  }

  /** La nouvelle période démarre le mois qui suit la précédente. */
  ajouterPeriode(): void {
    const f = this.edition();
    if (!f) return;
    const derniere = f.periodes[f.periodes.length - 1];
    const debut = derniere ? derniere.moisFin % 12 + 1 : 9;
    const fin = debut % 12 + 1;
    this.edition.set({
      ...f,
      periodes: [...f.periodes, periodeEditee({
        id: null, intitule: '', moisDebut: debut, moisFin: fin, milieu: null, note: null, blocIds: []
      })]
    });
  }

  enregistrer(): void {
    const f = this.edition();
    const id = this.selectionId();
    if (!f || id == null) return;
    if (!f.nom.trim()) {
      this.message.set('Le nom de la progression est obligatoire.');
      return;
    }
    if (f.periodes.some(p => !p.intitule.trim())) {
      this.message.set('Chaque période doit avoir un intitulé.');
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    const demande: DemandeProgression = {
      referentielId: f.referentielId, nom: f.nom, description: f.description,
      periodes: f.periodes.map(({ cle, ...p }) => p)
    };
    this.api.modifierProgression(id, demande).subscribe({
      next: p => {
        this.envoi.set(false);
        this.edition.set(null);
        this.detail.set(p);
        this.liste.set(this.liste().map(x => x.id === p.id
          ? { ...x, nom: p.nom, nombrePeriodes: p.periodes.length } : x));
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(err.error?.detail ?? "La progression n'a pas pu être enregistrée.");
      }
    });
  }

  copier(p: ProgressionVue): void {
    this.message.set(null);
    this.api.copierProgression(p.id).subscribe({
      next: copie => void this.charger(copie.id),
      error: (err: HttpErrorResponse) =>
        this.message.set(err.error?.detail ?? "La progression n'a pas pu être dupliquée.")
    });
  }

  supprimer(p: ProgressionVue): void {
    if (!confirm(`Supprimer la progression « ${p.nom} » ?`)) return;
    this.message.set(null);
    this.api.supprimerProgression(p.id).subscribe({
      next: () => {
        this.detail.set(null);
        this.selectionId.set(null);
        void this.charger();
      },
      error: (err: HttpErrorResponse) =>
        this.message.set(err.error?.detail ?? "La suppression n'a pas pu être enregistrée.")
    });
  }
}
