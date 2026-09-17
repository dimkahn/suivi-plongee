import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import {
  BlocReferentielVue, CritereReferentielVue, DemandeBlocReferentiel, DemandeCritereReferentiel,
  DemandeReferentiel, ReferentielVue
} from '../../core/modeles';

const NIVEAUX = ['N1', 'N2', 'N3'] as const;
type Niveau = typeof NIVEAUX[number];
const ENCADREMENTS = ['E1', 'E2', 'E3', 'E4'] as const;

function formulaireReferentielVide(niveau: Niveau): DemandeReferentiel {
  return {
    niveau, versionMft: '', source: null,
    dateApplication: new Date().toISOString().slice(0, 10),
    actif: true, ageMinimum: 0, niveauPrerequis: null, qualificationRequise: null,
    milieuNaturelExclusif: false, niveauEncadrantValidation: 'E1', niveauEncadrantDelivrance: 'E1',
    profondeurMaxValidation: 0, profondeurMaxFormation: 0, prerogativeProfondeur: 0
  };
}

function formulaireReferentielDepuis(r: ReferentielVue): DemandeReferentiel {
  return {
    niveau: r.niveau, versionMft: r.versionMft, source: r.source, dateApplication: r.dateApplication,
    actif: r.actif, ageMinimum: r.ageMinimum, niveauPrerequis: r.niveauPrerequis,
    qualificationRequise: r.qualificationRequise, milieuNaturelExclusif: r.milieuNaturelExclusif,
    niveauEncadrantValidation: r.niveauEncadrantValidation, niveauEncadrantDelivrance: r.niveauEncadrantDelivrance,
    profondeurMaxValidation: r.profondeurMaxValidation, profondeurMaxFormation: r.profondeurMaxFormation,
    prerogativeProfondeur: r.prerogativeProfondeur
  };
}

function formulaireBlocVide(ordre: number): DemandeBlocReferentiel {
  return {
    intitule: '', ordre, evaluationTransverse: false, validerEnDernier: false,
    competenceAttendue: null, comportement: null, theorie: null, modalitesEvaluation: null, regroupement: null
  };
}

function formulaireBlocDepuis(b: BlocReferentielVue): DemandeBlocReferentiel {
  return {
    intitule: b.intitule, ordre: b.ordre, evaluationTransverse: b.evaluationTransverse,
    validerEnDernier: b.validerEnDernier, competenceAttendue: b.competenceAttendue,
    comportement: b.comportement, theorie: b.theorie, modalitesEvaluation: b.modalitesEvaluation,
    regroupement: b.regroupement
  };
}

function formulaireCritereVide(ordre: number): DemandeCritereReferentiel {
  return { ordre, savoirFaire: '', critereRealisation: null, commentaire: null };
}

function formulaireCritereDepuis(c: CritereReferentielVue): DemandeCritereReferentiel {
  return { ordre: c.ordre, savoirFaire: c.savoirFaire, critereRealisation: c.critereRealisation,
           commentaire: c.commentaire };
}

