import { Component, computed, inject, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FileAttenteService } from '../../core/file-attente.service';
import { ReseauService } from '../../core/reseau.service';
import { BlocVue, CritereVue, GrilleVue, SeanceVue, Statut } from '../../core/modeles';

/** Un critère affiché, augmenté de l'information « pas encore envoyé ». */
interface CritereAffiche extends CritereVue {
  enAttente: boolean;
}

interface BlocAffiche extends Omit<BlocVue, 'criteres'> {
  criteres: CritereAffiche[];
  attentes: number;
}

@Component({
  selector: 'app-grille',
  standalone: true,
  template: `
    @if (grilleAffichee(); as g) {
      <div class="carte entete">
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
        </div>
      </div>

      @if (!peutSaisir()) {
        <div class="alerte">
          La saisie des compétences {{ g.niveau }} est réservée aux encadrants
          {{ g.niveauEncadrantValidation }} et au-delà. Vous pouvez consulter la grille.
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
          <select id="seance" [value]="seanceId() ?? ''" (change)="choisirSeance($event)">
            <option value="">Choisir une séance…</option>
            @for (s of seancesUtilisables(); track s.id) {
              <option [value]="s.id">
                {{ s.date }} — {{ s.lieu }}{{ s.profondeurMax ? ' (' + s.profondeurMax + ' m)' : '' }}
              </option>
            }
          </select>
        </div>
      }

      @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

      @for (bloc of g.blocs; track bloc.id) {
        <section class="carte bloc">
          <header>
            <div>
              <h2><span class="code">{{ bloc.code }}</span> {{ bloc.intitule }}</h2>
              <p class="secondaire">
                {{ bloc.acquis }} / {{ bloc.total }} acquis
                @if (bloc.evaluationTransverse) {
                  · vérifiée au fil des autres compétences, sans séance dédiée
                }
                @if (bloc.validerEnDernier) {
                  · à valider en fin de formation
                }
              </p>
            </div>

            @if (bloc.valide) {
              <p class="valide">Validée le {{ bloc.dateValidation }} par {{ bloc.valideePar }}</p>
            } @else if (peutSaisir() && bloc.acquis === bloc.total) {
              @if (bloc.attentes > 0) {
                <p class="secondaire">
                  Validation possible une fois les {{ bloc.attentes }} saisie(s) envoyées.
                </p>
              } @else if (!reseau.enLigne()) {
                <p class="secondaire">Validation possible au retour du réseau.</p>
              } @else {
                <button type="button" class="bouton-principal" (click)="validerBloc(bloc)">
                  Valider {{ bloc.code }}
                </button>
              }
            }
          </header>

          <ul>
            @for (critere of bloc.criteres; track critere.id) {
              <li>
                <div class="libelle">
                  <span>{{ critere.savoirFaire }}</span>
                  @if (critere.critereRealisation) {
                    <span class="secondaire">{{ critere.critereRealisation }}</span>
                  }
                  @if (critere.enAttente) {
                    <span class="attente">En attente d'envoi</span>
                  } @else if (critere.parQui) {
                    <span class="secondaire trace">{{ critere.parQui }} · {{ critere.le }}</span>
                  }
                </div>

                <div class="etats" role="group" [attr.aria-label]="critere.savoirFaire">
                  @for (choix of etats; track choix.valeur) {
                    <button type="button"
                            [class]="'etat ' + choix.classe"
                            [class.actif]="critere.statut === choix.valeur"
                            [class.differe]="critere.enAttente && critere.statut === choix.valeur"
                            [disabled]="!peutSaisir() || bloc.valide"
                            [attr.aria-pressed]="critere.statut === choix.valeur"
                            (click)="noter(bloc, critere, choix.valeur)">
                      {{ choix.libelle }}
                    </button>
                  }
                </div>
              </li>
            }
          </ul>
        </section>
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
    .jauge { width: 64px; height: 168px; flex: none; }
    .jauge rect:nth-child(2) { transition: height .35s ease-out; }
    .resume h1 { margin-bottom: 2px; }
    .score { margin: var(--pas) 0 0; font-weight: 700; }

    .barre-seance {
      display: flex; align-items: center; gap: var(--pas-2);
      margin: var(--pas-3) 0 var(--pas-2);
    }
    .barre-seance label { font-weight: 700; white-space: nowrap; }

    .bloc { margin-top: var(--pas-3); padding: var(--pas-3); }
    .bloc header {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: var(--pas-2); flex-wrap: wrap; margin-bottom: var(--pas-2);
    }
    .code {
      display: inline-block; margin-right: var(--pas); padding: 0 8px;
      border-radius: var(--r-s); background: var(--profond); color: #fff;
    }
    .valide { margin: 0; color: var(--acquis); font-weight: 700; font-size: .9375rem; }

    ul { list-style: none; margin: 0; padding: 0; }
    li {
      display: flex; justify-content: space-between; align-items: center;
      gap: var(--pas-2); padding: var(--pas-2) 0; border-top: 1px solid var(--trait);
    }
    .libelle { display: flex; flex-direction: column; gap: 2px; max-width: 62ch; }
    .trace { font-style: italic; }
    .attente { color: var(--en-cours); font-size: .875rem; font-weight: 700; }

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

    @media (max-width: 720px) {
      .entete { flex-direction: row; padding: var(--pas-2); }
      li { flex-direction: column; align-items: stretch; }
      .etats { justify-content: stretch; }
      .etat { flex: 1; }
      .barre-seance { flex-direction: column; align-items: stretch; }
    }
  `]
})
export class GrilleComponent {
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

