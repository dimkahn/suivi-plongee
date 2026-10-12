import { Component, ChangeDetectionStrategy, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DialogueComponent } from '../../core/dialogue.component';
import { dateFr } from '../../core/date-fr';
import {
  CATEGORIES_DEPENSE, CategorieDepense, DepenseVue, SejourApi, SejourVue, enCentimes, euros, nomComplet
} from './sejour-api';

/** Brouillon d'une dépense : le montant tel que tapé, les parts par participant (0 = ne partage pas). */
interface BrouillonDepense {
  libelle: string;
  categorie: CategorieDepense;
  montant: string;
  payeurId: number | null;
  jour: string | null;
  parts: Record<number, number>;
}

/**
 * L'onglet « Frais » d'un séjour : les dépenses avancées par les uns pour
 * les autres, les remboursements faits, le solde de chacun et les
 * remboursements qui restent à faire (calculés par le serveur, au centime
 * près). L'organisateur saisit ; encadrants et participants consultent.
 */
@Component({
  selector: 'app-sejour-frais',
  imports: [FormsModule, DialogueComponent],
  template: `
    @let s = sejour();
    @let f = s.frais;
    <div class="titre-section">
      <h2>Frais partagés</h2>
      @if (s.gere) {
        <div class="actions sans-impression">
          <button type="button" class="bouton-principal" (click)="ouvrirDepense(null)"
                  [disabled]="s.participants.length === 0">Ajouter une dépense</button>
          <button type="button" class="bouton-discret" (click)="ouvrirVersement(null)"
                  [disabled]="s.participants.length < 2">Noter un remboursement</button>
        </div>
      }
    </div>
    @if (message(); as m) { <div class="alerte sans-impression" role="status">{{ m }}</div> }

    @if (f.depenses.length === 0) {
      <p class="vide">Aucune dépense pour l'instant. Gîte, location de voiture, courses, plongées : chacun note
        ce qu'il a avancé, l'appli calcule qui doit combien à qui.</p>
    } @else {
      <p class="total">Total des dépenses : <strong>{{ euros(f.comptes.totalCentimes) }}</strong></p>

      <h3>Qui doit combien à qui</h3>
      @if (f.comptes.remboursements.length === 0) {
        <p class="carte solde-ok">Les comptes sont soldés.</p>
      } @else {
        <ul class="cartes">
          @for (r of f.comptes.remboursements; track r.deId + '-' + r.aId) {
            <li class="carte remboursement">
              <span><strong>{{ nomDe(r.deId) }}</strong> doit <strong>{{ euros(r.montantCentimes) }}</strong>
                à <strong>{{ nomDe(r.aId) }}</strong></span>
              @if (s.gere) {
                <button type="button" class="bouton-discret sans-impression"
                        (click)="ouvrirVersement(r)">C'est remboursé</button>
              }
            </li>
          }
        </ul>
      }

      <h3>Le compte de chacun</h3>
      <div class="defilement">
        <table class="soldes">
          <thead><tr><th scope="col">Participant</th><th scope="col">A payé</th><th scope="col">Sa part</th>
            <th scope="col">Solde</th></tr></thead>
          <tbody>
            @for (c of f.comptes.soldes; track c.participantId) {
              <tr [class.moi]="estMoi(c.participantId)">
                <th scope="row">{{ nomDe(c.participantId) }}</th>
                <td>{{ euros(c.payeCentimes) }}</td>
                <td>{{ euros(c.duCentimes) }}</td>
                <td [class.positif]="c.soldeCentimes > 0" [class.negatif]="c.soldeCentimes < 0">
                  {{ c.soldeCentimes > 0 ? '+' : '' }}{{ euros(c.soldeCentimes) }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="secondaire">Solde positif : on lui doit de l'argent ; négatif : il en doit. Les remboursements
        déjà faits sont comptés.</p>

      <h3>Dépenses</h3>
      <ul class="cartes">
        @for (d of f.depenses; track d.id) {
          <li class="carte">
            <div class="ligne">
              <span class="nom">{{ d.libelle }}</span>
              <span class="montant">{{ euros(d.montantCentimes) }}</span>
            </div>
            <p class="secondaire">{{ libelleCategorie(d.categorie) }}@if (d.jour) { · {{ dateFr(d.jour) }}}
              · payé par {{ nomDe(d.payeurId) }}</p>
            <p>Partagé entre {{ partage(d) }}</p>
            @if (s.gere) {
              <div class="actions sans-impression">
                <button type="button" class="bouton-discret" (click)="ouvrirDepense(d)">Modifier</button>
                <button type="button" class="bouton-discret danger" (click)="supprimerDepense(d)">Supprimer</button>
              </div>
            }
          </li>
        }
      </ul>
    }

    @if (f.versements.length > 0) {
      <h3>Remboursements faits</h3>
      <ul class="lignes-simples">
        @for (v of f.versements; track v.id) {
          <li>
            <span>{{ nomDe(v.deId) }} → {{ nomDe(v.aId) }} : {{ euros(v.montantCentimes) }}@if (v.jour) {, le {{ dateFr(v.jour) }}}</span>
            @if (s.gere) {
              <button type="button" class="bouton-discret danger sans-impression"
                      (click)="supprimerVersement(v.id)">Annuler</button>
            }
          </li>
        }
      </ul>
    }

    <app-dialogue [ouvert]="depenseOuverte()" [large]="true" [erreur]="erreur()"
                  [titre]="depenseId === null ? 'Ajouter une dépense' : 'Modifier la dépense'"
                  (fermer)="depenseOuverte.set(false)">
      <div class="grille">
        <div><label for="d-libelle">Quoi *</label>
          <input id="d-libelle" [(ngModel)]="depense.libelle" maxlength="160" placeholder="Location du gîte"></div>
        <div><label for="d-montant">Montant (€) *</label>
          <input id="d-montant" inputmode="decimal" [(ngModel)]="depense.montant" (ngModelChange)="calculerApercu()"
                 placeholder="450,00"></div>
        <div><label for="d-payeur">Payé par *</label>
          <select id="d-payeur" [(ngModel)]="depense.payeurId">
            @for (p of sejour().participants; track p.id) { <option [ngValue]="p.id">{{ nomComplet(p) }}</option> }
          </select></div>
        <div><label for="d-categorie">Catégorie</label>
          <select id="d-categorie" [(ngModel)]="depense.categorie">
            @for (c of categories; track c.code) { <option [ngValue]="c.code">{{ c.libelle }}</option> }
          </select></div>
        <div><label for="d-jour">Jour</label><input id="d-jour" type="date" [(ngModel)]="depense.jour"></div>
      </div>
      <fieldset>
        <legend>Partagé entre</legend>
        <div class="actions">
          <button type="button" class="bouton-discret" (click)="cocher('tous')">Tout le monde</button>
          <button type="button" class="bouton-discret" (click)="cocher('plongeurs')">Les plongeurs</button>
          <button type="button" class="bouton-discret" (click)="cocher('personne')">Personne</button>
        </div>
        <ul class="partage">
          @for (p of sejour().participants; track p.id) {
            <li>
              <label class="case"><input type="checkbox" [checked]="(depense.parts[p.id] ?? 0) > 0"
                                         (change)="basculerPart(p.id)"> {{ nomComplet(p) }}</label>
              @if ((depense.parts[p.id] ?? 0) > 0) {
                <label class="parts">parts
                  <input type="number" min="1" max="20" [(ngModel)]="depense.parts[p.id]" (ngModelChange)="calculerApercu()"
                         [attr.aria-label]="'Parts de ' + nomComplet(p)">
                </label>
                <span class="secondaire">{{ apercu()[p.id] ?? '' }}</span>
              }
            </li>
          }
        </ul>
        <p class="secondaire">Une part chacun ; 2 parts pour quelqu'un qui compte double (un couple…).</p>
      </fieldset>
      <div class="actions-dialogue">
        <button type="button" class="bouton-principal" (click)="enregistrerDepense()" [disabled]="envoi()">Enregistrer</button>
        <button type="button" class="bouton-discret" (click)="depenseOuverte.set(false)">Annuler</button>
      </div>
    </app-dialogue>

    <app-dialogue [ouvert]="versementOuvert()" [erreur]="erreur()" titre="Noter un remboursement"
                  (fermer)="versementOuvert.set(false)">
      <div class="grille">
        <div><label for="v-de">Qui a remboursé *</label>
          <select id="v-de" [(ngModel)]="versement.deId">
            @for (p of sejour().participants; track p.id) { <option [ngValue]="p.id">{{ nomComplet(p) }}</option> }
          </select></div>
        <div><label for="v-a">À qui *</label>
          <select id="v-a" [(ngModel)]="versement.aId">
            @for (p of sejour().participants; track p.id) { <option [ngValue]="p.id">{{ nomComplet(p) }}</option> }
          </select></div>
        <div><label for="v-montant">Montant (€) *</label>
          <input id="v-montant" inputmode="decimal" [(ngModel)]="versement.montant"></div>
        <div><label for="v-jour">Jour</label><input id="v-jour" type="date" [(ngModel)]="versement.jour"></div>
      </div>
      <div class="actions-dialogue">
        <button type="button" class="bouton-principal" (click)="enregistrerVersement()" [disabled]="envoi()">Enregistrer</button>
        <button type="button" class="bouton-discret" (click)="versementOuvert.set(false)">Annuler</button>
      </div>
    </app-dialogue>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h2 { margin: var(--pas-3, 24px) 0 var(--pas); }
    h3 { margin: var(--pas-2) 0 var(--pas); font-size: 1rem; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .titre-section { display: flex; justify-content: space-between; align-items: center; gap: var(--pas); flex-wrap: wrap; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; align-items: center; }
    .grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0 var(--pas-2); }
    fieldset { border: 1px solid var(--trait); border-radius: var(--r-s); margin: var(--pas-2) 0; padding: var(--pas) var(--pas-2); }
    legend { font-weight: 700; padding: 0 var(--pas); }
    .total { font-size: 1.0625rem; }
    .cartes { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2);
              grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
    .cartes > li { padding: var(--pas-2); }
    .cartes p { margin: var(--pas) 0 0; }
    .remboursement { display: flex; justify-content: space-between; align-items: center; gap: var(--pas); flex-wrap: wrap; }
    .solde-ok { padding: var(--pas-2); }
    .ligne { display: flex; justify-content: space-between; align-items: center; gap: var(--pas); }
    .nom { font-weight: 700; }
    .montant { font-weight: 700; color: var(--profond-fonce); white-space: nowrap; }
    .defilement { overflow-x: auto; }
    .soldes { border-collapse: collapse; width: 100%; background: var(--carte); }
    .soldes th, .soldes td { padding: var(--pas); border-bottom: 1px solid var(--trait); text-align: right; white-space: nowrap; }
    .soldes th[scope="row"], .soldes thead th:first-child { text-align: left; }
    .soldes tr.moi { background: #E0F2FE; }
    .positif { color: #047857; font-weight: 700; }
    .negatif { color: #B91C1C; font-weight: 700; }
    .lignes-simples { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas); }
    .lignes-simples li { display: flex; justify-content: space-between; align-items: center; gap: var(--pas); flex-wrap: wrap; }
    .partage { list-style: none; margin: var(--pas) 0 0; padding: 0; display: grid; gap: 0 var(--pas-2);
               grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .partage li { display: flex; align-items: center; gap: var(--pas); flex-wrap: wrap; }
    .case { display: flex; align-items: center; gap: var(--pas); font-weight: 400; min-height: 44px; margin: 0; }
    .case input { width: auto; flex: none; }
    .parts { display: flex; align-items: center; gap: 4px; margin: 0; font-weight: 400; font-size: .875rem; }
    .parts input { width: 4rem; margin: 0; }
    .danger { color: #B91C1C; border-color: #FCA5A5; }
  `]
})
export class SejourFraisComponent {
  private api = inject(SejourApi);

