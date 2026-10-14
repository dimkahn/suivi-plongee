import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';
import { dateDuJour } from '../../core/date-fr';
import { CATEGORIES, CategorieAffaire, SejourVue, jourLong, nomComplet, texteTrajet } from './sejour-api';
import { programmeParJour } from './programme-du-jour';

/**
 * Le carnet du séjour en lecture, pour la page du participant entré par le
 * lien et le code (/sejour/…) : son voyage, sa voiture et sa chambre, le
 * programme jour par jour, les voitures, les chambres, les affaires à
 * prévoir et les infos pratiques. Le même contenu que le carnet envoyé par
 * e-mail, mais toujours à jour. Le serveur a déjà retiré les coordonnées,
 * régimes et personnes à prévenir des autres.
 */
@Component({
  selector: 'app-carnet-sejour',
  template: `
    @let s = sejour();
    @if (moi(); as m) {
      <section class="carte mon-voyage" aria-label="Mon voyage">
        <h2>Mon voyage</h2>
        <p><strong>Arrivée :</strong> {{ texteTrajet(m.arrivee) }}</p>
        <p><strong>Départ :</strong> {{ texteTrajet(m.depart) }}</p>
        @for (v of mesVoitures(); track v.id) {
          <p><strong>Voiture :</strong> « {{ v.nom }} »@if (v.trajet) {, {{ v.trajet }}}
            — {{ v.conducteurId === m.id ? 'vous conduisez' : 'conduite par ' + nomDe(v.conducteurId) }}</p>
        }
        @if (maChambre(); as c) {
          <p><strong>Chambre :</strong> « {{ c.chambre }} », {{ c.logement }}@if (c.adresse) { ({{ c.adresse }})}@if (c.avec.length) {, avec {{ c.avec.join(', ') }}}</p>
        }
        <p class="secondaire">Une erreur dans votre voyage ? Corrigez-la dans l'onglet « Mes informations ».</p>
      </section>
    }

    <section>
      <h2>Programme</h2>
      @if (programme().length === 0) { <p class="vide">Rien au programme pour l'instant.</p> }
      @for (j of programme(); track j.jour) {
        <div class="carte jour" [class.aujourdhui]="j.jour === aujourdhui">
          <h3>{{ jourLong(j.jour) }}@if (j.jour === aujourdhui) { · aujourd'hui}</h3>
          <ul class="lignes">
            @for (l of j.lignes; track $index) {
              <li>
                <span class="heure">{{ l.heure }}</span>
                <span class="quoi">
                  <strong>{{ l.titre }}</strong>@if (l.lieu) { <span class="secondaire"> — {{ l.lieu }}</span>}
                  @if (l.details) { <span class="texte-libre secondaire">{{ l.details }}</span> }
                </span>
              </li>
            }
          </ul>
        </div>
      }
    </section>

    <section>
      <h2>Voitures</h2>
      @if (s.voitures.length === 0) { <p class="vide">Aucune voiture pour l'instant.</p> }
      <ul class="cartes">
        @for (v of s.voitures; track v.id) {
          <li class="carte">
            <span class="nom">{{ v.nom }}</span>
            @if (v.trajet) { <p class="secondaire">{{ v.trajet }}</p> }
            <p><strong>Conducteur :</strong> {{ v.conducteurId ? nomDe(v.conducteurId) : 'à trouver' }}</p>
            <p><strong>Passagers :</strong> {{ v.passagerIds.length ? noms(v.passagerIds) : 'aucun' }}</p>
            @if (v.remarques) { <p class="texte-libre secondaire">{{ v.remarques }}</p> }
          </li>
        }
      </ul>
    </section>

    <section>
      <h2>Logements et chambres</h2>
      @if (s.logements.length === 0) { <p class="vide">Aucun logement pour l'instant.</p> }
      @for (l of s.logements; track l.id) {
        <div class="carte logement">
          <h3>{{ l.nom }}</h3>
          @if (l.adresse) { <p class="secondaire">{{ l.adresse }}</p> }
          @if (l.remarques) { <p class="texte-libre secondaire">{{ l.remarques }}</p> }
          <ul class="chambres">
            @for (c of l.chambres; track c.id) {
              <li>
                <strong>{{ c.nom }}</strong>
                @if (c.remarques) { <span class="secondaire"> · {{ c.remarques }}</span> }
                <p>{{ c.occupantIds.length ? noms(c.occupantIds) : 'Libre' }}</p>
              </li>
            }
          </ul>
        </div>
      }
    </section>

    <section>
      <h2>Affaires à prévoir</h2>
      @if (s.affaires.length === 0) { <p class="vide">Pas encore de liste.</p> }
      <div class="deux-colonnes">
        @for (c of categories; track c.code) {
          @if (affairesDe(c.code).length > 0) {
            <div>
              <h3>{{ c.libelle }}</h3>
              <ul class="coches">
                @for (a of affairesDe(c.code); track a.id) {
                  <li>{{ a.libelle }}@if (a.indispensable) { <strong class="indispensable">indispensable</strong> }</li>
                }
              </ul>
            </div>
          }
        }
      </div>
    </section>

    <section>
      <h2>Infos pratiques</h2>
      @if (s.infosPratiques) {
        <p class="carte texte-libre">{{ s.infosPratiques }}</p>
      } @else {
        <p class="vide">Rien pour l'instant.</p>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h2 { margin: var(--pas-3, 24px) 0 var(--pas); }
    h3 { margin: var(--pas) 0; font-size: 1rem; }
    .mon-voyage { padding: var(--pas-2); margin: var(--pas-2) 0; border-left: 6px solid var(--profond); }
    .mon-voyage h2 { margin-top: 0; }
    .mon-voyage p { margin: var(--pas) 0 0; }
    .cartes { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2);
              grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .cartes > li { padding: var(--pas-2); }
    .cartes p { margin: var(--pas) 0 0; }
    .nom { font-weight: 700; }
    .texte-libre { white-space: pre-line; display: block; }
    .jour { padding: var(--pas-2); margin-bottom: var(--pas-2); }
    .jour.aujourdhui { border-left: 6px solid var(--profond); }
    .jour h3 { margin-top: 0; }
    .lignes { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas); }
    .lignes li { display: flex; gap: var(--pas-2); align-items: flex-start; }
    .heure { flex: none; width: 6.5rem; font-weight: 700; color: var(--profond-fonce); }
    .quoi { flex: 1; }
    .logement { padding: var(--pas-2); margin-bottom: var(--pas-2); }
    .logement h3 { margin: 0; }
    .chambres { list-style: none; margin: var(--pas) 0 0; padding: 0; display: grid; gap: var(--pas);
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
    .chambres li { border: 1px solid var(--trait); border-radius: var(--r-s); padding: var(--pas); }
    .chambres p { margin: var(--pas) 0 0; }
    .deux-colonnes { display: grid; gap: var(--pas-2); grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
    .coches { margin: 0; padding-left: 1.25rem; display: grid; gap: var(--pas); }
    .indispensable { font-size: .8125rem; color: var(--en-cours); margin-left: var(--pas); }
    @media (max-width: 640px) { .heure { width: 4.5rem; } }
  `]
})
export class CarnetSejourComponent {
  sejour = input.required<SejourVue>();

