import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { DialogueComponent } from '../../core/dialogue.component';
import { PHASES, PastillePhaseComponent } from '../../core/phase-exercice';
import {
  BlocReferentielVue, DemandeExerciceBase, ExerciceBaseVue, PhaseExercice, ReferentielVue
} from '../../core/modeles';

/** Exercice en cours de saisie dans le dialogue : `id` null pour une création. */
interface Formulaire extends DemandeExerciceBase {
  id: number | null;
  blocId: number;
}

/**
 * Base d'exercices d'une version du MFT, compétence par compétence :
 * initiation, perfectionnement, maîtrise. Les moniteurs y piochent pour
 * préparer une séance et notent l'exercice réalisé avec chaque critère.
 * Un exercice déjà noté ne se supprime pas : on le désactive.
 */
@Component({
  selector: 'app-exercices-admin',
  imports: [FormsModule, DialogueComponent, PastillePhaseComponent],
  template: `
    <h1>Base d'exercices</h1>
    <p class="secondaire">
      Chaque compétence a ses exercices d'initiation, de perfectionnement et de maîtrise. Les moniteurs
      les ajoutent au programme d'une séance et notent l'exercice réalisé avec chaque critère :
      seul un exercice de <strong>maîtrise</strong> fait passer un critère à « Acquis ». Un exercice
      déjà noté ne se supprime pas, désactivez-le : il n'est plus proposé mais reste lisible sur les notes passées.
    </p>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <label for="version">Formation</label>
    <select id="version" [ngModel]="referentielId()" (ngModelChange)="choisirReferentiel($event)">
      @for (r of referentiels(); track r.id) {
        <option [ngValue]="r.id">{{ r.niveau }} · MFT {{ r.versionMft }}{{ r.actif ? '' : ' (inactif)' }}</option>
      }
    </select>

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (detail(); as ref) {
      <p class="secondaire compte">{{ exercices().length }} exercice(s) dans cette formation.</p>
      @for (bloc of ref.blocs; track bloc.id) {
        <section class="carte bloc">
          <header>
            <h2>{{ bloc.intitule }}</h2>
            <button type="button" class="bouton-discret" (click)="nouveau(bloc)">+ Ajouter un exercice</button>
          </header>
          @let duBloc = exercicesDuBloc(bloc.id);
          @if (duBloc.length === 0) {
            <p class="secondaire">Aucun exercice pour cette compétence.</p>
          }
          @for (phase of phases; track phase.valeur) {
            @let duTemps = exercicesDeLaPhase(bloc.id, phase.valeur);
            @if (duTemps.length > 0) {
              <h3>{{ phase.libelle }}</h3>
              <ul>
                @for (e of duTemps; track e.id) {
                  <li [class.inactif]="!e.actif">
                    <div class="texte">
                      <span class="titre-exercice">
                        <app-pastille-phase [phase]="e.phase" [numero]="e.numero" [intitule]="e.intitule" />
                        <strong>{{ e.intitule }}</strong>
                        @if (!e.actif) { <span class="secondaire">(désactivé)</span> }
                      </span>
                      @if (e.critereReussite) { <span class="secondaire">Réussite : {{ e.critereReussite }}</span> }
                    </div>
                    <div class="actions">
                      <button type="button" class="bouton-discret" (click)="modifier(e)">Modifier</button>
                      <button type="button" class="bouton-discret danger" (click)="supprimer(e)">Supprimer</button>
                    </div>
                  </li>
                }
              </ul>
            }
          }
        </section>
      }
    }

    <app-dialogue [ouvert]="formulaire() !== null" [titre]="formulaire()?.id ? 'Modifier l’exercice' : 'Nouvel exercice'"
                  [erreur]="erreur()" (fermer)="formulaire.set(null)">
      @if (formulaire(); as f) {
        <p class="secondaire">{{ intituleBloc(f.blocId) }}</p>
        <div class="ligne-champs">
          <div>
            <label for="numero">Numéro</label>
            <input id="numero" type="text" maxlength="10" placeholder="ex. 1.7" [(ngModel)]="f.numero">
          </div>
          <div>
            <label for="ordre">Ordre</label>
            <input id="ordre" type="number" min="0" inputmode="numeric" [(ngModel)]="f.ordre">
          </div>
          <div>
            <label for="phase">Phase</label>
            <select id="phase" [(ngModel)]="f.phase">
              @for (p of phases; track p.valeur) { <option [ngValue]="p.valeur">{{ p.libelle }}</option> }
            </select>
          </div>
        </div>
        <label for="intitule">Intitulé</label>
        <input id="intitule" type="text" maxlength="200" [(ngModel)]="f.intitule">
        <label for="deroulement">Organisation et déroulement</label>
        <textarea id="deroulement" rows="5" [(ngModel)]="f.deroulement"></textarea>
        <label for="reussite">Critère de réussite</label>
        <textarea id="reussite" rows="2" [(ngModel)]="f.critereReussite"></textarea>
        <label class="case">
          <input type="checkbox" [(ngModel)]="f.actif"> Proposé aux moniteurs (actif)
        </label>
        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" [disabled]="envoi()" (click)="enregistrer(f)">
            {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
          <button type="button" class="bouton-discret" (click)="formulaire.set(null)">Annuler</button>
        </div>
      }
    </app-dialogue>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    #version { max-width: 480px; }
    .compte { margin-top: var(--pas-2); }
    .bloc { margin-top: var(--pas-3); padding: var(--pas-2) var(--pas-3); }
    .bloc header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--pas); }
    .bloc h2 { margin: 0; font-size: 1.0625rem; }
    .bloc h3 { margin: var(--pas-2) 0 var(--pas); font-size: .9375rem; color: var(--profond); }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    li {
      display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--pas);
      padding: var(--pas) 0; border-top: 1px solid var(--trait);
    }
    li.inactif { opacity: .6; }
    .texte { display: flex; flex-direction: column; gap: 2px; flex: 1 1 320px; min-width: 0; }
    .titre-exercice { display: flex; flex-wrap: wrap; align-items: center; gap: var(--pas); }
    .actions { display: flex; gap: var(--pas); }
    .ligne-champs { display: flex; flex-wrap: wrap; gap: var(--pas-2); }
    .ligne-champs > div { flex: 1 1 120px; }
    label { display: block; margin: var(--pas-2) 0 4px; font-weight: 700; font-size: .9375rem; }
    textarea { width: 100%; box-sizing: border-box; font: inherit; resize: vertical; }
    .case { display: flex; align-items: center; gap: var(--pas); min-height: 44px; }
    .case input { width: 22px; height: 22px; margin: 0; }
  `]
})
export class ExercicesAdminComponent {
  private api = inject(ApiService);
  readonly phases = PHASES;

