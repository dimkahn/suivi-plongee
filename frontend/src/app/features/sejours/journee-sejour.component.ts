import { Component, ChangeDetectionStrategy, computed, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { PalanqueesPlongeeComponent } from './palanquees-plongee.component';
import { dateDuJour } from '../../core/date-fr';
import { AffaireVue, ParticipantVue, jourLong } from './sejour-api';
import { LigneProgramme, VoyageDuJour, decalerJour, jourDuDepart, joursDuVoyage, voyagesDuJour } from './programme-du-jour';

/**
 * L'encart « Aujourd'hui » d'un séjour (demande du club, 2026). Le séjour
 * commence dès le voyage aller (l'avion pris la veille de la première
 * plongée compte) et finit avec le voyage retour. Chaque jour : les voyages
 * qui partent ce jour-là avec l'heure à laquelle être à l'aéroport ou à la
 * gare, puis le programme du jour. La veille d'un voyage, un rappel ; la
 * veille du départ, les affaires indispensables ; la veille du retour, ses
 * comptes à régler. Rien hors de ces jours. La date est celle de
 * l'appareil : c'est sur place que compte « aujourd'hui ».
 * Sert dans le séjour (appli) et sur la page du lien reçu par e-mail.
 */
@Component({
  selector: 'app-journee-sejour',
  imports: [NgTemplateOutlet, PalanqueesPlongeeComponent],
  template: `
    @if (journee(); as a) {
      <section class="carte encart-jour" aria-label="Aujourd'hui">
        @if (a.enCours) {
          <h2>Aujourd'hui <span class="date-jour">{{ jourLong(a.jour) }}</span></h2>
          @for (v of a.voyages; track $index) {
            <ng-container [ngTemplateOutlet]="voyage" [ngTemplateOutletContext]="{ $implicit: v }" />
          }
          @if (a.lignes.length > 0) {
            <ul class="lignes">
              @for (l of a.lignes; track $index) {
                <li>
                  <span class="heure">{{ l.heure }}</span>
                  <span class="quoi">
                    <strong>{{ l.titre }}</strong>@if (l.lieu) { <span class="secondaire"> — {{ l.lieu }}</span>}
                    @if (l.details) { <span class="texte-libre secondaire">{{ l.details }}</span> }
                    @if (l.palanquees.length > 0) {
                      <app-palanquees-plongee [palanquees]="l.palanquees" [encadrant]="encadrant()" />
                    }
                  </span>
                </li>
              }
            </ul>
          } @else if (a.voyages.length === 0) {
            <p class="vide">Rien au programme aujourd'hui.</p>
          }
        }
        @if (a.rappel; as r) {
          <div class="rappel" [class.seul]="!a.enCours">
            <h3>Rappel pour demain <span class="date-jour">{{ jourLong(r.jour) }}</span></h3>
            @for (v of r.voyages; track $index) {
              <ng-container [ngTemplateOutlet]="voyage" [ngTemplateOutletContext]="{ $implicit: v }" />
            }
            @if (r.affaires.length > 0) {
              <p><strong>À ne pas oublier :</strong> {{ r.affaires.join(', ') }}.</p>
            }
            @for (c of r.comptes; track $index) {
              <p><strong>Avant de partir :</strong> {{ c }}.</p>
            }
          </div>
        }
      </section>
    }
    <ng-template #voyage let-v>
      <div class="voyage">
        <p><strong>{{ v.sens === 'aller' ? 'Voyage aller' : 'Voyage retour' }} : {{ v.moyen }}</strong>@if (v.heureDepart) { à {{ v.heureDepart }}}@if (v.lieuDepart) {, {{ v.lieuDepart }}}</p>
        @if (v.conseil) { <p class="conseil">{{ v.conseil }}</p> }
        @if (v.heureManquante && aMoi(v)) {
          <p class="secondaire">Donnez l'heure de départ dans « {{ ouCompleter() }} » : vous saurez à quelle heure être sur place.</p>
        }
        @if (v.arrivee) { <p class="secondaire">Arrivée : {{ v.arrivee }}</p> }
        @if (montrerNoms()) { <p class="secondaire">{{ v.noms.join(', ') }}</p> }
      </div>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .encart-jour { margin: var(--pas-2) 0; padding: var(--pas-2); border-left: 6px solid var(--profond); }
    h2 { margin: 0 0 var(--pas); }
    h3 { margin: 0 0 var(--pas); font-size: 1rem; }
    .date-jour { font-size: .9375rem; font-weight: 400; color: var(--craie); }
    .lignes { list-style: none; margin: var(--pas) 0 0; padding: 0; display: grid; gap: var(--pas); }
    .lignes li { display: flex; gap: var(--pas-2); align-items: flex-start; }
    .heure { flex: none; width: 6.5rem; font-weight: 700; color: var(--profond-fonce); }
    .quoi { flex: 1; }
    .texte-libre { white-space: pre-line; display: block; }
    .voyage { margin: var(--pas) 0; padding: var(--pas) var(--pas-2); border-radius: var(--r-s); background: #E0F2FE; }
    .voyage p { margin: 2px 0; }
    .conseil { font-weight: 700; color: var(--profond-fonce); font-size: 1.0625rem; }
    .rappel { margin-top: var(--pas-2); padding-top: var(--pas-2); border-top: 1px solid var(--trait); }
    .rappel.seul { margin-top: 0; padding-top: 0; border-top: none; }
    .rappel p { margin: var(--pas) 0 0; }
    @media (max-width: 640px) { .heure { width: 4.5rem; } }
    @media print { .encart-jour { display: none; } }
  `]
})
export class JourneeSejourComponent {
  /** Ceux dont on montre les voyages : soi-même pour un participant, tout le monde pour un encadrant. */
  participants = input.required<ParticipantVue[]>();
  /** Encadrant : le nom de ceux qui prennent chaque avion ou train. */
  montrerNoms = input(false);
  /** Encadrant : toutes les palanquées de chaque plongée, pas seulement la sienne. */
  encadrant = input(false);
  moiId = input<number | null>(null);
  dateDebut = input.required<string>();
  dateFin = input.required<string>();
  programme = input.required<{ jour: string; lignes: LigneProgramme[] }[]>();
  affaires = input<AffaireVue[]>([]);
  /** Ses remboursements à faire ou à recevoir (« vous devez 25,00 € à Inès Roux »), rappelés la veille du retour. */
  comptes = input<string[]>([]);
  /** Où l'on complète son voyage : « Modifier mes informations », « Mes informations ». */
  ouCompleter = input('Modifier mes informations');

