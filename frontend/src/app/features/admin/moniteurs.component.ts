import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { MoniteurVue } from '../../core/modeles';
import { EtatCaci, etatCaci, libelleCaci } from '../../core/caci';

type NiveauEncadrement = 'E1' | 'E2' | 'E3' | 'E4';

function aVerifier(m: MoniteurVue): boolean {
  return etatCaci(m.certificatValideJusquAu) !== 'valide';
}

@Component({
  selector: 'app-moniteurs',
  imports: [FormsModule],
  template: `
    <h1>Moniteurs</h1>
    <p class="secondaire">
      Ajout, modification, activation, mot de passe : les gestes réservés aux administrateurs.
      Le niveau d'encadrement ne se change qu'ici.
    </p>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <section class="carte panneau">
      <h2>Ajouter un moniteur</h2>
      <p class="secondaire">
        Le moniteur reçoit un lien pour définir lui-même son mot de passe :
        il ne transite jamais par vous.
      </p>

      <label for="prenom">Prénom</label>
      <input id="prenom" type="text" name="prenom" [(ngModel)]="prenom">

      <label for="nom">Nom</label>
      <input id="nom" type="text" name="nom" [(ngModel)]="nom">

      <label for="email">E-mail</label>
      <input id="email" type="email" name="email" [(ngModel)]="email">

      <label for="niveau">Niveau d'encadrement</label>
      <select id="niveau" name="niveau" [(ngModel)]="niveauEncadrement">
        <option value="E1">E1</option>
        <option value="E2">E2</option>
        <option value="E3">E3</option>
        <option value="E4">E4</option>
      </select>

      <label for="licence">N° de licence</label>
      <input id="licence" type="text" name="licence" [(ngModel)]="numeroLicence" placeholder="Facultatif">

      <label for="caci">CACI valide jusqu'au</label>
      <input id="caci" type="date" name="caci" [(ngModel)]="certificatValideJusquAu">

      <button type="button" class="bouton-principal" (click)="creer()" [disabled]="envoiCreation()">
        {{ envoiCreation() ? 'Création…' : 'Ajouter le moniteur' }}
      </button>
    </section>

    <div class="filtres">
      <div>
        <label for="filtre-nom">Rechercher un moniteur</label>
        <input id="filtre-nom" type="search" name="filtreNom" placeholder="Nom ou prénom"
               [ngModel]="filtreNom()" (ngModelChange)="filtreNom.set($event)">
      </div>
      <div>
        <label for="filtre-caci">CACI</label>
        <select id="filtre-caci" name="filtreCaci" [ngModel]="filtreCaci()" (ngModelChange)="filtreCaci.set($event)">
          <option value="TOUS">Tous</option>
          <option value="A_VERIFIER">À vérifier (expiré, bientôt échu ou non renseigné)</option>
        </select>
      </div>
    </div>

    @if (aVerifier() > 0) {
      <p class="alerte" role="status">
        {{ aVerifier() }} moniteur(s) actif(s) avec un CACI expiré, bientôt échu ou non renseigné.
      </p>
    }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (liste().length === 0) {
      <div class="carte vide"><p>Aucun moniteur enregistré.</p></div>
    } @else if (listeFiltree().length === 0) {
      <div class="carte vide"><p>Aucun moniteur ne correspond à la recherche.</p></div>
    } @else {
      <ul>
        @for (m of listeFiltree(); track m.id) {
          <li class="carte">
            <div class="ligne">
              <div class="identite">
                <span class="nom">{{ m.prenom }} {{ m.nom }}</span>
                <span class="secondaire">{{ m.email }}</span>
                <span class="secondaire">
                  {{ m.niveauEncadrement }}{{ m.numeroLicence ? ' · licence ' + m.numeroLicence : '' }}
                </span>
                <span [class]="'caci caci-' + etatCaci(m.certificatValideJusquAu)">
                  {{ libelleCaci(m.certificatValideJusquAu) }}
                </span>
              </div>
              <span class="etat" [class.actif]="m.actif" [class.inactif]="!m.actif">
                {{ m.actif ? 'Actif' : 'Désactivé' }}
              </span>
            </div>

            <div class="actions">
              <button type="button" class="bouton-discret" (click)="basculerEdition(m)">
                Modifier
              </button>
              <button type="button" class="bouton-discret" (click)="changerActivation(m)">
                {{ m.actif ? 'Désactiver' : 'Activer' }}
              </button>
              <button type="button" class="bouton-discret" (click)="basculerMotDePasse(m.id)">
                Changer le mot de passe
              </button>
              <button type="button" class="bouton-discret danger" (click)="supprimer(m)">
                Supprimer
              </button>
            </div>

            @if (moniteurEdite() === m.id) {
              <div class="mot-de-passe">
                <label [for]="'prenom-' + m.id">Prénom</label>
                <input [id]="'prenom-' + m.id" type="text" name="editionPrenom" [(ngModel)]="edition.prenom">

                <label [for]="'nom-' + m.id">Nom</label>
                <input [id]="'nom-' + m.id" type="text" name="editionNom" [(ngModel)]="edition.nom">

                <label [for]="'email-' + m.id">E-mail</label>
                <input [id]="'email-' + m.id" type="email" name="editionEmail" [(ngModel)]="edition.email">

                <label [for]="'niveau-' + m.id">Niveau d'encadrement</label>
                <select [id]="'niveau-' + m.id" name="editionNiveau" [(ngModel)]="edition.niveauEncadrement">
                  <option value="E1">E1</option>
                  <option value="E2">E2</option>
                  <option value="E3">E3</option>
                  <option value="E4">E4</option>
                </select>

                <label [for]="'licence-' + m.id">N° de licence</label>
                <input [id]="'licence-' + m.id" type="text" name="editionLicence"
                       [(ngModel)]="edition.numeroLicence" placeholder="Facultatif">

                <label [for]="'caci-' + m.id">CACI valide jusqu'au</label>
                <input [id]="'caci-' + m.id" type="date" name="editionCaci"
                       [(ngModel)]="edition.certificatValideJusquAu">

                <div class="actions">
                  <button type="button" class="bouton-principal" (click)="modifier(m)"
                          [disabled]="envoiEdition()">
                    {{ envoiEdition() ? 'Enregistrement…' : 'Enregistrer' }}
                  </button>
                  <button type="button" class="bouton-discret" (click)="basculerEdition(m)">
                    Annuler
                  </button>
                </div>
              </div>
            }

            @if (moniteurMotDePasse() === m.id) {
              <div class="mot-de-passe">
                <label [for]="'mdp-' + m.id">Nouveau mot de passe (10 caractères minimum)</label>
                <input [id]="'mdp-' + m.id" type="password" name="nouveauMotDePasse"
                       [(ngModel)]="nouveauMotDePasse">
                <div class="actions">
                  <button type="button" class="bouton-principal" (click)="changerMotDePasse(m)"
                          [disabled]="envoiMotDePasse()">
                    {{ envoiMotDePasse() ? 'Enregistrement…' : 'Enregistrer' }}
                  </button>
                  <button type="button" class="bouton-discret" (click)="basculerMotDePasse(m.id)">
                    Annuler
                  </button>
                </div>
              </div>
            }
          </li>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .panneau { max-width: 480px; padding: var(--pas-3); margin: var(--pas-3) 0; }
    .panneau h2 { margin-bottom: 4px; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .bouton-principal { width: 100%; margin-top: var(--pas-3); }

    .filtres {
      display: flex; flex-wrap: wrap; gap: var(--pas-2) var(--pas-3); align-items: flex-end;
      margin-bottom: var(--pas-2);
    }
    .filtres > div { min-width: 220px; flex: 0 1 320px; }
    .filtres label { margin: 0 0 4px; }
    .filtres input, .filtres select { margin: 0; }

    .caci { font-size: .875rem; font-weight: 700; }
    .caci-valide { color: var(--acquis); }
    .caci-bientot { color: var(--en-cours); }
    .caci-expire, .caci-absent { color: #B3261E; }

    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2); }
    li { padding: var(--pas-2); }
    .ligne { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas-2); }
    .identite { display: flex; flex-direction: column; gap: 2px; }
    .nom { font-weight: 700; }
    .etat {
      flex: none; padding: 2px 10px; border-radius: var(--r-s); font-size: .8125rem; font-weight: 700;
    }
    .etat.actif { background: var(--acquis-clair); color: var(--acquis); }
    .etat.inactif { background: #EEF2F4; color: var(--craie); }

    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }
    .danger { color: #B3261E; border-color: #B3261E; }

    .mot-de-passe {
      margin-top: var(--pas-2); padding: var(--pas-2); border-radius: var(--r-s); background: var(--fond);
    }
    .mot-de-passe .actions { margin-top: var(--pas-2); }
    .mot-de-passe .bouton-principal { width: auto; margin-top: 0; }

    @media (max-width: 600px) {
      .ligne { flex-direction: column; }
    }
  `]
})
export class MoniteursComponent {
  private api = inject(ApiService);

