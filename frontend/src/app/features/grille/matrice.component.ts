import { Component, computed, inject, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import {
  CelluleMatrice, ExerciceBaseVue, ExerciceGrilleVue, LigneMatrice, MatriceVue, SeanceEnTete
} from '../../core/modeles';
import { DateFrPipe, dateFr } from '../../core/date-fr';
import { DialogueComponent } from '../../core/dialogue.component';
import { PHASES, PastillePhaseComponent, libellePhase } from '../../core/phase-exercice';
import { SchemaExerciceComponent } from '../../core/schema-exercice.component';

const LIBELLES: Record<string, string> = {
  NON_ABORDE: 'NA', EN_COURS: 'ECA', ACQUIS: 'A'
};

@Component({
  selector: 'app-matrice',
  imports: [FormsModule, RouterLink, DateFrPipe, DialogueComponent, PastillePhaseComponent, SchemaExerciceComponent],
  template: `
    <a [routerLink]="['/cursus', id()]" class="retour">&larr; Retour à la grille</a>

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (erreur()) {
      <div class="carte vide"><p>{{ erreur() }}</p></div>
    } @else if (matrice(); as m) {
      <h1>{{ m.eleve }}</h1>
      <p class="secondaire">Vue globale · {{ m.niveau }} · toutes les séances de la saison</p>

      <div class="options" role="group" aria-label="Affichage">
        <label class="case">
          <input type="checkbox" [ngModel]="seulementNotees()" (ngModelChange)="seulementNotees.set($event)">
          Seulement les séances où l'élève était présent ou noté
        </label>
        <label class="case">
          <input type="checkbox" [ngModel]="seulementNonAcquis()" (ngModelChange)="seulementNonAcquis.set($event)">
          Seulement les critères non acquis{{ m.milieuNaturelExclusif ? ' en milieu naturel' : '' }}
        </label>
      </div>
      @if (m.milieuNaturelExclusif) {
        <div class="milieux" role="group" aria-label="Séances affichées">
          @for (choix of choixMilieux; track choix.valeur) {
            <button type="button" class="bouton-discret" [class.actif]="milieuAffiche() === choix.valeur"
                    [attr.aria-pressed]="milieuAffiche() === choix.valeur" (click)="milieuAffiche.set(choix.valeur)">
              {{ choix.libelle }}
            </button>
          }
        </div>
        <p class="explication">
          Au {{ m.niveau }}, seules les évaluations <strong>en milieu naturel</strong> valident les critères.
          Les notes prises <span class="marque-entrainement">en piscine ou en fosse</span> sont un suivi
          d'entraînement : elles montrent où en est l'élève, sans rien acquérir.
        </p>
      }
      <p class="legende secondaire">
        <span class="pastille acquis">A</span> acquis
        <span class="pastille encours">ECA</span> en cours d'acquisition
        <span class="pastille neant">NA</span> non abordé
        @if (m.milieuNaturelExclusif) {
          <span class="pastille acquis entrainement">A</span> case en pointillés : entraînement en piscine / fosse
        }
        · {{ seancesAffichees().length }} séance(s) sur {{ m.seances.length }}
      </p>
      @if (m.exercices?.length) {
        <p class="legende secondaire">
          Exercice noté :
          <app-pastille-phase phase="INITIATION" /> initiation
          <app-pastille-phase phase="PERFECTIONNEMENT" /> perfectionnement
          <app-pastille-phase phase="MAITRISE" /> maîtrise
          · touchez une date pour voir les exercices de la séance
        </p>
        <p class="legende secondaire">
          Une case donne l'état de l'exercice noté : « A » + <app-pastille-phase phase="INITIATION" /> = exercice
          d'initiation acquis. Le critère n'est acquis qu'avec un exercice de maîtrise
          <app-pastille-phase phase="MAITRISE" /> acquis ; sinon la case le rappelle (« critère en cours »).
          Une pastille sans numéro : exercice libre du programme. Une note prise sans choisir d'exercice est
          marquée « sans exercice » : sa phase n'est pas connue.
        </p>
      }

      @if (lignesAffichees().length === 0) {
        <div class="carte vide"><p>Tous les critères sont acquis{{ m.milieuNaturelExclusif ? ' en milieu naturel' : '' }}.</p></div>
      } @else {
      <div class="tableau-scroll">
        <table>
          <thead>
            <tr>
              <th class="figee">
                Critère
                <span class="sous-titre">· état actuel{{ m.milieuNaturelExclusif ? ' : milieu naturel / entraînement' : '' }}</span>
              </th>
              @for (s of seancesAffichees(); track s.id) {
                <th class="entete-seance" [class.colonne-entrainement]="m.milieuNaturelExclusif && s.milieu !== 'NATUREL'">
                  <button type="button" class="ouvrir-seance" (click)="ouvrirSeance(s)"
                          [attr.aria-label]="'Exercices notés le ' + (s.date | dateFr)">
                    <span class="date-seance">{{ s.date | dateFr }}</span>
                    @if (programmeDe(s.id).length; as n) { <span class="nb-exercices">programme : {{ n }}</span> }
                    @if (nombreExercices(s.id); as n) { <span class="nb-exercices">{{ n }} exercice{{ n > 1 ? 's' : '' }} noté{{ n > 1 ? 's' : '' }}</span> }
                  </button>
                  @if (s.lieu) { <span class="lieu-seance">{{ s.lieu }}</span> }
                  <span class="milieu-seance" [class.naturel]="s.milieu === 'NATUREL'">
                    {{ s.milieu === 'NATUREL' ? 'Naturel' : 'Piscine / fosse' }}
                  </span>
                  @if (m.milieuNaturelExclusif) {
                    <span class="role-seance">{{ s.milieu === 'NATUREL' ? 'validation' : 'entraînement' }}</span>
                  }
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @if (m.programmes?.length) {
              <!-- Programme de chaque séance : exercices des compétences et exercices libres, notés ou non. -->
              <tr class="ligne-programme">
                <td class="figee"><strong>Programme d'exercices</strong></td>
                @for (s of seancesAffichees(); track s.id) {
                  @let prevus = programmeDe(s.id);
                  <td class="cellule-programme" [class.cliquable]="prevus.length > 0"
                      (click)="prevus.length > 0 && ouvrirSeance(s)">
                    @for (p of prevus; track $index) {
                      @if (p.exerciceBase; as base) {
                        <app-pastille-phase [phase]="base.phase" [numero]="base.numero" [intitule]="base.intitule" />
                      } @else if (p.phase) {
                        <span class="libre-programme" [title]="'Exercice libre : ' + p.intitule">
                          <app-pastille-phase [phase]="p.phase" [intitule]="'exercice libre : ' + p.intitule" />
                        </span>
                      } @else {
                        <span class="libre" [title]="'Exercice libre : ' + p.intitule">Libre</span>
                      }
                    } @empty {
                      <span class="secondaire">–</span>
                    }
                  </td>
                }
              </tr>
            }
            @for (item of lignesAffichees(); track item.ligne.critereId) {
              @if (item.nouveauGroupe && item.ligne.regroupement) {
                <tr class="groupe">
                  <td [attr.colspan]="1 + seancesAffichees().length"><span class="titre-fige">{{ item.ligne.regroupement }}</span></td>
                </tr>
              }
              @if (item.nouveauBloc) {
                <tr class="bloc-titre">
                  <td [attr.colspan]="1 + seancesAffichees().length"><span class="titre-fige">{{ item.ligne.blocIntitule }}</span></td>
                </tr>
              }
              <tr class="critere">
                <td class="figee">
                  <div class="critere-etat">
                    <span>{{ item.ligne.savoirFaire }}</span>
                    @let actuel = etatActuel(item.ligne);
                    <span class="etats-actuels">
                      <span [class]="'pastille ' + suffixe(actuel)"
                            [attr.aria-label]="(m.milieuNaturelExclusif ? 'Milieu naturel : ' : '') + libelleLong(actuel)"
                            [title]="(m.milieuNaturelExclusif ? 'Milieu naturel · ' : '') + (actuel ? 'dernière saisie le ' + (actuel.date | dateFr) + ' par ' + actuel.parQui : 'jamais noté')">
                        @if (m.milieuNaturelExclusif) { <span class="prefixe">Nat.</span> }{{ libelle(actuel) }}
                      </span>
                      @if (m.milieuNaturelExclusif) {
                        @let entr = etatEntrainement(item.ligne);
                        <span [class]="'pastille entrainement ' + suffixe(entr)"
                              [attr.aria-label]="'Piscine / fosse : ' + libelleLong(entr)"
                              [title]="'Piscine / fosse · ' + (entr ? 'dernière saisie le ' + (entr.date | dateFr) + ' par ' + entr.parQui : 'jamais noté')">
                          <span class="prefixe">Fosse</span>{{ libelle(entr) }}
                        </span>
                      }
                    </span>
                  </div>
                </td>
                @for (s of seancesAffichees(); track s.id) {
                  @let cellule = cellulePour(item.ligne, s.id);
                  <td [class]="classeCase(cellule)" [class.colonne-entrainement]="m.milieuNaturelExclusif && s.milieu !== 'NATUREL'"
                      [class.cliquable]="!!cellule" (click)="cellule && ouvrirSeance(s)"
                      [title]="titreCase(cellule)">
                    <!-- Une note porte sur l'exercice : la case montre son état et sa phase (« A » + « I 1.1 »). -->
                    <span class="statut">
                      {{ libelleCase(cellule) }}
                      @if (exerciceDe(cellule); as exo) {
                        <app-pastille-phase [phase]="exo.phase" [numero]="exo.numero" [intitule]="exo.intitule" />
                      } @else if (cellule?.exerciceLibre && cellule?.phaseExercice) {
                        <app-pastille-phase [phase]="cellule!.phaseExercice!" [intitule]="'exercice libre : ' + cellule!.exerciceLibre" />
                      }
                    </span>
                    @if (cellule && !exerciceDe(cellule) && !cellule.exerciceLibre && criteresAvecExercices().has(item.ligne.critereId)) {
                      <span class="sans-exercice">sans exercice</span>
                    }
                    @if (critereDifferent(cellule)) {
                      <span class="critere-case">critère {{ libelleLong(cellule) }}</span>
                    }
                    @if (cellule) {
                      <span class="moniteur">{{ cellule.parQui }}</span>
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
      }

      <app-dialogue [ouvert]="seanceOuverte() !== null" [titre]="titreSeance()" (fermer)="seanceOuverte.set(null)">
        @if (seanceOuverte(); as s) {
          @let detail = detailSeance(s.id);
          @let prevus = programmeDe(s.id);
          <h3 class="titre-section">Programme d'exercices</h3>
          @if (prevus.length === 0) {
            <p class="secondaire">Aucun programme préparé pour cette séance.</p>
          } @else {
            <ol class="programme-seance">
              @for (p of prevus; track $index) {
                <li>
                  <span class="titre-prevu">
                    @if (p.exerciceBase; as base) {
                      <app-pastille-phase [phase]="base.phase" [numero]="base.numero" [intitule]="base.intitule" />
                    } @else {
                      <span class="libre">Libre</span>
                      @if (p.phase) { <app-pastille-phase [phase]="p.phase" [intitule]="'exercice libre'" /> }
                    }
                    <strong>{{ p.intitule }}</strong>
                  </span>
                  <span class="secondaire">
                    {{ p.groupe ?? 'programme commun' }}@if (p.dureeMinutes) { · {{ p.dureeMinutes }} min }
                  </span>
                  @if (nomsCriteres(p.critereIds); as noms) {
                    <span class="criteres-prevus">Critères : {{ noms }}</span>
                  }
                  @if (p.consignes) { <span class="consignes-prevues">{{ p.consignes }}</span> }
                  @if (p.exerciceBase && exercicesParIdPublic(p.exerciceBase.id)?.aSchema) {
                    <button type="button" class="lien-schema" (click)="basculerSchema(p.exerciceBase.id)"
                            [attr.aria-expanded]="schemaOuvert() === p.exerciceBase.id">
                      {{ schemaOuvert() === p.exerciceBase.id ? 'Masquer le schéma' : 'Voir le schéma' }}
                    </button>
                    @if (schemaOuvert() === p.exerciceBase.id) {
                      <app-schema-exercice [exerciceId]="p.exerciceBase.id" [libelle]="p.intitule" />
                    }
                  }
                </li>
              }
            </ol>
          }

          <h3 class="titre-section">Notes de {{ m.eleve }}</h3>
          @if (detail.exercices.length === 0 && detail.sansExercice.length === 0) {
            <p class="secondaire">Aucune note pour {{ m.eleve }} à cette séance.</p>
          }
          @for (d of detail.exercices; track d.exercice.id) {
            <section class="exercice-seance">
              <h3>
                <app-pastille-phase [phase]="d.exercice.phase" [numero]="d.exercice.numero" [intitule]="d.exercice.intitule" />
                {{ d.exercice.intitule }}
                <span class="phase-texte">{{ libellePhase(d.exercice.phase) }}</span>
              </h3>
              @if (d.exercice.deroulement) { <p class="texte-exercice">{{ d.exercice.deroulement }}</p> }
              @if (d.exercice.critereReussite) {
                <p class="texte-exercice"><strong>Réussite :</strong> {{ d.exercice.critereReussite }}</p>
              }
              @if (d.exercice.aSchema) {
                <app-schema-exercice class="schema-seance" [exerciceId]="d.exercice.id"
                                     [libelle]="d.exercice.numero + ' ' + d.exercice.intitule" />
              }
              <ul class="notes-seance">
                @for (n of d.notes; track $index) {
                  <li>
                    <span [class]="'pastille ' + suffixeCase(n.cellule)">{{ libelleCase(n.cellule) }}</span>
                    {{ n.critere }} <span class="secondaire">· {{ n.cellule.parQui }}</span>
                    @if (critereDifferent(n.cellule)) {
                      <span class="critere-case">exercice {{ libelleLong(etatExercice(n.cellule)) }}, critère {{ libelleLong(n.cellule) }}</span>
                    }
                    @if (n.cellule.commentaire) { <span class="commentaire-note">« {{ n.cellule.commentaire }} »</span> }
                  </li>
                }
              </ul>
            </section>
          }
          @if (detail.sansExercice.length > 0) {
            <section class="exercice-seance">
              <h3>Notes sans exercice de la base</h3>
              <ul class="notes-seance">
                @for (n of detail.sansExercice; track $index) {
                  <li>
                    <span [class]="'pastille ' + suffixeCase(n.cellule)">{{ libelleCase(n.cellule) }}</span>
                    {{ n.critere }} <span class="secondaire">· {{ n.cellule.parQui }}</span>
                    @if (n.cellule.exerciceLibre && n.cellule.phaseExercice) {
                      <span class="critere-case">
                        <app-pastille-phase [phase]="n.cellule.phaseExercice" [intitule]="'exercice libre'" />
                        exercice libre « {{ n.cellule.exerciceLibre }} »@if (critereDifferent(n.cellule)) {, critère {{ libelleLong(n.cellule) }}}
                      </span>
                    }
                    @if (n.cellule.commentaire) { <span class="commentaire-note">« {{ n.cellule.commentaire }} »</span> }
                  </li>
                }
              </ul>
            </section>
          }
          <div class="actions-dialogue">
            <button type="button" class="bouton-discret" (click)="seanceOuverte.set(null)">Fermer</button>
          </div>
        }
      </app-dialogue>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .retour {
      display: inline-block; margin-bottom: var(--pas-2); font-size: .875rem; text-decoration: none;
    }
    h1 { margin-bottom: 2px; }
    .options { display: flex; flex-wrap: wrap; gap: var(--pas) var(--pas-3); margin-top: var(--pas-3); }
    .case { display: flex; align-items: center; gap: var(--pas); min-height: 44px; font-weight: 700; font-size: .9375rem; cursor: pointer; }
    .case input { width: 20px; height: 20px; margin: 0; }
    .legende { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: var(--pas) 0 0; }
    .pastille {
      display: inline-block; min-width: 32px; padding: 1px 6px; border-radius: 4px; text-align: center;
      font-size: .75rem; font-weight: 700; background: var(--fond); color: var(--craie);
    }
    .pastille.acquis { background: var(--acquis-clair); color: var(--acquis); }
    .pastille.encours { background: var(--en-cours-clair); color: var(--en-cours); }
    .pastille.jamais { background: none; }
    .legende .pastille { margin-left: var(--pas); }
    .legende .pastille:first-child { margin-left: 0; }

    .tableau-scroll { overflow-x: auto; margin-top: var(--pas-2); }
    /* Sur ordinateur, le tableau défile dans son propre cadre : la ligne des
       dates reste visible (en-tête collé en haut) pendant qu'on descend dans
       les critères, et la colonne des critères reste à gauche. */
    @media (min-width: 721px) {
      .tableau-scroll {
        max-height: calc(100vh - 220px); overflow: auto;
        border: 1px solid var(--trait); border-radius: var(--r-s); background: var(--carte);
      }
      thead th { position: sticky; top: 0; z-index: 2; background: var(--fond); }
      thead th.figee { z-index: 3; }
      tr.critere:hover td { background: var(--fond); }
      tr.critere:hover td.acquis { background: var(--acquis-clair); }
      tr.critere:hover td.encours { background: var(--en-cours-clair); }
      tr.critere:hover td.figee { background: #EEF6F8; }
    }
    .sous-titre { font-weight: 400; }
    .entete-seance { white-space: normal; min-width: 90px; max-width: 130px; vertical-align: bottom; }
    .date-seance { display: block; color: var(--encre); }
    .lieu-seance { display: block; font-weight: 400; font-size: .75rem; overflow-wrap: anywhere; }
    .milieu-seance {
      display: inline-block; margin-top: 2px; padding: 1px 6px; border-radius: 4px;
      background: var(--accent-clair); color: var(--encre); font-size: .6875rem; font-weight: 700;
    }
    .milieu-seance.naturel { background: var(--profond); color: #fff; }
    /* N2/N3 : l'entraînement en piscine/fosse se lit à part de la validation en milieu naturel. */
    .role-seance { display: block; margin-top: 2px; font-size: .6875rem; font-weight: 400; font-style: italic; }
    .milieux { display: flex; flex-wrap: wrap; gap: var(--pas); margin-top: var(--pas-2); }
    .milieux .actif { background: var(--profond); border-color: var(--profond); color: #fff; }
    .explication { margin: var(--pas-2) 0 0; font-size: .875rem; max-width: 70ch; }
    .marque-entrainement { border-bottom: 2px dashed var(--accent); }
    .etats-actuels { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex: none; }
    .prefixe { margin-right: 4px; font-weight: 400; font-size: .6875rem; }
    .pastille.entrainement { outline: 1px dashed var(--accent); outline-offset: -1px; font-style: italic; }
    th.colonne-entrainement { background: #FFF7ED; }
    td.colonne-entrainement { border-left: 1px dashed var(--accent-clair); border-right: 1px dashed var(--accent-clair); }
    td.colonne-entrainement .statut { font-style: italic; }
    td.colonne-entrainement.cellule.acquis, td.colonne-entrainement.cellule.encours {
      background-image: repeating-linear-gradient(135deg, transparent 0 6px, rgba(255,255,255,.7) 6px 9px);
    }
    .critere-etat { display: flex; justify-content: space-between; align-items: center; gap: var(--pas); }
    .critere-etat .pastille { flex: none; }
    table { border-collapse: collapse; white-space: nowrap; }
    th, td {
      padding: 8px 12px; border-bottom: 1px solid var(--trait); text-align: left; font-size: .875rem;
    }
    thead th { color: var(--craie); font-weight: 700; }
    .figee { position: sticky; left: 0; min-width: 240px; white-space: normal; max-width: 32ch; }
    th.figee { background: var(--fond); }
    td.figee { background: var(--carte); z-index: 1; }
    /* Une cellule fusionnée sur toute la ligne est aussi large que le
       tableau : « sticky » sur la cellule elle-même n'a aucun effet et le
       titre défilait hors de l'écran. On fige le texte à l'intérieur. */
    .titre-fige { position: sticky; left: 12px; display: inline-block; }
    tr.groupe td {
      background: var(--fond); color: var(--profond);
      font-weight: 700; text-transform: uppercase; font-size: .8125rem; letter-spacing: .02em;
      border-bottom: none;
    }
    tr.bloc-titre td {
      background: var(--carte); color: var(--craie);
      font-weight: 700; font-size: .8125rem; border-bottom: 1px solid var(--trait);
      padding-top: 12px;
    }
    td.cellule { min-width: 90px; }
    .statut { display: block; }
    .moniteur {
      display: block; margin-top: 2px; color: var(--craie); font-size: .75rem; font-weight: 400;
      white-space: normal;
    }
    .cellule.encours { background: var(--en-cours-clair); }
    .cellule.encours .statut { color: var(--en-cours); font-weight: 700; }
    .cellule.acquis  { background: var(--acquis-clair); }
    .cellule.acquis  .statut { color: var(--acquis); font-weight: 700; }
    .cellule.neant   .statut { color: var(--craie); }
    .cellule .statut { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
    .sans-exercice { display: block; margin-top: 2px; font-size: .6875rem; font-weight: 400; font-style: italic; color: var(--craie); }
    .critere-case { display: block; margin-top: 2px; font-size: .6875rem; font-weight: 400; color: var(--en-cours); }
    td.cliquable { cursor: pointer; }
    .ouvrir-seance {
      display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-height: 44px; padding: 0;
      background: none; border: none; font: inherit; color: inherit; text-align: left; cursor: pointer;
    }
    .ouvrir-seance .date-seance { text-decoration: underline; }
    .nb-exercices { font-size: .6875rem; font-weight: 400; color: var(--profond); }
    .exercice-seance { margin-bottom: var(--pas-3); }
    .exercice-seance h3 { display: flex; flex-wrap: wrap; align-items: center; gap: var(--pas); margin: 0 0 var(--pas); font-size: 1rem; }
    .phase-texte { font-size: .8125rem; font-weight: 400; color: var(--craie); }
    .texte-exercice { margin: 0 0 var(--pas); font-size: .875rem; max-width: 70ch; }
    .schema-seance { margin-bottom: var(--pas); }
    tr.ligne-programme td { background: #F1F8FA; vertical-align: top; }
    .cellule-programme { white-space: normal; }
    .cellule-programme app-pastille-phase, .cellule-programme .libre { display: inline-flex; margin: 0 4px 4px 0; }
    .libre-programme { display: inline-flex; }
    .titre-section { margin: var(--pas-2) 0 var(--pas); font-size: 1rem; color: var(--profond); }
    .programme-seance { margin: 0 0 var(--pas-2); padding-left: 1.5rem; display: grid; gap: var(--pas); font-size: .875rem; }
    .programme-seance li { display: flex; flex-direction: column; gap: 2px; }
    .titre-prevu { display: flex; flex-wrap: wrap; align-items: center; gap: var(--pas); }
    .libre {
      padding: 0 6px; border: 1px solid var(--trait); border-radius: var(--r-s);
      font-size: .75rem; font-weight: 700; color: var(--craie);
    }
    .criteres-prevus { color: var(--profond); }
    .consignes-prevues { white-space: pre-line; }
    .lien-schema {
      align-self: flex-start; min-height: 44px; padding: 0; background: none; border: none;
      color: var(--profond); font-size: .8125rem; text-decoration: underline; cursor: pointer;
    }
    .notes-seance { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: .875rem; }
    .commentaire-note { display: block; font-style: italic; margin-left: 40px; }

    /* Sur téléphone, 240px de colonne figée ne laissaient presque plus de
       place aux séances. */
    @media (max-width: 720px) {
      .figee { min-width: 0; width: 45vw; max-width: 45vw; }
      th, td { padding: 8px; }
      .titre-fige { left: 8px; max-width: calc(100vw - 48px); white-space: normal; }
    }
  `]
})
export class MatriceComponent {
  private api = inject(ApiService);

