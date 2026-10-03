import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ReseauService } from '../../core/reseau.service';
import {
  BlocReferentielVue, DemandeExercice, ExerciceVue, FormationProgrammeVue, ProgressionVue, ReferentielVue, SeanceVue
} from '../../core/modeles';
import { dateFr } from '../../core/date-fr';
import { lieuEtSite } from '../../core/seance-lieu';
import { libellePreparation } from '../../core/niveaux';
import { periodeDuMois } from '../../core/progression';

/** Un exercice en cours d'édition ; `cle` ne sert qu'au suivi de la liste à l'écran. */
interface Brouillon {
  cle: number;
  intitule: string;
  consignes: string;
  dureeMinutes: number | null;
  referentielId: number | null;
  /** Critères cochés, avec de quoi les afficher sans recharger le référentiel. */
  criteres: { id: number; bloc: string; savoirFaire: string }[];
}

let prochaineCle = 1;

function versBrouillon(e: ExerciceVue): Brouillon {
  return {
    cle: prochaineCle++, intitule: e.intitule, consignes: e.consignes ?? '', dureeMinutes: e.dureeMinutes,
    referentielId: e.referentielId,
    criteres: e.criteres.map(c => ({ id: c.id, bloc: c.bloc, savoirFaire: c.savoirFaire }))
  };
}

function versDemande(b: Brouillon): DemandeExercice {
  return {
    intitule: b.intitule.trim(), consignes: b.consignes.trim() || null,
    dureeMinutes: b.dureeMinutes || null, referentielId: b.referentielId,
    critereIds: b.referentielId == null ? [] : b.criteres.map(c => c.id)
  };
}

/**
 * Programme d'exercices d'une séance, préparé par un moniteur : une liste
 * ordonnée d'exercices, chacun rattaché à une formation et aux critères
 * qu'il fait travailler. La fiche de suivi des élèves présents montre ensuite
 * ces exercices et marque leurs critères, et « Noter les présents » peut les
 * reprendre. Le programme ne note personne. Nécessite le réseau.
 */
