import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { DialogueComponent } from '../../core/dialogue.component';
import { CompteSurfaceVue } from '../../core/modeles';

/**
 * Comptes « Sécurité surface », en bas de l'écran Moniteurs : une personne
 * qui n'est pas moniteur du club et qui ne fait que compléter les fiches de
 * sécurité au retour de plongée (rôle SECURITE_SURFACE). Pas de niveau, de
 * CACI ni de photo : nom, prénom, e-mail, et le lien d'invitation pour son
 * mot de passe.
 */
@Component({
  selector: 'app-comptes-securite-surface',
  imports: [FormsModule, DialogueComponent],
  template: `
    <section class="surface" aria-labelledby="titre-surface">
      <div class="entete">
        <div>
          <h2 id="titre-surface">Sécurité surface</h2>
          <p class="secondaire">
            Pour une personne qui n'est pas moniteur du club : elle ne voit que les fiches de sécurité,
            et ne peut que les compléter au retour de plongée (heures, profondeurs, durées, paliers).
          </p>
        </div>
        <button type="button" class="bouton-principal" (click)="ouvrir(null)">Nouveau compte sécurité surface</button>
      </div>

      @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

      @if (chargement()) {
        <p class="vide">Chargement…</p>
      } @else if (comptes().length === 0) {
        <p class="vide">Aucun compte de sécurité surface.</p>
      } @else {
        <ul>
          @for (c of comptes(); track c.id) {
            <li class="carte">
              <div class="identite">
                <span class="nom">{{ c.prenom }} {{ c.nom }}</span>
                <span class="secondaire">{{ c.email }}</span>
              </div>
              <span class="etat" [class.actif]="c.actif" [class.inactif]="!c.actif">
                {{ c.actif ? 'Actif' : 'Désactivé' }}
              </span>
              <div class="actions">
                <button type="button" class="bouton-discret" (click)="ouvrir(c)">Modifier</button>
                <button type="button" class="bouton-discret" (click)="changerActivation(c)">
                  {{ c.actif ? 'Désactiver' : 'Activer' }}
                </button>
                @if (c.actif) {
                  <button type="button" class="bouton-discret" (click)="envoyerLien(c)">Envoyer un lien de mot de passe</button>
                }
                <button type="button" class="bouton-discret danger" (click)="supprimer(c)">Supprimer</button>
              </div>
            </li>
          }
        </ul>
      }
    </section>

    <app-dialogue [ouvert]="dialogueOuvert()"
                  [titre]="enEdition() ? 'Modifier ' + saisie.prenom + ' ' + saisie.nom : 'Nouveau compte sécurité surface'"
                  [erreur]="erreur()" (fermer)="dialogueOuvert.set(false)">
      @if (!enEdition()) {
        <p class="secondaire">La personne reçoit un lien pour définir elle-même son mot de passe.</p>
      }
      <label for="surface-prenom">Prénom</label>
      <input id="surface-prenom" type="text" name="surfacePrenom" [(ngModel)]="saisie.prenom">
      <label for="surface-nom">Nom</label>
      <input id="surface-nom" type="text" name="surfaceNom" [(ngModel)]="saisie.nom">
      <label for="surface-email">E-mail</label>
      <input id="surface-email" type="email" name="surfaceEmail" [(ngModel)]="saisie.email">
      <div class="actions-dialogue">
        <button type="button" class="bouton-principal" (click)="enregistrer()" [disabled]="envoi()">
          {{ envoi() ? 'Enregistrement…' : (enEdition() ? 'Enregistrer' : 'Créer le compte') }}
        </button>
        <button type="button" class="bouton-discret" (click)="dialogueOuvert.set(false)">Annuler</button>
      </div>
    </app-dialogue>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .surface { margin-top: var(--pas-4, 32px); }
    .entete { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas-2); flex-wrap: wrap; }
    .entete > div { flex: 1 1 320px; }
    .entete .bouton-principal { width: auto; margin-top: 0; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    ul { list-style: none; margin: var(--pas-2) 0 0; padding: 0; display: grid; gap: var(--pas-2); }
    li { padding: var(--pas-2); display: flex; flex-wrap: wrap; align-items: center; gap: var(--pas-2); }
    .identite { display: flex; flex-direction: column; gap: 2px; flex: 1 1 200px; min-width: 0; }
    .nom { font-weight: 700; }
    .etat { flex: none; padding: 2px 10px; border-radius: var(--r-s); font-size: .8125rem; font-weight: 700; }
    .etat.actif { background: var(--acquis-clair); color: var(--acquis); }
    .etat.inactif { background: #EEF2F4; color: var(--craie); }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; flex-basis: 100%; }
    .danger { color: #B3261E; border-color: #B3261E; }
  `]
})
export class ComptesSecuriteSurfaceComponent {
  private api = inject(ApiService);

  comptes = signal<CompteSurfaceVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  erreur = signal<string | null>(null);

  dialogueOuvert = signal(false);
  /** Compte modifié ; null : création. */
  enEdition = signal<CompteSurfaceVue | null>(null);
  saisie = { prenom: '', nom: '', email: '' };
  envoi = signal(false);

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    try {
      this.comptes.set(await firstValueFrom(this.api.comptesSurface()));
    } catch {
      this.message.set('Impossible de charger les comptes de sécurité surface.');
    } finally {
      this.chargement.set(false);
    }
  }

  ouvrir(c: CompteSurfaceVue | null): void {
    this.erreur.set(null);
    this.message.set(null);
    this.enEdition.set(c);
    this.saisie = c ? { prenom: c.prenom, nom: c.nom, email: c.email } : { prenom: '', nom: '', email: '' };
    this.dialogueOuvert.set(true);
  }

  enregistrer(): void {
    const s = this.saisie;
    if (!s.prenom.trim() || !s.nom.trim() || !s.email.trim()) {
      this.erreur.set('Prénom, nom et e-mail sont obligatoires.');
      return;
    }
    const c = this.enEdition();
    this.envoi.set(true);
    this.erreur.set(null);
    (c ? this.api.modifierCompteSurface(c.id, s) : this.api.creerCompteSurface(s)).subscribe({
      next: compte => {
        this.envoi.set(false);
        this.dialogueOuvert.set(false);
        this.remplacer(compte);
        this.message.set(c
          ? `${compte.prenom} ${compte.nom} a été modifié·e.`
          : `${compte.prenom} ${compte.nom} a été ajouté·e ; un lien pour définir son mot de passe lui a été envoyé.`);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.erreur.set(e.error?.detail ?? "L'enregistrement n'a pas pu être fait.");
      }
    });
  }

  changerActivation(c: CompteSurfaceVue): void {
    this.message.set(null);
    this.api.changerActivationCompteSurface(c.id, !c.actif).subscribe({
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
