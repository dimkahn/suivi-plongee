import { Component, ChangeDetectionStrategy, computed, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { reduirePhoto } from '../../core/reduire-photo';
import { conseilDepart } from './programme-du-jour';
import { PortCartesEmbarquement, SensVoyage, TRANSPORTS, Trajet, jourLong } from './sejour-api';
import { carteVoyage, compagnieDuVol, enregistrement, envoiCarte } from './voyage';

/**
 * Ouvre la carte d'embarquement dans un nouvel onglet, pour la montrer à
 * l'embarquement. L'onglet s'ouvre tout de suite (au toucher) : ouvert
 * après la réponse du serveur, le navigateur le bloquerait.
 */
export function montrerCarte(lecture: Observable<Blob>, echec: () => void): void {
  const onglet = window.open('', '_blank');
  lecture.subscribe({
    next: blob => {
      const adresse = URL.createObjectURL(blob);
      if (onglet) onglet.location.href = adresse; else window.location.href = adresse;
      setTimeout(() => URL.revokeObjectURL(adresse), 60_000);
    },
    error: () => {
      onglet?.close();
      echec();
    }
  });
}

/**
 * Un voyage du participant connecté, en carte (demande du club, 2026 :
 * lisible comme la page d'enregistrement d'une compagnie) : heures de
 * départ et d'arrivée face à face, « +1 jour », lieux, terminal, vol et
 * compagnie, ouverture de l'enregistrement en ligne, et sa réservation
 * (numéro de dossier à copier, lien vers l'enregistrement, sinon le site
 * de la compagnie reconnue au numéro de vol). Avec {@code cartes}, sa
 * carte d'embarquement (PDF ou photo) : l'ajouter, la montrer à
 * l'embarquement, la remplacer, la retirer (V98). Ce qui est placé dans la
 * balise s'affiche sous le vol : les passagers, dans l'onglet
 * « Transports » des organisateurs.
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
      <ng-content />
      <div class="espace"></div>
      @if (t.dossier || lien()) {
        <div class="reservation">
          @if (t.dossier) {
            <p class="ligne-dossier">N° de dossier <strong class="dossier">{{ t.dossier }}</strong></p>
          }
          <div class="boutons">
            @if (t.dossier) {
              <button type="button" class="bouton-discret" (click)="copier(t.dossier)" aria-live="polite">
                {{ copie() ? '✓ Copié' : 'Copier le dossier' }}
              </button>
            }
            @if (lien(); as l) {
              <a class="bouton-principal" [href]="l.adresse" target="_blank" rel="noopener noreferrer">{{ l.libelle }} ↗</a>
            }
          </div>
        </div>
      }
      @if (cartes() && participantId() !== null) {
        <div class="embarquement">
          @if (t.carteEmbarquement) {
            <p class="ligne-carte">✓ {{ billet() ? 'Billet joint' : "Carte d'embarquement jointe" }}
              ({{ t.carteEmbarquement === 'application/pdf' ? 'PDF' : 'photo' }})</p>
            <div class="boutons">
              <button type="button" class="bouton-principal" (click)="montrer()" [disabled]="envoi()">
                Montrer {{ billet() ? 'le billet' : 'la carte' }}
              </button>
              <label class="bouton-discret" [class.inactif]="envoi()">
                Remplacer
                <input type="file" class="masque" [accept]="formats" [disabled]="envoi()" (change)="choisir($event)">
              </label>
              <button type="button" class="bouton-discret" (click)="retirer()" [disabled]="envoi()">Retirer</button>
            </div>
          } @else {
            <label class="bouton-discret ajout" [class.inactif]="envoi()">
              @if (envoi()) { Envoi… } @else { + Ajouter {{ billet() ? 'le billet' : "la carte d'embarquement" }} (PDF ou photo) }
              <input type="file" class="masque" [accept]="formats" [disabled]="envoi()" (change)="choisir($event)">
            </label>
          }
          @if (erreurCarte(); as e) { <p class="erreur" role="alert">{{ e }}</p> }
        </div>
      }
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    /* Les cartes aller et retour, côte à côte, prennent la hauteur de la plus haute ; le dossier et les boutons au bas. */
    :host { display: block; height: 100%; }
    .voyage { box-sizing: border-box; height: 100%; display: flex; flex-direction: column;
              padding: var(--pas) var(--pas-2); border: 1px solid var(--trait); border-radius: var(--r-s);
              background: #F8FAFC; }
    .espace { flex: 1; }
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
    .reservation { margin-top: var(--pas); padding-top: var(--pas); border-top: 1px dashed var(--trait); }
    .ligne-dossier { margin: 0 0 var(--pas); }
    .dossier { font-family: ui-monospace, monospace; font-size: 1.125rem; letter-spacing: .08em; }
    /* Les deux gestes côte à côte, même largeur, sous le dossier ; l'un sous l'autre sur un petit écran. */
    .boutons { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: var(--pas); }
    .boutons button, .boutons a, .boutons label { min-height: 44px; margin: 0; width: 100%; box-sizing: border-box;
                                  display: inline-flex; align-items: center; justify-content: center;
                                  text-align: center; text-decoration: none; }
    @media (max-width: 340px) { .boutons { grid-auto-flow: row; } }
    .embarquement { margin-top: var(--pas); padding-top: var(--pas); border-top: 1px dashed var(--trait); }
    .ligne-carte { margin: 0 0 var(--pas); font-weight: 700; color: #166534; }
    .embarquement label { cursor: pointer; }
    .ajout { width: 100%; }
    .inactif { opacity: .6; pointer-events: none; }
    .masque { position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden; }
    .erreur { margin: var(--pas) 0 0; color: #B91C1C; font-weight: 700; }
    .embarquement .ajout { min-height: 44px; margin: 0; box-sizing: border-box; display: inline-flex;
                           align-items: center; justify-content: center; text-align: center; }
    @media print { .reservation, .embarquement { display: none; } }
  `]
})
export class CarteVoyageComponent {
  trajet = input.required<Trajet>();
  /** Vrai : le voyage aller (arrivée au séjour). */
  aller = input.required<boolean>();
  etiquette = input.required<string>();
  /** Avec le voyageur : sa carte d'embarquement, à ajouter, montrer, remplacer ou retirer. */
  cartes = input<PortCartesEmbarquement | null>(null);
  participantId = input<number | null>(null);

  readonly jourLong = jourLong;
  readonly formats = 'application/pdf,image/*';
  envoi = signal(false);
  erreurCarte = signal<string | null>(null);
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

  /** Un train ou un car a un billet ; un avion ou un bateau, une carte d'embarquement. */
  readonly billet = computed(() => ['TRAIN', 'CAR'].includes(this.trajet().transport ?? ''));

  private sens(): SensVoyage {
    return this.aller() ? 'ARRIVEE' : 'DEPART';
  }

  async choisir(e: Event): Promise<void> {
    const champ = e.target as HTMLInputElement;
    const fichier = champ.files?.[0];
    champ.value = '';
    const port = this.cartes(), id = this.participantId();
    if (!fichier || !port || id === null) return;
    this.erreurCarte.set(null);
    const envoi = envoiCarte(fichier.type, fichier.size);
    if (envoi === 'refus') {
      this.erreurCarte.set(fichier.type === 'application/pdf' ? 'Ce PDF dépasse 5 Mo.' : 'Choisissez un PDF ou une photo.');
      return;
    }
    this.envoi.set(true);
    let aEnvoyer = fichier;
    if (envoi === 'reduire') {
      try {
        aEnvoyer = await reduirePhoto(fichier);
      } catch {
        this.envoi.set(false);
        this.erreurCarte.set("Cette photo n'a pas pu être lue : choisissez un PDF, ou une photo JPEG ou PNG.");
        return;
      }
    }
    try {
      await firstValueFrom(port.deposer(id, this.sens(), aEnvoyer));
    } catch (err) {
      this.erreurCarte.set((err as HttpErrorResponse).error?.detail ?? "La carte n'a pas pu être envoyée (réseau nécessaire).");
    } finally {
      this.envoi.set(false);
    }
  }

  retirer(): void {
    const port = this.cartes(), id = this.participantId();
    if (!port || id === null) return;
    this.envoi.set(true);
    this.erreurCarte.set(null);
    port.retirer(id, this.sens()).subscribe({
      next: () => this.envoi.set(false),
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.erreurCarte.set(err.error?.detail ?? "La carte n'a pas pu être retirée (réseau nécessaire).");
      }
    });
  }

  montrer(): void {
    const port = this.cartes(), id = this.participantId();
    if (!port || id === null) return;
    this.erreurCarte.set(null);
    montrerCarte(port.lire(id, this.sens()), () =>
      this.erreurCarte.set("La carte n'a pas pu être ouverte (réseau nécessaire)."));
  }

  copier(texte: string): void {
    navigator.clipboard?.writeText(texte).then(() => {
      this.copie.set(true);
      setTimeout(() => this.copie.set(false), 2000);
    }, () => undefined);
  }
}
