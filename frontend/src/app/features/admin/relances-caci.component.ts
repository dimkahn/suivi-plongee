import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { RelanceCaciVue } from '../../core/modeles';
import { DateFrPipe } from '../../core/date-fr';
import { PlurielPipe } from '../../core/pluriel';
import { filtrerTraceRelances } from '../../core/trace-relances-caci';

/**
 * Historique des e-mails de relance CACI partis (spec
 * 2026-10-21-relances-caci, R19 à R21), en lecture seule : le serveur seul
 * les envoie chaque matin et efface ceux de plus de deux ans ; rien ici ne
 * les crée, ne les modifie ni ne les supprime. Réseau obligatoire.
 */
@Component({
  selector: 'app-relances-caci',
  imports: [FormsModule, RouterLink, DateFrPipe, PlurielPipe],
  template: `
    <h1>Relances CACI</h1>
    <p class="secondaire">
      Les e-mails partis chaque matin vers 7 h : relance d'un moniteur dont le CACI arrive à échéance,
      récapitulatif aux administrateurs. Gardés deux ans. Pour agir, saisissez le nouveau CACI dans
      <a routerLink="/admin/eleves">Élèves</a> ou <a routerLink="/admin/moniteurs">Moniteurs</a>.
    </p>

    @if (message(); as m) { <div class="alerte" role="alert">{{ m }}</div> }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (trace().length === 0) {
      <div class="carte vide"><p>Aucune relance envoyée ces deux dernières années.</p></div>
    } @else {
      <label for="recherche-relances">Rechercher un nom ou une adresse</label>
      <input id="recherche-relances" type="search" name="recherche" placeholder="Destinataire ou personne concernée…"
             [ngModel]="recherche()" (ngModelChange)="recherche.set($event)">
      <p class="secondaire compte" role="status">
        @if (recherche().trim()) {
          {{ visibles().length | pluriel:'envoi trouvé':'envois trouvés' }} sur {{ trace().length }}
        } @else {
          {{ trace().length | pluriel:'envoi' }}, du plus récent au plus ancien
        }
      </p>

      <ul class="envois">
        @for (e of visibles(); track $index) {
          <li class="carte envoi">
            <span class="date">{{ e.envoyeLe | dateFr }}</span>
            <span class="destinataire">
              À {{ e.destinatairePrenom }} {{ e.destinataireNom }}
              <span class="secondaire">· {{ e.destinataireEmail }}</span>
            </span>
            <span class="secondaire">
              {{ e.personnes.length > 1 ? 'Personnes concernées' : 'Personne concernée' }} :
              @for (p of e.personnes; track $index; let dernier = $last) {
                {{ p.prenom }} {{ p.nom }}{{ dernier ? '' : ', ' }}
              } @empty { aucune }
            </span>
          </li>
        } @empty {
          <div class="carte vide"><p>Aucun envoi ne correspond à « {{ recherche().trim() }} ».</p></div>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    label { display: block; margin: var(--pas-3) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    input[type=search] { width: 100%; max-width: 480px; min-height: 44px; }
    .compte { margin: var(--pas) 0 var(--pas-2); }
    .envois { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2); }
    .envoi { display: flex; flex-direction: column; gap: 2px; padding: var(--pas-2); overflow-wrap: anywhere; }
    .date { font-weight: 700; }
  `]
})
export class RelancesCaciComponent {
  private api = inject(ApiService);

  trace = signal<RelanceCaciVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  recherche = signal('');

  visibles = computed(() => filtrerTraceRelances(this.trace(), this.recherche()));

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    try {
      this.trace.set(await firstValueFrom(this.api.relancesCaci()));
    } catch {
      this.message.set('Impossible de charger l\'historique des relances : vérifiez la connexion.');
    } finally {
      this.chargement.set(false);
    }
  }
}
