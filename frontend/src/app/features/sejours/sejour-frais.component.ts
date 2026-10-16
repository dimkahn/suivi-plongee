import { Component, ChangeDetectionStrategy, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { DialogueComponent } from '../../core/dialogue.component';
import { dateFr } from '../../core/date-fr';
import { reduirePhoto } from '../../core/reduire-photo';
import {
  CATEGORIES_DEPENSE, CategorieDepense, DepenseVue, FraisVue, NoteLue, ParticipantFrais, PortFrais, RegleLecture,
  completerAvecNote, enCentimes, euros, nomComplet
} from './sejour-api';
import { leconDuTicket } from './lecture-ticket';

/** Brouillon d'une dépense : le montant tel que tapé, les parts par participant (0 = ne partage pas). */
interface BrouillonDepense {
  libelle: string;
  categorie: CategorieDepense;
  montant: string;
  payeurId: number | null;
  jour: string | null;
  parts: Record<number, number>;
}

/** Une photo choisie, pas encore envoyée : le fichier et son aperçu. */
interface PhotoAEnvoyer {
  fichier: File;
  apercu: string;
}

/**
 * Les frais partagés d'un séjour : les dépenses avancées par les uns pour
 * les autres, avec la photo de la note, les remboursements faits, le compte
 * de chacun et les remboursements qui restent à faire (calculés par le
 * serveur, au centime près). Sert à l'onglet « Frais » du séjour (compte
 * connecté) et à la page des invités sans compte (/frais/…) : les écritures
 * passent par le {@link PortFrais} reçu, les droits viennent du serveur.
 */
@Component({
  selector: 'app-sejour-frais',
  imports: [FormsModule, DialogueComponent],
  template: `
    @let f = frais();
    @let d = f.droits;
    <div class="titre-section">
      <h2>Frais partagés</h2>
      <div class="actions sans-impression">
        @if (d.peutAjouter) {
          <button type="button" class="bouton-principal" (click)="ouvrirDepense(null)"
                  [disabled]="participants().length === 0">Ajouter une dépense</button>
        }
        @if (d.pourLesAutres) {
          <button type="button" class="bouton-discret" (click)="ouvrirVersement(null)"
                  [disabled]="participants().length < 2">Noter un remboursement</button>
        }
      </div>
    </div>
    @if (!d.peutAjouter && d.moiId !== null) {
      <p class="secondaire sans-impression">Une dépense à noter ? Donnez la note à un moniteur du séjour : il la saisira
        pour vous, avec sa photo.</p>
    }
    @if (message(); as m) { <div class="alerte sans-impression" role="status">{{ m }}</div> }

    @if (f.depenses.length === 0) {
      <p class="vide">Aucune dépense pour l'instant. Gîte, location de voiture, courses, plongées : chacun note
        ce qu'il a avancé, avec la photo de la note ; l'appli calcule qui doit combien à qui.</p>
    } @else {
      @if (monSolde(); as m) {
        <div class="carte mon-solde" [class.doit]="m.doit" [class.a-jour]="m.lignes.length === 0">
          <span class="etiquette">Votre solde</span>
          @if (m.lignes.length === 0) {
            <strong>Vous êtes à jour.</strong>
          } @else {
            @for (l of m.lignes; track $index) { <strong>{{ l }}</strong> }
          }
        </div>
      }

      <h3>Qui doit combien à qui</h3>
      @if (f.comptes.remboursements.length === 0) {
        <p class="carte solde-ok">Les comptes sont soldés.</p>
      } @else {
        <ul class="lignes-cartes">
          @for (r of f.comptes.remboursements; track r.deId + '-' + r.aId) {
            <li class="carte remboursement" [class.moi]="r.deId === d.moiId || r.aId === d.moiId">
              <span><strong>{{ nomDe(r.deId) }}</strong> doit <strong>{{ euros(r.montantCentimes) }}</strong>
                à <strong>{{ nomDe(r.aId) }}</strong></span>
              @if (d.pourLesAutres || (d.peutAjouter && r.aId === d.moiId)) {
                <button type="button" class="bouton-discret sans-impression"
                        (click)="ouvrirVersement(r)">C'est remboursé</button>
              }
            </li>
          }
        </ul>
      }

      <div class="titre-depenses">
        <h3>Dépenses</h3>
        <span class="secondaire">{{ f.depenses.length }} · total <strong>{{ euros(f.comptes.totalCentimes) }}</strong></span>
      </div>
      <ul class="lignes-cartes">
        @for (dep of f.depenses; track dep.id) {
          <li class="carte depense">
            <details [open]="deplie()">
              <summary>
                <span class="quoi">
                  <span class="nom">{{ dep.libelle }}</span>
                  <span class="secondaire">payé par {{ nomDe(dep.payeurId) }}</span>
                </span>
                @if (dep.photos.length > 0) { <span aria-label="avec la photo de la note" title="Photo de la note">📎</span> }
                <span class="montant">{{ euros(dep.montantCentimes) }}</span>
              </summary>
              <p class="secondaire">{{ libelleCategorie(dep.categorie) }}@if (dep.jour) { · {{ dateFr(dep.jour) }}}</p>
              <p>Partagé entre {{ partage(dep) }}</p>
              @if (dep.photos.length > 0) {
                <div class="vignettes">
                  @for (ph of dep.photos; track ph) {
                    <button type="button" class="vignette" (click)="agrandir(dep.id, ph)"
                            [attr.aria-label]="'Voir la photo de la note : ' + dep.libelle">
                      @if (urlPhoto(dep.id, ph); as url) { <img [src]="url" alt=""> } @else { <span>📎</span> }
                    </button>
                  }
                </div>
              }
              @if (d.depensesModifiables.includes(dep.id)) {
                <div class="actions sans-impression">
                  <button type="button" class="bouton-discret" (click)="ouvrirDepense(dep)">Modifier</button>
                  <button type="button" class="bouton-discret danger" (click)="supprimerDepense(dep)">Supprimer</button>
                </div>
              }
            </details>
          </li>
        }
      </ul>
    }

    @if (f.depenses.length > 0 || f.versements.length > 0) {
      <details class="carte detail-comptes" [open]="deplie()">
        <summary>Détail des comptes{{ f.versements.length ? ' et remboursements faits' : '' }}</summary>
        <div class="defilement">
          <table class="soldes">
            <thead><tr><th scope="col">Participant</th><th scope="col">A payé</th><th scope="col">Sa part</th>
              <th scope="col">Solde</th></tr></thead>
            <tbody>
              @for (c of f.comptes.soldes; track c.participantId) {
                <tr [class.moi]="c.participantId === d.moiId">
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

        @if (f.versements.length > 0) {
          <h3>Remboursements faits</h3>
          <ul class="lignes-simples">
            @for (v of f.versements; track v.id) {
              <li>
                <span>{{ nomDe(v.deId) }} → {{ nomDe(v.aId) }} : {{ euros(v.montantCentimes) }}@if (v.jour) {, le {{ dateFr(v.jour) }}}</span>
                @if (d.versementsSupprimables.includes(v.id)) {
                  <button type="button" class="bouton-discret danger sans-impression"
                          (click)="supprimerVersement(v.id)">Annuler</button>
                }
              </li>
            }
          </ul>
        }
      </details>
    }

    <app-dialogue [ouvert]="photoAgrandie() !== null" titre="Photo de la note" [large]="true"
                  (fermer)="photoAgrandie.set(null)">
      @if (photoAgrandie(); as p) {
        @if (urlPhoto(p.depenseId, p.photoId); as url) { <img class="grande" [src]="url" alt="Photo de la note"> }
        <div class="actions-dialogue">
          @if (d.depensesModifiables.includes(p.depenseId)) {
            <button type="button" class="bouton-discret danger" (click)="supprimerPhoto(p.depenseId, p.photoId)">
              Supprimer cette photo
            </button>
          }
          <button type="button" class="bouton-discret" (click)="photoAgrandie.set(null)">Fermer</button>
        </div>
      }
    </app-dialogue>

    <app-dialogue [ouvert]="depenseOuverte()" [large]="true" [erreur]="erreur()"
                  [titre]="depenseId === null ? 'Ajouter une dépense' : 'Modifier la dépense'"
                  (fermer)="fermerDepense()">
      <div class="grille">
        <div><label for="d-libelle">Quoi *</label>
          <input id="d-libelle" [(ngModel)]="depense.libelle" maxlength="160" placeholder="Courses du samedi"></div>
        <div><label for="d-montant">Montant (€) *</label>
          <input id="d-montant" inputmode="decimal" [(ngModel)]="depense.montant" (ngModelChange)="calculerApercu()"
                 placeholder="45,80"></div>
        <div><label for="d-payeur">Payé par *</label>
          <select id="d-payeur" [(ngModel)]="depense.payeurId" [disabled]="!d.pourLesAutres">
            @for (p of participants(); track p.id) { <option [ngValue]="p.id">{{ nomComplet(p) }}</option> }
          </select></div>
        <div><label for="d-categorie">Catégorie</label>
          <select id="d-categorie" [(ngModel)]="depense.categorie">
            @for (c of categories; track c.code) { <option [ngValue]="c.code">{{ c.libelle }}</option> }
          </select></div>
        <div><label for="d-jour">Jour</label><input id="d-jour" type="date" [(ngModel)]="depense.jour"></div>
      </div>

      <fieldset>
        <legend>Photo de la note</legend>
        <div class="vignettes">
          @for (ph of photosExistantes(); track ph) {
            <span class="vignette">
              @if (urlPhoto(depenseId!, ph); as url) { <img [src]="url" alt=""> } @else { <span>📎</span> }
            </span>
          }
          @for (ph of aEnvoyer(); track ph.apercu; let i = $index) {
            <span class="vignette nouvelle">
              <img [src]="ph.apercu" alt="">
              <button type="button" class="retirer" [attr.aria-label]="'Retirer la photo ' + (i + 1)"
                      (click)="retirerPhoto(i)">✕</button>
            </span>
          }
        </div>
        <!-- Deux champs : « capture » ouvre directement l'appareil photo,
             sans lui le téléphone propose la galerie. -->
        <div class="actions">
          <label class="bouton-discret choisir-photo" for="d-photo-prendre">📷 Prendre une photo</label>
          <label class="bouton-discret choisir-photo" for="d-photo-choisir">🖼️ Choisir dans mes photos</label>
        </div>
        <input id="d-photo-prendre" class="cache" type="file" accept="image/*" capture="environment"
               (change)="choisirPhotos($event)">
        <input id="d-photo-choisir" class="cache" type="file" accept="image/*" multiple
               (change)="choisirPhotos($event)">
        @if (lectureNote(); as l) { <p class="lecture-note" role="status">{{ l }}</p> }
        <p class="secondaire">Une photo lisible du ticket ou de la facture : chacun peut la voir.
          Le montant total, la date et la catégorie y sont lus pour remplir les cases vides : vérifiez-les.</p>
      </fieldset>

      <fieldset>
        <legend>Partagé entre</legend>
        @if (!choixPartage()) {
          <!-- Le cas courant en une ligne : tout le monde, une part chacun. -->
          <div class="partage-simple">
            <span>{{ resumePartage() }}</span>
            <button type="button" class="bouton-discret" (click)="choixPartage.set(true)">Choisir qui partage</button>
          </div>
        } @else {
          <div class="actions">
            <button type="button" class="bouton-discret" (click)="cocher('tous')">Tout le monde</button>
            <button type="button" class="bouton-discret" (click)="cocher('plongeurs')">Les plongeurs</button>
            <button type="button" class="bouton-discret" (click)="cocher('personne')">Personne</button>
          </div>
          <ul class="partage">
            @for (p of participants(); track p.id) {
              <li>
                <label class="case"><input type="checkbox" [checked]="(depense.parts[p.id] ?? 0) > 0"
                                           (change)="basculerPart(p.id)"> {{ nomComplet(p) }}</label>
                @if ((depense.parts[p.id] ?? 0) > 0) {
                  @if (partsInegales()) {
                    <label class="parts">parts
                      <input type="number" min="1" max="20" [(ngModel)]="depense.parts[p.id]" (ngModelChange)="calculerApercu()"
                             [attr.aria-label]="'Parts de ' + nomComplet(p)">
                    </label>
                  }
                  <span class="secondaire">{{ apercu()[p.id] ?? '' }}</span>
                }
              </li>
            }
          </ul>
          <label class="case">
            <input type="checkbox" [checked]="partsInegales()" (change)="basculerPartsInegales()">
            Parts inégales (2 parts pour un couple…)
          </label>
        }
      </fieldset>
      <div class="actions-dialogue">
        <button type="button" class="bouton-principal" (click)="enregistrerDepense()" [disabled]="envoi()">
          {{ envoi() ? 'Envoi…' : 'Enregistrer' }}
        </button>
        <button type="button" class="bouton-discret" (click)="fermerDepense()">Annuler</button>
      </div>
    </app-dialogue>

    <app-dialogue [ouvert]="versementOuvert()" [erreur]="erreur()" titre="Noter un remboursement"
                  (fermer)="versementOuvert.set(false)">
      <div class="grille">
        <div><label for="v-de">Qui a remboursé *</label>
          <select id="v-de" [(ngModel)]="versement.deId">
            @for (p of participants(); track p.id) { <option [ngValue]="p.id">{{ nomComplet(p) }}</option> }
          </select></div>
        <div><label for="v-a">À qui *</label>
          <select id="v-a" [(ngModel)]="versement.aId" [disabled]="!d.pourLesAutres">
            @for (p of participants(); track p.id) { <option [ngValue]="p.id">{{ nomComplet(p) }}</option> }
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
    .mon-solde { display: flex; flex-direction: column; gap: 4px; padding: var(--pas-2); margin: var(--pas-2) 0;
                 border-left: 6px solid #047857; font-size: 1.125rem; }
    .mon-solde.doit { border-left-color: var(--accent); }
    .mon-solde .etiquette { font-size: .8125rem; font-weight: 700; text-transform: uppercase; color: var(--craie); }
    .lignes-cartes { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas); }
    .lignes-cartes p { margin: var(--pas) 0 0; }
    .remboursement { display: flex; justify-content: space-between; align-items: center; gap: var(--pas); flex-wrap: wrap;
                     padding: var(--pas) var(--pas-2); }
    .remboursement.moi { border-left: 4px solid var(--accent); }
    .solde-ok { padding: var(--pas-2); }
    .titre-depenses { display: flex; justify-content: space-between; align-items: baseline; gap: var(--pas);
                      flex-wrap: wrap; margin-top: var(--pas-2); }
    .depense { padding: 0 var(--pas-2); }
    .depense details[open] { padding-bottom: var(--pas-2); }
    summary { min-height: 44px; display: flex; align-items: center; gap: var(--pas); cursor: pointer; }
    .depense .quoi { flex: 1; display: flex; flex-direction: column; padding: 6px 0; }
    .depense .quoi .secondaire { font-size: .875rem; }
    .detail-comptes { padding: 0 var(--pas-2); margin-top: var(--pas-2); }
    .detail-comptes summary { font-weight: 700; }
    .detail-comptes[open] { padding-bottom: var(--pas-2); }
    .partage-simple { display: flex; justify-content: space-between; align-items: center; gap: var(--pas); flex-wrap: wrap; }
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
    .vignettes { display: flex; flex-wrap: wrap; gap: var(--pas); margin-top: var(--pas); }
    .vignette { position: relative; width: 64px; height: 64px; padding: 0; border: 1px solid var(--trait);
                border-radius: var(--r-s); background: var(--carte); overflow: hidden; display: flex;
                align-items: center; justify-content: center; cursor: pointer; }
    .vignette img { width: 100%; height: 100%; object-fit: cover; }
    .vignette.nouvelle { border-color: var(--accent); }
    .retirer { position: absolute; top: 0; right: 0; width: 28px; height: 28px; border: none; border-radius: 0 0 0 var(--r-s);
               background: rgba(0,0,0,.6); color: #fff; cursor: pointer; }
    .choisir-photo { display: inline-flex; align-items: center; min-height: 44px; cursor: pointer; font-weight: 700; }
    .cache { position: absolute; width: 1px; height: 1px; opacity: 0; }
    .grande { display: block; max-width: 100%; max-height: 70vh; margin: 0 auto; }
    .danger { color: #B91C1C; border-color: #FCA5A5; }
    .lecture-note { margin: var(--pas) 0 0; padding: var(--pas); border-radius: var(--r-s); background: #E0F2FE;
                    font-weight: 700; }
  `]
})
export class SejourFraisComponent {
  frais = input.required<FraisVue>();
  participants = input.required<ParticipantFrais[]>();
  port = input.required<PortFrais>();
  /** Tout déplié (impression du carnet). */
  deplie = input(false);
  /** Les frais à jour après chaque écriture. */
  maj = output<FraisVue>();

