import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { dateDuJour, dateFr } from '../../core/date-fr';
import { JOURS, codeCase, jourDe } from '../../core/planning';
import {
  CasePlanningVue, GroupePlanningVue, PlanningVue, ReponseDisponibilite, SoireePlanningVue
} from '../../core/modeles';

/** Nombre de soirées à venir listées d'emblée ; le reste de la saison sur demande. */
const SOIREES_A_VENIR = 8;

/**
 * Planning du bassin côté encadrant : où est chaque groupe ce soir (ou à la
 * prochaine soirée), qui sont le DP fosse et le DP piscine, qui vient, et les
 * prochaines soirées des groupes qu'on encadre. L'encadrant y annonce sa
 * présence ou son absence, soirée par soirée. Pensé pour le téléphone, au
 * bord du bassin : la lecture est embarquée par « Préparer hors ligne », la
 * réponse demande le réseau.
 */
@Component({
  selector: 'app-planning',
  imports: [RouterLink],
  template: `
    <h1>Planning du bassin</h1>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (chargement()) {
      <p class="secondaire">Chargement…</p>
    } @else if (planning(); as p) {
      <p class="secondaire">
        Saison {{ p.saison }}
        @if (auth.estAdmin()) { · <a routerLink="/admin/planning">Modifier le planning</a> }
      </p>

      @if (p.soirees.length === 0) {
        <div class="carte vide"><p>Aucune séance sur cette saison pour l'instant.</p></div>
      } @else if (soiree(); as s) {
        <section class="carte soiree" aria-labelledby="titre-soiree">
          <div class="navigation">
            <button type="button" class="bouton-discret fleche" (click)="deplacer(-1)" [disabled]="index() === 0"
                    aria-label="Soirée précédente">‹</button>
            <h2 id="titre-soiree">
              <span class="quand">{{ quand(s.date) }}</span>
              {{ dateLongue(s.date) }}
            </h2>
            <button type="button" class="bouton-discret fleche" (click)="deplacer(1)"
                    [disabled]="index() === p.soirees.length - 1" aria-label="Soirée suivante">›</button>
          </div>

          <p class="responsable">
            DP fosse : <strong>{{ s.dpFosse ?? 'à désigner' }}</strong>
            · DP piscine : <strong>{{ s.dpPiscine ?? 'à désigner' }}</strong>
          </p>
          @if (s.note) { <p class="note">{{ s.note }}</p> }

          @if (auth.estMoniteur()) {
            <div class="ma-reponse" role="group" [attr.aria-label]="'Ma présence le ' + dateLongue(s.date)">
              <span>Vous serez là ?</span>
              <button type="button" class="bouton-discret" [class.present]="maReponse(s) === 'PRESENT'"
                      [attr.aria-pressed]="maReponse(s) === 'PRESENT'" [disabled]="envoi() === s.date"
                      (click)="repondre(s, 'PRESENT')">Présent</button>
              <button type="button" class="bouton-discret" [class.absent]="maReponse(s) === 'ABSENT'"
                      [attr.aria-pressed]="maReponse(s) === 'ABSENT'" [disabled]="envoi() === s.date"
                      (click)="repondre(s, 'ABSENT')">Absent</button>
            </div>
          }
          <p class="secondaire qui-vient">
            @if (s.presents.length === 0 && s.absents.length === 0) {
              Aucun encadrant n'a encore répondu.
            } @else {
              <strong>{{ s.presents.length }} présent{{ s.presents.length > 1 ? 's' : '' }}</strong>
              @if (s.presents.length > 0) { : {{ noms(s.presents) }} }
              @if (s.absents.length > 0) { · {{ s.absents.length }} absent{{ s.absents.length > 1 ? 's' : '' }} : {{ noms(s.absents) }} }
            }
          </p>

          <ul class="groupes">
            @for (l of lignesSoiree(); track l.groupe.id) {
              <li [class.mien]="l.mien">
                <span class="code" [class]="'code type-' + l.case.type + (l.case.espaceType === 'FOSSE' ? ' fosse' : '')"
                      aria-hidden="true">{{ code(l.case) }}</span>
                <span class="texte">
                  <span class="nom-groupe">
                    {{ l.groupe.nom }}
                    @if (l.mien) { <span class="etiquette">Votre groupe</span> }
                  </span>
                  <span class="place">{{ l.case.libelle }}</span>
                  <span class="secondaire encadrants-groupe">
                    @for (e of l.groupe.encadrants; track e.id; let dernier = $last) {
                      @if (estAbsent(s, e.id)) {
                        <s class="nom-absent" [attr.aria-label]="e.nomComplet + ', absent'">{{ e.nomComplet }}</s>
                      } @else if (estPresent(s, e.id)) {
                        <strong class="nom-present" [attr.aria-label]="e.nomComplet + ', présent'">{{ e.nomComplet }}</strong>
                      } @else {
                        <span>{{ e.nomComplet }}</span>
                      }
                      @if (e.referent) { (référent) }
                      @if (!dernier) { & }
                    } @empty {
                      Sans encadrant
                    }
                  </span>
                </span>
              </li>
            }
          </ul>

          @if (s.avertissements.length > 0) {
            <div class="avertissements" role="note">
              <strong>À savoir :</strong>
              <ul>
                @for (a of s.avertissements; track a) { <li>{{ a }}</li> }
              </ul>
            </div>
          }
        </section>

        @if ((mesGroupes().length > 0 || auth.estMoniteur()) && aVenir().length > 0) {
          <section class="carte a-venir" aria-labelledby="titre-a-venir">
            <h2 id="titre-a-venir">Mes prochaines soirées</h2>
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  @for (g of mesGroupes(); track g.id) { <th scope="col">{{ g.nom }}</th> }
                  @if (auth.estMoniteur()) { <th scope="col">Ma présence</th> }
                </tr>
              </thead>
              <tbody>
                @for (v of aVenir(); track v.soiree.date) {
                  <tr>
                    <th scope="row">{{ jourCourt(v.soiree.date) }} {{ dateCourte(v.soiree.date) }}</th>
                    @for (c of v.cases; track c.groupeId) { <td>{{ c.libelle }}</td> }
                    @if (auth.estMoniteur()) {
                      <td class="reponse-courte">
                        <button type="button" class="bouton-discret" [class.present]="maReponse(v.soiree) === 'PRESENT'"
                                [attr.aria-pressed]="maReponse(v.soiree) === 'PRESENT'"
                                [attr.aria-label]="'Présent le ' + dateLongue(v.soiree.date)"
                                [disabled]="envoi() === v.soiree.date" (click)="repondre(v.soiree, 'PRESENT')">✓</button>
                        <button type="button" class="bouton-discret" [class.absent]="maReponse(v.soiree) === 'ABSENT'"
                                [attr.aria-pressed]="maReponse(v.soiree) === 'ABSENT'"
                                [attr.aria-label]="'Absent le ' + dateLongue(v.soiree.date)"
                                [disabled]="envoi() === v.soiree.date" (click)="repondre(v.soiree, 'ABSENT')">✗</button>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
            @if (!touteLaSaison() && resteAVenir() > 0) {
              <button type="button" class="bouton-discret plus" (click)="touteLaSaison.set(true)">
                Afficher les {{ resteAVenir() }} soirées suivantes
              </button>
            }
          </section>
        }

        <p class="legende secondaire">
          Chiffre : ligne d'eau · F10 : fosse 10 m (15 plongeurs encadrants compris) · F6 : fosse limitée à 6 m
          (débutants et groupes encadrés par un E1) · — : pas de séance pour le groupe
        </p>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    h1 { margin-bottom: 4px; }
    .soiree, .a-venir, .vide { padding: var(--pas-2); margin-top: var(--pas-2); }
    .vide p { margin: 0; }
    .navigation { display: flex; align-items: center; gap: var(--pas); }
    .navigation h2 { flex: 1; margin: 0; text-align: center; font-size: 1.125rem; }
    .quand { display: block; font-size: .8125rem; font-weight: 400; color: var(--craie); }
    .fleche { min-width: 44px; min-height: 44px; font-size: 1.5rem; line-height: 1; padding: 0; }
    .responsable { margin: var(--pas-2) 0 0; }
    .note { margin: 4px 0 0; padding: var(--pas); background: var(--en-cours-clair); border-radius: var(--r-s); }
    .groupes { list-style: none; margin: var(--pas-2) 0 0; padding: 0; display: grid; gap: var(--pas); }
    .groupes li {
      display: flex; gap: var(--pas-2); align-items: center; padding: var(--pas);
      border: 1px solid var(--trait); border-radius: var(--r-s);
    }
    .groupes li.mien { border: 2px solid var(--profond); background: var(--fond); }
    .code {
      flex: 0 0 auto; min-width: 52px; min-height: 44px; display: flex; align-items: center; justify-content: center;
      border-radius: var(--r-s); background: var(--fond); font-weight: 700; font-size: 1.125rem; padding: 0 4px;
    }
    .code.fosse { background: #E0F2F7; color: var(--profond-fonce); }
    .code.type-ACTIVITE { background: #FEF9C3; font-size: .75rem; }
    .code.type-ABSENT, .code.type-AUCUN { color: var(--craie); }
    .texte { display: grid; min-width: 0; }
    /*
     * Qui a répondu est en gras, absent juste rayé : texte de la couleur
     * habituelle, sans fond (les classes .present/.absent des boutons de
     * réponse coloreraient le fond et rendraient le nom illisible).
     */
    .encadrants-groupe .nom-absent { font-weight: 700; text-decoration: line-through; text-decoration-thickness: 2px; }
    .encadrants-groupe .nom-present { font-weight: 700; }
    .nom-groupe { font-weight: 700; }
    .etiquette {
      display: inline-block; margin-left: 4px; padding: 0 6px; border-radius: 999px;
      background: var(--profond); color: #fff; font-size: .75rem; font-weight: 700; vertical-align: middle;
    }
    .avertissements { margin-top: var(--pas-2); padding: var(--pas); border-radius: var(--r-s); background: var(--en-cours-clair); }
    .avertissements ul { margin: 4px 0 0; padding-left: 1.25rem; }
    .a-venir h2 { margin: 0 0 var(--pas); font-size: 1rem; }
    .a-venir { overflow-x: auto; }
    table { border-collapse: collapse; font-size: .875rem; width: 100%; }
    th, td { text-align: left; padding: 6px var(--pas) 6px 0; border-bottom: 1px solid var(--trait); }
    tbody th { font-weight: 400; white-space: nowrap; color: var(--craie); }
    .legende { margin-top: var(--pas-2); }
    .ma-reponse { display: flex; align-items: center; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }
    .ma-reponse span { font-weight: 700; margin-right: auto; }
    .ma-reponse .bouton-discret { min-height: 44px; min-width: 96px; }
    .present { background: var(--acquis); color: #fff; border-color: var(--acquis); }
    .absent { background: #B3261E; color: #fff; border-color: #B3261E; }
    .qui-vient { margin: var(--pas) 0 0; }
    .reponse-courte { white-space: nowrap; }
    .reponse-courte .bouton-discret { min-width: 44px; min-height: 44px; padding: 0; margin-right: 4px; }
    .plus { margin-top: var(--pas); }
  `]
})
export class PlanningComponent {
  private api = inject(ApiService);
  protected auth = inject(AuthService);