  id = input.required<string>();

  matrice = signal<MatriceVue | null>(null);
  chargement = signal(true);
  erreur = signal<string | null>(null);

  /**
   * Le backend livre deja les lignes groupees par regroupement (etiquette
   * "Commun"/"PA20"/"PE40"...) : on repere juste ici ou inserer un titre de
   * groupe, au premier changement de valeur.
   */
  /** Masque les colonnes vides : sur une saison, l'élève n'est noté qu'à une partie des séances. */
  seulementNotees = signal(true);
  seulementNonAcquis = signal(false);

  /** N2/N3 : toutes les séances, ou seulement la validation en milieu naturel, ou seulement l'entraînement. */
  milieuAffiche = signal<'TOUS' | 'NATUREL' | 'ARTIFICIEL'>('TOUS');
  readonly choixMilieux = [
    { valeur: 'TOUS' as const, libelle: 'Toutes les séances' },
    { valeur: 'NATUREL' as const, libelle: 'Milieu naturel (validation)' },
    { valeur: 'ARTIFICIEL' as const, libelle: 'Piscine / fosse (entraînement)' }
  ];

  seancesAffichees = computed<SeanceEnTete[]>(() => {
    const m = this.matrice();
    if (!m) return [];
    const milieu = this.milieuAffiche();
    const duMilieu = !m.milieuNaturelExclusif || milieu === 'TOUS' ? m.seances
      : m.seances.filter(s => milieu === 'NATUREL' ? s.milieu === 'NATUREL' : s.milieu !== 'NATUREL');
    if (!this.seulementNotees()) return duMilieu;
    // Présent sans note (exercices libres, programme seul) : la séance reste affichée.
    const notees = new Set<number | null>([
      ...m.lignes.flatMap(l => l.historique.map(c => c.seanceId)),
      ...(m.seancesPresent ?? [])
    ]);
    return duMilieu.filter(s => notees.has(s.id));
  });

