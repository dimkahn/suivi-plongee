import { Component, ElementRef, computed, inject, signal, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { FileEcrituresService } from '../../core/file-ecritures.service';
import { SeanceVue } from '../../core/modeles';
import { DateFrPipe, dateDuJour } from '../../core/date-fr';
import { CalendrierSeancesComponent } from '../../core/calendrier-seances.component';
import { correspondLieuSiteInfo } from '../../core/seance-lieu';

type Tri = 'DATE_RECENTE' | 'DATE_ANCIENNE' | 'NUMERO';

@Component({
  selector: 'app-fiches-securite-liste',
  imports: [FormsModule, RouterLink, DateFrPipe, CalendrierSeancesComponent],
  template: `
    <h1>Fiches de sécurité</h1>
    <p class="secondaire">
      Article A322-72 du Code du sport : noms, aptitudes et fonction des
      plongeurs par palanquée, paramètres prévus et réalisés. Non obligatoire
      en piscine ou fosse de 6 m ou moins (A322-98) — cette liste ne montre
      donc que les séances en milieu naturel ou de plus de 6 m ; au DP de
      juger si une fiche reste utile pour les autres.
    </p>

    <section class="filtres">
      <div>
        <label for="filtre-date">Date</label>
        <button id="filtre-date" type="button" class="choix-seance" aria-haspopup="dialog"
                (click)="ouvrirDialogueDate()">
          <span aria-hidden="true">📅</span>
          <span class="libelle-choix">{{ filtreDate() ? (filtreDate() | dateFr) : 'Toutes les dates' }}</span>
          <span class="changer">Changer</span>
        </button>
      </div>
      <div>
        <label for="filtre-lieu">Lieu, site ou info</label>
        <input id="filtre-lieu" type="search" name="filtreLieu" placeholder="Carrière, épave, remarque…"
               [ngModel]="filtreLieu()" (ngModelChange)="filtreLieu.set($event)">
      </div>
      <div>
        <label for="tri">Classer par</label>
        <select id="tri" name="tri" [ngModel]="tri()" (ngModelChange)="tri.set($event)">
          <option value="DATE_RECENTE">Date, la plus récente d'abord</option>
          <option value="DATE_ANCIENNE">Date, la plus ancienne d'abord</option>
          <option value="NUMERO">N° de plongée dans la journée</option>
        </select>
      </div>
      @if (filtreDate() || filtreLieu()) {
        <button type="button" class="bouton-discret" (click)="reinitialiserFiltres()">Réinitialiser</button>
      }
    </section>

    <dialog #dialogueDate class="dialogue-seance" aria-labelledby="titre-dialogue-date"
            (close)="dialogueOuvert.set(false)">
      @if (dialogueOuvert()) {
        <div class="entete-dialogue">
          <h2 id="titre-dialogue-date">Choisir la date</h2>
          <button type="button" class="bouton-discret" (click)="fermerDialogueDate()">Fermer</button>
        </div>
        <app-calendrier-seances [seances]="concernees()"
                                [jourSelectionne]="jourDialogue()"
                                (jourSelectionneChange)="toucherJour($event)" />
        @if (jourDialogue(); as j) {
          @if (!aDesSeances(j)) {
            <p class="secondaire aucune">Aucune séance concernée ce jour-là.</p>
          }
        }
        @if (filtreDate()) {
          <button type="button" class="bouton-discret toutes-dates" (click)="choisirDate('')">
            Toutes les dates
          </button>
        }
      }
    </dialog>

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (erreur()) {
      <div class="carte vide"><p>{{ erreur() }}</p></div>
    } @else if (toutes().length === 0) {
      <div class="carte vide"><p>Aucune séance concernée sur cette saison.</p></div>
    } @else if (seances().length === 0) {
      <div class="carte vide"><p>Aucune fiche ne correspond aux filtres.</p></div>
    } @else {
      <ul>
        @for (s of seances(); track s.id) {
          <li class="carte">
            <div class="ligne">
              <div class="identite">
                <span class="nom">
                  {{ s.date | dateFr }}{{ aPlusieursCeJour(s) || tri() === 'NUMERO' ? ' (n° ' + s.ordre + ')' : '' }}{{ s.lieu ? ' — ' + s.lieu : '' }}
                </span>
                @if (s.site) {
                  <span class="site"><span class="etiquette-champ">Site :</span> {{ s.site }}</span>
                }
                <span class="secondaire">
                  {{ s.milieu === 'NATUREL' ? 'Milieu naturel' : 'Milieu artificiel' }}
                  {{ s.profondeurMax ? ' · ' + s.profondeurMax + ' m' : '' }}
                </span>
                @if (s.commentaire) {
                  <span class="info"><span class="etiquette-champ">Info complémentaire :</span> {{ s.commentaire }}</span>
                }
              </div>
              <div class="actions">
                @if (aUneFiche(s)) {
                  <span class="etiquette">Fiche enregistrée</span>
                }
                <a [routerLink]="['/fiches-securite', s.id]" class="bouton-discret">
                  {{ aUneFiche(s) ? 'Modifier la fiche' : 'Établir la fiche' }}
                </a>
                @if (aUneFiche(s)) {
                  <a [routerLink]="['/fiches-securite', s.id, 'realise']" class="bouton-discret">
                    Compléter au retour de plongée
                  </a>
                }
              </div>
            </div>
          </li>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }

    .filtres {
      display: flex; flex-wrap: wrap; gap: var(--pas-2) var(--pas-3); align-items: flex-end;
      margin: var(--pas-2) 0;
    }
    .filtres > div { min-width: 200px; flex: 1 1 200px; }
    .filtres label { display: block; margin: 0 0 4px; font-weight: 700; font-size: .9375rem; }
    .filtres input, .filtres select { margin: 0; width: 100%; }
    .filtres .choix-seance { max-width: none; }
    .toutes-dates { display: block; margin: var(--pas-2) auto 0; }

    ul { list-style: none; margin: var(--pas-3) 0 0; padding: 0; display: grid; gap: var(--pas-2); }
    li { padding: var(--pas-2); }
    .ligne { display: flex; justify-content: space-between; align-items: center; gap: var(--pas-2); flex-wrap: wrap; }
    .identite { display: flex; flex-direction: column; gap: 2px; }
    .nom { font-weight: 700; }
    .site, .info { font-size: .9375rem; overflow-wrap: anywhere; }
    .info { white-space: pre-line; }
    .etiquette-champ { font-weight: 700; color: var(--craie); }
    .actions { display: flex; align-items: center; gap: var(--pas-2); flex-wrap: wrap; }
    .etiquette {
      font-size: .8125rem; font-weight: 700; color: var(--profond);
      border: 1px solid var(--profond); border-radius: var(--r-s); padding: 2px 8px;
    }
  `]
})
export class FichesSecuriteListeComponent {
  private api = inject(ApiService);
  private file = inject(FileEcrituresService);

