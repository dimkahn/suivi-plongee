import { Component, ChangeDetectionStrategy, OnInit, computed, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DialogueComponent } from '../../core/dialogue.component';
import { PortRepas, SejourVue, jourLong, nomComplet } from './sejour-api';
import { REPAS, Repas, RepasDuJour, joursDuSejour, listeDeCourses, presentsAuRepas, texteDeLaListe } from './liste-courses';

/**
 * L'onglet « Courses » du séjour (demande du club, 2026), pour les
 * encadrants, qui voient les régimes : les repas jour par jour, avec le
 * nombre de personnes à table (arrivées et départs du carnet) ou
 * « Restaurant », puis la liste de courses rayon par rayon, à cocher dans
 * le magasin et à copier. Les organisateurs choisissent les repas pris au
 * restaurant ; la liste se recalcule à chaque changement de participant.
 */
@Component({
  selector: 'app-sejour-courses',
  imports: [DialogueComponent],
  template: `
    <div class="titre-section">
      <h2>Liste de courses</h2>
      @if (gere() && repasDehors() !== null) {
        <button type="button" class="bouton-principal choisir-restaurant" (click)="ouvrir()">Choisir les repas au restaurant</button>
      }
    </div>
    <p class="secondaire">Pour chaque repas que l'on prépare : les personnes présentes (selon leur arrivée et leur départ)
      et les régimes de chacun. Des quantités moyennes, arrondies au-dessus, à ajuster.</p>
    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (repasDehors() !== null) {
      <div class="defilant">
        <table class="table-repas" aria-label="Repas du séjour">
          <thead>
            <tr><th scope="col">Jour</th>@for (r of REPAS; track r.code) { <th scope="col">{{ r.libelle }}</th> }</tr>
          </thead>
          <tbody>
            @for (j of tableau(); track j.jour) {
              <tr>
                <th scope="row">{{ jourLong(j.jour) }}</th>
                @for (c of j.repas; track c.repas) {
                  <td [class.restaurant]="c.restaurant">
                    @if (c.restaurant) { Restaurant } @else if (c.presents === 0) { — } @else { {{ c.presents }} à table }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (liste().rayons.length === 0) {
        <p class="vide">Rien à acheter : aucun repas à préparer avec des participants présents.</p>
      } @else {
        <div class="titre-section">
          <p><strong>{{ liste().repasPrepares }} repas à préparer</strong>, {{ liste().couverts }} couverts.</p>
          <button type="button" class="bouton-discret copier-liste" (click)="copier()">Copier la liste</button>
        </div>
        <div class="rayons">
          @for (r of liste().rayons; track r.rayon) {
            <section class="carte rayon">
              <h3>{{ r.rayon }}</h3>
              <ul>
                @for (a of r.articles; track a.article) {
                  <li>
                    <label class="case" [class.achete]="achetes().has(a.article)">
                      <input type="checkbox" [checked]="achetes().has(a.article)" (change)="cocher(a.article)">
                      <span>{{ a.article }}@if (a.quantite) { <strong> — {{ a.quantite }}</strong>}</span>
                    </label>
                  </li>
                }
              </ul>
            </section>
          }
        </div>
        @if (precisions().length > 0) {
          <h3>Précisions pour la cuisine</h3>
          <ul class="precisions">
            @for (p of precisions(); track p.id) {
              <li><strong>{{ nomComplet(p) }}</strong> : {{ p.regimePrecision }}</li>
            }
          </ul>
        }
      }
    } @else if (!message()) {
      <p class="vide">Chargement…</p>
    }

    <app-dialogue [ouvert]="ouvert()" [large]="true" [erreur]="erreur()" titre="Repas au restaurant"
                  (fermer)="ouvert.set(false)">
      @if (ouvert()) {
        <p class="secondaire">Cochez les repas que l'on ne prépare pas (restaurant, repas fourni…) : ils ne comptent pas
          dans la liste de courses.</p>
        <div class="defilant">
          <table class="table-repas choix-restaurant">
            <thead>
              <tr><th scope="col">Jour</th>@for (r of REPAS; track r.code) { <th scope="col">{{ r.libelle }}</th> }</tr>
            </thead>
            <tbody>
              @for (j of jours(); track j) {
                <tr>
                  <th scope="row">{{ jourLong(j) }}</th>
                  @for (r of REPAS; track r.code) {
                    <td>
                      <label class="case">
                        <input type="checkbox" [checked]="brouillon().has(j + r.code)" (change)="basculer(j, r.code)"
                               [attr.aria-label]="r.libelle + ' du ' + jourLong(j) + ' au restaurant'">
                        <span>Restaurant</span>
                      </label>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" (click)="enregistrer()" [disabled]="envoi()">
            {{ envoi() ? 'Envoi…' : 'Enregistrer' }}
          </button>
          <button type="button" class="bouton-discret" (click)="ouvert.set(false)">Annuler</button>
        </div>
      }
    </app-dialogue>
  `,
  styles: [`
    .defilant { overflow-x: auto; }
    .table-repas { border-collapse: collapse; width: 100%; margin-bottom: var(--pas-2); }
    .table-repas th, .table-repas td { padding: var(--pas); border-bottom: 1px solid var(--trait); text-align: left; }
    .table-repas thead th { font-size: .875rem; color: var(--craie); }
    .table-repas td.restaurant { color: var(--en-cours); font-weight: 600; }
    .rayons { display: grid; gap: var(--pas-2); grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .rayon h3 { margin-top: 0; }
    .rayon ul, .precisions { list-style: none; margin: 0; padding: 0; }
    .case { display: flex; align-items: center; gap: var(--pas); font-weight: 400; min-height: 44px; margin: 0; }
    .case input { width: auto; flex: none; min-width: 24px; min-height: 24px; }
    .case.achete span { text-decoration: line-through; color: var(--craie); }
    .precisions li { padding: var(--pas) 0; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SejourCoursesComponent implements OnInit {
  sejour = input.required<SejourVue>();
  port = input.required<PortRepas>();
  /** Organisateur : choisit les repas au restaurant (le serveur revérifie). */
  gere = input(false);

  readonly REPAS = REPAS;
  readonly jourLong = jourLong;
  readonly nomComplet = nomComplet;

  /** Les repas au restaurant enregistrés ; null tant qu'ils ne sont pas lus. */
  repasDehors = signal<RepasDuJour[] | null>(null);
  message = signal<string | null>(null);
  /** Ce qui est déjà dans le chariot : sur cet écran seulement, rien n'est enregistré. */
  achetes = signal<Set<string>>(new Set());

  ouvert = signal(false);
  envoi = signal(false);
  erreur = signal<string | null>(null);
  brouillon = signal<Set<string>>(new Set());

  readonly jours = computed(() => {
    const s = this.sejour().sortie;
    return joursDuSejour(s.dateDebut, s.dateFin);
  });

  readonly liste = computed(() => {
    const s = this.sejour().sortie;
    return listeDeCourses(this.sejour().participants, s.dateDebut, s.dateFin, this.repasDehors() ?? []);
  });

  readonly tableau = computed(() => {
    const dehors = new Set((this.repasDehors() ?? []).map(r => r.jour + r.repas));
    return this.jours().map(jour => ({
      jour,
      repas: REPAS.map(r => ({
        repas: r.code,
        restaurant: dehors.has(jour + r.code),
        presents: presentsAuRepas(this.sejour().participants, jour, r.code).length
      }))
    }));
  });

  readonly precisions = computed(() => this.sejour().participants.filter(p => p.regimePrecision));

  ngOnInit(): void {
    this.port().lire().subscribe({
      next: l => this.repasDehors.set(l),
      error: () => this.message.set('Les repas du séjour n’ont pas pu être lus. Vérifiez le réseau.')
    });
  }

  cocher(article: string): void {
    const s = new Set(this.achetes());
    if (s.has(article)) s.delete(article); else s.add(article);
    this.achetes.set(s);
  }

  ouvrir(): void {
    this.erreur.set(null);
    this.brouillon.set(new Set((this.repasDehors() ?? []).map(r => r.jour + r.repas)));
    this.ouvert.set(true);
  }

  basculer(jour: string, repas: Repas): void {
    const s = new Set(this.brouillon());
    if (s.has(jour + repas)) s.delete(jour + repas); else s.add(jour + repas);
    this.brouillon.set(s);
  }

  enregistrer(): void {
    const choisis = this.jours().flatMap(jour => REPAS.filter(r => this.brouillon().has(jour + r.code))
      .map(r => ({ jour, repas: r.code })));
    this.envoi.set(true);
    this.port().definir(choisis).subscribe({
      next: l => {
        this.envoi.set(false);
        this.repasDehors.set(l);
        this.ouvert.set(false);
        this.message.set('Les repas au restaurant sont enregistrés : la liste est à jour.');
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.erreur.set(e.error?.detail ?? 'L’enregistrement a échoué. Vérifiez le réseau.');
      }
    });
  }

  copier(): void {
    const s = this.sejour().sortie;
    const texte = texteDeLaListe(s.lieu ? `${s.nom}, ${s.lieu}` : s.nom, this.liste());
    navigator.clipboard.writeText(texte).then(
      () => this.message.set('Liste copiée : collez-la dans un message ou une note.'),
      () => this.message.set('La copie n’a pas marché sur cet appareil.'));
  }
}
