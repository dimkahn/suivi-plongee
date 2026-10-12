import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { RouterLink } from '@angular/router';
import {
  BlocReferentielVue, DecoupageProgression, DemandePeriodeProgression, DemandeProgression, ExerciceBaseVue,
  PhaseExercice,
  ProgressionResume, ProgressionVue, ReferentielVue
} from '../../core/modeles';
import { MOIS_SAISON, nomMois, plagePeriode } from '../../core/progression';
import { DialogueComponent } from '../../core/dialogue.component';
import { PHASES, PastillePhaseComponent } from '../../core/phase-exercice';

const NIVEAUX = ['N1', 'N2', 'N3'] as const;
type Niveau = typeof NIVEAUX[number];


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
    referentielId: p.referentielId, nom: p.nom, description: p.description, decoupage: p.decoupage ?? 'MOIS',
    periodes: p.periodes.map(pe => periodeEditee({
      id: pe.id, intitule: pe.intitule, moisDebut: pe.moisDebut, moisFin: pe.moisFin,
      plongeeDebut: pe.plongeeDebut ?? null, plongeeFin: pe.plongeeFin ?? null,
      milieu: pe.milieu, note: pe.note, blocIds: pe.blocs.map(b => b.id),
      exerciceIds: (pe.exercices ?? []).map(e => e.id)
    }))
  };
}