  /** Une fiche établie hors ligne, pas encore partie, compte déjà. */
  aUneFiche(s: SeanceVue): boolean {
    return s.ficheSecurite || this.file.pourSeance(s.id, 'fiche').length > 0;
  }

  toutes = signal<SeanceVue[]>([]);
  chargement = signal(true);
  erreur = signal<string | null>(null);

  filtreDate = signal('');
  filtreLieu = signal('');

  tri = signal<Tri>('DATE_RECENTE');

  /** Séances qui appellent une fiche : milieu naturel ou plus de 6 m (A322-98). */
  concernees = computed(() =>
    this.toutes().filter(s => s.milieu === 'NATUREL' || (s.profondeurMax ?? 0) > 6));

  seances = computed(() => {
    const date = this.filtreDate();
    const lieu = this.filtreLieu();
    const tri = this.tri();
    return this.concernees()
      .filter(s => !date || s.date === date)
      .filter(s => correspondLieuSiteInfo(s, lieu))
      .sort((a, b) => {
        if (tri === 'DATE_ANCIENNE') return a.date.localeCompare(b.date) || a.ordre - b.ordre;
        // Par n° de plongée : toutes les 1res plongées, puis les 2es… la plus récente d'abord à n° égal.
        if (tri === 'NUMERO') return a.ordre - b.ordre || b.date.localeCompare(a.date);
        return b.date.localeCompare(a.date) || a.ordre - b.ordre;
      });
  });

  private dialogueDate = viewChild.required<ElementRef<HTMLDialogElement>>('dialogueDate');
  dialogueOuvert = signal(false);
  /** Jour touché dans le calendrier du dialogue. */
  jourDialogue = signal<string | null>(null);

  /** Nombre de séances listées à chaque date, pour numéroter les plongées d'une journée à plusieurs séances. */
  private comptesParDate = computed(() => {
    const compte = new Map<string, number>();
    for (const s of this.seances()) {
      compte.set(s.date, (compte.get(s.date) ?? 0) + 1);
    }
    return compte;
  });

  constructor() {
    void this.charger();
  }

  aPlusieursCeJour(s: SeanceVue): boolean {
    return (this.comptesParDate().get(s.date) ?? 0) > 1;
  }

  private async charger(): Promise<void> {
    try {
      this.toutes.set(await this.api.seances());
    } catch {
      this.erreur.set('Impossible de charger les séances.');
    } finally {
      this.chargement.set(false);
    }
  }

  ouvrirDialogueDate(): void {
    this.jourDialogue.set(this.filtreDate() || dateDuJour());
    this.dialogueOuvert.set(true);
    this.dialogueDate().nativeElement.showModal();
  }

  fermerDialogueDate(): void {
    this.dialogueDate().nativeElement.close();
  }

  aDesSeances(jour: string): boolean {
    return this.concernees().some(s => s.date === jour);
  }

  /** Un jour avec au moins une séance concernée devient le filtre ; sinon on reste dans le calendrier. */
  toucherJour(jour: string | null): void {
    this.jourDialogue.set(jour);
    if (jour && this.aDesSeances(jour)) this.choisirDate(jour);
  }

  choisirDate(jour: string): void {
    this.filtreDate.set(jour);
    this.fermerDialogueDate();
  }

  reinitialiserFiltres(): void {
    this.filtreDate.set('');
    this.filtreLieu.set('');
  }

}
