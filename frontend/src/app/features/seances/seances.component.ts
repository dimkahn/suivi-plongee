import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../core/api.service';
import { SeanceVue } from '../../core/modeles';
import { DateFrPipe, dateFr } from '../../core/date-fr';

interface FormulaireSeance {
  dateSeance: string;
  ordre: number;
  milieu: 'ARTIFICIEL' | 'NATUREL';
  lieu: string;
  profondeurMax: number | null;
  commentaire: string;
}

function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/** Date locale au format AAAA-MM-JJ, sans passer par l'UTC (sinon décalage d'un jour). */
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface JourCalendrier {
  date: string;
  numero: number;
  horsMois: boolean;
  seances: SeanceVue[];
}

const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function formulaireVide(): FormulaireSeance {
  return { dateSeance: '', ordre: 1, milieu: 'ARTIFICIEL', lieu: '', profondeurMax: null, commentaire: '' };
}

@Component({
  selector: 'app-seances',
  imports: [FormsModule, DateFrPipe],
  template: `
    <h1>Séances</h1>
    <p class="secondaire">
      Ouvre une séance sur la saison courante, pour y rattacher présences et
      notations. Milieu et profondeur se figent dès qu'une présence ou une
      évaluation y est rattachée.
    </p>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <section class="carte panneau" id="nouvelle-seance">
      <h2>Nouvelle séance</h2>
      @if (formulaireCreation(); as f) {
        <label for="date">Date</label>
        <input id="date" type="date" name="date" [(ngModel)]="f.dateSeance">

        <label for="ordre">N° de plongée dans la journée</label>
        <input id="ordre" type="number" name="ordre" min="1" [(ngModel)]="f.ordre">

        <label for="milieu">Milieu</label>
        <select id="milieu" name="milieu" [(ngModel)]="f.milieu">
          <option value="ARTIFICIEL">Piscine / fosse (artificiel)</option>
          <option value="NATUREL">Mer / lac / carrière (naturel)</option>
        </select>

        <label for="lieu">Lieu</label>
        <input id="lieu" type="text" name="lieu" [(ngModel)]="f.lieu" placeholder="Facultatif">

        <label for="profondeur">Profondeur max (m)</label>
        <input id="profondeur" type="number" name="profondeur" min="0"
               [(ngModel)]="f.profondeurMax" placeholder="Facultatif">

        <label for="commentaire">Commentaire</label>
        <textarea id="commentaire" name="commentaire" rows="2"
                  [(ngModel)]="f.commentaire" placeholder="Facultatif"></textarea>

        <button type="button" class="bouton-principal" (click)="creer()" [disabled]="envoi()">
          {{ envoi() ? 'Création…' : 'Créer la séance' }}
        </button>
      }
    </section>

    <div class="onglets" role="group" aria-label="Affichage des séances">
      <button type="button" class="bouton-discret" [class.actif]="vue() === 'LISTE'"
              [attr.aria-pressed]="vue() === 'LISTE'" (click)="vue.set('LISTE')">
        Liste
      </button>
      <button type="button" class="bouton-discret" [class.actif]="vue() === 'CALENDRIER'"
              [attr.aria-pressed]="vue() === 'CALENDRIER'" (click)="vue.set('CALENDRIER')">
        Calendrier
      </button>
    </div>

    @if (vue() === 'LISTE') {
      <label for="recherche-seance">Rechercher une séance</label>
      <input id="recherche-seance" type="search" name="rechercheSeance"
             placeholder="Date (12/10, 12/10/2026, 2026-10), lieu, milieu ou commentaire"
             [ngModel]="recherche()" (ngModelChange)="recherche.set($event)">
    } @else {
      <section class="carte calendrier" aria-label="Calendrier des séances">
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
                    [attr.aria-pressed]="jour.date === jourSelectionne()"
                    [attr.aria-label]="(jour.date | dateFr) + (jour.seances.length ? ', ' + jour.seances.length + ' séance(s)' : '')"
                    (click)="jourSelectionne.set(jour.date)">
              <span class="numero">{{ jour.numero }}</span>
              @for (s of jour.seances; track s.id) {
                <span class="pastille" [class.naturel]="s.milieu === 'NATUREL'">
                  <span class="libelle-pastille">{{ s.lieu || (s.milieu === 'NATUREL' ? 'Naturel' : 'Piscine') }}</span>
                </span>
              }
            </button>
          }
        </div>
        <p class="legende secondaire">
          <span class="pastille"></span> Piscine / fosse
          <span class="pastille naturel"></span> Milieu naturel
        </p>
      </section>

      @if (jourSelectionne(); as j) {
        <h2 class="titre-jour">{{ j | dateFr }}</h2>
        @if (seancesAffichees().length === 0) {
          <div class="carte vide">
            <p>Aucune séance ce jour-là.</p>
            <button type="button" class="bouton-discret" (click)="preparerCreation(j)">
              Créer une séance ce jour
            </button>
          </div>
        }
      }
    }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (vue() === 'LISTE' && liste().length === 0) {
      <div class="carte vide"><p>Aucune séance sur cette saison.</p></div>
    } @else if (vue() === 'LISTE' && listeFiltree().length === 0) {
      <div class="carte vide"><p>Aucune séance ne correspond à la recherche.</p></div>
    } @else if (seancesAffichees().length > 0) {
      <ul>
        @for (s of seancesAffichees(); track s.id) {
          <li class="carte">
            @if (edition() === s.id) {
              @if (formulaireEdition(); as f) {
                <label [for]="'date-' + s.id">Date</label>
                <input [id]="'date-' + s.id" type="date" name="date" [(ngModel)]="f.dateSeance">

                <label [for]="'ordre-' + s.id">N° de plongée dans la journée</label>
                <input [id]="'ordre-' + s.id" type="number" min="1" name="ordre" [(ngModel)]="f.ordre">

                <label [for]="'milieu-' + s.id">Milieu</label>
                <select [id]="'milieu-' + s.id" name="milieu" [(ngModel)]="f.milieu" [disabled]="!s.modifiable">
                  <option value="ARTIFICIEL">Piscine / fosse (artificiel)</option>
                  <option value="NATUREL">Mer / lac / carrière (naturel)</option>
                </select>

                <label [for]="'lieu-' + s.id">Lieu</label>
                <input [id]="'lieu-' + s.id" type="text" name="lieu" [(ngModel)]="f.lieu">

                <label [for]="'profondeur-' + s.id">Profondeur max (m)</label>
                <input [id]="'profondeur-' + s.id" type="number" min="0" name="profondeur"
                       [(ngModel)]="f.profondeurMax" [disabled]="!s.modifiable">

                <label [for]="'commentaire-' + s.id">Commentaire</label>
                <textarea [id]="'commentaire-' + s.id" name="commentaire" rows="2"
                          [(ngModel)]="f.commentaire"></textarea>

                @if (!s.modifiable) {
                  <p class="secondaire">
                    Milieu et profondeur ne peuvent plus changer : des présences ou évaluations
                    sont déjà rattachées à cette séance.
                  </p>
                }

                <div class="actions">
                  <button type="button" class="bouton-principal" (click)="enregistrer(s)"
                          [disabled]="envoi()">
                    {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
                  </button>
                  <button type="button" class="bouton-discret" (click)="annulerEdition()">Annuler</button>
                </div>
              }
            } @else {
              <div class="ligne">
                <div class="identite">
                  <span class="nom">{{ s.date | dateFr }}{{ s.ordre > 1 ? ' (n° ' + s.ordre + ')' : '' }}{{ s.lieu ? ' — ' + s.lieu : '' }}</span>
                  <span class="secondaire">
                    {{ s.milieu === 'NATUREL' ? 'Milieu naturel' : 'Milieu artificiel' }}
                    {{ s.profondeurMax ? ' · ' + s.profondeurMax + ' m' : '' }}
                  </span>
                  @if (s.commentaire) { <span class="secondaire">{{ s.commentaire }}</span> }
                </div>
                <div class="actions">
                  <button type="button" class="bouton-discret" (click)="commencerEdition(s)">
                    Modifier
                  </button>
                  @if (s.modifiable) {
                    <button type="button" class="bouton-discret danger" (click)="supprimer(s)">
                      Supprimer
                    </button>
                  }
                </div>
              </div>
            }
          </li>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .panneau { max-width: 480px; padding: var(--pas-3); margin: var(--pas-3) 0; }
    .panneau h2 { margin-bottom: 4px; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    textarea { resize: vertical; }
    .bouton-principal { width: 100%; margin-top: var(--pas-3); }

    #recherche-seance { max-width: 420px; margin-bottom: var(--pas-2); }

    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2); }
    li { padding: var(--pas-2); }
    .ligne { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas-2); }
    .identite { display: flex; flex-direction: column; gap: 2px; }
    .nom { font-weight: 700; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }
    .actions .bouton-principal { width: auto; margin-top: 0; }
    .danger { color: #B3261E; border-color: #B3261E; }

    .onglets { display: flex; gap: var(--pas); margin: var(--pas-3) 0 var(--pas-2); }
    .onglets .bouton-discret.actif { background: var(--profond); color: #fff; border-color: var(--profond); }

    .calendrier { padding: var(--pas-2); margin-bottom: var(--pas-3); max-width: 900px; }
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
    .jour.aujourdhui .numero { background: var(--accent); color: #fff; border-radius: 50%; }
    .jour.selectionne { border: 2px solid var(--profond); padding: 3px; }
    .numero { align-self: flex-start; min-width: 22px; text-align: center; font-size: .8125rem; font-weight: 700; line-height: 22px; }
    .pastille {
      display: block; min-width: 0; padding: 1px 4px; border-radius: 4px;
      background: var(--accent-clair); color: var(--encre); font-size: .6875rem; line-height: 1.3;
    }
    .pastille.naturel { background: var(--profond); color: #fff; }
    .libelle-pastille { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .legende { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin: var(--pas-2) 0 0; font-size: .8125rem; }
    .legende .pastille { display: inline-block; width: 14px; height: 14px; padding: 0; }
    .legende .pastille.naturel { margin-left: var(--pas-2); }
    .titre-jour { margin: 0 0 var(--pas-2); }

    @media (max-width: 600px) {
      .ligne { flex-direction: column; }
      /* Trop étroit pour lire un lieu : une pastille colorée par séance suffit,
         le détail s'affiche sous le calendrier au toucher du jour. */
      .calendrier { padding: var(--pas); }
      .jour { min-height: 52px; padding: 2px; flex-direction: row; flex-wrap: wrap; align-content: flex-start; }
      .jour.selectionne { padding: 1px; }
      .numero { flex: 1 1 100%; }
      .jour .pastille { width: 10px; height: 10px; padding: 0; border-radius: 50%; }
      .jour .libelle-pastille { display: none; }
    }
  `]
})
export class SeancesComponent {
  private api = inject(ApiService);