@Component({
  selector: 'app-referentiel-admin',
  imports: [FormsModule],
  template: `
    <h1>Référentiel MFT</h1>


    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <nav class="onglets">
      @for (n of niveaux; track n) {
        <button type="button" class="onglet" [class.actif]="selectionNiveau() === n"
                (click)="selectionnerNiveau(n)">
          {{ n }}
        </button>
      }
    </nav>

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else {
      <div class="barre-versions">
        <label for="version">Version</label>
        <select id="version" [ngModel]="selectionId()"
                (ngModelChange)="selectionnerVersion($event)">
          @for (r of versionsDuNiveau(); track r.id) {
            <option [ngValue]="r.id">
              MFT {{ r.versionMft }} · {{ r.dateApplication }}{{ r.actif ? '' : ' (inactif)' }}
            </option>
          }
        </select>
        <button type="button" class="bouton-discret" (click)="commencerNouveauReferentiel()">
          Nouvelle version
        </button>
      </div>

      @if (editionReferentiel(); as f) {
        <section class="carte fiche formulaire">
          <h2>{{ editionReferentielId() === 'nouveau' ? 'Nouvelle version' : 'Modifier la version' }}</h2>

          <label for="versionMft">Version MFT</label>
          <input id="versionMft" type="text" name="versionMft" [(ngModel)]="f.versionMft">

          <label for="dateApplication">Date d'application</label>
          <input id="dateApplication" type="date" name="dateApplication" [(ngModel)]="f.dateApplication">

          <label for="source">Source</label>
          <input id="source" type="text" name="source" [ngModel]="f.source ?? ''"
                 (ngModelChange)="f.source = $event || null">

          <label class="case">
            <input type="checkbox" name="actif" [(ngModel)]="f.actif">
            Version active (utilisable pour une nouvelle inscription)
          </label>

          <label for="ageMinimum">Âge minimum</label>
          <input id="ageMinimum" type="number" min="0" name="ageMinimum" [(ngModel)]="f.ageMinimum">

          <label for="niveauPrerequis">Brevet prérequis</label>
          <select id="niveauPrerequis" name="niveauPrerequis" [ngModel]="f.niveauPrerequis ?? ''"
                  (ngModelChange)="f.niveauPrerequis = $event || null">
            <option value="">Aucun</option>
            @for (n of niveaux; track n) { <option [value]="n">{{ n }}</option> }
          </select>

          <label for="qualificationRequise">Qualification requise (ex. RIFAP)</label>
          <input id="qualificationRequise" type="text" name="qualificationRequise"
                 [ngModel]="f.qualificationRequise ?? ''"
                 (ngModelChange)="f.qualificationRequise = $event || null">

          <label class="case">
            <input type="checkbox" name="milieuNaturelExclusif" [(ngModel)]="f.milieuNaturelExclusif">
            Compétences en milieu naturel exclusivement
          </label>

          <label for="niveauEncadrantValidation">Encadrant requis pour valider</label>
          <select id="niveauEncadrantValidation" name="niveauEncadrantValidation"
                  [(ngModel)]="f.niveauEncadrantValidation">
            @for (e of encadrements; track e) { <option [value]="e">{{ e }}</option> }
          </select>

          <label for="niveauEncadrantDelivrance">Encadrant requis pour délivrer</label>
          <select id="niveauEncadrantDelivrance" name="niveauEncadrantDelivrance"
                  [(ngModel)]="f.niveauEncadrantDelivrance">
            @for (e of encadrements; track e) { <option [value]="e">{{ e }}</option> }
          </select>

          <label for="profondeurMaxValidation">Profondeur max. de validation (m)</label>
          <input id="profondeurMaxValidation" type="number" min="0" name="profondeurMaxValidation"
                 [(ngModel)]="f.profondeurMaxValidation">

          <label for="profondeurMaxFormation">Profondeur max. de formation (m)</label>
          <input id="profondeurMaxFormation" type="number" min="0" name="profondeurMaxFormation"
                 [(ngModel)]="f.profondeurMaxFormation">

          <label for="prerogativeProfondeur">Prérogative de profondeur (m)</label>
          <input id="prerogativeProfondeur" type="number" min="0" name="prerogativeProfondeur"
                 [(ngModel)]="f.prerogativeProfondeur">

          <div class="actions">
            <button type="button" class="bouton-principal" (click)="enregistrerReferentiel()"
                    [disabled]="envoi()">
              {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
            <button type="button" class="bouton-discret" (click)="annulerEditionReferentiel()">Annuler</button>
          </div>
        </section>
      }

      @if (detail(); as r) {
        <section class="carte fiche">
          <div class="entete">
            <span class="nom">
              {{ r.niveau }} · MFT {{ r.versionMft }}
              @if (!r.actif) { <span class="secondaire">(inactif)</span> }
            </span>
            <span class="secondaire">Source : {{ r.source ?? 'non renseignée' }}</span>
          </div>

          <div class="actions">
            <button type="button" class="bouton-discret" (click)="commencerEditionReferentiel(r)">
              Modifier cette version
            </button>
            <button type="button" class="bouton-discret danger" (click)="supprimerReferentiel(r)">
              Supprimer cette version
            </button>
          </div>

          <dl>
            <dt>Âge minimum</dt><dd>{{ r.ageMinimum }} ans</dd>
            <dt>Brevet prérequis</dt><dd>{{ r.niveauPrerequis ?? 'aucun' }}</dd>
            <dt>Qualification requise</dt><dd>{{ r.qualificationRequise ?? 'aucune' }}</dd>
            <dt>Milieu naturel exclusif</dt><dd>{{ r.milieuNaturelExclusif ? 'oui' : 'non' }}</dd>
            <dt>Prérogative de profondeur</dt><dd>{{ r.prerogativeProfondeur }} m</dd>
            <dt>Encadrant requis pour valider</dt><dd>{{ r.niveauEncadrantValidation }}</dd>
            <dt>Encadrant requis pour délivrer</dt><dd>{{ r.niveauEncadrantDelivrance }}</dd>
          </dl>

          <h2>Blocs de compétences</h2>
          <ul class="blocs">
            @for (b of r.blocs; track b.id) {
              <li class="carte bloc">
                @if (editionBlocId() === b.id && editionBloc(); as fb) {
                  <div class="formulaire">
                    <label [for]="'bloc-intitule-' + b.id">Intitulé</label>
                    <input [id]="'bloc-intitule-' + b.id" type="text" name="intitule" [(ngModel)]="fb.intitule">
                    <label [for]="'bloc-ordre-' + b.id">Ordre</label>
                    <input [id]="'bloc-ordre-' + b.id" type="number" name="ordre" [(ngModel)]="fb.ordre">
                    <label [for]="'bloc-regroupement-' + b.id">Regroupement (ex. PA20, PE40)</label>
                    <input [id]="'bloc-regroupement-' + b.id" type="text" name="regroupement"
                           [ngModel]="fb.regroupement ?? ''" (ngModelChange)="fb.regroupement = $event || null">
                    <label class="case">
                      <input type="checkbox" name="evaluationTransverse" [(ngModel)]="fb.evaluationTransverse">
                      Évaluation transverse (sans séance dédiée)
                    </label>
                    <label class="case">
                      <input type="checkbox" name="validerEnDernier" [(ngModel)]="fb.validerEnDernier">
                      À valider en dernier
                    </label>
                    <label [for]="'bloc-competence-' + b.id">Compétence attendue</label>
                    <textarea [id]="'bloc-competence-' + b.id" rows="2" name="competenceAttendue"
                              [ngModel]="fb.competenceAttendue ?? ''"
                              (ngModelChange)="fb.competenceAttendue = $event || null"></textarea>
                    <label [for]="'bloc-comportement-' + b.id">Comportement</label>
                    <textarea [id]="'bloc-comportement-' + b.id" rows="2" name="comportement"
                              [ngModel]="fb.comportement ?? ''"
                              (ngModelChange)="fb.comportement = $event || null"></textarea>
                    <label [for]="'bloc-theorie-' + b.id">Théorie</label>
                    <textarea [id]="'bloc-theorie-' + b.id" rows="2" name="theorie"
                              [ngModel]="fb.theorie ?? ''"
                              (ngModelChange)="fb.theorie = $event || null"></textarea>
                    <label [for]="'bloc-modalites-' + b.id">Modalités d'évaluation</label>
                    <textarea [id]="'bloc-modalites-' + b.id" rows="2" name="modalitesEvaluation"
                              [ngModel]="fb.modalitesEvaluation ?? ''"
                              (ngModelChange)="fb.modalitesEvaluation = $event || null"></textarea>
                    <div class="actions">
                      <button type="button" class="bouton-principal" (click)="enregistrerBloc(r, b.id)"
                              [disabled]="envoi()">
                        {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
                      </button>
                      <button type="button" class="bouton-discret" (click)="annulerEditionBloc()">Annuler</button>
                    </div>
                  </div>
                } @else {
                  <div class="entete-bloc">
                    <span class="nom">
                      {{ b.intitule }}
                      @if (b.regroupement) { <span class="regroupement">{{ b.regroupement }}</span> }
                    </span>
                    <span class="secondaire">
                      {{ b.evaluationTransverse ? 'Évaluation transverse' : 'Évaluation par bloc' }}
                      @if (b.validerEnDernier) { · à valider en dernier }
                    </span>
                  </div>

                  @if (b.competenceAttendue) {
                    <p class="competence-attendue">{{ b.competenceAttendue }}</p>
                  }

                  <ol>
                    @for (c of b.criteres; track c.id) {
                      <li>
                        @if (editionCritereCle() === (b.id + ':' + c.id) && editionCritere(); as fc) {
                          <div class="formulaire">
                            <label [for]="'critere-savoir-' + c.id">Savoir-faire</label>
                            <input [id]="'critere-savoir-' + c.id" type="text" name="savoirFaire"
                                   [(ngModel)]="fc.savoirFaire">
                            <label [for]="'critere-realisation-' + c.id">Critère de réalisation</label>
                            <textarea [id]="'critere-realisation-' + c.id" rows="2" name="critereRealisation"
                                      [ngModel]="fc.critereRealisation ?? ''"
                                      (ngModelChange)="fc.critereRealisation = $event || null"></textarea>
                            <label [for]="'critere-ordre-' + c.id">Ordre</label>
                            <input [id]="'critere-ordre-' + c.id" type="number" name="ordre"
                                   [(ngModel)]="fc.ordre">
                            <div class="actions">
                              <button type="button" class="bouton-principal"
                                      (click)="enregistrerCritere(r, b, c.id)" [disabled]="envoi()">
                                {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
                              </button>
                              <button type="button" class="bouton-discret" (click)="annulerEditionCritere()">
                                Annuler
                              </button>
                            </div>
                          </div>
                        } @else {
                          <span class="savoir-faire">{{ c.savoirFaire }}</span>
                          @if (c.critereRealisation) {
                            <span class="secondaire"> — {{ c.critereRealisation }}</span>
                          }
                          <button type="button" class="bouton-discret mini" (click)="commencerEditionCritere(b, c)">
                            Modifier
                          </button>
                          <button type="button" class="bouton-discret mini danger"
                                  (click)="supprimerCritere(r, b, c)">
                            Supprimer
                          </button>
                        }
                      </li>
                    }
                  </ol>

                  @if (editionCritereCle() === (b.id + ':nouveau') && editionCritere(); as fc) {
                    <div class="formulaire nouveau-critere">
                      <label [for]="'nouveau-critere-savoir-' + b.id">Savoir-faire</label>
                      <input [id]="'nouveau-critere-savoir-' + b.id" type="text" name="savoirFaire"
                             [(ngModel)]="fc.savoirFaire">
                      <label [for]="'nouveau-critere-realisation-' + b.id">Critère de réalisation</label>
                      <textarea [id]="'nouveau-critere-realisation-' + b.id" rows="2" name="critereRealisation"
                                [ngModel]="fc.critereRealisation ?? ''"
                                (ngModelChange)="fc.critereRealisation = $event || null"></textarea>
                      <div class="actions">
                        <button type="button" class="bouton-principal" (click)="enregistrerCritere(r, b, null)"
                                [disabled]="envoi()">
                          {{ envoi() ? 'Enregistrement…' : 'Ajouter' }}
                        </button>
                        <button type="button" class="bouton-discret" (click)="annulerEditionCritere()">Annuler</button>
                      </div>
                    </div>
                  } @else {
                    <button type="button" class="bouton-discret mini" (click)="commencerNouveauCritere(b)">
                      Ajouter un critère
                    </button>
                  }

                  @if (b.comportement || b.theorie) {
                    <dl class="matiere">
                      @if (b.comportement) { <dt>Comportement</dt><dd>{{ b.comportement }}</dd> }
                      @if (b.theorie) { <dt>Théorie</dt><dd>{{ b.theorie }}</dd> }
                    </dl>
                  }

                  @if (b.modalitesEvaluation) {
                    <p class="modalites">
                      <span class="secondaire">Modalités d'évaluation —</span> {{ b.modalitesEvaluation }}
                    </p>
                  }

                  <div class="actions">
                    <button type="button" class="bouton-discret mini" (click)="commencerEditionBloc(b)">
                      Modifier ce bloc
                    </button>
                    <button type="button" class="bouton-discret mini danger" (click)="supprimerBloc(r, b)">
                      Supprimer ce bloc
                    </button>
                  </div>
                }
              </li>
            }
          </ul>

          @if (editionBlocId() === 'nouveau' && editionBloc(); as fb) {
            <section class="carte fiche formulaire">
              <h2>Nouveau bloc</h2>
              <label for="nouveau-bloc-intitule">Intitulé</label>
              <input id="nouveau-bloc-intitule" type="text" name="intitule" [(ngModel)]="fb.intitule">
              <label for="nouveau-bloc-ordre">Ordre</label>
              <input id="nouveau-bloc-ordre" type="number" name="ordre" [(ngModel)]="fb.ordre">
              <div class="actions">
                <button type="button" class="bouton-principal" (click)="enregistrerBloc(r, 'nouveau')"
                        [disabled]="envoi()">
                  {{ envoi() ? 'Enregistrement…' : 'Ajouter' }}
                </button>
                <button type="button" class="bouton-discret" (click)="annulerEditionBloc()">Annuler</button>
              </div>
            </section>
          } @else {
            <button type="button" class="bouton-discret" (click)="commencerNouveauBloc(r)">
              Ajouter un bloc
            </button>
          }
        </section>
      } @else if (!editionReferentiel()) {
        <div class="carte vide"><p>Aucune version enregistrée pour ce niveau.</p></div>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    code { background: var(--fond); padding: 1px 6px; border-radius: var(--r-s); }

    .onglets { display: flex; gap: var(--pas); margin: var(--pas-3) 0 var(--pas-2); }
    .onglet {
      min-height: 44px; padding: 0 var(--pas-3); border-radius: var(--r-s);
      border: 1px solid var(--trait); background: #fff; font-weight: 700; cursor: pointer;
    }
    .onglet.actif { background: var(--profond); color: #fff; border-color: var(--profond); }

    .barre-versions { display: flex; align-items: center; gap: var(--pas-2); margin-bottom: var(--pas-2); flex-wrap: wrap; }
    .barre-versions label { font-weight: 700; }
    .barre-versions select { margin: 0; }

    .fiche { padding: var(--pas-3); margin-bottom: var(--pas-3); }
    .entete { display: flex; flex-direction: column; gap: 2px; margin-bottom: var(--pas-2); }
    .entete .nom { font-weight: 700; font-size: 1.0625rem; }

    dl {
      display: grid; grid-template-columns: max-content 1fr; gap: 4px var(--pas-2);
      margin: var(--pas-2) 0 var(--pas-3);
    }
    dt { color: var(--craie); }
    dd { margin: 0; font-weight: 700; }

    h2 { margin: 0 0 var(--pas-2); font-size: 1.0625rem; }
    .blocs { list-style: none; margin: 0 0 var(--pas-2); padding: 0; display: grid; gap: var(--pas-2); }
    .bloc { padding: var(--pas-2); }
    .entete-bloc { display: flex; flex-direction: column; gap: 2px; margin-bottom: var(--pas); }
    .entete-bloc .nom { font-weight: 700; }
    .regroupement {
      display: inline-block; margin-left: var(--pas); padding: 0 8px; font-size: .8125rem;
      font-weight: 400; border-radius: var(--r-s); border: 1px solid var(--profond); color: var(--profond);
    }
    .bloc ol { margin: 0; padding-left: 1.25rem; display: grid; gap: 4px; }
    .savoir-faire { font-weight: 600; }

    .competence-attendue { margin: 0 0 var(--pas); font-style: italic; color: var(--craie); }
    .matiere {
      margin: var(--pas) 0 0; padding-top: var(--pas);
      border-top: 1px solid var(--trait);
      display: grid; grid-template-columns: max-content 1fr; gap: 4px var(--pas-2);
    }
    .matiere dt { color: var(--craie); font-weight: 700; }
    .matiere dd { margin: 0; }
    .modalites { margin: var(--pas) 0 0; padding-top: var(--pas); border-top: 1px solid var(--trait); }

    .formulaire { display: flex; flex-direction: column; gap: 2px; }
    .formulaire label { font-weight: 700; font-size: .875rem; margin-top: var(--pas); }
    .formulaire input, .formulaire textarea, .formulaire select { margin: 0; }
    .formulaire textarea { resize: vertical; }
    .nouveau-critere { margin-top: var(--pas); padding-top: var(--pas); border-top: 1px solid var(--trait); }

    .case { display: flex; align-items: center; gap: var(--pas); font-weight: 400 !important; }
    .case input { width: auto; }

    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }
    .actions .bouton-principal { width: auto; }
    .mini { min-height: 32px; padding: 0 var(--pas); font-size: .8125rem; }
    .danger { color: #B3261E; border-color: #B3261E; }

    @media (max-width: 600px) {
      dl { grid-template-columns: 1fr; }
      dd { margin-bottom: 4px; }
    }
  `]
})
export class ReferentielAdminComponent {
  private api = inject(ApiService);

