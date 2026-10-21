import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { DialogueComponent } from '../../core/dialogue.component';
import { CompteSurfaceVue, SeanceConfieeVue, SortieVue } from '../../core/modeles';
import { DateFrPipe, dateDuJour } from '../../core/date-fr';
import { finAccesProposee, seancesProposees } from '../../core/acces-securite-surface';

/** Une séance que l'on peut confier : la liste de la saison, les sorties et les comptes y contribuent. */
interface SeanceChoix extends SeanceConfieeVue {
  profondeurMax: number | null;
}

type Mode = 'creation' | 'modification' | 'reactivation';

/**
 * Comptes « Sécurité surface » (Administration › Personnes) : une personne
 * qui n'est pas moniteur du club et qui ne fait que compléter les fiches de
 * sécurité au retour de plongée (rôle SECURITE_SURFACE). Chaque compte est
 * créé pour une sortie, une séance ou quelques séances, dont il seul voit
 * les fiches, et jusqu'à une date de fin d'accès ; on le réactive ensuite
 * pour d'autres séances. Pas de niveau, de CACI ni de photo.
 */
@Component({
  selector: 'app-comptes-securite-surface',
  imports: [FormsModule, DialogueComponent, DateFrPipe],
  template: `
    <div class="entete">
      <div>
        <h1>Sécurité surface</h1>
        <p class="secondaire">
          Pour une personne qui n'est pas moniteur du club : elle ne voit que les fiches de sécurité des
          séances qui lui sont confiées, et ne peut que les compléter au retour de plongée (heures, profondeurs,
          durées, paliers). Son compte se désactive tout seul après la date de fin d'accès.
        </p>
      </div>
      <button type="button" class="bouton-principal" (click)="ouvrir(null, 'creation')">Nouveau compte sécurité surface</button>
    </div>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (comptes().length === 0) {
      <p class="vide">Aucun compte de sécurité surface.</p>
    } @else {
      <ul class="comptes">
        @for (c of comptes(); track c.id) {
          <li class="carte">
            <div class="identite">
              <span class="nom">{{ c.prenom }} {{ c.nom }}</span>
              <span class="secondaire">{{ c.email }}</span>
            </div>
            <span class="etiquette-etat" [class.ok]="c.actif" [class.neutre]="!c.actif">
              {{ c.actif ? 'Actif' : (c.accesTermine ? 'Accès terminé' : 'Désactivé') }}
            </span>
            <div class="acces">
              @if (c.accesJusquAu) {
                <span>{{ c.actif ? 'Accès jusqu\\'au' : 'Accès terminé le' }} {{ c.accesJusquAu | dateFr }}</span>
              } @else {
                <span>Sans date de fin d'accès</span>
              }
              @if (c.seances.length === 0) {
                <span class="secondaire">Aucune séance confiée.</span>
              } @else {
                <span class="secondaire">
                  {{ c.seances.length }} séance{{ c.seances.length > 1 ? 's' : '' }} :
                  @for (s of c.seances; track s.id; let dernier = $last) {
                    {{ libelleSeance(s) }}{{ dernier ? '' : ' · ' }}
                  }
                </span>
              }
            </div>
            <div class="actions">
              @if (c.actif) {
                <button type="button" class="bouton-discret" (click)="ouvrir(c, 'modification')">Modifier</button>
                <button type="button" class="bouton-discret" (click)="desactiver(c)">Désactiver</button>
                <button type="button" class="bouton-discret" (click)="envoyerLien(c)">Envoyer un lien de mot de passe</button>
              } @else {
                <button type="button" class="bouton-discret" (click)="ouvrir(c, 'reactivation')">Réactiver</button>
              }
              <button type="button" class="bouton-discret danger" (click)="supprimer(c)">Supprimer</button>
            </div>
          </li>
        }
      </ul>
    }

    <app-dialogue [ouvert]="dialogueOuvert()" [titre]="titreDialogue()"
                  [erreur]="erreur()" (fermer)="dialogueOuvert.set(false)">
      @if (mode() === 'creation') {
        <p class="secondaire">La personne reçoit un lien pour définir elle-même son mot de passe.</p>
      }
      @if (mode() !== 'reactivation') {
        <label for="surface-prenom">Prénom</label>
        <input id="surface-prenom" type="text" name="surfacePrenom" [(ngModel)]="saisie.prenom">
        <label for="surface-nom">Nom</label>
        <input id="surface-nom" type="text" name="surfaceNom" [(ngModel)]="saisie.nom">
        <label for="surface-email">E-mail</label>
        <input id="surface-email" type="email" name="surfaceEmail" [(ngModel)]="saisie.email">
      }

      <fieldset class="seances">
        <legend>Séances confiées</legend>
        @if (sorties().length > 0) {
          <label for="surface-sortie" class="sous-label">Toutes les plongées d'une sortie</label>
          <select id="surface-sortie" name="surfaceSortie" [ngModel]="null" (ngModelChange)="ajouterSortie($event)">
            <option [ngValue]="null">Choisir une sortie…</option>
            @for (so of sorties(); track so.id) {
              <option [ngValue]="so.id">{{ so.nom }} ({{ so.dateDebut | dateFr }})</option>
            }
          </select>
        }
        <p class="secondaire">Ou une à une : séances en milieu naturel ou de plus de 6 m, de la semaine passée et à venir.</p>
        @if (proposees().length === 0) {
          <p class="vide">Aucune séance à confier pour l'instant.</p>
        } @else {
          <ul class="liste-seances">
            @for (s of proposees(); track s.id) {
              <li>
                <label class="case">
                  <input type="checkbox" [checked]="choisies().includes(s.id)" (change)="basculer(s.id)">
                  <span>{{ libelleSeance(s) }}</span>
                </label>
              </li>
            }
          </ul>
        }
        <p class="compte-choisies">{{ choisies().length }} séance{{ choisies().length > 1 ? 's' : '' }} choisie{{ choisies().length > 1 ? 's' : '' }}</p>
      </fieldset>

      <label for="surface-fin">Accès jusqu'au (inclus)</label>
      <input id="surface-fin" type="date" name="surfaceFin" [min]="aujourdhui" [ngModel]="accesJusquAu()"
             (ngModelChange)="accesJusquAu.set($event)">
      <p class="secondaire">Le compte se désactive tout seul le lendemain ; on peut le réactiver ensuite pour d'autres séances.</p>

      <div class="actions-dialogue">
        <button type="button" class="bouton-principal" (click)="enregistrer()" [disabled]="envoi()">
          {{ envoi() ? 'Enregistrement…' : libelleValider() }}
        </button>
        <button type="button" class="bouton-discret" (click)="dialogueOuvert.set(false)">Annuler</button>
      </div>
    </app-dialogue>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .entete { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas-2); flex-wrap: wrap; }
    .entete > div { flex: 1 1 320px; }
    .entete .bouton-principal { width: auto; margin-top: 0; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .comptes { list-style: none; margin: var(--pas-3) 0 0; padding: 0; display: grid; gap: var(--pas-2); }
    .comptes > li { padding: var(--pas-2); display: flex; flex-wrap: wrap; align-items: center; gap: var(--pas-2); }
    .identite { display: flex; flex-direction: column; gap: 2px; flex: 1 1 200px; min-width: 0; }
    .nom { font-weight: 700; }
    .acces { display: flex; flex-direction: column; gap: 2px; flex-basis: 100%; font-size: .9375rem; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; flex-basis: 100%; }
    .danger { color: #B3261E; border-color: #B3261E; }
    fieldset.seances { border: 1px solid var(--bordure, #D5DDE2); border-radius: var(--r-s); margin: var(--pas-2) 0 0; padding: var(--pas-2); }
    legend { font-weight: 700; padding: 0 4px; }
    .sous-label { margin-top: 0; }
    .liste-seances { list-style: none; margin: 0; padding: 0; max-height: 40vh; overflow-y: auto; }
    .case { display: flex; align-items: center; gap: var(--pas); min-height: 44px; margin: 0; font-weight: 400; }
    .case input { width: 22px; height: 22px; flex: none; margin: 0; }
    .compte-choisies { margin: var(--pas) 0 0; font-weight: 700; }
  `]
})
export class ComptesSecuriteSurfaceComponent {
  private api = inject(ApiService);

