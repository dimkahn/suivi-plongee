import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../core/api.service';
import { DemandeGenerationSaison, GenerationSaisonVue, JourSemaine, SaisonVue } from '../../core/modeles';
import { DateFrPipe, dateFr } from '../../core/date-fr';

const JOURS: { valeur: JourSemaine; libelle: string }[] = [
  { valeur: 'MONDAY', libelle: 'Lundi' }, { valeur: 'TUESDAY', libelle: 'Mardi' },
  { valeur: 'WEDNESDAY', libelle: 'Mercredi' }, { valeur: 'THURSDAY', libelle: 'Jeudi' },
  { valeur: 'FRIDAY', libelle: 'Vendredi' }, { valeur: 'SATURDAY', libelle: 'Samedi' },
  { valeur: 'SUNDAY', libelle: 'Dimanche' }
];

/**
 * Génère toutes les séances d'une saison : la même séance chaque jour de la
 * semaine choisi, sans les vacances scolaires d'une zone (calendrier officiel, lu par le
 * serveur) ni les jours fériés. Toujours un aperçu avant la création : ce qui
 * est créé est exactement ce qui a été prévisualisé.
 */
@Component({
  selector: 'app-generation-saison',
  imports: [FormsModule, RouterLink, DateFrPipe],
  template: `
    <a routerLink="/admin/seances" class="retour">&larr; Séances</a>
    <h1>Générer les séances d'une saison</h1>
    <p class="secondaire">
      Choisissez les jours de la semaine et décrivez la séance : elle est créée chaque semaine de la
      période, sauf pendant les vacances scolaires de la zone choisie et les jours fériés.
    </p>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <section class="carte panneau">
      <h2>Période</h2>
      <label for="saison">Saison</label>
      <select id="saison" name="saison" [ngModel]="saisonId()" (ngModelChange)="choisirSaison($event)">
        <option [ngValue]="null">— Choisir une saison —</option>
        @for (s of saisons(); track s.id) {
          <option [ngValue]="s.id">{{ s.libelle }} ({{ s.dateDebut | dateFr }} → {{ s.dateFin | dateFr }}){{ s.ouverte ? '' : ' — fermée' }}</option>
        }
      </select>

      <div class="deux-colonnes">
        <div>
          <label for="debut">Du</label>
          <input id="debut" type="date" name="debut" [(ngModel)]="form.dateDebut">
        </div>
        <div>
          <label for="fin">Au</label>
          <input id="fin" type="date" name="fin" [(ngModel)]="form.dateFin" [min]="form.dateDebut">
        </div>
      </div>

      <label for="zone">Vacances scolaires à retirer</label>
      <select id="zone" name="zone" [(ngModel)]="form.zoneVacances">
        <option value="A">Zone A</option>
        <option value="B">Zone B</option>
        <option value="C">Zone C (Île-de-France)</option>
        <option value="">Ne pas retirer les vacances</option>
      </select>

      <label class="case">
        <input type="checkbox" name="feries" [(ngModel)]="form.exclureFeries">
        Retirer les jours fériés
      </label>
    </section>

    <section class="carte panneau">
      <h2>Séance</h2>
      <p class="secondaire">
        Une séance est créée chaque jour choisi. Pour deux séances le même jour (piscine et fosse),
        générez deux fois : la seconde prend le n° de plongée suivant.
      </p>
      <div class="jours" role="group" aria-label="Jours de la semaine">
        @for (j of jours; track j.valeur) {
          <button type="button" class="bouton-discret" [class.actif]="form.jours.includes(j.valeur)"
                  [attr.aria-pressed]="form.jours.includes(j.valeur)" (click)="basculerJour(j.valeur)">
            {{ j.libelle }}
          </button>
        }
      </div>
      <div class="grille-seance">
        <div>
          <label for="milieu">Milieu</label>
          <select id="milieu" name="milieu" [(ngModel)]="form.milieu">
            <option value="ARTIFICIEL">Piscine / fosse</option>
            <option value="NATUREL">Milieu naturel</option>
          </select>
        </div>
        <div>
          <label for="lieu">Lieu</label>
          <input id="lieu" type="text" name="lieu" [(ngModel)]="form.lieu" placeholder="Piscine, fosse…">
        </div>
        <div>
          <label for="site">Site</label>
          <input id="site" type="text" name="site" [(ngModel)]="form.site" placeholder="Facultatif">
        </div>
        <div>
          <label for="profondeur">Profondeur max (m)</label>
          <input id="profondeur" type="number" min="0" name="profondeur" [(ngModel)]="form.profondeurMax"
                 placeholder="Facultatif">
        </div>
        <div class="large">
          <label for="info">Info complémentaire</label>
          <input id="info" type="text" name="info" [(ngModel)]="form.info" placeholder="Facultatif">
        </div>
      </div>
    </section>

    <button type="button" class="bouton-principal" (click)="previsualiser()" [disabled]="envoi()">
      {{ envoi() && !apercu() ? 'Calcul…' : 'Prévisualiser' }}
    </button>

    @if (apercu(); as a) {
      <section class="carte panneau apercu" aria-live="polite">
        <h2>{{ a.nbSeances }} séance(s) dans la saison {{ a.saison }}</h2>
        @if (!a.saisonOuverte) {
          <p class="alerte">
            Cette saison n'est pas encore ouverte : ses séances n'apparaîtront dans l'écran Séances
            qu'après son ouverture (Administration → Saisons).
          </p>
        }

        @if (a.seancesExistantes > 0) {
          <p class="alerte">
            Attention : {{ a.seancesExistantes }} séance(s) existent déjà sur cette période. Les nouvelles
            s'y ajouteront (numérotées à la suite), elles ne les remplacent pas.
          </p>
        }

        @if (a.exclusions.length) {
          <h3>Retiré du calendrier</h3>
          <ul class="exclusions">
            @for (e of a.exclusions; track e.motif + e.debut) {
              <li>
                <span class="motif">{{ e.motif }}</span>
                <span class="secondaire">
                  {{ e.debut === e.fin ? (e.debut | dateFr) : (e.debut | dateFr) + ' → ' + (e.fin | dateFr) }}
                  · {{ e.seancesRetirees }} séance(s) retirée(s)
                </span>
              </li>
            }
          </ul>
        }

        <h3>Séances par mois</h3>
        <ul class="mois">
          @for (m of parMois(); track m.mois) {
            <li><span class="nom-mois">{{ m.mois }}</span> {{ m.nombre }}</li>
          }
        </ul>
        <details>
          <summary>Voir toutes les dates</summary>
          <ul class="dates">
            @for (s of a.seances; track $index) {
              <li>{{ s.date | dateFr }} (n° {{ s.ordre }}) — {{ s.lieu || (s.milieu === 'NATUREL' ? 'Milieu naturel' : 'Piscine / fosse') }}{{ s.commentaire ? ' · ' + s.commentaire : '' }}</li>
            }
          </ul>
        </details>

        @if (parametresModifies()) {
          <p class="alerte">Les paramètres ont changé depuis l'aperçu : prévisualisez à nouveau avant de créer.</p>
        }
        <button type="button" class="bouton-principal" (click)="creer()"
                [disabled]="envoi() || a.nbSeances === 0 || parametresModifies()">
          {{ envoi() ? 'Création…' : 'Créer les ' + a.nbSeances + ' séances' }}
        </button>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .retour { display: inline-block; margin-bottom: var(--pas-2); font-size: .875rem; text-decoration: none; }
    h1 { margin-bottom: var(--pas); }
    .panneau { max-width: 900px; padding: var(--pas-3); margin: var(--pas-3) 0; }
    .panneau h2 { margin-bottom: 4px; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .case { display: flex; align-items: center; gap: var(--pas); min-height: 44px; cursor: pointer; }
    .case input { width: 20px; height: 20px; margin: 0; }
    .deux-colonnes { display: grid; grid-template-columns: 1fr 1fr; gap: var(--pas-2); }
    .jours { display: flex; flex-wrap: wrap; gap: var(--pas); margin: var(--pas-2) 0; }
    .jours .bouton-discret.actif { background: var(--profond); color: #fff; border-color: var(--profond); }
    .grille-seance { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 var(--pas-2); }
    .grille-seance input, .grille-seance select { width: 100%; margin: 0; }
    .grille-seance .large { grid-column: 1 / -1; }
    .bouton-principal { max-width: 900px; width: 100%; }
    .apercu h3 { font-size: 1rem; margin: var(--pas-3) 0 var(--pas); }
    .exclusions, .mois, .dates { list-style: none; margin: 0; padding: 0; }
    .exclusions li { display: flex; flex-direction: column; padding: 6px 0; border-bottom: 1px solid var(--trait); }
    .motif { font-weight: 700; }
    .mois { display: flex; flex-wrap: wrap; gap: var(--pas); }
    .mois li { padding: 4px 10px; border-radius: var(--r-s); background: var(--fond); }
    .nom-mois { font-weight: 700; text-transform: capitalize; }
    details { margin: var(--pas-2) 0; }
    summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; color: var(--profond); font-weight: 700; }
    .dates { max-height: 320px; overflow-y: auto; font-size: .875rem; }
    .dates li { padding: 2px 0; }
    .apercu .bouton-principal { margin-top: var(--pas-2); }

    @media (max-width: 720px) {
      .grille-seance { grid-template-columns: 1fr; }
    }
  `]
})
export class GenerationSaisonComponent {
  private api = inject(ApiService);