  readonly jourLong = jourLong;
  readonly aujourdhui = signal(dateDuJour());

  /** Ce voyage est le sien (pour l'inviter à compléter l'heure de départ). */
  aMoi(v: VoyageDuJour): boolean {
    const moi = this.moiId();
    return moi !== null && v.ids.includes(moi);
  }

  readonly journee = computed(() => {
    const concernes = this.participants();
    const voyage = joursDuVoyage(concernes, this.dateDebut(), this.dateFin());
    const jour = this.aujourdhui();
    const demain = decalerJour(jour, 1);
    if (demain < voyage.debut || jour > voyage.fin) return null;

    const enCours = jour >= voyage.debut;
    const voyagesDemain = voyagesDuJour(concernes, demain);
    const affaires = demain === voyage.debut ? this.affaires().filter(a => a.indispensable).map(a => a.libelle) : [];
    const moi = concernes.find(p => p.id === this.moiId());
    const comptes = moi && jourDuDepart(moi.depart, 'retour') === demain ? this.comptes() : [];
    const rappel = voyagesDemain.length || affaires.length || comptes.length
      ? { jour: demain, voyages: voyagesDemain, affaires, comptes } : null;
    if (!enCours && !rappel) return null;
    return {
      jour, enCours, rappel,
      voyages: enCours ? voyagesDuJour(concernes, jour) : [],
      lignes: this.programme().find(j => j.jour === jour)?.lignes ?? []
    };
  });
}
