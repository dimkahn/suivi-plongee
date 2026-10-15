import { Component, ChangeDetectionStrategy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { NavigationService } from '../../core/navigation';
import { IdentiteService } from '../../core/identite.service';
import { periode } from '../../core/date-fr';
import { FonctionPalanquee } from '../../core/modeles';
import {
  CATEGORIES, PalanqueeVue, ParticipantVue, REGIMES, SejourApi, SejourVue, TRANSPORTS, Trajet, euros, heure, jourLong,
  nomComplet
} from './sejour-api';
import { programmeParJour } from './programme-du-jour';

type Rubrique = 'programme' | 'participants' | 'transports' | 'hebergement' | 'affaires' | 'pratique' | 'frais';

const RUBRIQUES: { code: Rubrique; libelle: string }[] = [
  { code: 'programme', libelle: 'Programme' },
  { code: 'participants', libelle: 'Participants' },
  { code: 'transports', libelle: 'Transports' },
  { code: 'hebergement', libelle: 'Hébergement' },
  { code: 'affaires', libelle: 'Affaires à prévoir' },
  { code: 'pratique', libelle: 'Infos pratiques' },
  { code: 'frais', libelle: 'Frais' }
];

const FONCTIONS: Record<FonctionPalanquee, string> = {
  ENCADRANT: 'encadrant', GUIDE_PALANQUEE: 'guide de palanquée', PLONGEUR: 'plongeur'
};

/**
 * Le carnet du séjour mis en page pour le papier (demande du club, 2026) :
 * une page composée de toutes pièces, et non plus l'écran du séjour
 * imprimé tel quel. En-tête de la structure, puis des rubriques en
 * tableaux, à cocher avant d'imprimer. Rien n'est demandé au serveur de
 * plus que le séjour lui-même : ce qu'un participant n'a pas le droit de
 * voir n'y est donc pas. Un encadrant choisit d'y mettre ou non les
 * coordonnées, repas et personnes à prévenir (non par défaut : un carnet
 * imprimé se distribue).
 * Sert sur /sejours/:id/imprimer et dans la page du lien (sejour fourni).
 */
@Component({
  selector: 'app-carnet-imprimable',
  imports: [FormsModule],
  template: `
    @if (vue(); as s) {
      <div class="reglages pas-imprime">
        <div class="reglages-tete">
          <h1>Version imprimable</h1>
          <div class="boutons">
            @if (fournie()) {
              <button type="button" class="bouton-discret" (click)="fermer.emit()">Retour au carnet</button>
            }
            <button type="button" class="bouton-principal" (click)="imprimer()">Imprimer ou enregistrer en PDF</button>
          </div>
        </div>
        <fieldset>
          <legend>Rubriques à imprimer</legend>
          <div class="cases">
            @for (r of rubriques; track r.code) {
              <label class="case"><input type="checkbox" [ngModel]="choisies().has(r.code)"
                     (ngModelChange)="basculer(r.code)" /> {{ r.libelle }}</label>
            }
          </div>
        </fieldset>
        @if (s.encadrant) {
          <label class="case">
            <input type="checkbox" [ngModel]="personnel()" (ngModelChange)="personnel.set($event)" />
            Avec téléphones, repas et personnes à prévenir (version de l'organisateur, à ne pas distribuer)
          </label>
          @if (s.palanquees.length > 0) {
            <label class="case">
              <input type="checkbox" [ngModel]="toutesPalanquees()" (ngModelChange)="toutesPalanquees.set($event)" />
              Toutes les palanquées sous chaque plongée
            </label>
          }
        }
      </div>

      <article class="feuille">
        <header class="tete">
          <img [src]="identite.logo()" alt="" />
          <div>
            @if (identite.nom(); as n) { <p class="structure">{{ n }}</p> }
            <h1>{{ s.sortie.nom }}</h1>
            <p>{{ majuscule(periode(s.sortie.dateDebut, s.sortie.dateFin)) }}@if (s.sortie.lieu) { · {{ s.sortie.lieu }}}</p>
            @if (s.organisateurs.length) {
              <p class="secondaire">Organisé par {{ organisateurs(s) }}</p>
            }
          </div>
        </header>

        @if (voir('programme') && programme().length) {
          <section>
            <h2>Programme</h2>
            <table>
              <tbody>
                @for (j of programme(); track j.jour) {
                  <tr class="jour"><th colspan="3">{{ jourLong(j.jour) }}</th></tr>
                  @for (l of j.lignes; track $index) {
                    <tr>
                      <td class="heure">{{ l.heure }}</td>
                      <td>
                        <strong>{{ l.titre }}</strong>
                        @if (l.details) { <span class="libre">{{ l.details }}</span> }
                        @for (p of palanqueesAImprimer(l.palanquees); track p.numero) {
                          <span class="palanquee">
                            <em>Palanquée {{ p.numero }}@if (profil(p); as t) { ({{ t }})} :</em>
                            @for (m of p.membres; track $index) {
                              {{ $first ? '' : ', ' }}<span [class.moi]="m.moi">{{ m.prenom }} {{ m.nom }}</span>
                              <span class="secondaire"> {{ detailMembre(m) }}</span>
                            }
                          </span>
                        }
                      </td>
                      <td class="lieu">{{ l.lieu }}</td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </section>
        }

        @if (voir('participants') && s.participants.length) {
          <section>
            <h2>Participants ({{ s.participants.length }})</h2>
            <table>
              <thead>
                <tr>
                  <th>Nom</th><th>Arrivée</th><th>Départ</th><th>Voiture</th><th>Chambre</th>
                  @if (personnelVisible()) { <th>Téléphone</th><th>Repas</th><th>À prévenir</th> }
                </tr>
              </thead>
              <tbody>
                @for (p of s.participants; track p.id) {
                  <tr [class.moi]="p.moi">
                    <td>{{ nomComplet(p) }}@if (!p.plongeur) { <span class="secondaire"> (accompagnant)</span>}</td>
                    <td>{{ trajet(p.arrivee, false) }}</td>
                    <td>{{ trajet(p.depart, false) }}</td>
                    <td>{{ voitureDe(s, p.id) }}</td>
                    <td>{{ chambreDe(s, p.id) }}</td>
                    @if (personnelVisible()) {
                      <td>{{ p.telephone }}</td>
                      <td>{{ repas(p) }}</td>
                      <td>{{ urgence(p) }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </section>
        }

        @if (voir('transports') && (voyages().length || s.voitures.length)) {
          <section>
            <h2>Transports</h2>
            @if (voyages().length) {
              <table>
                <thead><tr><th>Voyage</th><th>Qui</th></tr></thead>
                <tbody>
                  @for (v of voyages(); track v.cle) {
                    <tr><td><strong>{{ v.sens }}</strong> — {{ v.texte }}</td><td>{{ v.noms.join(', ') }}</td></tr>
                  }
                </tbody>
              </table>
            }
            @if (s.voitures.length) {
              <h3>Voitures</h3>
              <table>
                <thead><tr><th>Voiture</th><th>Conducteur</th><th>Passagers</th><th>Trajet</th></tr></thead>
                <tbody>
                  @for (v of s.voitures; track v.id) {
                    <tr>
                      <td>{{ v.nom }} <span class="secondaire">({{ v.places }} places)</span></td>
                      <td>{{ nomDe(s, v.conducteurId) }}</td>
                      <td>{{ nomsDe(s, v.passagerIds) }}</td>
                      <td>{{ v.trajet }}@if (v.remarques) { <span class="libre secondaire">{{ v.remarques }}</span> }</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </section>
        }

        @if (voir('hebergement') && s.logements.length) {
          <section>
            <h2>Hébergement</h2>
            @for (l of s.logements; track l.id) {
              <h3>{{ l.nom }}@if (l.adresse) { <span class="secondaire"> — {{ l.adresse }}</span>}</h3>
              @if (l.remarques) { <p class="libre">{{ l.remarques }}</p> }
              @if (l.chambres.length) {
                <table>
                  <thead><tr><th>Chambre</th><th>Occupants</th></tr></thead>
                  <tbody>
                    @for (c of l.chambres; track c.id) {
                      <tr>
                        <td>{{ c.nom }} <span class="secondaire">({{ c.couchages }} couchage{{ c.couchages > 1 ? 's' : '' }})</span></td>
                        <td>{{ nomsDe(s, c.occupantIds) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            }
          </section>
        }

        @if (voir('affaires') && s.affaires.length) {
          <section>
            <h2>Affaires à prévoir</h2>
            <div class="affaires">
              @for (c of categories; track c.code) {
                @if (affairesDe(s, c.code); as liste) {
                  @if (liste.length) {
                    <div>
                      <h3>{{ c.libelle }}</h3>
                      <ul>
                        @for (a of liste; track a.id) {
                          <li><span class="coche" aria-hidden="true"></span>
                            @if (a.indispensable) { <strong>{{ a.libelle }}</strong> } @else { {{ a.libelle }} }</li>
                        }
                      </ul>
                    </div>
                  }
                }
              }
            </div>
            <p class="secondaire">En gras : indispensable.</p>
          </section>
        }

        @if (voir('pratique') && s.infosPratiques) {
          <section>
            <h2>Infos pratiques</h2>
            <p class="libre">{{ s.infosPratiques }}</p>
          </section>
        }

        @if (voir('frais') && s.frais.depenses.length) {
          <section>
            <h2>Frais</h2>
            <p><strong>{{ euros(s.frais.comptes.totalCentimes) }}</strong> dépensés en {{ s.frais.depenses.length }}
              dépense{{ s.frais.depenses.length > 1 ? 's' : '' }}.</p>
            @if (s.frais.comptes.remboursements.length) {
              <h3>Remboursements à faire</h3>
              <table>
                <tbody>
                  @for (r of s.frais.comptes.remboursements; track $index) {
                    <tr><td>{{ nomDe(s, r.deId) }} doit à {{ nomDe(s, r.aId) }}</td><td class="montant">{{ euros(r.montantCentimes) }}</td></tr>
                  }
                </tbody>
              </table>
            } @else {
              <p>Les comptes sont à l'équilibre.</p>
            }
            <h3>Dépenses</h3>
            <table>
              <thead><tr><th>Jour</th><th>Dépense</th><th>Payée par</th><th class="montant">Montant</th></tr></thead>
              <tbody>
                @for (d of s.frais.depenses; track d.id) {
                  <tr>
                    <td>{{ d.jour ? jourLong(d.jour) : '' }}</td><td>{{ d.libelle }}</td>
                    <td>{{ nomDe(s, d.payeurId) }}</td><td class="montant">{{ euros(d.montantCentimes) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </section>
        }

        <footer class="secondaire">Carnet imprimé le {{ imprimeLe }} : la version à jour reste dans l'appli.</footer>
      </article>
    } @else if (erreur(); as e) {
      <div class="alerte erreur">{{ e }}</div>
    } @else {
      <p class="secondaire">Chargement…</p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host { display: block; }
    .reglages { max-width: 60rem; margin: 0 auto var(--pas-2); padding: var(--pas-2); border-radius: var(--r); background: var(--carte); box-shadow: var(--ombre); }
    .reglages-tete { display: flex; justify-content: space-between; align-items: center; gap: var(--pas); flex-wrap: wrap; }
    .reglages-tete h1 { margin: 0; font-size: 1.25rem; }
    .boutons { display: flex; gap: var(--pas); flex-wrap: wrap; }
    fieldset { border: none; padding: 0; margin: var(--pas) 0; }
    legend { font-weight: 700; margin-bottom: 4px; }
    .cases { display: flex; flex-wrap: wrap; gap: 0 var(--pas-2); }
    .case { display: flex; align-items: center; gap: var(--pas); min-height: 44px; }
    .case input { width: 22px; height: 22px; margin: 0; }

    .feuille { background: #fff; color: #111; padding: 24px 28px; border-radius: var(--r); box-shadow: var(--ombre);
               font-size: .9375rem; max-width: 60rem; margin: 0 auto; }
    .tete { display: flex; gap: 16px; align-items: center; border-bottom: 3px solid var(--profond); padding-bottom: 12px; margin-bottom: 8px; }
    .tete img { width: 64px; height: 64px; object-fit: contain; }
    .tete h1 { margin: 0; font-size: 1.6rem; }
    .tete p { margin: 2px 0; }
    .structure { text-transform: uppercase; letter-spacing: .05em; font-size: .8125rem; color: var(--profond-fonce); font-weight: 700; }
    section { margin-top: 18px; }
    h2 { font-size: 1.15rem; margin: 0 0 6px; padding-bottom: 2px; border-bottom: 1px solid var(--trait); color: var(--profond-fonce); }
    h3 { font-size: 1rem; margin: 10px 0 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; vertical-align: top; padding: 4px 6px; border-bottom: 1px solid #E5E7EB; }
    thead th { font-size: .8125rem; text-transform: uppercase; letter-spacing: .03em; color: #4B5563; }
    tr.jour th { background: #F1F5F9; font-size: .9375rem; padding-top: 6px; }
    td.heure { width: 6.5rem; font-weight: 700; white-space: nowrap; }
    td.lieu { width: 30%; color: #4B5563; }
    td.montant, th.montant { text-align: right; white-space: nowrap; }
    .libre { white-space: pre-line; display: block; }
    .palanquee { display: block; margin-top: 2px; font-size: .875rem; }
    .moi { font-weight: 700; }
    tr.moi td { background: #F0F9FF; }
    .secondaire { color: #4B5563; }
    .affaires { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0 18px; }
    .affaires ul { list-style: none; margin: 0; padding: 0; }
    .affaires li { display: flex; gap: 8px; align-items: baseline; padding: 2px 0; }
    .coche { flex: none; width: 12px; height: 12px; border: 1.5px solid #111; border-radius: 2px; transform: translateY(1px); }
    footer { margin-top: 20px; font-size: .8125rem; }
    @media (max-width: 640px) {
      .feuille { padding: 16px; }
      td.lieu { width: auto; }
      td.heure { width: 4rem; }
    }
    @media print {
      .pas-imprime { display: none !important; }
      .feuille { box-shadow: none; padding: 0; max-width: none; border-radius: 0; font-size: 10.5pt; }
      section { break-inside: avoid-page; }
      tr { break-inside: avoid; }
      h2, h3 { break-after: avoid; }
      tr.moi td { background: none; }
    }
  `]
})
export class CarnetImprimableComponent implements OnInit {
  private api = inject(SejourApi);
  private route = inject(ActivatedRoute);
  private navigation = inject(NavigationService);
  readonly identite = inject(IdentiteService);

