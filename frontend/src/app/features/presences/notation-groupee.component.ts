import {
  ChangeDetectionStrategy, Component, ElementRef, WritableSignal, computed, inject, input, output, signal, viewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ReseauService } from '../../core/reseau.service';
import { BlocReferentielVue, LignePresence, ProgressionVue, ReferentielVue, SeanceVue } from '../../core/modeles';
import { libellePreparation } from '../../core/niveaux';
import { periodeDuMois } from '../../core/progression';

/**
 * Notation groupée depuis la feuille de présence : le moniteur coche des
 * élèves présents (tous par défaut), un ou plusieurs critères et écrit un
 * commentaire commun. Le serveur ne fait jamais reculer un élève : un
 * critère acquis reste acquis, en cours reste en cours, non abordé passe en
 * cours ; le commentaire s'ajoute dans tous les cas.
 *
 * Les critères dépendent de la version du MFT figée sur chaque cursus : on
 * note les élèves d'une même formation à la fois. Nécessite le réseau.
 */
@Component({
  selector: 'app-notation-groupee',
  imports: [FormsModule],
  template: `
    <button type="button" class="bouton-principal" (click)="ouvrir()">
      Noter les présents
    </button>

    <dialog #dialogue class="dialogue-seance notation" aria-labelledby="titre-notation"
            (close)="ouvert.set(false)">
      @if (ouvert()) {
        <div class="entete-dialogue">
          <h2 id="titre-notation">Noter les présents</h2>
          <button type="button" class="bouton-discret" (click)="fermer()">Fermer</button>
        </div>
        <p class="secondaire">
          Un critère déjà acquis reste acquis, un critère en cours reste en cours : seul le commentaire
          s'ajoute. Un critère non abordé passe en cours, avec le commentaire.
        </p>

        @if (!reseau.enLigne()) {
          <div class="alerte" role="status">La notation groupée demande le réseau.</div>
        }
        @if (erreur(); as e) { <div class="alerte" role="alert">{{ e }}</div> }

        @if (formations().length > 1) {
          <h3>Formation</h3>
          <div class="formations" role="group" aria-label="Formation">
            @for (f of formations(); track f.referentielId) {
              <button type="button" class="bouton-discret" [class.actif]="f.referentielId === referentielId()"
                      [attr.aria-pressed]="f.referentielId === referentielId()"
                      (click)="choisirFormation(f.referentielId)">
                {{ f.libelle }} ({{ f.nombre }})
              </button>
            }
          </div>
        }

        @if (chargement()) {
          <p class="vide">Chargement…</p>
        } @else if (referentiel(); as ref) {
          @if (!auth.peutValider(ref.niveauEncadrantValidation)) {
            <div class="alerte" role="status">
              La notation du {{ ref.niveau }} est réservée aux encadrants {{ ref.niveauEncadrantValidation }} et au-delà.
            </div>
          } @else if (ref.milieuNaturelExclusif && seance().milieu !== 'NATUREL') {
            <div class="alerte" role="status">
              Les compétences du {{ ref.niveau }} s'obtiennent en milieu naturel : cette séance en piscine ou
              fosse ne permet pas de les noter.
            </div>
          }

          <div class="entete-section">
            <h3>Élèves ({{ cursusCoches().size }}/{{ elevesFormation().length }})</h3>
            <button type="button" class="bouton-discret petit" (click)="basculerTous()">
              {{ cursusCoches().size === elevesFormation().length ? 'Aucun' : 'Tous' }}
            </button>
          </div>
          <ul class="liste-coches eleves">
            @for (l of elevesFormation(); track l.cursusId) {
              <li>
                <label>
                  <input type="checkbox" [checked]="cursusCoches().has(l.cursusId)"
                         (change)="basculer(cursusCoches, l.cursusId)">
                  {{ l.eleve }}
                </label>
              </li>
            }
          </ul>

          <h3>Critères ({{ criteresCoches().size }})</h3>
          @for (b of blocs(); track b.id) {
            <details class="bloc" [open]="auProgramme().has(b.id) || cochesDuBloc(b) > 0">
              <summary>
                <span class="intitule">
                  @if (b.regroupement) { <span class="regroupement">{{ b.regroupement }}</span> }
                  {{ b.intitule }}
                </span>
                @if (auProgramme().has(b.id)) { <span class="programme">Au programme</span> }
                @if (cochesDuBloc(b) > 0) { <span class="compte">{{ cochesDuBloc(b) }}</span> }
              </summary>
              <ul class="liste-coches">
                @for (c of b.criteres; track c.id) {
                  <li>
                    <label>
                      <input type="checkbox" [checked]="criteresCoches().has(c.id)"
                             (change)="basculer(criteresCoches, c.id)">
                      <!-- Le critère de réalisation, souvent commun à tout le bloc, alourdirait la liste. -->
                      <span [attr.title]="c.critereRealisation">{{ c.savoirFaire }}</span>
                    </label>
                  </li>
                }
              </ul>
            </details>
          }

          <label for="commentaire-groupe" class="titre-champ">Commentaire</label>
          <textarea id="commentaire-groupe" rows="3" placeholder="Ex. : bon palmage, poumon-ballast à reprendre"
                    [ngModel]="commentaire()" (ngModelChange)="commentaire.set($event)"></textarea>

          <div class="actions">
            <button type="button" class="bouton-principal" [disabled]="!peutEnvoyer()" (click)="envoyer()">
              {{ envoi() ? 'Enregistrement…' : 'Valider la notation' }}
            </button>
            @if (!commentaire().trim()) {
              <span class="secondaire">Sans commentaire, seuls les critères non abordés changent.</span>
            }
          </div>
        }
      }
    </dialog>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .notation { width: min(720px, calc(100vw - 16px)); }
    h3 { margin: var(--pas-2) 0 var(--pas); }
    .formations { display: flex; flex-wrap: wrap; gap: var(--pas); }
    .formations .actif { background: var(--profond); color: #fff; border-color: var(--profond); }
    .entete-section { display: flex; align-items: center; justify-content: space-between; gap: var(--pas); }
    .entete-section h3 { margin-bottom: var(--pas); }
    .petit { min-height: 44px; padding: 6px 12px; }

    .liste-coches { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
    .liste-coches.eleves { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
    .liste-coches label {
      display: flex; align-items: center; gap: var(--pas); min-height: 44px; cursor: pointer;
      padding: 4px var(--pas); border-radius: var(--r-s);
    }
    .liste-coches label:hover { background: var(--fond); }
    .liste-coches input { width: 22px; height: 22px; flex-shrink: 0; margin: 0; }

    .bloc { border: 1px solid var(--trait); border-radius: var(--r-s); margin-bottom: var(--pas); }
    .bloc summary {
      display: flex; align-items: center; gap: var(--pas); min-height: 44px; padding: 4px var(--pas-2);
      cursor: pointer; font-weight: 700;
    }
    .bloc summary .intitule { flex: 1; min-width: 0; }
    .bloc .liste-coches { padding: 0 var(--pas) var(--pas); }
    .regroupement {
      border: 1px solid var(--trait); border-radius: var(--r-s); padding: 0 6px;
      font-size: .75rem; color: var(--craie); margin-right: 4px;
    }
    .programme {
      background: var(--en-cours-clair); color: var(--en-cours); border-radius: var(--r-s);
      padding: 0 8px; font-size: .75rem;
    }
    .compte {
      background: var(--profond); color: #fff; border-radius: 999px; min-width: 24px;
      text-align: center; font-size: .8125rem; padding: 0 6px;
    }

    .titre-champ { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; }
    .actions {
      display: flex; flex-wrap: wrap; align-items: center; gap: var(--pas-2);
      margin-top: var(--pas-2); position: sticky; bottom: calc(-1 * var(--pas-2));
      background: var(--carte); padding: var(--pas) 0;
    }
  `]
})
export class NotationGroupeeComponent {
  private api = inject(ApiService);
  auth = inject(AuthService);
  reseau = inject(ReseauService);

