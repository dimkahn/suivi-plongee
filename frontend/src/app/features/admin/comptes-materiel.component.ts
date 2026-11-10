import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { DialogueComponent } from '../../core/dialogue.component';
import { CompteMaterielVue } from '../../core/modeles';

/**
 * Directeurs techniques qui ne sont pas moniteurs du club (Administration ›
 * Personnes) : rôle DIRECTEUR_TECHNIQUE seul. Ils ne gèrent que le matériel,
 * les prêts et les sorties ; ni élèves, ni notation, ni séjours. Pas de
 * niveau, de CACI ni de photo. Supprimé seulement s'il n'a rien enregistré,
 * comme un moniteur ; sinon le serveur refuse (422) et on le désactive.
 */
@Component({
  selector: 'app-comptes-materiel',
  imports: [FormsModule, DialogueComponent],
  template: `
    <div class="entete">
      <div>
        <h1>Directeurs techniques non moniteurs</h1>
        <p class="secondaire">
          Pour une personne qui gère le matériel du club sans être moniteur : inventaire, prêts et retours (scanner
          compris), sorties. Elle ne voit ni les élèves, ni la notation, ni le planning, ni les séjours. Un directeur
          technique qui est aussi moniteur se gère dans « Moniteurs ».
        </p>
      </div>
      <button type="button" class="bouton-principal" (click)="ouvrir(null)">Nouveau directeur technique</button>
    </div>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (comptes().length === 0) {
      <p class="vide">Aucun directeur technique non moniteur.</p>
    } @else {
      <ul class="comptes">
        @for (c of comptes(); track c.id) {
          <li class="carte">
            <div class="identite">
              <span class="nom">{{ c.prenom }} {{ c.nom }}</span>
              <span class="secondaire">{{ c.email }}</span>
            </div>
            <span class="etiquette-etat" [class.ok]="c.actif" [class.neutre]="!c.actif">
              {{ c.actif ? 'Actif' : 'Désactivé' }}
            </span>
            <div class="actions">
              @if (c.actif) {
                <button type="button" class="bouton-discret" (click)="ouvrir(c)">Modifier</button>
                <button type="button" class="bouton-discret" (click)="changerActivation(c, false)">Désactiver</button>
                <button type="button" class="bouton-discret" (click)="envoyerLien(c)">Envoyer un lien de mot de passe</button>
              } @else {
                <button type="button" class="bouton-discret" (click)="changerActivation(c, true)">Réactiver</button>
              }
              <button type="button" class="bouton-discret danger" (click)="supprimer(c)">Supprimer</button>
            </div>
          </li>
        }
      </ul>
    }

    <app-dialogue [ouvert]="dialogueOuvert()" [titre]="titreDialogue()"
                  [erreur]="erreur()" (fermer)="dialogueOuvert.set(false)">
      @if (!enEdition()) {
        <p class="secondaire">La personne reçoit un lien pour définir elle-même son mot de passe.</p>
      }
      <label for="dt-prenom">Prénom</label>
      <input id="dt-prenom" type="text" name="dtPrenom" [(ngModel)]="saisie.prenom">
      <label for="dt-nom">Nom</label>
      <input id="dt-nom" type="text" name="dtNom" [(ngModel)]="saisie.nom">
      <label for="dt-email">E-mail</label>
      <input id="dt-email" type="email" name="dtEmail" [(ngModel)]="saisie.email">

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
    h1 { margin-bottom: var(--pas); }
    .entete { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas-2); flex-wrap: wrap; }
    .entete > div { flex: 1 1 320px; }
    .entete .bouton-principal { width: auto; margin-top: 0; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .comptes { list-style: none; margin: var(--pas-3) 0 0; padding: 0; display: grid; gap: var(--pas-2); }
    .comptes > li { padding: var(--pas-2); display: flex; flex-wrap: wrap; align-items: center; gap: var(--pas-2); }
    .identite { display: flex; flex-direction: column; gap: 2px; flex: 1 1 200px; min-width: 0; }
    .nom { font-weight: 700; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; flex-basis: 100%; }
    .danger { color: #B3261E; border-color: #B3261E; }
  `]
})
export class ComptesMaterielComponent {
  private api = inject(ApiService);

