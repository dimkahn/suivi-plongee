import { Component, DestroyRef, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AdhesionVue, CursusVue, EleveVue, GroupeEntrainementVue, SaisonVue } from '../../core/modeles';
import { DateFrPipe } from '../../core/date-fr';
import { etatCaci, libelleCaci } from '../../core/caci';
import { SaisieCaciComponent } from '../../core/saisie-caci.component';
import { RecadragePhotoComponent } from '../../core/recadrage-photo.component';
import { DialogueComponent } from '../../core/dialogue.component';
import { NgTemplateOutlet } from '@angular/common';

const STATUTS = ['EN_COURS', 'VALIDE', 'DELIVRE', 'SUSPENDU', 'ABANDON'] as const;

interface FormulaireEleve {
  nom: string;
  prenom: string;
  dateNaissance: string;
  numeroLicence: string;
  caciDateExamen: string;
  caciMedecin: string;
  caciActivites: string[];
  dernierNiveau: string;
  email: string;
  telephone: string;
  contactUrgenceNom: string;
  contactUrgenceTelephone: string;
  tailleGilet: string;
  tailleCombinaison: string;
  autorisationLegale: boolean;
}

function formulaireVide(): FormulaireEleve {
  return { nom: '', prenom: '', dateNaissance: '', numeroLicence: '',
           caciDateExamen: '', caciMedecin: '', caciActivites: [], dernierNiveau: '', email: '', telephone: '',
           contactUrgenceNom: '', contactUrgenceTelephone: '', tailleGilet: '', tailleCombinaison: '',
           autorisationLegale: false };
}

/** Ce que la création fait en plus du dossier : rattachement à une saison, photo. */
type FormationCreation = 'MAINTIEN' | 'N1' | 'N2' | 'N3';

function depuis(e: EleveVue): FormulaireEleve {
  return {
    nom: e.nom, prenom: e.prenom, dateNaissance: e.dateNaissance ?? '',
    numeroLicence: e.numeroLicence ?? '',
    caciDateExamen: e.caciDateExamen ?? '', caciMedecin: e.caciMedecin ?? '', caciActivites: [...(e.caciActivites ?? [])],
    dernierNiveau: e.dernierNiveau ?? '', email: e.email ?? '', telephone: e.telephone ?? '',
    contactUrgenceNom: e.contactUrgenceNom ?? '', contactUrgenceTelephone: e.contactUrgenceTelephone ?? '',
    tailleGilet: e.tailleGilet ?? '', tailleCombinaison: e.tailleCombinaison ?? '',
    autorisationLegale: e.autorisationLegale
  };
}

function trier(eleves: EleveVue[]): EleveVue[] {
  return eleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
}