  /** Le séjour déjà chargé (page du lien) ; sinon lu d'après l'adresse /sejours/:id/imprimer. */
  sejour = input<SejourVue | null>(null);
  /** Page du lien : revenir au carnet. */
  fermer = output<void>();

  readonly rubriques = RUBRIQUES;
  readonly categories = CATEGORIES;
  readonly periode = periode;
  readonly jourLong = jourLong;
  readonly euros = euros;
  readonly nomComplet = nomComplet;
  readonly imprimeLe = new Date().toLocaleDateString('fr-FR');

  private charge = signal<SejourVue | null>(null);
  erreur = signal<string | null>(null);
  readonly vue = computed(() => this.sejour() ?? this.charge());
  readonly fournie = computed(() => !!this.sejour());

  choisies = signal(new Set<Rubrique>(RUBRIQUES.map(r => r.code)));
  personnel = signal(false);
  toutesPalanquees = signal(false);
  readonly personnelVisible = computed(() => !!this.vue()?.encadrant && this.personnel());

  readonly programme = computed(() => {
    const s = this.vue();
    return s ? programmeParJour(s.evenements, s.sortie.seances, s.palanquees) : [];
  });

  /** Les voyages regroupés : même sens, jour, moyen, numéro et heure. */
  readonly voyages = computed(() => {
    const s = this.vue();
    if (!s) return [];
    const groupes = new Map<string, { cle: string; sens: string; texte: string; noms: string[]; tri: string }>();
    for (const p of s.participants) {
      for (const [sens, t] of [['Aller', p.arrivee], ['Retour', p.depart]] as const) {
        if (!t?.date) continue;
        const texte = this.trajet(t);
        const cle = sens + '|' + texte;
        const g = groupes.get(cle) ?? { cle, sens, texte, noms: [], tri: `${sens === 'Aller' ? 0 : 1}${t.date}${t.heure ?? ''}` };
        g.noms.push(nomComplet(p));
        groupes.set(cle, g);
      }
    }
    return [...groupes.values()].sort((a, b) => a.tri.localeCompare(b.tri));
  });

