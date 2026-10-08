import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ReseauService } from '../../core/reseau.service';
import {
  BlocReferentielVue, DemandeExercice, ExerciceBaseVue, ExerciceNoteVue, ExerciceVue, FormationProgrammeVue,
  GroupeProgrammeVue, PhaseExercice, ProgressionVue, ReferentielVue, SeanceVue
} from '../../core/modeles';
import { DialogueComponent } from '../../core/dialogue.component';
import { PHASES, PastillePhaseComponent } from '../../core/phase-exercice';
import { SchemaExerciceComponent } from '../../core/schema-exercice.component';
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
  /** Exercice de la base dont celui-ci est tiré ; null pour un exercice libre. */
  exerciceBase: ExerciceNoteVue | null;
}

let prochaineCle = 1;

function versBrouillon(e: ExerciceVue): Brouillon {
  return {
    cle: prochaineCle++, intitule: e.intitule, consignes: e.consignes ?? '', dureeMinutes: e.dureeMinutes,
    referentielId: e.referentielId,
    criteres: e.criteres.map(c => ({ id: c.id, bloc: c.bloc, savoirFaire: c.savoirFaire })),
    exerciceBase: e.exerciceBase ?? null
  };
}

function versDemande(b: Brouillon): DemandeExercice {
  return {
    intitule: b.intitule.trim(), consignes: b.consignes.trim() || null,
    dureeMinutes: b.dureeMinutes || null, referentielId: b.referentielId,
    critereIds: b.referentielId == null ? [] : b.criteres.map(c => c.id),
    exerciceBaseId: b.referentielId == null ? null : b.exerciceBase?.id ?? null
  };
}

/**
 * Programme d'exercices d'une séance, un par groupe d'entraînement (préparé
 * par ses encadrants ou un admin, consulté par les autres) plus un programme
 * commun : une liste ordonnée d'exercices, chacun rattaché à une formation et
 * aux critères qu'il fait travailler. La fiche de suivi des élèves présents montre ensuite
 * ces exercices et marque leurs critères, et « Noter les présents » peut les
 * reprendre. Le programme ne note personne. Nécessite le réseau.
 */