@Component({
  selector: 'app-programme-exercices',
  imports: [FormsModule, RouterLink],
  template: `
    <a routerLink="/presences" class="retour">← Présences</a>
    <h1>Programme d'exercices</h1>
    @if (seances().length > 0) {
      <label for="seance">Séance</label>
      <select #choix id="seance" class="choix-seance-programme" (change)="changerDeSeance(choix)">
        @if (!seance()) { <option [value]="id()" selected>Séance d'une autre saison</option> }
        @for (s of seances(); track s.id) {
          <option [value]="s.id" [selected]="s.id === Number(id())">
            {{ libelleSeance(s) }} · {{ s.milieu === 'NATUREL' ? 'milieu naturel' : 'piscine / fosse' }}
          </option>
        }
      </select>
    }
    <p class="secondaire">
      Préparez la séance exercice par exercice. Rattachez chaque exercice à une formation et aux critères
      qu'il fait travailler : la fiche de suivi des élèves présents les mettra en avant, et « Noter les
      présents » pourra les cocher d'un coup. Préparer un programme ne note aucun élève.
    </p>

    @if (!reseau.enLigne()) {
      <div class="alerte" role="status">Le programme d'exercices demande le réseau.</div>
    }
    @if (erreur(); as e) { <div class="alerte" role="alert">{{ e }}</div> }
    @if (message(); as m) { <div class="alerte succes" role="status">{{ m }}</div> }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (charge()) {
      @if (brouillons().length === 0) {
        <div class="carte vide"><p>Aucun exercice pour cette séance.</p></div>
      }
      <ol class="exercices">
        @for (b of brouillons(); track b.cle; let i = $index, premier = $first, dernier = $last) {
          <li class="carte exercice">
            <div class="entete-exercice">
              <span class="numero" aria-hidden="true">{{ i + 1 }}</span>
              <label class="visuellement-cache" [for]="'intitule-' + b.cle">Intitulé de l'exercice {{ i + 1 }}</label>
              <input [id]="'intitule-' + b.cle" type="text" maxlength="200" class="intitule"
                     placeholder="ex. Vidage de masque en pleine eau" [(ngModel)]="b.intitule"
                     [class.manquant]="!b.intitule.trim()">
            </div>

            <div class="champs">
              <div>
                <label [for]="'formation-' + b.cle">Formation</label>
                <select [id]="'formation-' + b.cle" [ngModel]="b.referentielId"
                        (ngModelChange)="changerFormation(b, $event)">
                  <option [ngValue]="null">Toutes (exercice commun, sans critère)</option>
                  @for (f of formations(); track f.referentielId) {
                    <option [ngValue]="f.referentielId">{{ libelleFormation(f) }}</option>
                  }
                </select>
              </div>
              <div class="duree">
                <label [for]="'duree-' + b.cle">Durée (min)</label>
                <input [id]="'duree-' + b.cle" type="number" min="1" max="600" inputmode="numeric"
                       [(ngModel)]="b.dureeMinutes">
              </div>
            </div>

            <label [for]="'consignes-' + b.cle">Consignes, déroulé</label>
            <textarea [id]="'consignes-' + b.cle" rows="2"
                      placeholder="ex. Par deux, à 3 m ; un vidage complet puis un partiel"
                      [(ngModel)]="b.consignes"></textarea>

            @if (b.referentielId != null) {
              <div class="criteres">
                <p class="titre-criteres">Critères travaillés ({{ b.criteres.length }})</p>
                @if (b.criteres.length > 0) {
                  <ul class="choisis">
                    @for (c of b.criteres; track c.id) {
                      <li>
                        <span><span class="bloc">{{ c.bloc }}</span> {{ c.savoirFaire }}</span>
                        <button type="button" class="bouton-discret petit" (click)="retirerCritere(b, c.id)"
                                [attr.aria-label]="'Retirer ' + c.savoirFaire">Retirer</button>
                      </li>
                    }
                  </ul>
                }
                <button type="button" class="bouton-discret" (click)="basculerChoix(b)"
                        [attr.aria-expanded]="choixOuvert() === b.cle">
                  {{ choixOuvert() === b.cle ? 'Fermer la liste des critères' : 'Choisir les critères' }}
                </button>

                @if (choixOuvert() === b.cle) {
                  @if (referentiels().get(b.referentielId); as ref) {
                    @for (bloc of blocsTries(ref); track bloc.id) {
                      <details class="bloc-choix" [open]="auProgramme(ref.id).has(bloc.id) || cochesDuBloc(b, bloc) > 0">
                        <summary>
                          <span class="intitule-bloc">
                            @if (bloc.regroupement) { <span class="regroupement">{{ bloc.regroupement }}</span> }
                            {{ bloc.intitule }}
                          </span>
                          @if (auProgramme(ref.id).has(bloc.id)) { <span class="programme">Au programme</span> }
                          @if (cochesDuBloc(b, bloc) > 0) { <span class="compte">{{ cochesDuBloc(b, bloc) }}</span> }
                        </summary>
                        <ul class="liste-coches">
                          @for (c of bloc.criteres; track c.id) {
                            <li>
                              <label>
                                <input type="checkbox" [checked]="estCoche(b, c.id)"
                                       (change)="basculerCritere(b, bloc, c)">
                                <span [attr.title]="c.critereRealisation">{{ c.savoirFaire }}</span>
                              </label>
                            </li>
                          }
                        </ul>
                      </details>
                    }
                  } @else {
                    <p class="secondaire">Chargement des critères…</p>
                  }
                }
              </div>
            }

            <div class="actions-exercice">
              <button type="button" class="bouton-discret" [disabled]="premier" (click)="deplacer(i, -1)"
                      [attr.aria-label]="'Monter l’exercice ' + (i + 1)">↑ Monter</button>
              <button type="button" class="bouton-discret" [disabled]="dernier" (click)="deplacer(i, 1)"
                      [attr.aria-label]="'Descendre l’exercice ' + (i + 1)">↓ Descendre</button>
              <button type="button" class="bouton-discret danger" (click)="retirer(i)">Supprimer</button>
            </div>
          </li>
        }
      </ol>

      <div class="ajouts">
        <button type="button" class="bouton-discret" (click)="ajouter()">+ Ajouter un exercice</button>
        <div class="reprise">
          <label for="reprise">Reprendre les exercices d'une autre séance</label>
          <select id="reprise" [ngModel]="null" (ngModelChange)="reprendre($event)" [disabled]="!reseau.enLigne()">
            <option [ngValue]="null">Choisir une séance…</option>
            @for (s of autresSeances(); track s.id) {
              <option [ngValue]="s.id">{{ libelleSeance(s) }}</option>
            }
          </select>
        </div>
      </div>

      <div class="barre-enregistrement">
        <button type="button" class="bouton-principal" (click)="enregistrer()"
                [disabled]="envoi() || !reseau.enLigne() || !modifie()">
          {{ envoi() ? 'Enregistrement…' : 'Enregistrer le programme' }}
        </button>
        @if (modifie()) {
          <span class="secondaire">Modifications non enregistrées.</span>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .retour { display: inline-flex; align-items: center; min-height: 44px; }
    h1 { margin-bottom: var(--pas); }
    .choix-seance-programme { max-width: 560px; }
    .alerte.succes { border-color: var(--acquis); color: var(--acquis); }

    .exercices { list-style: none; margin: var(--pas-2) 0 0; padding: 0; display: grid; gap: var(--pas-2); }
    .exercice { padding: var(--pas-2) var(--pas-3); }
    .entete-exercice { display: flex; align-items: center; gap: var(--pas); }
    .numero {
      flex: none; width: 32px; height: 32px; border-radius: 50%; background: var(--profond); color: #fff;
      display: flex; align-items: center; justify-content: center; font-weight: 700;
    }
    .intitule { flex: 1; margin: 0; font-weight: 700; }
    .manquant { border-color: var(--accent); }
    .champs { display: flex; flex-wrap: wrap; gap: var(--pas-2); }
    .champs > div { flex: 1 1 220px; }
    .champs .duree { flex: 0 1 140px; }
    label { display: block; margin: var(--pas-2) 0 4px; font-weight: 700; font-size: .9375rem; }
    textarea { width: 100%; box-sizing: border-box; font: inherit; resize: vertical; }
    .visuellement-cache {
      position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
    }

    .criteres { margin-top: var(--pas-2); }
    .titre-criteres { margin: 0 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .choisis { list-style: none; margin: 0 0 var(--pas); padding: 0; display: grid; gap: 2px; }
    .choisis li {
      display: flex; align-items: center; justify-content: space-between; gap: var(--pas);
      padding: 2px var(--pas); border-radius: var(--r-s); background: var(--fond); font-size: .9375rem;
    }
    .bloc, .regroupement {
      border: 1px solid var(--trait); border-radius: var(--r-s); padding: 0 6px;
      font-size: .75rem; color: var(--craie); margin-right: 4px;
    }
    .petit { min-height: 44px; padding: 6px 12px; flex: none; }

    .bloc-choix { border: 1px solid var(--trait); border-radius: var(--r-s); margin-top: var(--pas); }
    .bloc-choix summary {
      display: flex; align-items: center; gap: var(--pas); min-height: 44px; padding: 4px var(--pas-2);
      cursor: pointer; font-weight: 700;
    }
    .intitule-bloc { flex: 1; min-width: 0; }
    .programme {
      background: var(--en-cours-clair); color: var(--en-cours); border-radius: var(--r-s);
      padding: 0 8px; font-size: .75rem;
    }
    .compte {
      background: var(--profond); color: #fff; border-radius: 999px; min-width: 24px;
      text-align: center; font-size: .8125rem; padding: 0 6px;
    }
    .liste-coches { list-style: none; margin: 0; padding: 0 var(--pas) var(--pas); display: grid; gap: 2px; }
    .liste-coches label {
      display: flex; align-items: center; gap: var(--pas); min-height: 44px; cursor: pointer; margin: 0;
      padding: 4px var(--pas); border-radius: var(--r-s); font-weight: 400;
    }
    .liste-coches label:hover { background: var(--fond); }
    .liste-coches input { width: 22px; height: 22px; flex-shrink: 0; margin: 0; }

    .actions-exercice { display: flex; flex-wrap: wrap; gap: var(--pas); margin-top: var(--pas-2); }
    .ajouts { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--pas-3); margin-top: var(--pas-3); }
    .reprise { flex: 1 1 280px; }
    .reprise label { margin-top: 0; }
    .reprise select { margin: 0; }
    .barre-enregistrement {
      position: sticky; bottom: 0; z-index: 5; display: flex; flex-wrap: wrap; align-items: center;
      gap: var(--pas-2); margin-top: var(--pas-3); padding: var(--pas-2) 0; background: var(--fond);
    }
    .barre-enregistrement .bouton-principal { width: auto; margin-top: 0; }
  `]
})
export class ProgrammeExercicesComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  reseau = inject(ReseauService);
  readonly Number = Number;

  /** Identifiant de la séance, tiré de l'adresse. */
  id = input.required<string>();

  chargement = signal(true);
  charge = signal(false);
  envoi = signal(false);
  erreur = signal<string | null>(null);
  message = signal<string | null>(null);

  seances = signal<SeanceVue[]>([]);
  formations = signal<FormationProgrammeVue[]>([]);
  brouillons = signal<Brouillon[]>([]);
  /** Dernière version enregistrée, pour savoir s'il reste des modifications. */
  private enregistre = signal('[]');
  referentiels = signal<Map<number, ReferentielVue>>(new Map());
  progressions = signal<ProgressionVue[]>([]);
  /** Exercice dont la liste des critères est dépliée. */
  choixOuvert = signal<number | null>(null);

  seance = computed(() => this.seances().find(s => s.id === Number(this.id())) ?? null);
  autresSeances = computed(() => [...this.seances()].filter(s => s.id !== Number(this.id())).reverse());

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => void this.charger(id));
    });
  }

  private async charger(seanceId: number): Promise<void> {
    this.chargement.set(true);
    this.erreur.set(null);
    this.message.set(null);
    try {
      this.seances.set(await this.api.seances());
      this.api.progressionsDeLaSaison().then(p => this.progressions.set(p), () => {});
      const programme = await firstValueFrom(this.api.programmeSeance(seanceId));
      this.formations.set(programme.formations);
      this.appliquer(programme.exercices);
      this.charge.set(true);
    } catch (e) {
      this.erreur.set(!this.reseau.enLigne()
        ? 'Le programme d\'exercices demande le réseau.'
        : (e as HttpErrorResponse).error?.detail ?? 'Impossible de charger le programme de cette séance.');
    } finally {
      this.chargement.set(false);
    }
  }

  private appliquer(exercices: ExerciceVue[]): void {
    const brouillons = exercices.map(versBrouillon);
    this.brouillons.set(brouillons);
    this.enregistre.set(JSON.stringify(brouillons.map(versDemande)));
    this.choixOuvert.set(null);
  }

  /** Comparé à chaque affichage : la liste reste courte. */
  modifie(): boolean {
    return JSON.stringify(this.brouillons().map(versDemande)) !== this.enregistre();
  }

  /** Une séance à préparer plus d'une semaine à l'avance n'est pas proposée par la feuille de présence. */
  changerDeSeance(choix: HTMLSelectElement): void {
    const seanceId = Number(choix.value);
    if (seanceId === Number(this.id())) return;
    if (this.modifie() && !confirm('Les modifications de ce programme ne sont pas enregistrées. Les abandonner ?')) {
      choix.value = this.id();
      return;
    }
    void this.router.navigate(['/seances', seanceId, 'programme']);
  }

  libelleSeance(s: SeanceVue): string {
    const memeJour = this.seances().filter(x => x.date === s.date).length > 1;
    return `${dateFr(s.date)}${memeJour ? ' (séance ' + s.ordre + ')' : ''} — ${lieuEtSite(s) || 'lieu non précisé'}`;
  }

  libelleFormation(f: FormationProgrammeVue): string {
    const effectif = f.eleves > 0 ? ` — ${f.eleves} élève${f.eleves > 1 ? 's' : ''}` : '';
    return `${libellePreparation(f.niveau)} (MFT ${f.versionMft})${effectif}`;
  }

  ajouter(): void {
    // Par défaut, la formation de l'exercice précédent : une séance en prépare souvent une seule.
    const precedent = this.brouillons().at(-1);
    const nouveau: Brouillon = {
      cle: prochaineCle++, intitule: '', consignes: '', dureeMinutes: null,
      referentielId: precedent?.referentielId ?? this.formations().find(f => f.eleves > 0)?.referentielId ?? null,
      criteres: []
    };
    this.brouillons.set([...this.brouillons(), nouveau]);
    this.message.set(null);
  }

  retirer(index: number): void {
    this.brouillons.set(this.brouillons().filter((_, i) => i !== index));
  }

  deplacer(index: number, sens: -1 | 1): void {
    const liste = [...this.brouillons()];
    const cible = index + sens;
    if (cible < 0 || cible >= liste.length) return;
    [liste[index], liste[cible]] = [liste[cible], liste[index]];
    this.brouillons.set(liste);
  }

  /** Changer de formation vide les critères : ils appartiennent à l'ancienne. */
  changerFormation(b: Brouillon, referentielId: number | null): void {
    if (b.referentielId === referentielId) return;
    b.referentielId = referentielId;
    b.criteres = [];
    this.brouillons.set([...this.brouillons()]);
    if (this.choixOuvert() === b.cle && referentielId != null) void this.chargerReferentiel(referentielId);
  }

  basculerChoix(b: Brouillon): void {
    if (this.choixOuvert() === b.cle) {
      this.choixOuvert.set(null);
      return;
    }
    this.choixOuvert.set(b.cle);
    if (b.referentielId != null) void this.chargerReferentiel(b.referentielId);
  }

  private async chargerReferentiel(id: number): Promise<void> {
    if (this.referentiels().has(id)) return;
    try {
      const ref = await firstValueFrom(this.api.referentiel(id));
      this.referentiels.set(new Map(this.referentiels()).set(id, ref));
    } catch {
      this.erreur.set('Impossible de charger les critères de cette formation.');
    }
  }

  /** Blocs de la période de progression du mois de la séance pour cette formation. */
  auProgramme(referentielId: number): Set<number> {
    const s = this.seance();
    const progression = this.progressions().find(p => p.referentielId === referentielId);
    const periode = progression && s ? periodeDuMois(progression.periodes, s.date) : null;
    return new Set(periode?.blocs.map(b => b.id) ?? []);
  }

  /** Les blocs au programme du mois d'abord, dans l'ordre du référentiel. */
  blocsTries(ref: ReferentielVue): BlocReferentielVue[] {
    const programme = this.auProgramme(ref.id);
    return [...ref.blocs].sort((a, b) =>
      Number(programme.has(b.id)) - Number(programme.has(a.id)) || a.ordre - b.ordre);
  }

  estCoche(b: Brouillon, critereId: number): boolean {
    return b.criteres.some(c => c.id === critereId);
  }

  cochesDuBloc(b: Brouillon, bloc: BlocReferentielVue): number {
    return bloc.criteres.filter(c => this.estCoche(b, c.id)).length;
  }

  basculerCritere(b: Brouillon, bloc: BlocReferentielVue, c: { id: number; savoirFaire: string }): void {
    b.criteres = this.estCoche(b, c.id)
      ? b.criteres.filter(x => x.id !== c.id)
      : [...b.criteres, { id: c.id, bloc: bloc.intitule, savoirFaire: c.savoirFaire }];
    this.brouillons.set([...this.brouillons()]);
  }

  retirerCritere(b: Brouillon, critereId: number): void {
    b.criteres = b.criteres.filter(c => c.id !== critereId);
    this.brouillons.set([...this.brouillons()]);
  }

  /** Ajoute à la suite les exercices d'une autre séance ; rien n'est enregistré avant « Enregistrer ». */
  async reprendre(seanceId: number | null): Promise<void> {
    if (seanceId == null) return;
    this.erreur.set(null);
    try {
      const autre = await firstValueFrom(this.api.programmeSeance(seanceId));
      if (autre.exercices.length === 0) {
        this.message.set('Cette séance n\'a pas d\'exercice à reprendre.');
        return;
      }
      // Une formation absente de cette saison ne serait pas proposée dans la liste : on l'ajoute.
      const connues = new Set(this.formations().map(f => f.referentielId));
      const manquantes = autre.formations.filter(f => !connues.has(f.referentielId)
        && autre.exercices.some(e => e.referentielId === f.referentielId));
      if (manquantes.length > 0) this.formations.set([...this.formations(), ...manquantes.map(f => ({ ...f, eleves: 0 }))]);
      this.brouillons.set([...this.brouillons(), ...autre.exercices.map(versBrouillon)]);
      this.message.set(`${autre.exercices.length} exercice(s) repris : vérifiez-les puis enregistrez.`);
    } catch (e) {
      this.erreur.set((e as HttpErrorResponse).error?.detail ?? 'Impossible de lire le programme de cette séance.');
    }
  }

  async enregistrer(): Promise<void> {
    const vides = this.brouillons().findIndex(b => !b.intitule.trim());
    if (vides >= 0) {
      this.erreur.set(`Donnez un intitulé à l'exercice n° ${vides + 1}, ou supprimez-le.`);
      return;
    }
    this.envoi.set(true);
    this.erreur.set(null);
    this.message.set(null);
    try {
      const programme = await firstValueFrom(
        this.api.enregistrerProgrammeSeance(Number(this.id()), this.brouillons().map(versDemande)));
      this.appliquer(programme.exercices);
      this.message.set('Programme enregistré.');
    } catch (e) {
      this.erreur.set((e as HttpErrorResponse).error?.detail ?? 'Le programme n\'a pas pu être enregistré.');
    } finally {
      this.envoi.set(false);
    }
  }
}
