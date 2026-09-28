import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import {
  EquipementVue, LIBELLES_STATUT_EQUIPEMENT, StatutEquipement, TYPES_EQUIPEMENT, TypeEquipement
} from '../../core/modeles';
import { DateFrPipe } from '../../core/date-fr';
import { normaliser } from '../../core/seance-lieu';
import { descriptionEquipement, prochaineEcheance } from './materiel';

/**
 * Inventaire du matériel du club : état de chaque équipement, calculé par
 * le serveur (échéances TIV, requalification, révision, prêts en cours).
 */
@Component({
  selector: 'app-inventaire',
  imports: [FormsModule, RouterLink, DateFrPipe],
  template: `
    <div class="entete">
      <div>
        <h1>Matériel</h1>
        <p class="secondaire">
          Blocs, détendeurs, gilets et combinaisons du club. Chaque fiche tient lieu de fiche de gestion
          (Code du sport, annexe III-27) : à conserver trois ans après la mise au rebut.
        </p>
      </div>
      <div class="actions">
        <a routerLink="/materiel/prets" class="bouton-principal">Prêts</a>
        <a routerLink="/materiel/nouveau" class="bouton-discret">Ajouter un équipement</a>
      </div>
    </div>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else {
      <div class="compteurs">
        @for (c of compteurs(); track c.statut) {
          <button type="button" class="compteur" [class]="'compteur statut-' + c.statut"
                  [class.choisi]="statut() === c.statut" (click)="basculerStatut(c.statut)">
            <span class="nombre">{{ c.nombre }}</span>
            <span>{{ c.libelle }}</span>
          </button>
        }
      </div>

      @if (aSurveiller().length > 0) {
        <section class="carte surveiller">
          <h2>À surveiller</h2>
          <ul>
            @for (e of aSurveiller(); track e.id) {
              <li>
                <a [routerLink]="['/materiel', e.id]">{{ e.typeLibelle }} {{ e.reference }}</a>
                @for (a of e.alertes; track a.message) {
                  <span [class.bloquant]="a.gravite === 'BLOQUANT'"> {{ a.message }}</span>
                }
              </li>
            }
          </ul>
        </section>
      }

      <div class="filtres">
        <div class="types" role="group" aria-label="Type de matériel">
          <button type="button" class="bouton-discret" [class.actif]="type() === null" (click)="type.set(null)">
            Tout
          </button>
          @for (t of types; track t.valeur) {
            <button type="button" class="bouton-discret" [class.actif]="type() === t.valeur" (click)="type.set(t.valeur)">
              {{ t.pluriel }}
            </button>
          }
        </div>
        <label for="recherche" class="masque">Rechercher</label>
        <input id="recherche" type="search" placeholder="Référence, marque, n° de série…"
               [ngModel]="recherche()" (ngModelChange)="recherche.set($event)">
        <label class="case">
          <input type="checkbox" [ngModel]="avecRebut()" (ngModelChange)="avecRebut.set($event)">
          Afficher le matériel au rebut
        </label>
      </div>

      @if (filtres().length === 0) {
        <div class="carte vide">
          <p>{{ liste().length === 0 ? 'Aucun équipement enregistré.' : 'Aucun équipement ne correspond.' }}</p>
        </div>
      } @else {
        <ul class="liste">
          @for (e of filtres(); track e.id) {
            <li class="carte">
              <a [routerLink]="['/materiel', e.id]" class="equipement">
                <div class="ligne">
                  <div class="identite">
                    <span class="nom">{{ e.typeLibelle }} {{ e.reference }}</span>
                    @if (description(e); as d) { <span class="secondaire">{{ d }}</span> }
                  </div>
                  <span [class]="'etat statut-' + e.statut">{{ libelleStatut[e.statut] }}</span>
                </div>
                @if (e.pretEnCours; as p) {
                  <span class="secondaire">
                    Prêté à {{ p.emprunteur }}@if (p.dateRetourPrevue) {, retour prévu le {{ p.dateRetourPrevue | dateFr }}}
                  </span>
                }
                @if (echeance(e); as ec) {
                  <span class="secondaire">{{ ec.libelle }} : {{ ec.date | dateFr }}</span>
                }
              </a>
            </li>
          }
        </ul>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .entete { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas-2); flex-wrap: wrap; }
    .entete h1 { margin-bottom: var(--pas); }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; }
    .actions a { display: inline-flex; align-items: center; text-decoration: none; }
    .actions .bouton-discret { color: var(--encre); }

    .compteurs { display: flex; gap: var(--pas); flex-wrap: wrap; margin: var(--pas-2) 0; }
    .compteur {
      display: flex; align-items: baseline; gap: 6px; min-height: 44px; padding: var(--pas) var(--pas-2);
      background: var(--carte); border: 1px solid var(--trait); border-radius: var(--r-s);
    }
    .compteur.choisi { outline: 3px solid var(--profond); outline-offset: 1px; }
    .compteur .nombre { font-family: var(--font-titres); font-weight: 700; font-size: 1.125rem; }

    .surveiller { padding: var(--pas-2); margin-bottom: var(--pas-2); border-left: 4px solid var(--en-cours); }
    .surveiller h2 { margin-bottom: var(--pas); }
    .surveiller ul { margin: 0; padding-left: 1.25rem; display: grid; gap: 4px; }
    .surveiller a { font-weight: 700; }
    .bloquant { color: #B91C1C; font-weight: 700; }

    .filtres { display: grid; gap: var(--pas); margin-bottom: var(--pas-2); }
    .types { display: flex; gap: var(--pas); flex-wrap: wrap; }
    .types .actif { background: var(--profond); color: #fff; border-color: var(--profond); font-weight: 700; }
    .masque { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .case { display: flex; align-items: center; gap: var(--pas); min-height: 44px; }
    .case input { width: auto; }

    .liste { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2);
             grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
    .equipement {
      display: flex; flex-direction: column; gap: 4px; padding: var(--pas-2); min-height: 44px;
      color: inherit; text-decoration: none;
    }
    .ligne { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas); }
    .identite { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .nom { font-weight: 700; }
    .etat { flex: none; padding: 2px 10px; border-radius: var(--r-s); font-size: .8125rem; font-weight: 700; }
    .statut-DISPONIBLE { background: var(--acquis-clair); color: var(--acquis); }
    .statut-PRETE { background: #E0F2FE; color: var(--profond-fonce); }
    .statut-A_REGULARISER { background: #FEE2E2; color: #B91C1C; }
    .statut-HORS_SERVICE { background: var(--en-cours-clair); color: var(--en-cours); }
    .statut-REBUTE { background: #EEF2F4; color: var(--craie); }
    .compteur[class*="statut-"] { background: var(--carte); color: var(--encre); }
    .compteur.statut-A_REGULARISER .nombre { color: #B91C1C; }
    .compteur.statut-HORS_SERVICE .nombre { color: var(--en-cours); }
    .compteur.statut-DISPONIBLE .nombre { color: var(--acquis); }

    @media (max-width: 600px) {
      .liste { grid-template-columns: 1fr; }
    }
  `]
})
export class InventaireComponent {
  private api = inject(ApiService);

