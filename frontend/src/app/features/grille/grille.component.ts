import {
  Component, OnDestroy, computed, effect, inject, input, signal, untracked, ChangeDetectionStrategy
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FileAttenteService } from '../../core/file-attente.service';
import { ReseauService } from '../../core/reseau.service';
import { BlocVue, CritereVue, CursusVue, EvaluationVue, GrilleVue, SeanceVue, Statut } from '../../core/modeles';
import { DateFrPipe, dateDuJour, dateFr } from '../../core/date-fr';

/** Un critère affiché, augmenté de l'information « pas encore envoyé ». */
interface CritereAffiche extends CritereVue {
  enAttente: boolean;
  /** Saisie en cours d'envoi au serveur (en ligne) : on affiche un indicateur. */
  enregistrement: boolean;
}

interface BlocAffiche extends Omit<BlocVue, 'criteres'> {
  criteres: CritereAffiche[];
  attentes: number;
}

function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

@Component({
  selector: 'app-grille',
  standalone: true,
  imports: [FormsModule, RouterLink, DateFrPipe],
  template: `
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
          <a [routerLink]="['/cursus', id(), 'matrice']" class="lien-matrice">
            Vue globale (toutes les séances)
          </a>
          <button type="button" class="bouton-discret lien-pdf"
                  [disabled]="!reseau.enLigne() || exportEnCours()"
                  (click)="telechargerPdf(g)">
            {{ exportEnCours() ? 'Génération du PDF…' : 'Exporter en PDF' }}
          </button>

          @if (peutVoirHistoriqueSaisons()) {
            <button type="button" class="bouton-discret lien-pdf" (click)="basculerHistoriqueSaisons()">
              {{ historiqueSaisonsOuvert() ? 'Masquer les saisons précédentes' : 'Voir les saisons précédentes' }}
            </button>
            @if (historiqueSaisonsOuvert()) {
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
                        <a [routerLink]="['/cursus', c.id]">
                          {{ c.niveau }} · {{ c.saison }} · {{ c.statut }}
                        </a>
                      </li>
                    }
                  </ul>
                }
              }
            }
          }

          <button type="button" class="bouton-discret bascule-blocs" (click)="basculerTousLesBlocs(g.blocs)">
            {{ blocsOuverts().size > 0 ? 'Tout refermer' : 'Tout ouvrir' }}
          </button>

          <button type="button" class="bouton-discret lien-pdf" (click)="infosSupplementairesOuvertes.set(!infosSupplementairesOuvertes())">
            {{ infosSupplementairesOuvertes() ? 'Masquer les informations supplémentaires' : 'Informations supplémentaires' }}
          </button>
          @if (infosSupplementairesOuvertes()) {
            <dl class="infos-supplementaires">
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
        <div class="alerte">
          Les compétences du {{ g.niveau }} doivent être obtenues en milieu naturel.
          Les séances en piscine et en fosse ne sont pas proposées ici.
        </div>
      }

      @if (peutSaisir()) {
        <div class="barre-seance">
          <label for="seance">Séance évaluée</label>
          <div class="combobox">
            <input id="seance" type="text" autocomplete="off"
                   role="combobox" aria-autocomplete="list" aria-controls="liste-seances"
                   [attr.aria-expanded]="comboboxSeanceOuvert()"
                   placeholder="Rechercher par date (12/10, 2026-10-12) ou lieu…"
                   [value]="rechercheSeance()" (input)="saisirSeance($event)"
                   (focus)="comboboxSeanceOuvert.set(true)" (blur)="fermerComboboxSeanceDifferee()">
            @if (comboboxSeanceOuvert()) {
              <ul id="liste-seances" role="listbox" class="options">
                @for (s of seancesFiltrees(); track s.id) {
                  <li role="option" [attr.aria-selected]="seanceId() === s.id">
                    <button type="button" (mousedown)="choisirSeance(s)">{{ libelleSeance(s) }}</button>
                  </li>
                } @empty {
                  <li class="vide">Aucune séance ne correspond.</li>
                }
              </ul>
            }
          </div>
        </div>
      }

      @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

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
              <span class="secondaire detail">
                {{ bloc.acquis }} / {{ bloc.total }} acquis
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
                  Validation possible une fois les {{ bloc.attentes }} saisie(s) envoyées.
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
          <ul [id]="'criteres-' + bloc.id">
            @for (critere of bloc.criteres; track critere.id) {
              <li>
                <div class="ligne">
                  <div class="libelle">
                    <span>{{ critere.savoirFaire }}</span>
                    @if (critere.critereRealisation) {
                      <span class="secondaire">{{ critere.critereRealisation }}</span>
                    }
                    @if (critere.enregistrement) {
                      <span class="enregistrement" role="status">
                        <span class="chargeur" aria-hidden="true"></span>Enregistrement…
                      </span>
                    } @else if (critere.enAttente) {
                      <span class="attente">En attente d'envoi</span>
                    } @else if (critere.parQui) {
                      <span class="secondaire trace">{{ critere.parQui }} · {{ critere.le | dateFr }}</span>
                    }
                    @if (critere.commentaire) {
                      <span class="dernier-commentaire">« {{ critere.commentaire }} »</span>
                    }
                  </div>

                  <div class="etats" role="group" [attr.aria-label]="critere.savoirFaire">
                    @for (choix of etats; track choix.valeur) {
                      <button type="button"
                              [class]="'etat ' + choix.classe"
                              [class.actif]="critere.statut === choix.valeur"
                              [class.differe]="critere.enAttente && critere.statut === choix.valeur"
                              [disabled]="!peutSaisir() || bloc.valide || critere.enregistrement"
                              [attr.aria-pressed]="critere.statut === choix.valeur"
                              (click)="noter(bloc, critere, choix.valeur)">
                        {{ choix.libelle }}
                      </button>
                    }
                  </div>
                </div>

                <div class="liens-critere">
                  @if (peutSaisir() && !bloc.valide) {
                    <button type="button" class="lien-historique"
                            [attr.aria-expanded]="commentairesOuverts().has(critere.id)"
                            (click)="basculerCommentaire(critere.id)">
                      {{ commentairesOuverts().has(critere.id) ? 'Annuler le commentaire' : 'Commenter' }}
                    </button>
                  }
                  <button type="button" class="lien-historique"
                          (click)="basculerHistorique(critere.id)">
                    {{ historiqueOuverts().has(critere.id) ? 'Masquer l’historique' : 'Voir l’historique' }}
                  </button>
                </div>

                @if (commentairesOuverts().has(critere.id) && peutSaisir() && !bloc.valide) {
                  <div class="ajout-commentaire">
                    <label class="secondaire" [for]="'commentaire-' + critere.id">
                      Ce qui a été travaillé, ce qui reste à revoir…
                    </label>
                    <textarea [id]="'commentaire-' + critere.id" rows="2"
                              [ngModel]="brouillons()[critere.id] ?? ''"
                              (ngModelChange)="modifierBrouillon(critere.id, $event)"></textarea>
                    <button type="button" class="bouton-principal"
                            [disabled]="!(brouillons()[critere.id] ?? '').trim()"
                            (click)="commenter(bloc, critere)">
                      Enregistrer le commentaire
                    </button>
                  </div>
                }

                @if (historiqueOuverts().has(critere.id)) {
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
                              {{ entree.dateEvaluation | dateFr }} · {{ entree.parQui }} · {{ libelleStatut(entree.statut) }}
                            </span>
                            @if (entree.commentaire) { <p>{{ entree.commentaire }}</p> }
                          </div>
                        }
                      }
                    }

                  </div>
                }
              </li>
            }
          </ul>
          }
        </section>
        }
      }
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
  styles: [`
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
    .lien-matrice { display: inline-block; margin-top: var(--pas); font-size: .875rem; }
    .lien-pdf { display: block; margin-top: var(--pas); padding: 0; min-height: auto; background: none; border: none; color: var(--profond); font-size: .875rem; text-decoration: underline; }
    .lien-pdf:disabled { opacity: .5; cursor: not-allowed; text-decoration: none; }
    .saisons-precedentes { list-style: none; margin: var(--pas) 0 0; padding: 0; display: grid; gap: 4px; }
    .saisons-precedentes a { font-size: .875rem; }
    .infos-supplementaires {
      margin: var(--pas) 0 0; display: grid; grid-template-columns: auto 1fr; gap: 4px var(--pas);
      font-size: .875rem;
    }
    .infos-supplementaires dt { font-weight: 700; color: var(--craie); }
    .infos-supplementaires dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }

    .barre-seance {
      display: flex; align-items: center; gap: var(--pas-2);
      margin: var(--pas-3) 0 var(--pas-2);
    }
    .barre-seance label { font-weight: 700; white-space: nowrap; }

    .combobox { position: relative; flex: 1; max-width: 420px; }
    .combobox input { width: 100%; margin: 0; }
    .options {
      position: absolute; z-index: 2; top: 100%; left: 0; right: 0; margin: 2px 0 0; padding: 0;
      list-style: none; max-height: 280px; overflow-y: auto;
      background: var(--carte); border: 1px solid var(--trait);
      border-radius: var(--r-s); box-shadow: 0 4px 12px rgba(0,0,0,.12);
    }
    .options li[aria-selected="true"] button { font-weight: 700; background: var(--fond); }
    .options button {
      display: block; width: 100%; padding: var(--pas) var(--pas-2); min-height: 44px;
      text-align: left; background: none; border: none; border-radius: 0; color: var(--encre);
    }
    .options button:hover, .options button:focus { background: var(--fond); }
    .options .vide { padding: var(--pas) var(--pas-2); color: var(--craie); font-size: .875rem; }

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
    .bascule-blocs { display: block; margin-top: var(--pas); }
    .titre-groupe {
      margin: var(--pas-3) 0 var(--pas); padding-bottom: 4px;
      border-bottom: 2px solid var(--profond); color: var(--profond);
      font-size: 1rem; text-transform: uppercase; letter-spacing: .02em;
    }
    .bloc header h3 { font-size: 1.0625rem; }
    .valide { margin: 0; color: var(--acquis); font-weight: 700; font-size: .9375rem; }

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

    .etats { display: flex; gap: 4px; flex: none; }
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
      .etats { justify-content: stretch; }
      .etat { flex: 1; }
      .barre-seance { flex-direction: column; align-items: stretch; }
      .combobox { max-width: none; }
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
  reseau = inject(ReseauService);

  id = input.required<string>();

  grille = signal<GrilleVue | null>(null);
  seances = signal<SeanceVue[]>([]);
  seanceId = signal<number | null>(null);
  message = signal<string | null>(null);
  erreurChargement = signal(false);
  ageDuCache = signal<string | null>(null);
  urlPhoto = signal<string | null>(null);
  exportEnCours = signal(false);
  /** Critères en cours d'enregistrement : id du critère → saisie envoyée. */
  enregistrements = signal<Map<number, { statut: Statut; reference: string }>>(new Map());
  validationEnCours = signal<number | null>(null);

  /** Historique des critères consultés, tenu par critereId. */
  historiqueOuverts = signal<Set<number>>(new Set());

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
  /** Critères dont la zone « Commenter » est dépliée, indépendamment de l'historique. */
  commentairesOuverts = signal<Set<number>>(new Set());

  basculerCommentaire(critereId: number): void {
    const ouverts = new Set(this.commentairesOuverts());
    if (ouverts.has(critereId)) ouverts.delete(critereId);
    else ouverts.add(critereId);
    this.commentairesOuverts.set(ouverts);
  }

  /** Cursus des saisons précédentes du même élève, pour reprendre l'évaluation initiale. */
  historiqueSaisonsOuvert = signal(false);
  chargementHistoriqueSaisons = signal(false);
  historiqueSaisons = signal<CursusVue[]>([]);

  /** E-mail, téléphone, contact d'urgence : masqués par défaut, hors du premier coup d'œil. */
  infosSupplementairesOuvertes = signal(false);

  readonly etats = [
    { valeur: 'NON_ABORDE' as Statut, libelle: 'Non abordé', classe: 'neant' },
    { valeur: 'EN_COURS'   as Statut, libelle: 'En cours',   classe: 'encours' },
    { valeur: 'ACQUIS'     as Statut, libelle: 'Acquis',     classe: 'acquis' }
  ];

  /**
   * Superpose les saisies en attente à la grille venue du serveur. Le moniteur
   * voit son geste immédiatement, qu'il y ait du réseau ou non, sans qu'on
   * fasse croire que le serveur l'a accepté.
   */
  grilleAffichee = computed<(Omit<GrilleVue, 'blocs'> & { blocs: BlocAffiche[] }) | null>(() => {
    const g = this.grille();
    if (!g) return null;

    const attentes = new Map(
      this.file.pourCursus(Number(this.id())).map(s => [s.critereId, s]));
    const enregistrements = this.enregistrements();

    let acquisTotal = 0;
    const blocs: BlocAffiche[] = g.blocs.map(bloc => {
      const criteres: CritereAffiche[] = bloc.criteres.map(c => {
        const enCours = enregistrements.get(c.id);
        const differee = attentes.get(c.id);
        // Pendant l'envoi puis le rechargement, on garde le statut choisi :
        // sinon l'ancien réapparaîtrait entre la fin de l'envoi et la grille à jour.
        if (enCours) return { ...c, statut: enCours.statut, enAttente: false, enregistrement: true };
        return differee
          ? { ...c, statut: differee.statut, enAttente: true, enregistrement: false, le: differee.dateEvaluation }
          : { ...c, enAttente: false, enregistrement: false };
      });
      const acquis = criteres.filter(c => c.statut === 'ACQUIS').length;
      acquisTotal += acquis;
      return {
        ...bloc,
        criteres,
        acquis,
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
   * Séances sur lesquelles on peut noter : déjà passées (ou du jour) — le
   * serveur refuse une séance à venir — et en milieu naturel si le niveau l'exige.
   */
  seancesUtilisables = computed(() => {
    const g = this.grille();
    if (!g) return [];
    const aujourdhui = dateDuJour();
    return this.seances()
      .filter(s => s.date <= aujourdhui)
      .filter(s => !g.milieuNaturelExclusif || s.milieu === 'NATUREL');
  });

  rechercheSeance = signal('');
  comboboxSeanceOuvert = signal(false);

  /**
   * Un seul champ pour la date ou le lieu : « 12/10 », « 12/10/2026 »,
   * « 2026-10 » ou « Hendaye » trouvent la même séance. Les accents et la
   * casse sont ignorés.
   */
  seancesFiltrees = computed(() => {
    const recherche = normaliser(this.rechercheSeance());
    const seances = this.seancesUtilisables();
    if (!recherche) return seances;
    return seances.filter(s =>
      [s.date, dateFr(s.date), s.lieu ?? ''].some(champ => normaliser(champ).includes(recherche)));
  });

  libelleSeance(s: SeanceVue): string {
    const memeJour = this.seances().filter(x => x.date === s.date).length > 1;
    return `${dateFr(s.date)}${memeJour ? ' (séance ' + s.ordre + ')' : ''} — ${s.lieu ?? 'lieu non précisé'}`
      + (s.profondeurMax ? ` (${s.profondeurMax} m)` : '');
  }

  constructor() {
    // Le lien « saisons précédentes » navigue vers une autre grille sur la
    // même route (/cursus/:id) : Angular réutilise alors l'instance du
    // composant, donc le rechargement doit suivre les changements de l'input
    // plutôt que ne s'exécuter qu'une fois au montage.
    effect(() => {
      this.id();
      untracked(() => {
        this.reinitialiser();
        void this.charger();
      });
    });
  }

  private reinitialiser(): void {
    this.grille.set(null);
    this.seanceId.set(null);
    this.enregistrements.set(new Map());
    this.validationEnCours.set(null);
    this.rechercheSeance.set('');
    this.comboboxSeanceOuvert.set(false);
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
    this.chargementHistoriqueSaisons.set(false);
  }

  private async charger(): Promise<void> {
    try {
      const g = await this.api.grille(Number(this.id()));
      this.grille.set(g);
      this.seances.set(await this.api.seances());
      this.erreurChargement.set(false);
      if (!this.reseau.enLigne()) await this.afficherAgeDuCache();
      else this.ageDuCache.set(null);
      if (g.aPhoto) this.chargerPhoto(g.eleveId);
    } catch {
      this.erreurChargement.set(true);
    }
  }

  private chargerPhoto(eleveId: number): void {
    this.api.photoEleve(eleveId).subscribe({
      next: blob => this.urlPhoto.set(URL.createObjectURL(blob)),
      error: () => { /* pas de photo consultable : la silhouette reste affichée */ }
    });
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

  /** Retaper dans le champ désélectionne la séance : on ne note pas sur une séance devinée. */
  saisirSeance(evenement: Event): void {
    this.rechercheSeance.set((evenement.target as HTMLInputElement).value);
    this.seanceId.set(null);
    this.comboboxSeanceOuvert.set(true);
  }

  choisirSeance(s: SeanceVue): void {
    this.seanceId.set(s.id);
    this.rechercheSeance.set(this.libelleSeance(s));
    this.comboboxSeanceOuvert.set(false);
  }

  /** Différé pour laisser le clic sur une option se produire avant la fermeture. */
  fermerComboboxSeanceDifferee(): void {
    setTimeout(() => this.comboboxSeanceOuvert.set(false), 150);
  }

  /**
   * La notation ne part jamais directement sur le réseau : elle passe par la
   * file, qui l'écrit localement puis l'envoie si elle peut. Un envoi réussi
   * n'est donc pas une condition pour que le geste soit pris en compte.
   */
  async noter(bloc: BlocAffiche, critere: CritereAffiche, statut: Statut): Promise<void> {
    if (critere.statut === statut) return;

    const seance = this.seances().find(s => s.id === this.seanceId()) ?? null;

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

    this.message.set(null);
    const saisie = await this.file.empiler({
      cursusId: Number(this.id()),
      critereId: critere.id,
      seanceId: seance ? seance.id : null,
      statut,
      commentaire: null,
      dateEvaluation: seance ? seance.date : dateDuJour()
    });

    // Hors ligne : rien à attendre, le badge « En attente d'envoi » suffit.
    if (!this.reseau.enLigne()) return;

    // En ligne : indicateur jusqu'à ce que la grille du serveur soit à jour.
    this.marquerEnregistrement(critere.id, { statut, reference: saisie.referenceClient });
    try {
      if (await this.file.attendreEnvoi(saisie.referenceClient)) await this.charger();
    } finally {
      // Seulement si aucune saisie plus récente n'a pris le relais sur ce critère.
      if (this.enregistrements().get(critere.id)?.reference === saisie.referenceClient) {
        this.marquerEnregistrement(critere.id, null);
      }
    }
  }

  private marquerEnregistrement(critereId: number, valeur: { statut: Statut; reference: string } | null): void {
    const suivante = new Map(this.enregistrements());
    if (valeur) suivante.set(critereId, valeur);
    else suivante.delete(critereId);
    this.enregistrements.set(suivante);
  }

  private verifierLocalement(seance: SeanceVue | null): string | null {
    const g = this.grille();
    if (!g || !seance) return null;

    if (g.milieuNaturelExclusif && seance.milieu !== 'NATUREL') {
      return `Les compétences du ${g.niveau} ne peuvent pas être validées en milieu artificiel.`;
    }
    return null;
  }

  /**
   * Cursus des autres saisons du même élève. Chargé une fois par ouverture ;
   * la grille de destination est déjà en lecture seule d'elle-même dès que
   * son statut n'est plus EN_COURS, donc aucun contrôle supplémentaire n'est
   * nécessaire pour la consultation.
   */
  async basculerHistoriqueSaisons(): Promise<void> {
    if (this.historiqueSaisonsOuvert()) {
      this.historiqueSaisonsOuvert.set(false);
      return;
    }
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
  telechargerPdf(g: { eleve: string }): void {
    this.exportEnCours.set(true);
    this.api.fichePdf(Number(this.id())).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const lien = document.createElement('a');
        lien.href = url;
        lien.download = `fiche-${g.eleve}.pdf`;
        lien.click();
        URL.revokeObjectURL(url);
        this.exportEnCours.set(false);
      },
      error: () => {
        this.message.set('Le PDF n’a pas pu être généré.');
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
  async basculerHistorique(critereId: number): Promise<void> {
    const ouverts = new Set(this.historiqueOuverts());
    if (ouverts.has(critereId)) {
      ouverts.delete(critereId);
      this.historiqueOuverts.set(ouverts);
      return;
    }
    ouverts.add(critereId);
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
  async commenter(bloc: BlocAffiche, critere: CritereAffiche): Promise<void> {
    const texte = (this.brouillons()[critere.id] ?? '').trim();
    if (!texte) return;

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
      statut: critere.statut,
      commentaire: texte,
      dateEvaluation: seance ? seance.date : dateDuJour()
    });

    const restants = { ...this.brouillons() };
    delete restants[critere.id];
    this.brouillons.set(restants);
    const ouverts = new Set(this.commentairesOuverts());
    ouverts.delete(critere.id);
    this.commentairesOuverts.set(ouverts);

    // Le commentaire vient d'être ajouté hors ligne ou en ligne : l'historique
    // affiché ne le montrera qu'une fois rechargé depuis le serveur.
    if (this.historiqueOuverts().has(critere.id) && this.reseau.enLigne()) {
      await this.chargerHistorique(critere.id);
    }

    if (this.reseau.enLigne()) {
      setTimeout(() => void this.charger(), 1500);
    }
  }
}