  lignesAffichees = computed(() => {
    const m = this.matrice();
    if (!m) return [];
    const lignes = this.seulementNonAcquis()
      ? m.lignes.filter(l => this.etatActuel(l)?.statut !== 'ACQUIS')
      : m.lignes;
    let regroupementPrecedent: string | null | undefined;
    let blocPrecedent: string | undefined;
    return lignes.map(ligne => {
      const nouveauGroupe = ligne.regroupement !== regroupementPrecedent;
      const nouveauBloc = nouveauGroupe || ligne.blocIntitule !== blocPrecedent;
      regroupementPrecedent = ligne.regroupement;
      blocPrecedent = ligne.blocIntitule;
      return { ligne, nouveauGroupe, nouveauBloc };
    });
  });

  constructor() {
    queueMicrotask(() => this.charger());
  }

  // ----------------------------------------------------------------
  //  Base d'exercices : l'exercice noté dans chaque case, et le détail
  //  des exercices d'une séance au clic.
  // ----------------------------------------------------------------

  readonly libellePhase = libellePhase;
  seanceOuverte = signal<SeanceEnTete | null>(null);

  private exercicesParId = computed(() =>
    new Map((this.matrice()?.exercices ?? []).map(e => [e.id, e] as const)));

  /** Programme d'exercices préparé pour une séance (commun puis groupe de l'élève). */
  programmeDe(seanceId: number): ExerciceGrilleVue[] {
    return this.matrice()?.programmes?.find(p => p.seanceId === seanceId)?.exercices ?? [];
  }