  referentiels = signal<ReferentielVue[]>([]);
  referentielId = signal<number | null>(null);
  detail = signal<ReferentielVue | null>(null);
  exercices = signal<ExerciceBaseVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  formulaire = signal<Formulaire | null>(null);
  erreur = signal<string | null>(null);
  envoi = signal(false);

  private parBloc = computed(() => {
    const parBloc = new Map<number, ExerciceBaseVue[]>();
    for (const e of this.exercices()) parBloc.set(e.blocId, [...(parBloc.get(e.blocId) ?? []), e]);
    return parBloc;
  });

  constructor() {
    void this.demarrer();
  }

  /** La version active du N1 d'abord : c'est la première à avoir sa base d'exercices. */
  private async demarrer(): Promise<void> {
    try {
      const tous = await firstValueFrom(this.api.referentielsTous());
      this.referentiels.set(tous);
      const defaut = tous.find(r => r.niveau === 'N1' && r.actif) ?? tous.find(r => r.actif) ?? tous[0];
      if (defaut) await this.choisirReferentiel(defaut.id);
    } catch {
      this.message.set('Impossible de charger les formations.');
    } finally {
      this.chargement.set(false);
    }
  }

  async choisirReferentiel(id: number): Promise<void> {
    this.referentielId.set(id);
    this.chargement.set(true);
    this.message.set(null);
    try {
      const [detail, exercices] = await Promise.all([
        firstValueFrom(this.api.referentiel(id)), firstValueFrom(this.api.exercicesBase(id))
      ]);
      this.detail.set(detail);
      this.exercices.set(exercices);
    } catch {
      this.message.set('Impossible de charger la base d\'exercices de cette formation.');
    } finally {
      this.chargement.set(false);
    }
  }

