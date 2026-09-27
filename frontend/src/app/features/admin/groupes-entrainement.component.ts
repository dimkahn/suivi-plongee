import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ComboboxComponent, OptionCombobox } from '../../core/combobox.component';
import {
  DemandeEspaceBassin, EleveSaisonGroupeVue, EspaceBassinVue, GroupeEntrainementVue, MoniteurOptionVue, SaisonVue
} from '../../core/modeles';

/** Formulaire d'un groupe ; id null : nouveau groupe. */
interface FormulaireGroupe {
  id: number | null;
  nom: string;
  niveauPrepare: 'N1' | 'N2' | 'N3' | null;
  espaceAttitreId: number | null;
  encadrantIds: number[];
}

/** Formulaire d'un espace du bassin ; id null : nouvel espace. */
interface FormulaireEspace extends DemandeEspaceBassin {
  id: number | null;
}

/**
 * Groupes d'entraînement de la saison (Débutants, Perfect N1, Prépa N2...) :
 * composition, encadrants attitrés, ligne d'eau attitrée et rangement des
 * élèves. Les espaces du bassin (lignes d'eau, fosse) se décrivent en bas de
 * page. Le planning des soirées (qui est où, quel lundi) vient ensuite.
 */
@Component({
  selector: 'app-groupes-entrainement',
  imports: [FormsModule, NgTemplateOutlet, ComboboxComponent],
  template: `
    <h1>Groupes d'entraînement</h1>
    <p class="secondaire">
      Les groupes de la saison, leurs encadrants attitrés et leur ligne d'eau habituelle,
      puis les élèves rangés dans chacun.
    </p>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <label for="saison">Saison</label>
    <select id="saison" class="saison" [ngModel]="saisonId()" (ngModelChange)="choisirSaison($event)">
      @for (s of saisons(); track s.id) {
        <option [ngValue]="s.id">{{ s.libelle }}{{ s.ouverte ? ' (ouverte)' : '' }}</option>
      }
    </select>

    <h2>Groupes</h2>
    @if (chargement()) {
      <p class="secondaire">Chargement…</p>
    } @else {
      @if (groupes().length === 0 && !formulaire()) {
        <div class="carte vide"><p>Aucun groupe pour cette saison.</p></div>
      }
      <ul class="groupes">
        @for (g of groupes(); track g.id; let premier = $first, dernier = $last, i = $index) {
          <li class="carte groupe">
            @if (formulaire()?.id === g.id) {
              <ng-container *ngTemplateOutlet="formulaireGroupe" />
            } @else {
              <div class="entete-groupe">
                <span class="nom">{{ g.nom }}</span>
                <span class="secondaire">
                  {{ g.espaceAttitre ?? 'Sans ligne attitrée' }}
                  @if (g.niveauPrepare) { · prépare le {{ g.niveauPrepare }} }
                  · {{ g.eleves.length }} élève{{ g.eleves.length > 1 ? 's' : '' }}
                </span>
                <span class="encadrants">
                  @for (e of g.encadrants; track e.id) {
                    <span class="puce">{{ e.nomComplet }}{{ e.niveauEncadrement ? ' · ' + e.niveauEncadrement : '' }}</span>
                  } @empty {
                    <span class="secondaire">Aucun encadrant attitré</span>
                  }
                </span>
              </div>
              <div class="actions">
                <button type="button" class="bouton-discret" (click)="modifier(g)" [disabled]="formulaire() !== null">Modifier</button>
                <button type="button" class="bouton-discret" (click)="deplacer(i, -1)" [disabled]="premier || envoi()"
                        [attr.aria-label]="'Monter ' + g.nom">Monter</button>
                <button type="button" class="bouton-discret" (click)="deplacer(i, 1)" [disabled]="dernier || envoi()"
                        [attr.aria-label]="'Descendre ' + g.nom">Descendre</button>
                <button type="button" class="bouton-discret danger" (click)="supprimer(g)">Supprimer</button>
              </div>
            }
          </li>
        }
        @if (formulaire()?.id === null) {
          <li class="carte groupe"><ng-container *ngTemplateOutlet="formulaireGroupe" /></li>
        }
      </ul>
      @if (formulaire() === null) {
        <button type="button" class="bouton-discret" (click)="nouveau()" [disabled]="saisonId() === null">
          Nouveau groupe
        </button>
      }

      <h2>Élèves de la saison</h2>
      <p class="secondaire">
        Les élèves inscrits en formation ou adhérents sur la saison. La suggestion vient du niveau que
        prépare le groupe (Débutants → N1…) ; un adhérent sans formation se range à la main.
      </p>
      <div class="barre-eleves">
        <label class="case">
          <input type="checkbox" [ngModel]="sansGroupeSeulement()" (ngModelChange)="sansGroupeSeulement.set($event)">
          Seulement les élèves sans groupe ({{ nombreSansGroupe() }})
        </label>
        @if (nombreSuggestions() > 0) {
          <button type="button" class="bouton-discret" (click)="appliquerSuggestions()" [disabled]="envoi()">
            Ranger les {{ nombreSuggestions() }} élèves sans groupe selon leur formation
          </button>
        }
      </div>
      @if (elevesAffiches().length === 0) {
        <div class="carte vide"><p>Aucun élève à afficher.</p></div>
      }
      <ul class="eleves">
        @for (e of elevesAffiches(); track e.eleveId) {
          <li class="carte eleve">
            <div class="identite">
              <span class="nom">{{ e.prenom }} {{ e.nom }}</span>
              <span class="secondaire">
                @if (e.niveauxEnCours.length > 0) { Prépare {{ e.niveauxEnCours.join(', ') }} }
                @else if (e.adhesionSeule) { Adhérent sans formation }
                @else { Formation terminée cette saison }
                @if (e.groupeSuggereId && e.groupeSuggereId !== e.groupeId) {
                  · suggéré : {{ nomGroupe(e.groupeSuggereId) }}
                }
              </span>
            </div>
            <select [attr.aria-label]="'Groupe de ' + e.prenom + ' ' + e.nom" [ngModel]="e.groupeId"
                    (ngModelChange)="ranger(e, $event)" [disabled]="rangementEnCours() === e.eleveId">
              <option [ngValue]="null">— Aucun groupe —</option>
              @for (g of groupes(); track g.id) { <option [ngValue]="g.id">{{ g.nom }}</option> }
            </select>
          </li>
        }
      </ul>

      <details class="bassin">
        <summary>Bassin : lignes d'eau et fosse</summary>
        <p class="secondaire">
          Les endroits où placer un groupe. La capacité (plongeurs, encadrants compris) et la profondeur
          servent aux avertissements du planning. Un espace désactivé n'est plus proposé.
        </p>
        <ul class="espaces">
          @for (e of espaces(); track e.id) {
            <li class="carte espace">
              @if (formulaireEspace()?.id === e.id) {
                <ng-container *ngTemplateOutlet="formulaireBassin" />
              } @else {
                <div class="identite">
                  <span class="nom">{{ e.nom }}{{ e.actif ? '' : ' (désactivé)' }}</span>
                  <span class="secondaire">
                    {{ e.type === 'FOSSE' ? 'Fosse' : "Ligne d'eau" }}
                    @if (e.profondeurMax) { · {{ e.profondeurMax }} m }
                    @if (e.capacite) { · {{ e.capacite }} plongeurs max. }
                  </span>
                </div>
                <div class="actions">
                  <button type="button" class="bouton-discret" (click)="modifierEspace(e)"
                          [disabled]="formulaireEspace() !== null">Modifier</button>
                  <button type="button" class="bouton-discret danger" (click)="supprimerEspace(e)">Supprimer</button>
                </div>
              }
            </li>
          }
          @if (formulaireEspace()?.id === null) {
            <li class="carte espace"><ng-container *ngTemplateOutlet="formulaireBassin" /></li>
          }
        </ul>
        @if (formulaireEspace() === null) {
          <button type="button" class="bouton-discret" (click)="nouvelEspace()">Ajouter un espace</button>
        }
      </details>
    }

    <ng-template #formulaireGroupe>
      @if (formulaire(); as f) {
        <div class="formulaire">
          <label for="nom-groupe">Nom du groupe</label>
          <input id="nom-groupe" type="text" [(ngModel)]="f.nom" placeholder="ex. Prépa N2">

          <label for="espace-groupe">Ligne d'eau attitrée</label>
          <select id="espace-groupe" [(ngModel)]="f.espaceAttitreId">
            <option [ngValue]="null">Aucune</option>
            @for (e of espacesActifs(); track e.id) { <option [ngValue]="e.id">{{ e.nom }}</option> }
          </select>

          <label for="niveau-groupe">Niveau préparé</label>
          <select id="niveau-groupe" [(ngModel)]="f.niveauPrepare">
            <option [ngValue]="null">Aucun (perfectionnement, adhérents…)</option>
            <option ngValue="N1">N1</option>
            <option ngValue="N2">N2</option>
            <option ngValue="N3">N3</option>
          </select>

          <span class="etiquette">Encadrants attitrés</span>
          <div class="encadrants">
            @for (id of f.encadrantIds; track id) {
              <span class="puce">
                {{ nomMoniteur(id) }}
                <button type="button" class="retirer" [attr.aria-label]="'Retirer ' + nomMoniteur(id)"
                        (click)="retirerEncadrant(f, id)">×</button>
              </span>
            } @empty {
              <span class="secondaire">Aucun pour l'instant.</span>
            }
          </div>
          <label for="ajout-encadrant">Ajouter un encadrant</label>
          <app-combobox idChamp="ajout-encadrant" [options]="optionsEncadrants(f)" [valeur]="null"
                        (valeurChange)="ajouterEncadrant(f, $event)"
                        aide="Rechercher un moniteur…" texteVide="Aucun moniteur ne correspond." />

          <div class="actions">
            <button type="button" class="bouton-principal" (click)="enregistrer()" [disabled]="envoi()">
              {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
            <button type="button" class="bouton-discret" (click)="formulaire.set(null)">Annuler</button>
          </div>
        </div>
      }
    </ng-template>

    <ng-template #formulaireBassin>
      @if (formulaireEspace(); as f) {
        <div class="formulaire">
          <label for="nom-espace">Nom</label>
          <input id="nom-espace" type="text" [(ngModel)]="f.nom" placeholder="ex. Ligne 7">
          <label for="type-espace">Type</label>
          <select id="type-espace" [(ngModel)]="f.type">
            <option ngValue="LIGNE">Ligne d'eau</option>
            <option ngValue="FOSSE">Fosse</option>
          </select>
          <div class="deux-colonnes">
            <div>
              <label for="profondeur-espace">Profondeur max. (m)</label>
              <input id="profondeur-espace" type="number" min="0" [(ngModel)]="f.profondeurMax">
            </div>
            <div>
              <label for="capacite-espace">Capacité (plongeurs)</label>
              <input id="capacite-espace" type="number" min="1" [(ngModel)]="f.capacite">
            </div>
          </div>
          <label class="case">
            <input type="checkbox" [(ngModel)]="f.actif"> Proposé dans le planning
          </label>
          <div class="actions">
            <button type="button" class="bouton-principal" (click)="enregistrerEspace()" [disabled]="envoi()">
              {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
            <button type="button" class="bouton-discret" (click)="formulaireEspace.set(null)">Annuler</button>
          </div>
        </div>
      }
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    h2 { margin: var(--pas-4) 0 var(--pas); font-size: 1.125rem; }
    label, .etiquette { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .saison { max-width: 320px; }
    ul { list-style: none; margin: 0 0 var(--pas-2); padding: 0; display: grid; gap: var(--pas-2); }
    .groupe, .eleve, .espace { padding: var(--pas-2); }
    .entete-groupe, .identite { display: flex; flex-direction: column; gap: 2px; }
    .nom { font-weight: 700; }
    .encadrants { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
    .puce {
      display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: 999px;
      background: var(--fond); border: 1px solid var(--trait); font-size: .875rem;
    }
    .retirer {
      min-height: 32px; min-width: 32px; padding: 0; border: none; background: none;
      color: var(--craie); font-size: 1.125rem; cursor: pointer;
    }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }
    .actions .bouton-principal { width: auto; margin-top: 0; }
    .danger { color: #B3261E; border-color: #B3261E; }
    .formulaire input, .formulaire select { margin: 0; }
    .barre-eleves { display: flex; flex-wrap: wrap; gap: var(--pas-2); align-items: center; margin-bottom: var(--pas-2); }
    .case { display: flex; align-items: center; gap: var(--pas); min-height: 44px; margin: 0; font-weight: 400; }
    .case input { width: auto; }
    .eleve { display: flex; justify-content: space-between; align-items: center; gap: var(--pas-2); flex-wrap: wrap; }
    .eleve select { flex: 0 1 240px; margin: 0; }
    .bassin { margin-top: var(--pas-4); }
    .bassin summary { min-height: 44px; display: list-item; padding: 12px 0; font-weight: 700; cursor: pointer; }
    .deux-colonnes { display: grid; grid-template-columns: 1fr 1fr; gap: var(--pas-2); }
    .vide { padding: var(--pas-2); }
    .vide p { margin: 0; }
  `]
})
export class GroupesEntrainementComponent {
  private api = inject(ApiService);

