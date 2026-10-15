import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import { dateDuJour } from '../../core/date-fr';
import {
  CATEGORIES, CategorieAffaire, ParticipantVue, SejourVue, TRANSPORTS, heure, jourLong, nomComplet
} from './sejour-api';
import { programmeParJour } from './programme-du-jour';
import { PalanqueesPlongeeComponent } from './palanquees-plongee.component';
import { CibleMonSejour, MonSejourComponent } from './mon-sejour.component';
import { MailLoueurComponent } from './mail-loueur.component';

type Rubrique = 'programme' | 'transports' | 'logements' | 'affaires' | 'pratique';

/** Un morceau de texte libre : du texte, ou un numéro de téléphone à appeler d'un appui. */
interface Morceau {
  texte: string;
  tel: string | null;
}

/** Les numéros français (06 00 00 00 00, +33 6…) et les numéros courts d'urgence (15, 17, 18, 112, 196). */
const NUMERO = /(?:\+33\s?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b|\b(?:112|196|15|17|18|114)\b/g;

/**
 * Le carnet du séjour en lecture, pour la page du participant entré par le
 * lien et le code (/sejour/…), vue par tous les participants : d'abord
 * « Mon séjour » (la même carte que dans l'appli, ce qui manque en
 * orange), puis un sommaire et les rubriques non vides : programme jour
 * par jour, transports (qui arrive et repart avec qui, voitures),
 * logements et chambres, affaires à prévoir, infos pratiques. Le contenu
 * du carnet envoyé par e-mail, toujours à jour. Le serveur a déjà retiré
 * les coordonnées, régimes et personnes à prévenir des autres.
 */
@Component({
  selector: 'app-carnet-sejour',
  imports: [MonSejourComponent, PalanqueesPlongeeComponent, MailLoueurComponent],
  template: `
    @let s = sejour();
    @if (moi(); as m) {
      <app-mon-sejour [sejour]="s" [moi]="m" (ouvrir)="ouvrirDepuisMonSejour($event)" />
    }

    @if (sommaire().length > 1) {
      <nav class="sommaire" aria-label="Rubriques du carnet">
        @for (r of sommaire(); track r.code) {
          <button type="button" class="bouton-discret" (click)="allerA(r.code)">{{ r.libelle }}</button>
        }
      </nav>
    }

    <section id="carnet-programme" aria-labelledby="t-programme">
      <h2 id="t-programme">Programme</h2>
      @if (programme().length === 0) { <p class="vide">Le programme sera bientôt là.</p> }
      @for (j of programme(); track j.jour) {
        <div class="carte jour" [class.aujourdhui]="j.jour === aujourdhui" [class.passe]="j.jour < aujourdhui">
          <h3>{{ jourLong(j.jour) }}@if (j.jour === aujourdhui) { <span class="pastille">aujourd'hui</span>}</h3>
          <ul class="lignes">
            @for (l of j.lignes; track $index) {
              <li>
                <span class="heure">{{ l.heure }}</span>
                <span class="quoi">
                  <strong>{{ l.titre }}</strong>@if (l.lieu) { <span class="secondaire"> — {{ l.lieu }}</span>}
                  @if (l.details) { <span class="texte-libre secondaire">{{ l.details }}</span> }
                  @if (l.palanquees.length > 0) { <app-palanquees-plongee [palanquees]="l.palanquees" /> }
                </span>
              </li>
            }
          </ul>
        </div>
      }
    </section>

    @if (aDesTransports()) {
      <section id="carnet-transports" aria-labelledby="t-transports">
        <h2 id="t-transports">Transports</h2>
        @for (sens of voyages(); track sens.libelle) {
          @if (sens.groupes.length > 0) {
            <h3>{{ sens.libelle }}</h3>
            <ul class="cartes">
              @for (g of sens.groupes; track $index) {
                <li class="carte" [class.a-moi]="g.avecMoi">
                  <span class="nom">{{ g.quand }}</span>
                  @if (g.precision) { <p class="secondaire">{{ g.precision }}</p> }
                  <p>{{ g.noms }}</p>
                </li>
              }
            </ul>
          }
        }
        @if (s.voitures.length > 0) {
          <h3>Voitures</h3>
          <ul class="cartes">
            @for (v of s.voitures; track v.id) {
              <li class="carte" [class.a-moi]="estDans(v.conducteurId, v.passagerIds)">
                <span class="nom">{{ v.nom }}</span>
                @if (v.trajet) { <p class="secondaire">{{ v.trajet }}</p> }
                <p><strong>Conducteur :</strong> {{ v.conducteurId ? nomDe(v.conducteurId) : 'à trouver' }}</p>
                <p><strong>Passagers :</strong> {{ v.passagerIds.length ? noms(v.passagerIds) : 'aucun' }}</p>
                @if (v.remarques) { <p class="texte-libre secondaire">{{ v.remarques }}</p> }
                @if (v.locationHtml) { <app-mail-loueur [html]="v.locationHtml" /> }
              </li>
            }
          </ul>
        }
      </section>
    }

    @if (s.logements.length > 0) {
      <section id="carnet-logements" aria-labelledby="t-logements">
        <h2 id="t-logements">Logements et chambres</h2>
        @for (l of s.logements; track l.id) {
          <div class="carte logement">
            <h3>{{ l.nom }}</h3>
            @if (l.adresse) {
              <a class="adresse" [href]="lienCarte(l.adresse)" target="_blank" rel="noopener">{{ l.adresse }} — voir sur la carte</a>
            }
            @if (l.remarques) { <p class="texte-libre secondaire">{{ l.remarques }}</p> }
            <ul class="chambres">
              @for (c of l.chambres; track c.id) {
                <li [class.a-moi]="estDans(null, c.occupantIds)">
                  <strong>{{ c.nom }}</strong>
                  @if (c.remarques) { <span class="secondaire"> · {{ c.remarques }}</span> }
                  <p>{{ c.occupantIds.length ? noms(c.occupantIds) : 'Libre' }}</p>
                </li>
              }
            </ul>
          </div>
        }
      </section>
    }

    @if (s.affaires.length > 0) {
      <section id="carnet-affaires" aria-labelledby="t-affaires">
        <h2 id="t-affaires">Affaires à prévoir</h2>
        <div class="deux-colonnes">
          @for (c of categories; track c.code) {
            @if (affairesDe(c.code).length > 0) {
              <div class="carte bloc-affaires">
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
    }

    @if (s.infosPratiques) {
      <section id="carnet-pratique" aria-labelledby="t-pratique">
        <h2 id="t-pratique">Infos pratiques</h2>
        <p class="carte texte-libre infos">@for (m of infos(); track $index) {@if (m.tel) {<a [href]="'tel:' + m.tel">{{ m.texte }}</a>} @else {<span>{{ m.texte }}</span>}}</p>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    section { scroll-margin-top: var(--pas-2); }
    h2 { margin: var(--pas-3, 24px) 0 var(--pas); }
    h3 { margin: var(--pas-2) 0 var(--pas); font-size: 1rem; }
    .sommaire { display: flex; flex-wrap: wrap; gap: var(--pas); margin: var(--pas-2) 0 0; }
    .sommaire button { white-space: nowrap; }
    .cartes { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas);
              grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .cartes > li { padding: var(--pas-2); }
    .cartes p { margin: var(--pas) 0 0; }
    .a-moi { border-left: 6px solid var(--profond); }
    .nom { font-weight: 700; }
    .texte-libre { white-space: pre-line; display: block; }
    .jour { padding: var(--pas-2); margin-bottom: var(--pas); }
    .jour.aujourdhui { border-left: 6px solid var(--profond); }
    .jour.passe { opacity: .6; }
    .jour h3 { margin: 0 0 var(--pas); display: flex; align-items: center; gap: var(--pas); }
    .pastille { padding: 2px 10px; border-radius: var(--r-s); font-size: .8125rem; background: var(--profond); color: #fff; }
    .lignes { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas); }
    .lignes li { display: flex; gap: var(--pas-2); align-items: flex-start; }
    .heure { flex: none; width: 6.5rem; font-weight: 700; color: var(--profond-fonce); }
    .quoi { flex: 1; min-width: 0; }
    .logement { padding: var(--pas-2); margin-bottom: var(--pas); }
    .logement h3 { margin: 0; }
    .adresse { display: inline-flex; align-items: center; min-height: 44px; }
    .chambres { list-style: none; margin: var(--pas) 0 0; padding: 0; display: grid; gap: var(--pas);
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
    .chambres li { border: 1px solid var(--trait); border-radius: var(--r-s); padding: var(--pas); }
    .chambres li.a-moi { border-left-width: 6px; border-left-color: var(--profond); }
    .chambres p { margin: var(--pas) 0 0; }
    .deux-colonnes { display: grid; gap: var(--pas); grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
    .bloc-affaires { padding: var(--pas-2); }
    .bloc-affaires h3 { margin-top: 0; }
    .coches { margin: 0; padding-left: 1.25rem; display: grid; gap: var(--pas); }
    .indispensable { font-size: .8125rem; color: var(--en-cours); margin-left: var(--pas); }
    .infos { padding: var(--pas-2); margin: 0; overflow-wrap: anywhere; }
    @media (max-width: 640px) { .heure { width: 4.5rem; } }
  `]
})
export class CarnetSejourComponent {
  sejour = input.required<SejourVue>();
  /** « Modifier mes informations » ou « Mes comptes » : l'onglet de la page qui s'en occupe. */
  ouvrirOnglet = output<'infos' | 'frais'>();