@Component({
  selector: 'app-eleves',
  imports: [FormsModule, NgTemplateOutlet, DateFrPipe, RecadragePhotoComponent, DialogueComponent, SaisieCaciComponent],
  template: `
    <!-- Suggestions pour le gilet ; la taille reste libre. La combinaison n'en a pas : texte libre seulement. -->
    <datalist id="tailles-gilet">
      @for (t of taillesGilet; track t) { <option [value]="t"></option> }
    </datalist>
    <div class="entete">
      <div>
        <h1>Élèves</h1>
        <p class="secondaire">Dossier, autorisation de pratiquer, droit à l'image et photo.</p>
      </div>
      <button type="button" class="bouton-principal" (click)="ouvrirCreation()">Nouvel élève</button>
    </div>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <!-- Champs du dossier, communs à la création (préfixe vide) et à la modification. -->
    <ng-template #champsDossier let-f let-p="prefixe">
      <label [for]="p + 'prenom'">Prénom</label>
      <input [id]="p + 'prenom'" type="text" name="prenom" [(ngModel)]="f.prenom">
      <label [for]="p + 'nom'">Nom</label>
      <input [id]="p + 'nom'" type="text" name="nom" [(ngModel)]="f.nom">
      <label [for]="p + 'naissance'">Date de naissance</label>
      <input [id]="p + 'naissance'" type="date" name="naissance" [(ngModel)]="f.dateNaissance">
      <label [for]="p + 'licence'">N° de licence</label>
      <input [id]="p + 'licence'" type="text" name="licence" [(ngModel)]="f.numeroLicence" placeholder="Facultatif">
      <app-saisie-caci [prefixe]="p" [(dateExamen)]="f.caciDateExamen"
                       [(medecin)]="f.caciMedecin" [(activites)]="f.caciActivites" />
      <label [for]="p + 'niveau'">Dernier niveau de plongée</label>
      <input [id]="p + 'niveau'" type="text" name="niveau" [(ngModel)]="f.dernierNiveau"
             placeholder="Facultatif, ex. N2 — si obtenu avant l'outil ou dans un autre club">
      <label [for]="p + 'email'">E-mail</label>
      <input [id]="p + 'email'" type="email" name="email" [(ngModel)]="f.email" placeholder="Facultatif">
      <label [for]="p + 'telephone'">Téléphone</label>
      <input [id]="p + 'telephone'" type="tel" name="telephone" [(ngModel)]="f.telephone" placeholder="Facultatif">
      <label [for]="p + 'contactUrgenceNom'">Contact d'urgence — nom</label>
      <input [id]="p + 'contactUrgenceNom'" type="text" name="contactUrgenceNom" [(ngModel)]="f.contactUrgenceNom"
             placeholder="Facultatif">
      <label [for]="p + 'contactUrgenceTelephone'">Contact d'urgence — téléphone</label>
      <input [id]="p + 'contactUrgenceTelephone'" type="tel" name="contactUrgenceTelephone"
             [(ngModel)]="f.contactUrgenceTelephone" placeholder="Facultatif">
      <div class="tailles">
        <div>
          <label [for]="p + 'tailleGilet'">Taille de gilet stabilisateur</label>
          <input [id]="p + 'tailleGilet'" type="text" name="tailleGilet" [(ngModel)]="f.tailleGilet" maxlength="20"
                 list="tailles-gilet" placeholder="Ex. M">
        </div>
        <div>
          <label [for]="p + 'tailleCombinaison'">Taille de combinaison</label>
          <input [id]="p + 'tailleCombinaison'" type="text" name="tailleCombinaison" [(ngModel)]="f.tailleCombinaison"
                 maxlength="20" placeholder="Facultatif">
        </div>
      </div>
      <label class="case">
        <input type="checkbox" name="autorisationLegale" [(ngModel)]="f.autorisationLegale">
        Autorisation du responsable légal recueillie
      </label>
    </ng-template>

    <app-dialogue [ouvert]="creationOuverte()" titre="Nouvel élève" [erreur]="message()"
                  (fermer)="creationOuverte.set(false)">
      @if (formulaireCreation(); as f) {
        <ng-container *ngTemplateOutlet="champsDossier; context: { $implicit: f, prefixe: '' }" />

        <label for="saisonCreation">Saison</label>
        <select id="saisonCreation" name="saisonCreation" [ngModel]="saisonCreationId"
                (ngModelChange)="changerSaisonCreation($event)">
          <option [ngValue]="null">Aucune pour l'instant</option>
          @for (s of saisons(); track s.id) {
            <option [ngValue]="s.id">{{ s.libelle }}{{ s.ouverte ? ' (ouverte)' : '' }}</option>
          }
        </select>
        @if (saisonCreationId !== null) {
          <label for="formationCreation">Pour cette saison</label>
          <select id="formationCreation" name="formationCreation" [ngModel]="formationCreation"
                  (ngModelChange)="formationCreation = $event; suggererGroupe()">
            <option value="N1">Formation N1</option>
            <option value="N2">Formation N2</option>
            <option value="N3">Formation N3</option>
            <option value="MAINTIEN">Aucune formation — maintien</option>
          </select>

          <label for="groupeCreation">Groupe d'entraînement</label>
          @if (groupesCreation().length === 0) {
            <p class="secondaire">
              Aucun groupe pour cette saison : créez-les dans « Groupes d'entraînement », puis rangez l'élève.
            </p>
          } @else {
            <select id="groupeCreation" name="groupeCreation" [ngModel]="groupeCreationId"
                    (ngModelChange)="groupeCreationId = $event; groupeCreationTouche = true">
              <option [ngValue]="null">Aucun pour l'instant</option>
              @for (g of groupesCreation(); track g.id) {
                <option [ngValue]="g.id">{{ g.nom }}{{ g.id === groupeSuggere()?.id ? ' (suggéré)' : '' }}</option>
              }
            </select>
          }
        }

        <label class="case">
          <input type="checkbox" name="autorisationImageCreation" [(ngModel)]="autorisationImageCreation"
                 (ngModelChange)="!$event && oublierPhotoCreation()">
          Droit à l'image recueilli
        </label>
        <div class="photo-creation">
          @if (apercuCreation(); as apercu) {
            <img [src]="apercu" alt="Photo choisie pour le nouvel élève">
          }
          <label class="bouton-discret upload" [class.inactif]="!autorisationImageCreation">
            {{ apercuCreation() ? 'Changer la photo' : 'Choisir une photo' }}
            <input type="file" accept="image/jpeg,image/png" hidden [disabled]="!autorisationImageCreation"
                   (change)="choisirPhotoCreation($event)">
          </label>
          @if (apercuCreation()) {
            <button type="button" class="bouton-discret" (click)="oublierPhotoCreation()">Retirer</button>
          }
        </div>
        @if (!autorisationImageCreation) {
          <p class="secondaire">Pas de photo sans le droit à l'image.</p>
        }

        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" (click)="creer()" [disabled]="envoi()">
            {{ envoi() ? 'Création…' : "Ajouter l'élève" }}
          </button>
          <button type="button" class="bouton-discret" (click)="creationOuverte.set(false)">Annuler</button>
        </div>
      }
      <!-- Dans le dialogue : le reste de la page est inerte tant qu'il est ouvert. -->
      @if (recadrageCreation(); as fichier) {
        <app-recadrage-photo [fichier]="fichier" [titre]="'Recadrer la photo du nouvel élève'"
                             [enCours]="false" (valide)="garderPhotoCreation($event)"
                             (annule)="recadrageCreation.set(null)" (illisible)="imageIllisibleCreation()" />
      }
    </app-dialogue>

    <app-dialogue [ouvert]="formulaireEdition() !== null"
                  [titre]="'Modifier ' + (eleveEnEdition()?.prenom ?? '') + ' ' + (eleveEnEdition()?.nom ?? '')"
                  [erreur]="message()" (fermer)="annulerEdition()">
      @if (formulaireEdition(); as f) {
        <ng-container *ngTemplateOutlet="champsDossier; context: { $implicit: f, prefixe: 'edition-' }" />
        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" (click)="enregistrer()" [disabled]="envoi()">
            {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
          <button type="button" class="bouton-discret" (click)="annulerEdition()">Annuler</button>
        </div>
      }
    </app-dialogue>

    <section class="filtres">
      <div>
        <label for="filtre-nom">Rechercher un élève</label>
        <input id="filtre-nom" type="search" name="filtreNom" placeholder="Nom ou prénom"
               [ngModel]="filtreNom()" (ngModelChange)="filtreNom.set($event)">
      </div>
      <div>
        <label for="filtre-saison">Saison</label>
        <select id="filtre-saison" name="filtreSaison" [ngModel]="filtreSaisonId()"
                (ngModelChange)="changerSaison($event)">
          @for (s of saisons(); track s.id) {
            <option [ngValue]="s.id">{{ s.libelle }}{{ s.ouverte ? ' (en cours)' : '' }}</option>
          }
        </select>
      </div>
      <div>
        <label for="filtre-statut">Statut de l'inscription</label>
        <select id="filtre-statut" name="filtreStatut" [ngModel]="filtreStatut()"
                (ngModelChange)="filtreStatut.set($event)">
          <option value="TOUS">Tous</option>
          <option value="NON_INSCRIT">Sans rattachement à la saison</option>
          @for (s of statuts; track s) { <option [value]="s">{{ s }}</option> }
        </select>
      </div>
      <div>
        <label for="filtre-caci">CACI</label>
        <select id="filtre-caci" name="filtreCaci" [ngModel]="filtreCaci()" (ngModelChange)="filtreCaci.set($event)">
          <option value="TOUS">Tous</option>
          <option value="A_VERIFIER">À vérifier (expiré, bientôt échu ou non renseigné)</option>
        </select>
      </div>
    </section>

    @if (aVerifier() > 0) {
      <p class="alerte" role="status">
        {{ aVerifier() }} élève(s) de la saison {{ saisonLibelle(filtreSaisonId()!) }} avec un CACI expiré,
        bientôt échu ou non renseigné.
      </p>
    }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (liste().length === 0) {
      <div class="carte vide"><p>Aucun élève enregistré.</p></div>
    } @else if (listeFiltree().length === 0) {
      <div class="carte vide"><p>Aucun élève ne correspond aux filtres.</p></div>
    } @else {
      <ul>
        @for (e of listeFiltree(); track e.id) {
          <li class="carte">
              <div class="ligne">
                @if (urlPhoto(e.id); as url) {
                  <img class="avatar" [src]="url" [alt]="e.prenom + ' ' + e.nom" width="56" height="56">
                } @else {
                  <div class="avatar silhouette" aria-hidden="true">{{ initiales(e) }}</div>
                }
                <div class="identite">
                  <span class="nom">{{ e.prenom }} {{ e.nom }}</span>
                  <span class="secondaire">
                    {{ e.numeroLicence ? 'Licence ' + e.numeroLicence : 'Sans licence' }}
                  </span>
                  <span [class]="'caci caci-' + etatCaci(e.certificatValideJusquAu)">
                    {{ libelleCaci(e.certificatValideJusquAu) }}
                  </span>
                  <span class="secondaire">
                    Autorisation légale {{ e.autorisationLegale ? 'recueillie' : 'manquante' }}
                    · Droit à l'image {{ e.autorisationImage ? 'recueilli' : 'non recueilli' }}
                  </span>
                  @if (e.tailleGilet || e.tailleCombinaison) {
                    <span class="secondaire">
                      Gilet {{ e.tailleGilet || '?' }} · Combinaison {{ e.tailleCombinaison || '?' }}
                    </span>
                  }
                  @if (filtreSaisonId(); as saisonId) {
                    <span class="secondaire">
                      @if (adhesionDe(e); as a) {
                        Adhésion sans formation pour {{ saisonLibelle(saisonId) }}
                      } @else if (!aCursus(e)) {
                        Pas de rattachement à {{ saisonLibelle(saisonId) }}
                      }
                    </span>
                  }
                </div>
              </div>

              <div class="actions">
                <button type="button" class="bouton-discret" (click)="commencerEdition(e)">Modifier</button>
                <div class="menu-actions">
                  <button type="button" class="bouton-discret" (click)="basculerMenu(e.id)"
                          aria-haspopup="menu" [attr.aria-expanded]="menuOuvert() === e.id">
                    Actions ▾
                  </button>
                  @if (menuOuvert() === e.id) {
                    <div class="menu-actions-liste" role="menu" (click)="menuOuvert.set(null)">
                      <button type="button" role="menuitem" (click)="changerAutorisationImage(e)">
                        {{ e.autorisationImage ? "Retirer le droit à l'image" : "Recueillir le droit à l'image" }}
                      </button>
                      @if (e.autorisationImage) {
                        <button type="button" role="menuitem" (click)="fichierPhoto.click()">
                          {{ e.aPhoto ? 'Remplacer la photo' : 'Déposer une photo' }}
                        </button>
                      }
                      @if (filtreSaisonId() && !aCursus(e)) {
                        @if (adhesionDe(e); as a) {
                          <button type="button" role="menuitem" (click)="retirerDeLaSaison(a)">
                            Retirer de la saison
                          </button>
                        } @else {
                          <button type="button" role="menuitem" (click)="ajouterALaSaison(e)"
                                  [disabled]="envoiAdhesion() === e.id">
                            {{ envoiAdhesion() === e.id ? 'Ajout…' : 'Ajouter à la saison (sans formation)' }}
                          </button>
                        }
                      }
                      <button type="button" role="menuitem" (click)="basculerHistorique(e)">
                        {{ historiqueOuvert() === e.id ? 'Masquer l’historique' : 'Historique des saisons' }}
                      </button>
                      <button type="button" role="menuitem" class="danger" (click)="archiver(e)">Archiver</button>
                    </div>
                  }
                </div>
                <!-- Hors du menu : le menu se ferme avant que la photo soit choisie. -->
                <input #fichierPhoto type="file" accept="image/jpeg,image/png" hidden
                       (change)="choisirPhoto(e, $event)">
              </div>

              @if (historiqueOuvert() === e.id) {
                <div class="historique">
                  @if (chargementHistorique()) {
                    <p class="secondaire">Chargement…</p>
                  } @else if ((historique() ?? []).length === 0) {
                    <p class="secondaire">
                      Aucune adhésion sans formation enregistrée pour cet élève (une formation en cours
                      figure dans l'écran Inscriptions).
                    </p>
                  } @else {
                    <ul class="saisons">
                      @for (a of historique(); track a.id) {
                        <li>{{ a.saison }} <span class="secondaire">— depuis le {{ a.adhereLe | dateFr }}</span></li>
                      }
                    </ul>
                  }
                </div>
              }
          </li>
        }
      </ul>
    }

    <section class="archives">
      <button type="button" class="bouton-discret" (click)="basculerArchives()">
        {{ archivesOuvertes() ? 'Masquer les élèves archivés' : 'Afficher les élèves archivés' }}
      </button>

      @if (archivesOuvertes()) {
        @if (archives() === null) {
          <p class="secondaire">Chargement…</p>
        } @else if (archives()!.length === 0) {
          <div class="carte vide"><p>Aucun élève archivé.</p></div>
        } @else {
          <p class="secondaire">
            La suppression est définitive : elle efface aussi les formations, évaluations,
            compétences validées et brevets délivrés de l'élève. Les fiches de sécurité
            gardent son nom.
          </p>
          <ul>
            @for (e of archives(); track e.id) {
              <li class="carte">
                <span class="nom">{{ e.prenom }} {{ e.nom }}</span>
                <span class="secondaire">
                  {{ e.numeroLicence ? 'Licence ' + e.numeroLicence : '' }}
                </span>
                <div class="actions">
                  <button type="button" class="bouton-discret" (click)="desarchiver(e)">Désarchiver</button>
                  <button type="button" class="bouton-discret danger" (click)="supprimer(e)"
                          [disabled]="suppressionEnCours() === e.id">
                    {{ suppressionEnCours() === e.id ? 'Suppression…' : 'Supprimer définitivement' }}
                  </button>
                </div>
              </li>
            }
          </ul>
        }
      }
    </section>

    @if (recadrage(); as r) {
      <app-recadrage-photo [fichier]="r.fichier" [titre]="'Recadrer la photo de ' + r.eleve.prenom + ' ' + r.eleve.nom"
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
    .case { display: flex; align-items: center; gap: var(--pas); font-weight: 400; }
    .case input { width: auto; }
    .bouton-principal { width: 100%; margin-top: var(--pas-3); }

    .filtres {
      display: flex; flex-wrap: wrap; gap: var(--pas-2) var(--pas-3); align-items: flex-end;
      margin-bottom: var(--pas-2);
    }
    .filtres > div { min-width: 220px; flex: 1 1 220px; }
    .filtres label { margin: 0 0 4px; }
    .filtres input, .filtres select { margin: 0; }

    .caci { font-size: .875rem; font-weight: 700; }
    .caci-valide { color: var(--acquis); }
    .caci-bientot { color: var(--en-cours); }
    .caci-expire, .caci-absent { color: #B3261E; }

    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2); }
    li { padding: var(--pas-2); }
    .ligne { display: flex; align-items: flex-start; gap: var(--pas-2); }
    .identite { display: flex; flex-direction: column; gap: 2px; flex: 1; }
    .avatar {
      flex: none; width: 56px; height: 56px; border-radius: 50%; object-fit: cover; background: var(--fond);
    }
    .silhouette {
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-titres), sans-serif; font-size: .9375rem; font-weight: 700; color: var(--craie);
    }
    .nom { font-weight: 700; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }
    .actions .bouton-principal { width: auto; margin-top: 0; }
    .upload { cursor: pointer; }
    .upload.inactif { opacity: .5; cursor: not-allowed; }
    /* Aligne les champs même quand un intitulé passe sur deux lignes (téléphone). */
    .tailles { display: grid; grid-template-columns: 1fr 1fr; gap: 0 var(--pas-2); align-items: end; }
    .photo-creation { display: flex; align-items: center; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas); }
    .photo-creation img { width: 72px; height: 72px; object-fit: cover; border-radius: 50%; }
    /* Un <label> n'hérite pas de la bordure des <button> (styles.css) : on la redonne. */
    .photo-creation .upload { display: inline-flex; align-items: center; margin: 0; font-weight: 400;
                              border: 1px solid var(--trait); border-radius: var(--r-s); }
    .danger { color: #B3261E; border-color: #B3261E; }
    .historique {
      margin-top: var(--pas); padding: var(--pas-2); border-radius: var(--r-s); background: var(--fond);
    }
    .archives { margin-top: var(--pas-4); display: grid; gap: var(--pas-2); }
    .archives > .bouton-discret { justify-self: start; }
    .saisons { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }

  `]
})
export class ElevesComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  /**
   * Page d'où l'on vient (ex. /trombinoscope, « Modifier l'élève ») : on y
   * revient après l'enregistrement ou l'annulation. Chemin interne seulement.
   */
  private retour: string | null = null;

  readonly statuts = STATUTS;
  readonly taillesGilet = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  recadrage = signal<{ eleve: EleveVue; fichier: File } | null>(null);
  recadrageEnCours = signal(false);

  liste = signal<EleveVue[]>([]);
  saisons = signal<SaisonVue[]>([]);
  cursusDeLaSaison = signal<CursusVue[]>([]);
  adhesionsDeLaSaison = signal<AdhesionVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  envoi = signal(false);
  envoiAdhesion = signal<number | null>(null);

  archivesOuvertes = signal(false);
  archives = signal<EleveVue[] | null>(null);
  suppressionEnCours = signal<number | null>(null);

  historiqueOuvert = signal<number | null>(null);
  chargementHistorique = signal(false);
  historique = signal<AdhesionVue[] | null>(null);

  filtreNom = signal('');
  filtreSaisonId = signal<number | null>(null);
  filtreStatut = signal('TOUS');
  filtreCaci = signal<'TOUS' | 'A_VERIFIER'>('TOUS');

  readonly etatCaci = etatCaci;
  readonly libelleCaci = libelleCaci;

  /**
   * Seuls les élèves rattachés à la saison choisie (formation ou adhésion)
   * comptent : un ancien élève qui ne plonge plus n'a pas à renouveler son CACI.
   */
  aVerifier = computed(() => {
    if (!this.filtreSaisonId()) return 0;
    const rattaches = new Set([...this.cursusDeLaSaison().map(c => c.eleveId),
                               ...this.adhesionsDeLaSaison().map(a => a.eleveId)]);
    return this.liste().filter(e => rattaches.has(e.id)
      && etatCaci(e.certificatValideJusquAu) !== 'valide').length;
  });

  /**
   * Un élève ne porte pas de saison ni de statut en propre : on croise avec ses
   * cursus (inscriptions) dans la saison choisie pour filtrer par statut.
   */
  listeFiltree = computed(() => {
    const recherche = this.filtreNom().trim().toLocaleLowerCase();
    const statut = this.filtreStatut();
    const cursusParEleve = new Map<number, CursusVue[]>();
    for (const c of this.cursusDeLaSaison()) {
      const liste = cursusParEleve.get(c.eleveId) ?? [];
      liste.push(c);
      cursusParEleve.set(c.eleveId, liste);
    }
    const adhesionsParEleve = new Map(this.adhesionsDeLaSaison().map(a => [a.eleveId, a]));
    return this.liste().filter(e => {
      if (recherche && !`${e.prenom} ${e.nom}`.toLocaleLowerCase().includes(recherche)) return false;
      if (this.filtreCaci() === 'A_VERIFIER' && etatCaci(e.certificatValideJusquAu) === 'valide') return false;
      if (statut === 'TOUS') return true;
      const cursus = cursusParEleve.get(e.id) ?? [];
      // Sans formation cette saison : compte comme rattaché s'il a une adhésion.
      if (statut === 'NON_INSCRIT') return cursus.length === 0 && !adhesionsParEleve.has(e.id);
      return cursus.some(c => c.statut === statut);
    });
  });

  aCursus(e: EleveVue): boolean {
    return this.cursusDeLaSaison().some(c => c.eleveId === e.id);
  }

  adhesionDe(e: EleveVue): AdhesionVue | null {
    return this.adhesionsDeLaSaison().find(a => a.eleveId === e.id) ?? null;
  }

  saisonLibelle(saisonId: number): string {
    return this.saisons().find(s => s.id === saisonId)?.libelle ?? '';
  }

  /** Panneau de création caché par défaut ; ce qui est saisi reste si on le referme. */
  creationOuverte = signal(false);
  formulaireCreation = signal<FormulaireEleve>(formulaireVide());
  saisonCreationId: number | null = null;
  formationCreation: FormationCreation = 'N1';
  /** Groupes d'entraînement de la saison choisie à la création. */
  groupesCreation = signal<GroupeEntrainementVue[]>([]);
  groupeCreationId: number | null = null;
  /** Choisi à la main : on ne le remplace plus par la suggestion. */
  groupeCreationTouche = false;
  autorisationImageCreation = false;
  /** Photo déjà recadrée, envoyée une fois l'élève créé. */
  photoCreation = signal<File | null>(null);
  apercuCreation = signal<string | null>(null);
  recadrageCreation = signal<File | null>(null);
  edition = signal<number | null>(null);
  eleveEnEdition = computed(() => this.liste().find(e => e.id === this.edition()) ?? null);
  formulaireEdition = signal<FormulaireEleve | null>(null);

  constructor() {
    void this.charger();
    inject(DestroyRef).onDestroy(() => {
      this.oublierPhotoCreation();
      for (const url of this.urlsPhotos().values()) URL.revokeObjectURL(url);
    });
  }

  /** Photos affichées sur les lignes, par élève (adresses locales des images). */
  private urlsPhotos = signal<Map<number, string>>(new Map());

  private chargerPhoto(eleveId: number): void {
    this.api.photoEleve(eleveId).then(
      blob => this.poserPhoto(eleveId, URL.createObjectURL(blob)),
      () => { /* pas de photo consultable : les initiales restent affichées */ }
    );
  }

  /** Remplace (ou retire, avec null) la photo affichée d'un élève. */
  private poserPhoto(eleveId: number, url: string | null): void {
    const copie = new Map(this.urlsPhotos());
    const ancienne = copie.get(eleveId);
    if (ancienne) URL.revokeObjectURL(ancienne);
    if (url) copie.set(eleveId, url);
    else copie.delete(eleveId);
    this.urlsPhotos.set(copie);
  }

  urlPhoto(eleveId: number): string | null {
    return this.urlsPhotos().get(eleveId) ?? null;
  }

  initiales(e: EleveVue): string {
    return ((e.prenom[0] ?? '') + (e.nom[0] ?? '')).toUpperCase();
  }

  private async charger(): Promise<void> {
    this.chargement.set(true);
    try {
      const [liste, saisons] = await Promise.all([
        firstValueFrom(this.api.eleves()),
        firstValueFrom(this.api.saisons())
      ]);
      this.liste.set(liste);
      for (const e of liste) {
        if (e.aPhoto) this.chargerPhoto(e.id);
      }
      this.saisons.set(saisons);
      const saisonCourante = saisons.find(s => s.ouverte) ?? saisons[0] ?? null;
      void this.changerSaisonCreation(saisons.find(s => s.ouverte)?.id ?? null);
      if (saisonCourante) await this.changerSaison(saisonCourante.id);
      this.ouvrirDepuisLien(liste);
    } catch {
      this.message.set('Impossible de charger la liste des élèves.');
    } finally {
      this.chargement.set(false);
    }
  }

  async changerSaison(saisonId: number): Promise<void> {
    this.filtreSaisonId.set(saisonId);
    try {
      const [cursus, adhesions] = await Promise.all([
        firstValueFrom(this.api.cursusDeLaSaison(saisonId)),
        firstValueFrom(this.api.adhesionsDeLaSaison(saisonId))
      ]);
      this.cursusDeLaSaison.set(cursus);
      this.adhesionsDeLaSaison.set(adhesions);
    } catch {
      this.message.set("Impossible de charger les inscriptions de cette saison.");
    }
  }

  /** Élève déjà breveté qui continue de plonger sans ouvrir de nouvelle formation. */
  ajouterALaSaison(e: EleveVue): void {
    const saisonId = this.filtreSaisonId();
    if (!saisonId) return;
    this.envoiAdhesion.set(e.id);
    this.message.set(null);
    this.api.adherer({ eleveId: e.id, saisonId }).subscribe({
      next: a => {
        this.envoiAdhesion.set(null);
        this.adhesionsDeLaSaison.set([...this.adhesionsDeLaSaison(), a]);
      },
      error: (err: HttpErrorResponse) => {
        this.envoiAdhesion.set(null);
        this.message.set(err.error?.detail ?? "L'ajout à la saison n'a pas pu être enregistré.");
      }
    });
  }

  retirerDeLaSaison(a: AdhesionVue): void {
    this.message.set(null);
    this.api.retirerAdhesion(a.id).subscribe({
      next: () => this.adhesionsDeLaSaison.set(this.adhesionsDeLaSaison().filter(x => x.id !== a.id)),
      error: (err: HttpErrorResponse) =>
        this.message.set(err.error?.detail ?? "Le retrait n'a pas pu être enregistré.")
    });
  }

  basculerHistorique(e: EleveVue): void {
    if (this.historiqueOuvert() === e.id) {
      this.historiqueOuvert.set(null);
      return;
    }
    this.historiqueOuvert.set(e.id);
    this.chargementHistorique.set(true);
    this.historique.set(null);
    this.api.historiqueAdhesions(e.id).subscribe({
      next: h => {
        this.chargementHistorique.set(false);
        this.historique.set(h);
      },
      error: () => {
        this.chargementHistorique.set(false);
        this.historique.set([]);
      }
    });
  }

  /**
   * Création en plusieurs appels, dans cet ordre : le dossier, puis le
   * rattachement à la saison (inscription ou maintien), puis le droit à
   * l'image et la photo. Si une étape après la première échoue, l'élève
   * existe déjà : on le dit, et la suite se fait depuis sa ligne.
   */
  async creer(): Promise<void> {
    const f = this.formulaireCreation();
    if (!f.nom || !f.prenom) {
      this.message.set('Nom et prénom sont obligatoires.');
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    let e: EleveVue;
    try {
      e = await firstValueFrom(this.api.creerEleve({
        nom: f.nom, prenom: f.prenom, dateNaissance: f.dateNaissance || null,
        numeroLicence: f.numeroLicence || null,
        caciDateExamen: f.caciDateExamen || null, caciMedecin: f.caciMedecin || null, caciActivites: f.caciActivites,
        dernierNiveau: f.dernierNiveau || null, email: f.email || null, telephone: f.telephone || null,
        contactUrgenceNom: f.contactUrgenceNom || null, contactUrgenceTelephone: f.contactUrgenceTelephone || null,
        tailleGilet: f.tailleGilet || null, tailleCombinaison: f.tailleCombinaison || null,
        autorisationLegale: f.autorisationLegale
      }));
    } catch (err) {
      this.envoi.set(false);
      this.message.set((err as HttpErrorResponse).error?.detail ?? "L'ajout n'a pas pu être enregistré.");
      return;
    }
    this.liste.set([...this.liste(), e].sort((a, b) => a.nom.localeCompare(b.nom)));

    const echecs: string[] = [];
    const saisonId = this.saisonCreationId;
    if (saisonId !== null) {
      try {
        if (this.formationCreation === 'MAINTIEN') {
          const a = await firstValueFrom(this.api.adherer({ eleveId: e.id, saisonId, groupeId: this.groupeCreationId }));
          if (this.filtreSaisonId() === saisonId) this.adhesionsDeLaSaison.set([...this.adhesionsDeLaSaison(), a]);
        } else {
          const c = await firstValueFrom(this.api.inscrireCursus({
            eleveId: e.id, saisonId, niveau: this.formationCreation, groupeId: this.groupeCreationId
          }));
          if (this.filtreSaisonId() === saisonId) this.cursusDeLaSaison.set([...this.cursusDeLaSaison(), c]);
        }
      } catch (err) {
        echecs.push(`rattachement à la saison (${(err as HttpErrorResponse).error?.detail ?? 'erreur'})`);
      }
    }
    if (this.autorisationImageCreation) {
      try {
        await firstValueFrom(this.api.changerAutorisationImage(e.id, true));
        e = { ...e, autorisationImage: true };
        this.remplacer(e);
        const photo = this.photoCreation();
        if (photo) {
          try {
            await firstValueFrom(this.api.deposerPhotoEleve(e.id, photo));
            e = { ...e, aPhoto: true };
            this.remplacer(e);
            this.poserPhoto(e.id, URL.createObjectURL(photo));
          } catch (err) {
            echecs.push(`photo (${(err as HttpErrorResponse).error?.detail ?? 'erreur'})`);
          }
        }
      } catch (err) {
        echecs.push(`droit à l'image (${(err as HttpErrorResponse).error?.detail ?? 'erreur'})`);
      }
    }

    this.envoi.set(false);
    this.creationOuverte.set(false);
    this.formulaireCreation.set(formulaireVide());
    this.formationCreation = 'N1';
    this.groupeCreationTouche = false;
    this.suggererGroupe();
    this.autorisationImageCreation = false;
    this.oublierPhotoCreation();
    this.message.set(echecs.length
      ? `${e.prenom} ${e.nom} a été créé·e, mais pas : ${echecs.join(' ; ')}. À reprendre depuis sa ligne ou l'écran Inscriptions.`
      : `${e.prenom} ${e.nom} a été ajouté·e.`);
  }

  ouvrirCreation(): void {
    this.message.set(null);
    this.creationOuverte.set(true);
    setTimeout(() => document.getElementById('prenom')?.focus());
  }

  async changerSaisonCreation(saisonId: number | null): Promise<void> {
    this.saisonCreationId = saisonId;
    this.groupesCreation.set([]);
    this.groupeCreationId = null;
    this.groupeCreationTouche = false;
    if (saisonId === null) return;
    try {
      const groupes = await firstValueFrom(this.api.groupesEntrainement(saisonId));
      if (this.saisonCreationId !== saisonId) return;
      this.groupesCreation.set([...groupes].sort((a, b) => a.ordre - b.ordre));
      this.suggererGroupe();
    } catch {
      this.message.set("Les groupes d'entraînement de cette saison n'ont pas pu être chargés.");
    }
  }

  /** Premier groupe (dans l'ordre d'affichage) qui prépare le niveau choisi, comme l'écran Inscriptions. */
  groupeSuggere(): GroupeEntrainementVue | null {
    const niveau = this.formationCreation === 'MAINTIEN' ? null : this.formationCreation;
    return niveau ? this.groupesCreation().find(g => g.niveauPrepare === niveau) ?? null : null;
  }

  /** Préselectionne la suggestion, sauf si un groupe a été choisi à la main. */
  suggererGroupe(): void {
    if (!this.groupeCreationTouche) this.groupeCreationId = this.groupeSuggere()?.id ?? null;
  }

  choisirPhotoCreation(evenement: Event): void {
    const entree = evenement.target as HTMLInputElement;
    const fichier = entree.files?.[0];
    entree.value = '';
    if (!fichier) return;
    this.message.set(null);
    this.recadrageCreation.set(fichier);
  }

  garderPhotoCreation(fichier: File): void {
    this.oublierPhotoCreation();
    this.photoCreation.set(fichier);
    this.apercuCreation.set(URL.createObjectURL(fichier));
  }

  imageIllisibleCreation(): void {
    this.recadrageCreation.set(null);
    this.message.set("Cette image n'a pas pu être lue.");
  }

  oublierPhotoCreation(): void {
    this.recadrageCreation.set(null);
    const apercu = this.apercuCreation();
    if (apercu) URL.revokeObjectURL(apercu);
    this.apercuCreation.set(null);
    this.photoCreation.set(null);
  }

  commencerEdition(e: EleveVue): void {
    this.message.set(null);
    this.edition.set(e.id);
    this.formulaireEdition.set(depuis(e));
  }

  annulerEdition(): void {
    // Appelé aussi par la fermeture du dialogue qui suit un enregistrement : une seule fois.
    if (this.edition() === null) return;
    this.edition.set(null);
    this.formulaireEdition.set(null);
    if (this.retour) void this.router.navigateByUrl(this.retour);
  }

  /** {@code ?modifier=ID} : ouvre directement la modification de cet élève (depuis le trombinoscope). */
  private ouvrirDepuisLien(liste: EleveVue[]): void {
    const params = this.route.snapshot.queryParamMap;
    const id = Number(params.get('modifier'));
    if (!id) return;
    const retour = params.get('retour');
    // Seulement un chemin de l'application : jamais « //site » ni une adresse externe.
    this.retour = retour && retour.startsWith('/') && !retour.startsWith('//') ? retour : null;
    const e = liste.find(x => x.id === id);
    if (!e) {
      this.message.set("Cet élève n'est pas dans la liste des élèves actifs (archivé ?).");
      return;
    }
    // L'élève doit rester visible quels que soient les filtres.
    this.filtreNom.set(`${e.prenom} ${e.nom}`);
    this.filtreStatut.set('TOUS');
    this.filtreCaci.set('TOUS');
    this.commencerEdition(e);
  }

  enregistrer(): void {
    const e = this.eleveEnEdition();
    const f = this.formulaireEdition();
    if (!e || !f) return;
    this.envoi.set(true);
    this.api.modifierEleve(e.id, {
      nom: f.nom, prenom: f.prenom, dateNaissance: f.dateNaissance || null,
      numeroLicence: f.numeroLicence || null,
      caciDateExamen: f.caciDateExamen || null, caciMedecin: f.caciMedecin || null, caciActivites: f.caciActivites,
      dernierNiveau: f.dernierNiveau || null, email: f.email || null, telephone: f.telephone || null,
      contactUrgenceNom: f.contactUrgenceNom || null, contactUrgenceTelephone: f.contactUrgenceTelephone || null,
      tailleGilet: f.tailleGilet || null, tailleCombinaison: f.tailleCombinaison || null,
      autorisationLegale: f.autorisationLegale
    }).subscribe({
      next: maj => {
        this.envoi.set(false);
        this.remplacer(maj);
        this.annulerEdition();
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(err.error?.detail ?? "La modification n'a pas pu être enregistrée.");
      }
    });
  }

  changerAutorisationImage(e: EleveVue): void {
    this.message.set(null);
    this.api.changerAutorisationImage(e.id, !e.autorisationImage).subscribe({
      next: () => {
        // Retirer le consentement supprime aussi la photo côté serveur.
        if (e.autorisationImage) this.poserPhoto(e.id, null);
        this.remplacer({ ...e, autorisationImage: !e.autorisationImage, aPhoto: false });
      },
      error: (err: HttpErrorResponse) =>
        this.message.set(err.error?.detail ?? "L'action n'a pas pu être enregistrée.")
    });
  }

  /** Ouvre le recadrage : la photo n'est envoyée qu'une fois validée (voir {@link deposerPhoto}). */
  choisirPhoto(e: EleveVue, evenement: Event): void {
    const entree = evenement.target as HTMLInputElement;
    const fichier = entree.files?.[0];
    entree.value = ''; // permet de rechoisir le même fichier plus tard
    if (!fichier) return;
    this.message.set(null);
    this.recadrage.set({ eleve: e, fichier });
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
      await firstValueFrom(this.api.deposerPhotoEleve(r.eleve.id, fichier));
      const actuel = this.liste().find(x => x.id === r.eleve.id);
      if (actuel) this.remplacer({ ...actuel, aPhoto: true });
      this.poserPhoto(r.eleve.id, URL.createObjectURL(fichier));
      this.message.set(`Photo enregistrée pour ${r.eleve.prenom} ${r.eleve.nom}.`);
      this.recadrage.set(null);
    } catch (err) {
      this.message.set((err as HttpErrorResponse).error?.detail ?? "La photo n'a pas pu être déposée.");
    } finally {
      this.recadrageEnCours.set(false);
    }
  }

  archiver(e: EleveVue): void {
    if (!confirm(`Archiver ${e.prenom} ${e.nom} ? Il·elle disparaîtra des listes actives.`)) return;
    this.api.archiverEleve(e.id).subscribe({
      next: maj => {
        this.liste.set(this.liste().filter(x => x.id !== e.id));
        const archives = this.archives();
        if (archives) this.archives.set(trier([...archives, maj]));
      },
      error: (err: HttpErrorResponse) =>
        this.message.set(err.error?.detail ?? "L'archivage n'a pas pu être enregistré.")
    });
  }

  basculerArchives(): void {
    const ouvrir = !this.archivesOuvertes();
    this.archivesOuvertes.set(ouvrir);
    if (!ouvrir || this.archives() !== null) return;
    this.api.elevesArchives().subscribe({
      next: a => this.archives.set(a),
      error: () => {
        this.archives.set([]);
        this.message.set('Impossible de charger les élèves archivés.');
      }
    });
  }

  desarchiver(e: EleveVue): void {
    this.message.set(null);
    this.api.desarchiverEleve(e.id).subscribe({
      next: maj => {
        this.archives.set((this.archives() ?? []).filter(x => x.id !== e.id));
        this.liste.set(trier([...this.liste(), maj]));
        if (maj.aPhoto) this.chargerPhoto(maj.id);
      },
      error: (err: HttpErrorResponse) =>
        this.message.set(err.error?.detail ?? "Le désarchivage n'a pas pu être enregistré.")
    });
  }

  supprimer(e: EleveVue): void {
    if (!confirm(
      `Supprimer définitivement ${e.prenom} ${e.nom} ?\n\n` +
      `Ses formations, évaluations, compétences validées, brevets délivrés, présences et photo ` +
      `seront effacés. Cette action est irréversible.`)) return;
    this.suppressionEnCours.set(e.id);
    this.message.set(null);
    this.api.supprimerEleve(e.id).subscribe({
      next: () => {
        this.suppressionEnCours.set(null);
        this.archives.set((this.archives() ?? []).filter(x => x.id !== e.id));
        this.message.set(`${e.prenom} ${e.nom} a été supprimé·e définitivement.`);
      },
      error: (err: HttpErrorResponse) => {
        this.suppressionEnCours.set(null);
        this.message.set(err.error?.detail ?? "La suppression n'a pas pu être effectuée.");
      }
    });
  }

  /** Élève dont le menu « Actions » est déroulé (un seul à la fois). */
  menuOuvert = signal<number | null>(null);

  basculerMenu(id: number): void {
    this.menuOuvert.set(this.menuOuvert() === id ? null : id);
  }

  /** Un clic hors du menu le referme. */
  fermerMenuSiAilleurs(evenement: Event): void {
    if (!(evenement.target as Element | null)?.closest?.('.menu-actions')) this.menuOuvert.set(null);
  }

  private remplacer(maj: EleveVue): void {
    this.liste.set(this.liste().map(e => e.id === maj.id ? maj : e));
  }
}