  constructor() {
    this.navigation.preciserRetour(computed(() => {
      const s = this.charge();
      return s ? { libelle: s.sortie.nom, lien: `/sejours/${s.sortie.id}` } : null;
    }));
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.sejour() && id) void this.charger(id);
  }

  private async charger(id: number): Promise<void> {
    try {
      this.charge.set(await firstValueFrom(this.api.lire(id)));
    } catch (e) {
      this.erreur.set(e instanceof HttpErrorResponse && e.error?.detail ? e.error.detail : 'Séjour introuvable.');
    }
  }

  voir(r: Rubrique): boolean {
    return this.choisies().has(r);
  }

  basculer(r: Rubrique): void {
    const s = new Set(this.choisies());
    if (s.has(r)) s.delete(r); else s.add(r);
    this.choisies.set(s);
  }

  imprimer(): void {
    window.print();
  }

  majuscule(t: string): string {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  organisateurs(s: SejourVue): string {
    return s.organisateurs.map(o => o.nomComplet).join(', ');
  }

  /** La sienne seulement, sauf si l'encadrant demande toutes les palanquées. */
  palanqueesAImprimer(liste: PalanqueeVue[]): PalanqueeVue[] {
    return this.toutesPalanquees() ? liste : liste.filter(p => p.membres.some(m => m.moi));
  }

  profil(p: PalanqueeVue): string {
    return [p.profondeur != null ? `${p.profondeur} m` : '', p.duree != null ? `${p.duree} min` : '']
      .filter(Boolean).join(', ');
  }

  detailMembre(m: PalanqueeVue['membres'][number]): string {
    const d = [FONCTIONS[m.fonction], m.aptitude, m.qualificationPreparee ? 'prépare ' + m.qualificationPreparee : '']
      .filter(Boolean).join(', ');
    return `(${d})`;
  }

  /** « 03/06 19h00, avion AF7520, Toulon-Hyères » (sans le lieu dans le tableau des participants). */
  trajet(t: Trajet | null, avecLieu = true): string {
    if (!t) return '';
    const date = t.date ? `${t.date.slice(8, 10)}/${t.date.slice(5, 7)}` : '';
    const moyen = TRANSPORTS.find(x => x.code === t.transport)?.libelle.toLowerCase();
    return [[date, heure(t.heure)].filter(Boolean).join(' '), [moyen, t.numero].filter(Boolean).join(' '), avecLieu ? t.lieu : null]
      .filter(Boolean).join(', ');
  }

  repas(p: ParticipantVue): string {
    const r = REGIMES.filter(x => p.regimes.includes(x.code)).map(x => x.libelle.toLowerCase()).join(', ');
    return [r, p.regimePrecision].filter(Boolean).join(' — ');
  }

  urgence(p: ParticipantVue): string {
    return [p.urgenceNom, p.urgenceTelephone].filter(Boolean).join(' ');
  }

  nomDe(s: SejourVue, id: number | null): string {
    const p = id == null ? undefined : s.participants.find(x => x.id === id);
    return p ? nomComplet(p) : '';
  }

  nomsDe(s: SejourVue, ids: number[]): string {
    return ids.map(i => this.nomDe(s, i)).filter(Boolean).join(', ');
  }

  voitureDe(s: SejourVue, id: number): string {
    return s.voitures.find(v => v.conducteurId === id || v.passagerIds.includes(id))?.nom ?? '';
  }

  chambreDe(s: SejourVue, id: number): string {
    for (const l of s.logements) {
      const c = l.chambres.find(x => x.occupantIds.includes(id));
      if (c) return s.logements.length > 1 ? `${c.nom} (${l.nom})` : c.nom;
    }
    return '';
  }

  affairesDe(s: SejourVue, categorie: string) {
    return s.affaires.filter(a => a.categorie === categorie);
  }
}
