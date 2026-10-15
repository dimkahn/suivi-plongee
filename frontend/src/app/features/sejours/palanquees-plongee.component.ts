import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FonctionPalanquee } from '../../core/modeles';
import { PalanqueeVue } from './sejour-api';

const FONCTIONS: Record<FonctionPalanquee, string> = {
  ENCADRANT: 'Encadrant',
  GUIDE_PALANQUEE: 'Guide de palanquée',
  PLONGEUR: 'Plongeur'
};

/**
 * Les palanquées d'une plongée du séjour, lues sur la fiche de sécurité
 * (demande du club, 2026), sous la plongée dans le programme. Un participant
 * ne reçoit que la sienne ; un encadrant les reçoit toutes : la sienne
 * d'abord, puis toutes les palanquées dans un volet à déplier.
 */
@Component({
  selector: 'app-palanquees-plongee',
  imports: [NgTemplateOutlet],
  template: `
    @if (mienne(); as p) {
      <div class="palanquee mienne">
        <ng-container [ngTemplateOutlet]="detail" [ngTemplateOutletContext]="{ $implicit: p, titre: 'Votre palanquée' }" />
      </div>
    }
    @if (toutes(); as liste) {
      <details class="toutes">
        <summary>Toutes les palanquées ({{ liste.length }})</summary>
        @for (p of liste; track p.numero) {
          <div class="palanquee" [class.mienne]="aMoi(p)">
            <ng-container [ngTemplateOutlet]="detail" [ngTemplateOutletContext]="{ $implicit: p, titre: 'Palanquée' }" />
          </div>
        }
      </details>
    }
    <ng-template #detail let-p let-titre="titre">
      <p class="entete"><strong>{{ titre }} n° {{ p.numero }}</strong>@if (parametres(p); as t) { <span class="secondaire"> — {{ t }}</span>}</p>
      <ul>
        @for (m of p.membres; track $index) {
          <li [class.moi]="m.moi">
            <span class="nom">{{ m.prenom }} {{ m.nom }}@if (m.moi) { (vous)}</span>
            <span class="fonction" [class.encadre]="m.fonction !== 'PLONGEUR'">{{ fonction(m.fonction) }}</span>@if (m.aptitude) { <span class="secondaire"> · {{ m.aptitude }}</span>}@if (m.qualificationPreparee) { <span class="secondaire"> · prépare {{ m.qualificationPreparee }}</span>}
          </li>
        }
      </ul>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host { display: block; }
    .palanquee { margin-top: var(--pas); padding: var(--pas) var(--pas-2); border-radius: var(--r-s); background: var(--fond); border: 1px solid var(--trait); }
    .palanquee.mienne { border-left: 4px solid var(--accent); }
    .entete { margin: 0 0 4px; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
    li.moi .nom { font-weight: 700; }
    .nom { margin-right: var(--pas); }
    .fonction { font-size: .875rem; }
    .fonction.encadre { font-weight: 700; color: var(--profond-fonce); }
    .toutes { margin-top: var(--pas); }
    .toutes summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; font-weight: 700; color: var(--profond-fonce); }
  `]
})
export class PalanqueesPlongeeComponent {
  /** Les palanquées de cette plongée reçues du serveur (la sienne seulement pour un participant). */
  palanquees = input.required<PalanqueeVue[]>();
  /** Encadrant : la composition de toutes les palanquées, en plus de la sienne. */
  encadrant = input(false);

  readonly mienne = computed(() => this.palanquees().find(p => this.aMoi(p)) ?? null);
  readonly toutes = computed(() => {
    const liste = this.palanquees();
    return this.encadrant() && liste.length > 0 ? liste : null;
  });

  aMoi(p: PalanqueeVue): boolean {
    return p.membres.some(m => m.moi);
  }

  fonction(f: FonctionPalanquee): string {
    return FONCTIONS[f];
  }

  /** « 20 m, 40 min prévus · DP : Paul Durand ». */
  parametres(p: PalanqueeVue): string {
    const profil = [p.profondeur != null ? `${p.profondeur} m` : '', p.duree != null ? `${p.duree} min` : '']
      .filter(Boolean).join(', ');
    const morceaux = [
      profil ? profil + (p.realise ? ' réalisés' : ' prévus') : '',
      p.heureImmersion ? 'immersion ' + p.heureImmersion.slice(0, 5).replace(':', 'h') : '',
      p.directeurPlongee ? 'DP : ' + p.directeurPlongee : ''
    ];
    return morceaux.filter(Boolean).join(' · ');
  }
}
