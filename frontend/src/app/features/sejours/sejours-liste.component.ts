import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { periode } from '../../core/date-fr';
import { SejourApi, SejourResumeVue } from './sejour-api';

/**
 * Les séjours : pour les encadrants, toutes les sorties (à venir ou toutes) ;
 * pour un élève, celles où il est inscrit. Chaque ligne ouvre le séjour.
 */
@Component({
  selector: 'app-sejours-liste',
  imports: [RouterLink],
  template: `
    <h1>Séjours</h1>
    <p class="secondaire">
      @if (encadrant()) {
        Chaque sortie a son séjour : participants, arrivées et départs, voitures, chambres, repas,
        affaires à prévoir et programme.
        @if (auth.gereMateriel()) { Les sorties se créent dans « Sorties ». }
      } @else {
        Les séjours où vous êtes inscrit : votre voyage, votre chambre, le programme et les affaires à prévoir.
      }
    </p>

    @if (auth.estMoniteur() || auth.estAdmin()) {
      <a class="carte groupes" routerLink="/groupes">
        <span class="nom">Groupes de plongeurs</span>
        <span class="secondaire">La liste des plongeurs d'un séjour, reprise dans ses fiches de sécurité.</span>
      </a>
    }

    @if (encadrant()) {
      <div class="onglets" role="tablist">
        <button type="button" role="tab" class="bouton-discret" [class.actif]="!toutes()"
                [attr.aria-selected]="!toutes()" (click)="changer(false)">À venir</button>
        <button type="button" role="tab" class="bouton-discret" [class.actif]="toutes()"
                [attr.aria-selected]="toutes()" (click)="changer(true)">Tous</button>
      </div>
    }

    @if (erreur(); as e) { <div class="alerte" role="alert">{{ e }}</div> }
    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (liste().length === 0) {
      <div class="carte vide"><p>{{ encadrant() ? 'Aucune sortie.' : 'Vous n’êtes inscrit à aucun séjour.' }}</p></div>
    } @else {
      <ul class="sejours">
        @for (s of liste(); track s.sortieId) {
          <li>
            <a class="carte" [routerLink]="['/sejours', s.sortieId]">
              <span class="nom">{{ s.nom }}</span>
              <span class="secondaire">{{ majuscule(periode(s.dateDebut, s.dateFin)) }}@if (s.lieu) { · {{ s.lieu }}}</span>
              <span class="compte">
                {{ s.participants }} participant{{ s.participants > 1 ? 's' : '' }}
                @if (s.jeParticipe) { · vous en êtes }
              </span>
            </a>
          </li>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .onglets { display: flex; gap: var(--pas); margin: var(--pas-2) 0; }
    .onglets .actif { background: var(--profond); color: #fff; border-color: var(--profond); font-weight: 700; }
    .sejours { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2); }
    .groupes { display: flex; flex-direction: column; gap: 2px; padding: var(--pas-2); min-height: 44px;
               margin: var(--pas-2) 0; text-decoration: none; color: inherit; }
    .sejours a { display: flex; flex-direction: column; gap: 2px; padding: var(--pas-2); min-height: 44px;
                 text-decoration: none; color: inherit; }
    .nom { font-weight: 700; color: var(--profond-fonce); }
    .compte { font-size: .875rem; }
  `]
})
export class SejoursListeComponent {
  private api = inject(SejourApi);
  auth = inject(AuthService);
  readonly periode = periode;

  liste = signal<SejourResumeVue[]>([]);
  toutes = signal(false);
  chargement = signal(true);
  erreur = signal<string | null>(null);

  constructor() {
    void this.charger();
  }

  encadrant(): boolean {
    return this.auth.estMoniteur() || this.auth.estAdmin() || this.auth.gereMateriel();
  }

  majuscule(t: string): string {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  changer(toutes: boolean): void {
    this.toutes.set(toutes);
    void this.charger();
  }

  private async charger(): Promise<void> {
    this.chargement.set(true);
    try {
      this.liste.set(await firstValueFrom(this.api.lister(this.toutes())));
      this.erreur.set(null);
    } catch {
      this.erreur.set('Impossible de charger les séjours (réseau nécessaire).');
    } finally {
      this.chargement.set(false);
    }
  }
}