  sejour = input.required<SejourVue>();
  maj = output<SejourVue>();

  readonly euros = euros;
  readonly dateFr = dateFr;
  readonly nomComplet = nomComplet;
  readonly categories = CATEGORIES_DEPENSE;

  message = signal<string | null>(null);
  erreur = signal<string | null>(null);
  envoi = signal(false);

  private readonly parId = computed(() => new Map(this.sejour().participants.map(p => [p.id, p])));

  depenseOuverte = signal(false);
  depenseId: number | null = null;
  depense: BrouillonDepense = this.depenseVide();
  /** La part de chacun d'après le montant saisi, recalculée à chaque frappe (affichage seulement). */
  apercu = signal<Record<number, string>>({});

  versementOuvert = signal(false);
  versement = { deId: null as number | null, aId: null as number | null, montant: '', jour: null as string | null };

  nomDe(id: number): string {
    const p = this.parId().get(id);
    return p ? nomComplet(p) : '?';
  }

  estMoi(id: number): boolean {
    return !!this.parId().get(id)?.moi;
  }

  libelleCategorie(c: CategorieDepense): string {
    return CATEGORIES_DEPENSE.find(x => x.code === c)?.libelle ?? c;
  }

  partage(d: DepenseVue): string {
    if (d.parts.length === this.sejour().participants.length && d.parts.every(p => p.parts === 1)) return 'tout le monde';
    return d.parts.map(p => this.nomDe(p.participantId) + (p.parts > 1 ? ` (×${p.parts})` : '')).join(', ');
  }