  readonly types = TYPES_EQUIPEMENT;
  readonly libelleStatut = LIBELLES_STATUT_EQUIPEMENT;
  readonly description = descriptionEquipement;
  readonly echeance = prochaineEcheance;

  liste = signal<EquipementVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);

  type = signal<TypeEquipement | null>(null);
  statut = signal<StatutEquipement | null>(null);
  recherche = signal('');
  avecRebut = signal(false);

  /** Hors rebut : le matériel au rebut ne se compte plus, sauf à le demander. */
  private enService = computed(() => this.liste().filter(e => this.avecRebut() || e.statut !== 'REBUTE'));

  compteurs = computed(() => {
    const ordre: StatutEquipement[] = ['DISPONIBLE', 'PRETE', 'A_REGULARISER', 'HORS_SERVICE', 'REBUTE'];
    const duType = this.enService().filter(e => this.type() === null || e.type === this.type());
    return ordre
      .map(statut => ({ statut, libelle: this.libelleStatut[statut], nombre: duType.filter(e => e.statut === statut).length }))
      .filter(c => c.nombre > 0 || c.statut === 'DISPONIBLE');
  });

  aSurveiller = computed(() => this.liste().filter(e => e.statut !== 'REBUTE' && e.alertes.length > 0));

  filtres = computed(() => {
    const r = normaliser(this.recherche().trim());
    return this.enService().filter(e =>
      (this.type() === null || e.type === this.type())
      && (this.statut() === null || e.statut === this.statut())
      && (!r || [e.reference, e.marque, e.modele, e.numeroSerie, e.taille]
        .some(v => v != null && normaliser(v).includes(r))));
  });

  constructor() {
    void this.charger();
  }

  basculerStatut(s: StatutEquipement): void {
    this.statut.set(this.statut() === s ? null : s);
    if (s === 'REBUTE') this.avecRebut.set(true);
  }

  private async charger(): Promise<void> {
    this.chargement.set(true);
    try {
      this.liste.set(await firstValueFrom(this.api.equipements()));
    } catch {
      this.message.set("Impossible de charger l'inventaire du matériel.");
    } finally {
      this.chargement.set(false);
    }
  }
}