  private nomsDesCriteres = computed(() =>
    new Map((this.matrice()?.lignes ?? []).map(l => [l.critereId, l.savoirFaire] as const)));

  nomsCriteres(ids: number[]): string {
    return ids.map(id => this.nomsDesCriteres().get(id)).filter(Boolean).join(', ');
  }

  exercicesParIdPublic(id: number): ExerciceBaseVue | undefined {
    return this.exercicesParId().get(id);
  }

  /** Schéma déplié dans le programme de la séance. */
  schemaOuvert = signal<number | null>(null);

  basculerSchema(id: number): void {
    this.schemaOuvert.set(this.schemaOuvert() === id ? null : id);
  }

  /** Critères reliés à la base d'exercices : une note sans exercice n'y dit pas sa phase, la case le signale. */
  criteresAvecExercices = computed(() =>
    new Set((this.matrice()?.exercices ?? []).flatMap(e => e.critereIds ?? [])));

  exerciceDe(cellule: CelluleMatrice | null): ExerciceBaseVue | null {
    return cellule?.exerciceId == null ? null : this.exercicesParId().get(cellule.exerciceId) ?? null;
  }

  /** Exercices différents notés à une séance, pour l'en-tête de colonne. */
  nombreExercices(seanceId: number): number {
    const ids = new Set<number>();
    for (const l of this.matrice()?.lignes ?? []) {
      for (const c of l.historique) if (c.seanceId === seanceId && c.exerciceId != null) ids.add(c.exerciceId);
    }
    return ids.size;
  }

