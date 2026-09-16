import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { CursusVue, EleveVue, MoniteurVue, SaisonVue } from '../../core/modeles';

const STATUTS = ['EN_COURS', 'VALIDE', 'DELIVRE', 'SUSPENDU', 'ABANDON'] as const;

@Component({
  selector: 'app-cursus-admin',
  imports: [FormsModule],
  template: `
    <h1>Inscriptions</h1>
    <p class="secondaire">
      Inscrit un élève dans une formation : le référentiel actif du niveau choisi est figé
      automatiquement, il ne bougera plus même si le MFT est révisé en cours de saison.
    </p>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <section class="carte panneau">
      <h2>Nouvelle inscription</h2>

      <label for="eleve">Élève</label>
      <div class="combobox">
        <input id="eleve" type="text" name="eleve" autocomplete="off"
               role="combobox" aria-autocomplete="list" aria-controls="liste-eleves"
               [attr.aria-expanded]="comboboxOuvert()" placeholder="Rechercher par nom ou prénom…"
               [ngModel]="rechercheEleve()" (ngModelChange)="saisirEleve($event)"
               (focus)="ouvrirCombobox()" (blur)="fermerComboboxDifferee()">
        @if (comboboxOuvert()) {
          <ul id="liste-eleves" role="listbox" class="options">
            @for (e of elevesFiltres(); track e.id) {
              <li role="option" [attr.aria-selected]="eleveId === e.id">
                <button type="button" (mousedown)="choisirEleve(e)">{{ e.prenom }} {{ e.nom }}</button>
              </li>
            } @empty {
              <li class="vide">Aucun élève ne correspond.</li>
            }
          </ul>
        }
      </div>

      <label for="niveau">Niveau</label>
      <select id="niveau" name="niveau" [(ngModel)]="niveau">
        <option value="N1">N1</option>
        <option value="N2">N2</option>
        <option value="N3">N3</option>
      </select>

      <label for="saison">Saison</label>
      <select id="saison" name="saison" [(ngModel)]="saisonId">
        <option [ngValue]="null">Choisir…</option>
        @for (s of saisons(); track s.id) {
          <option [ngValue]="s.id">{{ s.libelle }}</option>
        }
      </select>

      <label for="referent">Moniteur référent</label>
      <select id="referent" name="referent" [(ngModel)]="moniteurReferentId">
        <option [ngValue]="null">Sans référent</option>
        @for (m of moniteurs(); track m.id) {
          <option [ngValue]="m.id">{{ m.prenom }} {{ m.nom }}</option>
        }
      </select>

      <button type="button" class="bouton-principal" (click)="inscrire()" [disabled]="envoi()">
        {{ envoi() ? 'Inscription…' : 'Inscrire' }}
      </button>
    </section>

    <label for="filtre-nom">Rechercher un élève</label>
    <input id="filtre-nom" type="search" name="filtreNom" placeholder="Nom ou prénom"
           [ngModel]="filtreNom()" (ngModelChange)="filtreNom.set($event)">

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (liste().length === 0) {
      <div class="carte vide"><p>Aucun cursus enregistré.</p></div>
    } @else if (listeFiltree().length === 0) {
      <div class="carte vide"><p>Aucune inscription ne correspond à la recherche.</p></div>
    } @else {
      <ul>
        @for (c of listeFiltree(); track c.id) {
          <li class="carte">
            @if (edition() === c.id) {
              @if (formulaireEdition(); as f) {
                <label [for]="'statut-' + c.id">Statut</label>
                <select [id]="'statut-' + c.id" name="statut" [(ngModel)]="f.statut">
                  @for (s of statuts; track s) { <option [value]="s">{{ s }}</option> }
                </select>
                <label [for]="'referent-' + c.id">Moniteur référent</label>
                <select [id]="'referent-' + c.id" name="referent" [(ngModel)]="f.moniteurReferentId">
                  <option [ngValue]="null">Sans référent</option>
                  @for (m of moniteurs(); track m.id) {
                    <option [ngValue]="m.id">{{ m.prenom }} {{ m.nom }}</option>
                  }
                </select>
                <div class="actions">
                  <button type="button" class="bouton-principal" (click)="enregistrer(c)" [disabled]="envoi()">
                    {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
                  </button>
                  <button type="button" class="bouton-discret" (click)="annulerEdition()">Annuler</button>
                </div>
              }
            } @else {
              <div class="ligne">
                <div class="identite">
                  <span class="nom">{{ c.eleve }}</span>
                  <span class="secondaire">
                    {{ c.niveau }} · {{ c.saison }} ·
                    {{ c.moniteurReferent ?? 'sans référent' }}
                  </span>
                </div>
                <span class="etat">{{ c.statut }}</span>
              </div>
              <div class="actions">
                <button type="button" class="bouton-discret" (click)="commencerEdition(c)">Modifier</button>
              </div>
            }
          </li>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .panneau { max-width: 480px; padding: var(--pas-3); margin: var(--pas-3) 0; }
    .panneau h2 { margin-bottom: 4px; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .bouton-principal { width: 100%; margin-top: var(--pas-3); }
    #filtre-nom { max-width: 320px; }

    .combobox { position: relative; max-width: 320px; }
    .combobox input { width: 100%; }
    .options {
      position: absolute; z-index: 1; top: 100%; left: 0; right: 0; margin-top: 2px;
      max-height: 240px; overflow-y: auto; background: var(--carte); border: 1px solid var(--trait);
      border-radius: var(--r-s); box-shadow: 0 4px 12px rgba(0,0,0,.12);
      display: block !important; gap: 0 !important;
    }
    .options li { padding: 0 !important; }
    .options li[aria-selected="true"] button { font-weight: 700; background: var(--fond); }
    .options button {
      display: block; width: 100%; padding: var(--pas) var(--pas-2); min-height: 44px;
      text-align: left; background: none; border: none; color: var(--encre);
    }
    .options button:hover, .options button:focus { background: var(--fond); }
    .options .vide { padding: var(--pas) var(--pas-2) !important; color: var(--craie); font-size: .875rem; }

    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2); }
    li { padding: var(--pas-2); }
    .ligne { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas-2); }
    .identite { display: flex; flex-direction: column; gap: 2px; }
    .nom { font-weight: 700; }
    .etat {
      flex: none; padding: 2px 10px; border-radius: var(--r-s); font-size: .8125rem; font-weight: 700;
      background: #EEF2F4; color: var(--craie);
    }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }
    .actions .bouton-principal { width: auto; margin-top: 0; }

    @media (max-width: 600px) {
      .ligne { flex-direction: column; }
    }
  `]
})
export class CursusAdminComponent {
  private api = inject(ApiService);