  planning = signal<PlanningVue | null>(null);
  chargement = signal(true);
  message = signal<string | null>(null);
  /** Soirée affichée, dans la liste des soirées de la saison. */
  index = signal(0);
  /** Date de la soirée dont la réponse part au serveur. */
  envoi = signal<string | null>(null);
  touteLaSaison = signal(false);

  soiree = computed<SoireePlanningVue | null>(() => this.planning()?.soirees[this.index()] ?? null);

  mesGroupes = computed<GroupePlanningVue[]>(() => {
    const p = this.planning();
    return p ? p.groupes.filter(g => p.mesGroupeIds.includes(g.id)) : [];
  });

  /** Groupes de la soirée affichée, ceux qu'on encadre en premier. */
  lignesSoiree = computed(() => {
    const p = this.planning();
    const s = this.soiree();
    if (!p || !s) return [];
    const lignes = p.groupes.map((groupe, i) => ({ groupe, case: s.cases[i], mien: p.mesGroupeIds.includes(groupe.id) }));
    return [...lignes.filter(l => l.mien), ...lignes.filter(l => !l.mien)];
  });

  private soireesAVenir = computed(() => {
    const aujourdhui = dateDuJour();
    return (this.planning()?.soirees ?? []).filter(s => s.date >= aujourdhui);
  });