  readonly euros = euros;
  readonly dateFr = dateFr;
  readonly nomComplet = nomComplet;
  readonly categories = CATEGORIES_DEPENSE;

  message = signal<string | null>(null);
  erreur = signal<string | null>(null);
  envoi = signal(false);

  private readonly parId = computed(() => new Map(this.participants().map(p => [p.id, p])));

  /** En tête de l'onglet : ce que le participant connecté doit, ou ce qu'on lui doit ; null s'il n'en est pas. */
  readonly monSolde = computed(() => {
    const f = this.frais();
    const moi = f.droits.moiId;
    if (moi === null) return null;
    const lignes = f.comptes.remboursements
      .filter(r => r.deId === moi || r.aId === moi)
      .map(r => r.deId === moi
        ? `Vous devez ${euros(r.montantCentimes)} à ${this.nomDe(r.aId)}.`
        : `${this.nomDe(r.deId)} vous doit ${euros(r.montantCentimes)}.`);
    return { lignes, doit: f.comptes.remboursements.some(r => r.deId === moi) };
  });

  depenseOuverte = signal(false);
  /** Faux : « tout le monde, une part chacun » en une ligne ; vrai : la liste à cocher. */
  choixPartage = signal(false);
  partsInegales = signal(false);
  depenseId: number | null = null;
  depense: BrouillonDepense = this.depenseVide();
  /** La part de chacun d'après le montant saisi, recalculée à chaque frappe (affichage seulement). */
  apercu = signal<Record<number, string>>({});
  aEnvoyer = signal<PhotoAEnvoyer[]>([]);
  photosExistantes = signal<number[]>([]);
  /** Où en est la lecture du montant et de la date sur la photo choisie. */
  lectureNote = signal<string | null>(null);
  /** Une lecture qui revient après la fermeture de la fenêtre (ou une autre dépense ouverte) est ignorée. */
  private ouverture = 0;
  /** La dernière note lue sur le téléphone pour la dépense ouverte : son texte reste sur l'appareil. */
  private lectureTelephone: { texte: string; lue: NoteLue } | null = null;
  private regles?: Promise<RegleLecture[]>;

