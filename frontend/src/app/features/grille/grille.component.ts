import {
  Component, ElementRef, OnDestroy, computed, effect, inject, input, signal, untracked, viewChild,
  ChangeDetectionStrategy
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FileAttenteService } from '../../core/file-attente.service';
import { FileEcrituresService } from '../../core/file-ecritures.service';
import { ReseauService } from '../../core/reseau.service';
import {
  BlocVue, CritereVue, CursusVue, EtatCompetence, EvaluationVue, ExerciceBaseVue, ExerciceGrilleVue, ExerciceNoteVue, GrilleVue,
  GroupeEntrainementVue, MoniteurOptionVue, PhaseExercice, SeanceVue, Statut
} from '../../core/modeles';
import { FiltreGroupe, passeFiltreGroupe } from '../../core/filtre-groupe.component';
import { PHASES, PastillePhaseComponent } from '../../core/phase-exercice';
import { SchemaExerciceComponent } from '../../core/schema-exercice.component';
import { DateFrPipe, dateDuJour, dateFr } from '../../core/date-fr';
import { PlurielPipe } from '../../core/pluriel';
import { CalendrierSeancesComponent } from '../../core/calendrier-seances.component';
import { lieuEtSite } from '../../core/seance-lieu';
import { periodeDuMois, plageMois } from '../../core/progression';
import { DialogueComponent } from '../../core/dialogue.component';

/** Un suivi affiché (milieu naturel ou entraînement), augmenté de l'information « pas encore envoyé ». */
interface SuiviAffiche {
  statut: Statut;
  parQui: string | null;
  le: string | null;
  commentaire: string | null;
  /** Exercice de la base sur lequel la dernière note a été prise. */
  exercice: ExerciceNoteVue | null;
  /** État de cet exercice ; `statut` est celui du critère qui en découle. */
  statutExercice: Statut | null;
  enAttente: boolean;
  /** Saisie en cours d'envoi au serveur (en ligne) : on affiche un indicateur. */
  enregistrement: boolean;
}

/**
 * Les champs hérités portent l'évaluation (en milieu naturel pour un N2/N3),
 * `entr` le suivi d'entraînement en piscine et fosse (N2/N3 seulement).
 */
interface CritereAffiche extends Omit<CritereVue, 'entrainement' | 'exercice' | 'statutExercice'>, SuiviAffiche {
  entr: SuiviAffiche;
}

interface BlocAffiche extends Omit<BlocVue, 'criteres'> {
  criteres: CritereAffiche[];
  attentes: number;
}

/** Une saisie en cours d'envoi au serveur. */
interface EnVol {
  statut: Statut;
  reference: string;
  exercice: ExerciceNoteVue | null;
}

/**
 * État du critère après une note sur un exercice, même règle que le serveur
 * (EvaluationService.statutDuCritere) : un exercice d'initiation ou de
 * perfectionnement, même acquis, ou un exercice non abordé met le critère
 * en cours et ne fait jamais reculer un critère acquis ; seul un exercice de
 * maîtrise fait l'état du critère. Un exercice libre du programme (sans id)
 * suit toujours cette règle.
 */
function statutDuCritere(demande: Statut, actuel: Statut, exercice: ExerciceNoteVue | null,
                         critereAMaitrise: boolean): Statut {
  if (!exercice || (!critereAMaitrise && exercice.id != null)) return demande;
  if (exercice.phase === 'MAITRISE' && demande !== 'NON_ABORDE') return demande;
  if (actuel === 'ACQUIS') return 'ACQUIS';
  return 'EN_COURS';
}

/** Clé d'une saisie en cours d'envoi : un critère peut avoir les deux suivis en vol. */
const cle = (critereId: number, entrainement: boolean) => `${entrainement ? 'e' : 'n'}${critereId}`;

