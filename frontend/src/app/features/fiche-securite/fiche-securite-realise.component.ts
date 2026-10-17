import { Component, DestroyRef, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FileEcrituresService } from '../../core/file-ecritures.service';
import { FicheSecuriteVue, PalanqueeVue, PlongeurVue, SeanceVue } from '../../core/modeles';
import { DateFrPipe, dateDuJour } from '../../core/date-fr';
import { lieuEtSite } from '../../core/seance-lieu';
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

      <div class="ligne-outils">
        <div>
          <label for="rechercheRealise">Retrouver une palanquée par un de ses plongeurs</label>
          <input id="rechercheRealise" type="text" placeholder="Nom ou prénom…"
                 [ngModel]="rechercheRealise()" (ngModelChange)="rechercheRealise.set($event)">
        </div>
        <div>
          <label for="seuilAlerte">Alerter (min) avant l'heure de sortie prévue</label>
          <input id="seuilAlerte" type="number" min="1" class="champ-seuil"
                 [ngModel]="seuilAlerteMinutes()" (ngModelChange)="seuilAlerteMinutes.set($event)">
        </div>
      </div>

      @if (palanqueesFiltrees().length === 0) {
        <p class="vide">Aucune palanquée ne correspond à « {{ rechercheRealise() }} ».</p>
      }

      @for (p of palanqueesFiltrees(); track p) {
        <section class="carte panneau"
                 [class.palanquee-attention]="statutPalanquee(p) === 'attention'"
                 [class.palanquee-urgence]="statutPalanquee(p) === 'urgence'">
          <h3>Palanquée {{ p.numero }}</h3>
          <p class="membres">
            @for (m of p.membres; track m; let last = $last) {
              <span [class.correspondance]="estCorrespondance(m)">{{ m.prenom }} {{ m.nom }}</span>{{ last ? '' : ', ' }}
            }
          </p>
          <p class="prevu">
            Prévu : {{ p.profondeurPrevue ? p.profondeurPrevue + ' m' : '—' }}
            / {{ p.dureePrevue ? p.dureePrevue + ' min' : '—' }}
          </p>
          @if (statutPalanquee(p) === 'attention') {
            <p class="alerte-texte attention">⚠ Sortie prévue dans moins de {{ seuilAlerteMinutes() }} min.</p>
          } @else if (statutPalanquee(p) === 'urgence') {
            <p class="alerte-texte urgence">⛔ Durée prévue dépassée, sortie non renseignée.</p>
          }

          <div class="ligne-chrono">
            <button type="button" class="bouton-principal" [disabled]="envoiRealise()"
                    (click)="marquerHeure(p, 'heureImmersion')">
              ▶ Marquer l'immersion{{ p.heureImmersion ? ' (' + p.heureImmersion + ')' : '' }}
            </button>
            <button type="button" class="bouton-principal" [disabled]="envoiRealise()"
                    (click)="marquerHeure(p, 'heureSortie')">
              ■ Marquer la sortie{{ p.heureSortie ? ' (' + p.heureSortie + ')' : '' }}
            </button>
          </div>

          <div class="ligne-profil">
            <label>Profondeur réalisée (m) <input type="number" min="0" [(ngModel)]="p.profondeurRealisee"
                   [name]="'preal-' + p.numero"></label>
            <label>Durée réalisée (min) <input type="number" min="0" [(ngModel)]="p.dureeRealisee"
                   [name]="'dreal-' + p.numero"></label>
            <label>Paliers <input type="text" [(ngModel)]="p.paliers" [name]="'pal-' + p.numero"></label>
            <label>Immersion (correction manuelle)
              <input type="time" [(ngModel)]="p.heureImmersion" [name]="'hi-' + p.numero">
            </label>
            <label>Sortie (correction manuelle)
              <input type="time" [(ngModel)]="p.heureSortie" [name]="'hs-' + p.numero">
            </label>
          </div>
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

    /* Actions principales, bien visibles au-dessus des champs de correction manuelle. */
    .ligne-chrono { display: flex; gap: var(--pas-2); flex-wrap: wrap; margin-bottom: var(--pas-2); }
    .ligne-chrono button { flex: 1 1 220px; min-height: 44px; }

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
export class FicheSecuriteRealiseComponent {
  readonly lieuEtSite = lieuEtSite;
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
  /** Ne garde que les palanquées ayant au moins un plongeur correspondant à la recherche. */
  palanqueesFiltrees = computed(() => {
    if (!this.rechercheRealise()) return this.palanquees();
    return this.palanquees().filter(p => p.membres.some(m => this.estCorrespondance(m)));
  });

  constructor() {
    void this.charger();
    // Vérification en continu (chaque seconde) pour un changement de couleur
    // sans attendre un rechargement ou une action de l'utilisateur.
    const intervalle = setInterval(() => this.maintenant.set(new Date()), 1_000);
    this.destroyRef.onDestroy(() => clearInterval(intervalle));
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
        this.message.set('Paramètres réalisés enregistrés.');
      } else if (issue.etat === 'en-attente') {
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

  /** Renseigne l'heure courante sur la palanquée et enregistre aussitôt, sans attendre le bouton global. */
  marquerHeure(p: PalanqueeVue, champ: 'heureImmersion' | 'heureSortie'): void {
    const maintenant = new Date();
    const hh = String(maintenant.getHours()).padStart(2, '0');
    const mm = String(maintenant.getMinutes()).padStart(2, '0');
    p[champ] = `${hh}:${mm}`;
    this.enregistrerRealise();
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
