import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { FileSejourService } from './file-sejour.service';
import { cleListeSejours } from './sejour-hors-ligne';
import { periode } from '../../core/date-fr';
import { OngletsComponent, OptionOnglet } from '../../core/onglets.component';
import { SejourApi, SejourResumeVue } from './sejour-api';

/**
 * Les séjours : pour les encadrants, toutes les sorties (à venir ou toutes) ;
 * pour un élève, celles où il est inscrit. Chaque ligne ouvre le séjour.
 */
@Component({
  selector: 'app-sejours-liste',
  imports: [RouterLink, OngletsComponent],
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
      <app-onglets [options]="periodes" [choisi]="toutes()" (choisir)="changer($event)" />
    }

    @if (erreur(); as e) { <div class="alerte" role="alert">{{ e }}</div> }
    @if (horsLigne()) {
      <p class="secondaire hors-ligne" role="status">
        Hors ligne : la liste telle qu'elle était à la dernière ouverture. Seuls les séjours déjà ouverts sur ce
        téléphone (ou emportés par « Préparer hors ligne ») s'ouvrent sans réseau.
      </p>
    }
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
  private file = inject(FileSejourService);
  auth = inject(AuthService);
  /** La liste vient de la copie du téléphone, faute de réseau. */
  horsLigne = signal(false);
  readonly periode = periode;

  liste = signal<SejourResumeVue[]>([]);
  toutes = signal(false);
  readonly periodes: OptionOnglet<boolean>[] = [{ valeur: false, libelle: 'À venir' }, { valeur: true, libelle: 'Tous' }];
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
      const lu = await this.file.lireAvecCopie(cleListeSejours(this.toutes()), () => this.api.lister(this.toutes()));
      this.liste.set(lu.valeur);
      this.horsLigne.set(lu.copieDu !== null);
      this.erreur.set(null);
    } catch {
      this.erreur.set('Impossible de charger les séjours : pas de réseau, et la liste n’a pas encore été ouverte sur ce téléphone.');
    } finally {
      this.chargement.set(false);
    }
  }
}