  versementOuvert = signal(false);
  versement = { deId: null as number | null, aId: null as number | null, montant: '', jour: null as string | null };

  photoAgrandie = signal<{ depenseId: number; photoId: number } | null>(null);
  /** Photos lues (en blob, la lecture demande le jeton), gardées le temps de l'écran. */
  private photos = signal<Record<number, string>>({});
  private demandees = new Set<number>();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      Object.values(this.photos()).forEach(u => URL.revokeObjectURL(u));
      this.aEnvoyer().forEach(p => URL.revokeObjectURL(p.apercu));
    });
  }

  nomDe(id: number): string {
    const p = this.parId().get(id);
    return p ? nomComplet(p) : '?';
  }

  libelleCategorie(c: CategorieDepense): string {
    return CATEGORIES_DEPENSE.find(x => x.code === c)?.libelle ?? c;
  }

  partage(d: DepenseVue): string {
    if (d.parts.length === this.participants().length && d.parts.every(p => p.parts === 1)) return 'tout le monde';
    return d.parts.map(p => this.nomDe(p.participantId) + (p.parts > 1 ? ` (×${p.parts})` : '')).join(', ');
  }

  /** L'adresse locale de la photo, demandée au serveur au premier affichage. */
  urlPhoto(depenseId: number, photoId: number): string | null {
    const url = this.photos()[photoId];
    if (url) return url;
    if (!this.demandees.has(photoId)) {
      this.demandees.add(photoId);
      this.port().lirePhoto(depenseId, photoId).subscribe({
        next: blob => this.photos.set({ ...this.photos(), [photoId]: URL.createObjectURL(blob) }),
        error: () => this.demandees.delete(photoId)
      });
    }
    return null;
  }

  agrandir(depenseId: number, photoId: number): void {
    this.photoAgrandie.set({ depenseId, photoId });
  }

  // ---------------- Dépenses ----------------

  private depenseVide(): BrouillonDepense {
    return { libelle: '', categorie: 'AUTRE', montant: '', payeurId: null, jour: null, parts: {} };
  }

  ouvrirDepense(d: DepenseVue | null): void {
    this.erreur.set(null);
    this.ouverture++;
    this.lectureNote.set(null);
    this.lectureTelephone = null;
    this.depenseId = d?.id ?? null;
    this.viderPhotosAEnvoyer();
    this.photosExistantes.set(d?.photos ?? []);
    const participants = this.participants();
    this.depense = d
      ? {
          libelle: d.libelle, categorie: d.categorie, montant: (d.montantCentimes / 100).toFixed(2).replace('.', ','),
          payeurId: d.payeurId, jour: d.jour,
          parts: Object.fromEntries(d.parts.map(p => [p.participantId, p.parts]))
        }
      : {
          ...this.depenseVide(),
          payeurId: this.frais().droits.moiId ?? participants[0]?.id ?? null,
          parts: Object.fromEntries(participants.map(p => [p.id, 1]))
        };
    const parts = Object.values(this.depense.parts);
    this.partsInegales.set(parts.some(n => n > 1));
    this.choixPartage.set(parts.length !== participants.length || this.partsInegales());
    this.calculerApercu();
    this.depenseOuverte.set(true);
  }

  /** « Tout le monde (8), une part chacun : 5,72 € chacun ». */
  resumePartage(): string {
    const n = Object.values(this.depense.parts).filter(p => p > 0).length;
    const montant = enCentimes(this.depense.montant);
    return `Tout le monde (${n}), une part chacun`
      + (montant && montant > 0 && n > 0 ? ` : environ ${euros(Math.floor(montant / n))} chacun` : '');
  }

  /** Revenir à des parts égales remet une part à chacun de ceux qui partagent. */
  basculerPartsInegales(): void {
    const inegales = !this.partsInegales();
    this.partsInegales.set(inegales);
    if (!inegales) {
      this.depense.parts = Object.fromEntries(Object.keys(this.depense.parts).map(id => [Number(id), 1]));
      this.calculerApercu();
    }
  }

  fermerDepense(): void {
    this.ouverture++;
    this.depenseOuverte.set(false);
    this.viderPhotosAEnvoyer();
  }

  cocher(qui: 'tous' | 'plongeurs' | 'personne'): void {
    this.depense.parts = Object.fromEntries(this.participants()
      .filter(p => qui === 'tous' || (qui === 'plongeurs' && p.plongeur !== false))
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

  async choisirPhotos(evenement: Event): Promise<void> {
    const champ = evenement.target as HTMLInputElement;
    const fichiers = Array.from(champ.files ?? []);
    champ.value = '';
    for (const fichier of fichiers) {
      try {
        const reduit = await reduirePhoto(fichier);
        this.aEnvoyer.set([...this.aEnvoyer(), { fichier: reduit, apercu: URL.createObjectURL(reduit) }]);
        await this.lireNote(reduit);
      } catch {
        this.erreur.set('Cette image n’a pas pu être lue : prenez une photo JPEG ou PNG.');
      }
    }
  }

  /**
   * Le montant total, la date et la catégorie lus sur la photo remplissent les cases encore vides
   * (catégorie encore « Autre »), jamais ce qui est saisi. Lus sur le téléphone (OCR), ou par l'IA
   * quand l'installation l'a réglée ; si l'IA ne répond pas, le téléphone prend le relais.
   */
  private async lireNote(photo: File): Promise<void> {
    const d = this.depense;
    if (d.montant.trim() && d.jour && d.categorie !== 'AUTRE') return;
    const ouverture = this.ouverture;
    this.lectureNote.set('Lecture de la note… (la première fois, l’outil de lecture se télécharge)');
    try {
      const { note, texte } = await this.lireParIaOuSurLeTelephone(photo);
      if (ouverture !== this.ouverture) return;
      if (texte !== null) this.lectureTelephone = { texte, lue: note };
      const c = completerAvecNote(this.depense, note);
      this.depense.montant = c.montant;
      this.depense.jour = c.jour;
      this.depense.categorie = c.categorie;
      this.calculerApercu();
      const lus = c.remplis.length > 1
        ? c.remplis.slice(0, -1).join(', ') + ' et ' + c.remplis[c.remplis.length - 1]
        : c.remplis[0];
      this.lectureNote.set(lus
        ? `Lu sur la note : ${lus}. Vérifiez avant d’enregistrer.`
        : 'Rien de plus n’a pu être lu sur la note : complétez à la main.');
    } catch {
      if (ouverture !== this.ouverture) return;
      this.lectureNote.set('La note n’a pas pu être lue : saisissez le montant et la date.');
    }
  }

  /** {@code texte} : le texte lu sur le téléphone (null pour une lecture par l'IA), pour apprendre des corrections. */
  private async lireParIaOuSurLeTelephone(photo: File): Promise<{ note: NoteLue; texte: string | null }> {
    if (this.frais().droits.lireNotes) {
      try {
        return { note: await firstValueFrom(this.port().lireNote(photo)), texte: null };
      } catch {
        // L'IA ne répond pas : la lecture sur le téléphone prend le relais.
      }
    }
    const [{ lireTicketSurLeTelephone }, regles] = await Promise.all([import('./ocr-ticket'), this.reglesApprises()]);
    return lireTicketSurLeTelephone(photo, regles);
  }

  /** Les règles apprises des corrections du club, demandées une fois ; sans réseau, aucune. */
  private reglesApprises(): Promise<RegleLecture[]> {
    this.regles ??= firstValueFrom(this.port().reglesLecture()).catch(() => []);
    return this.regles;
  }

  /**
   * Après l'enregistrement : ce que la personne a gardé ou corrigé devient une
   * règle pour tout le club (commerçant, catégorie, libellé du total ; jamais
   * la photo ni le texte). Un échec n'empêche rien.
   */
  private apprendre(montantCentimes: number, categorie: CategorieDepense): void {
    const lecture = this.lectureTelephone;
    this.lectureTelephone = null;
    if (!lecture) return;
    const lecon = leconDuTicket(lecture.texte, lecture.lue, { montantCentimes, categorie });
    if (!lecon) return;
    this.port().apprendreLecture(lecon).subscribe({ next: () => this.regles = undefined, error: () => undefined });
  }

  retirerPhoto(i: number): void {
    const liste = [...this.aEnvoyer()];
    const [retiree] = liste.splice(i, 1);
    if (retiree) URL.revokeObjectURL(retiree.apercu);
    this.aEnvoyer.set(liste);
  }

  private viderPhotosAEnvoyer(): void {
    this.aEnvoyer().forEach(p => URL.revokeObjectURL(p.apercu));
    this.aEnvoyer.set([]);
  }

  /** La dépense d'abord, puis ses photos une à une : une photo refusée n'annule pas la dépense. */
  async enregistrerDepense(): Promise<void> {
    const d = this.depense;
    const montant = enCentimes(d.montant);
    if (!d.libelle.trim() || !montant || montant <= 0 || d.payeurId === null) {
      this.erreur.set('Indiquez ce qui a été payé, le montant et qui l’a payé.');
      return;
    }
    const parts = Object.entries(d.parts)
      .filter(([, n]) => Number(n) > 0)
      .map(([id, n]) => ({ participantId: Number(id), parts: Number(n) }));
    this.envoi.set(true);
    this.erreur.set(null);
    this.message.set(null);
    try {
      const r = await firstValueFrom(this.port().enregistrerDepense(this.depenseId, {
        libelle: d.libelle.trim(), categorie: d.categorie, montantCentimes: montant, payeurId: d.payeurId,
        jour: d.jour || null, parts
      }));
      this.depenseId = r.depenseId;
      this.maj.emit(r.frais);
      this.apprendre(montant, d.categorie);
      while (this.aEnvoyer().length > 0) {
        this.maj.emit(await firstValueFrom(this.port().ajouterPhoto(r.depenseId, this.aEnvoyer()[0].fichier)));
        this.retirerPhoto(0);
      }
      this.depenseOuverte.set(false);
    } catch (e) {
      this.erreur.set((e as HttpErrorResponse).error?.detail
        ?? "L'enregistrement n'a pas abouti (réseau nécessaire). La dépense est peut-être enregistrée sans sa photo : vérifiez.");
    } finally {
      this.envoi.set(false);
    }
  }

  supprimerDepense(d: DepenseVue): void {
    if (!confirm(`Supprimer la dépense « ${d.libelle} » (${euros(d.montantCentimes)}) et ses photos ?`)) return;
    this.ecrire(this.port().supprimerDepense(d.id));
  }

  supprimerPhoto(depenseId: number, photoId: number): void {
    if (!confirm('Supprimer cette photo de la note ?')) return;
    this.ecrire(this.port().supprimerPhoto(depenseId, photoId), () => this.photoAgrandie.set(null));
  }

  // ---------------- Remboursements ----------------

  /** Depuis « C'est remboursé » : le virement proposé, déjà rempli. */
  ouvrirVersement(r: { deId: number; aId: number; montantCentimes: number } | null): void {
    this.erreur.set(null);
    const participants = this.participants();
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
    this.ecrire(this.port().ajouterVersement({ deId: v.deId, aId: v.aId, montantCentimes: montant, jour: v.jour || null }),
      () => this.versementOuvert.set(false));
  }

  supprimerVersement(id: number): void {
    if (!confirm('Annuler ce remboursement ? Les comptes seront recalculés.')) return;
    this.ecrire(this.port().supprimerVersement(id));
  }

  private ecrire(appel: Observable<FraisVue>, ensuite?: () => void): void {
    this.envoi.set(true);
    this.erreur.set(null);
    this.message.set(null);
    appel.subscribe({
      next: f => {
        this.envoi.set(false);
        this.maj.emit(f);
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