  readonly jours = JOURS;
  saisons = signal<SaisonVue[]>([]);
  saisonId = signal<number | null>(null);

  form: DemandeGenerationSaison = {
    dateDebut: '', dateFin: '', jours: ['MONDAY'], milieu: 'ARTIFICIEL', lieu: '', site: '',
    profondeurMax: null, info: '', zoneVacances: 'C', exclureFeries: true
  };

  apercu = signal<GenerationSaisonVue | null>(null);
  /** Paramètres exacts de l'aperçu affiché : la création n'accepte que ceux-là. */
  private demandeApercu = signal<string | null>(null);
  envoi = signal(false);
  message = signal<string | null>(null);

  parMois = computed(() => {
    const compte = new Map<string, number>();
    for (const s of this.apercu()?.seances ?? []) {
      const mois = new Date(s.date + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      compte.set(mois, (compte.get(mois) ?? 0) + 1);
    }
    return [...compte].map(([mois, nombre]) => ({ mois, nombre }));
  });

  constructor() {
    this.api.saisons().subscribe({
      next: s => {
        this.saisons.set(s);
        // Par défaut : la saison qui n'a pas encore commencé, sinon la plus récente.
        const aujourdhui = new Date().toISOString().slice(0, 10);
        const cible = [...s].reverse().find(x => x.dateDebut > aujourdhui) ?? s[0];
        if (cible) this.choisirSaison(cible.id);
      },
      error: () => this.message.set('Impossible de charger les saisons.')
    });
  }

  /** Recalculé à chaque rendu : le formulaire est un objet muté par ngModel. */
  parametresModifies(): boolean {
    return this.demandeApercu() !== JSON.stringify(this.form);
  }

  choisirSaison(id: number | null): void {
    this.saisonId.set(id);
    const s = this.saisons().find(x => x.id === id);
    if (s) {
      this.form.dateDebut = s.dateDebut;
      this.form.dateFin = s.dateFin;
    }
  }

  basculerJour(jour: JourSemaine): void {
    const i = this.form.jours.indexOf(jour);
    if (i >= 0) this.form.jours.splice(i, 1); else this.form.jours.push(jour);
  }

  previsualiser(): void {
    if (!this.form.dateDebut || !this.form.dateFin) {
      this.message.set('Choisissez une saison ou indiquez les dates de début et de fin.');
      return;
    }
    if (this.form.jours.length === 0) {
      this.message.set('Choisissez au moins un jour de la semaine.');
      return;
    }
    const demande = JSON.stringify(this.form);
    this.envoi.set(true);
    this.message.set(null);
    this.apercu.set(null);
    this.api.apercuGenerationSaison(this.form).subscribe({
      next: a => {
        this.envoi.set(false);
        this.apercu.set(a);
        this.demandeApercu.set(demande);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "L'aperçu n'a pas pu être calculé.");
      }
    });
  }

  creer(): void {
    const a = this.apercu();
    if (!a || this.parametresModifies()) return;
    if (!confirm(`Créer ${a.nbSeances} séance(s) du ${dateFr(this.form.dateDebut)} au ${dateFr(this.form.dateFin)} ?`)) return;
    this.envoi.set(true);
    this.message.set(null);
    this.api.genererSaison(this.form).subscribe({
      next: r => {
        this.envoi.set(false);
        this.apercu.set(null);
        this.demandeApercu.set(null);
        this.message.set(`${r.nbSeances} séance(s) créée(s) dans la saison ${r.saison}.`);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? 'La création des séances a échoué.');
      }
    });
  }
}
