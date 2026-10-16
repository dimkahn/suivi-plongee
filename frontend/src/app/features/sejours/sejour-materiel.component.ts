import { Component, ChangeDetectionStrategy, OnInit, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DialogueComponent } from '../../core/dialogue.component';
import { dateDuJour, dateFr } from '../../core/date-fr';
import { contientUnDetendeur, filtrerDisponibles } from './materiel-sejour';
import { PortPrets, PretSejourVue, PretsSejourVue, TypeEquipement, nomComplet } from './sejour-api';

const TYPES: { code: TypeEquipement | null; libelle: string }[] = [
  { code: null, libelle: 'Tout' },
  { code: 'BLOC', libelle: 'Blocs' },
  { code: 'DETENDEUR', libelle: 'Détendeurs' },
  { code: 'GILET', libelle: 'Gilets' },
  { code: 'COMBINAISON', libelle: 'Combinaisons' }
];

/**
 * Le matériel du club emprunté pendant le séjour, déclaré par ceux qui l'ont
 * emprunté, comme les frais. Chaque déclaration est un vrai prêt du
 * matériel (déjà prêté, contrôles dépassés, désinfection des détendeurs :
 * le serveur refuse) ; le directeur technique en note le retour. Sert à
 * l'onglet « Matériel » du séjour (compte connecté) et à la page du lien
 * (/sejour/…) : les appels passent par le {@link PortPrets} reçu, le
 * serveur filtre ce que chacun voit et dit ce qu'il peut faire.
 */
