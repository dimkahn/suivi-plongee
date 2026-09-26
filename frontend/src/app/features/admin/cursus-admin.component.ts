import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { CandidatInscription, CursusVue, MoniteurVue, SaisonVue } from '../../core/modeles';
import { normaliser } from '../../core/seance-lieu';

const STATUTS = ['EN_COURS', 'VALIDE', 'DELIVRE', 'SUSPENDU', 'ABANDON'] as const;
const LIBELLES_STATUT: Record<string, string> = {
  EN_COURS: 'En cours', VALIDE: 'Validé', DELIVRE: 'Brevet délivré',
  SUSPENDU: 'Suspendu', ABANDON: 'Abandon'
};

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

      <label for="saison">Saison</label>
      <select id="saison" name="saison" [ngModel]="saisonId()" (ngModelChange)="choisirSaison($event)">
        <option [ngValue]="null">Choisir…</option>
        @for (s of saisons(); track s.id) {
          <option [ngValue]="s.id">{{ s.libelle }}{{ s.ouverte ? '' : ' (fermée)' }}</option>
        }
      </select>

      <label for="eleve">Élève</label>
      <div class="combobox">
        <input id="eleve" type="text" name="eleve" autocomplete="off"
               role="combobox" aria-autocomplete="list" aria-controls="liste-eleves"
               [attr.aria-expanded]="comboboxOuvert()"
               [attr.aria-activedescendant]="optionActive() ? 'option-eleve-' + optionActive()!.eleveId : null"
               [disabled]="saisonId() === null"
               [placeholder]="aideRecherche()"
               [ngModel]="rechercheEleve()" (ngModelChange)="saisirEleve($event)"
               (focus)="ouvrirCombobox()" (blur)="fermerComboboxDifferee()" (keydown)="clavierCombobox($event)">
        @if (comboboxOuvert()) {
          <ul id="liste-eleves" role="listbox" class="options" aria-label="Élèves">
            @for (c of candidatsFiltres(); track c.eleveId; let i = $index) {
              <li role="option" [id]="'option-eleve-' + c.eleveId"
                  [attr.aria-selected]="candidatChoisi()?.eleveId === c.eleveId"
                  [class.active]="indexActif() === i">
                <button type="button" tabindex="-1" (mousedown)="choisirEleve(c)">
                  <span class="option-nom">{{ c.prenom }} {{ c.nom }}</span>
                  <span class="option-detail">
                    <span class="badge-niveau" [class.debutant]="!c.niveauActuel">{{ niveauCourt(c) }}</span>
                    @if (c.saisonsPrecedentes === 0) {
                      <span class="badge-nouveau">1re saison</span>
                    } @else {
                      <span>{{ anciennete(c) }}</span>
                    }
                    @if (c.inscriptionsSaison.length > 0) {
                      <span class="deja">déjà inscrit : {{ c.inscriptionsSaison.join(', ') }}</span>
                    }
                  </span>
                </button>
              </li>
            } @empty {
              <li class="vide">Aucun élève ne correspond.</li>
            }
          </ul>
        }
      </div>

      @if (candidatChoisi(); as c) {
        <dl class="resume-eleve" aria-live="polite">
          <dt>Niveau actuel</dt>
          <dd>
            {{ c.niveauActuel ?? 'Aucun brevet connu' }}
            @if (c.niveauDeclare) { <span class="secondaire">— déclaré sur la fiche élève</span> }
            @if (!c.niveauActuel) {
              <span class="secondaire">— à renseigner dans « Élèves » s'il a un brevet obtenu ailleurs</span>
            }
          </dd>
          <dt>Au club</dt>
          <dd>
            @if (c.saisonsPrecedentes === 0) {
              <span class="badge-nouveau">Première saison</span>
            } @else {
              {{ anciennete(c) }} · dernière : {{ c.derniereSaison }}
            }
          </dd>
          @if (c.inscriptionsSaison.length > 0 || c.adhesionSaison) {
            <dt>Cette saison</dt>
            <dd>
              @if (c.inscriptionsSaison.length > 0) { Déjà inscrit en {{ c.inscriptionsSaison.join(', ') }}. }
              @if (c.adhesionSaison) { Adhérent sans formation. }
            </dd>
          }
        </dl>
        <p class="secondaire motif">{{ c.motifProposition }}</p>
      }

      <label for="niveau">Niveau préparé</label>
      <select id="niveau" name="niveau" [(ngModel)]="niveau">
        @for (n of niveaux; track n) {
          <option [value]="n">{{ n }}{{ candidatChoisi()?.niveauPropose === n ? ' (proposé)' : '' }}</option>
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

    <section class="filtres">
      <div>
        <label for="filtre-nom">Rechercher un élève</label>
        <input id="filtre-nom" type="search" name="filtreNom" placeholder="Nom ou prénom"
               [ngModel]="filtreNom()" (ngModelChange)="filtreNom.set($event)">
      </div>
    </section>

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
                  @for (s of statuts; track s) { <option [value]="s">{{ libelleStatut(s) }}</option> }
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
                <span class="etat">{{ libelleStatut(c.statut) }}</span>
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

    .filtres { display: flex; flex-wrap: wrap; gap: var(--pas-2) var(--pas-3); margin-bottom: var(--pas-3); }
    .filtres > div { min-width: 220px; flex: 1 1 220px; max-width: 320px; }
    .filtres label { margin: 0 0 4px; }
    .filtres input { margin: 0; }

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
    .options li.active button { background: var(--fond); outline: 2px solid var(--profond); outline-offset: -2px; }
    .option-nom { display: block; }
    .option-detail { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; font-size: .8125rem; color: var(--craie); }
    .badge-niveau {
      padding: 0 6px; border-radius: var(--r-s); background: var(--profond); color: #fff; font-weight: 700;
    }
    .badge-niveau.debutant { background: #EEF2F4; color: var(--craie); }
    .badge-nouveau {
      padding: 0 6px; border-radius: var(--r-s); background: var(--acquis-clair); color: var(--acquis);
      font-weight: 700; font-size: .8125rem;
    }
    .deja { color: var(--en-cours); font-weight: 700; }
    .resume-eleve {
      display: grid; grid-template-columns: max-content 1fr; gap: 4px var(--pas-2);
      margin: var(--pas-2) 0 0; padding: var(--pas-2); border-radius: var(--r-s); background: var(--fond);
      font-size: .9375rem;
    }
    .resume-eleve dt { color: var(--craie); }
    .resume-eleve dd { margin: 0; font-weight: 700; }
    .motif { margin: var(--pas) 0 0; }
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

  readonly niveaux = ['N1', 'N2', 'N3'] as const;

  /** Élèves proposés, vus depuis la saison choisie (niveau actuel, ancienneté, niveau suggéré). */
  candidats = signal<CandidatInscription[]>([]);
  rechercheEleve = signal('');
  comboboxOuvert = signal(false);
  /** Option mise en surbrillance au clavier ; -1 : aucune. */
  indexActif = signal(-1);
  candidatsFiltres = computed(() => {
    const recherche = normaliser(this.rechercheEleve());
    if (!recherche) return this.candidats();
    return this.candidats().filter(c => normaliser(`${c.prenom} ${c.nom}`).includes(recherche)
      || normaliser(`${c.nom} ${c.prenom}`).includes(recherche));
  });
  aideRecherche = computed(() => this.saisonId() === null
    ? "Choisissez d'abord la saison" : 'Rechercher par nom ou prénom…');
  optionActive = computed(() => this.candidatsFiltres()[this.indexActif()] ?? null);

  candidatChoisi = signal<CandidatInscription | null>(null);
  saisonId = signal<number | null>(null);
  niveau: 'N1' | 'N2' | 'N3' = 'N1';
  moniteurReferentId: number | null = null;

  edition = signal<number | null>(null);
  formulaireEdition = signal<{ statut: string; moniteurReferentId: number | null } | null>(null);

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    this.chargement.set(true);
    try {
      const [cursus, saisons, moniteurs] = await Promise.all([
        this.api.cursus(),
        firstValueFrom(this.api.saisons()),
        firstValueFrom(this.api.moniteurs())
      ]);
      this.liste.set(cursus);
      this.saisons.set(saisons);
      this.moniteurs.set(moniteurs);
      // Saison ouverte la plus récente par défaut : c'est presque toujours celle qu'on inscrit.
      const ouverte = saisons.find(s => s.ouverte);
      if (ouverte) this.choisirSaison(ouverte.id);
    } catch {
      this.message.set("Impossible de charger les données d'inscription.");
    } finally {
      this.chargement.set(false);
    }
  }

  /** Changer de saison change le regard porté sur chaque élève : on recharge et on repart de zéro. */
  choisirSaison(id: number | null): void {
    this.saisonId.set(id);
    this.candidatChoisi.set(null);
    this.rechercheEleve.set('');
    this.candidats.set([]);
    if (id === null) return;
    this.api.candidatsInscription(id).subscribe({
      next: c => { if (this.saisonId() === id) this.candidats.set(c); },
      error: () => this.message.set('Impossible de charger les élèves pour cette saison.')
    });
  }

  /** Tant qu'aucune option n'a été choisie, aucun élève n'est retenu pour l'inscription. */
  saisirEleve(texte: string): void {
    this.rechercheEleve.set(texte);
    this.candidatChoisi.set(null);
    this.comboboxOuvert.set(true);
    this.indexActif.set(texte.trim() ? 0 : -1);
  }

  ouvrirCombobox(): void {
    this.comboboxOuvert.set(true);
  }

  /** Différé pour laisser le clic sur une option se produire avant la fermeture. */
  fermerComboboxDifferee(): void {
    setTimeout(() => this.comboboxOuvert.set(false), 150);
  }

  /** Flèches pour parcourir, Entrée pour choisir, Échap pour refermer. */
  clavierCombobox(ev: KeyboardEvent): void {
    const nb = this.candidatsFiltres().length;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.comboboxOuvert.set(true);
      if (nb === 0) return;
      const pas = ev.key === 'ArrowDown' ? 1 : -1;
      this.indexActif.set((this.indexActif() + pas + nb) % nb);
      document.getElementById(`option-eleve-${this.optionActive()?.eleveId}`)?.scrollIntoView({ block: 'nearest' });
    } else if (ev.key === 'Enter') {
      const c = this.optionActive();
      if (this.comboboxOuvert() && c) {
        ev.preventDefault();
        this.choisirEleve(c);
      }
    } else if (ev.key === 'Escape') {
      this.comboboxOuvert.set(false);
    }
  }

  choisirEleve(c: CandidatInscription): void {
    this.candidatChoisi.set(c);
    this.rechercheEleve.set(`${c.prenom} ${c.nom}`);
    this.comboboxOuvert.set(false);
    this.indexActif.set(-1);
    if (c.niveauPropose) this.niveau = c.niveauPropose;
  }

  niveauCourt(c: CandidatInscription): string {
    return c.niveauActuel ? c.niveauActuel + (c.niveauDeclare ? ' (déclaré)' : '') : 'Aucun brevet';
  }

  /** « 2e saison » : la saison choisie plus celles d'avant. */
  anciennete(c: CandidatInscription): string {
    return `${c.saisonsPrecedentes + 1}e saison au club`;
  }

  libelleStatut(statut: string): string {
    return LIBELLES_STATUT[statut] ?? statut;
  }

  inscrire(): void {
    const c = this.candidatChoisi();
    const saisonId = this.saisonId();
    if (!c || !saisonId) {
      this.message.set('Choisissez la saison puis un élève dans la liste.');
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    this.api.inscrireCursus({
      eleveId: c.eleveId, saisonId, niveau: this.niveau,
      moniteurReferentId: this.moniteurReferentId
    }).subscribe({
      next: cursus => {
        this.envoi.set(false);
        this.liste.set([cursus, ...this.liste()]);
        this.moniteurReferentId = null;
        // Recharge les candidats : l'élève affiche désormais son inscription de la saison.
        this.choisirSaison(saisonId);
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
