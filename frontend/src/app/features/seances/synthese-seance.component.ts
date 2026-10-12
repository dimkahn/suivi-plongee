import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ReseauService } from '../../core/reseau.service';
import { EleveSyntheseVue, NoteSyntheseVue, Statut, SyntheseSeanceVue } from '../../core/modeles';
import { PastillePhaseComponent } from '../../core/phase-exercice';
import { dateFr } from '../../core/date-fr';
import { PlurielPipe } from '../../core/pluriel';
import { libellePreparation } from '../../core/niveaux';
import { PhotoEleveComponent } from '../../core/photo-eleve.component';

const ATELIERS: Record<string, string> = { NAGE: 'nage', BLOC: 'bloc', THEORIE: 'théorie', PLONGEE: 'plongée' };

/**
 * Synthèse des notations d'une séance pour un niveau (choix du club, 2026) :
 * critère par critère, combien d'élèves en sont à « acquis », « en cours »
 * ou « non abordé » à la fin de la séance, puis élève par élève ce qu'il a
 * reçu, et les présents pas encore évalués. L'état montré est celui de
 * l'exercice noté (`statutAffiche`), celui de la compétence n'est rappelé
 * que s'il diffère. Lecture seule, réseau obligatoire.
 */
@Component({
  selector: 'app-synthese-seance',
  imports: [RouterLink, NgTemplateOutlet, PastillePhaseComponent, PhotoEleveComponent, PlurielPipe],
  template: `
    <h1>Synthèse des notes</h1>

    @if (!reseau.enLigne()) {
      <div class="alerte" role="status">La synthèse des notes s'affiche avec du réseau.</div>
    }
    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (synthese(); as s) {
      <p class="secondaire">
        Séance du {{ dateFr(s.date) }}{{ s.lieu ? ' · ' + s.lieu : '' }}
        · {{ s.milieu === 'NATUREL' ? 'Milieu naturel' : 'Piscine / fosse' }}
      </p>

      @if (s.niveaux.length === 0) {
        <div class="carte vide"><p>Aucun élève noté présent à cette séance : faites d'abord l'appel.</p></div>
      } @else {
        <div class="niveaux" role="group" aria-label="Niveau">
          @for (n of s.niveaux; track n) {
            <button type="button" class="bouton-discret" [class.actif]="n === s.niveau"
                    [attr.aria-pressed]="n === s.niveau" (click)="choisirNiveau(n)">
              {{ libellePreparation(n) }}
            </button>
          }
          <button type="button" class="bouton-discret imprimer" (click)="imprimer()">Imprimer</button>
        </div>

        <p class="bilan" role="status">
          {{ s.presents | pluriel:'présent' }} · {{ s.presentsNotes | pluriel:'évalué' }}
          · {{ s.notes | pluriel:'note saisie':'notes saisies' }}
          @if (s.presents > s.presentsNotes) {
            · <strong class="non-notes">{{ s.presents - s.presentsNotes | pluriel:'pas encore évalué':'pas encore évalués' }}</strong>
          }
        </p>

        <div class="vues" role="tablist">
          <button type="button" role="tab" class="bouton-discret" [class.actif]="vue() === 'TABLEAU'"
                  [attr.aria-selected]="vue() === 'TABLEAU'" (click)="vue.set('TABLEAU')">Tableau</button>
          <button type="button" role="tab" class="bouton-discret" [class.actif]="vue() === 'CRITERES'"
                  [attr.aria-selected]="vue() === 'CRITERES'" (click)="vue.set('CRITERES')">Par critère</button>
          <button type="button" role="tab" class="bouton-discret" [class.actif]="vue() === 'ELEVES'"
                  [attr.aria-selected]="vue() === 'ELEVES'" (click)="vue.set('ELEVES')">Par élève</button>
        </div>

        @if (vue() === 'TABLEAU') {
          <div class="defilement">
            <table class="tableau">
              <thead>
                <tr>
                  <th scope="col" class="col-eleve">Élève</th>
                  @for (c of s.criteres; track c.critereId) {
                    <th scope="col" class="col-critere" [title]="c.bloc + ' — ' + c.savoirFaire">
                      <span>{{ c.savoirFaire }}</span>
                    </th>
                  }
                  <th scope="col" class="col-commentaire">Commentaire</th>
                </tr>
              </thead>
              <tbody>
                @for (e of s.eleves; track e.cursusId) {
                  <tr>
                    <th scope="row" class="col-eleve">
                      <div class="identite">
                        <app-photo-eleve [eleveId]="e.eleveId" [nom]="e.eleve" [aPhoto]="e.aPhoto" />
                        <div>
                          <a [routerLink]="['/cursus', e.cursusId]" [queryParams]="lienGrille()">{{ e.eleve }}</a>
                          <span class="note-par">{{ sousTitre(e) }}</span>
                        </div>
                      </div>
                    </th>
                    @for (c of s.criteres; track c.critereId) {
                      @let n = noteDe(e.notes, c.critereId);
                      <td class="case">
                        @if (n) {
                          <span [class]="'etat ' + classe(n.statutAffiche)" [title]="detailCase(n)">{{ abrege(n.statutAffiche) }}</span>
                        } @else {
                          <span class="secondaire" aria-label="pas de note">–</span>
                        }
                      </td>
                    }
                    <td class="col-commentaire">
                      @for (n of e.notes; track n.critereId) {
                        @for (texte of n.commentaires; track $index) {
                          <span class="commentaire-ligne"><strong>{{ n.savoirFaire }} :</strong> {{ texte }}</span>
                        }
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="secondaire legende">État de l'exercice noté : A acquis · EC en cours · NA non abordé · – pas de note. Exercice et encadrant de chaque note : vues « Par critère » et « Par élève ».</p>
        } @else if (vue() === 'CRITERES') {
          @if (s.criteres.length === 0) {
            <div class="carte vide"><p>Aucune note n'a encore été prise sur cette séance pour ce niveau.</p></div>
          }
          @for (c of s.criteres; track c.critereId) {
            <section class="carte critere">
              <p class="bloc secondaire">{{ c.regroupement ? c.regroupement + ' · ' : '' }}{{ c.bloc }}</p>
              <h2>{{ c.savoirFaire }}</h2>
              <p class="compteurs">
                <span class="etat acquis">{{ c.acquis }} acquis</span>
                <span class="etat encours">{{ c.enCours }} en cours</span>
                @if (c.nonAborde > 0) { <span class="etat neant">{{ c.nonAborde }} non abordé</span> }
              </p>
              <ul class="notes">
                @for (n of c.notes; track n.cursusId) {
                  <li>
                    @let el = eleveDe(n.cursusId);
                    <a class="identite" [routerLink]="['/cursus', n.cursusId]" [queryParams]="lienGrille()">
                      @if (el) { <app-photo-eleve [eleveId]="el.eleveId" [nom]="el.eleve" [aPhoto]="el.aPhoto" [taille]="32" /> }
                      {{ n.eleve }}
                    </a>
                    <ng-container *ngTemplateOutlet="detail; context: { $implicit: n }" />
                  </li>
                }
              </ul>
            </section>
          }
        } @else {
          @for (e of s.eleves; track e.cursusId) {
            <section class="carte eleve">
              <h2>
                <a class="identite" [routerLink]="['/cursus', e.cursusId]" [queryParams]="lienGrille()">
                  <app-photo-eleve [eleveId]="e.eleveId" [nom]="e.eleve" [aPhoto]="e.aPhoto" />
                  {{ e.eleve }}
                </a>
              </h2>
              @if (e.notes.length === 0) {
                <p class="non-notes">Pas encore évalué sur cette séance.</p>
              } @else {
                <ul class="notes">
                  @for (n of e.notes; track n.critereId) {
                    <li>
                      <span class="savoir-faire">{{ n.savoirFaire }}</span>
                      <ng-container *ngTemplateOutlet="detail; context: { $implicit: n }" />
                    </li>
                  }
                </ul>
              }
            </section>
          }
        }
      }
    } @else if (chargement()) {
      <p class="vide">Chargement…</p>
    }

    <ng-template #detail let-n>
      <span class="ligne-detail">
        <span class="etat" [class]="'etat ' + classe(n.statutAffiche)">{{ libelle(n.statutAffiche) }}</span>
        @if (n.exercice; as exo) {
          <app-pastille-phase [phase]="exo.phase" [numero]="exo.numero" [intitule]="exo.intitule" />
        }
        @if (n.statutAffiche !== n.statut) {
          <span class="secondaire">compétence {{ libelle(n.statut).toLowerCase() }}</span>
        }
        @if (n.entrainement) { <span class="secondaire">entraînement</span> }
        <span class="secondaire">{{ parQui(n) }}</span>
      </span>
      @for (texte of n.commentaires; track $index) {
        <span class="commentaire">« {{ texte }} »</span>
      }
    </ng-template>
  `,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .niveaux, .vues { display: flex; flex-wrap: wrap; gap: var(--pas); margin: var(--pas-2) 0; }
    .niveaux .actif, .vues .actif { background: var(--profond); border-color: var(--profond); color: #fff; }
    .imprimer { margin-left: auto; }
    .bilan { color: var(--craie); font-size: .875rem; }
    .non-notes { color: var(--en-cours); }
    .carte { margin-top: var(--pas-2); padding: var(--pas-2) var(--pas-3); }
    .carte h2 { margin: 0; font-size: 1rem; }
    .bloc { margin: 0; font-size: .8125rem; }
    .compteurs { display: flex; flex-wrap: wrap; gap: var(--pas); margin: var(--pas) 0; }
    .etat { display: inline-block; padding: 2px var(--pas); border-radius: var(--r-s); font-size: .8125rem;
            font-weight: 700; border: 1px solid var(--trait); }
    .etat.acquis { background: var(--acquis-clair); border-color: var(--acquis); color: var(--acquis); }
    .etat.encours { background: var(--en-cours-clair); border-color: var(--en-cours); color: var(--en-cours); }
    .etat.neant { color: var(--craie); }
    .notes { list-style: none; margin: var(--pas) 0 0; padding: 0; display: grid; gap: var(--pas); }
    .notes li { display: flex; flex-direction: column; gap: 2px; padding-top: var(--pas);
                border-top: 1px solid var(--trait); }
    .notes a, .carte h2 a { display: inline-flex; align-items: center; min-height: 44px; font-weight: 700; }
    .savoir-faire { font-weight: 700; }
    .ligne-detail { display: flex; flex-wrap: wrap; align-items: center; gap: var(--pas); font-size: .875rem; }
    .commentaire { font-size: .875rem; font-style: italic; }
    .defilement { overflow-x: auto; margin-top: var(--pas-2); border: 1px solid var(--trait);
                  border-radius: var(--r-s); background: var(--carte); }
    .tableau { border-collapse: collapse; font-size: .875rem; min-width: 100%; }
    .tableau th, .tableau td { padding: var(--pas); border-bottom: 1px solid var(--trait); vertical-align: middle; }
    .tableau thead th { vertical-align: bottom; text-align: left; }
    .col-eleve { position: sticky; left: 0; background: var(--carte); text-align: left; min-width: 150px; }
    .col-eleve a { min-height: 32px; }
    .identite { display: flex; align-items: center; gap: var(--pas); }
    .note-par { display: block; font-weight: 400; font-size: .8125rem; color: var(--craie); }
    .col-critere { width: 2.5rem; }
    .col-critere span { display: inline-block; writing-mode: vertical-rl; transform: rotate(180deg);
                        max-height: 12rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .case { text-align: center; }
    .case .etat { min-width: 2rem; text-align: center; cursor: help; }
    .col-commentaire { min-width: 220px; }
    .commentaire-ligne { display: block; }
    .legende { font-size: .8125rem; }
    @media print {
      .defilement { overflow: visible; border: 0; }
      .niveaux, .vues, .alerte { display: none; }
      .carte { break-inside: avoid; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SyntheseSeanceComponent {
  private api = inject(ApiService);
  reseau = inject(ReseauService);

  id = input.required<string>();
  /** Niveau à afficher d'emblée (?niveau=N1), tiré du groupe filtré dans la feuille de présence. */
  niveau = input<string>();
  /** Groupe filtré dans la feuille de présence, pour y revenir telle quelle. */
  groupe = input<string>();

  synthese = signal<SyntheseSeanceVue | null>(null);
  chargement = signal(false);
  message = signal<string | null>(null);
  vue = signal<'TABLEAU' | 'CRITERES' | 'ELEVES'>('TABLEAU');

  readonly dateFr = dateFr;
  readonly libellePreparation = libellePreparation;

  lienGrille = computed(() => ({ seance: this.id(), depuis: 'presences', groupe: this.groupe() ?? null }));

  constructor() {
    effect(() => {
      const id = Number(this.id());
      const niveau = this.niveau() ?? null;
      untracked(() => void this.charger(id, niveau));
    });
  }

  choisirNiveau(niveau: string): void {
    void this.charger(Number(this.id()), niveau);
  }

  imprimer(): void {
    window.print();
  }

  private async charger(seanceId: number, niveau: string | null): Promise<void> {
    this.chargement.set(true);
    this.message.set(null);
    try {
      this.synthese.set(await firstValueFrom(this.api.syntheseSeance(seanceId, niveau)));
    } catch (e) {
      this.message.set(e instanceof HttpErrorResponse && e.error?.detail
        ? e.error.detail : 'La synthèse n’a pas pu être chargée.');
    } finally {
      this.chargement.set(false);
    }
  }

  libelle(statut: Statut): string {
    return statut === 'ACQUIS' ? 'Acquis' : statut === 'EN_COURS' ? 'En cours' : 'Non abordé';
  }

  classe(statut: Statut): string {
    return statut === 'ACQUIS' ? 'acquis' : statut === 'EN_COURS' ? 'encours' : 'neant';
  }

  /** L'élève d'une note, pour sa photo dans la vue « Par critère ». */
  eleveDe(cursusId: number): EleveSyntheseVue | null {
    return this.synthese()?.eleves.find(e => e.cursusId === cursusId) ?? null;
  }

  noteDe(notes: NoteSyntheseVue[], critereId: number): NoteSyntheseVue | null {
    return notes.find(n => n.critereId === critereId) ?? null;
  }

  abrege(statut: Statut): string {
    return statut === 'ACQUIS' ? 'A' : statut === 'EN_COURS' ? 'EC' : 'NA';
  }

  /** Sous le nom, comme sur le tableau papier : qui l'a noté, et ce qu'il a fait (nage, bloc + théorie...). */
  sousTitre(e: EleveSyntheseVue): string {
    const atelier = e.atelier
      ? e.atelier.split('+').map(a => ATELIERS[a] ?? a.toLowerCase()).join(' + ')
      : null;
    const qui = e.notePar.length > 0 ? e.notePar.join(', ') : 'pas encore évalué';
    return atelier ? `${qui} · ${atelier}` : qui;
  }

  detailCase(n: NoteSyntheseVue): string {
    const exercice = n.exercice ? ` · ${n.exercice.numero ? n.exercice.numero + ' ' : ''}${n.exercice.intitule}` : '';
    const competence = n.statutAffiche !== n.statut ? ` (compétence ${this.libelle(n.statut).toLowerCase()})` : '';
    return `${this.libelle(n.statutAffiche)}${exercice}${competence} · ${this.parQui(n)}`;
  }

  parQui(n: NoteSyntheseVue): string {
    return n.saisiPar ? `${n.parQui} (saisi par ${n.saisiPar})` : n.parQui;
  }
}