@Component({
  selector: 'app-sejour-materiel',
  imports: [FormsModule, DialogueComponent],
  template: `
    <div class="titre-section">
      <h2>Matériel emprunté</h2>
      @if (vue()?.droits?.peutDeclarer) {
        <button type="button" class="bouton-principal" (click)="ouvrir()">Déclarer un emprunt</button>
      }
    </div>
    <p class="secondaire">Vous avez emprunté du matériel du club (bloc, détendeur, gilet, combinaison) ?
      Déclarez-le ici : le directeur technique le retrouve dans ses prêts et note le retour quand vous le rendez.</p>
    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (vue(); as v) {
      @if (v.prets.length === 0) {
        <p class="vide">Aucun emprunt déclaré pour l'instant.</p>
      } @else {
        <ul class="lignes-cartes">
          @for (p of v.prets; track p.id) {
            <li class="carte pret" [class.moi]="p.participantId !== null && p.participantId === v.droits.moiId">
              <div class="quoi">
                <span class="nom">{{ p.emprunteur }}</span>
                <ul class="equipements">
                  @for (e of p.equipements; track e.id) {
                    <li>{{ e.typeLibelle }} <strong>{{ e.reference }}</strong>@if (e.description) { — {{ e.description }}}</li>
                  }
                </ul>
                <span class="secondaire">{{ quand(p) }}</span>
                @if (p.enRetard) { <span class="badge retard">En retard</span> }
              </div>
              @if (p.annulable) {
                <button type="button" class="bouton-discret danger" (click)="annuler(p)">Annuler</button>
              }
            </li>
          }
        </ul>
      }
    } @else if (!message()) {
      <p class="secondaire">Chargement…</p>
    }

    <app-dialogue [ouvert]="ouvert()" titre="Déclarer un emprunt" [large]="true" [erreur]="erreur()"
                  (fermer)="ouvert.set(false)">
      @if (vue(); as v) {
        <div class="grille">
          <div>
            <label for="m-qui">Qui a emprunté *</label>
            @if (v.droits.pourLesAutres) {
              <select id="m-qui" [(ngModel)]="participantId">
                @for (p of v.participants; track p.id) { <option [ngValue]="p.id">{{ nomComplet(p) }}</option> }
              </select>
            } @else {
              <p id="m-qui" class="qui">{{ v.participants[0] ? nomComplet(v.participants[0]) : '' }} (vous)</p>
            }
          </div>
          <div><label for="m-jour">Emprunté le *</label><input id="m-jour" type="date" [(ngModel)]="datePret"></div>
        </div>

        <fieldset>
          <legend>Le matériel</legend>
          <div class="types" role="group" aria-label="Type de matériel">
            @for (t of types; track t.libelle) {
              <button type="button" class="bouton-discret" [class.actif]="type() === t.code"
                      [attr.aria-pressed]="type() === t.code" (click)="type.set(t.code)">{{ t.libelle }}</button>
            }
          </div>
          <label for="m-recherche">Référence ou description</label>
          <input id="m-recherche" type="search" [ngModel]="recherche()" (ngModelChange)="recherche.set($event)"
                 placeholder="G-12, taille M…">
          @if (affiches().length === 0) {
            <p class="vide">Aucun matériel disponible ici : il est déjà prêté, ou un contrôle est à faire.
              Voyez le directeur technique.</p>
          } @else {
            <ul class="choix">
              @for (e of affiches(); track e.id) {
                <li>
                  <label class="case">
                    <input type="checkbox" [checked]="choisis().includes(e.id)" (change)="basculer(e.id)">
                    <span>{{ e.typeLibelle }} <strong>{{ e.reference }}</strong>
                      @if (e.description) { <span class="secondaire"> — {{ e.description }}</span> }</span>
                  </label>
                </li>
              }
            </ul>
          }
          @if (!v.droits.pourLesAutres) {
            <p class="secondaire">Un détendeur emprunté ? Un moniteur du séjour le déclare pour vous : il atteste
              sa désinfection.</p>
          }
          @if (choisis().length > 0) {
            <p class="secondaire">{{ choisis().length }} choisi{{ choisis().length > 1 ? 's' : '' }}</p>
          }
        </fieldset>

        @if (avecDetendeur()) {
          <label class="case desinfection">
            <input type="checkbox" [(ngModel)]="desinfecte">
            Le détendeur a été désinfecté avant d'être remis à l'emprunteur (obligatoire à chaque changement
            d'utilisateur ; inscrit à son journal).
          </label>
        }
        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" (click)="declarer()" [disabled]="envoi()">
            {{ envoi() ? 'Envoi…' : 'Enregistrer' }}
          </button>
          <button type="button" class="bouton-discret" (click)="ouvert.set(false)">Annuler</button>
        </div>
      }
    </app-dialogue>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h2 { margin: var(--pas-3, 24px) 0 var(--pas); }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .titre-section { display: flex; justify-content: space-between; align-items: center; gap: var(--pas); flex-wrap: wrap; }
    .grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0 var(--pas-2); }
    .qui { margin: 0; min-height: 44px; display: flex; align-items: center; font-weight: 700; }
    fieldset { border: 1px solid var(--trait); border-radius: var(--r-s); margin: var(--pas-2) 0; padding: var(--pas) var(--pas-2); }
    legend { font-weight: 700; padding: 0 var(--pas); }
    .types { display: flex; gap: var(--pas); flex-wrap: wrap; }
    .types .actif { background: var(--profond); color: #fff; border-color: var(--profond); font-weight: 700; }
    .lignes-cartes { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas); }
    .pret { display: flex; justify-content: space-between; align-items: center; gap: var(--pas); flex-wrap: wrap;
            padding: var(--pas) var(--pas-2); }
    .pret.moi { border-left: 4px solid var(--accent); }
    .quoi { flex: 1 1 16rem; display: flex; flex-direction: column; gap: 2px; }
    .nom { font-weight: 700; }
    .equipements { margin: 0; padding-left: 1.25rem; }
    .badge.retard { align-self: flex-start; background: #FEE2E2; color: #B91C1C; border-radius: var(--r-s);
                    padding: 2px 8px; font-size: .8125rem; font-weight: 700; }
    .choix { list-style: none; margin: var(--pas) 0 0; padding: 0; display: grid; gap: 0 var(--pas-2);
             grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); max-height: 50vh; overflow-y: auto; }
    .case { display: flex; align-items: center; gap: var(--pas); font-weight: 400; min-height: 44px; margin: 0; }
    .case input { width: auto; flex: none; }
    .desinfection { font-weight: 700; }
    .danger { color: #B91C1C; border-color: #FCA5A5; }
  `]
})
export class SejourMaterielComponent implements OnInit {
  port = input.required<PortPrets>();