  ouvrirSeance(s: SeanceEnTete): void {
    this.seanceOuverte.set(s);
  }

  titreSeance(): string {
    const s = this.seanceOuverte();
    return s ? `Séance du ${dateFr(s.date)}${s.lieu ? ' — ' + s.lieu : ''}` : '';
  }

  /** Toutes les notes de la séance, regroupées par exercice (de l'initiation à la maîtrise), puis celles sans exercice. */
  detailSeance(seanceId: number): {
    exercices: { exercice: ExerciceBaseVue; notes: { critere: string; cellule: CelluleMatrice }[] }[];
    sansExercice: { critere: string; cellule: CelluleMatrice }[];
  } {
    const parExercice = new Map<number, { critere: string; cellule: CelluleMatrice }[]>();
    const sansExercice: { critere: string; cellule: CelluleMatrice }[] = [];
    for (const l of this.matrice()?.lignes ?? []) {
      for (const c of l.historique) {
        if (c.seanceId !== seanceId) continue;
        const note = { critere: l.savoirFaire, cellule: c };
        if (c.exerciceId != null && this.exercicesParId().has(c.exerciceId)) {
          parExercice.set(c.exerciceId, [...(parExercice.get(c.exerciceId) ?? []), note]);
        } else {
          sansExercice.push(note);
        }
      }
    }
    const rang = (e: ExerciceBaseVue) => PHASES.findIndex(p => p.valeur === e.phase);
    const exercices = [...parExercice.entries()]
      .map(([id, notes]) => ({ exercice: this.exercicesParId().get(id)!, notes }))
      .sort((a, b) => rang(a.exercice) - rang(b.exercice) || a.exercice.ordre - b.exercice.ordre);
    return { exercices, sansExercice };
  }