  liste = signal<MoniteurVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);

  readonly etatCaci = etatCaci;
  readonly libelleCaci = libelleCaci;

  filtreNom = signal('');
  filtreCaci = signal<'TOUS' | 'A_VERIFIER'>('TOUS');
  listeFiltree = computed(() => {
    const recherche = this.filtreNom().trim().toLocaleLowerCase();
    return this.liste().filter(m =>
      (!recherche || `${m.prenom} ${m.nom}`.toLocaleLowerCase().includes(recherche))
      && (this.filtreCaci() === 'TOUS' || aVerifier(m)));
  });

  /** Seuls les comptes actifs comptent : un moniteur désactivé n'encadre plus. */
  aVerifier = computed(() => this.liste().filter(m => m.actif && aVerifier(m)).length);

  prenom = '';
  nom = '';
  email = '';
  niveauEncadrement: NiveauEncadrement = 'E1';
  numeroLicence = '';
  certificatValideJusquAu = '';
  envoiCreation = signal(false);

  moniteurEdite = signal<number | null>(null);
  edition = { prenom: '', nom: '', email: '', niveauEncadrement: 'E1' as NiveauEncadrement, numeroLicence: '',
              certificatValideJusquAu: '' };
  envoiEdition = signal(false);

  moniteurMotDePasse = signal<number | null>(null);
  nouveauMotDePasse = '';
  envoiMotDePasse = signal(false);

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    this.chargement.set(true);
    try {
      this.liste.set(await firstValueFrom(this.api.moniteurs()));
    } catch {
      this.message.set('Impossible de charger la liste des moniteurs.');
    } finally {
      this.chargement.set(false);
    }
  }

  creer(): void {
    if (!this.prenom || !this.nom || !this.email) {
      this.message.set('Prénom, nom et e-mail sont obligatoires.');
      return;
    }
    this.envoiCreation.set(true);
    this.message.set(null);
    this.api.creerMoniteur({
      email: this.email,
      nom: this.nom,
      prenom: this.prenom,
      niveauEncadrement: this.niveauEncadrement,
      numeroLicence: this.numeroLicence || null,
      certificatValideJusquAu: this.certificatValideJusquAu || null
    }).subscribe({
      next: m => {
        this.envoiCreation.set(false);
        this.liste.set([...this.liste(), m].sort((a, b) => a.nom.localeCompare(b.nom)));
        this.prenom = '';
        this.nom = '';
        this.email = '';
        this.numeroLicence = '';
        this.certificatValideJusquAu = '';
        this.message.set(`${m.prenom} ${m.nom} a été ajouté·e ; un lien pour définir son mot de passe lui a été envoyé.`);
      },
      error: (e: HttpErrorResponse) => {
        this.envoiCreation.set(false);
        this.message.set(e.error?.detail ?? "La création n'a pas pu être enregistrée.");
      }
    });
  }

  changerActivation(m: MoniteurVue): void {
    this.message.set(null);
    this.api.changerActivationMoniteur(m.id, !m.actif).subscribe({
      next: maj => this.remplacer(maj),
      error: (e: HttpErrorResponse) =>
        this.message.set(e.error?.detail ?? "L'action n'a pas pu être enregistrée.")
    });
  }

  basculerEdition(m: MoniteurVue): void {
    if (this.moniteurEdite() === m.id) {
      this.moniteurEdite.set(null);
      return;
    }
    this.moniteurMotDePasse.set(null);
    this.edition = {
      prenom: m.prenom,
      nom: m.nom,
      email: m.email,
      niveauEncadrement: m.niveauEncadrement ?? 'E1',
      numeroLicence: m.numeroLicence ?? '',
      certificatValideJusquAu: m.certificatValideJusquAu ?? ''
    };
    this.moniteurEdite.set(m.id);
  }

  modifier(m: MoniteurVue): void {
    const e = this.edition;
    if (!e.prenom.trim() || !e.nom.trim() || !e.email.trim()) {
      this.message.set('Prénom, nom et e-mail sont obligatoires.');
      return;
    }
    this.envoiEdition.set(true);
    this.message.set(null);
    this.api.modifierMoniteur(m.id, {
      ...e, numeroLicence: e.numeroLicence || null, certificatValideJusquAu: e.certificatValideJusquAu || null
    }).subscribe({
      next: maj => {
        this.envoiEdition.set(false);
        this.moniteurEdite.set(null);
        this.remplacer(maj);
        this.message.set(maj.email.toLowerCase() !== m.email.toLowerCase()
          ? `${maj.prenom} ${maj.nom} a été modifié·e ; il ou elle devra se reconnecter avec ${maj.email}.`
          : `${maj.prenom} ${maj.nom} a été modifié·e.`);
      },
      error: (err: HttpErrorResponse) => {
        this.envoiEdition.set(false);
        this.message.set(err.error?.detail ?? "La modification n'a pas pu être enregistrée.");
      }
    });
  }

  basculerMotDePasse(id: number): void {
    this.moniteurEdite.set(null);
    this.moniteurMotDePasse.set(this.moniteurMotDePasse() === id ? null : id);
    this.nouveauMotDePasse = '';
  }

  changerMotDePasse(m: MoniteurVue): void {
    if (this.nouveauMotDePasse.length < 10) {
      this.message.set('Le mot de passe doit compter au moins 10 caractères.');
      return;
    }
    this.envoiMotDePasse.set(true);
    this.api.changerMotDePasseMoniteur(m.id, this.nouveauMotDePasse).subscribe({
      next: () => {
        this.envoiMotDePasse.set(false);
        this.moniteurMotDePasse.set(null);
        this.message.set(`Mot de passe mis à jour pour ${m.prenom} ${m.nom}.`);
      },
      error: (e: HttpErrorResponse) => {
        this.envoiMotDePasse.set(false);
        this.message.set(e.error?.detail ?? "Le mot de passe n'a pas pu être mis à jour.");
      }
    });
  }

  supprimer(m: MoniteurVue): void {
    if (!confirm(`Supprimer définitivement le compte de ${m.prenom} ${m.nom} ?`)) return;
    this.message.set(null);
    this.api.supprimerMoniteur(m.id).subscribe({
      next: () => this.liste.set(this.liste().filter(x => x.id !== m.id)),
      error: (e: HttpErrorResponse) =>
        this.message.set(e.error?.detail ?? "La suppression n'a pas pu être enregistrée.")
    });
  }

  private remplacer(maj: MoniteurVue): void {
    this.liste.set(this.liste().map(m => m.id === maj.id ? maj : m));
  }
}