  readonly jourLong = jourLong;
  readonly categories = CATEGORIES;
  readonly aujourdhui = dateDuJour();

  readonly moi = computed(() => this.sejour().participants.find(p => p.moi) ?? null);
  readonly programme = computed(() => programmeParJour(this.sejour().evenements, this.sejour().sortie.seances, this.sejour().palanquees));
  private readonly parId = computed(() => new Map(this.sejour().participants.map(p => [p.id, p])));

  /** Arrivées et départs regroupés par jour, heure et vol : qui voyage ensemble. */
  readonly voyages = computed(() => [
    { libelle: 'Arrivées', groupes: this.groupes('arrivee') },
    { libelle: 'Départs', groupes: this.groupes('depart') }
  ]);

  readonly aDesTransports = computed(() =>
    this.sejour().voitures.length > 0 || this.voyages().some(v => v.groupes.length > 0));

  readonly sommaire = computed(() => {
    const s = this.sejour();
    const liste: { code: Rubrique; libelle: string; present: boolean }[] = [
      { code: 'programme', libelle: 'Programme', present: true },
      { code: 'transports', libelle: 'Transports', present: this.aDesTransports() },
      { code: 'logements', libelle: 'Chambres', present: s.logements.length > 0 },
      { code: 'affaires', libelle: 'Affaires', present: s.affaires.length > 0 },
      { code: 'pratique', libelle: 'Infos pratiques', present: !!s.infosPratiques }
    ];
    return liste.filter(r => r.present);
  });

