import { Component, ChangeDetectionStrategy, OnInit, computed, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { DialogueComponent } from '../../core/dialogue.component';
import { REPAS, Repas, joursDuSejour } from './liste-courses';
import { euros, jourLong } from './sejour-api';
import {
  MenuVue, MenusVue, PROMPT_MENU, PortMenus, parCategorie, repasDuJour, texteDeLaCommande, totalDuChoix
} from './menus-restaurant';

/** Pour qui on choisit dans la fenêtre : soi-même ou, pour un organisateur, un autre participant. */
interface ChoixEnCours {
  menu: MenuVue;
  participantId: number;
  /** Null : soi-même. */
  pour: string | null;
}

/**
 * L'onglet « Restaurant » du séjour (demande du club, 2026), dans l'appli et
 * sur la page du lien : les menus des restaurants, où chacun choisit ses
 * plats. Les organisateurs importent le classeur Excel d'un menu (fabriqué
 * par une IA avec le prompt donné ici), choisissent pour un participant sans
 * compte et lisent la commande complète, à copier pour le restaurant.
 * Réseau obligatoire.
 */
@Component({
  selector: 'app-sejour-restaurant',
  imports: [FormsModule, DialogueComponent],
  template: `
    <div class="titre-section">
      <h2>Restaurant</h2>
      @if (gere()) {
        <button type="button" class="bouton-principal importer-menu" (click)="ouvrirImport()">Importer un menu</button>
      }
    </div>
    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (vue(); as v) {
      @if (v.menus.length === 0) {
        <p class="vide">
          @if (gere()) {
            Aucun menu pour l'instant. « Importer un menu » : le fichier Excel du menu d'un restaurant, que chacun
            pourra choisir à l'avance.
          } @else {
            Aucun menu de restaurant à choisir pour l'instant.
          }
        </p>
      }
      @for (m of v.menus; track m.id) {
        <section class="carte menu" [attr.aria-label]="titre(m)">
          <div class="titre-section">
            <h3>{{ titre(m) }}</h3>
            @if (gere()) {
              <div class="actions">
                <button type="button" class="bouton-discret" (click)="ouvrirImport(m)">Remplacer</button>
                <button type="button" class="bouton-discret" (click)="aSupprimer.set(m)">Supprimer</button>
              </div>
            }
          </div>

          @if (v.participantId !== null) {
            <div class="mon-choix">
              @if (m.monChoix.length === 0) {
                <span class="etiquette-etat attention">Pas encore choisi</span>
              } @else {
                <p><strong>Mon choix :</strong> {{ noms(m, m.monChoix) }}@if (totalDuChoix(m.plats, m.monChoix) > 0) {
                  ({{ euros(totalDuChoix(m.plats, m.monChoix)) }})}</p>
              }
              <button type="button" class="bouton-principal choisir-plats" (click)="ouvrirChoix(m, v.participantId, null)">
                {{ m.monChoix.length === 0 ? 'Choisir mes plats' : 'Modifier mon choix' }}
              </button>
            </div>
          } @else {
            <details>
              <summary>Voir le menu ({{ m.plats.length }} plats)</summary>
              @for (g of parCategorie(m.plats); track g.categorie) {
                <h4>{{ g.categorie }}</h4>
                <ul class="plats">
                  @for (p of g.plats; track p.id) { <li>{{ p.nom }}@if (p.prixCentimes !== null) { — {{ euros(p.prixCentimes) }}}</li> }
                </ul>
              }
            </details>
          }

          @if (gere() && m.commande; as c) {
            <div class="commande">
              <div class="titre-section">
                <h4>Commande complète</h4>
                @if (c.participants.length > 0) {
                  <button type="button" class="bouton-discret copier-commande" (click)="copier(m)">Copier la commande</button>
                }
              </div>
              @if (c.participants.length === 0) {
                <p class="secondaire">Personne n'a encore choisi.</p>
              } @else {
                <ul class="plats">
                  @for (g of parCategorie(commandes(m)); track g.categorie) {
                    @for (p of g.plats; track p.id) {
                      <li><strong>{{ nombre(m, p.id) }} ×</strong> {{ p.nom }} <span class="secondaire">({{ g.categorie }})</span></li>
                    }
                  }
                </ul>
                @if (c.totalCentimes > 0) { <p><strong>Total : {{ euros(c.totalCentimes) }}</strong></p> }
              }
              <h4>Par personne</h4>
              <ul class="personnes">
                @for (p of c.participants; track p.participantId) {
                  <li>
                    <span><strong>{{ p.prenom }} {{ p.nom }}</strong> : {{ noms(m, p.platIds) }}@if (p.totalCentimes > 0) {
                      ({{ euros(p.totalCentimes) }})}</span>
                    <button type="button" class="bouton-discret" (click)="ouvrirChoix(m, p.participantId, p.prenom + ' ' + p.nom)">
                      Modifier</button>
                  </li>
                }
                @for (p of c.sansChoix; track p.participantId) {
                  <li>
                    <span><strong>{{ p.prenom }} {{ p.nom }}</strong> : <span class="secondaire">pas encore choisi</span></span>
                    <button type="button" class="bouton-discret" (click)="ouvrirChoix(m, p.participantId, p.prenom + ' ' + p.nom)">
                      Choisir pour {{ p.prenom }}</button>
                  </li>
                }
              </ul>
            </div>
          }
        </section>
      }
    } @else if (!message()) {
      <p class="vide">Chargement…</p>
    }

    <!-- Choisir ses plats (ou ceux d'un participant, pour un organisateur) -->
    <app-dialogue [ouvert]="choix() !== null" [large]="true" [erreur]="erreur()"
                  [titre]="choix()?.pour ? 'Choix de ' + choix()!.pour : 'Mon choix'" (fermer)="choix.set(null)">
      @if (choix(); as c) {
        <p class="secondaire">{{ titre(c.menu) }}. Cochez ce que vous voulez ; vous pourrez changer d'avis tant que
          l'organisateur n'a pas passé la commande.</p>
        @for (g of parCategorie(c.menu.plats); track g.categorie) {
          <fieldset>
            <legend>{{ g.categorie }}</legend>
            @for (p of g.plats; track p.id) {
              <label class="case">
                <input type="checkbox" [checked]="coches().has(p.id)" (change)="cocher(p.id)">
                <span>
                  <strong>{{ p.nom }}</strong>@if (p.prixCentimes !== null) { — {{ euros(p.prixCentimes) }}}
                  @if (p.description) { <br><span class="secondaire">{{ p.description }}</span> }
                </span>
              </label>
            }
          </fieldset>
        }
        @if (totalDuChoix(c.menu.plats, [...coches()]) > 0) {
          <p><strong>Total : {{ euros(totalDuChoix(c.menu.plats, [...coches()])) }}</strong></p>
        }
        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" (click)="enregistrerChoix()" [disabled]="envoi()">
            {{ envoi() ? 'Envoi…' : 'Enregistrer' }}
          </button>
          <button type="button" class="bouton-discret" (click)="choix.set(null)">Annuler</button>
        </div>
      }
    </app-dialogue>

    <!-- Importer le menu d'un repas (organisateurs) -->
    <app-dialogue [ouvert]="importOuvert()" [large]="true" [erreur]="erreur()" titre="Importer un menu"
                  (fermer)="importOuvert.set(false)">
      @if (importOuvert()) {
        <form class="dialogue-formulaire" (ngSubmit)="importer()">
          <details class="prompt">
            <summary>Comment fabriquer le fichier ?</summary>
            <p>Prenez le menu en photo (ou son PDF), puis donnez-le à une IA (ChatGPT, Claude, Le Chat…) avec le texte
              ci-dessous : elle vous rend le fichier Excel à importer ici. Relisez-le avant : l'IA peut se tromper.</p>
            <textarea readonly rows="8" aria-label="Prompt à donner à l'IA">{{ PROMPT_MENU }}</textarea>
            <button type="button" class="bouton-discret copier-prompt" (click)="copierPrompt()">
              {{ promptCopie() ? 'Texte copié' : 'Copier le texte' }}</button>
          </details>
          <label for="menu-jour">Jour</label>
          <select id="menu-jour" name="jour" [(ngModel)]="jour" required>
            @for (j of jours(); track j) { <option [value]="j">{{ jourLong(j) }}</option> }
          </select>
          <label for="menu-repas">Repas</label>
          <select id="menu-repas" name="repas" [(ngModel)]="repas" required>
            @for (r of REPAS; track r.code) { <option [value]="r.code">{{ r.libelle }}</option> }
          </select>
          <label for="menu-restaurant">Restaurant</label>
          <input id="menu-restaurant" name="restaurant" [(ngModel)]="restaurant" maxlength="200"
                 placeholder="Le nom du restaurant">
          <label for="menu-fichier">Fichier Excel du menu (.xlsx ou .xls)</label>
          <input id="menu-fichier" name="fichier" type="file"
                 accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                 (change)="fichier = $any($event.target).files?.[0] ?? null">
          @if (dejaChoisis(); as n) {
            <p class="alerte">Ce repas a déjà un menu : le remplacer efface le choix de {{ n }} {{ n > 1 ? 'personnes' : 'personne' }}.</p>
          } @else if (menuExistant()) {
            <p class="secondaire">Ce repas a déjà un menu : il sera remplacé.</p>
          }
          <p class="secondaire">Le repas comptera comme pris au restaurant dans la liste de courses.</p>
          <div class="actions-dialogue">
            <button type="submit" class="bouton-principal" [disabled]="envoi()">{{ envoi() ? 'Envoi…' : 'Importer' }}</button>
            <button type="button" class="bouton-discret" (click)="importOuvert.set(false)">Annuler</button>
          </div>
        </form>
      }
    </app-dialogue>

    <app-dialogue [ouvert]="aSupprimer() !== null" [erreur]="erreur()" titre="Supprimer le menu ?"
                  (fermer)="aSupprimer.set(null)">
      @if (aSupprimer(); as m) {
        <p>{{ titre(m) }} : le menu et les choix de chacun seront effacés. Le repas reste pris au restaurant dans la liste
          de courses.</p>
        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" (click)="supprimer(m)" [disabled]="envoi()">Supprimer</button>
          <button type="button" class="bouton-discret" (click)="aSupprimer.set(null)">Annuler</button>
        </div>
      }
    </app-dialogue>
  `,
  styles: [`
    .menu { margin-bottom: var(--pas-2); }
    .menu h3 { margin: 0; }
    .actions, .mon-choix { display: flex; gap: var(--pas); flex-wrap: wrap; align-items: center; }
    .mon-choix { justify-content: space-between; margin: var(--pas) 0; }
    .mon-choix p { margin: 0; }
    .commande { border-top: 1px solid var(--trait); margin-top: var(--pas-2); padding-top: var(--pas); }
    .plats, .personnes { list-style: none; margin: 0; padding: 0; }
    .plats li { padding: calc(var(--pas) / 2) 0; }
    .personnes li { display: flex; justify-content: space-between; align-items: center; gap: var(--pas);
                    flex-wrap: wrap; min-height: 44px; border-bottom: 1px solid var(--trait); }
    fieldset { border: none; padding: 0; margin: 0 0 var(--pas-2); }
    legend { font-weight: 700; margin-bottom: var(--pas); }
    .case { display: flex; align-items: center; gap: var(--pas); font-weight: 400; min-height: 44px; margin: 0; }
    .case input { width: auto; flex: none; min-width: 24px; min-height: 24px; }
    .prompt textarea { width: 100%; font-size: .875rem; }
    .prompt { margin-bottom: var(--pas-2); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SejourRestaurantComponent implements OnInit {
  port = input.required<PortMenus>();
  dateDebut = input.required<string>();
  dateFin = input.required<string>();
  /** « Voir comme un participant » : sans import ni commande complète, même pour un organisateur. */
  vueParticipant = input(false);

  readonly REPAS = REPAS;
  readonly PROMPT_MENU = PROMPT_MENU;
  readonly jourLong = jourLong;
  readonly euros = euros;
  readonly parCategorie = parCategorie;
  readonly totalDuChoix = totalDuChoix;

  vue = signal<MenusVue | null>(null);
  message = signal<string | null>(null);
  erreur = signal<string | null>(null);
  envoi = signal(false);

  choix = signal<ChoixEnCours | null>(null);
  coches = signal<Set<number>>(new Set());

  importOuvert = signal(false);
  aSupprimer = signal<MenuVue | null>(null);
  promptCopie = signal(false);
  jour = '';
  repas: Repas = 'DINER';
  restaurant = '';
  fichier: File | null = null;

  /** Organisateur (dit par le serveur, qui revérifie chaque écriture). */
  readonly gere = computed(() => !!this.vue()?.gere && !this.vueParticipant());

  readonly jours = computed(() => joursDuSejour(this.dateDebut(), this.dateFin()));

  ngOnInit(): void {
    this.port().lire().subscribe({
      next: v => this.vue.set(v),
      error: () => this.message.set('Les menus du séjour n’ont pas pu être lus. Vérifiez le réseau.')
    });
  }

  titre(m: MenuVue): string {
    return m.restaurant ? `${repasDuJour(m)} — ${m.restaurant}` : repasDuJour(m);
  }

  noms(m: MenuVue, platIds: number[]): string {
    return m.plats.filter(p => platIds.includes(p.id)).map(p => p.nom).join(', ');
  }

  /** Les plats commandés au moins une fois, dans l'ordre du menu. */
  commandes(m: MenuVue): MenuVue['plats'] {
    const ids = new Set(m.commande?.plats.map(l => l.platId));
    return m.plats.filter(p => ids.has(p.id));
  }

  nombre(m: MenuVue, platId: number): number {
    return m.commande?.plats.find(l => l.platId === platId)?.nombre ?? 0;
  }

  // -- Choix ---------------------------------------------------------

  ouvrirChoix(menu: MenuVue, participantId: number, pour: string | null): void {
    const deja = pour === null ? menu.monChoix
      : menu.commande?.participants.find(p => p.participantId === participantId)?.platIds ?? [];
    this.erreur.set(null);
    this.coches.set(new Set(deja));
    this.choix.set({ menu, participantId, pour });
  }

  cocher(platId: number): void {
    const s = new Set(this.coches());
    if (s.has(platId)) s.delete(platId); else s.add(platId);
    this.coches.set(s);
  }

  enregistrerChoix(): void {
    const c = this.choix();
    if (!c) return;
    const platIds = c.menu.plats.map(p => p.id).filter(id => this.coches().has(id));
    this.envoyer(this.port().choisir(c.menu.id, c.participantId, platIds), () => {
      this.choix.set(null);
      this.message.set(c.pour ? `Le choix de ${c.pour} est enregistré.` : 'Votre choix est enregistré. Bon appétit !');
    });
  }

  // -- Import et suppression (organisateurs) -------------------------

  /** Le menu déjà importé pour le jour et le repas choisis dans la fenêtre. */
  menuExistant(): MenuVue | undefined {
    return this.vue()?.menus.find(m => m.jour === this.jour && m.repas === this.repas);
  }

  /** Le nombre de personnes dont le remplacement effacerait le choix (0 : rien à perdre). */
  dejaChoisis(): number {
    return this.menuExistant()?.commande?.participants.length ?? 0;
  }

  ouvrirImport(menu?: MenuVue): void {
    this.erreur.set(null);
    this.jour = menu?.jour ?? this.jours()[0] ?? '';
    this.repas = menu?.repas ?? 'DINER';
    this.restaurant = menu?.restaurant ?? '';
    this.fichier = null;
    this.promptCopie.set(false);
    this.importOuvert.set(true);
  }

  importer(): void {
    if (!this.fichier) {
      this.erreur.set('Choisissez le fichier Excel du menu.');
      return;
    }
    this.envoyer(this.port().importer(this.jour, this.repas, this.restaurant.trim(), this.fichier), v => {
      this.importOuvert.set(false);
      const m = v.menus.find(x => x.jour === this.jour && x.repas === this.repas);
      this.message.set(m ? `Menu importé : ${m.plats.length} plats. Relisez-le, puis prévenez les participants.` : 'Menu importé.');
    });
  }

  supprimer(m: MenuVue): void {
    this.envoyer(this.port().supprimer(m.id), () => {
      this.aSupprimer.set(null);
      this.message.set('Le menu est supprimé.');
    });
  }

  private envoyer(appel: Observable<MenusVue>, ensuite: (v: MenusVue) => void): void {
    this.envoi.set(true);
    this.erreur.set(null);
    appel.subscribe({
      next: v => {
        this.envoi.set(false);
        this.vue.set(v);
        ensuite(v);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.erreur.set(e.error?.detail ?? 'L’enregistrement a échoué. Vérifiez le réseau.');
      }
    });
  }

  // -- Copier --------------------------------------------------------

  copier(m: MenuVue): void {
    navigator.clipboard.writeText(texteDeLaCommande(m)).then(
      () => this.message.set('Commande copiée : collez-la dans un message pour le restaurant.'),
      () => this.message.set('La copie n’a pas marché sur cet appareil.'));
  }

  copierPrompt(): void {
    navigator.clipboard.writeText(PROMPT_MENU).then(
      () => this.promptCopie.set(true),
      () => this.erreur.set('La copie n’a pas marché : sélectionnez le texte à la main.'));
  }
}