  readonly jourLong = jourLong;
  readonly texteTrajet = texteTrajet;
  readonly categories = CATEGORIES;
  readonly aujourdhui = dateDuJour();

  readonly moi = computed(() => this.sejour().participants.find(p => p.moi) ?? null);
  readonly programme = computed(() => programmeParJour(this.sejour().evenements, this.sejour().sortie.seances));
  private readonly parId = computed(() => new Map(this.sejour().participants.map(p => [p.id, p])));

  readonly mesVoitures = computed(() => {
    const m = this.moi();
    return m ? this.sejour().voitures.filter(v => v.conducteurId === m.id || v.passagerIds.includes(m.id)) : [];
  });

  readonly maChambre = computed(() => {
    const m = this.moi();
    if (!m) return null;
    for (const l of this.sejour().logements) {
      for (const c of l.chambres) {
        if (c.occupantIds.includes(m.id)) {
          return { chambre: c.nom, logement: l.nom, adresse: l.adresse,
                   avec: c.occupantIds.filter(o => o !== m.id).map(o => this.nomDe(o)) };
        }
      }
    }
    return null;
  });

  nomDe(id: number | null): string {
    const p = id === null ? undefined : this.parId().get(id);
    return p ? nomComplet(p) : '?';
  }

  noms(ids: number[]): string {
    return ids.map(i => this.nomDe(i)).join(', ');
  }

  affairesDe(c: CategorieAffaire) {
    return this.sejour().affaires.filter(a => a.categorie === c);
  }
}