  saisons = signal<SaisonVue[]>([]);
  saisonId = signal<number | null>(null);
  groupes = signal<GroupeEntrainementVue[]>([]);
  eleves = signal<EleveSaisonGroupeVue[]>([]);
  espaces = signal<EspaceBassinVue[]>([]);
  moniteurs = signal<MoniteurOptionVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  envoi = signal(false);
  rangementEnCours = signal<number | null>(null);
  formulaire = signal<FormulaireGroupe | null>(null);
  formulaireEspace = signal<FormulaireEspace | null>(null);
  sansGroupeSeulement = signal(false);

  espacesActifs = computed(() => this.espaces().filter(e => e.actif));
  nombreSansGroupe = computed(() => this.eleves().filter(e => e.groupeId === null).length);
  nombreSuggestions = computed(() => this.eleves().filter(e => e.groupeId === null && e.groupeSuggereId !== null).length);
  elevesAffiches = computed(() => this.sansGroupeSeulement()
    ? this.eleves().filter(e => e.groupeId === null) : this.eleves());

  constructor() {
    void this.chargerTout();
  }

  private async chargerTout(): Promise<void> {
    try {
      const [saisons, espaces, moniteurs] = await Promise.all([
        firstValueFrom(this.api.saisons()),
        firstValueFrom(this.api.espacesBassin()),
        this.api.moniteursActifs()
      ]);
      this.saisons.set(saisons);
      this.espaces.set(espaces);
      this.moniteurs.set(moniteurs);
      const ouverte = saisons.find(s => s.ouverte) ?? saisons[0];
      if (ouverte) await this.choisirSaison(ouverte.id);
    } catch {
      this.message.set("Impossible de charger les groupes d'entraînement.");
    } finally {
      this.chargement.set(false);
    }
  }

