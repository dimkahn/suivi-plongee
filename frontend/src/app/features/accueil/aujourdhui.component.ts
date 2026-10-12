import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FileAttenteService } from '../../core/file-attente.service';
import { FileEcrituresService } from '../../core/file-ecritures.service';
import { ReseauService } from '../../core/reseau.service';
import { dateDuJour, dateFr } from '../../core/date-fr';
import { JOURS, jourDe } from '../../core/planning';
import { lieuEtSite } from '../../core/seance-lieu';
import { PlurielPipe } from '../../core/pluriel';
import {
  GroupeEntrainementVue, LignePresence, PlanningVue, ReponseDisponibilite, SeanceVue, SoireePlanningVue
} from '../../core/modeles';

/** Ce que la feuille de présence d'une séance dit des élèves de mes groupes. */
interface BilanSeance {
  presents: number;
  sansEvaluation: number;
}

/**
 * Page d'accueil des encadrants : la séance du jour (ou la prochaine) et
 * tout ce qui s'y fait, au même endroit — où va mon groupe au bassin, ma
 * réponse de présence, l'appel, le programme d'exercices, la fiche de
 * sécurité (et, le jour même, sa saisie au retour de plongée) et les élèves présents pas encore évalués. Chaque bloc renvoie à
 * l'écran complet ; rien ne s'y saisit, sauf la réponse de présence (même
 * appel que l'écran Planning). Tout vient de données déjà embarquées par
 * « Préparer hors ligne » : la page s'ouvre sans réseau.
 */
