import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { DemandeSortie, SeancePossibleVue, SeanceSortieVue, SortieVue } from '../../core/modeles';
import { DateFrPipe, dateFr, periode } from '../../core/date-fr';
import { DialogueComponent } from '../../core/dialogue.component';

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

function sortieVide(): DemandeSortie {
  return { nom: '', lieu: null, dateDebut: '', dateFin: null, remarques: null };
}

/**
 * Sorties (week-ends, séjours) et plongées qui les composent, choisies
 * parmi les séances de leurs dates. Géré par un admin ou le directeur
 * technique, qui y rattache ses prêts de matériel.
 */
@Component({
  selector: 'app-sorties',
  imports: [FormsModule, RouterLink, DateFrPipe, DialogueComponent],
  template: `
    @if (auth.estAdmin()) {
      <a routerLink="/admin" class="retour">← Administration</a>
    } @else {
      <a routerLink="/materiel/prets" class="retour">← Prêts de matériel</a>
    }
    <div class="entete">
      <div>
        <h1>Sorties</h1>
        <p class="secondaire">
          Un week-end en carrière, un séjour en mer : ses dates, son lieu et les plongées qui en font partie.
          Les prêts de matériel se rattachent à la sortie entière.
        </p>
      </div>
      <button type="button" class="bouton-principal" (click)="ouvrirCreation()">Nouvelle sortie</button>
    </div>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

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
          <button type="submit" class="bouton-principal" [disabled]="envoi()">
            {{ envoi() ? 'Création…' : 'Créer puis choisir les plongées' }}
          </button>
          <button type="button" class="bouton-discret" (click)="creationOuverte.set(false)">Annuler</button>
        </div>
      </form>
    </app-dialogue>

    <div class="onglets" role="tablist">
      <button type="button" role="tab" class="bouton-discret" [class.actif]="recentes()"
              [attr.aria-selected]="recentes()" (click)="changerFiltre(true)">À venir</button>
      <button type="button" role="tab" class="bouton-discret" [class.actif]="!recentes()"
              [attr.aria-selected]="!recentes()" (click)="changerFiltre(false)">Toutes</button>
    </div>

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (liste().length === 0) {
      <div class="carte vide"><p>{{ recentes() ? 'Aucune sortie à venir.' : 'Aucune sortie enregistrée.' }}</p></div>
    } @else {
      <ul class="sorties">
        @for (s of liste(); track s.id) {
          <li class="carte">
              <div class="ligne">
                <div class="identite">
                  <span class="nom">{{ s.nom }}</span>
                  <span class="secondaire">
                    {{ majuscule(periode(s.dateDebut, s.dateFin)) }}@if (s.lieu) { · {{ s.lieu }}}
                  </span>
                </div>
                <span class="etat" [class.sans-plongee]="s.nombrePlongees === 0">
                  {{ s.nombrePlongees }} plongée{{ s.nombrePlongees > 1 ? 's' : '' }}
                </span>
              </div>
              @if (s.remarques) { <p class="texte-libre secondaire">{{ s.remarques }}</p> }
              @if (s.seances.length > 0) {
                <ul class="seances">
                  @for (se of s.seances; track se.id) { <li>{{ libelleSeance(se) }}</li> }
                </ul>
              }

                <div class="actions">
                  <button type="button" class="bouton-principal" (click)="ouvrirChoix(s)">Choisir les plongées</button>
                  @if (s.nombrePlongees > 0) {
                    <button type="button" class="bouton-discret" (click)="imprimerFiches(s)"
                            [disabled]="impression() === s.id">
                      {{ impression() === s.id ? 'Génération…' : 'Imprimer les fiches de sécurité' }}
                    </button>
                  }
                  <button type="button" class="bouton-discret" (click)="commencerEdition(s)">Modifier</button>
                  <button type="button" class="bouton-discret danger" (click)="supprimer(s)">Supprimer</button>
                </div>
          </li>
        }
      </ul>
    }

    <app-dialogue [ouvert]="sortieEnEdition() !== null" titre="Modifier la sortie" [erreur]="message()" [large]="true"
                  (fermer)="edition.set(null)">
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
        <button type="button" class="bouton-principal" (click)="enregistrer()" [disabled]="envoi()">
          {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
        <button type="button" class="bouton-discret" (click)="edition.set(null)">Annuler</button>
      </div>
    </app-dialogue>

    <app-dialogue [ouvert]="sortieEnChoix() !== null" [large]="true"
                  [titre]="'Plongées de « ' + (sortieEnChoix()?.nom ?? '') + ' »'"
                  [erreur]="message()" (fermer)="choix.set(null)">
      @if (sortieEnChoix(); as s) {
                  <p class="secondaire">
                    Les séances du {{ s.dateDebut | dateFr }} au {{ s.dateFin | dateFr }}. Cochez celles qui font partie
                    de la sortie ; une séance déjà prise par une autre sortie n'est pas proposée.
                  </p>
                  @if (possibles().length === 0) {
                    <p class="vide">Aucune séance ces jours-là : créez les plongées ci-dessous.</p>
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

                  <div class="actions-dialogue">
                    <button type="button" class="bouton-principal" (click)="enregistrerSeances(s)" [disabled]="envoi()">
                      {{ envoi() ? 'Enregistrement…' : 'Enregistrer les plongées' }}
                    </button>
                    <button type="button" class="bouton-discret" (click)="choix.set(null)">Annuler</button>
                  </div>
      }
    </app-dialogue>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .retour { display: inline-flex; align-items: center; min-height: 44px; margin-bottom: var(--pas); }
    .entete { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas-2); flex-wrap: wrap; }
    .entete h1 { margin-bottom: var(--pas); }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0 var(--pas-2); }
    textarea { resize: vertical; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }
    .onglets { display: flex; gap: var(--pas); margin: var(--pas-2) 0; }
    .onglets .actif { background: var(--profond); color: #fff; border-color: var(--profond); font-weight: 700; }

    .sorties { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2); }
    .sorties > li { padding: var(--pas-2); }
    .ligne { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas); }
    .identite { display: flex; flex-direction: column; gap: 2px; }
    .nom { font-weight: 700; }
    .etat { flex: none; padding: 2px 10px; border-radius: var(--r-s); font-size: .8125rem; font-weight: 700;
            background: #E0F2FE; color: var(--profond-fonce); }
    .etat.sans-plongee { background: var(--en-cours-clair); color: var(--en-cours); }
    .texte-libre { white-space: pre-line; margin: var(--pas) 0 0; }
    .seances { margin: var(--pas) 0 0; padding-left: 1.25rem; display: grid; gap: 2px; font-size: .9375rem; }

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
    .danger { color: #B91C1C; border-color: #FCA5A5; }
  `]
})
export class SortiesComponent {
  private api = inject(ApiService);
  auth = inject(AuthService);