  async choisirSaison(id: number): Promise<void> {
    this.saisonId.set(id);
    this.formulaire.set(null);
    try {
      const [groupes, eleves] = await Promise.all([
        firstValueFrom(this.api.groupesEntrainement(id)),
        firstValueFrom(this.api.elevesSaisonGroupes(id))
      ]);
      if (this.saisonId() !== id) return;
      this.groupes.set(groupes);
      this.eleves.set(eleves);
    } catch {
      this.message.set('Impossible de charger cette saison.');
    }
  }

  nomGroupe(id: number | null): string {
    return this.groupes().find(g => g.id === id)?.nom ?? '';
  }

  nomMoniteur(id: number): string {
    const m = this.moniteurs().find(x => x.id === id);
    return m ? `${m.nomComplet}${m.niveauEncadrement ? ' · ' + m.niveauEncadrement : ''}` : 'Encadrant inactif';
  }

  /** Moniteurs actifs pas encore attitrés au groupe en cours d'édition. */
  optionsEncadrants(f: FormulaireGroupe): OptionCombobox[] {
    return this.moniteurs().filter(m => !f.encadrantIds.includes(m.id))
      .map(m => ({ id: m.id, libelle: m.nomComplet, detail: m.niveauEncadrement }));
  }

  ajouterEncadrant(f: FormulaireGroupe, id: number | null): void {
    if (id !== null && !f.encadrantIds.includes(id)) f.encadrantIds = [...f.encadrantIds, id];
  }