  // ---------------- Dépenses ----------------

  private depenseVide(): BrouillonDepense {
    return { libelle: '', categorie: 'AUTRE', montant: '', payeurId: null, jour: null, parts: {} };
  }

  ouvrirDepense(d: DepenseVue | null): void {
    this.erreur.set(null);
    this.depenseId = d?.id ?? null;
    const participants = this.sejour().participants;
    this.depense = d
      ? {
          libelle: d.libelle, categorie: d.categorie, montant: (d.montantCentimes / 100).toFixed(2).replace('.', ','),
          payeurId: d.payeurId, jour: d.jour,
          parts: Object.fromEntries(d.parts.map(p => [p.participantId, p.parts]))
        }
      : {
          ...this.depenseVide(),
          payeurId: (participants.find(p => p.moi) ?? participants[0])?.id ?? null,
          parts: Object.fromEntries(participants.map(p => [p.id, 1]))
        };
    this.calculerApercu();
    this.depenseOuverte.set(true);
  }

  cocher(qui: 'tous' | 'plongeurs' | 'personne'): void {
    this.depense.parts = Object.fromEntries(this.sejour().participants
      .filter(p => qui === 'tous' || (qui === 'plongeurs' && p.plongeur))
      .map(p => [p.id, 1]));
    this.calculerApercu();
  }