@Component({
  selector: 'app-progressions-admin',
  imports: [FormsModule, RouterLink, DialogueComponent, PastillePhaseComponent],
  template: `
    <h1>Progressions types</h1>
    <p class="secondaire">
      La formation d'un niveau découpée en périodes, avec les blocs du référentiel
      travaillés dans chacune et les exercices de la base prévus, de l'initiation à la maîtrise : c'est
      le parcours que les moniteurs consultent (menu « Parcours »). Une progression est rattachée à une
      version du référentiel MFT. Elle se découpe en mois de la saison (club, formation sur l'année) ou
      en plongées de l'élève (stage court en mer : « plongée 1 », « plongées 5 à 6 »).
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

      @if (detail(); as d) {
        <section class="carte fiche">
          <div class="entete">
            <span class="nom">{{ d.nom }}</span>
            <span class="secondaire">{{ d.niveau }} · MFT {{ d.versionMft }} ·
              {{ d.decoupage === 'PLONGEES' ? 'découpée par plongées de l’élève' : 'découpée par mois de la saison' }}</span>
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
                  <span class="plage">{{ plage(p) }}</span>
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
                @if ((p.exercices ?? []).length > 0) {
                  <details class="exercices-lus">
                    <summary>{{ p.exercices!.length }} exercice(s) prévu(s)</summary>
                    <ul>
                      @for (e of p.exercices; track e.id) {
                        <li>
                          <app-pastille-phase [phase]="e.phase" [numero]="e.numero" [intitule]="e.intitule" />
                          <a [routerLink]="['/exercices', e.id]">{{ e.intitule }}</a>
                        </li>
                      }
                    </ul>
                  </details>
                } @else {
                  <p class="secondaire">Aucun exercice prévu.</p>
                }
              </li>
            }
          </ol>
        </section>
      }

      @if (modeleInstalle() === false) {
        <section class="carte modele">
          <h2>Modèle « centre de plongée en mer »</h2>
          <p class="secondaire">
            Pour une structure qui forme en stage court, tout en mer : une base d'exercices N1 écrite pour
            la mer (exercices « M ») et trois progressions découpées par plongées, N1 en 6 plongées, N2 en 8,
            N3 en 10, à adapter ensuite. Un club qui forme sur l'année n'en a pas besoin.
          </p>
          <button type="button" class="bouton-discret" (click)="ouvrirModele()">Installer le modèle…</button>
        </section>
      }
    }

    <app-dialogue [ouvert]="modeleOuvert()" titre="Installer le modèle « centre de plongée en mer »"
                  [erreur]="message()" (fermer)="modeleOuvert.set(false)">
      <div class="formulaire">
        <p>
          Le modèle ajoute 44 exercices du N1 pensés pour la mer et trois progressions par plongées
          (N1, N2, N3). Le N2 et le N3 reprennent la base d'exercices existante, déjà décrite en
          milieu naturel. Rien n'est supprimé ; tout se modifie ensuite depuis cet écran et depuis
          « Base d'exercices ».
        </p>
        <label class="case">
          <input type="checkbox" [(ngModel)]="desactiverPiscine">
          Désactiver les exercices N1 pensés pour la piscine (réactivables depuis « Base d'exercices »)
        </label>
        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" (click)="installerModele()" [disabled]="envoi()">
            {{ envoi() ? 'Installation…' : 'Installer le modèle' }}
          </button>
          <button type="button" class="bouton-discret" (click)="modeleOuvert.set(false)">Annuler</button>
        </div>
      </div>
    </app-dialogue>

    <app-dialogue [ouvert]="creation() !== null" [titre]="'Nouvelle progression ' + selectionNiveau()"
                  [erreur]="message()" (fermer)="creation.set(null)">
      @if (creation(); as c) {
        <div class="formulaire">
          <label for="nouveau-referentiel">Référentiel</label>
          <select id="nouveau-referentiel" [(ngModel)]="c.referentielId">
            @for (r of referentielsDuNiveau(); track r.id) {
              <option [ngValue]="r.id">MFT {{ r.versionMft }}{{ r.actif ? '' : ' (inactif)' }}</option>
            }
          </select>
          <label for="nouveau-nom">Nom</label>
          <input id="nouveau-nom" type="text" [(ngModel)]="c.nom" placeholder="ex. N1 – saison piscine">
          <label for="nouveau-decoupage">Découpage</label>
          <select id="nouveau-decoupage" [(ngModel)]="c.decoupage">
            <option ngValue="MOIS">Par mois de la saison (formation sur l'année)</option>
            <option ngValue="PLONGEES">Par plongées de l'élève (stage court en mer)</option>
          </select>
          <p class="aide">
            Par plongées, chaque élève avance à son rythme : l'étape se lit à son numéro de plongée en
            milieu naturel, et le retard se compte en plongées. Le découpage ne change plus ensuite.
          </p>
          <div class="actions-dialogue">
            <button type="button" class="bouton-principal" (click)="creer()" [disabled]="envoi()">
              {{ envoi() ? 'Création…' : 'Créer puis ajouter les périodes' }}
            </button>
            <button type="button" class="bouton-discret" (click)="creation.set(null)">Annuler</button>
          </div>
        </div>
      }
    </app-dialogue>

    <app-dialogue [ouvert]="edition() !== null" titre="Modifier la progression" [large]="true"
                  [erreur]="message()" (fermer)="edition.set(null)">
      @if (edition(); as f) {
        <div class="formulaire">
          <label for="nom">Nom</label>
          <input id="nom" type="text" [(ngModel)]="f.nom">
          <label for="description">Description</label>
          <textarea id="description" rows="2" [ngModel]="f.description ?? ''"
                    (ngModelChange)="f.description = $event || null"></textarea>

          @let parPlongees = f.decoupage === 'PLONGEES';
          <h3>{{ parPlongees ? 'Étapes, par plongée de l’élève' : 'Périodes' }}</h3>
          @for (p of f.periodes; track p.cle; let i = $index, premier = $first, dernier = $last) {
            <fieldset class="periode-edition">
              <legend>{{ parPlongees ? 'Étape' : 'Période' }} {{ i + 1 }}</legend>
              <label [for]="'intitule-' + p.cle">Intitulé</label>
              <input [id]="'intitule-' + p.cle" type="text" [(ngModel)]="p.intitule">

              <div class="mois">
                @if (parPlongees) {
                  <div>
                    <label [for]="'debut-' + p.cle">De la plongée</label>
                    <input [id]="'debut-' + p.cle" type="number" min="1" max="99" inputmode="numeric"
                           [(ngModel)]="p.plongeeDebut">
                  </div>
                  <div>
                    <label [for]="'fin-' + p.cle">À la plongée</label>
                    <input [id]="'fin-' + p.cle" type="number" min="1" max="99" inputmode="numeric"
                           [(ngModel)]="p.plongeeFin">
                  </div>
                } @else {
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
                }
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

              <details class="exercices-choix">
                <summary>Exercices de la période ({{ p.exerciceIds.length }})</summary>
                <p class="secondaire">
                  Les exercices de la base pour les blocs cochés, de l'initiation à la maîtrise. Ils forment le
                  parcours que voient les moniteurs (« Parcours ») et sont proposés en premier pour le programme
                  des séances de la période.
                </p>
                @for (g of choixExercices(p); track g.bloc.id) {
                  <div class="groupe-exercices">
                    <div class="titre-groupe">
                      <strong>{{ g.bloc.intitule }}</strong>
                      @for (ph of phases; track ph.valeur) {
                        <button type="button" class="bouton-discret petit" (click)="cocherPhase(p, g.exercices, ph.valeur)"
                                [attr.aria-label]="'Cocher les exercices ' + ph.libelle + ' de ' + g.bloc.intitule">
                          + {{ ph.lettre }}
                        </button>
                      }
                    </div>
                    @for (e of g.exercices; track e.id) {
                      <label class="case">
                        <input type="checkbox" [checked]="p.exerciceIds.includes(e.id)" (change)="basculerExercice(p, e.id)">
                        <app-pastille-phase [phase]="e.phase" [numero]="e.numero" [intitule]="e.intitule" />
                        {{ e.intitule }}{{ e.actif ? '' : ' (désactivé)' }}
                      </label>
                    }
                  </div>
                }
                @if (choixExercices(p).length === 0) {
                  <p class="secondaire">Cochez d'abord les blocs travaillés.</p>
                }
              </details>

              <div class="actions">
                <button type="button" class="bouton-discret" (click)="deplacer(i, -1)" [disabled]="premier">
                  Monter
                </button>
                <button type="button" class="bouton-discret" (click)="deplacer(i, 1)" [disabled]="dernier">
                  Descendre
                </button>
                <button type="button" class="bouton-discret danger" (click)="retirerPeriode(i)">
                  {{ parPlongees ? 'Retirer l’étape' : 'Retirer la période' }}
                </button>
              </div>
            </fieldset>
          }
          <button type="button" class="bouton-discret ajout" (click)="ajouterPeriode()">
            {{ parPlongees ? 'Ajouter une étape' : 'Ajouter une période' }}
          </button>

          <div class="actions-dialogue">
            <button type="button" class="bouton-principal" (click)="enregistrer()" [disabled]="envoi()">
              {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
            <button type="button" class="bouton-discret" (click)="edition.set(null)">Annuler</button>
          </div>
        </div>
      }
    </app-dialogue>
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
    .exercices-lus { margin-top: var(--pas); font-size: .9375rem; }
    .exercices-lus summary, .exercices-choix summary {
      min-height: 44px; display: flex; align-items: center; cursor: pointer; font-weight: 700;
    }
    .exercices-lus ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    .exercices-lus li { display: flex; align-items: center; gap: var(--pas); }
    .exercices-choix { margin-top: var(--pas); border: 1px solid var(--trait); border-radius: var(--r-s); padding: 0 var(--pas); }
    .groupe-exercices { margin-bottom: var(--pas-2); }
    .titre-groupe { display: flex; flex-wrap: wrap; align-items: center; gap: var(--pas); }
    .titre-groupe strong { flex: 1 1 200px; }
    .petit { min-height: 44px; padding: 4px 10px; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }
    .actions .bouton-principal { width: auto; }
    .danger { color: #B3261E; border-color: #B3261E; }
    .modele { padding: var(--pas-3); }
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
  /** Base d'exercices du référentiel, pour choisir ceux de chaque période. */
  exercicesReferentiel = signal<ExerciceBaseVue[]>([]);
  readonly phases = PHASES;
  edition = signal<FormulaireProgression | null>(null);
  creation = signal<{ referentielId: number | null; nom: string; decoupage: DecoupageProgression } | null>(null);

  progressionsDuNiveau = computed(() => this.liste().filter(p => p.niveau === this.selectionNiveau()));
  referentielsDuNiveau = computed(() => this.referentiels()
    .filter(r => r.niveau === this.selectionNiveau())
    .sort((a, b) => Number(b.actif) - Number(a.actif) || b.dateApplication.localeCompare(a.dateApplication)));

  /** null tant qu'on ne sait pas : la carte du modèle n'apparaît qu'une fois la réponse reçue. */
  modeleInstalle = signal<boolean | null>(null);
  modeleOuvert = signal(false);
  desactiverPiscine = true;

  constructor() {
    void this.charger();
    this.api.etatModeleCentreMer().subscribe({ next: e => this.modeleInstalle.set(e.installe), error: () => {} });
  }

  ouvrirModele(): void {
    this.message.set(null);
    this.desactiverPiscine = true;
    this.modeleOuvert.set(true);
  }

  installerModele(): void {
    this.envoi.set(true);
    this.message.set(null);
    this.api.installerModeleCentreMer(this.desactiverPiscine).subscribe({
      next: async r => {
        this.envoi.set(false);
        this.modeleOuvert.set(false);
        this.modeleInstalle.set(true);
        await this.charger();
        this.message.set(`Modèle installé : ${r.progressions} progressions par plongées, ${r.exercicesMer} exercices N1 en mer`
          + (r.exercicesDesactives ? `, ${r.exercicesDesactives} exercices de piscine désactivés.` : '.'));
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(err.error?.detail ?? "Le modèle n'a pas pu être installé.");
      }
    });
  }

  readonly nomMois = nomMois;
  readonly plage = plagePeriode;

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
    this.creation.set({ referentielId: r?.id ?? null, nom: '', decoupage: 'MOIS' });
  }

  creer(): void {
    const c = this.creation();
    if (!c) return;
    if (!c.nom.trim() || c.referentielId == null) {
      this.message.set('Choisissez un référentiel et donnez un nom à la progression.');
      return;
    }
    this.envoi.set(true);
    this.api.creerProgression({
      referentielId: c.referentielId, nom: c.nom, description: null, decoupage: c.decoupage, periodes: []
    })
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
      const [r, exercices] = await Promise.all([
        firstValueFrom(this.api.referentiel(p.referentielId)),
        firstValueFrom(this.api.exercicesBase(p.referentielId))
      ]);
      this.blocsReferentiel.set([...r.blocs].sort((a, b) => a.ordre - b.ordre));
      this.exercicesReferentiel.set(exercices);
      this.edition.set(formulaireDepuis(p));
    } catch {
      this.message.set('Impossible de charger les blocs du référentiel.');
    }
  }

  /**
   * Exercices proposés pour une période : ceux des blocs cochés (actifs), et
   * ceux déjà prévus même si leur bloc a été décoché ou qu'ils sont désactivés,
   * pour pouvoir les retirer.
   */
  choixExercices(p: PeriodeEditee): { bloc: BlocReferentielVue; exercices: ExerciceBaseVue[] }[] {
    const tous = this.exercicesReferentiel();
    return this.blocsReferentiel()
      .map(bloc => ({
        bloc,
        exercices: tous.filter(e => e.blocId === bloc.id
          && ((p.blocIds.includes(bloc.id) && e.actif) || p.exerciceIds.includes(e.id)))
      }))
      .filter(g => g.exercices.length > 0);
  }

  basculerExercice(p: PeriodeEditee, exerciceId: number): void {
    p.exerciceIds = p.exerciceIds.includes(exerciceId)
      ? p.exerciceIds.filter(id => id !== exerciceId) : [...p.exerciceIds, exerciceId];
  }

  /** Coche d'un coup les exercices d'une phase d'un bloc. */
  cocherPhase(p: PeriodeEditee, exercices: ExerciceBaseVue[], phase: PhaseExercice): void {
    const ajout = exercices.filter(e => e.phase === phase && e.actif && !p.exerciceIds.includes(e.id)).map(e => e.id);
    p.exerciceIds = [...p.exerciceIds, ...ajout];
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

  /** La nouvelle période démarre le mois (ou la plongée) qui suit la précédente. */
  ajouterPeriode(): void {
    const f = this.edition();
    if (!f) return;
    const derniere = f.periodes[f.periodes.length - 1];
    let plage: Pick<DemandePeriodeProgression, 'moisDebut' | 'moisFin' | 'plongeeDebut' | 'plongeeFin'>;
    if (f.decoupage === 'PLONGEES') {
      const debut = (derniere?.plongeeFin ?? 0) + 1;
      plage = { moisDebut: null, moisFin: null, plongeeDebut: debut, plongeeFin: debut };
    } else {
      const debut = derniere?.moisFin ? derniere.moisFin % 12 + 1 : 9;
      plage = { moisDebut: debut, moisFin: debut % 12 + 1, plongeeDebut: null, plongeeFin: null };
    }
    this.edition.set({
      ...f,
      periodes: [...f.periodes, periodeEditee({
        id: null, intitule: '', ...plage, milieu: f.decoupage === 'PLONGEES' ? 'NATUREL' : null, note: null,
        blocIds: [], exerciceIds: []
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
      referentielId: f.referentielId, nom: f.nom, description: f.description, decoupage: f.decoupage,
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
