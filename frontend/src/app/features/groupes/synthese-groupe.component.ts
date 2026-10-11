import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ReseauService } from '../../core/reseau.service';
import {
  CaseCompetenceVue, CompetenceGroupeVue, EleveCompetencesVue, GroupeEntrainementVue, SyntheseGroupeVue
} from '../../core/modeles';
import { dateFr } from '../../core/date-fr';
import { libellePreparation } from '../../core/niveaux';

/**
 * Synthèse des compétences d'un groupe d'entraînement (choix du club, 2026) :
 * l'avancement de tous ses élèves d'un coup d'œil, un élève par ligne, une
 * compétence par colonne (validée, critères acquis sur le total, en retard,
 * à valider), comme dans la grille de chaque élève. Une formation (version
 * du MFT) par tableau. Lecture seule, réseau obligatoire.
 */
@Component({
  selector: 'app-synthese-groupe',
  imports: [RouterLink],
  template: `
    <a routerLink="/eleves" [queryParams]="{ groupe: groupe() ?? null }" class="retour">← Infos élèves</a>
    <h1>Synthèse des compétences</h1>
    <p class="secondaire">
      L'avancement des élèves d'un groupe d'entraînement, compétence par compétence.
    </p>

    @if (!reseau.enLigne()) {
      <div class="alerte" role="status">La synthèse des compétences s'affiche avec du réseau.</div>
    }
    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (groupes().length > 0) {
      <div class="groupes" role="group" aria-label="Groupe d'entraînement">
        @for (g of groupes(); track g.id) {
          <button type="button" class="bouton-discret" [class.actif]="g.id === groupeChoisi()"
                  [attr.aria-pressed]="g.id === groupeChoisi()" (click)="choisirGroupe(g.id)">{{ g.nom }}</button>
        }
        @if (synthese()) {
          <button type="button" class="bouton-discret imprimer" (click)="imprimer()">Imprimer</button>
        }
      </div>
    } @else if (!chargement()) {
      <div class="carte vide"><p>Aucun groupe d'entraînement sur la saison ouverte.</p></div>
    }

    @if (synthese(); as s) {
      <h2 class="titre-groupe">{{ s.groupe }} <span class="secondaire">· {{ s.saison }}</span></h2>

      @if (s.formations.length === 0) {
        <div class="carte vide"><p>Aucun élève de ce groupe n'est inscrit en formation cette saison.</p></div>
      }

      @for (f of s.formations; track f.versionMft + f.niveau) {
        <section class="formation">
          <h3>
            {{ libellePreparation(f.niveau) }} <span class="secondaire">· MFT {{ f.versionMft }}</span>
          </h3>
          @if (f.progression) { <p class="secondaire progression">Progression suivie : {{ f.progression }}</p> }

          <div class="defilement">
            <table class="tableau">
              <thead>
                <tr>
                  <th scope="col" class="col-eleve">Élève</th>
                  <th scope="col" class="col-total">Bilan</th>
                  @for (c of f.competences; track c.blocId) {
                    <th scope="col" class="col-competence" [title]="titreCompetence(c)">
                      <span>{{ c.regroupement ? c.regroupement + ' · ' : '' }}{{ c.intitule }}</span>
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (e of f.eleves; track e.cursusId) {
                  <tr>
                    <th scope="row" class="col-eleve">
                      <a [routerLink]="['/cursus', e.cursusId]">{{ e.eleve }}</a>
                      @if (e.statutCursus !== 'EN_COURS') {
                        <span class="statut-cursus">{{ libelleStatut(e.statutCursus) }}</span>
                      }
                    </th>
                    <td class="col-total">
                      <span class="bilan-eleve">{{ e.competencesValidees }}/{{ f.competences.length }} validée(s)</span>
                      <span class="barre" aria-hidden="true">
                        <span [style.width.%]="pourcentage(e.criteresAcquis, e.criteresTotal)"></span>
                      </span>
                      <span class="secondaire">{{ pourcentage(e.criteresAcquis, e.criteresTotal) }} % des critères</span>
                    </td>
                    @for (c of f.competences; track c.blocId) {
                      @let k = caseDe(e, c.blocId);
                      <td class="case">
                        @if (k) {
                          <a [routerLink]="['/cursus', e.cursusId]" [class]="'etat ' + classe(k)"
                             [title]="detailCase(e, c, k)" [attr.aria-label]="detailCase(e, c, k)">
                            @if (k.valide) {
                              ✓
                            } @else {
                              {{ k.acquis }}/{{ k.total }}
                              @if (k.enRetard) { <span class="signe" aria-hidden="true">!</span> }
                            }
                          </a>
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" class="col-eleve">Validée par</th>
                  <td class="col-total"></td>
                  @for (c of f.competences; track c.blocId) {
                    <td class="case pied" [title]="c.enRetard > 0 ? c.enRetard + ' élève(s) en retard' : ''">
                      {{ c.valides }}/{{ f.eleves.length }}
                      @if (c.enRetard > 0) { <span class="retard-pied">{{ c.enRetard }} en retard</span> }
                    </td>
                  }
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      }

      <p class="secondaire legende">
        <span class="etat valide">✓</span> validée ·
        <span class="etat a-valider">5/5</span> critères tous acquis, à valider ·
        <span class="etat en-cours">2/5</span> critères acquis sur le total ·
        <span class="etat en-retard">1/5 !</span> en retard sur la progression.
        Touchez une case ou un nom pour ouvrir la grille de l'élève.
      </p>

      @if (s.sansFormation.length > 0) {
        <p class="secondaire">Dans le groupe sans formation cette saison : {{ s.sansFormation.join(', ') }}.</p>
      }
    } @else if (chargement()) {
      <p class="vide">Chargement…</p>
    }
  `,
  styles: [`
    .retour { display: inline-flex; align-items: center; min-height: 44px; }
    h1 { margin-bottom: var(--pas); }
    .groupes { display: flex; flex-wrap: wrap; gap: var(--pas); margin: var(--pas-2) 0; }
    .groupes .actif { background: var(--profond); border-color: var(--profond); color: #fff; }
    .imprimer { margin-left: auto; }
    .titre-groupe { margin: var(--pas-3) 0 0; }
    .formation h3 { margin: var(--pas-3) 0 var(--pas); font-size: 1rem; }
    .progression { margin: 0 0 var(--pas); font-size: .875rem; }
    .defilement { overflow-x: auto; border: 1px solid var(--trait); border-radius: var(--r-s); background: var(--carte); }
    .tableau { border-collapse: collapse; font-size: .875rem; min-width: 100%; }
    .tableau th, .tableau td { padding: var(--pas); border-bottom: 1px solid var(--trait); vertical-align: middle; }
    .tableau thead th { vertical-align: bottom; text-align: left; }
    .col-eleve { position: sticky; left: 0; background: var(--carte); text-align: left; min-width: 150px; z-index: 1; }
    .col-eleve a { display: inline-flex; align-items: center; min-height: 44px; font-weight: 700; }
    .statut-cursus { display: block; font-weight: 400; font-size: .8125rem; color: var(--craie); }
    .col-total { min-width: 130px; }
    .bilan-eleve { display: block; font-weight: 700; }
    .barre { display: block; height: 6px; margin: 4px 0; border-radius: 3px; background: var(--trait); overflow: hidden; }
    .barre span { display: block; height: 100%; background: var(--acquis); }
    .col-total .secondaire { font-size: .75rem; }
    .col-competence { width: 3.5rem; }
    .col-competence span { display: inline-block; writing-mode: vertical-rl; transform: rotate(180deg);
                           max-height: 13rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .case { text-align: center; }
    .etat { display: inline-flex; align-items: center; justify-content: center; gap: 2px;
            min-width: 44px; min-height: 44px; padding: 0 4px; border-radius: var(--r-s);
            border: 1px solid var(--trait); font-weight: 700; text-decoration: none; color: var(--craie); }
    .legende .etat { min-height: 0; min-width: 0; padding: 0 4px; }
    .etat.valide { background: var(--acquis); border-color: var(--acquis); color: #fff; }
    .etat.a-valider { background: var(--acquis-clair); border-color: var(--acquis); color: var(--acquis); }
    .etat.en-cours { color: inherit; }
    .etat.en-retard { background: var(--en-cours-clair); border: 2px solid var(--en-cours); color: var(--en-cours); }
    .signe { font-weight: 800; }
    .pied { font-weight: 700; white-space: nowrap; }
    .retard-pied { display: block; font-weight: 400; font-size: .75rem; color: var(--en-cours); }
    .legende { margin-top: var(--pas-2); font-size: .8125rem; line-height: 1.8; }
    @media print {
      .defilement { overflow: visible; border: 0; }
      .retour, .groupes, .alerte { display: none; }
      .formation { break-inside: avoid; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SyntheseGroupeComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  reseau = inject(ReseauService);

  /** Groupe à afficher d'emblée (?groupe=12), tiré du filtre d'Infos élèves. */
  groupe = input<string>();

  groupes = signal<GroupeEntrainementVue[]>([]);
  groupeChoisi = signal<number | null>(null);
  synthese = signal<SyntheseGroupeVue | null>(null);
  chargement = signal(true);
  message = signal<string | null>(null);

  readonly libellePreparation = libellePreparation;

  constructor() {
    effect(() => {
      const demande = Number(this.groupe()) || null;
      untracked(() => void this.initialiser(demande));
    });
  }

  private async initialiser(demande: number | null): Promise<void> {
    try {
      if (this.groupes().length === 0) this.groupes.set(await this.api.groupesEntrainementSaisonOuverte());
    } catch {
      this.message.set('Impossible de charger les groupes d’entraînement.');
    }
    const groupes = this.groupes();
    const id = groupes.some(g => g.id === demande) ? demande : groupes[0]?.id ?? null;
    if (id === null) {
      this.chargement.set(false);
      return;
    }
    if (id !== this.groupeChoisi()) await this.charger(id);
  }

  choisirGroupe(id: number): void {
    // L'adresse garde le groupe choisi : le retour depuis une grille y revient.
    void this.router.navigate([], { queryParams: { groupe: id }, replaceUrl: true });
  }

  imprimer(): void {
    window.print();
  }

  private async charger(groupeId: number): Promise<void> {
    this.groupeChoisi.set(groupeId);
    this.chargement.set(true);
    this.message.set(null);
    this.synthese.set(null);
    try {
      this.synthese.set(await firstValueFrom(this.api.syntheseGroupe(groupeId)));
    } catch (e) {
      this.message.set(e instanceof HttpErrorResponse && e.error?.detail
        ? e.error.detail : 'La synthèse n’a pas pu être chargée.');
    } finally {
      this.chargement.set(false);
    }
  }

  caseDe(e: EleveCompetencesVue, blocId: number): CaseCompetenceVue | null {
    return e.cases.find(c => c.blocId === blocId) ?? null;
  }

  classe(k: CaseCompetenceVue): string {
    if (k.valide) return 'valide';
    if (k.enRetard) return 'en-retard';
    if (k.aValider) return 'a-valider';
    return 'en-cours';
  }

  pourcentage(acquis: number, total: number): number {
    return total === 0 ? 0 : Math.round(100 * acquis / total);
  }

  titreCompetence(c: CompetenceGroupeVue): string {
    const echeance = c.echeance ? ` · à travailler jusqu'au ${dateFr(c.echeance)}` : '';
    return `${c.intitule} · ${c.criteres} critère(s)${echeance}`;
  }

  detailCase(e: EleveCompetencesVue, c: CompetenceGroupeVue, k: CaseCompetenceVue): string {
    let etat: string;
    if (k.valide) {
      etat = 'validée' + (k.dateValidation ? ` le ${dateFr(k.dateValidation)}` : '');
    } else {
      etat = `${k.acquis} critère(s) acquis sur ${k.total}`;
      if (k.acquisEntrainement > 0) etat += `, ${k.acquisEntrainement} à l'entraînement`;
      if (k.aValider) etat += ', à valider';
      if (k.enRetard) etat += ', en retard sur la progression';
    }
    return `${e.eleve} — ${c.intitule} : ${etat}`;
  }

  libelleStatut(statut: string): string {
    const libelles: Record<string, string> = {
      VALIDE: 'Formation validée', DELIVRE: 'Brevet délivré', SUSPENDU: 'Suspendu', ABANDON: 'Abandon'
    };
    return libelles[statut] ?? statut;
  }
}
