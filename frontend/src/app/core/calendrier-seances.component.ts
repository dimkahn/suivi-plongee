import { Component, OnInit, computed, input, model, signal, ChangeDetectionStrategy } from '@angular/core';
import { SeanceVue } from './modeles';
import { DateFrPipe, dateDuJour } from './date-fr';

interface JourCalendrier {
  date: string;
  numero: number;
  horsMois: boolean;
  horsLimite: boolean;
  seances: SeanceVue[];
}

/** Date locale au format AAAA-MM-JJ, sans passer par l'UTC (sinon décalage d'un jour). */
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function premierDuMois(date: string): Date {
  const [a, m] = date.split('-').map(Number);
  return new Date(a, m - 1, 1);
}

/**
 * Calendrier mensuel des séances (lundi à dimanche), chaque séance colorée
 * selon le milieu. Toucher un jour le sélectionne (`jourSelectionne`) : c'est
 * à l'écran parent d'afficher les séances de ce jour. Utilisé par l'écran
 * Séances et par le choix de séance de la feuille de présence.
 */
@Component({
  selector: 'app-calendrier-seances',
  imports: [DateFrPipe],
  template: `
    <div class="navigation-mois">
      <button type="button" class="bouton-discret" (click)="changerMois(-1)" aria-label="Mois précédent">‹</button>
      <h2>{{ libelleMois() }}</h2>
      <button type="button" class="bouton-discret" (click)="changerMois(1)" aria-label="Mois suivant">›</button>
    </div>
    <button type="button" class="bouton-discret aujourd-hui" (click)="allerAujourdhui()">Aujourd'hui</button>

    <div class="grille-mois">
      @for (j of joursSemaine; track j) {
        <span class="jour-semaine" aria-hidden="true">{{ j }}</span>
      }
      @for (jour of joursDuMois(); track jour.date) {
        <button type="button" class="jour"
                [class.hors-mois]="jour.horsMois"
                [class.aujourdhui]="jour.date === aujourdhui"
                [class.selectionne]="jour.date === jourSelectionne()"
                [disabled]="jour.horsLimite"
                [attr.aria-pressed]="jour.date === jourSelectionne()"
                [attr.aria-label]="(jour.date | dateFr) + (jour.seances.length ? ', ' + jour.seances.length + ' séance(s)' : '')"
                (click)="jourSelectionne.set(jour.date)">
          <span class="numero">{{ jour.numero }}</span>
          @for (s of jour.seances; track s.id) {
            <span class="pastille" [class.naturel]="s.milieu === 'NATUREL'" [class.choisie]="s.id === seanceMarquee()">
              <span class="libelle-pastille">{{ s.lieu || s.site || (s.milieu === 'NATUREL' ? 'Naturel' : 'Piscine') }}</span>
            </span>
          }
        </button>
      }
    </div>
    <p class="legende secondaire">
      <span class="pastille"></span> Piscine / fosse
      <span class="pastille naturel"></span> Milieu naturel
    </p>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host { display: block; }
    .navigation-mois { display: flex; align-items: center; justify-content: space-between; gap: var(--pas); }
    .navigation-mois h2 { margin: 0; text-transform: capitalize; text-align: center; }
    .navigation-mois .bouton-discret { min-width: 44px; font-size: 1.25rem; }
    .aujourd-hui { display: block; margin: var(--pas) auto var(--pas-2); }

    .grille-mois { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; }
    .jour-semaine { text-align: center; font-size: .75rem; font-weight: 700; color: var(--craie); padding-bottom: 4px; }
    .jour {
      display: flex; flex-direction: column; align-items: stretch; gap: 2px;
      min-height: 72px; min-width: 0; padding: 4px; margin: 0;
      background: var(--carte); border: 1px solid var(--trait); border-radius: var(--r-s);
      color: var(--encre); font: inherit; text-align: left; cursor: pointer;
    }
    .jour.hors-mois { background: var(--fond); color: var(--craie); }
    .jour:disabled { opacity: .4; cursor: not-allowed; }
    .jour.aujourdhui .numero { background: var(--accent); color: #fff; border-radius: 50%; }
    .jour.selectionne { border: 2px solid var(--profond); padding: 3px; }
    .numero { align-self: flex-start; min-width: 22px; text-align: center; font-size: .8125rem; font-weight: 700; line-height: 22px; }
    .pastille {
      display: block; min-width: 0; padding: 1px 4px; border-radius: 4px;
      background: var(--accent-clair); color: var(--encre); font-size: .6875rem; line-height: 1.3;
    }
    .pastille.naturel { background: var(--profond); color: #fff; }
    .pastille.choisie { outline: 2px solid var(--profond-fonce); outline-offset: 1px; }
    .libelle-pastille { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .legende { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin: var(--pas-2) 0 0; font-size: .8125rem; }
    .legende .pastille { display: inline-block; width: 14px; height: 14px; padding: 0; }
    .legende .pastille.naturel { margin-left: var(--pas-2); }

    /* Trop étroit pour lire un lieu : une pastille colorée par séance suffit,
       le détail s'affiche sous le calendrier au toucher du jour. */
    @media (max-width: 600px) {
      .jour { min-height: 52px; padding: 2px; flex-direction: row; flex-wrap: wrap; align-content: flex-start; }
      .jour.selectionne { padding: 1px; }
      .numero { flex: 1 1 100%; }
      .jour .pastille { width: 10px; height: 10px; padding: 0; border-radius: 50%; }
      .jour .libelle-pastille { display: none; }
    }
  `]
})
export class CalendrierSeancesComponent implements OnInit {
  seances = input.required<SeanceVue[]>();
  jourSelectionne = model<string | null>(null);
  /** Jours postérieurs non sélectionnables (AAAA-MM-JJ), par exemple le jour même pour une feuille de présence. */
  jourMax = input<string | null>(null);
  /** Séance mise en évidence (celle déjà choisie par l'écran parent). */
  seanceMarquee = input<number | null>(null);