  readonly niveaux = NIVEAUX;
  readonly encadrements = ENCADREMENTS;

  liste = signal<ReferentielVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  envoi = signal(false);

  selectionNiveau = signal<Niveau>('N1');
  selectionId = signal<number | null>(null);
  detail = signal<ReferentielVue | null>(null);

  versionsDuNiveau = computed(() => this.liste()
    .filter(r => r.niveau === this.selectionNiveau())
    .sort((a, b) => b.dateApplication.localeCompare(a.dateApplication)));

  editionReferentielId = signal<number | 'nouveau' | null>(null);
  editionReferentiel = signal<DemandeReferentiel | null>(null);

  editionBlocId = signal<number | 'nouveau' | null>(null);
  editionBloc = signal<DemandeBlocReferentiel | null>(null);

  /** Clé "blocId:critereId" ou "blocId:nouveau" pour savoir quel critère est en édition. */
  editionCritereCle = signal<string | null>(null);
  editionCritere = signal<DemandeCritereReferentiel | null>(null);

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    this.chargement.set(true);
    try {
      const liste = await firstValueFrom(this.api.referentielsTous());
      this.liste.set(liste);
      await this.selectionnerNiveau(this.selectionNiveau());
    } catch {
      this.message.set('Impossible de charger le référentiel.');
    } finally {
      this.chargement.set(false);
    }
  }

  async selectionnerNiveau(niveau: Niveau): Promise<void> {
    this.selectionNiveau.set(niveau);
    this.annulerToutesEditions();
    const versions = this.liste().filter(r => r.niveau === niveau)
      .sort((a, b) => b.dateApplication.localeCompare(a.dateApplication));
    if (versions.length > 0) await this.selectionnerVersion(versions[0].id);
    else { this.selectionId.set(null); this.detail.set(null); }
  }

  async selectionnerVersion(id: number): Promise<void> {
    this.selectionId.set(id);
    this.annulerToutesEditions();
    try {
      this.detail.set(await firstValueFrom(this.api.referentiel(id)));
    } catch {
      this.message.set('Impossible de charger le détail de cette version.');
    }
  }

  private annulerToutesEditions(): void {
    this.editionReferentielId.set(null);
    this.editionReferentiel.set(null);
    this.editionBlocId.set(null);
    this.editionBloc.set(null);
    this.editionCritereCle.set(null);
    this.editionCritere.set(null);
  }

  commencerNouveauReferentiel(): void {
    this.message.set(null);
    this.editionReferentielId.set('nouveau');
    this.editionReferentiel.set(formulaireReferentielVide(this.selectionNiveau()));
  }

  commencerEditionReferentiel(r: ReferentielVue): void {
    this.message.set(null);
    this.editionReferentielId.set(r.id);
    this.editionReferentiel.set(formulaireReferentielDepuis(r));
  }

  annulerEditionReferentiel(): void {
    this.editionReferentielId.set(null);
    this.editionReferentiel.set(null);
  }

  enregistrerReferentiel(): void {
    const f = this.editionReferentiel();
    const id = this.editionReferentielId();
    if (!f || id == null) return;
    if (!f.versionMft.trim()) {
      this.message.set('La version MFT est obligatoire.');
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    const appel = id === 'nouveau' ? this.api.creerReferentiel(f) : this.api.modifierReferentiel(id, f);
    appel.subscribe({
      next: async r => {
        this.envoi.set(false);
        this.annulerEditionReferentiel();
        const maj = id === 'nouveau'
          ? [...this.liste(), r]
          : this.liste().map(x => x.id === r.id ? r : x);
        this.liste.set(maj);
        await this.selectionnerVersion(r.id);
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(err.error?.detail ?? "La version n'a pas pu être enregistrée.");
      }
    });
  }

  supprimerReferentiel(r: ReferentielVue): void {
    if (!confirm(`Supprimer la version MFT ${r.versionMft} du ${r.niveau} ?`)) return;
    this.message.set(null);
    this.api.supprimerReferentiel(r.id).subscribe({
      next: async () => {
        this.liste.set(this.liste().filter(x => x.id !== r.id));
        await this.selectionnerNiveau(this.selectionNiveau());
      },
      error: (err: HttpErrorResponse) =>
        this.message.set(err.error?.detail ?? "La suppression n'a pas pu être enregistrée.")
    });
  }

  commencerNouveauBloc(r: ReferentielVue): void {
    this.message.set(null);
    this.editionBlocId.set('nouveau');
    const ordreMax = Math.max(0, ...r.blocs.map(b => b.ordre));
    this.editionBloc.set(formulaireBlocVide(ordreMax + 1));
  }

  commencerEditionBloc(b: BlocReferentielVue): void {
    this.message.set(null);
    this.editionBlocId.set(b.id);
    this.editionBloc.set(formulaireBlocDepuis(b));
  }

  annulerEditionBloc(): void {
    this.editionBlocId.set(null);
    this.editionBloc.set(null);
  }

  enregistrerBloc(r: ReferentielVue, cible: number | 'nouveau'): void {
    const f = this.editionBloc();
    if (!f) return;
    if (!f.intitule.trim()) {
      this.message.set("L'intitulé du bloc est obligatoire.");
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    const appel = cible === 'nouveau'
      ? this.api.creerBlocReferentiel(r.id, f)
      : this.api.modifierBlocReferentiel(r.id, cible, f);
    appel.subscribe({
      next: async () => {
        this.envoi.set(false);
        this.annulerEditionBloc();
        await this.selectionnerVersion(r.id);
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(err.error?.detail ?? "Le bloc n'a pas pu être enregistré.");
      }
    });
  }

  supprimerBloc(r: ReferentielVue, b: BlocReferentielVue): void {
    if (!confirm(`Supprimer le bloc « ${b.intitule} » ?`)) return;
    this.message.set(null);
    this.api.supprimerBlocReferentiel(r.id, b.id).subscribe({
      next: async () => { await this.selectionnerVersion(r.id); },
      error: (err: HttpErrorResponse) =>
        this.message.set(err.error?.detail ?? "Le bloc n'a pas pu être supprimé.")
    });
  }

  commencerNouveauCritere(b: BlocReferentielVue): void {
    this.message.set(null);
    this.editionCritereCle.set(`${b.id}:nouveau`);
    const ordreMax = Math.max(0, ...b.criteres.map(c => c.ordre));
    this.editionCritere.set(formulaireCritereVide(ordreMax + 1));
  }

  commencerEditionCritere(b: BlocReferentielVue, c: CritereReferentielVue): void {
    this.message.set(null);
    this.editionCritereCle.set(`${b.id}:${c.id}`);
    this.editionCritere.set(formulaireCritereDepuis(c));
  }

  annulerEditionCritere(): void {
    this.editionCritereCle.set(null);
    this.editionCritere.set(null);
  }

  enregistrerCritere(r: ReferentielVue, b: BlocReferentielVue, critereId: number | null): void {
    const f = this.editionCritere();
    if (!f) return;
    if (!f.savoirFaire.trim()) {
      this.message.set('Le savoir-faire est obligatoire.');
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    const appel = critereId == null
      ? this.api.creerCritereReferentiel(r.id, b.id, f)
      : this.api.modifierCritereReferentiel(r.id, b.id, critereId, f);
    appel.subscribe({
      next: async () => {
        this.envoi.set(false);
        this.annulerEditionCritere();
        await this.selectionnerVersion(r.id);
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(err.error?.detail ?? "Le critère n'a pas pu être enregistré.");
      }
    });
  }

  supprimerCritere(r: ReferentielVue, b: BlocReferentielVue, c: CritereReferentielVue): void {
    if (!confirm(`Supprimer le critère « ${c.savoirFaire} » ?`)) return;
    this.message.set(null);
    this.api.supprimerCritereReferentiel(r.id, b.id, c.id).subscribe({
      next: async () => { await this.selectionnerVersion(r.id); },
      error: (err: HttpErrorResponse) =>
        this.message.set(err.error?.detail ?? "Le critère n'a pas pu être supprimé.")
    });
  }
}