@Component({
  selector: 'app-aujourdhui',
  imports: [RouterLink, PlurielPipe],
  template: `
    <h1>{{ titre() }}</h1>
    @if (jour(); as j) {
      <p class="secondaire">{{ dateLongue(j) }}{{ mesGroupes().length ? ' · ' + nomsMesGroupes() : '' }}</p>
    }

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (!jour()) {
      <div class="carte vide">
        <p>Aucune séance à venir sur la saison.</p>
        <p><a routerLink="/eleves">Voir les élèves de la saison</a></p>
      </div>
    } @else {
      @if (soiree(); as s) {
        <section class="carte bloc-accueil" aria-labelledby="titre-bassin">
          <h2 id="titre-bassin">Au bassin</h2>
          @if (mesCases().length > 0) {
            <ul class="mes-groupes">
              @for (c of mesCases(); track c.groupe) {
                <li><strong>{{ c.groupe }}</strong> : {{ c.place }}</li>
              }
            </ul>
          }
          <p class="secondaire">
            DP fosse : <strong>{{ s.dpFosse ?? 'à désigner' }}</strong>
            · DP piscine : <strong>{{ s.dpPiscine ?? 'à désigner' }}</strong>
          </p>
          @if (auth.estMoniteur() && planning()) {
            <div class="ma-reponse" role="group" aria-label="Ma présence">
              <span>Vous serez là ?</span>
              <button type="button" class="bouton-discret" [class.present]="maReponse(s) === 'PRESENT'"
                      [attr.aria-pressed]="maReponse(s) === 'PRESENT'" [disabled]="envoi()"
                      (click)="repondre(s, 'PRESENT')">Présent</button>
              <button type="button" class="bouton-discret" [class.absent]="maReponse(s) === 'ABSENT'"
                      [attr.aria-pressed]="maReponse(s) === 'ABSENT'" [disabled]="envoi()"
                      (click)="repondre(s, 'ABSENT')">Absent</button>
            </div>
          }
          <a routerLink="/planning" class="lien-ecran">Tout le planning de la soirée</a>
        </section>
      }

      @for (s of seancesDuJour(); track s.id) {
        @let bilan = bilans().get(s.id);
        <section class="carte bloc-accueil" [attr.aria-label]="libelleSeance(s)">
          <h2>
            {{ lieuEtSite(s) || 'Séance' }}{{ seancesDuJour().length > 1 ? ' (séance ' + s.ordre + ')' : '' }}
            <span class="milieu" [class.naturel]="s.milieu === 'NATUREL'">
              {{ s.milieu === 'NATUREL' ? 'Milieu naturel' : 'Piscine / fosse' }}
            </span>
          </h2>

          @if (bilan) {
            <p class="bilan" role="status">
              {{ bilan.presents | pluriel:'présent' }}{{ mesGroupes().length ? ' dans vos groupes' : '' }}
              @if (bilan.sansEvaluation > 0) {
                · <strong class="sans-evaluation">{{ bilan.sansEvaluation | pluriel:'présent' }} sans évaluation</strong>
              }
            </p>
          } @else if (s.date > aujourdhui) {
            <p class="secondaire">Les présences peuvent déjà être annoncées.</p>
          }

          <div class="actions">
            <a class="bouton-principal" [routerLink]="['/presences']" [queryParams]="lienSeance(s)">
              {{ s.date > aujourdhui ? 'Annoncer les présences' : bilan?.sansEvaluation ? 'Appel et notes' : 'Faire l’appel' }}
            </a>
            <a class="bouton-discret" [routerLink]="['/seances', s.id, 'programme']" [queryParams]="lienGroupe()">
              Programme d'exercices
            </a>
            @if (s.ficheSecurite || (s.milieu === 'NATUREL' && auth.etablitFichesSecurite())) {
              <a class="bouton-discret" [routerLink]="['/fiches-securite', s.id]">
                {{ s.ficheSecurite ? 'Fiche de sécurité' : 'Établir la fiche de sécurité' }}
              </a>
            }
            @if (s.milieu === 'NATUREL' && s.ficheSecurite && s.date <= aujourdhui) {
              <a class="bouton-discret" [routerLink]="['/fiches-securite', s.id, 'realise']">
                Compléter au retour de plongée
              </a>
            }
          </div>
        </section>
      }

      @if (seanceSuivante(); as s) {
        <p class="secondaire suivante">
          Séance suivante : {{ dateLongue(s.date) }}{{ lieuEtSite(s) ? ' — ' + lieuEtSite(s) : '' }}
        </p>
      }
    }

    <nav class="raccourcis" aria-label="Autres écrans">
      <a routerLink="/eleves" class="bouton-discret">Infos élèves</a>
      <a routerLink="/trombinoscope" class="bouton-discret">Trombinoscope</a>
      @if (attente() > 0) {
        <span class="secondaire">{{ attente() | pluriel:'saisie' }} en attente d'envoi</span>
      }
    </nav>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: 2px; }
    .bloc-accueil { padding: var(--pas-2) var(--pas-3); margin-top: var(--pas-2); }
    .bloc-accueil h2 { display: flex; flex-wrap: wrap; align-items: center; gap: var(--pas); margin-bottom: var(--pas); }
    .milieu {
      display: inline-block; padding: 1px 8px; border-radius: var(--r-s);
      background: var(--accent-clair); color: var(--encre); font-size: .8125rem; font-weight: 700;
    }
    .milieu.naturel { background: var(--profond); color: #fff; }
    .mes-groupes { list-style: none; margin: 0 0 var(--pas); padding: 0; display: grid; gap: 4px; font-size: 1.0625rem; }
    .ma-reponse { display: flex; flex-wrap: wrap; align-items: center; gap: var(--pas); margin-bottom: var(--pas); }
    .ma-reponse .present { background: var(--acquis); border-color: var(--acquis); color: #fff; font-weight: 700; }
    .ma-reponse .absent { background: #B3261E; border-color: #B3261E; color: #fff; font-weight: 700; }
    .lien-ecran { display: inline-flex; align-items: center; min-height: 44px; font-weight: 700; }
    .bilan { font-weight: 600; }
    .sans-evaluation { color: var(--en-cours); }
    .actions { display: flex; flex-wrap: wrap; gap: var(--pas); }
    .actions a { display: inline-flex; align-items: center; text-decoration: none; }
    .actions .bouton-discret { color: var(--profond); font-weight: 700; }
    .suivante { margin-top: var(--pas-2); }
    .raccourcis { display: flex; flex-wrap: wrap; align-items: center; gap: var(--pas); margin-top: var(--pas-3); }
    .raccourcis a { display: inline-flex; align-items: center; text-decoration: none; color: var(--profond); font-weight: 700; }
    @media (max-width: 600px) {
      .bloc-accueil { padding: var(--pas-2); }
      .actions a { flex: 1 1 100%; justify-content: center; }
    }
  `]
})
export class AujourdhuiComponent {
  private api = inject(ApiService);
  auth = inject(AuthService);
  private reseau = inject(ReseauService);
  private notes = inject(FileAttenteService);
  private ecritures = inject(FileEcrituresService);