  readonly types = TYPES;
  readonly nomComplet = nomComplet;

  vue = signal<PretsSejourVue | null>(null);
  message = signal<string | null>(null);
  erreur = signal<string | null>(null);
  envoi = signal(false);

  ouvert = signal(false);
  participantId: number | null = null;
  datePret = dateDuJour();
  desinfecte = false;
  type = signal<TypeEquipement | null>(null);
  recherche = signal('');
  choisis = signal<number[]>([]);

  readonly affiches = computed(() => filtrerDisponibles(this.vue()?.disponibles ?? [], this.type(), this.recherche()));
  readonly avecDetendeur = computed(() => contientUnDetendeur(this.choisis(), this.vue()?.disponibles ?? []));

  ngOnInit(): void {
    this.port().lire().subscribe({
      next: v => this.vue.set(v),
      error: (e: HttpErrorResponse) => this.message.set(e.error?.detail ?? 'Le matériel n’a pas pu être lu (réseau nécessaire).')
    });
  }

  /** « Depuis le 12/06, retour prévu le 15/06 » ou « Du 12/06 au 14/06 (rendu) ». */
  quand(p: PretSejourVue): string {
    if (p.dateRetour) return `Du ${dateFr(p.datePret)} au ${dateFr(p.dateRetour)} (rendu)`;
    return `Depuis le ${dateFr(p.datePret)}` + (p.dateRetourPrevue ? `, retour prévu le ${dateFr(p.dateRetourPrevue)}` : '');
  }

  ouvrir(): void {
    const v = this.vue();
    if (!v) return;
    this.erreur.set(null);
    this.participantId = v.droits.pourLesAutres
      ? (v.participants.find(p => p.id === v.droits.moiId) ?? v.participants[0])?.id ?? null
      : v.participants[0]?.id ?? null;
    this.datePret = dateDuJour();
    this.desinfecte = false;
    this.type.set(null);
    this.recherche.set('');
    this.choisis.set([]);
    this.ouvert.set(true);
  }

  basculer(id: number): void {
    const liste = this.choisis();
    this.choisis.set(liste.includes(id) ? liste.filter(x => x !== id) : [...liste, id]);
  }

  declarer(): void {
    if (this.participantId === null || !this.datePret || this.choisis().length === 0) {
      this.erreur.set('Indiquez qui a emprunté, le jour, et cochez le matériel.');
      return;
    }
    this.ecrire(this.port().declarer({
      participantId: this.participantId, datePret: this.datePret, equipementIds: this.choisis(),
      detendeursDesinfectes: this.desinfecte
    }), () => this.ouvert.set(false));
  }

  annuler(p: PretSejourVue): void {
    const quoi = p.equipements.map(e => e.reference).join(', ');
    if (!confirm(`Annuler la déclaration de ${quoi} (${p.emprunteur}) ? Seulement si elle a été faite par erreur.`)) return;
    this.ecrire(this.port().annuler(p.id));
  }

  private ecrire(appel: Observable<PretsSejourVue>, ensuite?: () => void): void {
    this.envoi.set(true);
    this.erreur.set(null);
    this.message.set(null);
    appel.subscribe({
      next: v => {
        this.envoi.set(false);
        this.vue.set(v);
        ensuite?.();
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        const texte = e.error?.detail ?? "L'enregistrement n'a pas abouti (réseau nécessaire).";
        this.erreur.set(texte);
        if (!this.ouvert()) this.message.set(texte);
      }
    });
  }
}
