import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import {
  DECISIONS_INSPECTION_TIV, DecisionInspectionTiv, ModeleInspectionTivVue, MOTIFS_INSPECTION_TIV,
  MotifInspectionTiv, PointInspectionTivVue
} from '../../core/modeles';
import { dateDuJour } from '../../core/date-fr';
import { descriptionEquipement } from './materiel';

/** Une ligne de la fiche en cours de saisie. */
interface Ligne {
  point: PointInspectionTivVue;
  reponse: boolean;
  decision: string;
  precisions: string;
  realiseLe: string;
}

/**
 * Saisie de la fiche d'évaluation et de suivi d'une bouteille, par le TIV,
 * au bord de l'atelier : chaque question est pré-remplie avec la réponse
 * d'une bouteille saine, il ne reste qu'à basculer les défauts constatés.
 * Les questions viennent du serveur (aluminium et oxygène selon le bloc),
 * qui vérifie aussi la cohérence de la décision.
 */
@Component({
  selector: 'app-saisie-inspection-tiv',
  imports: [FormsModule, RouterLink],
  template: `
    <a [routerLink]="['/materiel', equipementId]" class="retour">← Fiche du bloc</a>

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (modele(); as m) {
      <h1>Inspection visuelle du bloc {{ m.bloc.reference }}</h1>
      @if (description(m.bloc); as d) { <p class="secondaire">{{ d }}</p> }

      <form (ngSubmit)="enregistrer()">
        <section class="carte bloc-saisie">
          <h2>Inspection</h2>
          <div class="grille">
            <div>
              <label for="date">Date</label>
              <input id="date" name="date" type="date" [max]="aujourdhui" [(ngModel)]="date" required>
            </div>
            <div>
              <label for="motif">Motif</label>
              <select id="motif" name="motif" [(ngModel)]="motif">
                @for (mo of motifs; track mo.valeur) { <option [ngValue]="mo.valeur">{{ mo.libelle }}</option> }
              </select>
            </div>
            <div>
              <label for="tivNom">Nom du TIV *</label>
              <input id="tivNom" name="tivNom" [(ngModel)]="tivNom" maxlength="120" required>
            </div>
            <div>
              <label for="tivNumero">N° de TIV *</label>
              <input id="tivNumero" name="tivNumero" [(ngModel)]="tivNumero" maxlength="30" required>
            </div>
          </div>
        </section>

        <section class="carte bloc-saisie">
          <h2>Filetages et marquage</h2>
          <p class="secondaire">
            Risque majeur : un robinet 25×2 sur une bouteille 3/4 gaz, ou un robinet NPSM sur une bouteille 3/4 gaz.
            Vérifiez l'appairage aux tampons et bagues.
          </p>
          <div class="grille">
            <div>
              <label for="filetageBouteille">Filetage de la bouteille</label>
              <input id="filetageBouteille" name="filetageBouteille" [(ngModel)]="filetageBouteille" maxlength="30"
                     list="filetages" placeholder="M25×2…">
            </div>
            <div>
              <label for="filetageRobinet">Filetage du robinet</label>
              <input id="filetageRobinet" name="filetageRobinet" [(ngModel)]="filetageRobinet" maxlength="30"
                     list="filetages">
            </div>
            <div>
              <label for="marquage">Poinçon de la dernière requalification</label>
              <input id="marquage" name="marquage" [(ngModel)]="marquageRequalification" maxlength="80"
                     placeholder="Marque et date relevées sur l'ogive">
            </div>
          </div>
          <datalist id="filetages">
            <option value="M25×2"></option>
            <option value="25×200 ISO"></option>
            <option value="3/4 gaz"></option>
            <option value="M18×1,5"></option>
            <option value="NPSM"></option>
          </datalist>
        </section>

        @for (s of sections(); track s.code) {
          <section class="carte bloc-saisie">
            <h2>{{ s.libelle }}</h2>
            <ul class="questions">
              @for (l of s.lignes; track l.point.code) {
                <li [class.defaut]="estUnDefaut(l)">
                  <div class="question">
                    <span>{{ l.point.libelle }}</span>
                    <div class="oui-non" role="group" [attr.aria-label]="l.point.libelle">
                      <button type="button" [class.actif]="l.reponse" (click)="l.reponse = true">Oui</button>
                      <button type="button" [class.actif]="!l.reponse" (click)="l.reponse = false">Non</button>
                    </div>
                  </div>
                  @if (estUnDefaut(l)) {
                    @if (l.point.interditAvisFavorable) {
                      <p class="rejet">Ce défaut interdit un avis favorable.</p>
                    }
                    <div class="grille">
                      <div>
                        <label [for]="'decision-' + l.point.code">Décision</label>
                        <input [id]="'decision-' + l.point.code" [name]="'decision-' + l.point.code"
                               [(ngModel)]="l.decision" maxlength="255">
                      </div>
                      <div>
                        <label [for]="'precisions-' + l.point.code">Précisions</label>
                        <input [id]="'precisions-' + l.point.code" [name]="'precisions-' + l.point.code"
                               [(ngModel)]="l.precisions" maxlength="255"
                               placeholder="Localisation, mesures, résidus, entreprise…">
                      </div>
                      <div>
                        <label [for]="'realise-' + l.point.code">Réalisé le</label>
                        <input [id]="'realise-' + l.point.code" [name]="'realise-' + l.point.code" type="date"
                               [min]="date" [(ngModel)]="l.realiseLe">
                      </div>
                    </div>
                  }
                </li>
              }
            </ul>
          </section>
        }

        <section class="carte bloc-saisie">
          <h2>Décision</h2>
          <div class="decisions">
            @for (d of decisions; track d.valeur) {
              <label class="choix" [class.actif]="decision === d.valeur">
                <input type="radio" name="decision" [value]="d.valeur" [(ngModel)]="decision">
                {{ d.libelle }}
              </label>
            }
          </div>
          @if (decision === 'FAVORABLE' && rejets().length > 0) {
            <div class="alerte bloquant" role="status">
              Avis favorable impossible : {{ rejets().join(', ') }}.
            </div>
          }
          @if (decision === 'REBUT') {
            <p class="secondaire">Le bloc sera mis au rebut à la date de l'inspection et ne sera plus prêté.</p>
          } @else if (decision === 'DEFAVORABLE') {
            <p class="secondaire">Le bloc ne sera plus prêté jusqu'à une nouvelle inspection favorable.</p>
          }
          <label for="observations">Observations{{ decision === 'FAVORABLE' ? '' : ' *' }}</label>
          <textarea id="observations" name="observations" rows="3" [(ngModel)]="observations"
                    [placeholder]="decision === 'FAVORABLE' ? 'Facultatif' : 'Motif, à communiquer au propriétaire'">
          </textarea>
        </section>

        @if (message(); as msg) { <div class="alerte" role="alert">{{ msg }}</div> }

        <div class="actions">
          <button type="submit" class="bouton-principal" [disabled]="envoi()">
            {{ envoi() ? 'Enregistrement…' : 'Enregistrer la fiche' }}
          </button>
          <a [routerLink]="['/materiel', equipementId]" class="bouton-discret">Annuler</a>
        </div>
        <p class="secondaire">Une fiche enregistrée ne se modifie plus : une erreur se corrige par une nouvelle inspection.</p>
      </form>
    } @else if (message(); as msg) {
      <div class="alerte" role="alert">{{ msg }}</div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .retour { display: inline-flex; align-items: center; min-height: 44px; margin-bottom: var(--pas); }
    h1 { margin-bottom: var(--pas); }
    .bloc-saisie { padding: var(--pas-2) var(--pas-3); margin-bottom: var(--pas-2); max-width: 860px; }
    .bloc-saisie h2 { margin-bottom: var(--pas); }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0 var(--pas-2); }
    textarea { resize: vertical; }

    .questions { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas); }
    .questions li { padding: var(--pas) 0; border-bottom: 1px solid var(--trait); }
    .questions li:last-child { border-bottom: none; }
    .questions li.defaut { border-left: 3px solid #B91C1C; padding-left: var(--pas-2); }
    .question { display: flex; justify-content: space-between; align-items: center; gap: var(--pas-2); }
    .oui-non { display: flex; flex: none; }
    .oui-non button {
      min-width: 64px; min-height: 44px; border: 1px solid var(--trait); background: var(--blanc, #fff);
      font-weight: 700; cursor: pointer;
    }
    .oui-non button:first-child { border-radius: var(--r-s) 0 0 var(--r-s); }
    .oui-non button:last-child { border-radius: 0 var(--r-s) var(--r-s) 0; border-left: none; }
    .oui-non button.actif { background: var(--profond); border-color: var(--profond); color: #fff; }
    .rejet { margin: var(--pas) 0 0; color: #B91C1C; font-weight: 700; font-size: .875rem; }

    .decisions { display: grid; gap: var(--pas); }
    .choix {
      display: flex; align-items: center; gap: var(--pas); margin: 0; min-height: 44px; padding: 0 var(--pas-2);
      border: 1px solid var(--trait); border-radius: var(--r-s); cursor: pointer; font-weight: 400;
    }
    .choix input { width: auto; }
    .choix.actif { border-color: var(--profond); background: #E0F2FE; font-weight: 700; }
    .alerte.bloquant { border-left-color: #B91C1C; background: #FEE2E2; margin-top: var(--pas-2); }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin: var(--pas-2) 0; }
    .actions a { display: inline-flex; align-items: center; text-decoration: none; }

    @media (max-width: 600px) {
      .bloc-saisie { padding: var(--pas-2); }
      .question { flex-direction: column; align-items: stretch; }
      .oui-non button { flex: 1; }
    }
  `]
})
export class SaisieInspectionTivComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly motifs = MOTIFS_INSPECTION_TIV;
  readonly decisions = DECISIONS_INSPECTION_TIV;
  readonly description = descriptionEquipement;
  readonly aujourdhui = dateDuJour();
  readonly equipementId = Number(this.route.snapshot.paramMap.get('id'));

  modele = signal<ModeleInspectionTivVue | null>(null);
  sections = signal<{ code: string; libelle: string; lignes: Ligne[] }[]>([]);
  chargement = signal(true);
  envoi = signal(false);
  message = signal<string | null>(null);

  date = dateDuJour();
  motif: MotifInspectionTiv = 'PERIODIQUE';
  tivNom = '';
  tivNumero = '';
  filetageBouteille = '';
  filetageRobinet = '';
  marquageRequalification = '';
  decision: DecisionInspectionTiv = 'FAVORABLE';
  observations = '';

  constructor() {
    void this.charger();
  }

  estUnDefaut(l: Ligne): boolean {
    return l.reponse !== l.point.reponseNormale;
  }

  /** Les défauts qui interdisent l'avis favorable ; le serveur fait la même vérification. */
  rejets(): string[] {
    return this.sections().flatMap(s => s.lignes)
      .filter(l => this.estUnDefaut(l) && l.point.interditAvisFavorable)
      .map(l => `« ${l.point.libelle} »`);
  }

  enregistrer(): void {
    if (!this.date || !this.tivNom.trim() || !this.tivNumero.trim()) {
      this.message.set('La date, le nom et le n° du TIV sont obligatoires.');
      return;
    }
    if (this.decision !== 'FAVORABLE' && !this.observations.trim()) {
      this.message.set(this.decision === 'REBUT'
        ? 'Indiquez dans les observations le motif du rebut.'
        : "Indiquez dans les observations ce qui motive l'avis défavorable.");
      return;
    }
    if (this.decision === 'REBUT' && !confirm('Rebuter cette bouteille ? Elle sera mise au rebut et ne sera plus prêtée.')) {
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    const vide = (s: string) => s.trim() || null;
    this.api.enregistrerInspectionTiv(this.equipementId, {
      dateInspection: this.date,
      motif: this.motif,
      tivNom: this.tivNom.trim(),
      tivNumero: this.tivNumero.trim(),
      filetageBouteille: vide(this.filetageBouteille),
      filetageRobinet: vide(this.filetageRobinet),
      marquageRequalification: vide(this.marquageRequalification),
      decision: this.decision,
      observations: vide(this.observations),
      constats: this.sections().flatMap(s => s.lignes).map(l => {
        const defaut = this.estUnDefaut(l);
        return {
          point: l.point.code,
          reponse: l.reponse,
          decision: defaut ? vide(l.decision) : null,
          precisions: defaut ? vide(l.precisions) : null,
          realiseLe: defaut && l.realiseLe ? l.realiseLe : null
        };
      })
    }).subscribe({
      next: fiche => {
        this.envoi.set(false);
        void this.router.navigate(['/materiel/tiv', fiche.id]);
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(err.error?.detail ?? "La fiche n'a pas pu être enregistrée.");
      }
    });
  }

  private async charger(): Promise<void> {
    try {
      const m = await firstValueFrom(this.api.modeleInspectionTiv(this.equipementId));
      this.modele.set(m);
      this.tivNom = m.tivNom ?? '';
      this.tivNumero = m.tivNumero ?? '';
      this.filetageBouteille = m.filetageBouteille ?? '';
      this.filetageRobinet = m.filetageRobinet ?? '';
      this.sections.set(m.sections.map(s => ({
        code: s.code,
        libelle: s.libelle,
        lignes: s.points.map(p => ({ point: p, reponse: p.reponseNormale, decision: p.actionProposee, precisions: '', realiseLe: '' }))
      })));
    } catch (err) {
      this.message.set((err as HttpErrorResponse).error?.detail ?? "Impossible de préparer la fiche d'inspection.");
    } finally {
      this.chargement.set(false);
    }
  }
}
