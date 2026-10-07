import { Component, inject, signal, computed, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { RecadragePhotoComponent } from '../../core/recadrage-photo.component';
import { DialogueComponent } from '../../core/dialogue.component';
import { MoniteurVue } from '../../core/modeles';
import { CACI_LIMITES, EtatCaci, etatCaci, libelleCaci } from '../../core/caci';
import { SaisieCaciComponent } from '../../core/saisie-caci.component';
import { DetailCaciComponent } from '../../core/detail-caci.component';

type NiveauEncadrement = 'E1' | 'E2' | 'E3' | 'E4';

function aVerifier(m: MoniteurVue): boolean {
  return etatCaci(m.certificatValideJusquAu) !== 'valide';
}

@Component({
  selector: 'app-moniteurs',
  imports: [FormsModule, RecadragePhotoComponent, DialogueComponent, SaisieCaciComponent, DetailCaciComponent],
  template: `
    <div class="entete">
      <div>
        <h1>Moniteurs</h1>
        <p class="secondaire">
          Ajout, modification, activation, mot de passe, droit à l'image : les gestes réservés aux
          administrateurs. Le niveau d'encadrement et les rôles (administrateur, directeur technique) ne se changent qu'ici.
        </p>
      </div>
      <button type="button" class="bouton-principal" (click)="ouvrirCreation()">Nouveau moniteur</button>
    </div>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <app-dialogue [ouvert]="creationOuverte()" titre="Ajouter un moniteur" [erreur]="message()"
                  (fermer)="creationOuverte.set(false)">
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

      <label for="niveau-prepare">Niveau d'encadrement préparé</label>
      <select id="niveau-prepare" name="niveauPrepare" [(ngModel)]="niveauEncadrementPrepare">
        <option value="">Aucun</option>
        @for (n of niveauxAuDessus(niveauEncadrement); track n) { <option [value]="n">{{ n }}</option> }
      </select>
      <p class="secondaire">Un stagiaire E3 encadre comme un E3 dans la proposition des palanquées, sous la responsabilité de son tuteur.</p>

      <label for="niveau-plongeur">Niveau de plongeur</label>
      <select id="niveau-plongeur" name="niveauPlongeur" [(ngModel)]="niveauPlongeur">
        <option value="">Non renseigné</option>
        @for (n of niveauxPlongeur; track n) { <option [value]="n">{{ n }}</option> }
      </select>

      <label for="licence">N° de licence</label>
      <input id="licence" type="text" name="licence" [(ngModel)]="numeroLicence" placeholder="Facultatif">

      <app-saisie-caci [(dateExamen)]="caciDateExamen"
                       [(medecin)]="caciMedecin" [(activites)]="caciActivites" />

      <label class="case">
        <input type="checkbox" name="admin" [(ngModel)]="admin">
        Administrateur (gestion des moniteurs, élèves, saisons, référentiel)
      </label>
      <label class="case">
        <input type="checkbox" name="directeurTechnique" [(ngModel)]="directeurTechnique">
        Directeur technique (matériel du club et prêts)
      </label>
      <label class="case">
        <input type="checkbox" name="tiv" [(ngModel)]="tiv">
        TIV (fiches d'inspection des blocs)
      </label>

      <div class="actions-dialogue">
        <button type="button" class="bouton-principal" (click)="creer()" [disabled]="envoiCreation()">
          {{ envoiCreation() ? 'Création…' : 'Ajouter le moniteur' }}
        </button>
        <button type="button" class="bouton-discret" (click)="creationOuverte.set(false)">Annuler</button>
      </div>
    </app-dialogue>

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
              @if (urlPhoto(m.id); as url) {
                <img class="avatar" [src]="url" [alt]="m.prenom + ' ' + m.nom" width="56" height="56">
              } @else {
                <div class="avatar silhouette" aria-hidden="true">{{ initiales(m) }}</div>
              }
              <div class="identite">
                <span class="nom">{{ m.prenom }} {{ m.nom }}</span>
                <span class="secondaire">{{ m.email }}</span>
                <span class="secondaire">
                  {{ m.niveauEncadrement }}{{ m.niveauEncadrementPrepare ? ' (prépare ' + m.niveauEncadrementPrepare + ')' : '' }}{{ m.niveauPlongeur ? ' · plongeur ' + m.niveauPlongeur : '' }}{{ m.numeroLicence ? ' · licence ' + m.numeroLicence : '' }}
                  · Droit à l'image {{ m.autorisationImage ? (m.aPhoto ? 'recueilli, photo déposée' : 'recueilli') : 'non recueilli' }}
                </span>
                <button type="button" [class]="'caci caci-' + etatCaci(m.certificatValideJusquAu)"
                        [attr.aria-label]="libelleCaci(m.certificatValideJusquAu) + ' — détail du CACI de ' + m.prenom + ' ' + m.nom"
                        (click)="caciOuvert.set(m)">
                  {{ libelleCaci(m.certificatValideJusquAu) }}{{ m.caciActivites.includes(caciLimites) ? ' · limites' : '' }}
                </button>
              </div>
              <div class="badges">
                @if (m.admin) { <span class="etat admin">Admin</span> }
                @if (m.directeurTechnique) { <span class="etat admin" title="Directeur technique">DT</span> }
                @if (m.tiv) { <span class="etat admin" title="Technicien en inspection visuelle">TIV</span> }
                <span class="etat" [class.actif]="m.actif" [class.inactif]="!m.actif">
                  {{ m.actif ? 'Actif' : 'Désactivé' }}
                </span>
              </div>
            </div>

            <div class="actions">
              <button type="button" class="bouton-discret" (click)="basculerEdition(m)">
                Modifier
              </button>
              <div class="menu-actions">
                <button type="button" class="bouton-discret" (click)="basculerMenu(m.id)"
                        aria-haspopup="menu" [attr.aria-expanded]="menuOuvert() === m.id">
                  Actions ▾
                </button>
                @if (menuOuvert() === m.id) {
                  <div class="menu-actions-liste" role="menu" (click)="menuOuvert.set(null)">
                    <button type="button" role="menuitem" (click)="changerActivation(m)">
                      {{ m.actif ? 'Désactiver' : 'Activer' }}
                    </button>
                    <button type="button" role="menuitem" (click)="basculerMotDePasse(m.id)">
                      Changer le mot de passe
                    </button>
                    @if (m.actif) {
                      <button type="button" role="menuitem" (click)="envoyerLienReinitialisation(m)"
                              [disabled]="envoiLien() === m.id">
                        {{ envoiLien() === m.id ? 'Envoi…' : 'Envoyer un lien de réinitialisation' }}
                      </button>
                    }
                    <button type="button" role="menuitem" (click)="changerAutorisationImage(m)">
                      {{ m.autorisationImage ? "Retirer le droit à l'image" : "Recueillir le droit à l'image" }}
                    </button>
                    @if (m.autorisationImage) {
                      <button type="button" role="menuitem" (click)="fichierPhoto.click()">
                        {{ m.aPhoto ? 'Remplacer la photo' : 'Déposer une photo' }}
                      </button>
                    }
                    <button type="button" role="menuitem" class="danger" (click)="supprimer(m)">
                      Supprimer
                    </button>
                  </div>
                }
              </div>
              <!-- Hors du menu : le menu se ferme avant que la photo soit choisie. -->
              <input #fichierPhoto type="file" accept="image/jpeg,image/png" hidden (change)="choisirPhoto(m, $event)">
            </div>

          </li>
        }
      </ul>
    }

    <app-dialogue [ouvert]="moniteurEnEdition() !== null"
                  [titre]="'Modifier ' + (moniteurEnEdition()?.prenom ?? '') + ' ' + (moniteurEnEdition()?.nom ?? '')"
                  [erreur]="message()" (fermer)="moniteurEdite.set(null)">
      @if (moniteurEnEdition(); as m) {
        <label for="edition-prenom">Prénom</label>
        <input id="edition-prenom" type="text" name="editionPrenom" [(ngModel)]="edition.prenom">

        <label for="edition-nom">Nom</label>
        <input id="edition-nom" type="text" name="editionNom" [(ngModel)]="edition.nom">

        <label for="edition-email">E-mail</label>
        <input id="edition-email" type="email" name="editionEmail" [(ngModel)]="edition.email">

        <label for="edition-niveau">Niveau d'encadrement</label>
        <select id="edition-niveau" name="editionNiveau" [(ngModel)]="edition.niveauEncadrement">
          <option value="E1">E1</option>
          <option value="E2">E2</option>
          <option value="E3">E3</option>
          <option value="E4">E4</option>
        </select>

        <label for="edition-niveau-prepare">Niveau d'encadrement préparé</label>
        <select id="edition-niveau-prepare" name="editionNiveauPrepare" [(ngModel)]="edition.niveauEncadrementPrepare">
          <option value="">Aucun</option>
          @for (n of niveauxAuDessus(edition.niveauEncadrement); track n) { <option [value]="n">{{ n }}</option> }
        </select>
        <p class="secondaire">Un stagiaire E3 encadre comme un E3 dans la proposition des palanquées, sous la responsabilité de son tuteur.</p>

        <label for="edition-niveau-plongeur">Niveau de plongeur</label>
        <select id="edition-niveau-plongeur" name="editionNiveauPlongeur" [(ngModel)]="edition.niveauPlongeur">
          <option value="">Non renseigné</option>
          @for (n of niveauxPlongeur; track n) { <option [value]="n">{{ n }}</option> }
        </select>

        <label for="edition-licence">N° de licence</label>
        <input id="edition-licence" type="text" name="editionLicence"
               [(ngModel)]="edition.numeroLicence" placeholder="Facultatif">

        <app-saisie-caci prefixe="edition-" [(dateExamen)]="edition.caciDateExamen" [(medecin)]="edition.caciMedecin"
                         [(activites)]="edition.caciActivites" />

        <label class="case">
          <input type="checkbox" name="editionAdmin" [(ngModel)]="edition.admin"
                 [disabled]="estMoi(m) && m.admin">
          Administrateur
        </label>
        @if (estMoi(m) && m.admin) {
          <p class="secondaire">
            Vous ne pouvez pas vous retirer vous-même ce rôle : demandez-le à un autre administrateur.
          </p>
        }
        <label class="case">
          <input type="checkbox" name="editionDirecteurTechnique" [(ngModel)]="edition.directeurTechnique">
          Directeur technique (matériel du club et prêts)
        </label>
        <label class="case">
          <input type="checkbox" name="editionTiv" [(ngModel)]="edition.tiv">
          TIV (fiches d'inspection des blocs)
        </label>

        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" (click)="modifier(m)" [disabled]="envoiEdition()">
            {{ envoiEdition() ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
          <button type="button" class="bouton-discret" (click)="moniteurEdite.set(null)">Annuler</button>
        </div>
      }
    </app-dialogue>

    <app-dialogue [ouvert]="moniteurPourMotDePasse() !== null"
                  [titre]="'Mot de passe de ' + (moniteurPourMotDePasse()?.prenom ?? '') + ' ' + (moniteurPourMotDePasse()?.nom ?? '')"
                  [erreur]="message()" (fermer)="moniteurMotDePasse.set(null)">
      @if (moniteurPourMotDePasse(); as m) {
        <label for="nouveau-mot-de-passe">Nouveau mot de passe (10 caractères minimum)</label>
        <input id="nouveau-mot-de-passe" type="password" name="nouveauMotDePasse" autocomplete="new-password"
               [(ngModel)]="nouveauMotDePasse">
        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" (click)="changerMotDePasse(m)"
                  [disabled]="envoiMotDePasse()">
            {{ envoiMotDePasse() ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
          <button type="button" class="bouton-discret" (click)="moniteurMotDePasse.set(null)">Annuler</button>
        </div>
      }
    </app-dialogue>

    <!-- Détail du CACI, en lecture : la saisie se fait par « Modifier ». -->
    <app-dialogue [ouvert]="caciOuvert() !== null"
                  [titre]="'CACI de ' + (caciOuvert()?.prenom ?? '') + ' ' + (caciOuvert()?.nom ?? '')"
                  (fermer)="caciOuvert.set(null)">
      @if (caciOuvert(); as m) {
        <app-detail-caci [finValidite]="m.certificatValideJusquAu" [dateExamen]="m.caciDateExamen"
                         [medecin]="m.caciMedecin" [activites]="m.caciActivites" />
        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" (click)="caciOuvert.set(null)">Fermer</button>
        </div>
      }
    </app-dialogue>

    @if (recadrage(); as r) {
      <app-recadrage-photo [fichier]="r.fichier" [titre]="'Recadrer la photo de ' + r.moniteur.prenom + ' ' + r.moniteur.nom"
                           [enCours]="recadrageEnCours()" (valide)="deposerPhoto($event)"
                           (annule)="recadrage.set(null)" (illisible)="imageIllisible()" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  host: {
    '(document:click)': 'fermerMenuSiAilleurs($event)',
    '(document:keydown.escape)': 'menuOuvert.set(null)'
  },
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .entete { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas-2); flex-wrap: wrap; }
    .entete > div { flex: 1 1 320px; }
    .entete .bouton-principal { width: auto; margin-top: 0; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .case { display: flex; align-items: center; gap: var(--pas); font-weight: 400; min-height: 44px; }
    .case input { width: auto; }
    .bouton-principal { width: 100%; margin-top: var(--pas-3); }

    .filtres {
      display: flex; flex-wrap: wrap; gap: var(--pas-2) var(--pas-3); align-items: flex-end;
      margin-bottom: var(--pas-2);
    }
    .filtres > div { min-width: 220px; flex: 0 1 320px; }
    .filtres label { margin: 0 0 4px; }
    .filtres input, .filtres select { margin: 0; }

    /* Le CACI ouvre son détail : un bouton à l'allure du texte, 44 px de haut. */
    .caci {
      align-self: flex-start; min-height: 44px; padding: 0; border: 0; background: none; text-align: left;
      font: inherit; font-size: .875rem; font-weight: 700; cursor: pointer; text-decoration: underline dotted;
    }
    .caci-valide { color: var(--acquis); }
    .caci-bientot { color: var(--en-cours); }
    .caci-expire, .caci-absent { color: #B3261E; }

    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2); }
    li { padding: var(--pas-2); }
    .ligne { display: flex; align-items: flex-start; gap: var(--pas-2); }
    .identite { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .avatar {
      flex: none; width: 56px; height: 56px; border-radius: 50%; object-fit: cover; background: var(--fond);
    }
    .silhouette {
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-titres), sans-serif; font-size: .9375rem; font-weight: 700; color: var(--craie);
    }
    .nom { font-weight: 700; }
    .etat {
      flex: none; padding: 2px 10px; border-radius: var(--r-s); font-size: .8125rem; font-weight: 700;
    }
    .etat.actif { background: var(--acquis-clair); color: var(--acquis); }
    .etat.inactif { background: #EEF2F4; color: var(--craie); }
    .etat.admin { background: var(--profond); color: #fff; }
    .badges { display: flex; gap: var(--pas); flex: none; }

    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }
    .danger { color: #B3261E; border-color: #B3261E; }

    @media (max-width: 600px) {
      .ligne { flex-wrap: wrap; }
    }
  `]
})
export class MoniteursComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);

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
  /** Moniteur en formation ; chaîne vide = ne prépare rien. */
  niveauEncadrementPrepare = '';
  /** Distinct de l'encadrement : un E1 peut n'être que N2. Chaîne vide = non renseigné. */
  niveauPlongeur = '';
  readonly niveauxPlongeur = ['N1', 'N2', 'N3', 'N4', 'N5'];
  numeroLicence = '';
  caciDateExamen = '';
  caciMedecin = '';
  caciActivites: string[] = [];
  admin = false;
  directeurTechnique = false;
  tiv = false;
  envoiCreation = signal(false);
  creationOuverte = signal(false);

  moniteurEdite = signal<number | null>(null);
  edition = { prenom: '', nom: '', email: '', niveauEncadrement: 'E1' as NiveauEncadrement,
              niveauEncadrementPrepare: '', niveauPlongeur: '',
              numeroLicence: '',
              caciDateExamen: '', caciMedecin: '', caciActivites: [] as string[],
              admin: false, directeurTechnique: false, tiv: false };

  /** Moniteur dont on consulte le détail du CACI. */
  caciOuvert = signal<MoniteurVue | null>(null);
  readonly caciLimites = CACI_LIMITES;
  envoiEdition = signal(false);

  moniteurEnEdition = computed(() => this.liste().find(m => m.id === this.moniteurEdite()) ?? null);

  moniteurMotDePasse = signal<number | null>(null);
  moniteurPourMotDePasse = computed(() => this.liste().find(m => m.id === this.moniteurMotDePasse()) ?? null);
  nouveauMotDePasse = '';
  envoiMotDePasse = signal(false);

  recadrage = signal<{ moniteur: MoniteurVue; fichier: File } | null>(null);
  recadrageEnCours = signal(false);

  constructor() {
    void this.charger();
    inject(DestroyRef).onDestroy(() => {
      for (const url of this.urlsPhotos().values()) URL.revokeObjectURL(url);
    });
  }

  /** Photos affichées sur les lignes, par moniteur (adresses locales des images). */
  private urlsPhotos = signal<Map<number, string>>(new Map());

  private chargerPhoto(moniteurId: number): void {
    this.api.photoMoniteur(moniteurId).then(
      blob => this.poserPhoto(moniteurId, URL.createObjectURL(blob)),
      () => { /* pas de photo consultable : les initiales restent affichées */ }
    );
  }

  /** Remplace (ou retire, avec null) la photo affichée d'un moniteur. */
  private poserPhoto(moniteurId: number, url: string | null): void {
    const copie = new Map(this.urlsPhotos());
    const ancienne = copie.get(moniteurId);
    if (ancienne) URL.revokeObjectURL(ancienne);
    if (url) copie.set(moniteurId, url);
    else copie.delete(moniteurId);
    this.urlsPhotos.set(copie);
  }

  urlPhoto(moniteurId: number): string | null {
    return this.urlsPhotos().get(moniteurId) ?? null;
  }

  initiales(m: MoniteurVue): string {
    return ((m.prenom[0] ?? '') + (m.nom[0] ?? '')).toUpperCase();
  }

  private async charger(): Promise<void> {
    this.chargement.set(true);
    try {
      const liste = await firstValueFrom(this.api.moniteurs());
      this.liste.set(liste);
      for (const m of liste) {
        if (m.aPhoto) this.chargerPhoto(m.id);
      }
    } catch {
      this.message.set('Impossible de charger la liste des moniteurs.');
    } finally {
      this.chargement.set(false);
    }
  }

  ouvrirCreation(): void {
    this.message.set(null);
    this.moniteurEdite.set(null);
    this.moniteurMotDePasse.set(null);
    this.creationOuverte.set(true);
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
      niveauEncadrementPrepare: this.prepareAuDessus(this.niveauEncadrement, this.niveauEncadrementPrepare),
      niveauPlongeur: this.niveauPlongeur || null,
      numeroLicence: this.numeroLicence || null,
      caciDateExamen: this.caciDateExamen || null,
      caciMedecin: this.caciMedecin || null,
      caciActivites: this.caciActivites,
      admin: this.admin,
      directeurTechnique: this.directeurTechnique,
      tiv: this.tiv
    }).subscribe({
      next: m => {
        this.envoiCreation.set(false);
        this.creationOuverte.set(false);
        this.liste.set([...this.liste(), m].sort((a, b) => a.nom.localeCompare(b.nom)));
        this.prenom = '';
        this.nom = '';
        this.email = '';
        this.niveauEncadrementPrepare = '';
        this.niveauPlongeur = '';
        this.numeroLicence = '';
        this.caciDateExamen = '';
        this.caciMedecin = '';
        this.caciActivites = [];
        this.admin = false;
        this.directeurTechnique = false;
        this.tiv = false;
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

  /** Niveaux qu'un moniteur peut préparer : ceux au-dessus de celui qu'il détient. */
  niveauxAuDessus(detenu: NiveauEncadrement): NiveauEncadrement[] {
    const tous: NiveauEncadrement[] = ['E1', 'E2', 'E3', 'E4'];
    return tous.slice(tous.indexOf(detenu) + 1);
  }

  /** Le niveau préparé n'est envoyé que s'il reste au-dessus du niveau détenu (qui a pu changer entre-temps). */
  private prepareAuDessus(detenu: NiveauEncadrement, prepare: string): string | null {
    return (this.niveauxAuDessus(detenu) as string[]).includes(prepare) ? prepare : null;
  }

  basculerEdition(m: MoniteurVue): void {
    this.message.set(null);
    this.moniteurMotDePasse.set(null);
    this.edition = {
      prenom: m.prenom,
      nom: m.nom,
      email: m.email,
      niveauEncadrement: m.niveauEncadrement ?? 'E1',
      niveauEncadrementPrepare: m.niveauEncadrementPrepare ?? '',
      niveauPlongeur: m.niveauPlongeur ?? '',
      numeroLicence: m.numeroLicence ?? '',
      caciDateExamen: m.caciDateExamen ?? '',
      caciMedecin: m.caciMedecin ?? '',
      caciActivites: [...(m.caciActivites ?? [])],
      admin: m.admin,
      directeurTechnique: m.directeurTechnique,
      tiv: m.tiv
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
      ...e, niveauEncadrementPrepare: this.prepareAuDessus(e.niveauEncadrement, e.niveauEncadrementPrepare),
      niveauPlongeur: e.niveauPlongeur || null, numeroLicence: e.numeroLicence || null,
      caciDateExamen: e.caciDateExamen || null, caciMedecin: e.caciMedecin || null
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
    this.message.set(null);
    this.moniteurEdite.set(null);
    this.moniteurMotDePasse.set(id);
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

  /** Moniteur dont le lien de réinitialisation est en cours d'envoi. */
  envoiLien = signal<number | null>(null);

  envoyerLienReinitialisation(m: MoniteurVue): void {
    if (!confirm(`Envoyer à ${m.prenom} ${m.nom} (${m.email}) un lien pour choisir un nouveau mot de passe ?`)) return;
    this.message.set(null);
    this.envoiLien.set(m.id);
    this.api.envoyerLienReinitialisationMoniteur(m.id).subscribe({
      next: () => {
        this.envoiLien.set(null);
        this.message.set(`Lien de réinitialisation envoyé à ${m.email} (valable une heure).`);
      },
      error: (e: HttpErrorResponse) => {
        this.envoiLien.set(null);
        this.message.set(e.error?.detail ?? "Le lien n'a pas pu être envoyé.");
      }
    });
  }

  /** Le serveur refuse aussi qu'un administrateur se retire lui-même ce rôle ; ceci n'est que du confort. */
  estMoi(m: MoniteurVue): boolean {
    return m.email.toLowerCase() === this.auth.session()?.email.toLowerCase();
  }

  changerAutorisationImage(m: MoniteurVue): void {
    if (m.autorisationImage && m.aPhoto
        && !confirm(`Retirer le droit à l'image de ${m.prenom} ${m.nom} ? Sa photo sera supprimée.`)) return;
    this.message.set(null);
    this.api.changerAutorisationImageMoniteur(m.id, !m.autorisationImage).subscribe({
      next: maj => {
        // Retirer le consentement supprime aussi la photo côté serveur.
        if (!maj.aPhoto) this.poserPhoto(maj.id, null);
        this.remplacer(maj);
      },
      error: (e: HttpErrorResponse) =>
        this.message.set(e.error?.detail ?? "L'action n'a pas pu être enregistrée.")
    });
  }

  /** Ouvre le recadrage : la photo n'est envoyée qu'une fois validée (voir {@link deposerPhoto}). */
  choisirPhoto(m: MoniteurVue, evenement: Event): void {
    const entree = evenement.target as HTMLInputElement;
    const fichier = entree.files?.[0];
    entree.value = ''; // permet de rechoisir le même fichier plus tard
    if (!fichier) return;
    this.message.set(null);
    this.recadrage.set({ moniteur: m, fichier });
  }

  imageIllisible(): void {
    this.recadrage.set(null);
    this.message.set("Cette image n'a pas pu être lue.");
  }

  async deposerPhoto(fichier: File): Promise<void> {
    const r = this.recadrage();
    if (!r) return;
    this.recadrageEnCours.set(true);
    try {
      await firstValueFrom(this.api.deposerPhotoMoniteur(r.moniteur.id, fichier));
      const actuel = this.liste().find(x => x.id === r.moniteur.id) ?? r.moniteur;
      this.remplacer({ ...actuel, aPhoto: true });
      this.poserPhoto(r.moniteur.id, URL.createObjectURL(fichier));
      this.message.set(`Photo enregistrée pour ${r.moniteur.prenom} ${r.moniteur.nom}.`);
      this.recadrage.set(null);
    } catch (err) {
      this.message.set((err as HttpErrorResponse).error?.detail ?? "La photo n'a pas pu être déposée.");
    } finally {
      this.recadrageEnCours.set(false);
    }
  }

  supprimer(m: MoniteurVue): void {
    if (!confirm(`Supprimer définitivement le compte de ${m.prenom} ${m.nom} ?`)) return;
    this.message.set(null);
    this.api.supprimerMoniteur(m.id).subscribe({
      next: () => {
        this.poserPhoto(m.id, null);
        this.liste.set(this.liste().filter(x => x.id !== m.id));
      },
      error: (e: HttpErrorResponse) =>
        this.message.set(e.error?.detail ?? "La suppression n'a pas pu être enregistrée.")
    });
  }

  /** Moniteur dont le menu « Actions » est déroulé (un seul à la fois). */
  menuOuvert = signal<number | null>(null);

  basculerMenu(id: number): void {
    this.menuOuvert.set(this.menuOuvert() === id ? null : id);
  }

  /** Un clic hors du menu le referme. */
  fermerMenuSiAilleurs(evenement: Event): void {
    if (!(evenement.target as Element | null)?.closest?.('.menu-actions')) this.menuOuvert.set(null);
  }

  private remplacer(maj: MoniteurVue): void {
    this.liste.set(this.liste().map(m => m.id === maj.id ? maj : m));
  }
}
