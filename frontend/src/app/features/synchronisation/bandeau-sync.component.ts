import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { FileAttenteService, SaisieRefusee } from '../../core/file-attente.service';
import { EcritureRefusee, FileEcrituresService } from '../../core/file-ecritures.service';
import { ReseauService } from '../../core/reseau.service';
import { DateFrPipe } from '../../core/date-fr';

/**
 * Trois informations, par ordre d'urgence décroissante :
 *   1. des saisies ont été refusées et attendent une décision ;
 *   2. des saisies sont en attente d'envoi ;
 *   3. l'application fonctionne hors ligne.
 *
 * Rien ne s'affiche quand tout va bien : un bandeau permanent finit par ne
 * plus être lu, et c'est précisément le jour où il compte.
 */
@Component({
  selector: 'app-bandeau-sync',
  imports: [DateFrPipe],
  standalone: true,
  template: `
    @if (nombreRefus() > 0) {
      <div class="bandeau refus" role="alert">
        <div class="texte">
          <strong>{{ nombreRefus() }} saisie(s) refusée(s) par le serveur.</strong>
          <ul>
            @for (r of file.refus(); track r.referenceClient) {
              <li>
                <span>{{ r.raison }}</span>
                <span class="secondaire">Saisie du {{ r.dateEvaluation | dateFr }}</span>
                <button type="button" class="lien" (click)="ecarter(r)">Écarter</button>
              </li>
            }
            @for (r of ecritures.refus(); track r.cle) {
              <li>
                <span>{{ r.raison }}</span>
                <span class="secondaire">{{ r.libelle }}, séance du {{ r.dateSeance | dateFr }}</span>
                <button type="button" class="lien" (click)="ecarterEcriture(r)">Écarter</button>
              </li>
            }
          </ul>
        </div>
      </div>
    }

    @if (nombreEnAttente() > 0) {
      <div class="bandeau attente" role="status">
        <span>
          {{ nombreEnAttente() }} saisie(s) en attente d'envoi.
          @if (enSynchronisation()) { Envoi en cours… }
          @else if (!reseau.enLigne()) { Elles partiront au retour du réseau. }
        </span>
        @if (reseau.enLigne() && !enSynchronisation()) {
          <button type="button" class="lien" (click)="synchroniser()">Envoyer maintenant</button>
        }
      </div>
    } @else if (!reseau.enLigne()) {
      <div class="bandeau hors-ligne" role="status">
        <span>Hors ligne. Vos saisies sont conservées sur l'appareil.</span>
      </div>
    }

    @if (message(); as m) {
      <div class="bandeau attente" role="status"><span>{{ m }}</span></div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .bandeau {
      display: flex; align-items: baseline; justify-content: space-between;
      gap: var(--pas-2); flex-wrap: wrap;
      padding: 10px var(--pas-3); font-size: .9375rem;
    }
    .hors-ligne { background: #E7EEF0; color: var(--encre); }
    .attente    { background: var(--en-cours-clair); color: var(--en-cours); }
    .refus      { background: #FBE9E7; color: #9A3412; }
    .refus ul { list-style: none; margin: var(--pas) 0 0; padding: 0; display: grid; gap: 6px; }
    .refus li { display: flex; gap: var(--pas-2); align-items: baseline; flex-wrap: wrap; }
    .lien {
      border: none; background: none; padding: 0;
      text-decoration: underline; color: inherit; font-weight: 700;
      min-height: 44px;
    }
  `]
})
export class BandeauSyncComponent {
  file = inject(FileAttenteService);
  ecritures = inject(FileEcrituresService);
  reseau = inject(ReseauService);
  private api = inject(ApiService);

  message = signal<string | null>(null);

  /** Notations, présences et fiches de sécurité confondues : pour le moniteur, ce sont toutes des saisies. */
  readonly nombreEnAttente = computed(() => this.file.enAttente().length + this.ecritures.enAttente().length);
  readonly nombreRefus = computed(() => this.file.refus().length + this.ecritures.refus().length);
  readonly enSynchronisation = computed(() => this.file.synchronisation() || this.ecritures.synchronisation());

  synchroniser(): void {
    void this.file.vider();
    void this.ecritures.vider();
  }

  ecarterEcriture(refus: EcritureRefusee): void {
    void this.ecritures.ecarterRefus(refus.cle);
  }

  ecarter(refus: SaisieRefusee): void {
    void this.file.ecarterRefus(refus.referenceClient);
  }

  async precharger(): Promise<void> {
    this.message.set('Préparation du mode hors ligne…');
    try {
      const { grilles, feuilles, fiches } = await this.api.precharger();
      this.message.set(`Disponibles hors ligne : ${grilles} grille(s), ${feuilles} feuille(s) de présence, `
        + `${fiches} fiche(s) de sécurité.`);
    } catch {
      this.message.set('Le préchargement a échoué. Réessayez avec du réseau.');
    }
    setTimeout(() => this.message.set(null), 5000);
  }
}
