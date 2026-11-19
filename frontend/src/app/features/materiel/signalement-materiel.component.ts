import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ResumeEquipementVue } from '../../core/modeles';
import { ChargementComponent } from '../../core/chargement.component';
import { ProblemesMaterielComponent } from './problemes-materiel.component';

/**
 * Ce qu'ouvre un moniteur qui scanne l'étiquette (QR code, tag NFC) d'un
 * matériel du club, au bord du bassin : ce qu'est le matériel, ses problèmes
 * en cours et « Signaler un problème » (demande du club, 2026-11-19). Sans
 * la fiche de gestion (journal, prêts), réservée au directeur technique, à
 * l'admin et au TIV, qui ouvrent la fiche complète à la même adresse.
 */
@Component({
  selector: 'app-signalement-materiel',
  imports: [ChargementComponent, ProblemesMaterielComponent],
  template: `
    @if (chargement()) {
      <app-chargement />
    } @else if (resume(); as r) {
      <h1>{{ r.designation }}</h1>
      <p class="secondaire">Matériel du club. Un problème pendant la séance ? Signalez-le ici.</p>
      @if (r.rebute) {
        <div class="carte vide"><p>Ce matériel est au rebut : il n'est plus utilisé.</p></div>
      } @else {
        <app-problemes-materiel [equipementId]="r.id" [signalements]="r.signalements" (change)="charger(r.id)" />
      }
    } @else if (message(); as m) {
      <div class="alerte" role="alert">{{ m }}</div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`h1 { margin-bottom: var(--pas); }`]
})
export class SignalementMaterielComponent {
  private api = inject(ApiService);

  resume = signal<ResumeEquipementVue | null>(null);
  chargement = signal(true);
  message = signal<string | null>(null);

  constructor() {
    inject(ActivatedRoute).paramMap.pipe(takeUntilDestroyed()).subscribe(p => void this.charger(Number(p.get('id'))));
  }

  async charger(id: number): Promise<void> {
    try {
      this.resume.set(await firstValueFrom(this.api.resumeEquipement(id)));
      this.message.set(null);
    } catch {
      this.resume.set(null);
      this.message.set("Ce matériel est introuvable, ou vous n'avez pas accès au matériel du club.");
    } finally {
      this.chargement.set(false);
    }
  }
}
