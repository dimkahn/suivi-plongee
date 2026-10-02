import { Component, ElementRef, computed, inject, signal, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { dateFr } from '../../core/date-fr';
import { ComboboxComponent, OptionCombobox } from '../../core/combobox.component';
import { JOURS, codeCase, jourDe } from '../../core/planning';
import {
  CasePlanningVue, DemandeCasePlanning, GroupePlanningVue, MoniteurOptionVue, PlanningVue, ReponseDisponibilite,
  SaisonVue, SoireePlanningVue
} from '../../core/modeles';

/** Périodes proposées pour ne pas afficher toute la saison d'un coup (mois 1-12). */
const PERIODES = [
  { cle: 'tout', libelle: 'Toute la saison', mois: [] as number[] },
  { cle: 't1', libelle: 'Septembre – décembre', mois: [9, 10, 11, 12] },
  { cle: 't2', libelle: 'Janvier – mars', mois: [1, 2, 3] },
  { cle: 't3', libelle: 'Avril – juin', mois: [4, 5, 6] }
];

/** Choix proposés dans l'éditeur d'une case. */
type ChoixCase = 'ATTITREE' | 'ESPACE' | 'FOSSE_LIMITEE' | 'ACTIVITE' | 'ABSENT';

interface EditionCase {
  groupe: GroupePlanningVue;
  date: string;
  choix: ChoixCase;
  espaceId: number | null;
  profondeurLimitee: number;
  activite: string;
}

interface EditionSoiree {
  date: string;
  responsableId: number | null;
  note: string;
}

/**
 * Planning du bassin, tenu par l'admin : une ligne par groupe d'entraînement,
 * une colonne par soirée. Une case vaut la ligne attitrée du groupe tant
 * qu'on n'y touche pas ; on la change pour une autre ligne, la fosse (ou la
 * fosse limitée, le « F6 »), une activité ou une absence. Les avertissements
 * viennent du serveur et n'empêchent rien.
 */
@Component({
  selector: 'app-planning-admin',
  imports: [FormsModule, RouterLink, ComboboxComponent],
  template: `
    <h1>Planning du bassin</h1>
    <p class="secondaire">
      Touchez une case pour placer un groupe ce soir-là, ou la ligne « Responsable » pour choisir le
      responsable de séance et les présences annoncées des encadrants. Une case en gris clair est la ligne
      attitrée du groupe.
    </p>
    <p class="secondaire">
      Les soirées du planning sont les dates de la saison qui ont une séance en piscine ou en fosse (les
      sorties en milieu naturel n'y figurent pas) : pour ajouter un soir, créez la séance dans <a routerLink="/admin/seances">Séances</a>, ou toutes celles de l'année d'un coup avec
      <a routerLink="/admin/seances/generer">Générer la saison</a>.
    </p>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <div class="filtres">
      <div>
        <label for="saison">Saison</label>
        <select id="saison" [ngModel]="saisonId()" (ngModelChange)="choisirSaison($event)">
          @for (s of saisons(); track s.id) {
            <option [ngValue]="s.id">{{ s.libelle }}{{ s.ouverte ? ' (ouverte)' : '' }}</option>
          }
        </select>
      </div>
      <div>
        <label for="jour">Jour</label>
        <select id="jour" [ngModel]="jour()" (ngModelChange)="jour.set($event)">
          <option [ngValue]="null">Tous les jours</option>
          @for (j of joursDisponibles(); track j.jour) {
            <option [ngValue]="j.jour">{{ j.libelle }} ({{ j.nombre }})</option>
          }
        </select>
      </div>
      <div>
        <label for="periode">Période</label>
        <select id="periode" [ngModel]="periode()" (ngModelChange)="periode.set($event)">
          @for (p of periodes; track p.cle) { <option [ngValue]="p.cle">{{ p.libelle }}</option> }
        </select>
      </div>
    </div>

    @if (chargement()) {
      <p class="secondaire">Chargement…</p>
    } @else if (planning(); as p) {
      @if (p.groupes.length === 0) {
        <div class="carte vide">
          <p>Aucun groupe d'entraînement pour cette saison : créez-les d'abord dans « Groupes d'entraînement ».</p>
        </div>
      } @else if (soireesAffichees().length === 0) {
        <div class="carte vide">
          <p>
            Aucune séance en piscine ou en fosse sur cette période{{ jour() !== null ? ' pour ce jour de la semaine' : '' }}.
            Créez les séances dans <a routerLink="/admin/seances">Séances</a> ou
            <a routerLink="/admin/seances/generer">Générer la saison</a> : chaque date qui a une séance en milieu
            artificiel devient une soirée du planning.
          </p>
        </div>
      } @else {
        <div class="defilement" role="region" aria-label="Planning" tabindex="0">
          <table>
            <thead>
              <tr>
                <th scope="col" class="colonne-groupe">Groupe</th>
                @for (s of soireesAffichees(); track s.date) {
                  <th scope="col" [class.alerte-colonne]="s.avertissements.length > 0">
                    <span class="jour">{{ jourCourt(s.date) }}</span>
                    <span class="date">{{ dateCourte(s.date) }}</span>
                    @if (s.avertissements.length > 0) {
                      <span class="picto" [attr.aria-label]="s.avertissements.length + ' avertissement(s)'">⚠</span>
                    }
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              <tr class="ligne-responsable">
                <th scope="row" class="colonne-groupe">Responsable</th>
                @for (s of soireesAffichees(); track s.date) {
                  <td>
                    <button type="button" class="case responsable" (click)="editerSoiree(s)"
                            [attr.aria-label]="'Responsable du ' + dateLongue(s.date) + ' : ' + (s.responsable ?? 'aucun')">
                      {{ prenom(s.responsable) }}
                      @if (s.note) { <span class="note-indicateur" aria-hidden="true">•</span> }
                    </button>
                  </td>
                }
              </tr>
              <tr class="ligne-encadrants">
                <th scope="row" class="colonne-groupe">
                  Encadrants
                  <span class="detail-groupe">présents / absents</span>
                </th>
                @for (s of soireesAffichees(); track s.date) {
                  <td>
                    <button type="button" class="case" (click)="editerSoiree(s)"
                            [attr.aria-label]="dateLongue(s.date) + ' : ' + s.presents.length + ' présent(s), '
                              + s.absents.length + ' absent(s)'">
                      <span class="nb-presents">{{ s.presents.length }}</span>@if (s.absents.length > 0) {<span class="nb-absents">/{{ s.absents.length }}</span>}
                    </button>
                  </td>
                }
              </tr>
              @for (g of p.groupes; track g.id; let i = $index) {
                <tr>
                  <th scope="row" class="colonne-groupe">
                    <span class="nom-groupe">{{ g.nom }}</span>
                    <span class="detail-groupe">{{ encadrantsCourts(g) }}</span>
                  </th>
                  @for (s of soireesAffichees(); track s.date) {
                    @let c = s.cases[i];
                    <td>
                      <button type="button" class="case" [class]="'case type-' + c.type + (c.espaceType === 'FOSSE' ? ' fosse' : '')"
                              (click)="editerCase(g, s, c)"
                              [attr.aria-label]="g.nom + ', ' + dateLongue(s.date) + ' : ' + c.libelle">
                        {{ code(c) }}
                      </button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>

        <p class="legende secondaire">
          Chiffre : ligne d'eau · F10 : fosse · F6 : fosse limitée à 6 m (débutants, groupes encadrés par un E1)
          · — : groupe absent · • : note sur la soirée
        </p>

        @if (avertissements().length > 0) {
          <section class="carte avertissements" aria-label="Avertissements">
            <h2>À vérifier</h2>
            <ul>
              @for (a of avertissements(); track a.date + a.texte) {
                <li><strong>{{ dateCourte(a.date) }}</strong> — {{ a.texte }}</li>
              }
            </ul>
          </section>
        }
      }
    }

    <dialog #dialogue class="dialogue" (close)="fermer()" aria-labelledby="titre-dialogue">
      @if (editionCase(); as e) {
        <h2 id="titre-dialogue">{{ e.groupe.nom }}</h2>
        <p class="secondaire">{{ dateLongue(e.date) }} · {{ e.groupe.effectif }} plongeurs (élèves et encadrants)</p>
        <fieldset class="choix">
          <legend class="visuellement-cache">Place du groupe</legend>
          <label class="option">
            <input type="radio" name="choix" [checked]="e.choix === 'ATTITREE'" (change)="e.choix = 'ATTITREE'">
            Sa ligne attitrée{{ e.groupe.espaceAttitre ? ' (' + e.groupe.espaceAttitre + ')' : ' (aucune)' }}
          </label>
          @for (esp of espacesLignes(); track esp.id) {
            <label class="option">
              <input type="radio" name="choix" [checked]="e.choix === 'ESPACE' && e.espaceId === esp.id"
                     (change)="e.choix = 'ESPACE'; e.espaceId = esp.id">
              {{ esp.nom }}
            </label>
          }
          @for (esp of espacesFosses(); track esp.id) {
            <label class="option">
              <input type="radio" name="choix" [checked]="e.choix === 'ESPACE' && e.espaceId === esp.id"
                     (change)="e.choix = 'ESPACE'; e.espaceId = esp.id">
              {{ esp.nom }}{{ esp.profondeurMax ? ' (' + esp.profondeurMax + ' m)' : '' }}
            </label>
            <label class="option">
              <input type="radio" name="choix" [checked]="e.choix === 'FOSSE_LIMITEE' && e.espaceId === esp.id"
                     (change)="e.choix = 'FOSSE_LIMITEE'; e.espaceId = esp.id">
              {{ esp.nom }} limitée à
              <input type="number" class="profondeur" min="1" [max]="esp.profondeurMax ?? 99"
                     [(ngModel)]="e.profondeurLimitee" aria-label="Profondeur limite en mètres"
                     (focus)="e.choix = 'FOSSE_LIMITEE'; e.espaceId = esp.id"> m
            </label>
          }
          <label class="option">
            <input type="radio" name="choix" [checked]="e.choix === 'ACTIVITE'" (change)="e.choix = 'ACTIVITE'">
            Activité :
            <input type="text" class="activite" [(ngModel)]="e.activite" placeholder="ex. Baptêmes"
                   aria-label="Nom de l'activité" (focus)="e.choix = 'ACTIVITE'">
          </label>
          <label class="option">
            <input type="radio" name="choix" [checked]="e.choix === 'ABSENT'" (change)="e.choix = 'ABSENT'">
            Pas de séance pour ce groupe
          </label>
        </fieldset>
        <div class="actions">
          <button type="button" class="bouton-principal" (click)="enregistrerCase()" [disabled]="envoi()">
            {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
          <button type="button" class="bouton-discret" (click)="fermer()">Annuler</button>
        </div>
      }
      @if (editionSoiree(); as e) {
        <h2 id="titre-dialogue">Soirée du {{ dateLongue(e.date) }}</h2>
        <label for="responsable">Responsable de séance</label>
        <app-combobox idChamp="responsable" [options]="optionsResponsables()" [(valeur)]="e.responsableId"
                      aide="Rechercher un encadrant…" texteVide="Aucun encadrant ne correspond." />
        <p class="secondaire">
          Il organise la soirée ; le directeur de plongée de la fiche de sécurité se choisit à part (E3 minimum).
        </p>
        <label for="note">Note</label>
        <input id="note" type="text" [(ngModel)]="e.note" maxlength="200" placeholder="ex. Baptêmes, piscine fermée à 21 h">
        <div class="actions">
          <button type="button" class="bouton-principal" (click)="enregistrerSoiree()" [disabled]="envoi()">
            {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
          <button type="button" class="bouton-discret" (click)="fermer()">Annuler</button>
        </div>

        @if (soireeEditee(); as s) {
          <h3>Présences des encadrants</h3>
          <p class="secondaire">
            Chacun répond depuis son planning ; touchez un bouton pour répondre à la place d'un encadrant
            (enregistré aussitôt, toucher à nouveau l'efface).
          </p>
          <ul class="presences">
            @for (m of moniteurs(); track m.id) {
              <li>
                <span>{{ m.nomComplet }} <span class="secondaire">{{ m.niveauEncadrement }}</span></span>
                <span class="boutons">
                  <button type="button" class="bouton-discret" [class.present]="reponseDe(s, m.id) === 'PRESENT'"
                          [attr.aria-pressed]="reponseDe(s, m.id) === 'PRESENT'" [disabled]="envoi()"
                          [attr.aria-label]="m.nomComplet + ' présent'" (click)="repondrePour(s, m.id, 'PRESENT')">✓</button>
                  <button type="button" class="bouton-discret" [class.absent]="reponseDe(s, m.id) === 'ABSENT'"
                          [attr.aria-pressed]="reponseDe(s, m.id) === 'ABSENT'" [disabled]="envoi()"
                          [attr.aria-label]="m.nomComplet + ' absent'" (click)="repondrePour(s, m.id, 'ABSENT')">✗</button>
                </span>
              </li>
            }
          </ul>
        }
      }
    </dialog>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .filtres { display: flex; flex-wrap: wrap; gap: var(--pas) var(--pas-3); margin: var(--pas-2) 0; }
    .filtres > div { flex: 1 1 160px; max-width: 260px; }
    .filtres label, .dialogue label[for] { display: block; margin: 0 0 4px; font-weight: 700; font-size: .9375rem; }
    .filtres select { margin: 0; }

    /* Le tableau défile seul dans son cadre : la page, elle, ne défile jamais de côté. */
    .defilement { overflow-x: auto; border: 1px solid var(--trait); border-radius: var(--r-s); background: var(--carte); }
    table { border-collapse: separate; border-spacing: 0; font-size: .875rem; }
    th, td { border-bottom: 1px solid var(--trait); padding: 2px; text-align: center; }
    thead th { position: sticky; top: 0; background: var(--carte); padding: 6px 2px; min-width: 52px; }
    .colonne-groupe {
      position: sticky; left: 0; z-index: 1; background: var(--carte); text-align: left;
      padding: 6px var(--pas); min-width: 120px; max-width: 150px; border-right: 1px solid var(--trait);
    }
    thead .colonne-groupe { z-index: 2; }
    .jour { display: block; font-size: .75rem; color: var(--craie); font-weight: 400; }
    .date { display: block; font-weight: 700; }
    .picto { color: var(--en-cours); }
    .alerte-colonne { background: var(--en-cours-clair) !important; }
    .nom-groupe { display: block; font-weight: 700; }
    .detail-groupe { display: block; font-size: .75rem; color: var(--craie); font-weight: 400; }
    .case {
      width: 100%; min-width: 48px; min-height: 44px; padding: 0 4px; border: 1px solid transparent;
      border-radius: var(--r-s); background: none; font: inherit; font-weight: 700; cursor: pointer; color: var(--encre);
    }
    .case:hover { border-color: var(--trait); }
    .type-ATTITREE { color: var(--craie); font-weight: 400; }
    .type-AUCUN { color: #B3261E; }
    .fosse { background: #E0F2F7; color: var(--profond-fonce); }
    .type-ACTIVITE { background: #FEF9C3; font-size: .75rem; }
    .type-ABSENT { color: var(--craie); }
    .responsable { font-weight: 400; font-size: .8125rem; color: #B3261E; }
    .nb-presents { color: var(--acquis); }
    .nb-absents { color: #B3261E; font-weight: 400; }
    .dialogue h3 { margin: var(--pas-3) 0 4px; font-size: 1rem; }
    .presences { list-style: none; margin: var(--pas) 0 0; padding: 0; max-height: 40vh; overflow-y: auto; }
    .presences li {
      display: flex; align-items: center; justify-content: space-between; gap: var(--pas);
      border-bottom: 1px solid var(--trait); padding: 2px 0;
    }
    .presences .boutons { white-space: nowrap; }
    .presences .bouton-discret { min-width: 44px; min-height: 44px; padding: 0; margin-left: 4px; }
    .present { background: var(--acquis); color: #fff; border-color: var(--acquis); }
    .absent { background: #B3261E; color: #fff; border-color: #B3261E; }
    .note-indicateur { color: var(--profond); }
    .legende { margin-top: var(--pas); }
    .avertissements { padding: var(--pas-2); margin-top: var(--pas-2); }
    .avertissements h2 { margin: 0 0 var(--pas); font-size: 1rem; color: var(--en-cours); }
    .avertissements ul { margin: 0; padding-left: 1.25rem; display: grid; gap: 4px; }

    .dialogue { width: min(440px, calc(100vw - 32px)); border: none; border-radius: var(--r); padding: var(--pas-3); }
    .dialogue::backdrop { background: rgba(12, 53, 71, .5); }
    .dialogue h2 { margin: 0 0 4px; font-size: 1.125rem; }
    .choix { border: none; margin: var(--pas-2) 0 0; padding: 0; display: grid; gap: 2px; }
    .option { display: flex; align-items: center; gap: var(--pas); min-height: 44px; flex-wrap: wrap; }
    .option input[type="radio"] { width: auto; margin: 0; }
    .profondeur { width: 64px; margin: 0; }
    .activite { flex: 1 1 140px; margin: 0; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }
    .actions .bouton-principal { width: auto; }
    .visuellement-cache { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .vide { padding: var(--pas-2); }
    .vide p { margin: 0; }
  `]
})
export class PlanningAdminComponent {
  private api = inject(ApiService);
  private dialogue = viewChild.required<ElementRef<HTMLDialogElement>>('dialogue');
  readonly periodes = PERIODES;

