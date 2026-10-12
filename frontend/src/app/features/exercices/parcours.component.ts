import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ReseauService } from '../../core/reseau.service';
import {
  BlocReferentielVue, ExerciceBaseVue, PeriodeProgressionVue, PhaseExercice, ProgressionResume, ProgressionVue,
  ReferentielVue
} from '../../core/modeles';
import { PHASES, PastillePhaseComponent } from '../../core/phase-exercice';
import { periodeDuMois, plagePeriode } from '../../core/progression';
import { dateDuJour } from '../../core/date-fr';

const NIVEAUX = ['N1', 'N2', 'N3'] as const;
type Niveau = typeof NIVEAUX[number];

/** Exercices d'une période, rangés par compétence. */
interface GroupeCompetence {
  bloc: BlocReferentielVue;
  exercices: ExerciceBaseVue[];
}

/**
 * Parcours de formation d'un niveau : la progression type, période par
 * période (mois, milieu, conseils), avec les exercices de la base prévus
 * dans chacune, de l'initiation à la maîtrise. Chaque exercice ouvre sa
 * fiche complète (schéma, photos, vidéos). Lecture seule pour tous les
 * encadrants ; la progression se modifie dans l'administration. Réseau
 * obligatoire.
 */
@Component({
  selector: 'app-parcours',
  imports: [FormsModule, RouterLink, PastillePhaseComponent],
  template: `
    <h1>Parcours de formation</h1>
    <p class="secondaire">
      L'année de chaque niveau, période par période : les compétences travaillées et les exercices
      prévus, de l'initiation à la maîtrise. Touchez un exercice pour voir sa fiche complète
      (déroulement, réussite, conseils, schéma, photos, vidéos).
    </p>

    @if (!reseau.enLigne()) { <div class="alerte" role="status">Le parcours de formation demande le réseau.</div> }
    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <nav class="onglets" aria-label="Niveau">
      @for (n of niveaux; track n) {
        <button type="button" class="onglet" [class.actif]="niveau() === n" [attr.aria-pressed]="niveau() === n"
                (click)="choisirNiveau(n)">{{ n }}</button>
      }
    </nav>

    @if (progressionsDuNiveau().length > 1) {
      <label for="progression">Progression</label>
      <select id="progression" [ngModel]="progressionId()" (ngModelChange)="ouvrir($event)">
        @for (p of progressionsDuNiveau(); track p.id) {
          <option [ngValue]="p.id">{{ p.nom }} · MFT {{ p.versionMft }}{{ suivies().has(p.id) ? ' (saison en cours)' : '' }}</option>
        }
      </select>
    }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (progression(); as p) {
      <section class="carte entete">
        <h2>{{ p.nom }}</h2>
        <p class="secondaire">{{ p.niveau }} · MFT {{ p.versionMft }}
          @if (suivies().has(p.id)) { · suivie par la saison en cours }</p>
        @if (p.description) { <p>{{ p.description }}</p> }
        @if (p.decoupage === 'PLONGEES') {
          <p class="secondaire">
            Découpée par plongées : chaque élève avance à son rythme, l'étape se lit à son numéro
            de plongée en milieu naturel (sa fiche de suivi montre la sienne).
          </p>
        }
        <p class="legende-phases">
          @for (ph of phases; track ph.valeur) {
            <span><app-pastille-phase [phase]="ph.valeur" /> {{ ph.libelle }}</span>
          }
        </p>
      </section>

      <ol class="periodes">
        @for (periode of p.periodes; track periode.id; let i = $index) {
          <li class="carte periode" [class.en-cours]="periode.id === periodeDuJour()?.id">
            <div class="entete-periode">
              <span class="etape">Étape {{ i + 1 }}</span>
              <span class="plage">{{ plage(periode) }}</span>
              @if (periode.milieu) {
                <span class="milieu">{{ periode.milieu === 'NATUREL' ? 'Milieu naturel' : 'Piscine / fosse' }}</span>
              }
              @if (periode.id === periodeDuJour()?.id) { <span class="maintenant">En ce moment</span> }
            </div>
            <h3>{{ periode.intitule }}</h3>
            @if (periode.note) { <p class="note">{{ periode.note }}</p> }
            @let groupes = groupesDe(periode);
            @if (groupes.length === 0) {
              <p class="secondaire">
                Pas d'exercice prévu dans cette période.
                @if (periode.blocs.length > 0) { Compétences : {{ intitulesBlocs(periode) }}. }
              </p>
            }
            @for (g of groupes; track g.bloc.id) {
              <div class="competence">
                <h4>
                  @if (g.bloc.regroupement) { <span class="regroupement">{{ g.bloc.regroupement }}</span> }
                  {{ g.bloc.intitule }}
                </h4>
                <ul class="exercices">
                  @for (e of g.exercices; track e.id) {
                    <li>
                      <a [routerLink]="['/exercices', e.id]" class="exercice">
                        <app-pastille-phase [phase]="e.phase" [numero]="e.numero" [intitule]="e.intitule" />
                        <span class="intitule">{{ e.intitule }}</span>
                        <span class="medias">{{ medias(e) }}</span>
                      </a>
                    </li>
                  }
                </ul>
              </div>
            }
            @if (resume(periode); as r) { <p class="secondaire compte">{{ r }}</p> }
          </li>
        }
      </ol>

      @if (horsParcours().length > 0) {
        <details class="carte hors">
          <summary>Exercices de la base hors du parcours ({{ horsParcours().length }})</summary>
          <p class="secondaire">Exercices actifs prévus dans aucune période : en réserve, pour varier ou remédier.</p>
          <ul class="exercices">
            @for (e of horsParcours(); track e.id) {
              <li>
                <a [routerLink]="['/exercices', e.id]" class="exercice">
                  <app-pastille-phase [phase]="e.phase" [numero]="e.numero" [intitule]="e.intitule" />
                  <span class="intitule">{{ e.intitule }}</span>
                  <span class="medias">{{ medias(e) }}</span>
                </a>
              </li>
            }
          </ul>
        </details>
      }
    } @else {
      <div class="carte vide"><p>Aucune progression type pour le {{ niveau() }}.</p></div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .onglets { display: flex; gap: var(--pas); margin: var(--pas-2) 0; }
    .onglet {
      min-height: 44px; padding: 0 var(--pas-3); border-radius: var(--r-s);
      border: 1px solid var(--trait); background: #fff; font-weight: 700; cursor: pointer;
    }
    .onglet.actif { background: var(--profond); color: #fff; border-color: var(--profond); }
    #progression { max-width: 480px; }
    .carte { padding: var(--pas-2) var(--pas-3); margin-top: var(--pas-2); }
    .entete h2 { margin: 0; font-size: 1.0625rem; }
    .entete p { margin: 4px 0 0; }
    .legende-phases { display: flex; flex-wrap: wrap; gap: var(--pas-2); font-size: .875rem; }
    .legende-phases span { display: inline-flex; align-items: center; gap: 4px; }
    .periodes { list-style: none; margin: 0; padding: 0; }
    .periode.en-cours { border: 2px solid var(--profond); }
    .entete-periode { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--pas); }
    .etape { font-family: var(--font-titres), sans-serif; font-weight: 700; color: var(--profond-fonce); }
    .plage { color: var(--profond); font-weight: 700; text-transform: capitalize; }
    .milieu, .maintenant {
      padding: 0 8px; font-size: .8125rem; border-radius: var(--r-s);
      border: 1px solid var(--profond); color: var(--profond);
    }
    .maintenant { background: var(--profond); color: #fff; }
    .periode h3 { margin: 4px 0 0; font-size: 1rem; }
    .note { margin: var(--pas) 0 0; font-size: .9375rem; }
    .competence h4 { margin: var(--pas-2) 0 4px; font-size: .9375rem; color: var(--profond); }
    .regroupement {
      border: 1px solid var(--trait); border-radius: var(--r-s); padding: 0 6px; font-size: .75rem; color: var(--craie);
    }
    .exercices { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
    .exercice {
      display: flex; align-items: center; gap: var(--pas); min-height: 44px; padding: 2px var(--pas);
      border-radius: var(--r-s); text-decoration: none; color: inherit;
    }
    .exercice:hover { background: var(--fond); }
    .intitule { flex: 1; min-width: 0; }
    .medias { font-size: .8125rem; color: var(--craie); white-space: nowrap; }
    .compte { margin: var(--pas) 0 0; font-size: .8125rem; }
    .hors summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; font-weight: 700; }
  `]
})
export class ParcoursComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  reseau = inject(ReseauService);
  readonly niveaux = NIVEAUX;
  readonly phases = PHASES;
  readonly plage = plagePeriode;

  /** Progression à ouvrir (?progression=12), ou la formation (?referentiel=3). */
  progressionParam = input<string | undefined>(undefined, { alias: 'progression' });
  referentielParam = input<string | undefined>(undefined, { alias: 'referentiel' });

  liste = signal<ProgressionResume[]>([]);
  suivies = signal<Set<number>>(new Set());
  niveau = signal<Niveau>('N1');
  progressionId = signal<number | null>(null);
  progression = signal<ProgressionVue | null>(null);
  referentiel = signal<ReferentielVue | null>(null);
  exercices = signal<ExerciceBaseVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  private pret = false;

  progressionsDuNiveau = computed(() => this.liste().filter(p => p.niveau === this.niveau()));

  private exercicesParId = computed(() => new Map(this.exercices().map(e => [e.id, e])));

  /** La période qui couvre le mois en cours (aucune pour une progression par plongées). */
  periodeDuJour = computed(() => {
    const p = this.progression();
    return p ? periodeDuMois(p.periodes, dateDuJour()) : null;
  });

  horsParcours = computed(() => {
    const prevus = new Set((this.progression()?.periodes ?? []).flatMap(p => (p.exercices ?? []).map(e => e.id)));
    return this.exercices().filter(e => e.actif && !prevus.has(e.id));
  });

  constructor() {
    effect(() => {
      const progression = this.progressionParam();
      const referentiel = this.referentielParam();
      untracked(() => void this.demarrer(Number(progression) || null, Number(referentiel) || null));
    });
  }

  private async demarrer(progressionId: number | null, referentielId: number | null): Promise<void> {
    if (this.pret && progressionId === this.progressionId()) return;
    this.chargement.set(true);
    this.message.set(null);
    try {
      if (!this.pret) {
        const [liste, saison] = await Promise.all([
          firstValueFrom(this.api.progressions()),
          this.api.progressionsDeLaSaison().catch(() => [] as ProgressionVue[])
        ]);
        this.liste.set(liste);
        this.suivies.set(new Set(saison.map(p => p.id)));
        this.pret = true;
      }
      const liste = this.liste();
      const cible = liste.find(p => p.id === progressionId)
        ?? this.parDefaut(liste.filter(p => referentielId == null || p.referentielId === referentielId))
        ?? this.parDefaut(liste.filter(p => p.niveau === this.niveau()));
      if (cible) {
        this.niveau.set(cible.niveau);
        await this.charger(cible.id);
      } else {
        this.progressionId.set(null);
        this.progression.set(null);
      }
    } catch {
      this.message.set('Impossible de charger le parcours de formation.');
    } finally {
      this.chargement.set(false);
    }
  }

  /** Celle que suit la saison en cours, sinon la première. */
  private parDefaut(liste: ProgressionResume[]): ProgressionResume | undefined {
    return liste.find(p => this.suivies().has(p.id)) ?? liste[0];
  }

  choisirNiveau(n: Niveau): void {
    this.niveau.set(n);
    const cible = this.parDefaut(this.progressionsDuNiveau());
    if (cible) this.ouvrir(cible.id);
    else {
      this.progressionId.set(null);
      this.progression.set(null);
    }
  }

  ouvrir(id: number): void {
    void this.router.navigate([], { queryParams: { progression: id } });
  }

  private async charger(id: number): Promise<void> {
    this.progressionId.set(id);
    const p = await firstValueFrom(this.api.progression(id));
    const [referentiel, exercices] = await Promise.all([
      this.referentiel()?.id === p.referentielId ? Promise.resolve(this.referentiel()!)
        : firstValueFrom(this.api.referentiel(p.referentielId)),
      this.referentiel()?.id === p.referentielId ? Promise.resolve(this.exercices())
        : firstValueFrom(this.api.exercicesBase(p.referentielId))
    ]);
    this.referentiel.set(referentiel);
    this.exercices.set(exercices);
    this.progression.set(p);
  }

  /** Exercices de la période regroupés par compétence, dans l'ordre du référentiel. */
  groupesDe(periode: PeriodeProgressionVue): GroupeCompetence[] {
    const blocs = [...(this.referentiel()?.blocs ?? [])].sort((a, b) => a.ordre - b.ordre);
    const parId = this.exercicesParId();
    const prevus = (periode.exercices ?? []).map(e => parId.get(e.id)).filter((e): e is ExerciceBaseVue => !!e);
    return blocs
      .map(bloc => ({ bloc, exercices: prevus.filter(e => e.blocId === bloc.id) }))
      .filter(g => g.exercices.length > 0);
  }

  intitulesBlocs(periode: PeriodeProgressionVue): string {
    return periode.blocs.map(b => b.intitule).join(', ');
  }

  /** « 4 initiation · 3 perfectionnement · 2 maîtrise ». */
  resume(periode: PeriodeProgressionVue): string {
    const exercices = periode.exercices ?? [];
    if (exercices.length === 0) return '';
    const compte = (phase: PhaseExercice) => exercices.filter(e => e.phase === phase).length;
    return PHASES.map(p => ({ n: compte(p.valeur), libelle: p.libelle.toLowerCase() }))
      .filter(x => x.n > 0).map(x => `${x.n} ${x.libelle}`).join(' · ');
  }

  /** « schéma · 2 photos · vidéo ». */
  medias(e: ExerciceBaseVue): string {
    const parties: string[] = [];
    if (e.aSchema) parties.push('schéma');
    if (e.nombrePhotos) parties.push(e.nombrePhotos > 1 ? `${e.nombrePhotos} photos` : 'photo');
    if (e.nombreVideos) parties.push(e.nombreVideos > 1 ? `${e.nombreVideos} vidéos` : 'vidéo');
    return parties.join(' · ');
  }
}