  basculerPart(id: number): void {
    const parts = { ...this.depense.parts };
    if ((parts[id] ?? 0) > 0) delete parts[id]; else parts[id] = 1;
    this.depense.parts = parts;
    this.calculerApercu();
  }

  /** Répartition approchée pour l'aperçu ; le serveur fait foi (centimes restants compris). */
  calculerApercu(): void {
    const montant = enCentimes(this.depense.montant);
    const parts = Object.entries(this.depense.parts).filter(([, n]) => n > 0);
    const total = parts.reduce((s, [, n]) => s + Number(n), 0);
    this.apercu.set(!montant || !total ? {} : Object.fromEntries(
      parts.map(([id, n]) => [Number(id), euros(Math.floor(montant * Number(n) / total))])));
  }

  enregistrerDepense(): void {
    const d = this.depense;
    const montant = enCentimes(d.montant);
    if (!d.libelle.trim() || !montant || montant <= 0 || d.payeurId === null) {
      this.erreur.set('Indiquez ce qui a été payé, le montant et qui l’a payé.');
      return;
    }
    const parts = Object.entries(d.parts)
      .filter(([, n]) => Number(n) > 0)
      .map(([id, n]) => ({ participantId: Number(id), parts: Number(n) }));
    this.ecrire(this.api.enregistrerDepense(this.sejour().sortie.id, this.depenseId, {
      libelle: d.libelle.trim(), categorie: d.categorie, montantCentimes: montant, payeurId: d.payeurId,
      jour: d.jour || null, parts
    }), () => this.depenseOuverte.set(false));
  }

  supprimerDepense(d: DepenseVue): void {
    if (!confirm(`Supprimer la dépense « ${d.libelle} » (${euros(d.montantCentimes)}) ?`)) return;
    this.ecrire(this.api.supprimerDepense(this.sejour().sortie.id, d.id));
  }

  // ---------------- Remboursements ----------------

  /** Depuis « C'est remboursé » : le virement proposé, déjà rempli. */
  ouvrirVersement(r: { deId: number; aId: number; montantCentimes: number } | null): void {
    this.erreur.set(null);
    const participants = this.sejour().participants;
    this.versement = r
      ? { deId: r.deId, aId: r.aId, montant: (r.montantCentimes / 100).toFixed(2).replace('.', ','), jour: null }
      : { deId: participants[0]?.id ?? null, aId: participants[1]?.id ?? null, montant: '', jour: null };
    this.versementOuvert.set(true);
  }

  enregistrerVersement(): void {
    const v = this.versement;
    const montant = enCentimes(v.montant);
    if (v.deId === null || v.aId === null || !montant || montant <= 0) {
      this.erreur.set('Indiquez qui a remboursé qui, et le montant.');
      return;
    }
    if (v.deId === v.aId) {
      this.erreur.set('Un remboursement va d’un participant à un autre.');
      return;
    }
    this.ecrire(this.api.ajouterVersement(this.sejour().sortie.id,
      { deId: v.deId, aId: v.aId, montantCentimes: montant, jour: v.jour || null }),
      () => this.versementOuvert.set(false));
  }

  supprimerVersement(id: number): void {
    if (!confirm('Annuler ce remboursement ? Les comptes seront recalculés.')) return;
    this.ecrire(this.api.supprimerVersement(this.sejour().sortie.id, id));
  }

  private ecrire(appel: Observable<SejourVue>, ensuite?: () => void): void {
    this.envoi.set(true);
    this.erreur.set(null);
    this.message.set(null);
    appel.subscribe({
      next: s => {
        this.envoi.set(false);
        this.maj.emit(s);
        ensuite?.();
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        const texte = e.error?.detail ?? "L'enregistrement n'a pas abouti (réseau nécessaire).";
        this.erreur.set(texte);
        if (!this.depenseOuverte() && !this.versementOuvert()) this.message.set(texte);
      }
    });
  }
}