  /** Prochaines soirées (à partir d'aujourd'hui), réduites aux groupes qu'on encadre. */
  aVenir = computed(() => {
    const p = this.planning();
    if (!p) return [];
    const indices = p.groupes.map((g, i) => p.mesGroupeIds.includes(g.id) ? i : -1).filter(i => i >= 0);
    const soirees = this.touteLaSaison() ? this.soireesAVenir() : this.soireesAVenir().slice(0, SOIREES_A_VENIR);
    return soirees.map(soiree => ({ soiree, cases: indices.map(i => soiree.cases[i]) }));
  });

  resteAVenir = computed(() => Math.max(0, this.soireesAVenir().length - SOIREES_A_VENIR));

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    try {
      const p = await this.api.planningHorsLigne();
      this.planning.set(p);
      // Par défaut : la soirée du jour, sinon la prochaine, sinon la dernière de la saison.
      const aujourdhui = dateDuJour();
      const prochaine = p.soirees.findIndex(s => s.date >= aujourdhui);
      this.index.set(prochaine >= 0 ? prochaine : Math.max(0, p.soirees.length - 1));
    } catch {
      this.message.set("Le planning n'est pas disponible : pas de saison ouverte, ou pas de connexion "
        + "et rien de préparé hors ligne.");
    } finally {
      this.chargement.set(false);
    }
  }

  maReponse(s: SoireePlanningVue): ReponseDisponibilite | null {
    const moi = this.planning()?.utilisateurId;
    if (s.presents.some(e => e.id === moi)) return 'PRESENT';
    if (s.absents.some(e => e.id === moi)) return 'ABSENT';
    return null;
  }

  /** Toucher la réponse déjà donnée l'efface (« pas encore répondu »). */
  repondre(s: SoireePlanningVue, reponse: ReponseDisponibilite): void {
    const p = this.planning();
    if (!p) return;
    this.message.set(null);
    this.envoi.set(s.date);
    this.api.definirMaDisponibilite(p.saisonId, s.date, this.maReponse(s) === reponse ? null : reponse).subscribe({
      next: soiree => {
        this.envoi.set(null);
        const actuel = this.planning();
        if (actuel) {
          this.planning.set({ ...actuel, soirees: actuel.soirees.map(x => x.date === soiree.date ? soiree : x) });
        }
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(null);
        this.message.set(err.status === 0
          ? 'Pas de connexion : votre réponse n\'est pas enregistrée, réessayez une fois connecté.'
          : err.error?.detail ?? 'Votre réponse n\'a pas pu être enregistrée.');
      }
    });
  }

  noms(encadrants: { nomComplet: string }[]): string {
    return encadrants.map(e => e.nomComplet.split(' ')[0]).join(', ');
  }

  deplacer(pas: number): void {
    const n = this.planning()?.soirees.length ?? 0;
    this.index.set(Math.min(n - 1, Math.max(0, this.index() + pas)));
  }

  code(c: CasePlanningVue): string {
    return codeCase(c, this.planning()?.espaces ?? []);
  }

  quand(date: string): string {
    const aujourdhui = dateDuJour();
    if (date === aujourdhui) return 'Ce soir';
    return date > aujourdhui ? 'À venir' : 'Passée';
  }

  jourCourt(date: string): string {
    return JOURS[jourDe(date)].slice(0, 3) + '.';
  }

  dateCourte(date: string): string {
    return dateFr(date).slice(0, 5);
  }

  dateLongue(date: string): string {
    const jour = JOURS[jourDe(date)];
    return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} ${dateFr(date)}`;
  }

  /** A répondu absent pour cette soirée : son nom est rayé dans les groupes qu'il encadre. */
  estAbsent(s: SoireePlanningVue, encadrantId: number): boolean {
    return s.absents.some(a => a.id === encadrantId);
  }

  /** A répondu présent : son nom est en gras ; qui n'a pas répondu reste en texte normal. */
  estPresent(s: SoireePlanningVue, encadrantId: number): boolean {
    return s.presents.some(p => p.id === encadrantId);
  }
}