  private charger(): void {
    this.api.matrice(Number(this.id())).subscribe({
      next: m => { this.matrice.set(m); this.chargement.set(false); },
      error: () => {
        this.erreur.set("Impossible de charger la vue globale de l'élève.");
        this.chargement.set(false);
      }
    });
  }

  /**
   * État courant d'un critère : la dernière saisie, séance ou non (l'historique
   * arrive trié par date de saisie). Pour un N2/N3, l'entraînement en piscine
   * ou fosse n'en fait pas partie : c'est le milieu naturel qui valide.
   */
  etatActuel(ligne: LigneMatrice): CelluleMatrice | null {
    return ligne.historique.filter(c => !c.entrainement).at(-1) ?? null;
  }

  /** N2/N3 : dernière note d'entraînement en piscine ou fosse. */
  etatEntrainement(ligne: LigneMatrice): CelluleMatrice | null {
    return ligne.historique.filter(c => c.entrainement).at(-1) ?? null;
  }

  libelleLong(cellule: CelluleMatrice | null): string {
    if (!cellule) return 'jamais noté';
    return cellule.statut === 'ACQUIS' ? 'acquis' : cellule.statut === 'EN_COURS' ? 'en cours' : 'non abordé';
  }

  suffixe(cellule: CelluleMatrice | null): string {
    if (!cellule) return 'jamais';
    return cellule.statut === 'ACQUIS' ? 'acquis' : cellule.statut === 'EN_COURS' ? 'encours' : 'neant';
  }

