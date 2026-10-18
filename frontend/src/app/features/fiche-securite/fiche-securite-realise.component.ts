import { Component, DestroyRef, HostListener, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FileEcrituresService } from '../../core/file-ecritures.service';
import { FicheSecuriteVue, PalanqueeVue, PlongeurVue, SeanceVue } from '../../core/modeles';
import { DateFrPipe, dateDuJour } from '../../core/date-fr';
import { lieuEtSite } from '../../core/seance-lieu';
import { empreinteFiche, nomPalanquee } from '../../core/fiche-securite';
import {
  bilanRealise, dureeEntre, etatPalanquee, marquerSortie, minutesDepuis, trierParUrgence
} from '../../core/fiche-securite-realise';
import { AvecModifications } from '../../core/gardes';
import { telechargerFichier } from '../../core/telecharger';

/**
 * Étape 2, à part de l'établissement (voir FicheSecuriteComponent) : le
 * profil réellement plongé, saisi au retour, sans repasser par le directeur
 * de plongée, les conditions ou la composition des palanquées. Un écran
 * séparé plutôt qu'une section de la même page : ce n'est pas le même
 * moment (avant la mise à l'eau / au retour), ni forcément la même personne
 * qui saisit.
 */
@Component({
  selector: 'app-fiche-securite-realise',
  imports: [FormsModule, RouterLink, DateFrPipe],
  template: `
    @if (seance(); as s) {
      <h1>Compléter la fiche — {{ s.date | dateFr }}{{ lieuEtSite(s) ? ' — ' + lieuEtSite(s) : '' }}</h1>
      <p class="secondaire">
        {{ s.milieu === 'NATUREL' ? 'Milieu naturel' : 'Milieu artificiel' }}
        {{ s.profondeurMax ? ' · ' + s.profondeurMax + ' m max' : '' }}
      </p>
    }

    <!-- Une fois la fiche ouverte, les messages s'affichent dans la barre du bas, à côté du bouton. -->
    @if ((chargement() || !ficheEtablie()) && message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (!ficheEtablie()) {
      <p class="vide">
        Cette séance n'a pas encore de fiche de sécurité établie.
        @if (auth.etablitFichesSecurite()) {
          <a [routerLink]="['/fiches-securite', seanceId]">Établir la fiche</a> d'abord.
        } @else {
          Un moniteur E3 ou E4 (ou qui en a reçu le droit) doit d'abord l'établir.
        }
      </p>
    } @else {
      <p class="secondaire">
        Le profil réellement plongé par chaque palanquée. Sans effet sur le
        directeur de plongée, les conditions ou la composition des palanquées.
      </p>

      <!-- D'un coup d'œil, et toujours en haut : qui est encore à l'eau, qui dépasse, ce qui reste à saisir. -->
      @if (bilan(); as b) {
        <p class="bilan" role="status">
          @if (enDepassement() > 0) {
            <span class="pastille urgence">⛔ {{ enDepassement() }} en dépassement</span>
          }
          <span class="pastille etat-a-immerger">{{ b.aImmerger }} à immerger</span>
          <span class="pastille etat-a-l-eau">{{ b.aLEau }} à l'eau</span>
          <span class="pastille etat-sortie">{{ b.sorties }} {{ b.sorties > 1 ? 'sorties' : 'sortie' }}</span>
          @if (b.aCompleter > 0) {
            <span class="pastille a-completer">{{ b.aCompleter }} profil{{ b.aCompleter > 1 ? 's' : '' }} à compléter</span>
          }
        </p>
      }

      <div class="ligne-outils">
        <!-- La recherche ne sert qu'avec beaucoup de palanquées. -->
        @if (palanquees().length > 4) {
          <div>
            <label for="rechercheRealise">Retrouver une palanquée par un de ses plongeurs</label>
            <input id="rechercheRealise" type="text" placeholder="Nom ou prénom…"
                   [ngModel]="rechercheRealise()" (ngModelChange)="rechercheRealise.set($event)">
          </div>
        }
        <details class="reglage-alerte">
          <summary>Alerte {{ seuilAlerteMinutes() }} min avant la sortie prévue</summary>
          <label for="seuilAlerte">Alerter (min) avant l'heure de sortie prévue</label>
          <input id="seuilAlerte" type="number" min="1" class="champ-seuil"
                 [ngModel]="seuilAlerteMinutes()" (ngModelChange)="seuilAlerteMinutes.set($event)">
        </details>
      </div>

      @if (palanqueesFiltrees().length === 0) {
        <p class="vide">Aucune palanquée ne correspond à « {{ rechercheRealise() }} ».</p>
      }

      @for (p of palanqueesFiltrees(); track p) {
        <section class="carte panneau palanquee" [class]="'etat-' + etatPalanquee(p)"
                 [class.palanquee-attention]="statutPalanquee(p) === 'attention'"
                 [class.palanquee-urgence]="statutPalanquee(p) === 'urgence'">
          <div class="ligne-titre">
            <h3>{{ nomPalanquee(p) }}</h3>
            <span class="etat">
              @switch (etatPalanquee(p)) {
                @case ('a-immerger') { À immerger }
                @case ('a-l-eau') { À l'eau depuis {{ tempsALEau(p) }} min }
                @case ('sortie') { Sortie{{ p.heureSortie ? ' à ' + p.heureSortie.slice(0, 5) : '' }} }
              }
            </span>
          </div>
          <p class="membres">
            @for (m of p.membres; track m; let last = $last) {
              <span [class.correspondance]="estCorrespondance(m)">{{ m.prenom }} {{ m.nom }}</span>{{ last ? '' : ', ' }}
            }
          </p>
          <p class="prevu">
            Prévu : {{ p.profondeurPrevue ? p.profondeurPrevue + ' m' : '—' }}
            / {{ p.dureePrevue ? p.dureePrevue + ' min' : '—' }}
            @if (sortiePrevue(p); as h) { · sortie prévue vers {{ h }} }
          </p>
          @if (statutPalanquee(p) === 'attention') {
            <p class="alerte-texte attention">⚠ Sortie prévue dans moins de {{ seuilAlerteMinutes() }} min.</p>
          } @else if (statutPalanquee(p) === 'urgence') {
            <p class="alerte-texte urgence">⛔ Durée prévue dépassée, sortie non renseignée.</p>
          }

          <!-- Un seul geste à la fois : l'immersion, puis la sortie ; une heure notée ne s'écrase plus d'un appui. -->
          @switch (etatPalanquee(p)) {
            @case ('a-immerger') {
              <button type="button" class="bouton-principal bouton-chrono" [disabled]="envoiRealise()"
                      (click)="marquerImmersion(p)">▶ Immersion maintenant</button>
            }
            @case ('a-l-eau') {
              <button type="button" class="bouton-principal bouton-chrono bouton-sortie" [disabled]="envoiRealise()"
                      (click)="marquerSortieMaintenant(p)">■ Sortie maintenant</button>
            }
          }
          <!-- Un appui de trop, doigt mouillé : quelques secondes pour revenir en arrière. -->
          @if (derniereMarque()?.numero === p.numero) {
            <button type="button" class="bouton-discret annuler-marque" (click)="annulerMarque()">
              ↶ Annuler {{ derniereMarque()!.libelle }}
            </button>
          }

          <!-- Toujours là : une fiche se complète aussi après coup, sans heures notées sur le moment. -->
          <div class="ligne-profil">
            <label>Profondeur réalisée (m) <input type="number" min="0" inputmode="numeric"
                   [(ngModel)]="p.profondeurRealisee" [name]="'preal-' + p.numero"></label>
            <label>Durée réalisée (min) <input type="number" min="0" inputmode="numeric"
                   [(ngModel)]="p.dureeRealisee" [name]="'dreal-' + p.numero"></label>
            <label>Paliers <input type="text" placeholder="ex. 3 min à 3 m" [(ngModel)]="p.paliers"
                   [name]="'pal-' + p.numero"></label>
          </div>

          <details class="corriger-heures">
            <summary>
              Corriger les heures
              <span class="secondaire">
                — immersion {{ p.heureImmersion ? p.heureImmersion.slice(0, 5) : '—' }},
                sortie {{ p.heureSortie ? p.heureSortie.slice(0, 5) : '—' }}
              </span>
            </summary>
            <div class="ligne-profil">
              <label>Immersion <input type="time" [(ngModel)]="p.heureImmersion" [name]="'hi-' + p.numero"></label>
              <label>Sortie <input type="time" [(ngModel)]="p.heureSortie" [name]="'hs-' + p.numero"></label>
            </div>
            @if (dureeCalculee(p); as d) {
              @if (d !== p.dureeRealisee) {
                <button type="button" class="bouton-discret recalculer" (click)="p.dureeRealisee = d">
                  Durée réalisée d'après ces heures : {{ d }} min
                </button>
              }
            }
          </details>
        </section>
      }

      <section class="carte panneau impression">
        <h3>Imprimer ou archiver</h3>
        <label class="case">
          <input type="checkbox" id="regrouper-export" [checked]="regrouper()" (change)="regrouper.set(!regrouper())">
          Regrouper les 2 plongées du jour sur une feuille
        </label>
        <div class="boutons-impression">
          <button type="button" class="bouton-discret" (click)="telechargerPdf()" [disabled]="exportEnCours()">
            {{ exportEnCours() ? 'Génération…' : 'Télécharger le PDF' }}
          </button>
          <button type="button" class="bouton-discret" (click)="telechargerExcel()" [disabled]="exportExcelEnCours()">
            {{ exportExcelEnCours() ? 'Génération…' : "Télécharger l'Excel" }}
          </button>
          @if ((auth.estMoniteur() || auth.estAdmin()) && sortie(); as so) {
            <button type="button" class="bouton-discret" (click)="telechargerPdfSortie(so.id)"
                    [disabled]="exportSortieEnCours()">
              {{ exportSortieEnCours() ? 'Génération…' : 'Toutes les fiches de « ' + so.nom + ' » (PDF)' }}
            </button>
          }
        </div>
        <p class="secondaire">Le PDF et l'Excel reprennent ce qui est enregistré : enregistrez d'abord vos saisies.</p>
      </section>

      <!-- Toujours à portée de doigt, au-dessus de la barre d'onglets du téléphone. -->
      <div class="actions-bas">
        @if (message(); as m) {
          <div class="alerte message-bas" role="status">
            {{ m }}
            <button type="button" class="bouton-discret" aria-label="Fermer le message" (click)="message.set(null)">✕</button>
          </div>
        }
        <button type="button" class="bouton-principal" (click)="enregistrerRealise()" [disabled]="envoiRealise()">
          {{ envoiRealise() ? 'Enregistrement…' : 'Enregistrer les paramètres réalisés' }}
        </button>
        <span class="etat-enregistrement" [class.a-enregistrer]="modificationsNonEnregistrees()" role="status">
          @if (modificationsNonEnregistrees()) { ● Modifications non enregistrées } @else { ✓ Enregistré }
        </span>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin: var(--pas-3) 0 0; }
    .panneau { padding: var(--pas-3); margin: var(--pas-2) 0 var(--pas-3); }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }

    .membres { margin: 0 0 var(--pas-2); color: var(--craie); }
    .prevu { margin: 0 0 var(--pas-2); font-size: .8125rem; color: var(--craie); font-weight: 700; }
    .correspondance {
      background: #fff3b0; color: #1c2d33; border-radius: 3px; padding: 0 3px; font-weight: 700;
    }

    .ligne-profil {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--pas);
      font-size: .8125rem; margin-bottom: var(--pas);
    }
    .ligne-profil label { margin: 0; font-weight: 400; }
    .ligne-profil input { width: 100%; }

    .ligne-titre { display: flex; justify-content: space-between; align-items: baseline; gap: var(--pas); flex-wrap: wrap; }
    .ligne-titre h3 { margin: 0; }
    .etat { font-weight: 700; font-size: .875rem; }
    .etat-a-l-eau { border-left: 4px solid var(--profond); }
    .etat-a-l-eau .etat { color: var(--profond); }
    .etat-sortie .etat { color: #2E7D32; }

    /* Le geste du moment, grand et seul : mains mouillées, bord de bassin. */
    .bouton-chrono { width: 100%; min-height: 56px; font-size: 1.0625rem; margin: 0 0 var(--pas-2); }
    .bouton-sortie { background: #2E7D32; border-color: #2E7D32; }

    .corriger-heures summary {
      cursor: pointer; min-height: 44px; display: flex; align-items: center; gap: var(--pas);
      flex-wrap: wrap; font-size: .875rem; color: var(--profond);
    }
    .corriger-heures .secondaire { margin: 0; }
    .recalculer { min-height: 44px; }

    .bilan {
      display: flex; flex-wrap: wrap; gap: var(--pas); margin: 0 0 var(--pas-2);
      position: sticky; top: 0; z-index: 5; padding: var(--pas) 0; background: var(--fond);
    }
    .pastille.urgence { color: #fff; background: #B3261E; border-color: #B3261E; }
    .annuler-marque { min-height: 44px; margin: 0 0 var(--pas-2); }
    .reglage-alerte summary {
      cursor: pointer; min-height: 44px; display: flex; align-items: center; font-size: .875rem; color: var(--profond);
    }
    .pastille {
      padding: 4px var(--pas-2); border-radius: 999px; font-size: .875rem; font-weight: 700;
      background: var(--brume, #eef4f5); border: 1px solid var(--trait);
    }
    .pastille.etat-a-l-eau { border: 1px solid var(--profond); color: var(--profond); }
    .pastille.etat-sortie { color: #2E7D32; }
    .pastille.a-completer { color: #8a5a00; border-color: #B98A00; background: #FFF8E5; }

    .etat-enregistrement { font-size: .875rem; color: var(--craie); }
    .etat-enregistrement.a-enregistrer { color: #8a5a00; font-weight: 700; }

    .ligne-outils { display: flex; gap: var(--pas-3); flex-wrap: wrap; align-items: flex-end; margin-bottom: var(--pas-2); }
    #rechercheRealise { max-width: 320px; }
    .champ-seuil { max-width: 80px; }

    .palanquee-attention { border: 2px solid #B98A00; background: #FFF8E5; }
    .palanquee-urgence { border: 2px solid #B3261E; background: #FDECEB; }
    .alerte-texte { margin: 0 0 var(--pas-2); font-weight: 700; font-size: .875rem; }
    .alerte-texte.attention { color: #8a5a00; }
    .alerte-texte.urgence { color: #B3261E; }

    .impression h3 { margin: 0 0 var(--pas); }
    .impression .case { display: flex; align-items: center; gap: var(--pas); font-weight: 400; min-height: 44px; margin: 0; }
    .impression .case input { width: 22px; height: 22px; }
    .boutons-impression { display: flex; gap: var(--pas-2); flex-wrap: wrap; margin: var(--pas) 0; }
    .impression .secondaire { margin: 0; }

    .actions-bas {
      position: sticky; bottom: var(--hauteur-onglets); z-index: 6;
      display: flex; gap: var(--pas-2); flex-wrap: wrap; align-items: center;
      margin: var(--pas-3) 0; padding: var(--pas-2) 0; background: var(--fond); border-top: 1px solid var(--trait);
    }
    .actions-bas .bouton-principal { width: auto; margin: 0; }
    .message-bas { flex: 1 1 100%; margin: 0; display: flex; align-items: center; justify-content: space-between; gap: var(--pas); }
    .message-bas button { min-width: 44px; min-height: 44px; }
  `]
})
export class FicheSecuriteRealiseComponent implements AvecModifications {
  readonly lieuEtSite = lieuEtSite;
  readonly nomPalanquee = nomPalanquee;
  private api = inject(ApiService);
  private file = inject(FileEcrituresService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  auth = inject(AuthService);

  seanceId = Number(this.route.snapshot.paramMap.get('id'));

  /** Seuil d'alerte avant l'heure de sortie prévue, paramétrable à l'écran (non persisté). */
  seuilAlerteMinutes = signal(5);
  /** Horloge rafraîchie régulièrement pour recalculer les alertes des palanquées encore à l'eau. */
  private maintenant = signal(new Date());

  seance = signal<SeanceVue | null>(null);
  chargement = signal(true);
  message = signal<string | null>(null);
  envoiRealise = signal(false);
  exportEnCours = signal(false);
  exportExcelEnCours = signal(false);
  /** Deux plongées du même jour au même lieu sur une feuille (1er et 2e tour), sinon une feuille par plongée. */
  regrouper = signal(true);
  exportSortieEnCours = signal(false);

  ficheEtablie = signal(false);
  sortie = signal<{ id: number; nom: string } | null>(null);
  palanquees = signal<PalanqueeVue[]>([]);

  rechercheRealise = signal('');
  /**
   * Ne garde que les palanquées ayant au moins un plongeur correspondant à
   * la recherche ; celles en dépassement ou près de sortir passent en tête,
   * recalculé à chaque battement de l'horloge.
   */
  palanqueesFiltrees = computed(() => {
    const gardees = !this.rechercheRealise() ? this.palanquees()
      : this.palanquees().filter(p => p.membres.some(m => this.estCorrespondance(m)));
    return trierParUrgence(gardees, p => this.statutPalanquee(p));
  });

  enDepassement = computed(() => this.palanquees().filter(p => this.statutPalanquee(p) === 'urgence').length);

  /** La dernière heure marquée, annulable quelques secondes : la palanquée telle qu'elle était avant. */
  derniereMarque = signal<{ numero: number; libelle: string; avant: PalanqueeVue } | null>(null);
  private minuterieAnnulation: ReturnType<typeof setTimeout> | null = null;

  private retenirMarque(avant: PalanqueeVue, libelle: string): void {
    if (this.minuterieAnnulation) clearTimeout(this.minuterieAnnulation);
    this.derniereMarque.set({ numero: avant.numero, libelle, avant: { ...avant } });
    this.minuterieAnnulation = setTimeout(() => this.derniereMarque.set(null), 10_000);
  }

  annulerMarque(): void {
    const marque = this.derniereMarque();
    this.derniereMarque.set(null);
    if (!marque) return;
    this.palanquees.set(this.palanquees().map(p => p.numero === marque.numero ? marque.avant : p));
    void this.enregistrerRealise();
  }

  constructor() {
    void this.charger();
    // Vérification en continu (chaque seconde) pour un changement de couleur
    // sans attendre un rechargement ou une action de l'utilisateur.
    const intervalle = setInterval(() => this.maintenant.set(new Date()), 1_000);
    this.destroyRef.onDestroy(() => {
      clearInterval(intervalle);
      if (this.minuterieAnnulation) clearTimeout(this.minuterieAnnulation);
    });
  }

  private async charger(): Promise<void> {
    try {
      // Retombe sur le cache hors ligne ; les saisies pas encore parties priment.
      const [seances, ficheLue] = await Promise.all([
        this.api.seances(),
        this.api.ficheSecurite(this.seanceId)
      ]);
      const { fiche, etablie } = this.file.ficheAJour(this.seanceId, ficheLue);
      this.seance.set(seances.find(s => s.id === this.seanceId) ?? null);
      this.ficheEtablie.set(etablie);
      this.palanquees.set(fiche.palanquees);
      this.retenirEtatEnregistre();
      this.sortie.set(fiche.sortie ?? null);
    } catch {
      this.message.set(navigator.onLine
        ? 'Impossible de charger la fiche de sécurité.'
        : "Cette fiche n'est pas disponible hors ligne. Utilisez « Préparer hors ligne » avec du réseau, "
          + "avant de partir sur site, pour l'embarquer.");
    } finally {
      this.chargement.set(false);
    }
  }

  /** Complément au retour de plongée : le profil réellement plongé, palanquée par palanquée. */
  /** Hors ligne, gardé sur l'appareil et envoyé au retour du réseau, après la fiche si elle attend aussi. */
  async enregistrerRealise(): Promise<void> {
    this.envoiRealise.set(true);
    this.message.set(null);
    try {
      const issue = await this.file.enregistrer<FicheSecuriteVue>({
        type: 'realise', seanceId: this.seanceId, profils: this.palanquees().map(p => ({
          numero: p.numero, profondeurRealisee: p.profondeurRealisee, dureeRealisee: p.dureeRealisee,
          paliers: p.paliers, heureImmersion: p.heureImmersion, heureSortie: p.heureSortie
        }))
      }, 'Profil réalisé', this.seance()?.date ?? dateDuJour());

      if (issue.etat === 'envoyee') {
        this.palanquees.set(issue.reponse.palanquees);
        this.retenirEtatEnregistre();
        this.message.set('Paramètres réalisés enregistrés.');
      } else if (issue.etat === 'en-attente') {
        this.retenirEtatEnregistre();
        this.message.set("Hors ligne : gardé sur l'appareil. Envoi au retour du réseau.");
      } else {
        this.message.set(issue.raison);
      }
    } catch {
      this.message.set("L'enregistrement des paramètres réalisés a échoué.");
    } finally {
      this.envoiRealise.set(false);
    }
  }

  /** « 10:47 » : l'heure de l'horloge, à la minute. */
  private heureCourante(): string {
    const maintenant = new Date();
    return `${String(maintenant.getHours()).padStart(2, '0')}:${String(maintenant.getMinutes()).padStart(2, '0')}`;
  }

  /** Note l'heure d'immersion et enregistre aussitôt, sans attendre le bouton du bas. */
  marquerImmersion(p: PalanqueeVue): void {
    this.retenirMarque(p, "l'immersion");
    this.palanquees.set(this.palanquees().map(x => x === p ? { ...p, heureImmersion: this.heureCourante() } : x));
    void this.enregistrerRealise();
  }

  /** Note l'heure de sortie, calcule la durée réalisée si elle est vide, et enregistre aussitôt. */
  marquerSortieMaintenant(p: PalanqueeVue): void {
    this.retenirMarque(p, 'la sortie');
    const sortie = marquerSortie(p, this.heureCourante());
    this.palanquees.set(this.palanquees().map(x => x === p ? sortie : x));
    void this.enregistrerRealise();
  }

  readonly etatPalanquee = etatPalanquee;

  /** Méthode et non computed : les champs modifient les palanquées en place. */
  bilan(): ReturnType<typeof bilanRealise> {
    return bilanRealise(this.palanquees());
  }

  /** Minutes passées à l'eau, au battement de l'horloge. */
  tempsALEau(p: PalanqueeVue): number {
    return p.heureImmersion ? minutesDepuis(p.heureImmersion, this.maintenant()) ?? 0 : 0;
  }

  /** « 10:45 » : immersion + durée prévue, tant que la palanquée est à l'eau. */
  sortiePrevue(p: PalanqueeVue): string | null {
    if (etatPalanquee(p) !== 'a-l-eau' || !p.dureePrevue) return null;
    const [h, m] = p.heureImmersion!.split(':').map(Number);
    const total = (h * 60 + m + p.dureePrevue) % (24 * 60);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  dureeCalculee(p: PalanqueeVue): number | null {
    return dureeEntre(p.heureImmersion, p.heureSortie);
  }

  // --- Modifications non enregistrées ------------------------------------------------------------

  /** Empreinte des palanquées telles qu'enregistrées (ou chargées). */
  private empreinteEnregistree: string | null = null;

  private retenirEtatEnregistre(): void {
    this.empreinteEnregistree = empreinteFiche({}, this.palanquees());
  }

  modificationsNonEnregistrees(): boolean {
    return this.empreinteEnregistree !== null && empreinteFiche({}, this.palanquees()) !== this.empreinteEnregistree;
  }

  /** Fermer l'onglet ou recharger la page : le navigateur demande confirmation. */
  @HostListener('window:beforeunload', ['$event'])
  avantFermeture(evenement: BeforeUnloadEvent): void {
    if (this.modificationsNonEnregistrees()) evenement.preventDefault();
  }

  /**
   * Statut de vigilance d'une palanquée encore à l'eau, recalculé à chaque
   * battement de l'horloge (voir le constructeur) : `attention` à l'approche
   * de l'heure de sortie prévue, `urgence` une fois cette heure dépassée sans
   * heure de sortie renseignée. Sans objet une fois l'heure de sortie saisie.
   *
   * L'heure d'immersion est rapportée à la date du jour (celle de l'horloge
   * en direct), pas à la date de la séance : cette surveillance ne concerne
   * qu'une plongée en cours, indépendamment de la date enregistrée sur la
   * fiche (utile en particulier en test, où la séance peut être datée d'un
   * autre jour que celui où on saisit réellement l'heure d'immersion).
   */
  statutPalanquee(p: PalanqueeVue): 'attention' | 'urgence' | null {
    if (!p.heureImmersion || p.heureSortie || !p.dureePrevue) return null;

    const maintenant = this.maintenant();
    const [heures, minutes] = p.heureImmersion.split(':').map(Number);
    const immersion = new Date(maintenant);
    immersion.setHours(heures, minutes, 0, 0);

    const sortiePrevue = new Date(immersion.getTime() + p.dureePrevue * 60_000);
    const seuil = new Date(sortiePrevue.getTime() - this.seuilAlerteMinutes() * 60_000);

    if (maintenant >= sortiePrevue) return 'urgence';
    if (maintenant >= seuil) return 'attention';
    return null;
  }

  /** Met en surbrillance un plongeur dont le nom ou prénom correspond à la recherche en cours. */
  estCorrespondance(m: PlongeurVue): boolean {
    const recherche = this.normaliser(this.rechercheRealise());
    if (!recherche) return false;
    return this.normaliser(m.nom).includes(recherche) || this.normaliser(m.prenom).includes(recherche);
  }

  /** Casse et accents ignorés : « Loic » retrouve « Loïc » sur un clavier qui ne les tape pas facilement. */
  private normaliser(texte: string): string {
    return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  }

  telechargerPdf(): void {
    this.exportEnCours.set(true);
    this.api.ficheSecuritePdf(this.seanceId, this.regrouper()).subscribe({
      next: blob => {
        telechargerFichier(blob, `fiche-securite-${this.seance()?.date ?? this.seanceId}.pdf`);
        this.exportEnCours.set(false);
      },
      error: () => {
        this.message.set('Le PDF n’a pas pu être généré.');
        this.exportEnCours.set(false);
      }
    });
  }

  /** Les fiches de toutes les plongées du séjour, pour les imprimer d'un coup. */
  telechargerPdfSortie(sortieId: number): void {
    this.exportSortieEnCours.set(true);
    this.api.fichesSecuriteSortiePdf(sortieId, this.regrouper()).subscribe({
      next: blob => {
        telechargerFichier(blob, `fiches-securite-sortie-${sortieId}.pdf`);
        this.exportSortieEnCours.set(false);
      },
      error: () => {
        this.message.set('Le PDF des fiches de la sortie n’a pas pu être généré.');
        this.exportSortieEnCours.set(false);
      }
    });
  }

  telechargerExcel(): void {
    this.exportExcelEnCours.set(true);
    this.api.ficheSecuriteExcel(this.seanceId, this.regrouper()).subscribe({
      next: blob => {
        telechargerFichier(blob, `fiche-securite-${this.seance()?.date ?? this.seanceId}.xlsx`);
        this.exportExcelEnCours.set(false);
      },
      error: () => {
        this.message.set('Le fichier Excel n’a pas pu être généré.');
        this.exportExcelEnCours.set(false);
      }
    });
  }
}
