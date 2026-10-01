import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { InspectionTivVue } from '../../core/modeles';
import { DateFrPipe } from '../../core/date-fr';

/**
 * Le compte rendu d'une inspection TIV, à imprimer et à faire signer. Son
 * contenu suit le manuel de formation TIV de la FFESSM (UC8.2) :
 * structure émettrice, identification unique et date, bouteille et
 * accessoires, observations, TIV, décision, propriétaire (signature en cas
 * d'observation), prochaine échéance, marquage de la requalification.
 */
@Component({
  selector: 'app-rapport-inspection-tiv',
  imports: [RouterLink, DateFrPipe],
  template: `
    @if (fiche(); as f) {
      <a [routerLink]="['/materiel', f.bloc.id]" class="retour pas-imprime">← Fiche du bloc {{ f.bloc.reference }}</a>
      <div class="actions pas-imprime">
        <button type="button" class="bouton-principal" (click)="imprimer()">Imprimer</button>
      </div>

      <article class="carte rapport">
        <header>
          <div>
            <p class="club">{{ f.club }}</p>
            <h1>Fiche d'évaluation et de suivi d'une bouteille</h1>
          </div>
          <dl class="numero">
            <div><dt>N°</dt><dd>{{ f.numero }}</dd></div>
            <div><dt>Date</dt><dd>{{ f.dateInspection | dateFr }}</dd></div>
          </dl>
        </header>

        <section>
          <h2>Bouteille</h2>
          <dl class="champs">
            <div><dt>Référence du club</dt><dd>{{ f.bloc.reference }}</dd></div>
            <div><dt>Propriétaire</dt><dd>{{ f.proprietaire ?? 'Le club' }}</dd></div>
            <div><dt>Constructeur</dt><dd>{{ f.bloc.constructeur || '—' }}</dd></div>
            <div><dt>Marque</dt><dd>{{ f.bloc.marque || '—' }}</dd></div>
            <div><dt>N° de bouteille</dt><dd>{{ f.bloc.numeroSerie || '—' }}</dd></div>
            <div><dt>Capacité</dt><dd>{{ f.bloc.volumeLitres != null ? f.bloc.volumeLitres + ' L' : '—' }}</dd></div>
            <div><dt>Matière</dt><dd>{{ matiere(f) }}{{ f.bloc.nitrox ? ', nitrox' : '' }}</dd></div>
            <div><dt>PS / PE</dt><dd>{{ f.bloc.pressionServiceBar ?? '—' }} / {{ f.bloc.pressionEpreuveBar ?? '—' }} bar</dd></div>
            <div><dt>Première épreuve</dt><dd>{{ (f.bloc.datePremiereEpreuve | dateFr) || '—' }}</dd></div>
            <div><dt>Poinçon de la dernière requalification</dt><dd>{{ f.marquageRequalification || '—' }}</dd></div>
            <div><dt>Robinet (marque, n°)</dt><dd>{{ robinet(f) }}</dd></div>
            <div><dt>Filetages bouteille / robinet</dt><dd>{{ f.filetageBouteille || '—' }} / {{ f.filetageRobinet || '—' }}</dd></div>
          </dl>
        </section>

        <section>
          <h2>Inspection</h2>
          <dl class="champs">
            <div><dt>Motif</dt><dd>{{ f.motifLibelle }}</dd></div>
            <div><dt>TIV</dt><dd>{{ f.tivNom }}</dd></div>
            <div><dt>N° de TIV</dt><dd>{{ f.tivNumero }}</dd></div>
          </dl>
        </section>

        @for (s of f.sections; track s.code) {
          <section>
            <h2>{{ s.libelle }}</h2>
            <table>
              <thead>
                <tr><th>Constat</th><th class="court">Réponse</th><th>Décision</th><th class="court">Réalisation</th></tr>
              </thead>
              <tbody>
                @for (c of s.constats; track c.point) {
                  <tr [class.defaut]="c.defaut">
                    <td>
                      {{ c.libelle }}
                      @if (c.precisions) { <span class="precisions">{{ c.precisions }}</span> }
                    </td>
                    <td class="court">{{ c.reponse ? 'Oui' : 'Non' }}</td>
                    <td>{{ c.decision ?? '' }}</td>
                    <td class="court">{{ c.realiseLe | dateFr }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </section>
        }

        <section class="conclusion">
          <h2>Décision</h2>
          <p [class]="'decision decision-' + f.decision">{{ f.decisionLibelle }}</p>
          @if (f.observations) {
            <h3>Observations</h3>
            <p class="texte-libre">{{ f.observations }}</p>
          }
          <dl class="champs">
            <div><dt>Prochaine inspection visuelle</dt><dd>{{ (f.prochaineInspection | dateFr) || '—' }}</dd></div>
            <div><dt>Prochaine requalification</dt><dd>{{ (f.prochaineRequalification | dateFr) || '—' }}</dd></div>
          </dl>
        </section>

        <section class="signatures">
          <div>
            <p>Signature du TIV</p>
            <p class="secondaire">{{ f.tivNom }}</p>
          </div>
          <div>
            <p>Signature du propriétaire ou de l'exploitant</p>
            <p class="secondaire">En cas d'observation</p>
          </div>
        </section>

        <p class="secondaire pied">
          Saisie le {{ f.saisiLe | dateFr }}@if (f.saisiPar) { par {{ f.saisiPar }} }.
          À enregistrer aussi sur le dispositif fédéral en ligne.
        </p>
      </article>
    } @else if (message(); as m) {
      <div class="alerte" role="alert">{{ m }}</div>
    } @else {
      <p class="vide">Chargement…</p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .retour { display: inline-flex; align-items: center; min-height: 44px; margin-bottom: var(--pas); }
    .actions { display: flex; gap: var(--pas); margin-bottom: var(--pas-2); }
    .rapport { padding: var(--pas-3); max-width: 900px; }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas-2);
             border-bottom: 2px solid var(--profond); padding-bottom: var(--pas); margin-bottom: var(--pas-2); }
    .club { margin: 0; font-weight: 700; color: var(--craie); }
    h1 { margin: 4px 0 0; font-size: 1.375rem; }
    h2 { font-size: 1.0625rem; margin: var(--pas-2) 0 var(--pas); }
    h3 { font-size: .9375rem; margin: var(--pas) 0 4px; }
    .numero { margin: 0; text-align: right; }
    dl { margin: 0; }
    dt { font-size: .8125rem; color: var(--craie); }
    dd { margin: 0; font-weight: 700; }
    .champs { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--pas) var(--pas-2); }
    table { width: 100%; border-collapse: collapse; font-size: .9375rem; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--trait); vertical-align: top; }
    th { font-size: .8125rem; color: var(--craie); }
    .court { width: 7rem; white-space: nowrap; }
    tr.defaut td { background: #FEF2F2; }
    tr.defaut td:first-child { border-left: 3px solid #B91C1C; }
    .precisions { display: block; font-size: .8125rem; color: var(--craie); }
    .decision { display: inline-block; padding: 4px 12px; border-radius: var(--r-s); font-weight: 700; margin: 0; }
    .decision-FAVORABLE { background: var(--acquis-clair); color: var(--acquis); }
    .decision-DEFAVORABLE, .decision-REBUT { background: #FEE2E2; color: #B91C1C; }
    .texte-libre { white-space: pre-line; margin: 4px 0 var(--pas); }
    .conclusion .champs { margin-top: var(--pas-2); }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: var(--pas-3); margin-top: var(--pas-3); }
    .signatures div { border: 1px solid var(--trait); border-radius: var(--r-s); padding: var(--pas); min-height: 110px; }
    .signatures p { margin: 0; font-weight: 700; }
    .pied { margin-top: var(--pas-2); }

    @media (max-width: 600px) {
      .rapport { padding: var(--pas-2); }
      header { flex-direction: column; }
      .numero { text-align: left; }
      .court { width: auto; white-space: normal; }
      .signatures { grid-template-columns: 1fr; }
    }
    @media print {
      .pas-imprime { display: none !important; }
      .rapport { box-shadow: none; border: none; padding: 0; max-width: none; }
      section { break-inside: avoid; }
      tr.defaut td { background: none; }
    }
  `]
})
export class RapportInspectionTivComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  fiche = signal<InspectionTivVue | null>(null);
  message = signal<string | null>(null);

  constructor() {
    void this.charger(Number(this.route.snapshot.paramMap.get('inspectionId')));
  }

  matiere(f: InspectionTivVue): string {
    return f.bloc.matiere === 'ACIER' ? 'Acier' : f.bloc.matiere === 'ALUMINIUM' ? 'Aluminium' : '—';
  }

  robinet(f: InspectionTivVue): string {
    return [f.bloc.robinetterie, f.bloc.numeroRobinet].filter(x => !!x).join(', ') || '—';
  }

  imprimer(): void {
    window.print();
  }

  private async charger(id: number): Promise<void> {
    try {
      this.fiche.set(await firstValueFrom(this.api.inspectionTiv(id)));
    } catch (err) {
      this.message.set((err as HttpErrorResponse).error?.detail ?? "Impossible de charger la fiche d'inspection.");
    }
  }
}