@Component({
  selector: 'app-grille',
  standalone: true,
  imports: [
    NgTemplateOutlet, FormsModule, RouterLink, DateFrPipe, PlurielPipe, CalendrierSeancesComponent, DialogueComponent, PastillePhaseComponent,
    SchemaExerciceComponent
  ],
  template: `
    <!-- Le retour à la feuille de présence est dans la barre de page (core/navigation.ts). Ici, les présents
         de la feuille (groupe filtré compris), pour noter le groupe sans repasser par la feuille. -->
    @if (depuis() === 'presences' && voisins()) {
      <nav class="navigation-eleves" aria-label="Élèves présents à la séance">
        @if (voisins(); as v) {
          <div class="voisins">
            @if (v.precedent; as p) {
              <a class="bouton-discret precedent" [routerLink]="['/cursus', p.cursusId]" queryParamsHandling="preserve"
                 [attr.aria-label]="'Élève précédent : ' + p.eleve">‹ {{ p.eleve }}</a>
            }
            <span class="secondaire rang">{{ v.rang }} / {{ v.total }}</span>
            @if (v.suivant; as s) {
              <a class="bouton-discret suivant" [routerLink]="['/cursus', s.cursusId]" queryParamsHandling="preserve"
                 [attr.aria-label]="'Élève suivant : ' + s.eleve">{{ s.eleve }} ›</a>
            }
          </div>
        }
      </nav>
    }
    @if (grilleAffichee(); as g) {
      <div class="carte entete">
        @if (urlPhoto(); as photo) {
          <img class="avatar" [src]="photo" [alt]="g.eleve" width="72" height="72">
        } @else {
          <div class="avatar silhouette" [attr.aria-label]="g.eleve">{{ initiales(g.eleve) }}</div>
        }

        <svg class="jauge" viewBox="0 0 64 168" role="img"
             [attr.aria-label]="'Progression : ' + g.criteresAcquis + ' critères acquis sur ' + g.criteresTotal">
          <rect x="18" y="14" width="28" height="140" rx="4" fill="#E7EEF0"/>
          <rect x="18" y="14" width="28" [attr.height]="140 * progression()" rx="4" fill="var(--profond)"/>
          <line x1="12" y1="14" x2="52" y2="14" stroke="var(--craie)" stroke-width="1"/>
          <line x1="12" y1="154" x2="52" y2="154" stroke="var(--craie)" stroke-width="1"/>
          <text x="32" y="9" text-anchor="middle" font-size="9" fill="var(--craie)">0 m</text>
          <text x="32" y="165" text-anchor="middle" font-size="9" fill="var(--craie)">
            {{ g.prerogativeProfondeur }} m
          </text>
        </svg>

        <div class="resume">
          <h1>{{ g.eleve }}</h1>
          <p class="secondaire">
            Plongeur {{ g.niveau }} · saison {{ g.saison }} · référentiel MFT {{ g.versionMft }}
          </p>
          <p class="score">
            {{ g.criteresAcquis }} critères acquis sur {{ g.criteresTotal }}
            <span class="secondaire">
              — {{ g.seancesBloc }} séances bloc, {{ g.seancesNage }} séances nage{{ g.seancesPlongee ? ', ' + g.seancesPlongee + ' plongées' : '' }}
            </span>
          </p>
          @if (ageDuCache(); as age) {
            <p class="secondaire">Grille consultée hors ligne, dernière mise à jour {{ age }}.</p>
          }
          <!-- Les gestes courants (vue globale, synthèse, tout ouvrir) restent visibles ; le reste passe dans « Plus d'actions ». -->
          <div class="actions-entete">
            <!-- La séance et l'origine suivent : le retour de ces écrans rouvre la fiche telle qu'elle était. -->
            <a [routerLink]="['/cursus', id(), 'matrice']" queryParamsHandling="preserve" class="bouton-discret lien-matrice">
              Vue globale (toutes les séances)
            </a>
            <a [routerLink]="['/cursus', id(), 'synthese']" queryParamsHandling="preserve"
               class="bouton-discret lien-matrice lien-synthese">
              Synthèse A / ECA / NT
            </a>
            <button type="button" class="bouton-discret bascule-blocs" (click)="basculerTousLesBlocs(g.blocs)">
              {{ blocsOuverts().size > 0 ? 'Tout refermer' : 'Tout ouvrir' }}
            </button>
            <div class="menu-actions">
              <button type="button" class="bouton-discret plus-actions" aria-haspopup="menu"
                      [attr.aria-expanded]="menuOuvert()" (click)="menuOuvert.set(!menuOuvert())">
                Plus d'actions ▾
              </button>
              @if (menuOuvert()) {
                <div class="menu-actions-liste" role="menu" (click)="menuOuvert.set(false)">
                  <button type="button" role="menuitem" (click)="ouvrirPdf()">Exporter en PDF</button>
                  @if (peutVoirHistoriqueSaisons()) {
                    <button type="button" role="menuitem" (click)="ouvrirHistoriqueSaisons()">
                      Voir les saisons précédentes
                    </button>
                  }
                  <button type="button" role="menuitem" (click)="infosSupplementairesOuvertes.set(true)">
                    Informations supplémentaires
                  </button>
                  @if (peutModifierTailles()) {
                    <button type="button" role="menuitem"
                            (click)="ouvrirTailles(g.tailleGilet, g.tailleCombinaison)">
                      Modifier les tailles
                    </button>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Chaque action de « Plus d'actions » s'ouvre dans sa propre fenêtre. -->
          <app-dialogue [ouvert]="pdfOuvert()" [titre]="'Fiche de suivi de ' + g.eleve" [erreur]="erreurPdf()"
                        (fermer)="pdfOuvert.set(false)">
            <p>La fiche reprend la grille de l'élève, mise en page pour l'imprimer ou l'envoyer.</p>
            @if (!reseau.enLigne()) { <p class="secondaire">Le réseau est nécessaire pour générer le PDF.</p> }
            @if (exportEnCours()) { <p class="secondaire" role="status">Génération du PDF…</p> }
            <div class="actions-dialogue">
              <button type="button" class="bouton-principal" (click)="telechargerPdf(g)"
                      [disabled]="!reseau.enLigne() || exportEnCours()">
                Télécharger le PDF
              </button>
              <button type="button" class="bouton-discret" (click)="pdfOuvert.set(false)">Fermer</button>
            </div>
          </app-dialogue>

          @if (peutVoirHistoriqueSaisons()) {
            <app-dialogue [ouvert]="historiqueSaisonsOuvert()" [titre]="'Saisons précédentes de ' + g.eleve"
                          (fermer)="historiqueSaisonsOuvert.set(false)">
              @if (chargementHistoriqueSaisons()) {
                <p class="secondaire">Chargement…</p>
              } @else {
                @let autres = historiqueSaisons();
                @if (autres.length === 0) {
                  <p class="secondaire">Aucune autre saison enregistrée pour {{ g.eleve }}.</p>
                } @else {
                  <ul class="saisons-precedentes">
                    @for (c of autres; track c.id) {
                      <li>
                        <a [routerLink]="['/cursus', c.id]" (click)="historiqueSaisonsOuvert.set(false)">
                          {{ c.niveau }} · {{ c.saison }} · {{ c.statut }}
                        </a>
                      </li>
                    }
                  </ul>
                }
              }
              <div class="actions-dialogue">
                <button type="button" class="bouton-discret" (click)="historiqueSaisonsOuvert.set(false)">Fermer</button>
              </div>
            </app-dialogue>
          }

          <app-dialogue [ouvert]="infosSupplementairesOuvertes()" [titre]="'Informations sur ' + g.eleve"
                        (fermer)="infosSupplementairesOuvertes.set(false)">
            <dl class="infos-supplementaires">
              <dt>Date de naissance</dt><dd>{{ g.dateNaissance ? (g.dateNaissance | dateFr) : 'non renseignée' }}</dd>
              <dt>CACI valide jusqu'au</dt>
              <dd>
                @if (g.certificatValideJusquAu) {
                  {{ g.certificatValideJusquAu | dateFr }}
                  @if (g.certificatValideJusquAu < aujourdhui) { <strong class="caci-expire">(expiré)</strong> }
                } @else {
                  non renseigné
                }
              </dd>
              <dt>Taille de gilet</dt><dd>{{ g.tailleGilet || 'non renseignée' }}</dd>
              <dt>Taille de combinaison</dt><dd>{{ g.tailleCombinaison || 'non renseignée' }}</dd>
              <dt>E-mail</dt><dd>{{ g.email || 'non renseigné' }}</dd>
              <dt>Téléphone</dt><dd>{{ g.telephone || 'non renseigné' }}</dd>
              <dt>Contact d'urgence</dt>
              <dd>
                @if (g.contactUrgenceNom || g.contactUrgenceTelephone) {
                  {{ g.contactUrgenceNom || 'nom non renseigné' }}
                  @if (g.contactUrgenceTelephone) { — {{ g.contactUrgenceTelephone }} }
                } @else {
                  non renseigné
                }
              </dd>
            </dl>
            <div class="actions-dialogue">
              <button type="button" class="bouton-discret" (click)="infosSupplementairesOuvertes.set(false)">Fermer</button>
            </div>
          </app-dialogue>

          @if (peutModifierTailles()) {
            <app-dialogue [ouvert]="tailles() !== null" [titre]="'Tailles de ' + g.eleve" [erreur]="message()"
                          (fermer)="tailles.set(null)">
              @if (tailles(); as t) {
                <label class="champ-taille" for="taille-gilet">Taille de gilet</label>
                <input id="taille-gilet" type="text" maxlength="20" placeholder="ex. M, XS, 12 ans" [(ngModel)]="t.tailleGilet">
                <label class="champ-taille" for="taille-combinaison">Taille de combinaison</label>
                <input id="taille-combinaison" type="text" maxlength="20" placeholder="ex. T3, L" [(ngModel)]="t.tailleCombinaison">
                @if (!reseau.enLigne()) { <p class="secondaire">Enregistrement possible au retour du réseau.</p> }
                <div class="actions-dialogue">
                  <button type="button" class="bouton-principal" (click)="enregistrerTailles(g.eleveId)"
                          [disabled]="enregistrementTailles() || !reseau.enLigne()">
                    {{ enregistrementTailles() ? 'Enregistrement…' : 'Enregistrer' }}
                  </button>
                  <button type="button" class="bouton-discret" (click)="tailles.set(null)">Annuler</button>
                </div>
              }
            </app-dialogue>
          }
        </div>
      </div>

      @if (!peutSaisir()) {
        <div class="alerte">
          @if (g.statut !== 'EN_COURS') {
            Ce cursus n'est plus en cours ({{ g.statut === 'DELIVRE' ? 'brevet délivré' : g.statut }}) :
            la grille est en lecture seule, aucune saisie n'est plus possible.
          } @else {
            La saisie des compétences {{ g.niveau }} est réservée aux encadrants
            {{ g.niveauEncadrantValidation }} et au-delà. Vous pouvez consulter la grille.
          }
        </div>
      }

      @if (g.milieuNaturelExclusif) {
        <div class="alerte" [class.entrainement]="modeEntrainement()">
          @if (modeEntrainement()) {
            <strong>Séance en piscine ou fosse : suivi d'entraînement.</strong>
            Vos notes montrent où en est l'élève dans les exercices, mais les compétences du
            {{ g.niveau }} ne s'acquièrent qu'en milieu naturel : elles ne comptent pas pour la validation.
          } @else {
            Les compétences du {{ g.niveau }} s'évaluent en milieu naturel. Choisissez une séance
            en piscine ou en fosse pour noter le suivi d'entraînement, qui reste à part.
          }
        </div>
      }

      @if (peutSaisir()) {
        <div class="barre-seance">
          <label for="seance">Séance évaluée</label>
          <button id="seance" type="button" class="choix-seance" aria-haspopup="dialog"
                  (click)="ouvrirDialogueSeance()">
            <span aria-hidden="true">📅</span>
            <span class="libelle-choix">{{ seanceChoisie() ? libelleSeance(seanceChoisie()!) : 'Aucune séance (date du jour)' }}</span>
            <span class="changer">Changer</span>
          </button>
        </div>
        @if (estReferent() && moniteursRemplacables().length > 0) {
          <div class="barre-seance noter-pour">
            <label for="noter-pour">Noter au nom de</label>
            <select id="noter-pour" [ngModel]="pourMoniteurId()" (ngModelChange)="pourMoniteurId.set($event)">
              <option [ngValue]="null">Moi-même</option>
              @for (m of moniteursRemplacables(); track m.id) {
                <option [ngValue]="m.id">{{ m.nomComplet }} ({{ m.niveauEncadrement }})</option>
              }
            </select>
          </div>
          @if (nomPourMoniteur(); as nom) {
            <div class="alerte" role="status">
              Vous notez <strong>au nom de {{ nom }}</strong>, en tant que référent du groupe :
              les notes porteront son nom, et l'historique gardera que c'est vous qui les avez saisies.
            </div>
          }
        }
      }

      <dialog #dialogueSeance class="dialogue-seance" aria-labelledby="titre-dialogue-seance"
              (close)="dialogueSeanceOuvert.set(false)">
        @if (dialogueSeanceOuvert()) {
          <div class="entete-dialogue">
            <h2 id="titre-dialogue-seance">Séance évaluée</h2>
            <button type="button" class="bouton-discret" (click)="fermerDialogueSeance()">Fermer</button>
          </div>
          <app-calendrier-seances [seances]="seancesUtilisables()" [jourMax]="aujourdhui"
                                  [seanceMarquee]="seanceId()"
                                  [jourSelectionne]="jourDialogue()"
                                  (jourSelectionneChange)="toucherJour($event)" />
          @if (jourDialogue(); as j) {
            @let duJour = seancesDuJour(j);
            @if (duJour.length === 0) {
              <p class="secondaire aucune">
                Aucune séance ce jour-là où l'élève est noté présent.
              </p>
            } @else {
              <ul class="seances-du-jour">
                @for (s of duJour; track s.id) {
                  <li>
                    <button type="button" class="bouton-discret" [class.actif]="s.id === seanceId()"
                            (click)="choisirDepuisDialogue(s)">
                      {{ libelleSeance(s) }}
                      <span class="milieu">
                        {{ s.milieu === 'NATUREL' ? 'Milieu naturel' : 'Piscine / fosse' }}{{ g.milieuNaturelExclusif && s.milieu !== 'NATUREL' ? ' · entraînement' : '' }}
                      </span>
                    </button>
                  </li>
                }
              </ul>
            }
          }
          @if (seanceId()) {
            <button type="button" class="bouton-discret sans-seance" (click)="retirerSeance()">
              Noter sans séance (date du jour)
            </button>
          }
        }
      </dialog>

      <!-- Les boutons de note n'affichent que les sigles : la légende les explique une fois pour toutes. -->
      <p class="legende-etats" aria-hidden="true">
        <span><strong>NA</strong> non abordé</span>
        <span><strong>ECA</strong> en cours d'acquisition</span>
        <span><strong>A</strong> acquis</span>
      </p>

      @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

      @if (g.progression) {
        <section class="carte programme" aria-label="Programme de la progression">
          @if (periodeEnCours(); as p) {
            <p class="periode">
              <span class="etiquette-programme">Au programme</span>
              <strong>{{ p.intitule }}</strong>
              <span class="secondaire"> · {{ plage(p.moisDebut, p.moisFin) }}</span>
            </p>
            @if (p.note) {
              <details class="note-periode"><summary>Contenu de la période</summary><p>{{ p.note }}</p></details>
            }
            @if (blocsAuProgramme().size > 0) {
              <button type="button" class="bouton-discret" (click)="ouvrirBlocsAuProgramme()">
                Ouvrir {{ blocsAuProgramme().size > 1 ? 'les ' + (blocsAuProgramme().size | pluriel:'compétence') : 'la compétence' }} au programme
              </button>
            }
          } @else {
            <p class="secondaire periode">Aucune période de « {{ g.progression }} » ce mois-ci.</p>
          }
          @if (nombreEnRetard() > 0) {
            <p class="retard-resume" role="status">
              {{ nombreEnRetard() | pluriel:'compétence' }} en retard sur la progression
            </p>
          }
        </section>
      }

      @if (exercicesSeance().length > 0) {
        <section class="carte programme exercices-seance" aria-label="Exercices de la séance">
          <p class="periode"><span class="etiquette-programme">Exercices de la séance</span></p>
          <ol>
            @for (e of exercicesSeance(); track $index; let i = $index) {
              <li>
                @if (e.exerciceBase; as base) {
                  <app-pastille-phase [phase]="base.phase" [intitule]="base.intitule" />
                } @else if (e.phase) {
                  <app-pastille-phase [phase]="e.phase" [intitule]="'exercice libre'" />
                }
                <strong>{{ e.intitule }}</strong>
                <span class="secondaire"> · {{ e.groupe ?? 'programme commun' }}</span>
                @if (e.dureeMinutes) { <span class="secondaire"> · {{ e.dureeMinutes }} min</span> }
                @if (e.critereIds.length > 0) {
                  <span class="secondaire"> · {{ e.critereIds.length | pluriel:'critère travaillé':'critères travaillés' }}</span>
                }
                @if (e.consignes) { <span class="secondaire consignes">{{ e.consignes }}</span> }
                @if (e.critereReussite) {
                  <span class="secondaire consignes"><strong>Réussite :</strong> {{ e.critereReussite }}</span>
                }
                @if (e.aSchema && seanceId(); as seance) {
                  @let cle = cleSchema(e);
                  <button type="button" class="lien-historique" [attr.aria-expanded]="schemasOuverts().has(cle)"
                          (click)="basculerSchema(cle)">
                    {{ schemasOuverts().has(cle) ? 'Masquer le schéma' : 'Voir le schéma' }}
                  </button>
                  @if (schemasOuverts().has(cle)) {
                    @if (e.exerciceBase; as base) {
                      <app-schema-exercice [exerciceId]="base.id" [libelle]="base.numero + ' ' + base.intitule" />
                    } @else {
                      <app-schema-exercice [seanceId]="seance" [schemaId]="e.schemaId ?? null" [libelle]="e.intitule" />
                    }
                  }
                }
                <!-- Les critères que l'exercice fait travailler, notés ici sur cet exercice. -->
                @let aEvaluer = criteresDeLExercice(e);
                @if (aEvaluer.length > 0) {
                  <ul class="criteres criteres-exercice" [attr.aria-label]="'Critères à évaluer sur ' + e.intitule">
                    @for (c of aEvaluer; track c.critere.id) {
                      <li>
                        @let etatBloc = etatCompetence(c.bloc);
                        <span class="competence-du-critere">
                          <span class="secondaire">{{ c.bloc.intitule }}</span>
                          <span [class]="'pastille etat-competence etat-' + etatBloc">{{ libelleCompetence(etatBloc) }}</span>
                        </span>
                        <ng-container *ngTemplateOutlet="ligneCritere; context: { bloc: c.bloc, critere: c.critere, exo: e, lieu: 'x' + i }" />
                      </li>
                    }
                  </ul>
                }
              </li>
            }
          </ol>
          @if (blocsDesExercices().size > 0) {
            <button type="button" class="bouton-discret" (click)="ouvrirBlocsDesExercices()">
              Ouvrir {{ blocsDesExercices().size > 1 ? 'les ' + (blocsDesExercices().size | pluriel:'compétence travaillée':'compétences travaillées') : 'la compétence travaillée' }}
            </button>
          }
        </section>
      }

      @for (groupe of groupesAffiches(); track groupe.regroupement ?? '') {
        @if (groupe.regroupement) {
          <h2 class="titre-groupe">{{ groupe.regroupement }}</h2>
        }
        @for (bloc of groupe.blocs; track bloc.id) {
        <section class="carte bloc" [class.ouvert]="blocsOuverts().has(bloc.id)">
          <header>
            <h3 class="titre-bloc">
            <button type="button" class="bascule-bloc" (click)="basculerBloc(bloc.id)"
                    [attr.aria-expanded]="blocsOuverts().has(bloc.id)"
                    [attr.aria-controls]="'criteres-' + bloc.id">
              <span class="chevron" aria-hidden="true">{{ blocsOuverts().has(bloc.id) ? '▾' : '▸' }}</span>
              <span class="texte-bloc">
              <span class="intitule">{{ bloc.intitule }}</span>
              <span class="pastilles">
                @let etatBloc = etatCompetence(bloc);
                <span [class]="'pastille etat-competence etat-' + etatBloc">{{ libelleCompetence(etatBloc) }}</span>
                @if (blocsDesExercices().has(bloc.id)) { <span class="pastille exercice">Travaillé à la séance</span> }
                @if (blocsAuProgramme().has(bloc.id)) { <span class="pastille au-programme">Au programme</span> }
                @if (bloc.enRetard) { <span class="pastille en-retard">En retard</span> }
              </span>
              <span class="secondaire detail">
                {{ bloc.acquis }} / {{ bloc.total }} acquis
                @if (g.milieuNaturelExclusif) {
                  en milieu naturel · {{ bloc.acquisEntrainement }} / {{ bloc.total }} en piscine / fosse
                }
                @if (bloc.enRetard && bloc.echeance) {
                  · prévu avant le {{ bloc.echeance | dateFr }}
                }
                @if (bloc.evaluationTransverse) {
                  · vérifiée au fil des autres compétences, sans séance dédiée
                }
                @if (bloc.validerEnDernier) {
                  · à valider en fin de formation
                }
              </span>
              </span>
            </button>
            </h3>

            @if (bloc.valide) {
              <p class="valide">Validée le {{ bloc.dateValidation | dateFr }} par {{ bloc.valideePar }}</p>
            } @else if (peutSaisir() && bloc.acquis === bloc.total) {
              @if (bloc.attentes > 0) {
                <p class="secondaire">
                  Validation possible une fois {{ bloc.attentes > 1 ? 'les ' + bloc.attentes + ' saisies envoyées' : 'la saisie envoyée' }}.
                </p>
              } @else if (bloc.maitriseAttendue?.length) {
                <p class="secondaire maitrise-attendue">
                  Validation possible une fois un exercice de maîtrise acquis
                  ({{ bloc.maitriseAttendue.join(', ') }}).
                </p>
              } @else if (!reseau.enLigne()) {
                <p class="secondaire">Validation possible au retour du réseau.</p>
              } @else {
                <button type="button" class="bouton-principal" (click)="validerBloc(bloc)"
                        [disabled]="validationEnCours() !== null">
                  @if (validationEnCours() === bloc.id) {
                    <span class="chargeur" aria-hidden="true"></span>Validation…
                  } @else {
                    Valider la compétence
                  }
                </button>
              }
            }
          </header>

          @if (blocsOuverts().has(bloc.id)) {
          @if (bloc.competenceAttendue) {
            <p class="competence-attendue"><strong>Compétence attendue :</strong> {{ bloc.competenceAttendue }}</p>
          }
          @if (bloc.comportement || bloc.theorie || bloc.modalitesEvaluation) {
            <div class="complements">
              @if (bloc.comportement) {
                <details><summary>Comportement</summary><p>{{ bloc.comportement }}</p></details>
              }
              @if (bloc.theorie) {
                <details><summary>Théorie</summary><p>{{ bloc.theorie }}</p></details>
              }
              @if (bloc.modalitesEvaluation) {
                <details><summary>Modalités d'évaluation</summary><p>{{ bloc.modalitesEvaluation }}</p></details>
              }
            </div>
          }
          @if (bloc.exercices?.length && peutSaisir() && !bloc.valide) {
            <p class="secondaire aide-exercice">
              Choisissez sous chaque critère l'exercice réalisé, puis notez cet exercice. Un exercice d'initiation ou de
              perfectionnement peut être « Acquis » ; le critère, lui, n'est acquis qu'avec un exercice de maîtrise acquis.
            </p>
          }
          <ul [id]="'criteres-' + bloc.id">
            @for (critere of bloc.criteres; track critere.id) {
              <li>
                <ng-container *ngTemplateOutlet="ligneCritere; context: { bloc: bloc, critere: critere, exo: null, lieu: 'b' }" />
              </li>
            }
          </ul>
          }
        </section>
        }
      }

      <!--
        Un critère : sa note, son commentaire, son historique. Affiché sous sa
        compétence (exo null), et sous chaque exercice de la séance qui le
        travaille (exo : cet exercice, sur lequel portent alors la note et le
        commentaire). « lieu » distingue les deux affichages d'un même critère.
      -->
      <ng-template #ligneCritere let-bloc="bloc" let-critere="critere" let-exo="exo" let-lieu="lieu">
              @let actif = suiviActif(critere);
              @let rappel = suiviRappele(critere);
              @let cleUi = lieu + ':' + critere.id;
              <!--
                On note l'exercice (choix du club, 2026) : sous un exercice de la séance,
                comme dans la compétence dès qu'un exercice est choisi, les boutons montrent
                et notent l'état de cet exercice, pas celui du critère. Sous un exercice de la
                séance, ils restent ouverts même une compétence validée. Sans exercice, ils
                notent le critère comme avant.
              -->
              @let surExo = !!exo && exerciceImpose(bloc, critere, exo) !== null;
              @let cible = surExo ? cibleDeLExercice(exo) : exerciceNote(bloc, critere);
              @let parExercice = cible !== null;
              @let suivi = cible !== null ? etatDeLExercice(critere, cible) : actif;
                <div class="ligne">
                  <div class="libelle">
                    <span>{{ critere.savoirFaire }}</span>
                    @if (!exo && critereExercices().get(critere.id); as exercices) {
                      <span class="exercice-critere">Exercice : {{ exercices }}</span>
                    }
                    @if (critere.critereRealisation) {
                      <span class="secondaire">{{ critere.critereRealisation }}</span>
                    }
                    @if (suivi.enregistrement) {
                      <span class="enregistrement" role="status">
                        <span class="chargeur" aria-hidden="true"></span>Enregistrement…
                      </span>
                    } @else if (suivi.enAttente) {
                      <span class="attente">En attente d'envoi</span>
                    } @else if (suivi.parQui) {
                      <span class="secondaire trace">{{ suivi.parQui }} · {{ suivi.le | dateFr }}</span>
                    }
                    @if (parExercice) {
                      @if (suivi.commentaire) {
                        <span class="dernier-commentaire">« {{ suivi.commentaire }} »</span>
                      }
                      @if (!surExo) {
                        <!-- Les boutons disent l'exercice : l'état du critère est rappelé à part. -->
                        <span class="etat-critere" [class.acquis]="actif.statut === 'ACQUIS'">
                          Critère : {{ libelleCritere(actif.statut) }}
                        </span>
                        @if (g.milieuNaturelExclusif) {
                          <span class="autre-suivi" [class.acquis]="rappel.statut === 'ACQUIS'">
                            {{ modeEntrainement() ? 'Milieu naturel' : 'Piscine / fosse' }} :
                            {{ libelleStatut(rappel.statut) }}@if (rappel.enAttente) { (en attente d'envoi)
                            } @else if (rappel.le) { · {{ rappel.le | dateFr }} }
                          </span>
                        }
                      }
                    } @else {
                    @if (actif.exercice; as exoNote) {
                      <span class="exercice-note">
                        <span class="secondaire">Noté sur</span>
                        <app-pastille-phase [phase]="exoNote.phase" [numero]="exoNote.numero" [intitule]="exoNote.intitule" />
                        <span class="secondaire">{{ exoNote.intitule }}</span>
                        @if (actif.statutExercice) {
                          <span class="etat-exercice" [class.acquis]="actif.statutExercice === 'ACQUIS'">
                            : exercice {{ libelleStatut(actif.statutExercice).toLowerCase() }}
                          </span>
                          @if (actif.statutExercice !== actif.statut) {
                            <span class="critere-reste">· critère {{ libelleStatut(actif.statut).toLowerCase() }}
                              (acquis avec un exercice de maîtrise)</span>
                          }
                        }
                      </span>
                    }
                    @if (actif.commentaire) {
                      <span class="dernier-commentaire">« {{ actif.commentaire }} »</span>
                    }
                    @if (g.milieuNaturelExclusif) {
                      <span class="autre-suivi" [class.acquis]="rappel.statut === 'ACQUIS'">
                        {{ modeEntrainement() ? 'Milieu naturel' : 'Piscine / fosse' }} :
                        {{ libelleStatut(rappel.statut) }}@if (rappel.enAttente) { (en attente d'envoi)
                        } @else if (rappel.le) { · {{ rappel.le | dateFr }} }
                      </span>
                    }
                    }
                  </div>

                  <!-- D'abord l'exercice réalisé, puis la note : dans l'ordre des gestes du moniteur. -->
                  <div class="saisie">
                    <!-- Sous un exercice de la séance, la note porte sur cet exercice : pas de choix à faire. -->
                    @if (peutSaisir() && !bloc.valide && aDesExercices(bloc, critere) && exerciceImpose(bloc, critere, exo) === null) {
                      @let choisi = exerciceChoisi(bloc, critere);
                      @let note = exerciceNote(bloc, critere);
                      <div class="choix-exercice">
                        <button type="button" class="choix-seance" [class.a-choisir]="!note" aria-haspopup="dialog"
                                [attr.aria-label]="'Exercice réalisé pour ' + critere.savoirFaire"
                                (click)="ouvrirChoixExercice(bloc, critere)">
                          <span class="titre-choix">1. Exercice</span>
                          @if (note) {
                            <app-pastille-phase [phase]="note.phase" [numero]="note.numero" [intitule]="note.intitule" />
                            <span class="libelle-choix">{{ note.intitule }}@if (note.id == null) { <span class="secondaire"> (libre)</span> }</span>
                          } @else {
                            <span class="libelle-choix">à choisir</span>
                          }
                          <span class="changer">{{ note ? 'Changer' : 'Choisir' }}</span>
                        </button>
                        @if (choisi?.critereReussite) {
                          <span class="secondaire">Réussite : {{ choisi!.critereReussite }}</span>
                        }
                        @if (choisi?.aSchema) {
                          <button type="button" class="lien-historique" [attr.aria-expanded]="schemasOuverts().has(choisi!.id)"
                                  (click)="basculerSchema(choisi!.id)">
                            {{ schemasOuverts().has(choisi!.id) ? 'Masquer le schéma' : 'Voir le schéma' }}
                          </button>
                          @if (schemasOuverts().has(choisi!.id)) {
                            <app-schema-exercice [exerciceId]="choisi!.id" [libelle]="choisi!.numero + ' ' + choisi!.intitule" />
                          }
                        }
                        @if (choisi?.conseils) {
                          <span class="secondaire">Conseil : {{ choisi!.conseils }}</span>
                        }
                        @if (choisi && reseau.enLigne()) {
                          <a class="lien-historique" [href]="'/exercices/' + choisi.id" target="_blank" rel="noopener">
                            Fiche complète (photos, vidéos) ↗
                          </a>
                        }
                        <span class="titre-choix">2. Note de l'exercice</span>
                      </div>
                    }
                    <div class="etats" role="group"
                         [attr.aria-label]="cible ? critere.savoirFaire + ' — exercice ' + cible.intitule : critere.savoirFaire">
                      @for (choix of (parExercice ? etatsExercice : etats); track choix.valeur) {
                        <button type="button"
                                [class]="'etat ' + choix.classe"
                                [class.actif]="suivi.statut === choix.valeur"
                                [class.differe]="suivi.enAttente && suivi.statut === choix.valeur"
                                [disabled]="!peutSaisir() || (bloc.valide && !surExo) || suivi.enregistrement"
                                [attr.aria-pressed]="suivi.statut === choix.valeur"
                                [attr.aria-label]="choix.libelle" [title]="choix.libelle"
                                (click)="noter(bloc, critere, choix.valeur, exo)">
                          {{ choix.court }}
                        </button>
                      }
                    </div>
                  </div>
                </div>

                <div class="liens-critere">
                  @if (peutSaisir() && (!bloc.valide || surExo)) {
                    <button type="button" class="lien-historique"
                            [attr.aria-expanded]="commentairesOuverts().has(cleUi)"
                            (click)="basculerCommentaire(cleUi)">
                      {{ commentairesOuverts().has(cleUi) ? 'Annuler le commentaire' : 'Commenter' }}
                    </button>
                  }
                  <button type="button" class="lien-historique"
                          (click)="basculerHistorique(critere.id, cleUi)">
                    {{ historiqueOuverts().has(cleUi) ? 'Masquer l’historique' : 'Voir l’historique' }}
                  </button>
                </div>

                @if (commentairesOuverts().has(cleUi) && peutSaisir() && (!bloc.valide || surExo)) {
                  <div class="ajout-commentaire">
                    <label class="secondaire" [for]="'commentaire-' + lieu + '-' + critere.id">
                      Ce qui a été travaillé, ce qui reste à revoir…
                    </label>
                    <textarea [id]="'commentaire-' + lieu + '-' + critere.id" rows="2"
                              [ngModel]="brouillons()[critere.id] ?? ''"
                              (ngModelChange)="modifierBrouillon(critere.id, $event)"></textarea>
                    <button type="button" class="bouton-principal"
                            [disabled]="!(brouillons()[critere.id] ?? '').trim()"
                            (click)="commenter(bloc, critere, exo, cleUi)">
                      Enregistrer le commentaire
                    </button>
                  </div>
                }

                @if (historiqueOuverts().has(cleUi)) {
                  <div class="historique">
                    @if (chargementHistorique().has(critere.id)) {
                      <p class="secondaire">Chargement…</p>
                    } @else {
                      @let entrees = historiques()[critere.id] ?? [];
                      @if (entrees.length === 0) {
                        <p class="secondaire">Aucune évaluation enregistrée pour ce critère.</p>
                      } @else {
                        @for (entree of entrees; track entree.id) {
                          <div class="entree-historique">
                            <span class="secondaire">
                              {{ entree.dateEvaluation | dateFr }} · {{ entree.parQui }}{{ entree.saisiPar ? ' (saisi par ' + entree.saisiPar + ')' : '' }} · {{ libelleStatut(entree.statut) }}
                              @if (entree.entrainement) { · <span class="etiquette-entrainement">piscine / fosse</span> }
                            </span>
                            @if (entree.exercice; as exoEntree) {
                              <span class="exercice-note">
                                <app-pastille-phase [phase]="exoEntree.phase" [numero]="exoEntree.numero" [intitule]="exoEntree.intitule" />
                                {{ exoEntree.intitule }}
                                @if (entree.statutExercice && entree.statutExercice !== entree.statut) {
                                  <span class="critere-reste">
                                    (exercice {{ libelleStatut(entree.statutExercice).toLowerCase() }},
                                    critère {{ libelleStatut(entree.statut).toLowerCase() }})
                                  </span>
                                }
                              </span>
                            }
                            @if (entree.commentaire) { <p>{{ entree.commentaire }}</p> }
                          </div>
                        }
                      }
                    }

                  </div>
                }
      </ng-template>

      <app-dialogue [ouvert]="choixExercice() !== null"
                    [titre]="'Exercice réalisé — ' + (choixExercice()?.critere?.savoirFaire ?? '')"
                    [erreur]="erreurChoixExercice()" (fermer)="fermerChoixExercice()">
        @if (choixExercice(); as choix) {
          @let bloc = choix.bloc;
          @let critere = choix.critere;
          @for (phase of phases; track phase.valeur) {
            @let duTemps = exercicesDeLaPhase(bloc, critere, phase.valeur);
            @if (duTemps.length > 0) {
              <h3 class="titre-phase">{{ phase.libelle }}</h3>
              <ul class="liste-exercices">
                @for (e of duTemps; track e.id) {
                  <li>
                    <button type="button" class="choix-exo" [class.actif]="exerciceChoisi(bloc, critere)?.id === e.id"
                            [attr.aria-pressed]="exerciceChoisi(bloc, critere)?.id === e.id"
                            (click)="choisirExercice(bloc, critere, e.id)">
                      <app-pastille-phase [phase]="e.phase" [numero]="e.numero" [intitule]="e.intitule" />
                      <span class="intitule-exo">{{ e.intitule }}</span>
                      @if (e.critereReussite) { <span class="secondaire">Réussite : {{ e.critereReussite }}</span> }
                    </button>
                    @if (e.deroulement) {
                      <details class="deroulement"><summary>Déroulement</summary><p>{{ e.deroulement }}</p></details>
                    }
                    @if (e.aSchema) {
                      <button type="button" class="lien-historique" [attr.aria-expanded]="schemasOuverts().has(e.id)"
                              (click)="basculerSchema(e.id)">
                        {{ schemasOuverts().has(e.id) ? 'Masquer le schéma' : 'Voir le schéma' }}
                      </button>
                      @if (schemasOuverts().has(e.id)) {
                        <app-schema-exercice [exerciceId]="e.id" [libelle]="e.numero + ' ' + e.intitule" />
                      }
                    }
                  </li>
                }
              </ul>
            }
          }
          @let libres = exercicesLibresDuCritere(critere, true);
          @if (libres.length > 0) {
            <h3 class="titre-phase">Exercices libres du programme</h3>
            <ul class="liste-exercices">
              @for (e of libres; track e.intitule) {
                <li>
                  @if (e.phase) {
                    <button type="button" class="choix-exo" [class.actif]="libreChoisi(bloc, critere)?.intitule === e.intitule"
                            [attr.aria-pressed]="libreChoisi(bloc, critere)?.intitule === e.intitule"
                            (click)="choisirExercice(bloc, critere, e.intitule)">
                      <app-pastille-phase [phase]="e.phase" [intitule]="'exercice libre : ' + e.intitule" />
                      <span class="intitule-exo">{{ e.intitule }}</span>
                      @if (e.consignes) { <span class="secondaire">{{ e.consignes }}</span> }
                      @if (e.critereReussite) { <span class="secondaire">Réussite : {{ e.critereReussite }}</span> }
                    </button>
                  } @else {
                    <p class="secondaire">
                      « {{ e.intitule }} » n'a pas de phase : donnez-lui une phase (initiation, perfectionnement ou
                      maîtrise) dans le programme de la séance pour noter dessus.
                    </p>
                  }
                </li>
              }
            </ul>
          }
          <div class="actions-dialogue">
            @if (suiviActif(critere).statut === 'ACQUIS') {
              <button type="button" class="bouton-discret" (click)="choisirExercice(bloc, critere, null)">Noter sans exercice</button>
            } @else {
              <button type="button" class="bouton-discret" (click)="fermerChoixExercice()">Annuler</button>
            }
          </div>
        }
      </app-dialogue>
    } @else if (erreurChargement()) {
      <div class="carte vide">
        <p>Cette grille n'est pas disponible hors ligne.</p>
        <p class="secondaire">
          Utilisez « Préparer hors ligne » quand vous avez du réseau pour
          embarquer les grilles de la saison.
        </p>
      </div>
    } @else {
      <p class="vide">Chargement de la grille…</p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  host: {
    '(document:click)': 'fermerMenuSiAilleurs($event)',
    '(document:keydown.escape)': 'menuOuvert.set(false)'
  },
  styles: [`
    .navigation-eleves {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
      gap: var(--pas); margin-bottom: var(--pas);
    }
    .voisins { display: flex; align-items: center; gap: var(--pas); flex-wrap: wrap; }
    .voisins a {
      display: inline-flex; align-items: center; text-decoration: none; color: var(--profond); font-weight: 700;
      max-width: 44vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .voisins .rang { font-size: .875rem; }
    .entete { display: flex; gap: var(--pas-3); align-items: center; padding: var(--pas-3); }
    .avatar { flex: none; width: 72px; height: 72px; border-radius: 50%; object-fit: cover; background: var(--fond); }
    .silhouette {
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-titres), sans-serif; font-size: 1.5rem; font-weight: 700; color: var(--craie);
    }
    .jauge { width: 64px; height: 168px; flex: none; }
    .jauge rect:nth-child(2) { transition: height .35s ease-out; }
    /* min-width: 0 : sans cela, un e-mail long empêche le résumé de
       rétrécir et le fait déborder de la carte sur téléphone. */
    .resume { flex: 1; min-width: 0; }
    .resume h1 { margin-bottom: 2px; }
    .score { margin: var(--pas) 0 0; font-weight: 700; }
    /* position: relative : sur téléphone, le menu « Plus d'actions » prend la largeur de cette rangée (styles.css). */
    .actions-entete { position: relative; display: flex; flex-wrap: wrap; gap: var(--pas); margin-top: var(--pas-2); }
    .lien-matrice { display: inline-flex; align-items: center; text-decoration: none; font-weight: 700; }
    @media (min-width: 601px) { .actions-entete .menu-actions-liste { left: auto; right: 0; } }
    @media (max-width: 600px) { .actions-entete .menu-actions { position: static; } }
    .saisons-precedentes { list-style: none; margin: var(--pas) 0 0; padding: 0; display: grid; gap: 4px; }
    .saisons-precedentes a { display: flex; align-items: center; min-height: 44px; }
    .infos-supplementaires {
      margin: var(--pas) 0 0; display: grid; grid-template-columns: auto 1fr; gap: 4px var(--pas);
      font-size: .875rem;
    }
    .infos-supplementaires dt { font-weight: 700; color: var(--craie); }
    .infos-supplementaires dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
    .infos-supplementaires .caci-expire { color: var(--en-cours); }
    .infos-supplementaires label { margin: 0; font-weight: 700; }
    .infos-supplementaires input { margin: 0; max-width: 200px; }
    .champ-taille { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }

    .barre-seance {
      display: flex; align-items: center; gap: var(--pas-2);
      margin: var(--pas-3) 0 var(--pas-2);
    }
    .barre-seance label { font-weight: 700; white-space: nowrap; }

    /* Dans la barre, le bouton partage la ligne avec son libellé. */
    .barre-seance .choix-seance { flex: 1; width: auto; }
    .noter-pour { margin-top: 0; }
    .noter-pour select { flex: 1; width: auto; min-height: 44px; margin: 0; }
    .sans-seance { display: block; margin: var(--pas-2) auto 0; }

    .bloc { margin-top: var(--pas-3); padding: var(--pas-3); }
    .bloc header {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: var(--pas-2); flex-wrap: wrap;
    }
    .bloc.ouvert header { margin-bottom: var(--pas-2); }
    /* Tout le titre du bloc est la cible tactile qui l'ouvre ou le referme. */
    .titre-bloc { flex: 1 1 260px; margin: 0; font-size: 1.0625rem; }
    .bascule-bloc {
      display: flex; align-items: flex-start; gap: var(--pas); width: 100%; min-height: 44px;
      padding: 0; background: none; border: none; text-align: left; color: inherit; cursor: pointer;
      font: inherit;
    }
    .texte-bloc { display: flex; flex-direction: column; gap: 2px; }
    .detail { font-family: var(--font-texte); font-size: .875rem; font-weight: 400; }
    .chevron { flex: none; width: 1em; color: var(--profond); font-size: 1.125rem; line-height: 1.5; }
    .titre-groupe {
      margin: var(--pas-3) 0 var(--pas); padding-bottom: 4px;
      border-bottom: 2px solid var(--profond); color: var(--profond);
      font-size: 1rem; text-transform: uppercase; letter-spacing: .02em;
    }
    .bloc header h3 { font-size: 1.0625rem; }
    .valide { margin: 0; color: var(--acquis); font-weight: 700; font-size: .9375rem; }

    /* Progression suivie : période du mois de la séance choisie (ou du jour) et retard. */
    .programme { margin-top: var(--pas-3); padding: var(--pas-2) var(--pas-3); display: flex; flex-direction: column; gap: var(--pas); align-items: flex-start; }
    .programme .periode { margin: 0; }
    .etiquette-programme {
      display: inline-block; margin-right: 6px; padding: 0 8px; border-radius: var(--r-s);
      background: var(--profond); color: #fff; font-size: .8125rem; font-weight: 700;
    }
    .note-periode summary { padding: 12px 0; line-height: 20px; color: var(--profond); font-weight: 700; cursor: pointer; }
    .note-periode p { margin: 0; font-size: .9375rem; }
    .retard-resume { margin: 0; color: var(--en-cours); font-weight: 700; }
    .pastilles { display: flex; gap: 4px; flex-wrap: wrap; }
    .pastille {
      padding: 0 8px; border-radius: var(--r-s); font-family: var(--font-texte);
      font-size: .75rem; font-weight: 700; line-height: 1.5;
    }
    .pastille.au-programme { border: 1px solid var(--profond); color: var(--profond); }
    .pastille.exercice { background: var(--profond); border: 1px solid var(--profond); color: #fff; }
    /* Programme d'exercices de la séance choisie : ce qui a été travaillé, critère par critère. */
    .exercices-seance ol { margin: 0; padding-left: 1.5rem; display: grid; gap: 4px; font-size: .9375rem; }
    .exercices-seance .consignes { display: block; white-space: pre-line; }
    /* Sous chaque exercice, ses critères à noter : toute la largeur de la carte, en retrait léger. */
    .exercices-seance ol { align-self: stretch; }
    .criteres-exercice {
      margin-top: var(--pas); padding-left: var(--pas-2); border-left: 3px solid var(--accent-clair);
    }
    .criteres-exercice > li:first-child { border-top: none; }
    .competence-du-critere { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .competence-du-critere .secondaire { font-size: .75rem; text-transform: uppercase; letter-spacing: .02em; }
    /* État de la compétence (mêmes mots que la synthèse A / ECA / NT). */
    .pastille.etat-competence { border: 1px solid var(--trait); color: var(--craie); background: var(--carte); }
    .pastille.etat-competence.etat-ECA { background: var(--en-cours-clair); border-color: var(--en-cours); color: var(--en-cours); }
    .pastille.etat-competence.etat-A { background: var(--acquis-clair); border-color: var(--acquis); color: var(--acquis); }
    .etat-critere { font-size: .8125rem; font-weight: 700; color: var(--en-cours); }
    .etat-critere.acquis { color: var(--acquis); }
    .exercice-critere {
      align-self: flex-start; padding: 0 8px; border-radius: var(--r-s);
      background: var(--profond); color: #fff; font-size: .75rem; font-weight: 700;
    }
    .pastille.en-retard { background: var(--en-cours-clair); border: 1px solid var(--en-cours); color: var(--en-cours); }

    /* Base d'exercices : l'exercice réalisé s'applique aux notes de la compétence. */
    .aide-exercice { margin: 0 0 var(--pas); font-size: .8125rem; }
    /* Colonne de saisie d'un critère : l'exercice, puis les trois états. */
    .saisie { display: flex; flex-direction: column; align-items: stretch; gap: var(--pas); flex: 0 1 380px; min-width: 0; }
    .choix-exercice { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
    .choix-exercice .choix-seance.a-choisir { border: 2px dashed var(--accent); }
    .choix-exercice .titre-choix { font-weight: 700; font-size: .875rem; }
    .choix-exercice .choix-seance { display: flex; align-items: center; gap: var(--pas); width: 100%; max-width: 520px; }
    .choix-exercice .secondaire { font-size: .8125rem; }
    .exercice-note { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .etat-exercice { font-size: .8125rem; font-weight: 700; color: var(--en-cours); }
    .etat-exercice.acquis { color: var(--acquis); }
    .critere-reste { font-size: .8125rem; color: var(--craie); }
    .titre-phase { margin: var(--pas-2) 0 var(--pas); font-size: 1rem; color: var(--profond); }
    .liste-exercices { display: grid; gap: var(--pas); }
    .liste-exercices li { border: none; padding: 0; }
    .choix-exo {
      display: flex; flex-direction: column; align-items: flex-start; gap: 4px; width: 100%; min-height: 44px;
      padding: var(--pas) var(--pas-2); text-align: left; border: 1px solid var(--trait); border-radius: var(--r-s);
      background: var(--carte); color: var(--encre); font: inherit; cursor: pointer;
    }
    .choix-exo.actif { border: 2px solid var(--profond); background: #EEF6F8; }
    .intitule-exo { font-weight: 700; }
    .deroulement summary { padding: 12px var(--pas-2); line-height: 20px; color: var(--profond); font-size: .875rem; cursor: pointer; }
    .deroulement p { margin: 0; padding: 0 var(--pas-2) var(--pas); font-size: .875rem; }

    /* Textes du MFT (révisions post-PE20) : la compétence attendue reste visible,
       le reste se déplie à la demande pour ne pas repousser les critères. */
    .competence-attendue { margin: 0 0 var(--pas-2); max-width: 70ch; font-size: .9375rem; }
    .complements { display: flex; flex-direction: column; gap: 4px; margin-bottom: var(--pas-2); }
    .complements details { border: 1px solid var(--trait); border-radius: var(--r-s); background: var(--fond); }
    .complements summary {
      /* list-item garde le triangle natif ; 12 + 20 + 12 = 44 px de cible tactile. */
      display: list-item; padding: 12px var(--pas-2); line-height: 20px;
      color: var(--profond); font-weight: 700; font-size: .9375rem; cursor: pointer;
    }
    .complements details p { margin: 0; padding: 0 var(--pas-2) var(--pas-2); max-width: 70ch; font-size: .875rem; }

    ul { list-style: none; margin: 0; padding: 0; }
    li { padding: var(--pas-2) 0; border-top: 1px solid var(--trait); }
    .ligne {
      display: flex; justify-content: space-between; align-items: center; gap: var(--pas-2);
    }
    .libelle { display: flex; flex-direction: column; gap: 2px; max-width: 62ch; }
    .trace { font-style: italic; }
    .attente { color: var(--en-cours); font-size: .875rem; font-weight: 700; }
    .enregistrement {
      display: inline-flex; align-items: center; gap: 6px;
      color: var(--profond); font-size: .875rem; font-weight: 700;
    }
    .chargeur {
      display: inline-block; flex: none; width: 1em; height: 1em; margin-right: 6px; vertical-align: -2px;
      border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%;
      animation: tourner .8s linear infinite;
    }
    .enregistrement .chargeur { margin-right: 0; }
    @keyframes tourner { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .chargeur { animation-duration: 2.4s; } }

    .etats { display: flex; gap: 4px; flex: none; justify-content: flex-end; }
    .legende-etats {
      display: flex; flex-wrap: wrap; gap: 4px var(--pas-2); margin: 0 0 var(--pas-2);
      font-size: .8125rem; color: var(--craie);
    }
    .legende-etats strong { color: var(--encre); }
    .etat {
      min-height: 44px; min-width: 60px; padding: 0 12px;
      border: 1px solid var(--trait); background: var(--carte); color: var(--craie);
    }
    .etat:disabled { opacity: .5; cursor: not-allowed; }
    .etat.actif { font-weight: 700; }
    .etat.encours.actif { background: var(--en-cours-clair); border-color: var(--en-cours); color: var(--en-cours); }
    .etat.acquis.actif  { background: var(--acquis-clair);  border-color: var(--acquis);  color: var(--acquis); }
    .etat.neant.actif   { background: #EEF2F4; border-color: var(--craie); color: var(--encre); }
    /* Le pointillé dit « enregistré ici, pas encore chez le serveur ». */
    .etat.differe { border-style: dashed; }

    .liens-critere { display: flex; gap: var(--pas-3); flex-wrap: wrap; }
    .lien-historique {
      padding: 0; min-height: 44px; background: none; border: none;
      color: var(--profond); font-size: .8125rem; text-decoration: underline;
    }
    .dernier-commentaire { font-size: .875rem; color: var(--encre); font-style: italic; }
    /* N2/N3 : l'autre suivi (milieu naturel ou piscine / fosse), rappelé sous le critère. */
    .autre-suivi { font-size: .8125rem; color: var(--craie); }
    .autre-suivi.acquis { color: var(--acquis); }
    .alerte.entrainement { background: #E0F2FE; border-left-color: var(--profond); }
    .etiquette-entrainement { color: var(--profond); font-weight: 700; }

    .historique {
      margin-top: var(--pas); padding: var(--pas-2); border-radius: var(--r-s);
      background: var(--fond); display: flex; flex-direction: column; gap: var(--pas);
    }
    .entree-historique { font-size: .875rem; }
    .entree-historique p { margin: 2px 0 0; max-width: none; }
    .ajout-commentaire {
      display: flex; flex-direction: column; gap: var(--pas);
      margin-top: var(--pas); padding: var(--pas-2); border-radius: var(--r-s); background: var(--fond);
    }
    .ajout-commentaire label { margin: 0; }
    .ajout-commentaire textarea { resize: vertical; }
    .ajout-commentaire button { align-self: flex-start; width: auto; }

    @media (max-width: 720px) {
      .entete { flex-direction: row; padding: var(--pas-2); }
      .ligne { flex-direction: column; align-items: stretch; }
      .saisie { flex: none; }
      .etats { justify-content: stretch; }
      .etat { flex: 1; }
      .barre-seance { flex-direction: column; align-items: stretch; }
      .choix-seance { max-width: none; }
      /* Libellé au-dessus de la valeur : les deux colonnes ne tiennent pas. */
      .infos-supplementaires { grid-template-columns: 1fr; gap: 0; }
      .infos-supplementaires dd + dt { margin-top: var(--pas); }
    }

    /* Sous 400px (iPhone SE et similaires), l'avatar + la jauge fixes
       laissaient trop peu de place au nom et au score. */
    @media (max-width: 400px) {
      .entete { flex-wrap: wrap; }
      .avatar { width: 56px; height: 56px; }
      .jauge { width: 40px; height: 120px; }
      .resume { flex: 1 1 100%; }
    }
  `]
})
export class GrilleComponent implements OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private file = inject(FileAttenteService);
  private ecritures = inject(FileEcrituresService);
  reseau = inject(ReseauService);

  id = input.required<string>();
  /** Séance à choisir d'emblée, tirée de l'adresse (?seance=12). */
  seance = input<string>();
  /** Page d'où vient le moniteur (?depuis=presences) : propose d'y revenir sur la même séance. */
  depuis = input<string>();
  /** Groupe filtré sur la feuille de présence (?groupe=3), rendu au retour. */
  groupe = input<string>();

  /**
   * Venu de la feuille de présence : ses présents (dans le groupe filtré),
   * dans l'ordre de la feuille, pour passer à l'élève précédent ou suivant.
   */
  presentsFeuille = signal<{ cursusId: number; eleve: string }[]>([]);
  voisins = computed(() => {
    const liste = this.presentsFeuille();
    const i = liste.findIndex(l => l.cursusId === Number(this.id()));
    if (i < 0 || liste.length < 2) return null;
    return { precedent: liste[i - 1] ?? null, suivant: liste[i + 1] ?? null, rang: i + 1, total: liste.length };
  });

  /** Menu « Plus d'actions » de l'en-tête : PDF, saisons précédentes, informations supplémentaires. */
  menuOuvert = signal(false);

  /** Un toucher hors du menu le referme. */
  fermerMenuSiAilleurs(evenement: Event): void {
    if (!(evenement.target as Element | null)?.closest?.('.menu-actions')) this.menuOuvert.set(false);
  }

  grille = signal<GrilleVue | null>(null);
  seances = signal<SeanceVue[]>([]);
  seanceId = signal<number | null>(null);
  message = signal<string | null>(null);
  erreurChargement = signal(false);
  ageDuCache = signal<string | null>(null);
  urlPhoto = signal<string | null>(null);
  exportEnCours = signal(false);
  /** Fenêtre « Exporter en PDF » ouverte depuis « Plus d'actions », et son refus éventuel. */
  pdfOuvert = signal(false);
  erreurPdf = signal<string | null>(null);
  /** Critères en cours d'enregistrement : `cle(critère, entraînement)` → saisie envoyée. */
  enregistrements = signal<Map<string, EnVol>>(new Map());
  validationEnCours = signal<number | null>(null);

  /**
   * Historiques dépliés, par affichage du critère (`lieu:critereId`) : un même
   * critère paraît sous sa compétence et sous les exercices de la séance.
   * Les entrées chargées, elles, restent tenues par critereId.
   */
  historiqueOuverts = signal<Set<string>>(new Set());

  /** Blocs dépliés : tous repliés à l'ouverture de la fiche, pour la parcourir d'un coup d'œil. */
  blocsOuverts = signal<Set<number>>(new Set());

  basculerBloc(blocId: number): void {
    const ouverts = new Set(this.blocsOuverts());
    if (ouverts.has(blocId)) ouverts.delete(blocId);
    else ouverts.add(blocId);
    this.blocsOuverts.set(ouverts);
  }

  /** Un seul bouton : referme tout dès qu'un bloc est ouvert, sinon ouvre tout. */
  basculerTousLesBlocs(blocs: { id: number }[]): void {
    this.blocsOuverts.set(this.blocsOuverts().size > 0 ? new Set() : new Set(blocs.map(b => b.id)));
  }
  chargementHistorique = signal<Set<number>>(new Set());
  historiques = signal<Record<number, EvaluationVue[]>>({});
  brouillons = signal<Record<number, string>>({});
  /** Zones « Commenter » dépliées (`lieu:critereId`), indépendamment de l'historique. */
  commentairesOuverts = signal<Set<string>>(new Set());

  basculerCommentaire(cleUi: string): void {
    const ouverts = new Set(this.commentairesOuverts());
    if (ouverts.has(cleUi)) ouverts.delete(cleUi);
    else ouverts.add(cleUi);
    this.commentairesOuverts.set(ouverts);
  }

  /** Cursus des saisons précédentes du même élève, pour reprendre l'évaluation initiale. */
  historiqueSaisonsOuvert = signal(false);
  chargementHistoriqueSaisons = signal(false);
  historiqueSaisons = signal<CursusVue[]>([]);

  /** E-mail, téléphone, contact d'urgence : masqués par défaut, hors du premier coup d'œil. */
  infosSupplementairesOuvertes = signal(false);

  /** Tailles de gilet et de combinaison en cours de modification ; null : simple affichage. */
  tailles = signal<{ tailleGilet: string; tailleCombinaison: string } | null>(null);
  enregistrementTailles = signal(false);
  peutModifierTailles = computed(() => this.auth.estMoniteur() || this.auth.estAdmin());

  /** Demande le réseau : pas de file hors ligne pour le dossier de l'élève. */
  ouvrirTailles(tailleGilet: string | null, tailleCombinaison: string | null): void {
    this.message.set(null);
    this.tailles.set({ tailleGilet: tailleGilet ?? '', tailleCombinaison: tailleCombinaison ?? '' });
  }

  enregistrerTailles(eleveId: number): void {
    const t = this.tailles();
    if (!t) return;
    this.enregistrementTailles.set(true);
    this.message.set(null);
    this.api.modifierTaillesEleve(eleveId, {
      tailleGilet: t.tailleGilet.trim() || null, tailleCombinaison: t.tailleCombinaison.trim() || null
    }).subscribe({
      next: async () => {
        this.tailles.set(null);
        await this.charger();
        this.enregistrementTailles.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.enregistrementTailles.set(false);
        this.message.set(e.error?.detail ?? "Les tailles n'ont pas pu être enregistrées.");
      }
    });
  }

  /**
   * `court` : le texte des boutons, trop longs en toutes lettres sur téléphone
   * (choix du club, 2026) ; la légende en haut de la fiche les explique, et
   * `libelle` reste le nom lu par les lecteurs d'écran et la bulle au survol.
   */
  readonly etats = [
    { valeur: 'NON_ABORDE' as Statut, libelle: 'Non abordé', court: 'NA',  classe: 'neant' },
    { valeur: 'EN_COURS'   as Statut, libelle: 'En cours',   court: 'ECA', classe: 'encours' },
    { valeur: 'ACQUIS'     as Statut, libelle: 'Acquis',     court: 'A',   classe: 'acquis' }
  ];

  /**
   * Superpose les saisies en attente à la grille venue du serveur. Le moniteur
   * voit son geste immédiatement, qu'il y ait du réseau ou non, sans qu'on
   * fasse croire que le serveur l'a accepté.
   */
  grilleAffichee = computed<(Omit<GrilleVue, 'blocs'> & { blocs: BlocAffiche[] }) | null>(() => {
    const g = this.grille();
    if (!g) return null;

    const attentes = new Map(this.file.pourCursus(Number(this.id()))
      .map(s => [cle(s.critereId, this.estEntrainement(s.seanceId)), s]));
    const enregistrements = this.enregistrements();

    const suivi = (base: Omit<SuiviAffiche, 'enAttente' | 'enregistrement'>, critereId: number,
                   entrainement: boolean, critereAMaitrise: boolean): SuiviAffiche => {
      const enCours = enregistrements.get(cle(critereId, entrainement));
      const differee = attentes.get(cle(critereId, entrainement));
      // Pendant l'envoi puis le rechargement, on garde le statut choisi :
      // sinon l'ancien réapparaîtrait entre la fin de l'envoi et la grille à jour.
      // Le statut saisi est celui de l'exercice ; le critère en découle (même règle que le serveur).
      if (enCours) {
        return { ...base, exercice: enCours.exercice, enAttente: false, enregistrement: true,
                 statut: statutDuCritere(enCours.statut, base.statut, enCours.exercice, critereAMaitrise),
                 statutExercice: enCours.exercice ? enCours.statut : null };
      }
      if (!differee) return { ...base, enAttente: false, enregistrement: false };
      const exercice = this.exerciceDeLaFile(differee);
      return { ...base, enAttente: true, enregistrement: false, le: differee.dateEvaluation, exercice,
               statut: statutDuCritere(differee.statut, base.statut, exercice, critereAMaitrise),
               statutExercice: exercice ? differee.statut : null };
    };

    let acquisTotal = 0;
    const blocs: BlocAffiche[] = g.blocs.map(bloc => {
      const criteres: CritereAffiche[] = bloc.criteres.map(({ entrainement, exercice, statutExercice, ...c }) => {
        const aMaitrise = this.exercicesDuCritere(bloc, c).some(e => e.phase === 'MAITRISE');
        return {
          ...c,
          ...suivi({ ...c, exercice: exercice ?? null, statutExercice: statutExercice ?? null }, c.id, false, aMaitrise),
          entr: suivi(entrainement
            ? { ...entrainement, exercice: entrainement.exercice ?? null,
                statutExercice: entrainement.statutExercice ?? null }
            : { statut: 'NON_ABORDE', parQui: null, le: null, commentaire: null, exercice: null, statutExercice: null },
            c.id, true, aMaitrise)
        };
      });
      const acquis = criteres.filter(c => c.statut === 'ACQUIS').length;
      acquisTotal += acquis;
      return {
        ...bloc,
        criteres,
        acquis,
        acquisEntrainement: criteres.filter(c => c.entr.statut === 'ACQUIS').length,
        // Une saisie en cours d'envoi compte comme en attente : pas de validation du bloc avant.
        attentes: criteres.filter(c => c.enAttente || c.enregistrement).length
      };
    });

    return { ...g, blocs, criteresAcquis: acquisTotal };
  });

  /**
   * Le backend livre deja les blocs groupes par regroupement (etiquette
   * "Commun"/"PA20"/"PE40"...) : on se contente ici de les repartir en
   * sections pour l'affichage, dans le meme ordre stable.
   */
  groupesAffiches = computed(() => {
    const g = this.grilleAffichee();
    if (!g) return [];
    const parRegroupement = new Map<string | null, BlocAffiche[]>();
    for (const bloc of g.blocs) {
      if (!parRegroupement.has(bloc.regroupement)) parRegroupement.set(bloc.regroupement, []);
      parRegroupement.get(bloc.regroupement)!.push(bloc);
    }
    return [...parRegroupement.entries()].map(([regroupement, blocs]) => ({ regroupement, blocs }));
  });

  progression = computed(() => {
    const g = this.grilleAffichee();
    return g && g.criteresTotal > 0 ? g.criteresAcquis / g.criteresTotal : 0;
  });

  peutSaisir = computed(() => {
    const g = this.grille();
    return !!g && g.statut === 'EN_COURS' && this.auth.peutValider(g.niveauEncadrantValidation);
  });

  peutVoirHistoriqueSaisons = computed(() => this.auth.estMoniteur() || this.auth.estAdmin());

  /**
   * Référent du groupe de l'élève : il peut noter au nom d'un encadrant qui
   * ne l'a pas fait (choix du club, 2026). Le serveur revérifie toujours.
   */
  estReferent = computed(() => {
    const moi = this.auth.session()?.id;
    return moi != null && (this.grille()?.referentIds ?? []).includes(moi);
  });
  moniteurs = signal<MoniteurOptionVue[]>([]);
  /** Encadrant au nom duquel le référent note ; null : à son propre nom. */
  pourMoniteurId = signal<number | null>(null);

  /** Les autres encadrants qui ont le niveau pour noter ce brevet. */
  moniteursRemplacables = computed(() => {
    const g = this.grille();
    const moi = this.auth.session()?.id;
    if (!g) return [];
    const ordre = ['E1', 'E2', 'E3', 'E4'];
    return this.moniteurs().filter(m => m.id !== moi && m.niveauEncadrement != null
      && ordre.indexOf(m.niveauEncadrement) >= ordre.indexOf(g.niveauEncadrantValidation));
  });

  nomPourMoniteur = computed(() =>
    this.moniteurs().find(m => m.id === this.pourMoniteurId())?.nomComplet ?? null);

  /**
   * Séances sur lesquelles on peut noter : déjà passées (ou du jour) — le
   * serveur refuse une séance à venir — et où l'élève est noté présent.
   * Pour un N2/N3, celles en piscine ou fosse notent l'entraînement.
   */
  seancesUtilisables = computed(() => {
    if (!this.grille()) return [];
    const aujourdhui = dateDuJour();
    return this.seances()
      .filter(s => s.date <= aujourdhui)
      .filter(s => this.estPresent(s.id));
  });

  /**
   * N2/N3 : une note prise sur une séance en piscine ou en fosse va au suivi
   * d'entraînement, à part de l'évaluation en milieu naturel (même règle que
   * le serveur, `EvaluationService.estEntrainement`).
   */
  estEntrainement(seanceId: number | null): boolean {
    if (!this.grille()?.milieuNaturelExclusif || seanceId === null) return false;
    const milieu = this.seances().find(s => s.id === seanceId)?.milieu;
    return !!milieu && milieu !== 'NATUREL';
  }

  /** Séance choisie en piscine ou fosse pour un N2/N3 : les boutons notent l'entraînement. */
  modeEntrainement = computed(() => this.estEntrainement(this.seanceId()));

  /**
   * Présent selon le serveur, recouvert par les présences saisies sur cet
   * appareil et pas encore parties (elles partent avant les notes). Une grille
   * mise en cache avant cette règle ne connaît pas les présences : on laisse
   * alors le serveur juger.
   */
  private estPresent(seanceId: number): boolean {
    const g = this.grille();
    if (!g?.seancesPresent) return true;
    const cursusId = Number(this.id());
    const enAttente = this.ecritures.pourSeance(seanceId, 'presence').find(p => p.cursusId === cursusId);
    if (enAttente) return enAttente.statut === 'PRESENT';
    return g.seancesPresent.includes(seanceId);
  }

  seanceChoisie = computed(() => this.seances().find(s => s.id === this.seanceId()) ?? null);

  /**
   * Période de la progression suivie qui couvre le mois de la séance choisie,
   * ou du jour sans séance. `periodes` peut manquer dans une grille mise en
   * cache avant l'arrivée des progressions.
   */
  periodeEnCours = computed(() => {
    const g = this.grille();
    return g ? periodeDuMois(g.periodes ?? [], this.seanceChoisie()?.date ?? this.aujourdhui) : null;
  });
  blocsAuProgramme = computed(() => new Set(this.periodeEnCours()?.blocIds ?? []));
  nombreEnRetard = computed(() => this.grille()?.blocs.filter(b => b.enRetard).length ?? 0);
  readonly plage = plageMois;

  /**
   * Exercices préparés pour la séance choisie par le groupe de l'élève et
   * dans le programme commun (tri fait par le serveur), pour sa formation et
   * les exercices communs. `programmes` peut manquer dans une grille mise
   * en cache avant leur arrivée.
   */
  exercicesSeance = computed(() => {
    const seanceId = this.seanceId();
    return this.grille()?.programmes?.find(p => p.seanceId === seanceId)?.exercices ?? [];
  });

  /** Critère → intitulé(s) des exercices de la séance qui le travaillent. */
  critereExercices = computed(() => {
    const parCritere = new Map<number, string>();
    for (const e of this.exercicesSeance()) {
      for (const id of e.critereIds) {
        const deja = parCritere.get(id);
        parCritere.set(id, deja ? `${deja}, ${e.intitule}` : e.intitule);
      }
    }
    return parCritere;
  });

  // ----------------------------------------------------------------
  //  Base d'exercices : l'exercice réalisé, choisi critère par critère.
  // ----------------------------------------------------------------

  readonly phases = PHASES;
  /**
   * Choix explicites du moniteur pour la séance en cours : critereId →
   * exercice de la base (son id), exercice libre du programme (son
   * intitulé), ou null : sans exercice.
   */
  exercicesChoisis = signal<Record<number, number | string | null>>({});
  /** Critère dont le dialogue de choix d'exercice est ouvert. */
  choixExercice = signal<{ bloc: BlocAffiche; critere: CritereAffiche } | null>(null);
  erreurChoixExercice = signal<string | null>(null);
  /** Note retenue en attendant le choix d'un exercice de maîtrise, rejouée une fois l'exercice choisi. */
  private noteEnSuspens: { critere: CritereAffiche; statut: Statut } | null = null;

  /** Exercices actifs de la base qui travaillent ce critère. */
  exercicesDuCritere(bloc: BlocVue | BlocAffiche, critere: { id: number }): ExerciceBaseVue[] {
    return (bloc.exercices ?? []).filter(e => (e.critereIds ?? []).includes(critere.id));
  }

  /**
   * Exercice appliqué aux notes d'un critère : le choix du moniteur, sinon
   * l'exercice de la base le plus avancé que le programme de la séance
   * prévoit pour ce critère.
   */
  exerciceChoisi(bloc: BlocVue | BlocAffiche, critere: { id: number }): ExerciceBaseVue | null {
    const exercices = this.exercicesDuCritere(bloc, critere);
    const choix = this.exercicesChoisis();
    if (critere.id in choix) return exercices.find(e => e.id === choix[critere.id]) ?? null;
    const prevus = new Set(this.exercicesSeance().map(e => e.exerciceBase?.id).filter(id => id != null));
    const rang = (e: ExerciceBaseVue) => PHASES.findIndex(p => p.valeur === e.phase);
    return exercices.filter(e => prevus.has(e.id)).sort((a, b) => rang(b) - rang(a))[0] ?? null;
  }

  /**
   * Exercices libres du programme de la séance choisie qui travaillent ce
   * critère (choix du club, 2026 : ils servent aussi à noter). Seuls ceux
   * qui ont une phase se notent ; `avecSansPhase` garde les autres pour le
   * signaler dans le choix.
   */
  exercicesLibresDuCritere(critere: { id: number }, avecSansPhase = false): ExerciceGrilleVue[] {
    const vus = new Set<string>();
    return this.exercicesSeance().filter(e => !e.exerciceBase && (avecSansPhase || e.phase)
        && e.critereIds.includes(critere.id))
      .filter(e => !vus.has(e.intitule) && !!vus.add(e.intitule));
  }

  aDesExercices(bloc: BlocAffiche, critere: CritereAffiche): boolean {
    return this.exercicesDuCritere(bloc, critere).length > 0 || this.exercicesLibresDuCritere(critere, true).length > 0;
  }

  /**
   * Exercice libre appliqué aux notes d'un critère : le choix du moniteur,
   * sinon, faute d'exercice de la base prévu, l'exercice libre le plus
   * avancé que le programme prévoit pour ce critère.
   */
  libreChoisi(bloc: BlocVue | BlocAffiche, critere: { id: number }): ExerciceGrilleVue | null {
    const libres = this.exercicesLibresDuCritere(critere);
    const choix = this.exercicesChoisis();
    if (critere.id in choix) {
      const choisi = choix[critere.id];
      return typeof choisi === 'string' ? libres.find(e => e.intitule === choisi) ?? null : null;
    }
    if (this.exerciceChoisi(bloc, critere)) return null;
    const rang = (e: ExerciceGrilleVue) => PHASES.findIndex(p => p.valeur === e.phase);
    return [...libres].sort((a, b) => rang(b) - rang(a))[0] ?? null;
  }

  /** L'exercice, de la base ou libre, sur lequel la prochaine note portera. */
  exerciceNote(bloc: BlocVue | BlocAffiche, critere: { id: number }): ExerciceNoteVue | null {
    const base = this.exerciceChoisi(bloc, critere);
    if (base) return { id: base.id, numero: base.numero, intitule: base.intitule, phase: base.phase, blocId: base.blocId, critereIds: null };
    const libre = this.libreChoisi(bloc, critere);
    return libre?.phase ? { id: null, numero: null, intitule: libre.intitule, phase: libre.phase, blocId: null, critereIds: null } : null;
  }

  /**
   * Schémas dépliés : chargés seulement à la demande. Clé : l'id de
   * l'exercice de la base, ou l'opposé de l'id du schéma d'un exercice libre.
   */
  schemasOuverts = signal<Set<number>>(new Set());

  cleSchema(e: ExerciceGrilleVue): number {
    return e.exerciceBase ? e.exerciceBase.id : -(e.schemaId ?? 0);
  }

  basculerSchema(exerciceId: number): void {
    const ouverts = new Set(this.schemasOuverts());
    if (ouverts.has(exerciceId)) ouverts.delete(exerciceId); else ouverts.add(exerciceId);
    this.schemasOuverts.set(ouverts);
  }

  exercicesDeLaPhase(bloc: BlocAffiche, critere: CritereAffiche, phase: string): ExerciceBaseVue[] {
    return this.exercicesDuCritere(bloc, critere).filter(e => e.phase === phase);
  }

  ouvrirChoixExercice(bloc: BlocAffiche, critere: CritereAffiche, erreur: string | null = null): void {
    this.erreurChoixExercice.set(erreur);
    this.choixExercice.set({ bloc, critere });
  }

  fermerChoixExercice(): void {
    this.choixExercice.set(null);
    this.erreurChoixExercice.set(null);
    this.noteEnSuspens = null;
  }

  /** `exercice` : id d'un exercice de la base, intitulé d'un exercice libre, ou null. */
  choisirExercice(bloc: BlocAffiche, critere: CritereAffiche, exercice: number | string | null): void {
    this.exercicesChoisis.set({ ...this.exercicesChoisis(), [critere.id]: exercice });
    const enSuspens = this.noteEnSuspens;
    this.fermerChoixExercice();
    if (enSuspens) void this.noter(bloc, enSuspens.critere, enSuspens.statut);
  }

  /**
   * La note porte sur un exercice (choix du club, 2026) : un critère relié à
   * des exercices de la base se note sur l'un d'eux, pour qu'on lise ensuite
   * s'il s'agissait d'une initiation, d'un perfectionnement ou d'une
   * maîtrise. Seul un critère déjà acquis reçoit une note sans exercice
   * (simple commentaire). Le serveur, lui, refuse « acquis » sans exercice
   * de maîtrise (statutDuCritere).
   */
  refusSansExercice(bloc: BlocAffiche, critere: CritereAffiche, statut: Statut): string | null {
    if (!this.aDesExercices(bloc, critere) || this.exerciceNote(bloc, critere)) return null;
    if (this.suiviActif(critere).statut === 'ACQUIS') return null;
    const maitrise = this.exercicesDuCritere(bloc, critere).filter(e => e.phase === 'MAITRISE');
    if (statut === 'ACQUIS' && maitrise.length > 0) {
      const numeros = maitrise.map(e => e.numero).join(', ');
      return `« ${critere.savoirFaire} » ne passe à acquis que sur un exercice de maîtrise (${numeros}) : `
        + 'choisissez l’exercice réalisé.';
    }
    return `Choisissez l’exercice réalisé pour « ${critere.savoirFaire} » : `
      + 'la note dit s’il s’agissait d’une initiation, d’un perfectionnement ou d’une maîtrise.';
  }

  /** Exercice d'une saisie en attente : de la base livrée avec la grille, ou libre (copié dans la saisie). */
  private exerciceDeLaFile(saisie: { exerciceId?: number | null; exerciceLibre?: string | null;
                                     phaseLibre?: PhaseExercice | null }): ExerciceNoteVue | null {
    if (saisie.exerciceId == null) {
      return saisie.exerciceLibre && saisie.phaseLibre
        ? { id: null, numero: null, intitule: saisie.exerciceLibre, phase: saisie.phaseLibre, blocId: null, critereIds: null }
        : null;
    }
    for (const bloc of this.grille()?.blocs ?? []) {
      const e = bloc.exercices?.find(x => x.id === saisie.exerciceId);
      if (e) return { id: e.id, numero: e.numero, intitule: e.intitule, phase: e.phase, blocId: e.blocId, critereIds: null };
    }
    return null;
  }

  /** Champs d'une saisie qui disent sur quel exercice elle porte. */
  private champsExercice(exercice: ExerciceNoteVue | null) {
    return {
      exerciceId: exercice?.id ?? null,
      exerciceLibre: exercice && exercice.id == null ? exercice.intitule : null,
      phaseLibre: exercice && exercice.id == null ? exercice.phase : null
    };
  }

  /**
   * Critères travaillés par un exercice de la séance, avec leur compétence,
   * pour les noter sous l'exercice lui-même. Ceux d'une autre formation (absents
   * de la grille) sont ignorés.
   */
  criteresDeLExercice(e: ExerciceGrilleVue): { bloc: BlocAffiche; critere: CritereAffiche }[] {
    const liste: { bloc: BlocAffiche; critere: CritereAffiche }[] = [];
    for (const id of e.critereIds) {
      for (const bloc of this.grilleAffichee()?.blocs ?? []) {
        const critere = bloc.criteres.find(c => c.id === id);
        if (critere) { liste.push({ bloc, critere }); break; }
      }
    }
    return liste;
  }

  /**
   * Exercice sur lequel porte une note prise sous un exercice de la séance :
   * l'id de l'exercice de la base, ou l'intitulé d'un exercice libre qui a une
   * phase. null quand il ne peut pas servir à noter ce critère (exercice
   * désactivé, exercice libre sans phase) : le choix habituel reste alors proposé.
   */
  exerciceImpose(bloc: BlocAffiche, critere: CritereAffiche, exo: ExerciceGrilleVue | null): number | string | null {
    if (!exo) return null;
    if (exo.exerciceBase) {
      const id = exo.exerciceBase.id;
      return this.exercicesDuCritere(bloc, critere).some(x => x.id === id) ? id : null;
    }
    return this.exercicesLibresDuCritere(critere).some(x => x.intitule === exo.intitule) ? exo.intitule : null;
  }

  /** Sous un exercice de la séance, on note l'exercice : libellés propres. */
  readonly etatsExercice = [
    { valeur: 'NON_ABORDE' as Statut, libelle: 'Non abordé', court: 'NA', classe: 'neant' },
    { valeur: 'EN_COURS'   as Statut, libelle: 'En cours d\'acquisition', court: 'ECA', classe: 'encours' },
    { valeur: 'ACQUIS'     as Statut, libelle: 'Acquis', court: 'A', classe: 'acquis' }
  ];

  /** L'exercice de la séance vu comme l'exercice d'une note : son id dans la base, sinon son intitulé (libre). */
  cibleDeLExercice(exo: ExerciceGrilleVue): ExerciceNoteVue {
    const base = exo.exerciceBase;
    return base
      ? { id: base.id, numero: base.numero, intitule: base.intitule, phase: base.phase, blocId: base.blocId, critereIds: null }
      : { id: null, numero: null, intitule: exo.intitule, phase: exo.phase!, blocId: null, critereIds: null };
  }

  /**
   * État d'un exercice pour un critère : sa dernière note (dans le suivi des
   * boutons, entraînement à part), recouverte par une saisie sur cet exercice
   * en cours d'envoi ou en attente. Jamais l'état du critère.
   */
  etatDeLExercice(critere: CritereAffiche, cible: ExerciceNoteVue): SuiviAffiche {
    const entrainement = this.modeEntrainement();
    const meme = (id: number | null, intitule: string | null) =>
      cible.id != null ? id === cible.id : id == null && intitule === cible.intitule;
    const note = (critere.etatsExercices ?? [])
      .find(x => x.entrainement === entrainement && meme(x.exerciceId, x.exerciceLibre));
    const etat: SuiviAffiche = {
      statut: note?.statut ?? 'NON_ABORDE', parQui: note?.parQui ?? null, le: note?.le ?? null,
      commentaire: note?.commentaire ?? null, exercice: null, statutExercice: null,
      enAttente: false, enregistrement: false
    };
    const actif = this.suiviActif(critere);
    const x = actif.exercice;
    if ((actif.enregistrement || actif.enAttente) && !!x && meme(x.id, x.intitule)) {
      return { ...etat, statut: actif.statutExercice ?? actif.statut, enAttente: actif.enAttente,
               enregistrement: actif.enregistrement, le: actif.enAttente ? actif.le : etat.le };
    }
    return etat;
  }

  /** État de l'exercice sur lequel portera la prochaine note du critère ; null sans exercice (on note le critère). */
  private etatDeLaCible(bloc: BlocAffiche, critere: CritereAffiche): SuiviAffiche | null {
    const cible = this.exerciceNote(bloc, critere);
    return cible ? this.etatDeLExercice(critere, cible) : null;
  }

  /**
   * État de la compétence, mêmes règles que le serveur (EtatCompetence) mais
   * recouvert des notes pas encore envoyées : A validée, ECA dès qu'un critère
   * est noté au-delà de « non abordé » (entraînement compris), NT sinon.
   */
  etatCompetence(bloc: BlocAffiche): EtatCompetence {
    if (bloc.valide) return 'A';
    return bloc.criteres.some(c => c.statut !== 'NON_ABORDE' || c.entr.statut !== 'NON_ABORDE') ? 'ECA' : 'NT';
  }

  libelleCompetence(etat: EtatCompetence): string {
    return etat === 'A' ? 'Compétence acquise'
      : etat === 'ECA' ? 'Compétence en cours d\'acquisition' : 'Compétence non travaillée';
  }

  libelleCritere(statut: Statut): string {
    return statut === 'EN_COURS' ? 'en cours d\'acquisition' : this.libelleStatut(statut).toLowerCase();
  }

  private imposerExercice(bloc: BlocAffiche, critere: CritereAffiche, exo: ExerciceGrilleVue | null): void {
    const impose = this.exerciceImpose(bloc, critere, exo);
    if (impose !== null) this.exercicesChoisis.set({ ...this.exercicesChoisis(), [critere.id]: impose });
  }

  blocsDesExercices = computed(() => {
    const criteres = this.critereExercices();
    return new Set((this.grille()?.blocs ?? [])
      .filter(b => b.criteres.some(c => criteres.has(c.id)))
      .map(b => b.id));
  });

  ouvrirBlocsDesExercices(): void {
    this.blocsOuverts.set(new Set([...this.blocsOuverts(), ...this.blocsDesExercices()]));
  }

  /** Ajoute les blocs au programme aux blocs dépliés, sans refermer les autres. */
  ouvrirBlocsAuProgramme(): void {
    this.blocsOuverts.set(new Set([...this.blocsOuverts(), ...this.blocsAuProgramme()]));
  }

  readonly aujourdhui = dateDuJour();
  private dialogueSeance = viewChild.required<ElementRef<HTMLDialogElement>>('dialogueSeance');
  dialogueSeanceOuvert = signal(false);
  /** Jour touché dans le calendrier du dialogue. */
  jourDialogue = signal<string | null>(null);

  libelleSeance(s: SeanceVue): string {
    const memeJour = this.seances().filter(x => x.date === s.date).length > 1;
    return `${dateFr(s.date)}${memeJour ? ' (séance ' + s.ordre + ')' : ''} — ${lieuEtSite(s) || 'lieu non précisé'}`
      + (s.profondeurMax ? ` (${s.profondeurMax} m)` : '');
  }

  constructor() {
    // Le lien « saisons précédentes » navigue vers une autre grille sur la
    // même route (/cursus/:id) : Angular réutilise alors l'instance du
    // composant, donc le rechargement doit suivre les changements de l'input
    // plutôt que ne s'exécuter qu'une fois au montage.
    let premiereGrille = true;
    effect(() => {
      this.id();
      untracked(() => {
        this.reinitialiser();
        void this.charger(true);
        // Élève suivant ou précédent : même composant, on remonte en haut de sa fiche.
        if (!premiereGrille) window.scrollTo({ top: 0 });
        premiereGrille = false;
      });
    });

    effect(() => {
      const seanceId = Number(this.seance());
      const depuisFeuille = this.depuis() === 'presences';
      const groupe = this.groupe();
      untracked(() => {
        if (depuisFeuille && seanceId) void this.chargerPresentsFeuille(seanceId, groupe);
        else this.presentsFeuille.set([]);
      });
    });

    // Au retour du réseau, la file envoie les notes prises hors ligne et les
    // retire de l'attente : sans rechargement, la grille retomberait sur
    // l'état embarqué avant de partir, comme si la note avait disparu.
    effect(() => {
      if (this.file.derniereSync() === null) return;
      untracked(() => {
        if (this.grille()) void this.charger();
      });
    });
  }

  /**
   * Présents de la feuille, mêmes règles que la feuille elle-même : choix
   * pas encore envoyés compris, filtrés sur le groupe. Facultatif : sans
   * feuille (hors ligne, pas embarquée), pas de navigation entre élèves.
   */
  private async chargerPresentsFeuille(seanceId: number, groupe: string | undefined): Promise<void> {
    try {
      const [feuille, groupes] = await Promise.all([
        this.api.feuillePresence(seanceId),
        this.api.groupesEntrainementSaisonOuverte().catch(() => [] as GroupeEntrainementVue[])
      ]);
      const filtre: FiltreGroupe = groupe === 'SANS' ? 'SANS'
        : groupe && Number.isInteger(Number(groupe)) ? Number(groupe) : 'TOUS';
      const enAttente = new Map(this.ecritures.pourSeance(seanceId, 'presence').map(p => [p.cursusId, p.statut]));
      this.presentsFeuille.set(feuille.eleves
        .filter(l => (enAttente.has(l.cursusId) ? enAttente.get(l.cursusId) : l.statut) === 'PRESENT')
        .filter(l => passeFiltreGroupe(l.eleveId, filtre, groupes))
        .map(l => ({ cursusId: l.cursusId, eleve: l.eleve })));
    } catch {
      this.presentsFeuille.set([]);
    }
  }

  private reinitialiser(): void {
    this.grille.set(null);
    this.seanceId.set(null);
    this.exercicesChoisis.set({});
    this.choixExercice.set(null);
    this.noteEnSuspens = null;
    this.enregistrements.set(new Map());
    this.validationEnCours.set(null);
    this.dialogueSeanceOuvert.set(false);
    this.message.set(null);
    this.erreurChargement.set(false);
    this.ageDuCache.set(null);
    const url = this.urlPhoto();
    if (url) URL.revokeObjectURL(url);
    this.urlPhoto.set(null);
    this.historiqueOuverts.set(new Set());
    this.chargementHistorique.set(new Set());
    this.historiques.set({});
    this.brouillons.set({});
    this.historiqueSaisonsOuvert.set(false);
    this.historiqueSaisons.set([]);
    this.tailles.set(null);
    this.infosSupplementairesOuvertes.set(false);
    this.pdfOuvert.set(false);
    this.chargementHistoriqueSaisons.set(false);
    this.pourMoniteurId.set(null);
  }

  /**
   * `premier` : ouverture de la fiche d'un élève. On y présélectionne sa
   * dernière séance où il est noté présent ; un rechargement (retour du
   * réseau) garde, lui, le choix fait par le moniteur, « aucune séance » compris.
   */
  private async charger(premier = false): Promise<void> {
    try {
      const g = await this.api.grille(Number(this.id()));
      this.grille.set(g);
      this.seances.set(await this.api.seances());
      // Sans présences connues (grille en cache d'avant la règle), toute
      // séance passée semblerait utilisable : pas de présélection.
      if (premier && g.seancesPresent) {
        // Séance demandée par l'adresse (?seance=12, depuis « Infos élèves »), sinon la dernière où il est présent.
        const demandee = this.seance() ? Number(this.seance()) : null;
        const utilisable = this.seancesUtilisables().find(s => s.id === demandee);
        this.seanceId.set(utilisable?.id ?? this.seancesUtilisables().at(-1)?.id ?? null);
        const s = this.seances().find(x => x.id === demandee);
        if (s && !utilisable) {
          this.message.set(s.date > this.aujourdhui
            ? `La séance du ${dateFr(s.date)} n'a pas encore eu lieu : on ne note pas à l'avance.`
            : `${g.eleve} n'est pas noté présent à la séance du ${dateFr(s.date)} : faites d'abord l'appel.`);
        }
      }
      this.erreurChargement.set(false);
      if (!this.reseau.enLigne()) await this.afficherAgeDuCache();
      else this.ageDuCache.set(null);
      if (g.aPhoto) this.chargerPhoto(g.eleveId);
      if (this.estReferent() && this.moniteurs().length === 0) {
        try {
          this.moniteurs.set(await this.api.moniteursActifs());
        } catch {
          // Hors ligne sans liste embarquée : le référent note simplement à son nom.
        }
      }
    } catch {
      this.erreurChargement.set(true);
    }
  }

  private chargerPhoto(eleveId: number): void {
    this.api.photoEleve(eleveId).then(
      blob => this.urlPhoto.set(URL.createObjectURL(blob)),
      () => { /* pas de photo consultable : la silhouette reste affichée */ }
    );
  }

  ngOnDestroy(): void {
    const url = this.urlPhoto();
    if (url) URL.revokeObjectURL(url);
  }

  initiales(nom: string): string {
    return nom.split(' ').filter(Boolean).map(m => m[0]).slice(0, 2).join('').toUpperCase();
  }

  private async afficherAgeDuCache(): Promise<void> {
    const date = await this.api.dateDuCache(`grille:${this.id()}`);
    this.ageDuCache.set(date ? new Date(date).toLocaleString('fr-FR') : null);
  }

  ouvrirDialogueSeance(): void {
    // Le calendrier s'ouvre sur le mois de la séance choisie, sinon sur celui de
    // la dernière séance utilisable (saison terminée : pas un mois vide).
    this.jourDialogue.set(this.seanceChoisie()?.date ?? this.seancesUtilisables().at(-1)?.date ?? this.aujourdhui);
    this.dialogueSeanceOuvert.set(true);
    this.dialogueSeance().nativeElement.showModal();
  }

  fermerDialogueSeance(): void {
    this.dialogueSeance().nativeElement.close();
  }

  seancesDuJour(jour: string): SeanceVue[] {
    return this.seancesUtilisables().filter(s => s.date === jour);
  }

  /** Un seul choix possible ce jour-là : on le prend tout de suite, sans second toucher. */
  toucherJour(jour: string | null): void {
    this.jourDialogue.set(jour);
    const duJour = jour ? this.seancesDuJour(jour) : [];
    if (duJour.length === 1) this.choisirDepuisDialogue(duJour[0]);
  }

  /** Une autre séance, d'autres exercices : les choix repartent du programme de la séance. */
  choisirDepuisDialogue(s: SeanceVue): void {
    if (s.id !== this.seanceId()) this.exercicesChoisis.set({});
    this.seanceId.set(s.id);
    this.fermerDialogueSeance();
  }

  retirerSeance(): void {
    this.exercicesChoisis.set({});
    this.seanceId.set(null);
    this.fermerDialogueSeance();
  }

  /**
   * La notation ne part jamais directement sur le réseau : elle passe par la
   * file, qui l'écrit localement puis l'envoie si elle peut. Un envoi réussi
   * n'est donc pas une condition pour que le geste soit pris en compte.
   */
  async noter(bloc: BlocAffiche, critere: CritereAffiche, statut: Statut,
              exo: ExerciceGrilleVue | null = null): Promise<void> {
    // Noté sous un exercice de la séance : la note porte sur cet exercice.
    this.imposerExercice(bloc, critere, exo);
    // Rien de nouveau si l'exercice noté a déjà cet état.
    const etat = this.etatDeLaCible(bloc, critere);
    if (etat?.le && etat.statut === statut) return;
    // Rien de nouveau : même état, sur le même exercice que la dernière note.
    // (Un autre exercice, ou un exercice d'initiation acquis sur un critère en cours, se note toujours.)
    const actif = this.suiviActif(critere);
    const memeExercice = (a: ExerciceNoteVue | null, b: ExerciceNoteVue | null) =>
      (a?.id ?? null) === (b?.id ?? null) && (a?.id != null || (a?.intitule ?? null) === (b?.intitule ?? null));
    if (memeExercice(this.exerciceNote(bloc, critere), actif.exercice)
        && (actif.statutExercice ?? actif.statut) === statut) return;

    const seance = this.seances().find(s => s.id === this.seanceId()) ?? null;
    const entrainement = this.estEntrainement(seance?.id ?? null);

    if (!bloc.evaluationTransverse && !seance) {
      this.message.set('Choisissez d’abord la séance évaluée.');
      return;
    }

    // Contrôle local avant mise en file. Le serveur refera le même contrôle,
    // mais l'attraper ici évite d'annoncer un refus plusieurs heures plus tard.
    const refus = this.verifierLocalement(seance);
    if (refus) {
      this.message.set(refus);
      return;
    }
    // Note sans exercice sur un critère qui en a : on ouvre le choix de
    // l'exercice, et la note part dès qu'un exercice est choisi.
    const sansExercice = this.refusSansExercice(bloc, critere, statut);
    if (sansExercice) {
      this.ouvrirChoixExercice(bloc, critere, sansExercice);
      this.noteEnSuspens = { critere, statut };
      return;
    }

    this.message.set(null);
    const exercice = this.exerciceNote(bloc, critere);
    const saisie = await this.file.empiler({
      cursusId: Number(this.id()),
      critereId: critere.id,
      seanceId: seance ? seance.id : null,
      statut,
      commentaire: null,
      dateEvaluation: seance ? seance.date : dateDuJour(),
      ...this.champsExercice(exercice),
      ...this.champsPourMoniteur()
    });

    // Hors ligne : rien à attendre, le badge « En attente d'envoi » suffit.
    if (!this.reseau.enLigne()) return;

    // En ligne : indicateur jusqu'à ce que la grille du serveur soit à jour.
    const enVol = cle(critere.id, entrainement);
    this.marquerEnregistrement(enVol, {
      statut, reference: saisie.referenceClient, exercice
    });
    try {
      if (await this.file.attendreEnvoi(saisie.referenceClient)) await this.charger();
    } finally {
      // Seulement si aucune saisie plus récente n'a pris le relais sur ce critère.
      if (this.enregistrements().get(enVol)?.reference === saisie.referenceClient) {
        this.marquerEnregistrement(enVol, null);
      }
    }
  }

  /** Référent qui note au nom d'un autre encadrant : son id pour le serveur, son nom pour le bandeau des refus. */
  private champsPourMoniteur(): { pourMoniteurId: number | null; pourMoniteur: string | null } {
    return this.estReferent() && this.pourMoniteurId() != null
      ? { pourMoniteurId: this.pourMoniteurId(), pourMoniteur: this.nomPourMoniteur() }
      : { pourMoniteurId: null, pourMoniteur: null };
  }

  /** Le suivi que notent les boutons : l'entraînement si la séance choisie est en piscine ou fosse (N2/N3). */
  suiviActif(critere: CritereAffiche): SuiviAffiche {
    return this.modeEntrainement() ? critere.entr : critere;
  }

  /** L'autre suivi, rappelé sous le critère pour un N2/N3. */
  suiviRappele(critere: CritereAffiche): SuiviAffiche {
    return this.modeEntrainement() ? critere : critere.entr;
  }

  private marquerEnregistrement(enVol: string, valeur: EnVol | null): void {
    const suivante = new Map(this.enregistrements());
    if (valeur) suivante.set(enVol, valeur);
    else suivante.delete(enVol);
    this.enregistrements.set(suivante);
  }

  private verifierLocalement(seance: SeanceVue | null): string | null {
    const g = this.grille();
    if (!g || !seance) return null;

    if (!this.estPresent(seance.id)) {
      return `${g.eleve} n'est pas noté présent à cette séance : renseignez d'abord sa présence.`;
    }
    return null;
  }

  /**
   * Cursus des autres saisons du même élève. Chargé une fois par ouverture ;
   * la grille de destination est déjà en lecture seule d'elle-même dès que
   * son statut n'est plus EN_COURS, donc aucun contrôle supplémentaire n'est
   * nécessaire pour la consultation.
   */
  async ouvrirHistoriqueSaisons(): Promise<void> {
    this.historiqueSaisonsOuvert.set(true);
    if (this.historiqueSaisons().length > 0) return;

    const g = this.grille();
    if (!g) return;
    this.chargementHistoriqueSaisons.set(true);
    try {
      const liste = await firstValueFrom(this.api.historiqueCursusEleve(g.eleveId));
      this.historiqueSaisons.set(liste.filter(c => c.id !== Number(this.id())));
    } catch {
      this.historiqueSaisons.set([]);
    } finally {
      this.chargementHistoriqueSaisons.set(false);
    }
  }

  /**
   * Récupère la fiche PDF (même contenu que la grille, mis en page pour
   * l'impression) et déclenche son téléchargement. Nécessite le réseau : pas
   * de génération PDF côté client, ni de mise en cache hors ligne.
   */
  ouvrirPdf(): void {
    this.erreurPdf.set(null);
    this.pdfOuvert.set(true);
  }

  telechargerPdf(g: { eleve: string }): void {
    this.exportEnCours.set(true);
    this.erreurPdf.set(null);
    this.api.fichePdf(Number(this.id())).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const lien = document.createElement('a');
        lien.href = url;
        lien.download = `fiche-${g.eleve}.pdf`;
        lien.click();
        URL.revokeObjectURL(url);
        this.exportEnCours.set(false);
        this.pdfOuvert.set(false);
      },
      error: () => {
        this.erreurPdf.set('Le PDF n’a pas pu être généré.');
        this.exportEnCours.set(false);
      }
    });
  }

  validerBloc(bloc: BlocAffiche): void {
    this.validationEnCours.set(bloc.id);
    this.api.validerCompetence(Number(this.id()), bloc.id).subscribe({
      next: async () => {
        this.message.set(null);
        await this.charger();
        this.validationEnCours.set(null);
      },
      error: (e: HttpErrorResponse) => {
        this.validationEnCours.set(null);
        this.message.set(e.error?.detail ?? 'La validation n’a pas pu être enregistrée.');
      }
    });
  }

  libelleStatut(statut: string): string {
    return this.etats.find(e => e.valeur === statut)?.libelle ?? statut;
  }

  /**
   * Ouvre/ferme l'historique complet d'un critère (une ligne par saisie,
   * table en ajout seul). Chargé à la demande, une seule fois par ouverture.
   */
  async basculerHistorique(critereId: number, cleUi: string): Promise<void> {
    const ouverts = new Set(this.historiqueOuverts());
    if (ouverts.has(cleUi)) {
      ouverts.delete(cleUi);
      this.historiqueOuverts.set(ouverts);
      return;
    }
    ouverts.add(cleUi);
    this.historiqueOuverts.set(ouverts);
    await this.chargerHistorique(critereId);
  }

  private async chargerHistorique(critereId: number): Promise<void> {
    const enCours = new Set(this.chargementHistorique());
    enCours.add(critereId);
    this.chargementHistorique.set(enCours);
    try {
      const liste = await firstValueFrom(this.api.historique(Number(this.id()), critereId));
      this.historiques.set({ ...this.historiques(), [critereId]: liste });
    } catch {
      this.historiques.set({ ...this.historiques(), [critereId]: [] });
    } finally {
      const suite = new Set(this.chargementHistorique());
      suite.delete(critereId);
      this.chargementHistorique.set(suite);
    }
  }

  modifierBrouillon(critereId: number, texte: string): void {
    this.brouillons.set({ ...this.brouillons(), [critereId]: texte });
  }

  /**
   * Un commentaire est une nouvelle ligne d'évaluation, au même statut que
   * l'état courant : la table étant en ajout seul, on ne modifie jamais une
   * saisie passée, on en ajoute une qui ne fait que commenter.
   */
  async commenter(bloc: BlocAffiche, critere: CritereAffiche, exo: ExerciceGrilleVue | null = null,
                  cleUi = 'b:' + critere.id): Promise<void> {
    const texte = (this.brouillons()[critere.id] ?? '').trim();
    if (!texte) return;
    this.imposerExercice(bloc, critere, exo);

    const seance = this.seances().find(s => s.id === this.seanceId()) ?? null;

    if (!bloc.evaluationTransverse && !seance) {
      this.message.set('Choisissez d’abord la séance évaluée.');
      return;
    }
    const refus = this.verifierLocalement(seance);
    if (refus) {
      this.message.set(refus);
      return;
    }

    this.message.set(null);
    await this.file.empiler({
      cursusId: Number(this.id()),
      critereId: critere.id,
      seanceId: seance ? seance.id : null,
      // Sur un exercice : son état, que le commentaire ne change pas ; sinon celui du critère.
      statut: (this.etatDeLaCible(bloc, critere) ?? this.suiviActif(critere)).statut,
      commentaire: texte,
      dateEvaluation: seance ? seance.date : dateDuJour(),
      ...this.champsExercice(this.exerciceNote(bloc, critere)),
      ...this.champsPourMoniteur()
    });

    const restants = { ...this.brouillons() };
    delete restants[critere.id];
    this.brouillons.set(restants);
    const ouverts = new Set(this.commentairesOuverts());
    ouverts.delete(cleUi);
    this.commentairesOuverts.set(ouverts);

    // Le commentaire vient d'être ajouté hors ligne ou en ligne : l'historique
    // affiché (sous la compétence ou sous un exercice) ne le montrera qu'une fois rechargé.
    const historiqueAffiche = [...this.historiqueOuverts()].some(k => k.endsWith(':' + critere.id));
    if (historiqueAffiche && this.reseau.enLigne()) {
      await this.chargerHistorique(critere.id);
    }

    if (this.reseau.enLigne()) {
      setTimeout(() => void this.charger(), 1500);
    }
  }
}