  retirerEncadrant(f: FormulaireGroupe, id: number): void {
    f.encadrantIds = f.encadrantIds.filter(x => x !== id);
  }

  nouveau(): void {
    this.message.set(null);
    this.formulaire.set({ id: null, nom: '', niveauPrepare: null, espaceAttitreId: null, encadrantIds: [] });
  }

  modifier(g: GroupeEntrainementVue): void {
    this.message.set(null);
    this.formulaire.set({
      id: g.id, nom: g.nom, niveauPrepare: g.niveauPrepare, espaceAttitreId: g.espaceAttitreId,
      encadrantIds: g.encadrants.map(e => e.id)
    });
  }

  enregistrer(): void {
    const f = this.formulaire();
    const saisonId = this.saisonId();
    if (!f || saisonId === null) return;
    if (!f.nom.trim()) {
      this.message.set('Le nom du groupe est obligatoire.');
      return;
    }
    const demande = {
      saisonId, nom: f.nom, niveauPrepare: f.niveauPrepare, espaceAttitreId: f.espaceAttitreId,
      encadrantIds: f.encadrantIds
    };
    this.envoi.set(true);
    this.message.set(null);
    const appel = f.id === null
      ? this.api.creerGroupeEntrainement(demande)
      : this.api.modifierGroupeEntrainement(f.id, demande);
    appel.subscribe({
      next: g => {
        this.envoi.set(false);
        this.formulaire.set(null);
        this.groupes.set(f.id === null ? [...this.groupes(), g] : this.groupes().map(x => x.id === g.id ? g : x));
        // Un nouveau niveau préparé change les suggestions des élèves.
        void this.rechargerEleves(saisonId);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "Le groupe n'a pas pu être enregistré.");
      }
    });
  }

  supprimer(g: GroupeEntrainementVue): void {
    const saisonId = this.saisonId();
    const avertissement = g.eleves.length > 0 ? ` Ses ${g.eleves.length} élèves n'auront plus de groupe.` : '';
    if (saisonId === null || !confirm(`Supprimer le groupe « ${g.nom} » ?${avertissement}`)) return;
    this.message.set(null);
    this.api.supprimerGroupeEntrainement(g.id).subscribe({
      next: () => {
        this.groupes.set(this.groupes().filter(x => x.id !== g.id));
        void this.rechargerEleves(saisonId);
      },
      error: (e: HttpErrorResponse) => this.message.set(e.error?.detail ?? "La suppression n'a pas pu être enregistrée.")
    });
  }

  deplacer(i: number, sens: -1 | 1): void {
    const saisonId = this.saisonId();
    if (saisonId === null) return;
    const liste = [...this.groupes()];
    [liste[i], liste[i + sens]] = [liste[i + sens], liste[i]];
    this.envoi.set(true);
    this.api.ordonnerGroupesEntrainement(saisonId, liste.map(g => g.id)).subscribe({
      next: groupes => { this.envoi.set(false); this.groupes.set(groupes); },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "L'ordre n'a pas pu être enregistré.");
      }
    });
  }

  ranger(e: EleveSaisonGroupeVue, groupeId: number | null): void {
    const saisonId = this.saisonId();
    if (saisonId === null) return;
    this.rangementEnCours.set(e.eleveId);
    this.message.set(null);
    this.api.rangerEleveGroupe(saisonId, e.eleveId, groupeId).subscribe({
      next: maj => {
        this.rangementEnCours.set(null);
        this.eleves.set(this.eleves().map(x => x.eleveId === maj.eleveId ? maj : x));
        void this.rechargerGroupes(saisonId);
      },
      error: (err: HttpErrorResponse) => {
        this.rangementEnCours.set(null);
        this.message.set(err.error?.detail ?? "Le rangement n'a pas pu être enregistré.");
        this.eleves.set([...this.eleves()]);
      }
    });
  }

  appliquerSuggestions(): void {
    const saisonId = this.saisonId();
    if (saisonId === null) return;
    this.envoi.set(true);
    this.api.appliquerSuggestionsGroupes(saisonId).subscribe({
      next: eleves => {
        this.envoi.set(false);
        this.eleves.set(eleves);
        void this.rechargerGroupes(saisonId);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "Les suggestions n'ont pas pu être appliquées.");
      }
    });
  }

  private async rechargerGroupes(saisonId: number): Promise<void> {
    const groupes = await firstValueFrom(this.api.groupesEntrainement(saisonId));
    if (this.saisonId() === saisonId) this.groupes.set(groupes);
  }

  private async rechargerEleves(saisonId: number): Promise<void> {
    const eleves = await firstValueFrom(this.api.elevesSaisonGroupes(saisonId));
    if (this.saisonId() === saisonId) this.eleves.set(eleves);
  }

  nouvelEspace(): void {
    this.message.set(null);
    const ordre = Math.max(0, ...this.espaces().map(e => e.ordre)) + 1;
    this.formulaireEspace.set({ id: null, nom: '', type: 'LIGNE', ordre, profondeurMax: null, capacite: null, actif: true });
  }

  modifierEspace(e: EspaceBassinVue): void {
    this.message.set(null);
    this.formulaireEspace.set({ ...e });
  }

  enregistrerEspace(): void {
    const f = this.formulaireEspace();
    if (!f) return;
    if (!f.nom.trim()) {
      this.message.set("Le nom de l'espace est obligatoire.");
      return;
    }
    const { id, ...demande } = f;
    this.envoi.set(true);
    const appel = id === null ? this.api.creerEspaceBassin(demande) : this.api.modifierEspaceBassin(id, demande);
    appel.subscribe({
      next: e => {
        this.envoi.set(false);
        this.formulaireEspace.set(null);
        this.espaces.set((id === null ? [...this.espaces(), e] : this.espaces().map(x => x.id === e.id ? e : x))
          .sort((a, b) => a.ordre - b.ordre || a.id - b.id));
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(err.error?.detail ?? "L'espace n'a pas pu être enregistré.");
      }
    });
  }

  supprimerEspace(e: EspaceBassinVue): void {
    if (!confirm(`Supprimer « ${e.nom} » ?`)) return;
    this.message.set(null);
    this.api.supprimerEspaceBassin(e.id).subscribe({
      next: () => this.espaces.set(this.espaces().filter(x => x.id !== e.id)),
      error: (err: HttpErrorResponse) => this.message.set(err.error?.detail ?? "La suppression n'a pas pu être enregistrée.")
    });
  }
}