  seance = input.required<SeanceVue>();
  /** Élèves notés présents (dans le filtre courant de la feuille) : tous cochés au départ. */
  presents = input.required<LignePresence[]>();
  progressions = input<ProgressionVue[]>([]);
  /** Message de bilan, affiché par la feuille de présence une fois le dialogue fermé. */
  notee = output<string>();

  private dialogue = viewChild.required<ElementRef<HTMLDialogElement>>('dialogue');
  ouvert = signal(false);
  chargement = signal(false);
  envoi = signal(false);
  erreur = signal<string | null>(null);

  referentielId = signal<number | null>(null);
  private referentiels = signal<Map<number, ReferentielVue>>(new Map());
  cursusCoches = signal<Set<number>>(new Set());
  criteresCoches = signal<Set<number>>(new Set());
  commentaire = signal('');

  /** Une entrée par version du MFT représentée parmi les présents. */
  formations = computed(() => {
    const parRef = new Map<number, { referentielId: number; libelle: string; nombre: number }>();
    for (const l of this.presents()) {
      if (l.referentielId == null) continue;
      const f = parRef.get(l.referentielId)
        ?? { referentielId: l.referentielId, libelle: libellePreparation(l.niveau), nombre: 0 };
      f.nombre++;
      parRef.set(l.referentielId, f);
    }
    return [...parRef.values()].sort((a, b) => a.libelle.localeCompare(b.libelle));
  });

