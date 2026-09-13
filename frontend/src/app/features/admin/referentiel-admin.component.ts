import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ReferentielVue } from '../../core/modeles';

@Component({
  selector: 'app-referentiel-admin',
  template: `
    <h1>Référentiel MFT</h1>
    <p class="secondaire">
      Version en vigueur du référentiel fédéral pour chaque niveau. Consultation seule : une
      révision du MFT se publie en éditant <code>outils/generer_referentiel.py</code>, puis en
      ajoutant une migration Flyway — jamais depuis cet écran.
    </p>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (liste().length === 0) {
      <div class="carte vide"><p>Aucun référentiel actif enregistré.</p></div>
    } @else {
      <nav class="onglets">
        @for (r of liste(); track r.id) {
          <button type="button" class="onglet" [class.actif]="selectionId() === r.id"
                  (click)="selectionner(r.id)">
            {{ r.niveau }}
          </button>
        }
      </nav>

      @if (detail(); as r) {
        <section class="carte fiche">
          <div class="entete">
            <span class="nom">{{ r.niveau }} · MFT {{ r.versionMft }}</span>
            <span class="secondaire">Source : {{ r.source }}</span>
          </div>

          <dl>
            <dt>Âge minimum</dt><dd>{{ r.ageMinimum }} ans</dd>
            <dt>Brevet prérequis</dt><dd>{{ r.niveauPrerequis ?? 'aucun' }}</dd>
            <dt>Qualification requise</dt><dd>{{ r.qualificationRequise ?? 'aucune' }}</dd>
            <dt>Milieu naturel exclusif</dt><dd>{{ r.milieuNaturelExclusif ? 'oui' : 'non' }}</dd>
            <dt>Prérogative de profondeur</dt><dd>{{ r.prerogativeProfondeur }} m</dd>
            <dt>Encadrant requis pour valider</dt><dd>{{ r.niveauEncadrantValidation }}</dd>
            <dt>Encadrant requis pour délivrer</dt><dd>{{ r.niveauEncadrantDelivrance }}</dd>
          </dl>

          <h2>Blocs de compétences</h2>
          <ul class="blocs">
            @for (b of r.blocs; track b.id) {
              <li class="carte bloc">
                <div class="entete-bloc">
                  <span class="nom">{{ b.code }} · {{ b.intitule }}</span>
                  <span class="secondaire">
                    {{ b.evaluationTransverse ? 'Évaluation transverse' : 'Évaluation par bloc' }}
                    @if (b.validerEnDernier) { · à valider en dernier }
                  </span>
                </div>
                <ol>
                  @for (c of b.criteres; track c.id) {
                    <li>
                      <span class="savoir-faire">{{ c.savoirFaire }}</span>
                      @if (c.critereRealisation) {
                        <span class="secondaire"> — {{ c.critereRealisation }}</span>
                      }
                    </li>
                  }
                </ol>
              </li>
            }
          </ul>
        </section>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    code { background: var(--fond); padding: 1px 6px; border-radius: var(--r-s); }

    .onglets { display: flex; gap: var(--pas); margin: var(--pas-3) 0 var(--pas-2); }
    .onglet {
      min-height: 44px; padding: 0 var(--pas-3); border-radius: var(--r-s);
      border: 1px solid var(--trait); background: #fff; font-weight: 700; cursor: pointer;
    }
    .onglet.actif { background: var(--profond); color: #fff; border-color: var(--profond); }

    .fiche { padding: var(--pas-3); }
    .entete { display: flex; flex-direction: column; gap: 2px; margin-bottom: var(--pas-2); }
    .entete .nom { font-weight: 700; font-size: 1.0625rem; }

    dl {
      display: grid; grid-template-columns: max-content 1fr; gap: 4px var(--pas-2);
      margin: 0 0 var(--pas-3);
    }
    dt { color: var(--craie); }
    dd { margin: 0; font-weight: 700; }

    h2 { margin: 0 0 var(--pas-2); font-size: 1.0625rem; }
    .blocs { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2); }
    .bloc { padding: var(--pas-2); }
    .entete-bloc { display: flex; flex-direction: column; gap: 2px; margin-bottom: var(--pas); }
    .entete-bloc .nom { font-weight: 700; }
    .bloc ol { margin: 0; padding-left: 1.25rem; display: grid; gap: 4px; }
    .savoir-faire { font-weight: 600; }

    @media (max-width: 600px) {
      dl { grid-template-columns: 1fr; }
      dd { margin-bottom: 4px; }
    }
  `]
})
export class ReferentielAdminComponent {
  private api = inject(ApiService);

  liste = signal<ReferentielVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);

  selectionId = signal<number | null>(null);
  private detailsCharges = signal<Map<number, ReferentielVue>>(new Map());
  detail = computed(() => {
    const id = this.selectionId();
    return id == null ? null : this.detailsCharges().get(id) ?? null;
  });

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    this.chargement.set(true);
    try {
      const liste = await firstValueFrom(this.api.referentiels());
      // Un référentiel par niveau : N1, N2, N3 dans l'ordre.
      this.liste.set([...liste].sort((a, b) => a.niveau.localeCompare(b.niveau)));
      if (liste.length > 0) await this.selectionner(this.liste()[0].id);
    } catch {
      this.message.set('Impossible de charger le référentiel.');
    } finally {
      this.chargement.set(false);
    }
  }

  async selectionner(id: number): Promise<void> {
    this.selectionId.set(id);
    if (this.detailsCharges().has(id)) return;
    try {
      const detail = await firstValueFrom(this.api.referentiel(id));
      const maj = new Map(this.detailsCharges());
      maj.set(id, detail);
      this.detailsCharges.set(maj);
    } catch {
      this.message.set('Impossible de charger le détail de ce référentiel.');
    }
  }
}