    let acquisTotal = 0;
    const blocs: BlocAffiche[] = g.blocs.map(bloc => {
      const criteres: CritereAffiche[] = bloc.criteres.map(c => {
        const differee = attentes.get(c.id);
        return differee
          ? { ...c, statut: differee.statut, enAttente: true, le: differee.dateEvaluation }
          : { ...c, enAttente: false };
      });
      const acquis = criteres.filter(c => c.statut === 'ACQUIS').length;
      acquisTotal += acquis;
      return {
        ...bloc,
        criteres,
        acquis,
        attentes: criteres.filter(c => c.enAttente).length
      };
    });

    return { ...g, blocs, criteresAcquis: acquisTotal };
  });

  progression = computed(() => {
    const g = this.grilleAffichee();
    return g && g.criteresTotal > 0 ? g.criteresAcquis / g.criteresTotal : 0;
  });

  peutSaisir = computed(() => {
    const g = this.grille();
    return !!g && g.statut === 'EN_COURS' && this.auth.peutValider(g.niveauEncadrantValidation);
  });

  seancesUtilisables = computed(() => {
    const g = this.grille();
    if (!g) return [];
    return g.milieuNaturelExclusif
      ? this.seances().filter(s => s.milieu === 'NATUREL')
      : this.seances();
  });

  constructor() {
    queueMicrotask(() => void this.charger());
  }

  private async charger(): Promise<void> {
    try {
      this.grille.set(await this.api.grille(Number(this.id())));
      this.seances.set(await this.api.seances());
      this.erreurChargement.set(false);
      if (!this.reseau.enLigne()) await this.afficherAgeDuCache();
      else this.ageDuCache.set(null);
    } catch {
      this.erreurChargement.set(true);
    }
  }

  private async afficherAgeDuCache(): Promise<void> {
    const date = await this.api.dateDuCache(`grille:${this.id()}`);
    this.ageDuCache.set(date ? new Date(date).toLocaleString('fr-FR') : null);
  }

  choisirSeance(evenement: Event): void {
    const valeur = (evenement.target as HTMLSelectElement).value;
    this.seanceId.set(valeur ? Number(valeur) : null);
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
    await this.file.empiler({
      cursusId: Number(this.id()),
      critereId: critere.id,
      seanceId: seance ? seance.id : null,
      statut,
      commentaire: null,
      dateEvaluation: seance ? seance.date : new Date().toISOString().slice(0, 10)
    });

    // La grille du serveur sera rafraîchie au prochain chargement ; en
    // attendant, la superposition des saisies en file suffit à l'affichage.
    if (this.reseau.enLigne()) {
      setTimeout(() => void this.charger(), 1500);
    }
  }

  private verifierLocalement(seance: SeanceVue | null): string | null {
    const g = this.grille();
    if (!g || !seance) return null;

    if (g.milieuNaturelExclusif && seance.milieu !== 'NATUREL') {
      return `Les compétences du ${g.niveau} ne peuvent pas être validées en milieu artificiel.`;
    }
    if (seance.profondeurMax !== null && seance.profondeurMax > g.prerogativeProfondeur) {
      return `Cette séance dépasse l'espace d'évolution autorisé en formation ${g.niveau}.`;
    }
    return null;
  }

  validerBloc(bloc: BlocAffiche): void {
    this.api.validerCompetence(Number(this.id()), bloc.id).subscribe({
      next: () => { this.message.set(null); void this.charger(); },
      error: (e: HttpErrorResponse) =>
        this.message.set(e.error?.detail ?? 'La validation n’a pas pu être enregistrée.')
    });
  }
}
