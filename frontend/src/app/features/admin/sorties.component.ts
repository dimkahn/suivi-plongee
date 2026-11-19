import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { SortieVue } from '../../core/modeles';
import { libelleSeanceSortie } from '../../core/seance-sortie';
import { GestionSortieComponent } from '../sorties/gestion-sortie.component';
import { periode } from '../../core/date-fr';
import { OngletsComponent, OptionOnglet } from '../../core/onglets.component';
import { ChargementComponent } from '../../core/chargement.component';

/**
 * Sorties (week-ends, séjours) et plongées qui les composent, choisies
 * parmi les séances de leurs dates. Géré par un admin ou le directeur
 * technique, qui y rattache ses prêts de matériel.
 */
@Component({
  selector: 'app-sorties',
  imports: [ChargementComponent, RouterLink, OngletsComponent, GestionSortieComponent],
  template: `
    <div class="entete">
      <div>
        <h1>Sorties</h1>
        <p class="secondaire">
          Un week-end en carrière, un séjour en mer : ses dates, son lieu et les plongées qui en font partie.
          Les prêts de matériel se rattachent à la sortie entière.
        </p>
      </div>
      <button type="button" class="bouton-principal" (click)="gestion.ouvrirCreation()">Nouvelle sortie</button>
    </div>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <app-gestion-sortie #gestion (creee)="ajouter($event)" (modifiee)="remplacer($event)"
                        (supprimee)="retirer($event)" (annonce)="message.set($event)" />

    <app-onglets [options]="periodes" [choisi]="recentes()" (choisir)="changerFiltre($event)" />

    @if (chargement()) {
      <app-chargement />
    } @else if (liste().length === 0) {
      <div class="carte vide"><p>{{ recentes() ? 'Aucune sortie à venir.' : 'Aucune sortie enregistrée.' }}</p></div>
    } @else {
      @if (aDesPlongees() && encadre()) {
        <label class="case">
          <input type="checkbox" id="regrouper-sorties" [checked]="regrouper()" (change)="regrouper.set(!regrouper())">
          Imprimer les fiches de sécurité en regroupant les 2 plongées du jour sur une feuille
        </label>
      }
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
                <span class="etiquette-etat" [class.attention]="s.nombrePlongees === 0">
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
                  <button type="button" class="bouton-principal" (click)="gestion.ouvrirChoix(s)">Choisir les plongées</button>
                  @if (encadre()) {
                    <a class="bouton-discret" [routerLink]="['/sejours', s.id]"
                       title="Participants, arrivées et départs, voitures, chambres, repas, affaires, programme">
                      Gérer le séjour
                    </a>
                  }
                  @if (s.nombrePlongees > 0 && encadre()) {
                    <button [attr.aria-busy]="(gestion.impression() === s.id) || null" type="button" class="bouton-discret" (click)="imprimer(gestion, s)"
                            [disabled]="gestion.impression() === s.id">
                      {{ gestion.impression() === s.id ? 'Génération…' : 'Imprimer les fiches de sécurité' }}
                    </button>
                  }
                  <button type="button" class="bouton-discret" (click)="gestion.commencerEdition(s)">Modifier</button>
                  <button type="button" class="bouton-discret danger" (click)="gestion.supprimer(s)">Supprimer</button>
                </div>
          </li>
        }
      </ul>
    }

  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .entete { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas-2); flex-wrap: wrap; }
    .entete h1 { margin-bottom: var(--pas); }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }

    .sorties { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2); }
    .sorties > li { padding: var(--pas-2); }
    .ligne { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas); }
    .identite { display: flex; flex-direction: column; gap: 2px; }
    .nom { font-weight: 700; }
    .texte-libre { white-space: pre-line; margin: var(--pas) 0 0; }
    .seances { margin: var(--pas) 0 0; padding-left: 1.25rem; display: grid; gap: 2px; font-size: .9375rem; }

    .case { display: flex; align-items: center; gap: var(--pas); font-weight: 400; font-size: .9375rem; min-height: 44px; margin: 0; }
    .case input { width: auto; flex: none; }
    .danger { color: #B91C1C; border-color: #FCA5A5; }
  `]
})
export class SortiesComponent {
  private api = inject(ApiService);
  auth = inject(AuthService);
  /**
   * Moniteur ou administrateur : gère le séjour, imprime les fiches de sécurité.
   * Un directeur technique qui n'est pas moniteur ne fait que rattacher les plongées existantes.
   */
  encadre = computed(() => this.auth.estMoniteur() || this.auth.estAdmin());

  readonly periode = periode;
  readonly libelleSeance = libelleSeanceSortie;

  liste = signal<SortieVue[]>([]);
  recentes = signal(true);
  readonly periodes: OptionOnglet<boolean>[] = [{ valeur: true, libelle: 'À venir' }, { valeur: false, libelle: 'Toutes' }];
  chargement = signal(true);
  message = signal<string | null>(null);
  /** Fiches imprimées : deux plongées du même jour au même lieu sur une feuille (1er et 2e tour), sinon une par plongée. */
  regrouper = signal(true);
  aDesPlongees = computed(() => this.liste().some(s => s.nombrePlongees > 0));

  constructor() {
    void this.charger();
  }

  majuscule(texte: string): string {
    return texte.charAt(0).toUpperCase() + texte.slice(1);
  }

  changerFiltre(recentes: boolean): void {
    this.recentes.set(recentes);
    void this.charger();
  }

  ajouter(s: SortieVue): void {
    this.liste.set([s, ...this.liste().filter(x => x.id !== s.id)]
      .sort((a, b) => this.recentes() ? a.dateDebut.localeCompare(b.dateDebut) : b.dateDebut.localeCompare(a.dateDebut)));
  }

  remplacer(maj: SortieVue): void {
    this.liste.set(this.liste().map(x => x.id === maj.id ? maj : x));
  }

  retirer(s: SortieVue): void {
    this.liste.set(this.liste().filter(x => x.id !== s.id));
  }

  imprimer(gestion: GestionSortieComponent, s: SortieVue): void {
    this.message.set(null);
    gestion.imprimerFiches(s, this.regrouper());
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