  liste = signal<SeanceVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  envoi = signal(false);

  recherche = signal('');

  vue = signal<'LISTE' | 'CALENDRIER'>('LISTE');
  readonly joursSemaine = JOURS_SEMAINE;
  readonly aujourdhui = iso(new Date());
  /** Premier jour du mois affiché dans le calendrier. */
  moisAffiche = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  jourSelectionne = signal<string | null>(this.aujourdhui);

  libelleMois = computed(() =>
    this.moisAffiche().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));

  private seancesParDate = computed(() => {
    const index = new Map<string, SeanceVue[]>();
    for (const s of this.liste()) {
      const jour = index.get(s.date);
      if (jour) jour.push(s); else index.set(s.date, [s]);
    }
    return index;
  });

  /** Semaines complètes du lundi au dimanche couvrant le mois affiché. */
  joursDuMois = computed<JourCalendrier[]>(() => {
    const debut = this.moisAffiche();
    const mois = debut.getMonth();
    const curseur = new Date(debut);
    curseur.setDate(1 - (debut.getDay() + 6) % 7);
    const jours: JourCalendrier[] = [];
    do {
      for (let i = 0; i < 7; i++) {
        const date = iso(curseur);
        jours.push({
          date, numero: curseur.getDate(), horsMois: curseur.getMonth() !== mois,
          seances: this.seancesParDate().get(date) ?? []
        });
        curseur.setDate(curseur.getDate() + 1);
      }
    } while (curseur.getMonth() === mois);
    return jours;
  });

  /** En liste : le résultat de la recherche ; en calendrier : les séances du jour touché. */
  seancesAffichees = computed(() => {
    if (this.vue() === 'LISTE') return this.listeFiltree();
    const jour = this.jourSelectionne();
    return jour ? this.seancesParDate().get(jour) ?? [] : [];
  });

  /** Un seul champ : date (ISO ou JJ/MM/AAAA), lieu, milieu ou commentaire, sans accents ni casse. */
  listeFiltree = computed(() => {
    const recherche = normaliser(this.recherche());
    if (!recherche) return this.liste();
    return this.liste().filter(s =>
      [s.date, dateFr(s.date), s.lieu ?? '', s.commentaire ?? '',
       s.milieu === 'NATUREL' ? 'milieu naturel' : 'milieu artificiel piscine fosse']
        .some(champ => normaliser(champ).includes(recherche)));
  });

  formulaireCreation = signal<FormulaireSeance>(formulaireVide());

  edition = signal<number | null>(null);
  formulaireEdition = signal<FormulaireSeance | null>(null);

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    this.chargement.set(true);
    try {
      this.liste.set(await this.api.seances());
    } catch {
      this.message.set('Impossible de charger les séances.');
    } finally {
      this.chargement.set(false);
    }
  }

  changerMois(delta: number): void {
    const m = this.moisAffiche();
    this.moisAffiche.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  allerAujourdhui(): void {
    const t = new Date();
    this.moisAffiche.set(new Date(t.getFullYear(), t.getMonth(), 1));
    this.jourSelectionne.set(this.aujourdhui);
  }

  /** Pré-remplit la date du formulaire de création et le fait défiler à l'écran. */
  preparerCreation(date: string): void {
    this.formulaireCreation.set({ ...formulaireVide(), dateSeance: date });
    document.getElementById('nouvelle-seance')?.scrollIntoView({ behavior: 'smooth' });
  }

  creer(): void {
    const f = this.formulaireCreation();
    if (!f.dateSeance) {
      this.message.set('La date de la séance est obligatoire.');
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    this.api.creerSeance({
      dateSeance: f.dateSeance,
      ordre: f.ordre,
      milieu: f.milieu,
      lieu: f.lieu || null,
      profondeurMax: f.profondeurMax,
      commentaire: f.commentaire || null
    }).subscribe({
      next: s => {
        this.envoi.set(false);
        this.liste.set([...this.liste(), s]
          .sort((a, b) => a.date.localeCompare(b.date) || a.ordre - b.ordre));
        this.formulaireCreation.set(formulaireVide());
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "La création de la séance a échoué.");
      }
    });
  }

  commencerEdition(s: SeanceVue): void {
    this.message.set(null);
    this.edition.set(s.id);
    this.formulaireEdition.set({
      dateSeance: s.date, ordre: s.ordre, milieu: s.milieu, lieu: s.lieu ?? '',
      profondeurMax: s.profondeurMax, commentaire: s.commentaire ?? ''
    });
  }

  annulerEdition(): void {
    this.edition.set(null);
    this.formulaireEdition.set(null);
  }

  enregistrer(s: SeanceVue): void {
    const f = this.formulaireEdition();
    if (!f) return;
    this.envoi.set(true);
    this.message.set(null);
    this.api.modifierSeance(s.id, {
      dateSeance: f.dateSeance,
      ordre: f.ordre,
      milieu: f.milieu,
      lieu: f.lieu || null,
      profondeurMax: f.profondeurMax,
      commentaire: f.commentaire || null
    }).subscribe({
      next: maj => {
        this.envoi.set(false);
        this.liste.set(this.liste().map(x => x.id === maj.id ? maj : x)
          .sort((a, b) => a.date.localeCompare(b.date) || a.ordre - b.ordre));
        this.annulerEdition();
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "La modification n'a pas pu être enregistrée.");
      }
    });
  }

  supprimer(s: SeanceVue): void {
    if (!confirm(`Supprimer la séance du ${dateFr(s.date)} ?`)) return;
    this.message.set(null);
    this.api.supprimerSeance(s.id).subscribe({
      next: () => this.liste.set(this.liste().filter(x => x.id !== s.id)),
      error: (e: HttpErrorResponse) =>
        this.message.set(e.error?.detail ?? "La suppression n'a pas pu être enregistrée.")
    });
  }
}
