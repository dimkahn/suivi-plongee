import { Component, ChangeDetectionStrategy, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../core/api.service';
import { SignalementMaterielVue } from '../../core/modeles';
import { DateFrPipe, dateDuJour } from '../../core/date-fr';
import { DialogueComponent } from '../../core/dialogue.component';

/**
 * Les problèmes constatés sur un matériel pendant une séance (demande du
 * club, 2026-11-19) : la liste de ceux qui ne sont pas encore réparés,
 * « Signaler un problème » (moniteurs, TIV, directeur technique, admin) et,
 * pour le directeur technique ou l'admin, « Déclarer réparé », qui inscrit une
 * réparation au journal et rend le matériel de nouveau prêtable. Partagé par
 * la fiche de gestion et la page qu'ouvre un moniteur en scannant l'étiquette.
 * Le serveur décide des droits.
 */
@Component({
  selector: 'app-problemes-materiel',
  imports: [FormsModule, DateFrPipe, DialogueComponent],
  template: `
    <section class="carte problemes" [class.ouverts]="signalements().length > 0" aria-labelledby="titre-problemes">
      <h2 id="titre-problemes">Problèmes signalés</h2>
      @if (signalements().length === 0) {
        <p class="secondaire">Aucun problème en cours sur ce matériel.</p>
      } @else {
        <p class="bloque">Ce matériel ne se prête plus tant qu'il n'est pas déclaré réparé.</p>
        <ul>
          @for (s of signalements(); track s.id) {
            <li>
              <span class="quand">Le {{ s.date | dateFr }}{{ s.signalePar ? ', par ' + s.signalePar : '' }} :</span>
              <span class="quoi">{{ s.description }}</span>
            </li>
          }
        </ul>
      }
      @if (message(); as m) { <p class="alerte" role="status">{{ m }}</p> }
      <div class="actions">
        <button type="button" class="bouton-principal signaler" (click)="ouvrirSignalement()">Signaler un problème</button>
        @if (peutReparer() && signalements().length > 0) {
          <button type="button" class="bouton-discret declarer-repare" (click)="ouvrirReparation()">Déclarer réparé</button>
        }
      </div>
    </section>

    <app-dialogue [ouvert]="signalementOuvert()" titre="Signaler un problème" [erreur]="erreur()"
                  (fermer)="signalementOuvert.set(false)">
      <label for="probleme">Qu'avez-vous constaté sur ce matériel ?</label>
      <textarea id="probleme" name="probleme" rows="3" maxlength="500" [(ngModel)]="description"
                placeholder="ex. L'inflateur fuit, purge bloquée, robinet dur…"></textarea>
      <p class="secondaire aide">
        Le matériel seulement : rien sur la personne qui l'utilisait ni sur sa santé. Le directeur technique
        est prévenu par la liste du matériel ; il ne se prête plus jusqu'à sa réparation.
      </p>
      <div class="actions-dialogue">
        <button type="button" class="bouton-principal" [attr.aria-busy]="envoi() || null" [disabled]="envoi()"
                (click)="signaler()">{{ envoi() ? 'Envoi…' : 'Signaler' }}</button>
        <button type="button" class="bouton-discret" (click)="signalementOuvert.set(false)">Annuler</button>
      </div>
    </app-dialogue>

    <app-dialogue [ouvert]="reparationOuverte()" titre="Déclarer réparé" [erreur]="erreur()"
                  (fermer)="reparationOuverte.set(false)">
      <p class="secondaire">
        Une fois le matériel vérifié et réparé : la réparation entre au journal de sa fiche de gestion, et il
        redevient prêtable.
      </p>
      <label for="reparation">Ce qui a été vérifié et réparé</label>
      <textarea id="reparation" name="reparation" rows="3" [(ngModel)]="travaux"
                placeholder="ex. Inflateur remplacé, essai en bassin conforme."></textarea>
      <label for="intervenant">Intervenant (facultatif)</label>
      <input id="intervenant" name="intervenant" type="text" maxlength="120" [(ngModel)]="intervenant"
             placeholder="Atelier, magasin…">
      <div class="actions-dialogue">
        <button type="button" class="bouton-principal" [attr.aria-busy]="envoi() || null" [disabled]="envoi()"
                (click)="declarerRepare()">{{ envoi() ? 'Enregistrement…' : 'Déclarer réparé' }}</button>
        <button type="button" class="bouton-discret" (click)="reparationOuverte.set(false)">Annuler</button>
      </div>
    </app-dialogue>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .problemes { padding: var(--pas-2); margin: var(--pas-2) 0; }
    .problemes.ouverts { border-left: 4px solid #B3261E; }
    h2 { margin: 0 0 var(--pas); font-size: 1.125rem; }
    .bloque { margin: 0 0 var(--pas); font-weight: 700; color: #B3261E; }
    ul { margin: 0 0 var(--pas); padding-left: 1.25rem; display: grid; gap: 4px; }
    .quand { color: var(--craie); margin-right: 4px; }
    .actions { display: flex; flex-wrap: wrap; gap: var(--pas); }
    .actions .bouton-principal { width: auto; margin: 0; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    textarea { resize: vertical; }
    .aide { font-size: .875rem; }
  `]
})
export class ProblemesMaterielComponent {
  private api = inject(ApiService);

  readonly equipementId = input.required<number>();
  readonly signalements = input<SignalementMaterielVue[]>([]);
  /** Directeur technique ou admin : peut déclarer le matériel réparé. */
  readonly peutReparer = input(false);
  /** Un signalement ou une réparation enregistrés : l'écran relit le matériel. */
  readonly change = output<void>();

  signalementOuvert = signal(false);
  reparationOuverte = signal(false);
  envoi = signal(false);
  erreur = signal<string | null>(null);
  message = signal<string | null>(null);
  description = '';
  travaux = '';
  intervenant = '';

  ouvrirSignalement(): void {
    this.description = '';
    this.erreur.set(null);
    this.message.set(null);
    this.signalementOuvert.set(true);
  }

  ouvrirReparation(): void {
    this.travaux = '';
    this.intervenant = '';
    this.erreur.set(null);
    this.message.set(null);
    this.reparationOuverte.set(true);
  }

  signaler(): void {
    if (!this.description.trim()) {
      this.erreur.set('Décrivez le problème constaté sur le matériel.');
      return;
    }
    this.envoi.set(true);
    this.erreur.set(null);
    this.api.signalerProblemeMateriel(this.equipementId(), this.description.trim()).subscribe({
      next: () => {
        this.envoi.set(false);
        this.signalementOuvert.set(false);
        this.message.set('Problème signalé : le directeur technique le verra dans la liste du matériel.');
        this.change.emit();
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.erreur.set(e.error?.detail ?? "Le problème n'a pas pu être signalé.");
      }
    });
  }

  declarerRepare(): void {
    if (!this.travaux.trim()) {
      this.erreur.set('Dites ce qui a été vérifié et réparé : cela entre au journal du matériel.');
      return;
    }
    this.envoi.set(true);
    this.erreur.set(null);
    this.api.ajouterIntervention(this.equipementId(), {
      type: 'REPARATION', dateIntervention: dateDuJour(), intervenant: this.intervenant.trim() || null,
      resultat: null, description: this.travaux.trim()
    }).subscribe({
      next: () => {
        this.envoi.set(false);
        this.reparationOuverte.set(false);
        this.message.set('Réparation enregistrée : le matériel peut de nouveau être prêté.');
        this.change.emit();
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.erreur.set(e.error?.detail ?? "La réparation n'a pas pu être enregistrée.");
      }
    });
  }
}