  saisons = signal<SaisonVue[]>([]);
  saisonId = signal<number | null>(null);
  planning = signal<PlanningVue | null>(null);
  moniteurs = signal<MoniteurOptionVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  envoi = signal(false);
  /** Jour de la semaine affiché (0 = dimanche) ; null : tous. */
  jour = signal<number | null>(null);
  periode = signal('tout');
  editionCase = signal<EditionCase | null>(null);
  editionSoiree = signal<EditionSoiree | null>(null);

  joursDisponibles = computed(() => {
    const compte = new Map<number, number>();
    for (const s of this.planning()?.soirees ?? []) compte.set(jourDe(s.date), (compte.get(jourDe(s.date)) ?? 0) + 1);
    return [...compte.entries()].sort((a, b) => ((a[0] + 6) % 7) - ((b[0] + 6) % 7))
      .map(([jour, nombre]) => ({ jour, nombre, libelle: JOURS[jour].charAt(0).toUpperCase() + JOURS[jour].slice(1) }));
  });

  soireesAffichees = computed(() => {
    const mois = PERIODES.find(p => p.cle === this.periode())?.mois ?? [];
    return (this.planning()?.soirees ?? [])
      .filter(s => this.jour() === null || jourDe(s.date) === this.jour())
      .filter(s => mois.length === 0 || mois.includes(Number(s.date.slice(5, 7))));
  });