  readonly joursSemaine = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  readonly aujourdhui = dateDuJour();
  /** Premier jour du mois affiché. */
  moisAffiche = signal(premierDuMois(dateDuJour()));

  libelleMois = computed(() =>
    this.moisAffiche().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));

  private seancesParDate = computed(() => {
    const index = new Map<string, SeanceVue[]>();
    for (const s of this.seances()) {
      const jour = index.get(s.date);
      if (jour) jour.push(s); else index.set(s.date, [s]);
    }
    return index;
  });

  /** Semaines complètes du lundi au dimanche couvrant le mois affiché. */
  joursDuMois = computed<JourCalendrier[]>(() => {
    const debut = this.moisAffiche();
    const mois = debut.getMonth();
    const max = this.jourMax();
    const curseur = new Date(debut);
    curseur.setDate(1 - (debut.getDay() + 6) % 7);
    const jours: JourCalendrier[] = [];
    do {
      for (let i = 0; i < 7; i++) {
        const date = iso(curseur);
        jours.push({
          date, numero: curseur.getDate(), horsMois: curseur.getMonth() !== mois,
          horsLimite: max !== null && date > max,
          seances: this.seancesParDate().get(date) ?? []
        });
        curseur.setDate(curseur.getDate() + 1);
      }
    } while (curseur.getMonth() === mois);
    return jours;
  });

  ngOnInit(): void {
    // Ouvre sur le mois du jour déjà sélectionné (la séance choisie), sinon le mois courant.
    const jour = this.jourSelectionne();
    if (jour) this.moisAffiche.set(premierDuMois(jour));
  }

  changerMois(delta: number): void {
    const m = this.moisAffiche();
    this.moisAffiche.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  allerAujourdhui(): void {
    this.moisAffiche.set(premierDuMois(this.aujourdhui));
    this.jourSelectionne.set(this.aujourdhui);
  }
}