  readonly statuts = STATUTS;

  liste = signal<CursusVue[]>([]);
  eleves = signal<EleveVue[]>([]);
  saisons = signal<SaisonVue[]>([]);
  moniteurs = signal<MoniteurVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  envoi = signal(false);

  filtreNom = signal('');
  listeFiltree = computed(() => {
    const recherche = this.filtreNom().trim().toLocaleLowerCase();
    if (!recherche) return this.liste();
    return this.liste().filter(c => c.eleve.toLocaleLowerCase().includes(recherche));
  });

  rechercheEleve = signal('');
  comboboxOuvert = signal(false);
  elevesFiltres = computed(() => {
    const recherche = this.rechercheEleve().trim().toLocaleLowerCase();
    if (!recherche) return this.eleves();
    return this.eleves().filter(e => `${e.prenom} ${e.nom}`.toLocaleLowerCase().includes(recherche));
  });

  eleveId: number | null = null;
  niveau: 'N1' | 'N2' | 'N3' = 'N1';
  saisonId: number | null = null;
  moniteurReferentId: number | null = null;

  edition = signal<number | null>(null);
  formulaireEdition = signal<{ statut: string; moniteurReferentId: number | null } | null>(null);

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    this.chargement.set(true);
    try {
      const [cursus, eleves, saisons, moniteurs] = await Promise.all([
        this.api.cursus(),
        firstValueFrom(this.api.eleves()),
        firstValueFrom(this.api.saisons()),
        firstValueFrom(this.api.moniteurs())
      ]);
      this.liste.set(cursus);
      this.eleves.set(eleves);
      this.saisons.set(saisons);
      this.moniteurs.set(moniteurs);
    } catch {
      this.message.set("Impossible de charger les données d'inscription.");
    } finally {
      this.chargement.set(false);
    }
  }

  /** Tant qu'aucune option n'a été cliquée, aucun élève n'est retenu pour l'inscription. */
  saisirEleve(texte: string): void {
    this.rechercheEleve.set(texte);
    this.eleveId = null;
    this.comboboxOuvert.set(true);
  }

  ouvrirCombobox(): void {
    this.comboboxOuvert.set(true);
  }

  /** Différé pour laisser le clic sur une option se produire avant la fermeture. */
  fermerComboboxDifferee(): void {
    setTimeout(() => this.comboboxOuvert.set(false), 150);
  }

  choisirEleve(e: EleveVue): void {
    this.eleveId = e.id;
    this.rechercheEleve.set(`${e.prenom} ${e.nom}`);
    this.comboboxOuvert.set(false);
  }

  inscrire(): void {
    if (!this.eleveId || !this.saisonId) {
      this.message.set('Élève et saison sont obligatoires.');
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    this.api.inscrireCursus({
      eleveId: this.eleveId, saisonId: this.saisonId, niveau: this.niveau,
      moniteurReferentId: this.moniteurReferentId
    }).subscribe({
      next: c => {
        this.envoi.set(false);
        this.liste.set([c, ...this.liste()]);
        this.eleveId = null;
        this.saisonId = null;
        this.moniteurReferentId = null;
        this.rechercheEleve.set('');
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "L'inscription n'a pas pu être enregistrée.");
      }
    });
  }

  commencerEdition(c: CursusVue): void {
    this.message.set(null);
    this.edition.set(c.id);
    // CursusVue n'expose que le nom du référent, pas son id : on le retrouve par
    // correspondance de nom. Rare faux-positif possible en cas d'homonymie exacte.
    const m = this.moniteurs().find(x => `${x.prenom} ${x.nom}` === c.moniteurReferent);
    this.formulaireEdition.set({ statut: c.statut, moniteurReferentId: m?.id ?? null });
  }

  annulerEdition(): void {
    this.edition.set(null);
    this.formulaireEdition.set(null);
  }

  enregistrer(c: CursusVue): void {
    const f = this.formulaireEdition();
    if (!f) return;
    this.envoi.set(true);
    this.api.modifierCursus(c.id, { statut: f.statut, moniteurReferentId: f.moniteurReferentId }).subscribe({
      next: maj => {
        this.envoi.set(false);
        this.liste.set(this.liste().map(x => x.id === maj.id ? maj : x));
        this.annulerEdition();
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "La modification n'a pas pu être enregistrée.");
      }
    });
  }
}