  /** Les infos pratiques, numéros de téléphone à appeler d'un appui. */
  readonly infos = computed<Morceau[]>(() => {
    const texte = this.sejour().infosPratiques ?? '';
    const morceaux: Morceau[] = [];
    let debut = 0;
    for (const t of texte.matchAll(NUMERO)) {
      if (t.index > debut) morceaux.push({ texte: texte.slice(debut, t.index), tel: null });
      morceaux.push({ texte: t[0], tel: t[0].replace(/[\s.-]/g, '') });
      debut = t.index + t[0].length;
    }
    if (debut < texte.length) morceaux.push({ texte: texte.slice(debut), tel: null });
    return morceaux;
  });

  /** Une tuile de « Mon séjour » : la rubrique du carnet qui en donne le détail, ou l'onglet qui s'en occupe. */
  ouvrirDepuisMonSejour(cible: CibleMonSejour): void {
    if (cible === 'infos' || cible === 'frais') {
      this.ouvrirOnglet.emit(cible);
    } else if (cible === 'hebergement' && this.sejour().logements.length > 0) {
      this.allerA('logements');
    } else if (cible === 'transports' && this.aDesTransports()) {
      this.allerA('transports');
    } else {
      // Rien à montrer dans le carnet : c'est à lui de compléter (voyage), ou rien n'est encore prévu.
      this.ouvrirOnglet.emit('infos');
    }
  }

  allerA(r: Rubrique): void {
    document.getElementById('carnet-' + r)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  lienCarte(adresse: string): string {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(adresse);
  }

  nomDe(id: number | null): string {
    const p = id === null ? undefined : this.parId().get(id);
    if (!p) return '?';
    return p.moi ? nomComplet(p) + ' (vous)' : nomComplet(p);
  }

  noms(ids: number[]): string {
    return ids.map(i => this.nomDe(i)).join(', ');
  }

  estDans(conducteurId: number | null, autres: number[]): boolean {
    const m = this.moi();
    return !!m && (conducteurId === m.id || autres.includes(m.id));
  }

  affairesDe(c: CategorieAffaire) {
    return this.sejour().affaires.filter(a => a.categorie === c);
  }

  private groupes(sens: 'arrivee' | 'depart') {
    const groupes = new Map<string, { tri: string; quand: string; precision: string; noms: string; ids: number[];
                                      avecMoi: boolean }>();
    for (const p of this.sejour().participants as ParticipantVue[]) {
      const t = p[sens];
      if (!t || (!t.date && !t.heure)) continue;
      const cle = [t.date, t.heure?.slice(0, 5), t.transport, t.numero, t.lieu].join('|');
      const g = groupes.get(cle) ?? {
        tri: `${t.date ?? ''} ${t.heure ?? ''}`,
        quand: t.date ? jourLong(t.date) + (t.heure ? ' à ' + heure(t.heure) : '') : 'À ' + heure(t.heure),
        precision: [[TRANSPORTS.find(x => x.code === t.transport)?.libelle, t.numero].filter(Boolean).join(' '), t.lieu]
          .filter(Boolean).join(' · '),
        noms: '', ids: [], avecMoi: false
      };
      g.ids.push(p.id);
      g.avecMoi ||= p.moi;
      groupes.set(cle, g);
    }
    return [...groupes.values()]
      .map(g => ({ ...g, noms: this.noms(g.ids) }))
      .sort((a, b) => a.tri.localeCompare(b.tri));
  }
}