  readonly periode = periode;

  liste = signal<SortieVue[]>([]);
  recentes = signal(true);
  chargement = signal(true);
  message = signal<string | null>(null);
  envoi = signal(false);

  creationOuverte = signal(false);
  nouvelle = sortieVide();

  edition = signal<number | null>(null);
  sortieEnEdition = computed(() => this.liste().find(s => s.id === this.edition()) ?? null);
  brouillon = sortieVide();

  choix = signal<number | null>(null);
  sortieEnChoix = computed(() => this.liste().find(s => s.id === this.choix()) ?? null);
  possibles = signal<SeancePossibleVue[]>([]);
  cochees = signal<Set<number>>(new Set());
  plongees = { parJour: 2, site: '', profondeurMax: null as number | null };
  /** Sortie dont le PDF des fiches de sécurité est en cours de génération. */
  impression = signal<number | null>(null);

  constructor() {
    void this.charger();
  }

  majuscule(texte: string): string {
    return texte.charAt(0).toUpperCase() + texte.slice(1);
  }

  /** « sam. 10/10/2026 · plongée 1 · Blaisy – Le Tombant (Bateau 2) ». */
  libelleSeance(se: SeanceSortieVue): string {
    const [a, m, j] = se.date.split('-').map(Number);
    const jour = JOURS[new Date(a, m - 1, j).getDay()];
    const lieu = [se.lieu, se.site].filter(Boolean).join(' – ');
    return [`${jour} ${dateFr(se.date)}`, se.ordre ? `plongée ${se.ordre}` : null,
      lieu ? lieu + (se.commentaire ? ` (${se.commentaire})` : '') : se.commentaire]
      .filter(Boolean).join(' · ');
  }