  avertissements = computed(() => this.soireesAffichees()
    .flatMap(s => s.avertissements.map(texte => ({ date: s.date, texte }))));

  espacesLignes = computed(() => (this.planning()?.espaces ?? []).filter(e => e.type === 'LIGNE'));
  espacesFosses = computed(() => (this.planning()?.espaces ?? []).filter(e => e.type === 'FOSSE'));
  /** Soirée ouverte dans le dialogue, à jour des réponses saisies depuis celui-ci. */
  soireeEditee = computed(() => {
    const date = this.editionSoiree()?.date;
    return date ? this.planning()?.soirees.find(s => s.date === date) ?? null : null;
  });

  /** Encadrants de la soirée ouverte ; ceux qui ont répondu présent sont signalés. */
  optionsResponsables = computed<OptionCombobox[]>(() => {
    const presents = new Set(this.soireeEditee()?.presents.map(e => e.id) ?? []);
    return this.moniteurs().map(m => ({
      id: m.id, libelle: m.nomComplet,
      detail: presents.has(m.id) ? `${m.niveauEncadrement} · présent` : m.niveauEncadrement
    }));
  });

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    try {
      const [saisons, moniteurs] = await Promise.all([firstValueFrom(this.api.saisons()), this.api.moniteursActifs()]);
      this.saisons.set(saisons);
      this.moniteurs.set(moniteurs);
      const ouverte = saisons.find(s => s.ouverte) ?? saisons[0];
      if (ouverte) await this.choisirSaison(ouverte.id);
    } catch {
      this.message.set('Impossible de charger le planning.');
    } finally {
      this.chargement.set(false);
    }
  }

  async choisirSaison(id: number): Promise<void> {
    this.saisonId.set(id);
    try {
      const p = await firstValueFrom(this.api.planning(id));
      if (this.saisonId() !== id) return;
      this.planning.set(p);
      // Par défaut, le jour qui porte le plus de soirées (le lundi soir au club).
      const jours = this.joursDisponibles();
      this.jour.set(jours.length === 0 ? null : jours.reduce((a, b) => b.nombre > a.nombre ? b : a).jour);
    } catch {
      this.message.set('Impossible de charger le planning de cette saison.');
    }
  }

  /** Code court, comme dans le tableur : « 3 », « F10 », « F6 », « — », ou l'activité. */
  code(c: CasePlanningVue): string {
    return codeCase(c, this.planning()?.espaces ?? []);
  }

  jourCourt(date: string): string {
    return JOURS[jourDe(date)].slice(0, 3) + '.';
  }

  dateCourte(date: string): string {
    return dateFr(date).slice(0, 5);
  }

  dateLongue(date: string): string {
    return `${JOURS[jourDe(date)]} ${dateFr(date)}`;
  }

  prenom(nomComplet: string | null): string {
    return nomComplet ? nomComplet.split(' ')[0] : '+';
  }

  encadrantsCourts(g: GroupePlanningVue): string {
    return g.encadrants.map(e => e.nomComplet.split(' ')[0]).join(' & ') || 'Sans encadrant';
  }

  editerCase(g: GroupePlanningVue, s: SoireePlanningVue, c: CasePlanningVue): void {
    this.message.set(null);
    const choix: ChoixCase = c.type === 'ESPACE'
      ? (c.profondeurLimitee !== null ? 'FOSSE_LIMITEE' : 'ESPACE')
      : c.type === 'ACTIVITE' || c.type === 'ABSENT' ? c.type : 'ATTITREE';
    this.editionSoiree.set(null);
    this.editionCase.set({
      groupe: g, date: s.date, choix, espaceId: c.type === 'ESPACE' ? c.espaceId : null,
      profondeurLimitee: c.profondeurLimitee ?? 6, activite: c.activite ?? ''
    });
    this.dialogue().nativeElement.showModal();
  }

  editerSoiree(s: SoireePlanningVue): void {
    this.message.set(null);
    this.editionCase.set(null);
    this.editionSoiree.set({ date: s.date, responsableId: s.responsableId, note: s.note ?? '' });
    this.dialogue().nativeElement.showModal();
  }

  fermer(): void {
    if (this.dialogue().nativeElement.open) this.dialogue().nativeElement.close();
    this.editionCase.set(null);
    this.editionSoiree.set(null);
  }

  enregistrerCase(): void {
    const e = this.editionCase();
    const saisonId = this.saisonId();
    if (!e || saisonId === null) return;
    let demande: DemandeCasePlanning;
    switch (e.choix) {
      case 'ESPACE': demande = { type: 'ESPACE', espaceId: e.espaceId }; break;
      case 'FOSSE_LIMITEE': demande = { type: 'ESPACE', espaceId: e.espaceId, profondeurLimitee: e.profondeurLimitee }; break;
      case 'ACTIVITE': demande = { type: 'ACTIVITE', activite: e.activite }; break;
      default: demande = { type: e.choix };
    }
    this.envoyer(this.api.definirCasePlanning(saisonId, e.date, e.groupe.id, demande));
  }

  enregistrerSoiree(): void {
    const e = this.editionSoiree();
    const saisonId = this.saisonId();
    if (!e || saisonId === null) return;
    this.envoyer(this.api.definirSoireePlanning(saisonId, e.date,
      { responsableId: e.responsableId, note: e.note.trim() || null }));
  }

  reponseDe(s: SoireePlanningVue, utilisateurId: number): ReponseDisponibilite | null {
    if (s.presents.some(e => e.id === utilisateurId)) return 'PRESENT';
    if (s.absents.some(e => e.id === utilisateurId)) return 'ABSENT';
    return null;
  }

  /** Réponse saisie à la place d'un encadrant ; toucher la réponse déjà donnée l'efface. Le dialogue reste ouvert. */
  repondrePour(s: SoireePlanningVue, utilisateurId: number, reponse: ReponseDisponibilite): void {
    const saisonId = this.saisonId();
    if (saisonId === null) return;
    this.envoi.set(true);
    this.api.definirDisponibilite(saisonId, s.date, utilisateurId,
      this.reponseDe(s, utilisateurId) === reponse ? null : reponse).subscribe({
      next: soiree => {
        this.envoi.set(false);
        this.remplacerSoiree(soiree);
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.fermer();
        this.message.set(err.error?.detail ?? "La réponse n'a pas pu être enregistrée.");
      }
    });
  }

  private remplacerSoiree(soiree: SoireePlanningVue): void {
    const p = this.planning();
    if (p) this.planning.set({ ...p, soirees: p.soirees.map(s => s.date === soiree.date ? soiree : s) });
  }

  /** La réponse est la soirée recalculée (cases et avertissements) : on la remplace telle quelle. */
  private envoyer(appel: ReturnType<ApiService['definirSoireePlanning']>): void {
    this.envoi.set(true);
    appel.subscribe({
      next: soiree => {
        this.envoi.set(false);
        this.remplacerSoiree(soiree);
        this.fermer();
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.fermer();
        this.message.set(err.error?.detail ?? "La modification n'a pas pu être enregistrée.");
      }
    });
  }
}