  cellulePour(ligne: MatriceVue['lignes'][number], seanceId: number) {
    // La dernière saisie pour cette séance : une table en ajout seul peut en
    // porter plusieurs (une correction), on affiche la plus récente.
    const cellules = ligne.historique.filter(c => c.seanceId === seanceId);
    return cellules.length ? cellules[cellules.length - 1] : null;
  }

  libelle(cellule: MatriceVue['lignes'][number]['historique'][number] | null): string {
    return cellule ? (LIBELLES[cellule.statut] ?? cellule.statut) : '–';
  }

  classe(cellule: CelluleMatrice | null): string {
    return cellule ? 'cellule ' + this.suffixe(cellule) : 'cellule';
  }

  /**
   * Une note sur un exercice dit d'abord où en est l'élève dans cet
   * exercice : la case prend l'état de l'exercice (un exercice d'initiation
   * peut être acquis), le critère n'étant acquis qu'avec un exercice de maîtrise.
   */
  private etatCase(cellule: CelluleMatrice): CelluleMatrice {
    return cellule.statutExercice ? { ...cellule, statut: cellule.statutExercice } : cellule;
  }

  etatExercice(cellule: CelluleMatrice): CelluleMatrice {
    return this.etatCase(cellule);
  }

  suffixeCase(cellule: CelluleMatrice): string {
    return this.suffixe(this.etatCase(cellule));
  }