  changerFiltre(recentes: boolean): void {
    this.recentes.set(recentes);
    void this.charger();
  }

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
        this.liste.set([s, ...this.liste().filter(x => x.id !== s.id)]
          .sort((a, b) => this.recentes() ? a.dateDebut.localeCompare(b.dateDebut) : b.dateDebut.localeCompare(a.dateDebut)));
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
    this.choix.set(null);
    this.brouillon = { nom: s.nom, lieu: s.lieu, dateDebut: s.dateDebut, dateFin: s.dateFin, remarques: s.remarques };
    this.edition.set(s.id);
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
        this.edition.set(null);
        this.remplacer(maj);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "La modification n'a pas pu être enregistrée.");
      }
    });
  }

  supprimer(s: SortieVue): void {
    if (!confirm(`Supprimer la sortie « ${s.nom} » ? Ses plongées restent dans les séances.`)) return;
    this.api.supprimerSortie(s.id).subscribe({
      next: () => this.liste.set(this.liste().filter(x => x.id !== s.id)),
      error: (e: HttpErrorResponse) => this.message.set(e.error?.detail ?? "La sortie n'a pas pu être supprimée.")
    });
  }

  async ouvrirChoix(s: SortieVue): Promise<void> {
    this.message.set(null);
    this.edition.set(null);
    this.plongees = { parJour: 2, site: '', profondeurMax: null };
    try {
      const possibles = await firstValueFrom(this.api.seancesPossiblesSortie(s.id));
      this.possibles.set(possibles);
      this.cochees.set(new Set(possibles.filter(p => p.choisie).map(p => p.seance.id)));
      this.choix.set(s.id);
    } catch {
      this.message.set('Impossible de charger les séances de ces dates.');
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
        this.remplacer(maj);
        this.choix.set(null);
        this.message.set(message ?? `« ${maj.nom} » : ${maj.nombrePlongees} plongée(s) enregistrée(s).`);
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

  /** Les fiches de sécurité de toutes les plongées de la sortie, une par page, dans un seul PDF. */
  imprimerFiches(s: SortieVue): void {
    this.impression.set(s.id);
    this.message.set(null);
    this.api.fichesSecuriteSortiePdf(s.id).subscribe({
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
        this.message.set(detail ?? "Le PDF des fiches de sécurité n'a pas pu être généré.");
      }
    });
  }

  private remplacer(maj: SortieVue): void {
    this.liste.set(this.liste().map(x => x.id === maj.id ? maj : x));
  }

  private nettoyer(d: DemandeSortie): DemandeSortie {
    return {
      nom: d.nom.trim(), lieu: d.lieu?.trim() || null, dateDebut: d.dateDebut,
      dateFin: d.dateFin || null, remarques: d.remarques?.trim() || null
    };
  }

  private async charger(): Promise<void> {
    this.chargement.set(true);
    try {
      this.liste.set(await firstValueFrom(this.api.sorties(this.recentes())));
    } catch {
      this.message.set('Impossible de charger les sorties.');
    } finally {
      this.chargement.set(false);
    }
  }
}
