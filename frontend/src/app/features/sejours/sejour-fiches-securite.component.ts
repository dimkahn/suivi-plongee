import { Component, ChangeDetectionStrategy, OnInit, computed, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { DialogueComponent } from '../../core/dialogue.component';
import { dateDuJour } from '../../core/date-fr';
import { peutSignerDepuisLaListe } from '../../core/fiche-securite';
import { detailErreurFichier, telechargerFichier } from '../../core/telecharger';
import { joursDuSejour } from './liste-courses';
import { jourLong } from './sejour-api';
import {
  DemandePlongee, FichesSecuriteSejourVue, PlongeeSejourVue, PortFichesSecurite, etatFiche, nouvellePlongee,
  plongeesParJour
} from './fiches-securite-sejour';

/**
 * L'onglet « Fiches de sécurité » du séjour (demande du club, 2026) : les
 * plongées de la sortie, jour par jour, avec l'état de leur fiche. Chaque
 * fiche s'ouvre dans ses écrans habituels (établir, compléter au retour,
 * signer), dont le retour ramène ici ; elle s'imprime seule ou avec toutes
 * celles du séjour. Les organisateurs ajoutent une plongée et suppriment
 * celle qui n'a pas encore de fiche ; un administrateur supprime une fiche.
 * Encadrants seulement, réseau obligatoire.
 */
@Component({
  selector: 'app-sejour-fiches-securite',
  imports: [FormsModule, RouterLink, DialogueComponent],
  template: `
    <div class="titre-section">
      <h2>Fiches de sécurité</h2>
      @if (vue()?.peutAjouter) {
        <button type="button" class="bouton-principal ajouter-plongee" (click)="ouvrirAjout()">Ajouter une plongée</button>
      }
    </div>
    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (vue(); as v) {
      @if (v.plongees.length === 0) {
        <p class="vide">
          Aucune plongée dans ce séjour pour l'instant.
          @if (v.peutAjouter) { « Ajouter une plongée » pour en établir la fiche. }
        </p>
      } @else {
        @if (fiches() > 0) {
          <div class="impression carte">
            <button type="button" class="bouton-discret imprimer-toutes" (click)="imprimerTout()" [disabled]="impression() !== null">
              {{ impression() === 0 ? 'Génération…' : 'Imprimer toutes les fiches (PDF)' }}
            </button>
            <label class="case">
              <input type="checkbox" [checked]="regrouper()" (change)="regrouper.set(!regrouper())">
              Regrouper les 2 plongées du jour sur une feuille
            </label>
          </div>
        }
        <p class="secondaire">{{ fiches() }} fiche{{ fiches() > 1 ? 's' : '' }} établie{{ fiches() > 1 ? 's' : '' }}
          sur {{ v.plongees.length }} plongée{{ v.plongees.length > 1 ? 's' : '' }}.</p>
        @for (j of jours(); track j.jour) {
          <section class="carte jour" [attr.aria-label]="jourLong(j.jour)">
            <h3>{{ jourLong(j.jour) }}</h3>
            <ul class="plongees">
              @for (p of j.plongees; track p.seanceId) {
                <li class="plongee">
                  <div class="identite">
                    <span class="nom">
                      Plongée n° {{ p.ordre }}@if (p.lieu) { — {{ p.lieu }}}
                      <span class="etiquette-etat" [class]="etatFiche(p).ton">{{ etatFiche(p).libelle }}</span>
                    </span>
                    @if (p.site) { <span><span class="etiquette-champ">Site :</span> {{ p.site }}</span> }
                    <span class="secondaire">
                      {{ p.milieu === 'NATUREL' ? 'Milieu naturel' : 'Milieu artificiel' }}{{ p.profondeurMax ? ' · ' + p.profondeurMax + ' m' : '' }}
                      @if (p.fiche) {
                        · DP {{ p.dp }} · {{ p.palanquees }} palanquée{{ p.palanquees > 1 ? 's' : '' }},
                        {{ p.plongeurs }} plongeur{{ p.plongeurs > 1 ? 's' : '' }}
                      }
                    </span>
                    @if (p.commentaire) { <span class="info">{{ p.commentaire }}</span> }
                  </div>
                  <div class="actions">
                    @if (p.signee) {
                      <a [routerLink]="['/fiches-securite', p.seanceId, 'signature']" [queryParams]="retour()"
                         class="bouton-discret">Voir la fiche signée</a>
                    } @else {
                      @if (peutSigner(p)) {
                        <a [routerLink]="['/fiches-securite', p.seanceId, 'signature']" [queryParams]="retour()"
                           class="bouton-principal lien-signer">✍ Signer la fiche</a>
                      }
                      @if (v.peutEtablir) {
                        <a [routerLink]="['/fiches-securite', p.seanceId]" [queryParams]="retour()" class="bouton-discret etablir-fiche">
                          {{ p.fiche ? 'Modifier la fiche' : 'Établir la fiche' }}
                        </a>
                      } @else if (p.fiche) {
                        <a [routerLink]="['/fiches-securite', p.seanceId]" [queryParams]="retour()" class="bouton-discret">Voir la fiche</a>
                      }
                      @if (p.fiche) {
                        <a [routerLink]="['/fiches-securite', p.seanceId, 'realise']" [queryParams]="retour()" class="bouton-discret">
                          Compléter au retour
                        </a>
                      }
                    }
                    @if (p.fiche) {
                      <button type="button" class="bouton-discret" (click)="imprimer(p)" [disabled]="impression() !== null"
                              [attr.aria-label]="'Imprimer la fiche de la plongée n° ' + p.ordre + ' du ' + jourLong(p.date)">
                        {{ impression() === p.seanceId ? 'Génération…' : 'Imprimer (PDF)' }}
                      </button>
                    }
                    @if (p.fiche && !p.signee && v.peutSupprimerFiche) {
                      <button type="button" class="bouton-discret danger" (click)="ficheASupprimer.set(p)">Supprimer la fiche</button>
                    }
                    @if (v.peutAjouter && p.supprimable) {
                      <button type="button" class="bouton-discret danger supprimer-plongee" (click)="plongeeASupprimer.set(p)">
                        Supprimer la plongée
                      </button>
                    }
                  </div>
                </li>
              }
            </ul>
          </section>
        }
      }
    } @else if (!message()) {
      <p class="vide">Chargement…</p>
    }

    <!-- Ajouter une plongée (organisateurs) -->
    <app-dialogue [ouvert]="ajoutOuvert()" [erreur]="erreur()" titre="Ajouter une plongée" (fermer)="ajoutOuvert.set(false)">
      @if (ajoutOuvert()) {
        <form class="dialogue-formulaire" (ngSubmit)="ajouter()">
          <label for="plongee-date">Jour</label>
          <select id="plongee-date" name="date" [(ngModel)]="brouillon.date" required>
            @for (j of joursPossibles(); track j) { <option [value]="j">{{ jourLong(j) }}</option> }
          </select>
          <label for="plongee-ordre">N° de plongée dans la journée</label>
          <input id="plongee-ordre" name="ordre" type="number" min="1" max="9" inputmode="numeric"
                 [(ngModel)]="brouillon.ordre" placeholder="Laissé vide : la suivante du jour">
          <label for="plongee-milieu">Milieu</label>
          <select id="plongee-milieu" name="milieu" [(ngModel)]="brouillon.milieu">
            <option value="NATUREL">Milieu naturel (mer, lac, carrière)</option>
            <option value="ARTIFICIEL">Milieu artificiel (piscine, fosse)</option>
          </select>
          <label for="plongee-lieu">Lieu</label>
          <input id="plongee-lieu" name="lieu" [(ngModel)]="brouillon.lieu" maxlength="120">
          <label for="plongee-site">Site de plongée</label>
          <input id="plongee-site" name="site" [(ngModel)]="brouillon.site" maxlength="120" placeholder="Épave, tombant…">
          <label for="plongee-profondeur">Profondeur maximale (m)</label>
          <input id="plongee-profondeur" name="profondeurMax" type="number" min="0" max="120" inputmode="numeric"
                 [(ngModel)]="brouillon.profondeurMax">
          <label for="plongee-info">Info complémentaire</label>
          <input id="plongee-info" name="commentaire" [(ngModel)]="brouillon.commentaire" maxlength="500"
                 placeholder="Bateau, groupe…">
          <p class="secondaire">La plongée paraît aussitôt au programme du séjour ; sa fiche s'établit ensuite.</p>
          <div class="actions-dialogue">
            <button type="submit" class="bouton-principal" [disabled]="envoi()">{{ envoi() ? 'Envoi…' : 'Ajouter' }}</button>
            <button type="button" class="bouton-discret" (click)="ajoutOuvert.set(false)">Annuler</button>
          </div>
        </form>
      }
    </app-dialogue>

    <app-dialogue [ouvert]="plongeeASupprimer() !== null" [erreur]="erreur()" titre="Supprimer la plongée ?"
                  (fermer)="plongeeASupprimer.set(null)">
      @if (plongeeASupprimer(); as p) {
        <p>La plongée n° {{ p.ordre }} du {{ jourLong(p.date) }} disparaît du séjour et du calendrier du club.</p>
        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" (click)="supprimerPlongee(p)" [disabled]="envoi()">Supprimer</button>
          <button type="button" class="bouton-discret" (click)="plongeeASupprimer.set(null)">Annuler</button>
        </div>
      }
    </app-dialogue>

    <app-dialogue [ouvert]="ficheASupprimer() !== null" [erreur]="erreur()" titre="Supprimer la fiche de sécurité ?"
                  (fermer)="ficheASupprimer.set(null)">
      @if (ficheASupprimer(); as p) {
        <p>La fiche de la plongée n° {{ p.ordre }} du {{ jourLong(p.date) }} est effacée : DP, conditions et
          palanquées. La plongée reste dans le séjour.</p>
        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" (click)="supprimerFiche(p)" [disabled]="envoi()">Supprimer la fiche</button>
          <button type="button" class="bouton-discret" (click)="ficheASupprimer.set(null)">Annuler</button>
        </div>
      }
    </app-dialogue>
  `,
  styles: [`
    .impression { display: flex; flex-wrap: wrap; align-items: center; gap: var(--pas-2); padding: var(--pas-2); margin-bottom: var(--pas-2); }
    .jour { margin-bottom: var(--pas-2); padding: var(--pas-2); }
    .jour h3 { margin: 0 0 var(--pas); }
    .plongees { list-style: none; margin: 0; padding: 0; }
    .plongee { display: flex; justify-content: space-between; align-items: center; gap: var(--pas-2); flex-wrap: wrap;
               padding: var(--pas) 0; border-top: 1px solid var(--trait); }
    .plongee:first-child { border-top: none; }
    .identite { display: flex; flex-direction: column; gap: 2px; }
    .nom { font-weight: 700; display: flex; align-items: center; gap: var(--pas); flex-wrap: wrap; }
    .info { font-size: .9375rem; white-space: pre-line; overflow-wrap: anywhere; }
    .etiquette-champ { font-weight: 700; color: var(--craie); }
    .actions { display: flex; align-items: center; gap: var(--pas); flex-wrap: wrap; }
    .actions a, .actions button { min-height: 44px; display: inline-flex; align-items: center; }
    .lien-signer { width: auto; margin: 0; }
    .danger { color: #B91C1C; border-color: #FCA5A5; }
    .case { display: flex; align-items: center; gap: var(--pas); font-weight: 400; min-height: 44px; margin: 0; }
    .case input { width: auto; flex: none; min-width: 24px; min-height: 24px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SejourFichesSecuriteComponent implements OnInit {
  port = input.required<PortFichesSecurite>();
  sejourId = input.required<number>();
  dateDebut = input.required<string>();
  dateFin = input.required<string>();
  lieu = input<string | null>(null);

  private auth = inject(AuthService);

  readonly jourLong = jourLong;
  readonly etatFiche = etatFiche;

  vue = signal<FichesSecuriteSejourVue | null>(null);
  message = signal<string | null>(null);
  erreur = signal<string | null>(null);
  envoi = signal(false);
  /** La fiche dont le PDF se prépare ; 0 : toutes celles du séjour. */
  impression = signal<number | null>(null);
  regrouper = signal(true);

  ajoutOuvert = signal(false);
  brouillon: DemandePlongee = nouvellePlongee('', null);
  plongeeASupprimer = signal<PlongeeSejourVue | null>(null);
  ficheASupprimer = signal<PlongeeSejourVue | null>(null);

  readonly jours = computed(() => plongeesParJour(this.vue()?.plongees ?? []));
  readonly fiches = computed(() => (this.vue()?.plongees ?? []).filter(p => p.fiche).length);
  readonly joursPossibles = computed(() => joursDuSejour(this.dateDebut(), this.dateFin()));
  /** Suivi par les écrans de la fiche : leur retour ramène à cet onglet. */
  readonly retour = computed(() => ({ sejour: this.sejourId() }));

  ngOnInit(): void {
    this.charger();
  }

  private charger(): void {
    this.port().lire().subscribe({
      next: v => this.vue.set(v),
      error: () => this.message.set('Les fiches de sécurité du séjour n’ont pas pu être lues. Vérifiez le réseau.')
    });
  }

  /** Le lien « Signer la fiche » : pour son DP, une fois la plongée passée (le serveur revérifie). */
  peutSigner(p: PlongeeSejourVue): boolean {
    return peutSignerDepuisLaListe({ date: p.date, ficheSecurite: p.fiche, ficheSignee: p.signee, ficheDpId: p.dpId },
      this.auth.session()?.id, dateDuJour());
  }

  ouvrirAjout(): void {
    this.erreur.set(null);
    this.brouillon = nouvellePlongee(this.dateDebut(), this.lieu());
    this.ajoutOuvert.set(true);
  }

  ajouter(): void {
    const d = this.brouillon;
    this.envoyer(this.port().ajouter({ ...d, ordre: d.ordre || null, profondeurMax: d.profondeurMax ?? null }), () => {
      this.ajoutOuvert.set(false);
      this.message.set(`Plongée ajoutée le ${jourLong(d.date)} : établissez maintenant sa fiche.`);
    });
  }

  supprimerPlongee(p: PlongeeSejourVue): void {
    this.envoyer(this.port().supprimer(p.seanceId), () => {
      this.plongeeASupprimer.set(null);
      this.message.set('La plongée est supprimée.');
    });
  }

  supprimerFiche(p: PlongeeSejourVue): void {
    this.envoi.set(true);
    this.erreur.set(null);
    this.port().supprimerFiche(p.seanceId).subscribe({
      next: () => {
        this.envoi.set(false);
        this.ficheASupprimer.set(null);
        this.message.set('La fiche de sécurité est supprimée ; la plongée reste dans le séjour.');
        this.charger();
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.erreur.set(e.error?.detail ?? 'La suppression a échoué. Vérifiez le réseau.');
      }
    });
  }

  imprimer(p: PlongeeSejourVue): void {
    this.telecharger(p.seanceId, this.port().pdf(p.seanceId, this.regrouper()), `fiche-securite-${p.date}.pdf`);
  }

  imprimerTout(): void {
    this.telecharger(0, this.port().pdfSejour(this.regrouper()), `fiches-securite-sejour-${this.dateDebut()}.pdf`);
  }

  private telecharger(cle: number, appel: Observable<Blob>, nom: string): void {
    this.impression.set(cle);
    this.message.set(null);
    appel.subscribe({
      next: blob => {
        telechargerFichier(blob, nom);
        this.impression.set(null);
      },
      error: async (e: HttpErrorResponse) => {
        this.impression.set(null);
        this.message.set(await detailErreurFichier(e) ?? 'Le PDF n’a pas pu être généré. Vérifiez le réseau.');
      }
    });
  }

  private envoyer(appel: Observable<FichesSecuriteSejourVue>, ensuite: () => void): void {
    this.envoi.set(true);
    this.erreur.set(null);
    appel.subscribe({
      next: v => {
        this.envoi.set(false);
        this.vue.set(v);
        ensuite();
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.erreur.set(e.error?.detail ?? 'L’enregistrement a échoué. Vérifiez le réseau.');
      }
    });
  }
}
