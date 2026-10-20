import { Component, ChangeDetectionStrategy, computed, input, signal } from '@angular/core';
import { conseilDepart } from './programme-du-jour';
import { TRANSPORTS, Trajet, jourLong } from './sejour-api';
import { carteVoyage, compagnieDuVol, enregistrement } from './voyage';

/**
 * Un voyage du participant connecté, en carte (demande du club, 2026 :
 * lisible comme la page d'enregistrement d'une compagnie) : heures de
 * départ et d'arrivée face à face, « +1 jour », lieux, terminal, vol et
 * compagnie, ouverture de l'enregistrement en ligne, et sa réservation
 * (numéro de dossier à copier, lien vers l'enregistrement, sinon le site
 * de la compagnie reconnue au numéro de vol).
 */
@Component({
  selector: 'app-carte-voyage',
  template: `
    @let t = trajet();
    @let c = carte();
    <article class="voyage" [attr.aria-label]="etiquette()">
      <header class="tete">
        <span class="etiquette">{{ etiquette() }}</span>
        @if (c.depart.jour) { <span class="jour">{{ jourLong(c.depart.jour).slice(0, -5) }}</span> }
        @if (etat(); as e) { <span class="pastille" [class.ouvert]="e.etat === 'ouvert'">{{ e.texte }}</span> }
      </header>
      <div class="ligne">
        <div class="extremite">
          <strong class="heure">{{ c.depart.heure ?? '–' }}</strong>
          <span class="lieu">{{ c.depart.lieu ?? '' }}</span>
          @if (c.depart.terminal) { <span class="terminal">Terminal {{ c.depart.terminal }}</span> }
        </div>
        <div class="trait" aria-hidden="true"><span>{{ t.transport === 'AVION' ? '✈' : '→' }}</span></div>
        <div class="extremite droite">
          @if (c.joursEnPlus > 0) { <span class="plus-jour">+{{ c.joursEnPlus }} jour{{ c.joursEnPlus > 1 ? 's' : '' }}</span> }
          <strong class="heure">{{ c.arrivee.heure ?? '–' }}</strong>
          <span class="lieu">{{ c.arrivee.lieu ?? '' }}</span>
        </div>
      </div>
      @if (moyen()) { <p class="moyen">{{ moyen() }}</p> }
      @if (conseil(); as cs) { <p class="conseil">{{ cs }}</p> }
      @if (t.dossier || lien()) {
        <div class="reservation">
          @if (t.dossier) {
            <span>Dossier <strong class="dossier">{{ t.dossier }}</strong></span>
            <button type="button" class="bouton-discret" (click)="copier(t.dossier)">{{ copie() ? 'Copié' : 'Copier' }}</button>
          }
          @if (lien(); as l) {
            <a class="bouton-principal" [href]="l.adresse" target="_blank" rel="noopener noreferrer">{{ l.libelle }} ↗</a>
          }
        </div>
      }
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .voyage { padding: var(--pas) var(--pas-2); border: 1px solid var(--trait); border-radius: var(--r-s);
              background: #F8FAFC; }
    .tete { display: flex; align-items: center; gap: var(--pas); flex-wrap: wrap; }
    .etiquette { font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--craie); }
    .jour { font-weight: 700; color: var(--profond-fonce); }
    .pastille { margin-left: auto; padding: 2px 10px; border-radius: var(--r-s); font-size: .8125rem; font-weight: 700;
                background: var(--en-cours-clair); color: var(--en-cours); }
    .pastille.ouvert { background: #DCFCE7; color: #166534; }
    .ligne { display: flex; align-items: flex-end; gap: var(--pas); margin-top: var(--pas); }
    .extremite { display: flex; flex-direction: column; min-width: 0; }
    .extremite.droite { align-items: flex-end; text-align: right; }
    .heure { font-size: 1.5rem; line-height: 1.1; color: var(--profond-fonce); }
    .lieu { font-size: .9375rem; }
    .terminal { font-size: .875rem; font-weight: 700; color: var(--profond); }
    .plus-jour { font-size: .75rem; font-weight: 700; color: var(--en-cours); }
    .trait { flex: 1; align-self: center; position: relative; min-width: 40px; height: 2px; background: var(--profond); }
    .trait span { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -55%);
                  padding: 0 6px; background: #F8FAFC; color: var(--profond); font-size: 1.125rem; }
    .moyen { margin: var(--pas) 0 0; font-weight: 700; }
    .conseil { margin: 2px 0 0; font-size: .875rem; color: var(--craie); }
    .reservation { display: flex; align-items: center; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas);
                   padding-top: var(--pas); border-top: 1px dashed var(--trait); }
    .dossier { font-family: ui-monospace, monospace; letter-spacing: .08em; }
    .reservation button, .reservation a { min-height: 44px; }
    .reservation a { margin-left: auto; display: inline-flex; align-items: center; text-decoration: none; }
    @media (max-width: 380px) { .reservation a { margin-left: 0; width: 100%; justify-content: center; } }
    @media print { .reservation { display: none; } }
  `]
})
export class CarteVoyageComponent {
  trajet = input.required<Trajet>();
  /** Vrai : le voyage aller (arrivée au séjour). */
  aller = input.required<boolean>();
  etiquette = input.required<string>();

  readonly jourLong = jourLong;
  /** L'heure de l'appareil, prise à l'affichage : l'état de l'enregistrement n'a pas besoin d'être plus précis. */
  private readonly maintenant = new Date();
  copie = signal(false);

  readonly carte = computed(() => carteVoyage(this.trajet(), this.aller()));
  readonly etat = computed(() => enregistrement(this.trajet(), this.aller(), this.maintenant));
  readonly compagnie = computed(() => this.trajet().transport === 'AVION' ? compagnieDuVol(this.trajet().numero) : null);

  /** « Avion TX 510 · Air Caraïbes ». */
  readonly moyen = computed(() => {
    const t = this.trajet();
    return [[TRANSPORTS.find(x => x.code === t.transport)?.libelle, t.numero].filter(Boolean).join(' '),
      this.compagnie()?.nom].filter(Boolean).join(' · ');
  });

  readonly conseil = computed(() => {
    const t = this.trajet();
    return conseilDepart(t.transport, (this.aller() ? t.heureDepart : t.heure)?.slice(0, 5) ?? null);
  });

  /** Le lien collé dans le voyage, sinon le site de la compagnie (s'il y a un dossier à y saisir). */
  readonly lien = computed(() => {
    const t = this.trajet();
    if (t.lienEnregistrement) return { adresse: t.lienEnregistrement, libelle: "S'enregistrer" };
    const c = this.compagnie();
    return c && t.dossier ? { adresse: c.site, libelle: 'Site ' + c.nom } : null;
  });

  copier(texte: string): void {
    navigator.clipboard?.writeText(texte).then(() => {
      this.copie.set(true);
      setTimeout(() => this.copie.set(false), 2000);
    }, () => undefined);
  }
}
