import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { EtiquetteMateriel } from '../../core/modeles';
import { QrCodeComponent } from './qr-code.component';

type Format = 'petit' | 'grand';

/**
 * Planche d'étiquettes à QR code, à imprimer et coller sur le matériel
 * (/materiel/etiquettes?ids=1,2,3). Le QR code ouvre la fiche de
 * l'équipement, avec l'appareil photo du téléphone ou le bouton « Scanner ».
 */
@Component({
  selector: 'app-etiquettes-materiel',
  imports: [RouterLink, QrCodeComponent],
  template: `
    <div class="pas-imprime">
      <a routerLink="/materiel" class="retour">← Matériel</a>
      <h1>Étiquettes QR code</h1>
      <p class="secondaire">
        Imprimez la planche, découpez et collez chaque étiquette sur son équipement. Le QR code ouvre la fiche :
        avec l'appareil photo du téléphone, ou avec le bouton « Scanner » de la page Matériel.
        Pour le matériel qui va à l'eau, imprimez sur papier étanche ou protégez l'étiquette (plastification,
        adhésif transparent).
      </p>

      @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

      <div class="actions">
        <div class="formats" role="group" aria-label="Taille des étiquettes">
          <button type="button" class="bouton-discret" [class.actif]="format() === 'petit'" (click)="format.set('petit')">
            Petites (3 cm)
          </button>
          <button type="button" class="bouton-discret" [class.actif]="format() === 'grand'" (click)="format.set('grand')">
            Grandes (5 cm)
          </button>
        </div>
        <button type="button" class="bouton-principal" [disabled]="etiquettes().length === 0" (click)="imprimer()">
          Imprimer {{ etiquettes().length }} étiquette(s)
        </button>
      </div>
    </div>

    @if (chargement()) {
      <p class="vide">Fabrication des QR codes…</p>
    } @else {
      <div [class]="'planche ' + format()">
        @for (e of etiquettes(); track e.equipementId) {
          <div class="etiquette">
            <app-qr-code [modules]="e.modules" [libelle]="'Fiche ' + e.typeLibelle + ' ' + e.reference" />
            <div class="texte">
              <strong>{{ e.reference }}</strong>
              <span>{{ e.typeLibelle }}</span>
              @if (e.ancienneReference) { <span class="ancien">ancien n° {{ e.ancienneReference }}</span> }
            </div>
          </div>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .retour { display: inline-flex; align-items: center; min-height: 44px; margin-bottom: var(--pas); }
    h1 { margin-bottom: var(--pas); }
    .actions { display: flex; gap: var(--pas-2); flex-wrap: wrap; align-items: center; margin: var(--pas-2) 0; }
    .formats { display: flex; gap: var(--pas); flex-wrap: wrap; }
    .formats .actif { background: var(--profond); color: #fff; border-color: var(--profond); font-weight: 700; }

    .planche { display: flex; flex-wrap: wrap; gap: 4mm; background: #fff; }
    .etiquette {
      display: flex; align-items: center; gap: 2mm; padding: 2mm;
      border: 1px dashed #9CA3AF; break-inside: avoid; color: #000; background: #fff;
    }
    .texte { display: flex; flex-direction: column; min-width: 0; line-height: 1.15; }
    .texte strong { font-family: var(--font-titres); }
    .petit .etiquette { width: 58mm; }
    .petit app-qr-code { width: 30mm; flex: none; }
    .petit .texte { font-size: 9pt; }
    .petit .texte strong { font-size: 13pt; }
    .grand .etiquette { width: 88mm; }
    .grand app-qr-code { width: 50mm; flex: none; }
    .grand .texte { font-size: 11pt; }
    .grand .texte strong { font-size: 18pt; }
    .ancien { color: #4B5563; }

    @media print {
      .pas-imprime { display: none !important; }
      .planche { gap: 2mm; }
    }
  `]
})
export class EtiquettesMaterielComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  etiquettes = signal<EtiquetteMateriel[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  format = signal<Format>('petit');

  constructor() {
    const ids = (this.route.snapshot.queryParamMap.get('ids') ?? '')
      .split(',').map(Number).filter(id => Number.isInteger(id) && id > 0);
    void this.charger(ids);
  }

  imprimer(): void {
    window.print();
  }

  private async charger(ids: number[]): Promise<void> {
    if (ids.length === 0) {
      this.message.set("Aucun équipement choisi : ouvrez cette page depuis l'inventaire ou une fiche.");
      this.chargement.set(false);
      return;
    }
    try {
      this.etiquettes.set(await firstValueFrom(this.api.etiquettesMateriel(ids)));
    } catch (err) {
      this.message.set((err as HttpErrorResponse).error?.detail ?? 'Les étiquettes n\'ont pas pu être fabriquées.');
    } finally {
      this.chargement.set(false);
    }
  }
}