  readonly aujourdhui = dateDuJour();

  comptes = signal<CompteSurfaceVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  erreur = signal<string | null>(null);

  /** Séances connues, par identifiant : de la saison, des sorties et des comptes. */
  private seancesConnues = signal(new Map<number, SeanceChoix>());
  sorties = signal<SortieVue[]>([]);

  dialogueOuvert = signal(false);
  mode = signal<Mode>('creation');
  /** Compte modifié ou réactivé ; null : création. */
  enEdition = signal<CompteSurfaceVue | null>(null);
  saisie = { prenom: '', nom: '', email: '' };
  choisies = signal<number[]>([]);
  accesJusquAu = signal<string>('');
  /** La date n'a pas été touchée : elle suit les séances choisies. */
  private dateProposee = true;
  envoi = signal(false);

  proposees = computed(() =>
    seancesProposees([...this.seancesConnues().values()], this.choisies(), this.aujourdhui));

  titreDialogue = computed(() => {
    const c = this.enEdition();
    switch (this.mode()) {
      case 'creation': return 'Nouveau compte sécurité surface';
      case 'reactivation': return `Réactiver ${c?.prenom} ${c?.nom}`;
      default: return `Modifier ${c?.prenom} ${c?.nom}`;
    }
  });

  libelleValider = computed(() =>
    ({ creation: 'Créer le compte', modification: 'Enregistrer', reactivation: 'Réactiver le compte' })[this.mode()]);

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    try {
      const [comptes, seances, sorties] = await Promise.all([
        firstValueFrom(this.api.comptesSurface()),
        this.api.seances(),
        firstValueFrom(this.api.sorties(true))
      ]);
      this.comptes.set(comptes);
      this.sorties.set(sorties.filter(so => so.seances.length > 0));
      const connues = new Map<number, SeanceChoix>();
      for (const so of sorties) for (const s of so.seances) connues.set(s.id, { ...s, ordre: s.ordre ?? 1, profondeurMax: null });
      for (const c of comptes) for (const s of c.seances) connues.set(s.id, { ...s, profondeurMax: null });
      for (const s of seances) connues.set(s.id, s);
      this.seancesConnues.set(connues);
    } catch {
      this.message.set('Impossible de charger les comptes de sécurité surface.');
    } finally {
      this.chargement.set(false);
    }
  }

  libelleSeance(s: SeanceConfieeVue): string {
    const [a, m, j] = s.date.split('-');
    return `${j}/${m}/${a} n° ${s.ordre}${s.lieu ? ' — ' + s.lieu : ''}${s.site ? ', ' + s.site : ''}`
      + (s.commentaire ? ` (${s.commentaire})` : '');
  }

  ouvrir(c: CompteSurfaceVue | null, mode: Mode): void {
    this.erreur.set(null);
    this.message.set(null);
    this.enEdition.set(c);
    this.mode.set(mode);
    this.saisie = c ? { prenom: c.prenom, nom: c.nom, email: c.email } : { prenom: '', nom: '', email: '' };
    // Réactiver, c'est pour d'autres séances : on repart d'une liste vide.
    this.choisies.set(mode === 'modification' && c ? c.seances.map(s => s.id) : []);
    this.accesJusquAu.set(mode === 'modification' && c?.accesJusquAu ? c.accesJusquAu : '');
    this.dateProposee = mode !== 'modification';
    this.dialogueOuvert.set(true);
  }

  basculer(id: number): void {
    const liste = this.choisies();
    this.choisir(liste.includes(id) ? liste.filter(x => x !== id) : [...liste, id]);
  }

  ajouterSortie(sortieId: number | null): void {
    const sortie = this.sorties().find(so => so.id === sortieId);
    if (!sortie) return;
    this.choisir([...new Set([...this.choisies(), ...sortie.seances.map(s => s.id)])]);
  }

  private choisir(ids: number[]): void {
    this.choisies.set(ids);
    if (this.dateProposee || !this.accesJusquAu()) {
      const dates = ids.map(id => this.seancesConnues().get(id)?.date).filter((d): d is string => !!d);
      this.accesJusquAu.set(finAccesProposee(dates, this.aujourdhui) ?? '');
      this.dateProposee = true;
    }
  }

  enregistrer(): void {
    const s = this.saisie;
    const mode = this.mode();
    if (mode !== 'reactivation' && (!s.prenom.trim() || !s.nom.trim() || !s.email.trim())) {
      this.erreur.set('Prénom, nom et e-mail sont obligatoires.');
      return;
    }
    const c = this.enEdition();
    const acces = { seanceIds: this.choisies(), accesJusquAu: this.accesJusquAu() || null };
    const requete = mode === 'creation' ? this.api.creerCompteSurface({ ...s, ...acces })
      : mode === 'reactivation' ? this.api.reactiverCompteSurface(c!.id, acces)
      : this.api.modifierCompteSurface(c!.id, { ...s, ...acces });
    this.envoi.set(true);
    this.erreur.set(null);
    requete.subscribe({
      next: compte => {
        this.envoi.set(false);
        this.dialogueOuvert.set(false);
        this.remplacer(compte);
        const nom = `${compte.prenom} ${compte.nom}`;
        this.message.set(mode === 'creation'
          ? `${nom} a été ajouté·e ; un lien pour définir son mot de passe lui a été envoyé.`
          : mode === 'reactivation' ? `${nom} a été réactivé·e.` : `${nom} a été modifié·e.`);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.erreur.set(e.error?.detail ?? "L'enregistrement n'a pas pu être fait.");
      }
    });
  }

  /** Mettre fin à l'accès avant la date prévue (fin de sortie anticipée, erreur de personne). */
  desactiver(c: CompteSurfaceVue): void {
    this.message.set(null);
    this.api.desactiverCompteSurface(c.id).subscribe({
      next: maj => this.remplacer(maj),
      error: (e: HttpErrorResponse) => this.message.set(e.error?.detail ?? "L'action n'a pas pu être enregistrée.")
    });
  }

  envoyerLien(c: CompteSurfaceVue): void {
    if (!confirm(`Envoyer à ${c.prenom} ${c.nom} (${c.email}) un lien pour choisir un nouveau mot de passe ?`)) return;
    this.message.set(null);
    this.api.envoyerLienReinitialisationCompteSurface(c.id).subscribe({
      next: () => this.message.set(`Lien envoyé à ${c.email} (valable une heure).`),
      error: (e: HttpErrorResponse) => this.message.set(e.error?.detail ?? "Le lien n'a pas pu être envoyé.")
    });
  }

  supprimer(c: CompteSurfaceVue): void {
    if (!confirm(`Supprimer définitivement le compte de ${c.prenom} ${c.nom} ?`)) return;
    this.message.set(null);
    this.api.supprimerCompteSurface(c.id).subscribe({
      next: () => this.comptes.set(this.comptes().filter(x => x.id !== c.id)),
      error: (e: HttpErrorResponse) => this.message.set(e.error?.detail ?? "La suppression n'a pas pu être enregistrée.")
    });
  }

  private remplacer(compte: CompteSurfaceVue): void {
    const autres = this.comptes().filter(x => x.id !== compte.id);
    this.comptes.set([...autres, compte].sort((a, b) => a.nom.localeCompare(b.nom)));
  }
}
