import { Component, computed, inject, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { DemandeSortie, SeancePossibleVue, SortieVue } from '../../core/modeles';
import { DateFrPipe } from '../../core/date-fr';
import { DialogueComponent } from '../../core/dialogue.component';
import { libelleSeanceSortie } from '../../core/seance-sortie';

function sortieVide(): DemandeSortie {
  return { nom: '', lieu: null, dateDebut: '', dateFin: null, remarques: null };
}

/**
 * Les gestes de gestion d'une sortie, partagés par l'écran Sorties (directeur
 * technique), la liste des séjours et la page d'un séjour : la créer, la
 * modifier, choisir ou créer ses plongées, imprimer ses fiches de sécurité, la
 * supprimer. Ce composant porte les fenêtres et parle à l'API ; l'écran
 * l'appelle (`#gestion`, puis `gestion.ouvrirChoix(s)`…) et suit ses sorties.
 * Les droits restent ceux du serveur (ADMIN ou DT ; plongées créées et fiches
 * imprimées par un moniteur ou l'ADMIN).
 */
@Component({
  selector: 'app-gestion-sortie',
  imports: [FormsModule, DateFrPipe, DialogueComponent],
  template: `
    <app-dialogue [ouvert]="creationOuverte()" titre="Nouvelle sortie" [erreur]="message()" [large]="true"
                  (fermer)="creationOuverte.set(false)">
      <form (ngSubmit)="creer()">
        <div class="grille">
          <div>
            <label for="nom">Nom *</label>
            <input id="nom" name="nom" [(ngModel)]="nouvelle.nom" maxlength="120" placeholder="Week-end à Blaisy">
          </div>
          <div>
            <label for="lieu">Lieu</label>
            <input id="lieu" name="lieu" [(ngModel)]="nouvelle.lieu" maxlength="120" placeholder="Carrière de Blaisy">
          </div>
          <div>
            <label for="debut">Du *</label>
            <input id="debut" name="debut" type="date" [(ngModel)]="nouvelle.dateDebut">
          </div>
          <div>
            <label for="fin">Au</label>
            <input id="fin" name="fin" type="date" [min]="nouvelle.dateDebut" [(ngModel)]="nouvelle.dateFin">
          </div>
        </div>
        <label for="remarques">Remarques</label>
        <textarea id="remarques" name="remarques" rows="2" [(ngModel)]="nouvelle.remarques"
                  placeholder="Rendez-vous, hébergement…"></textarea>
        <div class="actions-dialogue">
          <button [attr.aria-busy]="envoi() || null" type="submit" class="bouton-principal" [disabled]="envoi()">
            {{ envoi() ? 'Création…' : 'Créer puis choisir les plongées' }}
          </button>
          <button type="button" class="bouton-discret" (click)="creationOuverte.set(false)">Annuler</button>
        </div>
      </form>
    </app-dialogue>

    <app-dialogue [ouvert]="sortieEnEdition() !== null" titre="Modifier la sortie" [erreur]="message()" [large]="true"
                  (fermer)="sortieEnEdition.set(null)">
      <div class="grille">
        <div>
          <label for="edition-nom">Nom</label>
          <input id="edition-nom" [(ngModel)]="brouillon.nom" maxlength="120">
        </div>
        <div>
          <label for="edition-lieu">Lieu</label>
          <input id="edition-lieu" [(ngModel)]="brouillon.lieu" maxlength="120">
        </div>
        <div>
          <label for="edition-debut">Du</label>
          <input id="edition-debut" type="date" [(ngModel)]="brouillon.dateDebut">
        </div>
        <div>
          <label for="edition-fin">Au</label>
          <input id="edition-fin" type="date" [min]="brouillon.dateDebut" [(ngModel)]="brouillon.dateFin">
        </div>
      </div>
      <label for="edition-remarques">Remarques</label>
      <textarea id="edition-remarques" rows="2" [(ngModel)]="brouillon.remarques"></textarea>
      <div class="actions-dialogue">
        <button [attr.aria-busy]="envoi() || null" type="button" class="bouton-principal" (click)="enregistrer()" [disabled]="envoi()">
          {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
        <button type="button" class="bouton-discret" (click)="sortieEnEdition.set(null)">Annuler</button>
      </div>
    </app-dialogue>

    <app-dialogue [ouvert]="sortieEnChoix() !== null" [large]="true"
                  [titre]="'Plongées de « ' + (sortieEnChoix()?.nom ?? '') + ' »'"
                  [erreur]="message()" (fermer)="sortieEnChoix.set(null)">
      @if (sortieEnChoix(); as s) {
        <p class="secondaire">
          Les séances du {{ s.dateDebut | dateFr }} au {{ s.dateFin | dateFr }}. Cochez celles qui font partie
          de la sortie ; une séance déjà prise par une autre sortie n'est pas proposée.
        </p>
        @if (possibles().length === 0) {
          <p class="vide">Aucune séance ces jours-là{{ encadre() ? ' : créez les plongées ci-dessous' : '' }}.</p>
        } @else {
          <div class="actions">
            <button type="button" class="bouton-discret" (click)="toutCocher(true)">Tout cocher</button>
            <button type="button" class="bouton-discret" (click)="toutCocher(false)">Tout décocher</button>
          </div>
          <ul class="possibles">
            @for (p of possibles(); track p.seance.id) {
              <li>
                <label class="case" [class.prise]="p.autreSortie">
                  <input type="checkbox" [checked]="cochees().has(p.seance.id)" [disabled]="!!p.autreSortie"
                         (change)="basculer(p.seance.id)">
                  <span>
                    {{ libelleSeance(p.seance) }}
                    @if (p.seance.milieu === 'ARTIFICIEL') { <span class="secondaire"> · piscine/fosse</span> }
                    @if (p.autreSortie) { <span class="secondaire"> · dans « {{ p.autreSortie }} »</span> }
                  </span>
                </label>
              </li>
            }
          </ul>
        }

        @if (encadre()) {
          <details class="creation-plongees" [open]="possibles().length === 0">
            <summary>Créer les plongées de la sortie</summary>
            <p class="secondaire">
              Une séance par jour et par plongée, du {{ s.dateDebut | dateFr }} au {{ s.dateFin | dateFr }},
              en milieu naturel, cochées d'office. Elles servent aussi aux fiches de sécurité et aux présences.
            </p>
            <div class="grille">
              <div>
                <label [for]="'plongees-' + s.id">Plongées par jour</label>
                <input [id]="'plongees-' + s.id" type="number" min="1" max="6" [(ngModel)]="plongees.parJour">
              </div>
              <div>
                <label [for]="'site-' + s.id">Site</label>
                <input [id]="'site-' + s.id" [(ngModel)]="plongees.site" placeholder="Facultatif">
              </div>
              <div>
                <label [for]="'profondeur-' + s.id">Profondeur max. (m)</label>
                <input [id]="'profondeur-' + s.id" type="number" min="1" [(ngModel)]="plongees.profondeurMax">
              </div>
            </div>
            <button type="button" class="bouton-discret" (click)="creerPlongees(s)" [disabled]="envoi()">
              Créer les plongées
            </button>
          </details>
        } @else if (possibles().length === 0) {
          <p class="secondaire">Les plongées de la sortie se créent par un moniteur ou l'administrateur.</p>
        }

        <div class="actions-dialogue">
          <button [attr.aria-busy]="envoi() || null" type="button" class="bouton-principal" (click)="enregistrerSeances(s)" [disabled]="envoi()">
            {{ envoi() ? 'Enregistrement…' : 'Enregistrer les plongées' }}
          </button>
          <button type="button" class="bouton-discret" (click)="sortieEnChoix.set(null)">Annuler</button>
        </div>
      }
    </app-dialogue>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0 var(--pas-2); }
    textarea { resize: vertical; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }
    .possibles { list-style: none; margin: var(--pas) 0 0; padding: 0; border: 1px solid var(--trait);
                 border-radius: var(--r-s); background: var(--carte); }
    .possibles li { padding: 0 var(--pas-2); border-bottom: 1px solid var(--trait); }
    .possibles li:last-child { border-bottom: none; }
    .case { display: flex; align-items: center; gap: var(--pas); font-weight: 400; min-height: 44px; margin: 0; }
    .case input { width: auto; flex: none; }
    .case.prise { color: var(--craie); }
    .creation-plongees { margin-top: var(--pas-2); }
    .creation-plongees summary { cursor: pointer; font-weight: 700; min-height: 44px; display: flex; align-items: center; }
    .creation-plongees .bouton-discret { margin-top: var(--pas-2); }
  `]
})
export class GestionSortieComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  /** Une sortie vient d'être créée ; la fenêtre de ses plongées s'ouvre aussitôt. */
  readonly creee = output<SortieVue>();
  /** Modifiée, ou ses plongées enregistrées. */
  readonly modifiee = output<SortieVue>();
  readonly supprimee = output<SortieVue>();
  /** À montrer par l'écran, hors des fenêtres : un succès ou une erreur. */
  readonly annonce = output<string>();

  /**
   * Moniteur ou administrateur : crée les plongées, imprime les fiches de sécurité.
   * Un directeur technique qui n'est pas moniteur ne fait que rattacher les plongées existantes.
   */
  readonly encadre = computed(() => this.auth.estMoniteur() || this.auth.estAdmin());
  readonly libelleSeance = libelleSeanceSortie;

  message = signal<string | null>(null);
  envoi = signal(false);

  creationOuverte = signal(false);
  nouvelle = sortieVide();

  sortieEnEdition = signal<SortieVue | null>(null);
  brouillon = sortieVide();

  sortieEnChoix = signal<SortieVue | null>(null);
  possibles = signal<SeancePossibleVue[]>([]);
  cochees = signal<Set<number>>(new Set());
  plongees = { parJour: 2, site: '', profondeurMax: null as number | null };
  /** Sortie dont le PDF des fiches de sécurité est en cours de génération. */
  impression = signal<number | null>(null);

  ouvrirCreation(): void {
    this.nouvelle = sortieVide();
    this.message.set(null);
    this.creationOuverte.set(true);
  }

  creer(): void {
    if (!this.nouvelle.nom.trim() || !this.nouvelle.dateDebut) {
      this.message.set('Le nom et la date de début sont obligatoires.');
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    this.api.creerSortie(this.nettoyer(this.nouvelle)).subscribe({
      next: s => {
        this.envoi.set(false);
        this.creationOuverte.set(false);
        this.creee.emit(s);
        void this.ouvrirChoix(s);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "La sortie n'a pas pu être créée.");
      }
    });
  }

  commencerEdition(s: SortieVue): void {
    this.message.set(null);
    this.sortieEnChoix.set(null);
    this.brouillon = { nom: s.nom, lieu: s.lieu, dateDebut: s.dateDebut, dateFin: s.dateFin, remarques: s.remarques };
    this.sortieEnEdition.set(s);
  }

  enregistrer(): void {
    const s = this.sortieEnEdition();
    if (!s) return;
    if (!this.brouillon.nom.trim() || !this.brouillon.dateDebut) {
      this.message.set('Le nom et la date de début sont obligatoires.');
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    this.api.modifierSortie(s.id, this.nettoyer(this.brouillon)).subscribe({
      next: maj => {
        this.envoi.set(false);
        this.sortieEnEdition.set(null);
        this.modifiee.emit(maj);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "La modification n'a pas pu être enregistrée.");
      }
    });
  }

  supprimer(s: SortieVue): void {
    if (!confirm(`Supprimer la sortie « ${s.nom} » ? Ses plongées restent dans les séances ; son séjour `
      + `(participants, voitures, chambres, programme) est supprimé avec elle.`)) return;
    this.api.supprimerSortie(s.id).subscribe({
      next: () => this.supprimee.emit(s),
      error: (e: HttpErrorResponse) => this.annonce.emit(e.error?.detail ?? "La sortie n'a pas pu être supprimée.")
    });
  }

  async ouvrirChoix(s: SortieVue): Promise<void> {
    this.message.set(null);
    this.sortieEnEdition.set(null);
    this.plongees = { parJour: 2, site: '', profondeurMax: null };
    try {
      const possibles = await firstValueFrom(this.api.seancesPossiblesSortie(s.id));
      this.possibles.set(possibles);
      this.cochees.set(new Set(possibles.filter(p => p.choisie).map(p => p.seance.id)));
      this.sortieEnChoix.set(s);
    } catch {
      this.annonce.emit('Impossible de charger les séances de ces dates.');
    }
  }

  basculer(id: number): void {
    const s = new Set(this.cochees());
    if (s.has(id)) s.delete(id); else s.add(id);
    this.cochees.set(s);
  }

  toutCocher(oui: boolean): void {
    this.cochees.set(new Set(oui ? this.possibles().filter(p => !p.autreSortie).map(p => p.seance.id) : []));
  }

  enregistrerSeances(s: SortieVue, message?: string): void {
    this.envoi.set(true);
    this.message.set(null);
    this.api.definirSeancesSortie(s.id, [...this.cochees()]).subscribe({
      next: maj => {
        this.envoi.set(false);
        this.sortieEnChoix.set(null);
        this.modifiee.emit(maj);
        this.annonce.emit(message ?? `« ${maj.nom} » : ${maj.nombrePlongees} plongée(s) enregistrée(s).`);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "Les plongées n'ont pas pu être enregistrées.");
      }
    });
  }

  /** Crée les séances de la sortie (comme « Séjour de plongée »), les coche et enregistre. */
  creerPlongees(s: SortieVue): void {
    if (!this.plongees.parJour || this.plongees.parJour < 1) {
      this.message.set('Indiquez le nombre de plongées par jour.');
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    this.api.creerSerieSeances({
      dateDebut: s.dateDebut, dateFin: s.dateFin, plongeesParJour: this.plongees.parJour, milieu: 'NATUREL',
      lieu: s.lieu, site: this.plongees.site.trim() || null, profondeurMax: this.plongees.profondeurMax || null,
      infos: []
    }).subscribe({
      next: creees => {
        this.cochees.set(new Set([...this.cochees(), ...creees.map(c => c.id)]));
        this.envoi.set(false);
        this.enregistrerSeances(s, `${creees.length} plongée(s) créée(s) et ajoutée(s) à « ${s.nom} ».`);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "Les plongées n'ont pas pu être créées.");
      }
    });
  }

  /** Les fiches de sécurité de toutes les plongées de la sortie dans un seul PDF, regroupées ou non par deux. */
  imprimerFiches(s: SortieVue, regrouper: boolean): void {
    this.impression.set(s.id);
    this.api.fichesSecuriteSortiePdf(s.id, regrouper).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const lien = document.createElement('a');
        lien.href = url;
        lien.download = `fiches-securite-${s.dateDebut}.pdf`;
        lien.click();
        URL.revokeObjectURL(url);
        this.impression.set(null);
      },
      error: async (e: HttpErrorResponse) => {
        this.impression.set(null);
        // Réponse en blob : le message du serveur est à relire comme du JSON.
        let detail: string | null = null;
        try { detail = JSON.parse(await (e.error as Blob).text()).detail ?? null; } catch { /* sans détail */ }
        this.annonce.emit(detail ?? "Le PDF des fiches de sécurité n'a pas pu être généré.");
      }
    });
  }

  private nettoyer(d: DemandeSortie): DemandeSortie {
    return {
      nom: d.nom.trim(), lieu: d.lieu?.trim() || null, dateDebut: d.dateDebut,
      dateFin: d.dateFin || null, remarques: d.remarques?.trim() || null
    };
  }
}