  readonly aujourdhui = dateDuJour();
  readonly lieuEtSite = lieuEtSite;

  chargement = signal(true);
  message = signal<string | null>(null);
  envoi = signal(false);
  seances = signal<SeanceVue[]>([]);
  planning = signal<PlanningVue | null>(null);
  groupes = signal<GroupeEntrainementVue[]>([]);
  /** Feuilles de présence des séances du jour affiché. */
  feuilles = signal<Map<number, LignePresence[]>>(new Map());

  attente = computed(() => this.notes.enAttente().length + this.ecritures.enAttente().length);

  /** Le jour affiché : aujourd'hui s'il porte une séance, sinon la prochaine date de séance. */
  jour = computed(() => {
    const dates = this.seances().map(s => s.date).filter(d => d >= this.aujourdhui).sort();
    return dates[0] ?? null;
  });

  titre = computed(() => this.jour() === this.aujourdhui ? 'Aujourd’hui' : this.jour() ? 'Prochaine séance' : 'Aujourd’hui');

  seancesDuJour = computed(() => this.seances().filter(s => s.date === this.jour()).sort((a, b) => a.ordre - b.ordre));

  seanceSuivante = computed(() => {
    const jour = this.jour();
    return jour ? this.seances().filter(s => s.date > jour).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null : null;
  });

  soiree = computed(() => this.planning()?.soirees.find(s => s.date === this.jour()) ?? null);

  /** Groupes d'entraînement dont je suis encadrant attitré (référent compris). */
  mesGroupes = computed(() => {
    const ids = this.planning()?.mesGroupeIds ?? [];
    return this.groupes().filter(g => ids.includes(g.id));
  });

  nomsMesGroupes = computed(() => this.mesGroupes().map(g => g.nom).join(', '));

  /** Où vont ce soir les groupes que j'encadre (attitrés, ou mis là par l'admin pour ce soir). */
  mesCases = computed(() => {
    const p = this.planning();
    const s = this.soiree();
    if (!p || !s) return [];
    return s.cases
      .filter(c => c.encadrants ? c.encadrants.some(e => e.id === p.utilisateurId) : p.mesGroupeIds.includes(c.groupeId))
      .map(c => ({ groupe: p.groupes.find(g => g.id === c.groupeId)?.nom ?? 'Groupe', place: c.libelle }));
  });