  comptes = signal<CompteMaterielVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  erreur = signal<string | null>(null);

  dialogueOuvert = signal(false);
  /** Compte modifié ; null : création. */
  enEdition = signal<CompteMaterielVue | null>(null);
  saisie = { prenom: '', nom: '', email: '' };
  envoi = signal(false);

  titreDialogue = computed(() => {
    const c = this.enEdition();
    return c ? `Modifier ${c.prenom} ${c.nom}` : 'Nouveau directeur technique non moniteur';
  });

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    try {
      this.comptes.set(await firstValueFrom(this.api.comptesMateriel()));
    } catch {
      this.message.set('Impossible de charger les comptes des directeurs techniques.');
    } finally {
      this.chargement.set(false);
    }
  }

  ouvrir(c: CompteMaterielVue | null): void {
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
    const requete = c ? this.api.modifierCompteMateriel(c.id, s) : this.api.creerCompteMateriel(s);
    this.envoi.set(true);
    this.erreur.set(null);
    requete.subscribe({
      next: compte => {
        this.envoi.set(false);
        this.dialogueOuvert.set(false);
        this.remplacer(compte);
        const nom = `${compte.prenom} ${compte.nom}`;
        this.message.set(c ? `${nom} a été modifié·e.`
          : `${nom} a été ajouté·e ; un lien pour définir son mot de passe lui a été envoyé.`);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.erreur.set(e.error?.detail ?? "L'enregistrement n'a pas pu être fait.");
      }
    });
  }

  changerActivation(c: CompteMaterielVue, actif: boolean): void {
    this.message.set(null);
    this.api.changerActivationCompteMateriel(c.id, actif).subscribe({
      next: maj => {
        this.remplacer(maj);
        this.message.set(`${maj.prenom} ${maj.nom} a été ${actif ? 'réactivé·e' : 'désactivé·e'}.`);
      },
      error: (e: HttpErrorResponse) => this.message.set(e.error?.detail ?? "L'action n'a pas pu être enregistrée.")
    });
  }

  envoyerLien(c: CompteMaterielVue): void {
    if (!confirm(`Envoyer à ${c.prenom} ${c.nom} (${c.email}) un lien pour choisir un nouveau mot de passe ?`)) return;
    this.message.set(null);
    this.api.envoyerLienReinitialisationCompteMateriel(c.id).subscribe({
      next: () => this.message.set(`Lien envoyé à ${c.email} (valable une heure).`),
      error: (e: HttpErrorResponse) => this.message.set(e.error?.detail ?? "Le lien n'a pas pu être envoyé.")
    });
  }

  /** Refusé par le serveur s'il a des écritures au journal du matériel ou des prêts : le message dit de désactiver. */
  supprimer(c: CompteMaterielVue): void {
    if (!confirm(`Supprimer définitivement le compte de ${c.prenom} ${c.nom} ?`)) return;
    this.message.set(null);
    this.api.supprimerCompteMateriel(c.id).subscribe({
      next: () => {
        this.comptes.set(this.comptes().filter(x => x.id !== c.id));
        this.message.set(`Le compte de ${c.prenom} ${c.nom} a été supprimé.`);
      },
      error: (e: HttpErrorResponse) => this.message.set(e.error?.detail ?? "La suppression n'a pas pu être faite.")
    });
  }

  private remplacer(compte: CompteMaterielVue): void {
    const autres = this.comptes().filter(x => x.id !== compte.id);
    this.comptes.set([...autres, compte].sort((a, b) => a.nom.localeCompare(b.nom)));
  }
}