  exercicesDuBloc(blocId: number): ExerciceBaseVue[] {
    return this.parBloc().get(blocId) ?? [];
  }

  exercicesDeLaPhase(blocId: number, phase: PhaseExercice): ExerciceBaseVue[] {
    return this.exercicesDuBloc(blocId).filter(e => e.phase === phase);
  }

  intituleBloc(blocId: number): string {
    return this.detail()?.blocs.find(b => b.id === blocId)?.intitule ?? '';
  }

  /** Numéro et ordre proposés à la suite des exercices de la compétence. */
  nouveau(bloc: BlocReferentielVue): void {
    const existants = this.exercicesDuBloc(bloc.id);
    const ordre = Math.max(0, ...existants.map(e => e.ordre)) + 1;
    this.erreur.set(null);
    this.formulaire.set({
      id: null, blocId: bloc.id, numero: `${bloc.ordre}.${ordre}`, ordre, phase: 'INITIATION' as PhaseExercice,
      intitule: '', deroulement: null, critereReussite: null, actif: true
    });
  }

  modifier(e: ExerciceBaseVue): void {
    this.erreur.set(null);
    this.formulaire.set({
      id: e.id, blocId: e.blocId, numero: e.numero, ordre: e.ordre, phase: e.phase, intitule: e.intitule,
      deroulement: e.deroulement, critereReussite: e.critereReussite, actif: e.actif
    });
  }

  async enregistrer(f: Formulaire): Promise<void> {
    const referentielId = this.referentielId();
    if (referentielId == null) return;
    const { id, blocId, ...demande } = f;
    this.envoi.set(true);
    this.erreur.set(null);
    try {
      const enregistre = await firstValueFrom(id == null
        ? this.api.creerExerciceBase(referentielId, blocId, demande)
        : this.api.modifierExerciceBase(referentielId, id, demande));
      this.exercices.set(id == null
        ? [...this.exercices(), enregistre]
        : this.exercices().map(e => e.id === id ? enregistre : e));
      this.exercices.set([...this.exercices()].sort((a, b) => a.ordre - b.ordre || a.numero.localeCompare(b.numero)));
      this.formulaire.set(null);
      this.message.set(`Exercice ${enregistre.numero} enregistré.`);
    } catch (e) {
      this.erreur.set((e as HttpErrorResponse).error?.detail ?? 'L\'exercice n\'a pas pu être enregistré.');
    } finally {
      this.envoi.set(false);
    }
  }

  async supprimer(e: ExerciceBaseVue): Promise<void> {
    const referentielId = this.referentielId();
    if (referentielId == null || !confirm(`Supprimer l'exercice ${e.numero} « ${e.intitule} » ?`)) return;
    try {
      await firstValueFrom(this.api.supprimerExerciceBase(referentielId, e.id));
      this.exercices.set(this.exercices().filter(x => x.id !== e.id));
      this.message.set(`Exercice ${e.numero} supprimé.`);
    } catch (err) {
      this.message.set((err as HttpErrorResponse).error?.detail ?? 'L\'exercice n\'a pas pu être supprimé.');
    }
  }
}