@Component({
  selector: 'app-programme-exercices',
  imports: [FormsModule, RouterLink, DialogueComponent, PastillePhaseComponent, SchemaExerciceComponent],
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
      Chaque groupe d'entraînement prépare sa séance en choisissant les exercices des compétences
      (initiation, perfectionnement, maîtrise) : chacun arrive avec les critères qu'il fait travailler,
      la fiche de suivi des élèves du groupe les mettra en avant et l'exercice sera déjà choisi pour les
      noter. Un exercice libre sert à l'échauffement ou à la nage. Le programme commun sert à toute la
      séance (échauffement, séance sans groupes). Préparer un programme ne note aucun élève.
    </p>

    @if (!reseau.enLigne()) {
      <div class="alerte" role="status">Le programme d'exercices demande le réseau.</div>
    }
    @if (erreur(); as e) { <div class="alerte" role="alert">{{ e }}</div> }
    @if (message(); as m) { <div class="alerte succes" role="status">{{ m }}</div> }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (charge()) {
      @if (choixProgrammes().length > 1) {
        <h2 class="titre-choix">Programme du groupe</h2>
        <div class="programmes" role="group" aria-label="Programme à préparer">
          @for (p of choixProgrammes(); track p.groupeId) {
            <button type="button" class="bouton-discret" [class.actif]="p.groupeId === groupeId()"
                    [attr.aria-pressed]="p.groupeId === groupeId()" (click)="choisirProgramme(p.groupeId)">
              {{ p.libelle }}
              @if (p.nombre > 0) { <span class="compte">{{ p.nombre }}</span> }
            </button>
          }
        </div>
      }

      @if (lectureSeule()) {
        <div class="alerte" role="status">
          Seuls les encadrants du groupe « {{ groupeChoisi()?.nom }} » et les administrateurs préparent son
          programme : vous le consultez.
        </div>
        @if (exercicesDuProgramme().length === 0) {
          <div class="carte vide"><p>Aucun exercice préparé par ce groupe pour cette séance.</p></div>
        } @else {
          <ol class="exercices">
            @for (e of exercicesDuProgramme(); track e.id; let i = $index) {
              <li class="carte exercice">
                <div class="entete-exercice">
                  <span class="numero" aria-hidden="true">{{ i + 1 }}</span>
                  @if (e.exerciceBase; as base) {
                    <app-pastille-phase [phase]="base.phase" [intitule]="base.intitule" />
                  }
                  <strong class="intitule-lu">{{ e.intitule }}</strong>
                </div>
                <p class="secondaire">
                  {{ e.niveau ? libellePreparation(e.niveau) : 'Toutes formations' }}
                  @if (e.dureeMinutes) { · {{ e.dureeMinutes }} min }
                </p>
                @if (e.consignes) { <p class="consignes-lues">{{ e.consignes }}</p> }
                @if (e.criteres.length > 0) {
                  <ul class="choisis">
                    @for (c of e.criteres; track c.id) {
                      <li><span><span class="bloc">{{ c.bloc }}</span> {{ c.savoirFaire }}</span></li>
                    }
                  </ul>
                }
              </li>
            }
          </ol>
        }
      } @else {
      @if (brouillons().length === 0) {
        <div class="carte vide"><p>Aucun exercice dans ce programme pour l'instant.</p></div>
      }
      <ol class="exercices">
        @for (b of brouillons(); track b.cle; let i = $index, premier = $first, dernier = $last) {
          <li class="carte exercice">
            @if (b.exerciceBase; as base) {
              <!-- Exercice de la base des compétences : intitulé, formation et critères viennent de la base. -->
              <div class="entete-exercice">
                <span class="numero" aria-hidden="true">{{ i + 1 }}</span>
                <app-pastille-phase [phase]="base.phase" [numero]="base.numero" [intitule]="base.intitule" />
                <strong class="intitule-lu">{{ base.intitule }}</strong>
              </div>
              <p class="secondaire">
                {{ libelleFormationId(b.referentielId) }} · exercice de la base des compétences
              </p>
              @if (b.criteres.length > 0) {
                <ul class="choisis">
                  @for (c of b.criteres; track c.id) {
                    <li><span><span class="bloc">{{ c.bloc }}</span> {{ c.savoirFaire }}</span></li>
                  }
                </ul>
              }
              <div class="champs">
                <div class="duree">
                  <label [for]="'duree-' + b.cle">Durée (min)</label>
                  <input [id]="'duree-' + b.cle" type="number" min="1" max="600" inputmode="numeric"
                         [(ngModel)]="b.dureeMinutes">
                </div>
              </div>
              <label [for]="'consignes-' + b.cle">Consignes, déroulé</label>
              <textarea [id]="'consignes-' + b.cle" rows="3" [(ngModel)]="b.consignes"></textarea>
            } @else {
            <div class="entete-exercice">
              <span class="numero" aria-hidden="true">{{ i + 1 }}</span>
              <label class="visuellement-cache" [for]="'intitule-' + b.cle">Intitulé de l'exercice {{ i + 1 }}</label>
              <input [id]="'intitule-' + b.cle" type="text" maxlength="200" class="intitule"
                     placeholder="ex. Échauffement : 200 m de nage" [(ngModel)]="b.intitule"
                     [class.manquant]="!b.intitule.trim()">
            </div>
            <p class="secondaire">Exercice libre</p>

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
        <button type="button" class="bouton-principal ajout-base" (click)="ouvrirBase()" [disabled]="!reseau.enLigne()">
          + Ajouter des exercices des compétences
        </button>
        <button type="button" class="bouton-discret" (click)="ajouter()">
          + Exercice libre (échauffement, nage…)
        </button>
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

      <app-dialogue [ouvert]="baseOuverte()" titre="Ajouter des exercices des compétences" [erreur]="erreurBase()"
                    (fermer)="baseOuverte.set(false)">
        <label for="base-formation">Formation</label>
        <select id="base-formation" [ngModel]="baseReferentielId()" (ngModelChange)="choisirFormationBase($event)">
          @for (f of formations(); track f.referentielId) {
            <option [ngValue]="f.referentielId">{{ libelleFormation(f) }}</option>
          }
        </select>
        @if (baseReferentielId() != null && referentiels().get(baseReferentielId()!); as ref) {
          <label for="base-competence">Compétence</label>
          <select id="base-competence" [ngModel]="baseBlocId()" (ngModelChange)="baseBlocId.set($event)">
            @for (bloc of blocsAvecExercices(ref); track bloc.id) {
              <option [ngValue]="bloc.id">
                {{ bloc.intitule }}{{ auProgramme(ref.id).has(bloc.id) ? ' — au programme' : '' }}
              </option>
            }
          </select>
          @if (blocsAvecExercices(ref).length === 0) {
            <p class="secondaire">Pas encore de base d'exercices pour cette formation.</p>
          }
          <div class="phases" role="group" aria-label="Phase">
            @for (p of phases; track p.valeur) {
              <button type="button" class="bouton-discret" [class.actif]="basePhase() === p.valeur"
                      [attr.aria-pressed]="basePhase() === p.valeur" (click)="basePhase.set(p.valeur)">
                {{ p.libelle }}
              </button>
            }
          </div>
          <ul class="liste-coches">
            @for (e of exercicesProposes(); track e.id) {
              <li>
                <label>
                  <input type="checkbox" [checked]="baseCoches().has(e.id)" (change)="basculerBase(e.id)">
                  <app-pastille-phase [phase]="e.phase" [numero]="e.numero" [intitule]="e.intitule" />
                  <span>
                    <strong>{{ e.intitule }}</strong>
                    @if (e.critereReussite) { <span class="secondaire reussite">Réussite : {{ e.critereReussite }}</span> }
                  </span>
                </label>
                @if (e.aSchema) {
                  <button type="button" class="bouton-discret petit" (click)="basculerSchema(e.id)"
                          [attr.aria-expanded]="schemaOuvert() === e.id">
                    {{ schemaOuvert() === e.id ? 'Masquer le schéma' : 'Voir le schéma' }}
                  </button>
                  @if (schemaOuvert() === e.id) {
                    <app-schema-exercice [exerciceId]="e.id" [libelle]="e.numero + ' ' + e.intitule" />
                  }
                }
              </li>
            }
          </ul>
        } @else if (baseReferentielId() != null) {
          <p class="secondaire">Chargement de la base d'exercices…</p>
        }
        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" [disabled]="baseCoches().size === 0" (click)="ajouterDepuisBase()">
            Ajouter {{ baseCoches().size > 0 ? baseCoches().size + ' exercice(s)' : '' }}
          </button>
          <button type="button" class="bouton-discret" (click)="baseOuverte.set(false)">Annuler</button>
        </div>
      </app-dialogue>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .retour { display: inline-flex; align-items: center; min-height: 44px; }
    h1 { margin-bottom: var(--pas); }
    .choix-seance-programme { max-width: 560px; }
    .titre-choix { margin: var(--pas-3) 0 var(--pas); font-size: 1rem; }
    .programmes { display: flex; flex-wrap: wrap; gap: var(--pas); }
    .programmes .actif { background: var(--profond); color: #fff; border-color: var(--profond); }
    .programmes .actif .compte { background: #fff; color: var(--profond); }
    .intitule-lu { flex: 1; }
    .consignes-lues { margin: 0 0 var(--pas); white-space: pre-line; }
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
    .phases { display: flex; flex-wrap: wrap; gap: var(--pas); margin: var(--pas-2) 0 var(--pas); }
    .phases .actif { background: var(--profond); color: #fff; border-color: var(--profond); }
    .reussite { display: block; font-size: .8125rem; }
    .ajouts .ajout-base { width: auto; margin-top: 0; }
  `]
})
export class ProgrammeExercicesComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  reseau = inject(ReseauService);
  readonly Number = Number;

  /** Identifiant de la séance, tiré de l'adresse. */
  id = input.required<string>();
  /** Programme à ouvrir d'emblée (?groupe=12 ou ?groupe=commun), depuis la feuille de présence filtrée sur un groupe. */
  groupe = input<string>();
  readonly libellePreparation = libellePreparation;

  chargement = signal(true);
  charge = signal(false);
  envoi = signal(false);
  erreur = signal<string | null>(null);
  message = signal<string | null>(null);

  seances = signal<SeanceVue[]>([]);
  formations = signal<FormationProgrammeVue[]>([]);
  groupes = signal<GroupeProgrammeVue[]>([]);
  /** Tous les programmes de la séance, tels qu'enregistrés. */
  private tous = signal<ExerciceVue[]>([]);
  /** Programme affiché : un groupe, ou null pour le programme commun. */
  groupeId = signal<number | null>(null);
  brouillons = signal<Brouillon[]>([]);
  /** Dernière version enregistrée, pour savoir s'il reste des modifications. */
  private enregistre = signal('[]');
  referentiels = signal<Map<number, ReferentielVue>>(new Map());
  progressions = signal<ProgressionVue[]>([]);
  /** Exercice dont la liste des critères est dépliée. */
  choixOuvert = signal<number | null>(null);

  seance = computed(() => this.seances().find(s => s.id === Number(this.id())) ?? null);
  autresSeances = computed(() => [...this.seances()].filter(s => s.id !== Number(this.id())).reverse());

  groupeChoisi = computed(() => this.groupes().find(g => g.id === this.groupeId()) ?? null);
  /** Le programme d'un groupe se prépare par ses encadrants (ou un admin) ; le commun par tout encadrant. */
  lectureSeule = computed(() => {
    const g = this.groupeChoisi();
    return !!g && !g.modifiable;
  });
  exercicesDuProgramme = computed(() => this.tous().filter(e => e.groupeId === this.groupeId()));

  /** Mes groupes d'abord, puis les autres dans l'ordre du planning, puis le programme commun. */
  choixProgrammes = computed(() => {
    const tous = this.tous();
    const nombre = (id: number | null) => tous.filter(e => e.groupeId === id).length;
    const groupes = [...this.groupes()].sort((a, b) => Number(b.mien) - Number(a.mien));
    return [
      ...groupes.map(g => ({ groupeId: g.id as number | null, libelle: g.nom + (g.mien ? ' (mon groupe)' : ''),
                             nombre: nombre(g.id) })),
      { groupeId: null, libelle: 'Programme commun', nombre: nombre(null) }
    ];
  });

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
      this.groupes.set(programme.groupes);
      // Le programme demandé, sinon le premier groupe que j'encadre, sinon le programme commun.
      const demande = programme.groupes.find(g => g.id === Number(this.groupe()));
      this.groupeId.set(this.groupe() === 'commun' ? null
        : (demande ?? programme.groupes.find(g => g.mien))?.id ?? null);
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

  /** Garde tous les programmes et met en édition celui du groupe affiché. */
  private appliquer(exercices: ExerciceVue[]): void {
    this.tous.set(exercices);
    const brouillons = this.exercicesDuProgramme().map(versBrouillon);
    this.brouillons.set(brouillons);
    this.enregistre.set(JSON.stringify(brouillons.map(versDemande)));
    this.choixOuvert.set(null);
  }

  choisirProgramme(groupeId: number | null): void {
    if (groupeId === this.groupeId()) return;
    if (this.modifie() && !confirm('Les modifications de ce programme ne sont pas enregistrées. Les abandonner ?')) {
      return;
    }
    this.groupeId.set(groupeId);
    this.message.set(null);
    this.erreur.set(null);
    this.appliquer(this.tous());
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
    // On reste sur le même programme (groupe ou commun) d'une séance à l'autre.
    void this.router.navigate(['/seances', seanceId, 'programme'],
      { queryParams: { groupe: this.groupeId() ?? 'commun' } });
  }

  libelleSeance(s: SeanceVue): string {
    const memeJour = this.seances().filter(x => x.date === s.date).length > 1;
    return `${dateFr(s.date)}${memeJour ? ' (séance ' + s.ordre + ')' : ''} — ${lieuEtSite(s) || 'lieu non précisé'}`;
  }

  libelleFormationId(referentielId: number | null): string {
    const f = this.formations().find(x => x.referentielId === referentielId);
    return f ? `${libellePreparation(f.niveau)} (MFT ${f.versionMft})` : 'Formation';
  }

  libelleFormation(f: FormationProgrammeVue): string {
    const effectif = f.eleves > 0 ? ` — ${f.eleves} élève${f.eleves > 1 ? 's' : ''}` : '';
    return `${libellePreparation(f.niveau)} (MFT ${f.versionMft})${effectif}`;
  }

  ajouter(): void {
    // Par défaut, la formation de l'exercice précédent, sinon celle que prépare le groupe.
    const precedent = this.brouillons().at(-1);
    const niveau = this.groupeChoisi()?.niveauPrepare;
    const duGroupe = niveau ? this.formations().find(f => f.niveau === niveau) : null;
    const nouveau: Brouillon = {
      cle: prochaineCle++, intitule: '', consignes: '', dureeMinutes: null,
      referentielId: precedent ? precedent.referentielId : duGroupe?.referentielId ?? null,
      criteres: [], exerciceBase: null
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

  // ----------------------------------------------------------------
  //  Base d'exercices : ajouter des exercices types au programme.
  // ----------------------------------------------------------------

  readonly phases = PHASES;
  baseOuverte = signal(false);
  erreurBase = signal<string | null>(null);
  baseReferentielId = signal<number | null>(null);
  baseBlocId = signal<number | null>(null);
  basePhase = signal<PhaseExercice>('INITIATION');
  baseCoches = signal<Set<number>>(new Set());
  /** Exercice dont le schéma est déplié dans le dialogue. */
  schemaOuvert = signal<number | null>(null);

  basculerSchema(id: number): void {
    this.schemaOuvert.set(this.schemaOuvert() === id ? null : id);
  }
  /** Base d'exercices chargée par formation. */
  private bases = signal<Map<number, ExerciceBaseVue[]>>(new Map());

  exercicesProposes = computed(() => {
    const ref = this.baseReferentielId();
    return (ref == null ? [] : this.bases().get(ref) ?? [])
      .filter(e => e.actif && e.blocId === this.baseBlocId() && e.phase === this.basePhase());
  });

  /** Formation proposée d'emblée : celle que prépare le groupe, sinon la première de la liste. */
  ouvrirBase(): void {
    const niveau = this.groupeChoisi()?.niveauPrepare;
    const defaut = (niveau ? this.formations().find(f => f.niveau === niveau) : null) ?? this.formations()[0];
    this.erreurBase.set(null);
    this.baseCoches.set(new Set());
    this.baseOuverte.set(true);
    if (this.baseReferentielId() == null && defaut) void this.choisirFormationBase(defaut.referentielId);
  }

  async choisirFormationBase(referentielId: number): Promise<void> {
    this.baseReferentielId.set(referentielId);
    this.baseCoches.set(new Set());
    this.erreurBase.set(null);
    try {
      await this.chargerReferentiel(referentielId);
      if (!this.bases().has(referentielId)) {
        const liste = await firstValueFrom(this.api.exercicesBase(referentielId));
        this.bases.set(new Map(this.bases()).set(referentielId, liste));
      }
      const ref = this.referentiels().get(referentielId);
      const blocs = ref ? this.blocsAvecExercices(ref) : [];
      this.baseBlocId.set(blocs[0]?.id ?? null);
    } catch (e) {
      this.erreurBase.set((e as HttpErrorResponse).error?.detail ?? 'Impossible de charger la base d\'exercices.');
    }
  }

  /** Compétences qui ont des exercices, celles au programme du mois d'abord. */
  blocsAvecExercices(ref: ReferentielVue): BlocReferentielVue[] {
    const avec = new Set((this.bases().get(ref.id) ?? []).filter(e => e.actif).map(e => e.blocId));
    return this.blocsTries(ref).filter(b => avec.has(b.id));
  }

  basculerBase(id: number): void {
    const coches = new Set(this.baseCoches());
    if (coches.has(id)) coches.delete(id); else coches.add(id);
    this.baseCoches.set(coches);
  }

  /**
   * Un exercice de la base devient un exercice du programme : son numéro et
   * son intitulé, son déroulement et son critère de réussite en consignes,
   * et tous les critères de sa compétence. Tout reste modifiable ensuite.
   */
  ajouterDepuisBase(): void {
    const referentielId = this.baseReferentielId();
    const ref = referentielId == null ? null : this.referentiels().get(referentielId);
    if (!ref) return;
    const coches = this.baseCoches();
    const choisis = (this.bases().get(ref.id) ?? []).filter(e => coches.has(e.id));
    const nouveaux: Brouillon[] = choisis.map(e => {
      const bloc = ref.blocs.find(b => b.id === e.blocId);
      const consignes = [e.deroulement, e.critereReussite ? 'Réussite : ' + e.critereReussite : null]
        .filter(Boolean).join('\n');
      return {
        cle: prochaineCle++, intitule: `${e.numero} ${e.intitule}`, consignes, dureeMinutes: null,
        referentielId: ref.id,
        criteres: (bloc?.criteres ?? []).filter(c => (e.critereIds ?? []).includes(c.id))
          .map(c => ({ id: c.id, bloc: bloc!.intitule, savoirFaire: c.savoirFaire })),
        exerciceBase: {
          id: e.id, numero: e.numero, intitule: e.intitule, phase: e.phase, blocId: e.blocId,
          critereIds: e.critereIds ?? []
        }
      };
    });
    this.brouillons.set([...this.brouillons(), ...nouveaux]);
    this.baseCoches.set(new Set());
    this.baseOuverte.set(false);
    this.message.set(`${nouveaux.length} exercice(s) ajouté(s) depuis la base : vérifiez-les puis enregistrez.`);
  }

  /** Changer de formation vide les critères : ils appartiennent à l'ancienne. */
  changerFormation(b: Brouillon, referentielId: number | null): void {
    if (b.referentielId === referentielId) return;
    b.referentielId = referentielId;
    b.criteres = [];
    b.exerciceBase = null;
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

  /**
   * Ajoute à la suite les exercices du même groupe à une autre séance (à
   * défaut, ceux de son programme commun) ; rien n'est enregistré avant
   * « Enregistrer ».
   */
  async reprendre(seanceId: number | null): Promise<void> {
    if (seanceId == null) return;
    this.erreur.set(null);
    try {
      const autre = await firstValueFrom(this.api.programmeSeance(seanceId));
      const duGroupe = autre.exercices.filter(e => e.groupeId === this.groupeId());
      const repris = duGroupe.length > 0 ? duGroupe : autre.exercices.filter(e => e.groupeId == null);
      if (repris.length === 0) {
        this.message.set('Ni ce groupe ni le programme commun n\'ont d\'exercice à reprendre à cette séance.');
        return;
      }
      // Une formation absente de cette saison ne serait pas proposée dans la liste : on l'ajoute.
      const connues = new Set(this.formations().map(f => f.referentielId));
      const manquantes = autre.formations.filter(f => !connues.has(f.referentielId)
        && repris.some(e => e.referentielId === f.referentielId));
      if (manquantes.length > 0) this.formations.set([...this.formations(), ...manquantes.map(f => ({ ...f, eleves: 0 }))]);
      this.brouillons.set([...this.brouillons(), ...repris.map(versBrouillon)]);
      this.message.set(`${repris.length} exercice(s) repris${duGroupe.length > 0 ? '' : ' du programme commun'} : `
        + 'vérifiez-les puis enregistrez.');
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
        this.api.enregistrerProgrammeSeance(Number(this.id()), this.groupeId(), this.brouillons().map(versDemande)));
      this.appliquer(programme.exercices);
      this.message.set('Programme enregistré.');
    } catch (e) {
      this.erreur.set((e as HttpErrorResponse).error?.detail ?? 'Le programme n\'a pas pu être enregistré.');
    } finally {
      this.envoi.set(false);
    }
  }
}