  /**
   * Séance passée ou du jour : présents et présents sans aucune note, dans
   * mes groupes s'il y en a (sinon tous les élèves de la feuille), les choix
   * et notes encore sur l'appareil compris, comme sur la feuille.
   */
  bilans = computed(() => {
    const eleves = new Set(this.mesGroupes().flatMap(g => g.eleves.map(e => e.id)));
    const resultat = new Map<number, BilanSeance>();
    for (const [seanceId, lignes] of this.feuilles()) {
      const seance = this.seances().find(s => s.id === seanceId);
      if (!seance || seance.date > this.aujourdhui) continue;
      const presencesEnAttente = new Map(this.ecritures.pourSeance(seanceId, 'presence').map(p => [p.cursusId, p.statut]));
      const notesEnAttente = new Set(this.notes.enAttente().filter(n => n.seanceId === seanceId).map(n => n.cursusId));
      const presents = lignes
        .filter(l => eleves.size === 0 || eleves.has(l.eleveId))
        .filter(l => (presencesEnAttente.has(l.cursusId) ? presencesEnAttente.get(l.cursusId) : l.statut) === 'PRESENT');
      resultat.set(seanceId, {
        presents: presents.length,
        sansEvaluation: presents.filter(l => l.evaluations === 0 && !notesEnAttente.has(l.cursusId)).length
      });
    }
    return resultat;
  });

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    try {
      this.seances.set(await this.api.seances());
    } catch {
      this.message.set('Impossible de charger les séances. Avec du réseau, « Préparer hors ligne » les garde sur le téléphone.');
      this.chargement.set(false);
      return;
    }
    // Facultatifs : sans planning ni groupes, la page montre quand même la séance.
    const [planning, groupes] = await Promise.all([
      this.api.planningHorsLigne().catch(() => null),
      this.api.groupesEntrainementSaisonOuverte().catch(() => [] as GroupeEntrainementVue[])
    ]);
    this.planning.set(planning);
    this.groupes.set(groupes);
    this.chargement.set(false);

    const feuilles = new Map<number, LignePresence[]>();
    for (const s of this.seancesDuJour().filter(x => x.date <= this.aujourdhui)) {
      try {
        feuilles.set(s.id, (await this.api.feuillePresence(s.id)).eleves);
      } catch {
        // Feuille pas embarquée hors ligne : pas de bilan, les liens restent.
      }
    }
    this.feuilles.set(feuilles);
  }

  /** Un seul groupe encadré : les écrans s'ouvrent filtrés dessus. */
  lienGroupe(): Record<string, number> {
    const groupes = this.mesGroupes();
    return groupes.length === 1 ? { groupe: groupes[0].id } : {};
  }

  lienSeance(s: SeanceVue): Record<string, number> {
    return { seance: s.id, ...this.lienGroupe() };
  }

  maReponse(s: SoireePlanningVue): ReponseDisponibilite | null {
    const moi = this.planning()?.utilisateurId;
    if (s.presents.some(e => e.id === moi)) return 'PRESENT';
    if (s.absents.some(e => e.id === moi)) return 'ABSENT';
    return null;
  }

  /** Même geste que l'écran Planning : toucher la réponse déjà donnée l'efface. Réseau obligatoire. */
  repondre(s: SoireePlanningVue, reponse: ReponseDisponibilite): void {
    const p = this.planning();
    if (!p) return;
    if (!this.reseau.enLigne()) {
      this.message.set('Pas de connexion : votre réponse n\'est pas enregistrée, réessayez une fois connecté.');
      return;
    }
    this.message.set(null);
    this.envoi.set(true);
    this.api.definirMaDisponibilite(p.saisonId, s.date, this.maReponse(s) === reponse ? null : reponse).subscribe({
      next: soiree => {
        this.envoi.set(false);
        const actuel = this.planning();
        if (actuel) this.planning.set({ ...actuel, soirees: actuel.soirees.map(x => x.date === soiree.date ? soiree : x) });
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(err.status === 0
          ? 'Pas de connexion : votre réponse n\'est pas enregistrée, réessayez une fois connecté.'
          : err.error?.detail ?? 'Votre réponse n\'a pas pu être enregistrée.');
      }
    });
  }

  libelleSeance(s: SeanceVue): string {
    return `${dateFr(s.date)} — ${lieuEtSite(s) || 'lieu non précisé'}`;
  }

  dateLongue(date: string): string {
    const jour = JOURS[jourDe(date)];
    return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} ${dateFr(date)}`;
  }
}