  libelleCase(cellule: CelluleMatrice | null): string {
    return this.libelle(cellule ? this.etatCase(cellule) : null);
  }

  classeCase(cellule: CelluleMatrice | null): string {
    return this.classe(cellule ? this.etatCase(cellule) : null);
  }

  /** L'exercice et le critère n'ont pas le même état (exercice d'initiation acquis, critère en cours). */
  critereDifferent(cellule: CelluleMatrice | null): boolean {
    return !!cellule?.statutExercice && cellule.statutExercice !== cellule.statut;
  }

  titreCase(cellule: CelluleMatrice | null): string {
    if (!cellule) return '';
    const exo = this.exerciceDe(cellule);
    if (!exo && cellule.exerciceLibre && cellule.phaseExercice && cellule.statutExercice) {
      return `Exercice libre « ${cellule.exerciceLibre} » (${libellePhase(cellule.phaseExercice).toLowerCase()}) `
        + `${this.libelleLong(this.etatCase(cellule))} · critère ${this.libelleLong(cellule)}`;
    }
    if (!exo || !cellule.statutExercice) return `Critère ${this.libelleLong(cellule)}`;
    return `Exercice ${exo.numero} (${libellePhase(exo.phase).toLowerCase()}) ${this.libelleLong(this.etatCase(cellule))}`
      + ` · critère ${this.libelleLong(cellule)}`;
  }
}