  referentiel = computed(() => {
    const id = this.referentielId();
    return id == null ? null : this.referentiels().get(id) ?? null;
  });

  elevesFormation = computed(() => this.presents().filter(l => l.referentielId === this.referentielId()));

  blocs = computed(() => {
    const ref = this.referentiel();
    if (!ref) return [];
    const programme = this.auProgramme();
    // Les blocs au programme du mois de la séance d'abord, dans l'ordre du référentiel.
    return [...ref.blocs].sort((a, b) =>
      Number(programme.has(b.id)) - Number(programme.has(a.id)) || a.ordre - b.ordre);
  });

  /** Blocs de la période de progression qui couvre le mois de la séance, pour cette formation. */
  auProgramme = computed(() => {
    const progression = this.progressions().find(p => p.referentielId === this.referentielId());
    const periode = progression ? periodeDuMois(progression.periodes, this.seance().date) : null;
    return new Set(periode?.blocs.map(b => b.id) ?? []);
  });

  peutEnvoyer = computed(() => {
    const ref = this.referentiel();
    return !!ref && !this.envoi() && this.reseau.enLigne()
      && this.cursusCoches().size > 0 && this.criteresCoches().size > 0
      && this.auth.peutValider(ref.niveauEncadrantValidation)
      && !(ref.milieuNaturelExclusif && this.seance().milieu !== 'NATUREL');
  });

  ouvrir(): void {
    this.erreur.set(null);
    this.commentaire.set('');
    this.criteresCoches.set(new Set());
    const formations = this.formations();
    const actuelle = formations.find(f => f.referentielId === this.referentielId());
    this.ouvert.set(true);
    this.dialogue().nativeElement.showModal();
    if (formations.length === 0) {
      this.erreur.set('Aucun élève présent à noter : enregistrez d\'abord les présences.');
      return;
    }
    void this.choisirFormation((actuelle ?? formations[0]).referentielId);
  }

  fermer(): void {
    this.dialogue().nativeElement.close();
  }

  async choisirFormation(referentielId: number): Promise<void> {
    if (referentielId !== this.referentielId()) this.criteresCoches.set(new Set());
    this.referentielId.set(referentielId);
    this.cursusCoches.set(new Set(this.elevesFormation().map(l => l.cursusId)));
    if (this.referentiels().has(referentielId)) return;
    this.chargement.set(true);
    try {
      const ref = await firstValueFrom(this.api.referentiel(referentielId));
      this.referentiels.set(new Map(this.referentiels()).set(referentielId, ref));
    } catch {
      this.erreur.set(!this.reseau.enLigne()
        ? 'La notation groupée demande le réseau.'
        : 'Impossible de charger les critères de cette formation.');
    } finally {
      this.chargement.set(false);
    }
  }

  basculer(coches: WritableSignal<Set<number>>, id: number): void {
    const suivant = new Set(coches());
    if (suivant.has(id)) suivant.delete(id); else suivant.add(id);
    coches.set(suivant);
  }

  basculerTous(): void {
    const tous = this.elevesFormation().map(l => l.cursusId);
    this.cursusCoches.set(this.cursusCoches().size === tous.length ? new Set() : new Set(tous));
  }

  cochesDuBloc(b: BlocReferentielVue): number {
    const coches = this.criteresCoches();
    return b.criteres.filter(c => coches.has(c.id)).length;
  }

  async envoyer(): Promise<void> {
    if (!this.peutEnvoyer()) return;
    this.envoi.set(true);
    this.erreur.set(null);
    try {
      const bilan = await firstValueFrom(this.api.noterGroupe(this.seance().id, {
        // Seuls les élèves de la formation affichée : une coche d'une autre formation ne part pas.
        cursusIds: this.elevesFormation().map(l => l.cursusId).filter(id => this.cursusCoches().has(id)),
        critereIds: [...this.criteresCoches()],
        commentaire: this.commentaire().trim() || null
      }));
      const morceaux = [];
      if (bilan.passesEnCours > 0) morceaux.push(`${bilan.passesEnCours} critère(s) passé(s) en cours`);
      if (bilan.commentairesAjoutes > 0) morceaux.push(`${bilan.commentairesAjoutes} commentaire(s) ajouté(s)`);
      if (morceaux.length === 0) morceaux.push('rien à changer');
      this.notee.emit(`Notation enregistrée pour ${bilan.eleves} élève(s) : ${morceaux.join(', ')}.`);
      this.fermer();
    } catch (e) {
      this.erreur.set((e as HttpErrorResponse).error?.detail ?? 'La notation n\'a pas pu être enregistrée.');
    } finally {
      this.envoi.set(false);
    }
  }
}
