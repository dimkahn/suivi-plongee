import { Component, HostListener, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FileEcrituresService } from '../../core/file-ecritures.service';
import { DateFrPipe, dateDuJour, dateFr } from '../../core/date-fr';
import { PlurielPipe } from '../../core/pluriel';
import { DialogueComponent } from '../../core/dialogue.component';
import { NavigationService } from '../../core/navigation';
import { lieuEtSite } from '../../core/seance-lieu';
import { ComboboxComponent, OptionCombobox } from '../../core/combobox.component';
import {
  aDesDetails, alerteMod, libelleGaz, PPO2_PAR_DEFAUT, PPO2_POSSIBLES, profondeurMaximaleUtilisation, deplacerPlongeur, empreinteFiche, erreurProfilPrevu, estEncadrantPossible, libelleMembre, ligneVide, nomPalanquee,
  palanqueesAEnregistrer, profondeurPermise, questionsAjout, refusAjout, reprendrePalanquees,
  resumePalanquee as resumeComposition
} from '../../core/fiche-securite';
import { aptitudeSurFiche, separerAptitude } from '../../core/niveaux-plongeur';
import { detailErreurFichier, telechargerFichier } from '../../core/telecharger';
import { AvecModifications } from '../../core/gardes';
import {
  DemandeDuplicationSeance, DemandePropositionPalanquees, FicheSecuriteVue, GroupePlongeursVue, PropositionPalanqueesVue, MembreGroupeVue, MoniteurOptionVue, PalanqueeVue, PlongeurConnuVue,
  PlongeurVue, SeanceLieeVue, SeanceVue
} from '../../core/modeles';

function plongeurVide(): PlongeurVue {
  return {
    eleveId: null, utilisateurId: null, nom: '', prenom: '', aptitude: null, aptitudeDonneeParDp: null,
    qualificationPreparee: null, fonction: 'PLONGEUR', gaz: null, ppo2Max: null, moyenDesaturation: null, observations: null
  };
}

/** Le membre d'un groupe tel qu'il arrive sur la fiche, « Plongeur » tant qu'on ne dit pas sa fonction. */
function versPlongeur(source: MembreGroupeVue): PlongeurVue {
  return {
    eleveId: source.eleveId, utilisateurId: source.utilisateurId, nom: source.nom, prenom: source.prenom,
    aptitude: aptitudeSurFiche(source), aptitudeDonneeParDp: null, qualificationPreparee: source.qualificationPreparee,
    fonction: 'PLONGEUR', gaz: null, ppo2Max: null, moyenDesaturation: null, observations: null
  };
}

function palanqueeVide(numero: number): PalanqueeVue {
  return {
    numero, profondeurPrevue: null, dureePrevue: null,
    profondeurRealisee: null, dureeRealisee: null, paliers: null,
    heureImmersion: null, heureSortie: null, membres: []
  };
}


/** Critères de la proposition automatique, modifiés en place par le formulaire. */
interface CriteresProposition {
  profondeur: number;
  type: 'EXPLORATION' | 'ENSEIGNEMENT';
  maxPlongeurs: number;
  autonomesEnsemble: boolean;
  regrouperParNiveau: boolean;
}

type Identite ={ eleveId: number | null; utilisateurId: number | null; nom: string; prenom: string };

/** « Hélène » → « helene » : sans accents, sans majuscules, sans espaces autour. */
function normaliser(texte: string | null): string {
  return (texte ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/**
 * Même plongeur : même dossier élève, sinon même compte encadrant, sinon
 * mêmes nom et prénom sans tenir compte des accents ni des majuscules. Un
 * plongeur lié à son dossier d'un côté et tapé à la main de l'autre est donc
 * reconnu par son nom. Même règle que le serveur pour l'envoi des paramètres
 * d'un séjour (EnvoiParametresSejourService.correspond).
 */
function memePlongeur(a: Identite, b: Identite): boolean {
  if (a.eleveId !== null && b.eleveId !== null) return a.eleveId === b.eleveId;
  if (a.utilisateurId !== null && b.utilisateurId !== null) return a.utilisateurId === b.utilisateurId;
  const nomA = normaliser(a.nom), prenomA = normaliser(a.prenom);
  if (!nomA && !prenomA) return false;
  return nomA === normaliser(b.nom) && prenomA === normaliser(b.prenom);
}

interface FormulaireEntete {
  dpId: number | null;
  meteo: string | null;
  etatMer: string | null;
  visibilite: string | null;
  courant: string | null;
  maree: string | null;
  temperatureEau: string | null;
  securiteSurface: string | null;
  planSecours: string | null;
  observations: string | null;
}

/** Formulaire de « Dupliquer et lier » : le DP n'est pas encore choisi à l'ouverture. */
type FormulaireDuplication = Omit<DemandeDuplicationSeance, 'dpId'> & { dpId: number | null };

@Component({
  selector: 'app-fiche-securite',
  imports: [FormsModule, RouterLink, DragDropModule, DateFrPipe, PlurielPipe, ComboboxComponent, DialogueComponent],
  template: `
    <datalist id="plongeurs-club">
      @for (c of plongeursConnus(); track libellePlongeurConnu(c)) {
        <option [value]="libellePlongeurConnu(c)"></option>
      }
    </datalist>

    @if (seance(); as s) {
      <h1>Fiche de sécurité — {{ s.date | dateFr }}{{ lieuEtSite(s) ? ' — ' + lieuEtSite(s) : '' }}</h1>
      <p class="secondaire">
        {{ s.milieu === 'NATUREL' ? 'Milieu naturel' : 'Milieu artificiel' }}
        {{ s.profondeurMax ? ' · ' + s.profondeurMax + ' m max' : '' }}
      </p>
    }

    <!-- Une fois la fiche ouverte, les messages s'affichent dans la barre du bas, à côté des boutons. -->
    @if (!entete() && message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (entete(); as f) {
      @if (!auth.etablitFichesSecurite()) {
        <div class="alerte" role="status">
          Lecture seule : établir ou modifier la fiche revient aux moniteurs E3 ou E4, ou à ceux
          qui en ont reçu le droit. Vous pouvez la compléter au retour de plongée.
        </div>
      }
      <!-- Sans le droit d'établir, tout le formulaire est désactivé d'un coup (le serveur refuse de toute façon). -->
      <fieldset class="lecture-seule" [disabled]="!auth.etablitFichesSecurite()">
      <h2 class="titre-etape">1. Établir la fiche, avant la mise à l'eau</h2>
      <p class="secondaire">
        Directeur de plongée, conditions, composition des palanquées et profil prévu
        (profondeur, durée). Le profil réellement plongé se saisit à part, au retour.
      </p>

      <section class="carte panneau">
        <h3>Directeur de plongée et conditions</h3>

        <label for="dp">Directeur de plongée</label>
        <app-combobox idChamp="dp" [options]="dpsPossibles()" [(valeur)]="f.dpId"
                      aide="Rechercher un moniteur…" texteVide="Aucun moniteur ne correspond." />
        <p class="secondaire">Seuls les E3 et E4 peuvent diriger la plongée.</p>
        @if (dpNonHabilite(f.dpId); as m) {
          <div class="alerte" role="status">
            {{ m.nomComplet }} ({{ m.niveauEncadrement }}) est enregistré comme directeur de plongée,
            mais le DP doit être au moins E3 : choisissez un E3 ou un E4.
          </div>
        }

        <div class="grille-conditions">
          <div>
            <label for="meteo">Météo</label>
            <input id="meteo" name="meteo" type="text" [(ngModel)]="f.meteo">
          </div>
          <div>
            <label for="etatMer">État de la mer</label>
            <input id="etatMer" name="etatMer" type="text" [(ngModel)]="f.etatMer">
          </div>
          <div>
            <label for="visibilite">Visibilité</label>
            <input id="visibilite" name="visibilite" type="text" [(ngModel)]="f.visibilite">
          </div>
          <div>
            <label for="courant">Courant</label>
            <input id="courant" name="courant" type="text" [(ngModel)]="f.courant">
          </div>
          <div>
            <label for="maree">Marée</label>
            <input id="maree" name="maree" type="text" [(ngModel)]="f.maree">
          </div>
          <div>
            <label for="temperatureEau">Température de l'eau</label>
            <input id="temperatureEau" name="temperatureEau" type="text" [(ngModel)]="f.temperatureEau">
          </div>
        </div>

        <label for="securiteSurface">Sécurité surface</label>
        <textarea id="securiteSurface" name="securiteSurface" rows="2" [(ngModel)]="f.securiteSurface"
                  placeholder="Moyens et personnes en charge de la surveillance surface"></textarea>

        <label for="planSecours">Plan de secours</label>
        <textarea id="planSecours" name="planSecours" rows="2" [(ngModel)]="f.planSecours"
                  placeholder="Numéro d'alerte, canal VHF, point d'évacuation…"></textarea>

        <label for="observations">Observations</label>
        <textarea id="observations" name="observations" rows="2" [(ngModel)]="f.observations"
                  placeholder="Incident, remontée anormale, plongée successive…"></textarea>
      </section>

      <section class="carte panneau panneau-groupe">
        <h3>Groupe de plongeurs (réutilisable pour un séjour)</h3>
        <p class="secondaire">
          Composez une fois la liste des plongeurs d'un séjour, puis placez-les dans les
          palanquées ci-dessous à chaque nouvelle fiche, sans ressaisie : touchez un plongeur
          puis choisissez sa palanquée, ou glissez-le (appui long sur téléphone).
        </p>

        <div class="ligne-groupe">
          <select [ngModel]="groupeSelectionneId()" (ngModelChange)="groupeSelectionneId.set($event)"
                  name="groupeSelectionne">
            <option [ngValue]="null">— Aucun groupe —</option>
            @for (g of groupes(); track g.id) {
              <option [ngValue]="g.id">{{ g.nom }} ({{ g.membres.length }})</option>
            }
          </select>
          <button type="button" class="bouton-discret" (click)="message.set(null); creationGroupeOuverte.set(true)">
            + Nouveau groupe
          </button>
          @if (groupeSelectionneId()) {
            <button type="button" class="bouton-discret danger" (click)="supprimerGroupeCourant()">
              Supprimer ce groupe
            </button>
          }
          <a routerLink="/groupes" class="bouton-discret">Gérer les groupes →</a>
        </div>

        @if (seancesLiees().length > 0 || seancesLiables().length > 0 || auth.etablitFichesSecurite()) {
          <div class="liaison">
            <p class="secondaire">
              Le même jour, un autre bateau ou un autre site ? Liez les deux séances : sur chaque fiche,
              le groupe ne propose plus que les plongeurs qui ne sont pas déjà dans une palanquée de l'autre.
              « Dupliquer et lier » crée la seconde séance et y déplace les palanquées de votre choix.
            </p>
            @for (l of seancesLiees(); track l.seanceId) {
              <p class="seance-liee">
                🔗 Liée à <strong>{{ libelleSeance(l) }}</strong>
                <span class="secondaire">
                  — {{ detailsSeance(l.seanceId) }}{{ detailsSeance(l.seanceId) ? ' · ' : '' }}{{
                    l.ficheEtablie ? (l.plongeursPlaces.length | pluriel:'plongeur déjà placé':'plongeurs déjà placés') : 'fiche pas encore établie' }}
                </span>
                <a class="lien-fiche-liee" [routerLink]="['/fiches-securite', l.seanceId]">Ouvrir sa fiche →</a>
              </p>
            }
            <div class="ligne-groupe">
              @if (seancesLiables().length > 0) {
                <select class="choix-seance" [ngModel]="seanceALier()" (ngModelChange)="seanceALier.set($event)"
                        name="seanceALier" aria-label="Séance du même jour à lier">
                  <option [ngValue]="null">— Lier à une autre séance du {{ seance()?.date | dateFr }} —</option>
                  @for (s of seancesLiables(); track s.id) {
                    <option [ngValue]="s.id">
                      {{ libelleSeance(s) }}{{ detailsSeance(s.id) ? ' — ' + detailsSeance(s.id) : '' }}
                    </option>
                  }
                </select>
                <button type="button" class="bouton-discret" [disabled]="!seanceALier() || envoiLiaison()"
                        (click)="lier()">Lier</button>
              }
              @if (seancesLiees().length > 0) {
                <button type="button" class="bouton-discret danger" [disabled]="envoiLiaison()" (click)="delier()">
                  Délier cette séance
                </button>
              }
              @if (auth.etablitFichesSecurite()) {
                <button type="button" class="bouton-discret bouton-dupliquer" (click)="ouvrirDuplication()">
                  Dupliquer et lier…
                </button>
              }
            </div>
            @if (seanceChoisiePourLien(); as s) {
              <p class="detail-seance">
                <strong>{{ libelleSeance(s) }}</strong><br>
                {{ s.date | dateFr }} · {{ s.milieu === 'NATUREL' ? 'Milieu naturel' : 'Milieu artificiel' }}
                {{ s.profondeurMax ? ' · ' + s.profondeurMax + ' m max' : '' }}
                · {{ s.ficheSecurite ? 'fiche déjà établie' : 'fiche pas encore établie' }}
                @if (s.commentaire) { <br>{{ s.commentaire }} }
              </p>
            }
          </div>
        }

        <app-dialogue [ouvert]="creationGroupeOuverte()" titre="Nouveau groupe de plongeurs" [erreur]="message()"
                      (fermer)="creationGroupeOuverte.set(false)">
          <p class="secondaire">Le groupe reprend les plongeurs déjà placés dans les palanquées de cette fiche.</p>
          <label for="nom-groupe">Nom du groupe</label>
          <input id="nom-groupe" type="text" placeholder="ex. Séjour Égypte mai 2026"
                 [ngModel]="nomNouveauGroupe()" (ngModelChange)="nomNouveauGroupe.set($event)" name="nomGroupe">
          <div class="actions-dialogue">
            <button type="button" class="bouton-principal" [disabled]="envoiGroupe()" (click)="creerGroupe()">
              Créer à partir des plongeurs de cette fiche
            </button>
            <button type="button" class="bouton-discret" (click)="creationGroupeOuverte.set(false)">Annuler</button>
          </div>
        </app-dialogue>

        <app-dialogue [ouvert]="duplication() !== null" titre="Dupliquer et lier la séance"
                      [erreur]="erreurDuplication()" (fermer)="duplication.set(null)">
          @if (duplication(); as d) {
            <p class="secondaire">
              Une nouvelle séance le {{ seance()?.date | dateFr }}, au même endroit, liée à celle-ci :
              un second bateau ou une seconde rotation. Elle reprend les conditions de cette fiche.
            </p>

            <label for="dup-dp">Directeur de plongée de la nouvelle séance</label>
            <app-combobox idChamp="dup-dp" [options]="dpsPossibles()" [(valeur)]="d.dpId"
                          aide="Rechercher un moniteur…" texteVide="Aucun moniteur ne correspond." />

            <label for="dup-ordre">N° de plongée de la nouvelle séance</label>
            <input id="dup-ordre" name="dupOrdre" type="number" min="1" [(ngModel)]="d.ordre">

            <label for="dup-info-origine">Info complémentaire de cette séance (n° {{ seance()?.ordre }})</label>
            <input id="dup-info-origine" name="dupInfoOrigine" type="text" [(ngModel)]="d.infoOrigine"
                   placeholder="ex. Bateau 1">

            <label for="dup-info">Info complémentaire de la nouvelle séance</label>
            <input id="dup-info" name="dupInfo" type="text" [(ngModel)]="d.info" placeholder="ex. Bateau 2">

            <fieldset class="choix-palanquees-dup">
              <legend>Palanquées à passer sur la nouvelle séance</legend>
              @for (p of palanqueesEnregistrees(); track p.numero) {
                <label class="case">
                  <input type="checkbox" [checked]="d.palanquees.includes(p.numero)"
                         (change)="basculerPalanqueeDupliquee(p.numero)">
                  {{ nomPalanquee(p) }}
                  <span class="secondaire">— {{ resumePalanquee(p) }}</span>
                </label>
              } @empty {
                <p class="secondaire">Aucune palanquée enregistrée sur cette fiche : la nouvelle partira vide.</p>
              }
              <p class="secondaire">
                Les palanquées cochées quittent cette fiche ; de chaque côté, elles sont renumérotées à partir de 1.
                Seule la fiche enregistrée compte : enregistrez d'abord vos dernières modifications.
              </p>
            </fieldset>

            <div class="actions-dialogue">
              <button type="button" class="bouton-principal" [disabled]="envoiDuplication()" (click)="dupliquer()">
                {{ envoiDuplication() ? 'Création…' : 'Créer la séance liée' }}
              </button>
              <button type="button" class="bouton-discret" (click)="duplication.set(null)">Annuler</button>
            </div>
          }
        </app-dialogue>

        @if (groupeSelectionne(); as g) {
          <div cdkDropList id="pool" [cdkDropListDisabled]="!auth.etablitFichesSecurite()" [cdkDropListData]="poolDisponible()" [cdkDropListConnectedTo]="idsPalanquees()"
               class="pool-plongeurs">
            @for (m of poolDisponible(); track m) {
              <button type="button" class="jeton-plongeur" cdkDrag [cdkDragData]="m"
                      [cdkDragStartDelay]="delaiGlisser"
                      [class.selectionne]="membreAPlacer() === m" [attr.aria-pressed]="membreAPlacer() === m"
                      [attr.aria-label]="m.prenom + ' ' + m.nom + (aptitudeSurFiche(m) ? ', ' + aptitudeSurFiche(m) : '')"
                      (click)="selectionnerPourPlacer(m)">
                <span class="nom-long">{{ m.prenom }} {{ m.nom }}</span>
                <span class="nom-court">{{ m.prenom }} {{ initiale(m.nom) }}</span>
                @if (aptitudeSurFiche(m); as a) { <span class="niveau-jeton">{{ a }}</span> }
              </button>
            }
            @if (poolDisponible().length === 0) {
              <p class="vide">
                {{ g.membres.length === 0 ? "Ce groupe n'a aucun plongeur."
                                          : 'Tous les plongeurs de ce groupe sont déjà répartis dans une palanquée.' }}
              </p>
            }
          </div>
          @if (masquesParLiaison() > 0) {
            <p class="secondaire">
              {{ masquesParLiaison() > 1
                  ? masquesParLiaison() + ' plongeurs du groupe déjà placés sur la fiche liée, non proposés ici.'
                  : masquesParLiaison() + ' plongeur du groupe déjà placé sur la fiche liée, non proposé ici.' }}
            </p>
          }
          @if (seance()?.milieu === 'NATUREL') {
            <button type="button" class="bouton-principal bouton-proposer action-ordinateur" (click)="ouvrirProposition()">
              Proposer les palanquées automatiquement
            </button>
          }
        }
      </section>

      <app-dialogue [ouvert]="propositionOuverte()" titre="Proposer les palanquées" [erreur]="erreurProposition()"
                    (fermer)="propositionOuverte.set(false)">
        @if (criteres(); as c) {
          <p class="secondaire">
            {{ proposables().length | pluriel:'plongeur' }} du groupe. La proposition remplace les palanquées du
            formulaire ; rien n'est enregistré avant que vous ne la relisiez et touchiez « Enregistrer la fiche ».
          </p>

          <div class="grille-conditions">
            <div>
              <label for="prop-profondeur">Profondeur visée (m)</label>
              <input id="prop-profondeur" type="number" min="1" max="60" [(ngModel)]="c.profondeur"
                     name="propProfondeur">
            </div>
            <div>
              <label for="prop-type">Type de plongée</label>
              <select id="prop-type" [(ngModel)]="c.type" name="propType">
                <option value="EXPLORATION">Exploration</option>
                <option value="ENSEIGNEMENT">Enseignement (formation)</option>
              </select>
            </div>
            <div>
              <label for="prop-max">Plongeurs par palanquée encadrée</label>
              <select id="prop-max" [(ngModel)]="c.maxPlongeurs" name="propMax">
                @for (n of [1, 2, 3, 4]; track n) { <option [ngValue]="n">{{ n }} + l'encadrant</option> }
              </select>
            </div>
          </div>

          <label class="case">
            <input type="checkbox" [(ngModel)]="c.autonomesEnsemble" name="propAutonomes">
            Regrouper les plongeurs autonomes entre eux (par 2 ou 3, sans guide)
          </label>
          <label class="case">
            <input type="checkbox" [(ngModel)]="c.regrouperParNiveau" name="propNiveau">
            Ne pas mélanger les niveaux (niveau préparé, sinon aptitude)
          </label>

          <h3 class="sous-titre">Encadrants disponibles</h3>
          @if (encadrantsPossibles().length === 0) {
            <p class="vide">Aucun encadrant reconnu dans ce groupe (aptitude E1 à E4, GP, N4, N5, ou compte moniteur).</p>
          }
          @for (i of encadrantsPossibles(); track i) {
            <label class="case">
              <input type="checkbox" [checked]="encadrantsCoches().has(i)" (change)="basculerEncadrant(i)">
              {{ libelleProposable(i) }}
            </label>
          }

          <h3 class="sous-titre">Binômes (facultatif)</h3>
          <div class="ligne-groupe">
            <select [ngModel]="paireA()" (ngModelChange)="paireA.set($event)" name="paireA" aria-label="Premier plongeur">
              <option [ngValue]="null">— Plongeur —</option>
              @for (m of proposables(); track $index) { <option [ngValue]="$index">{{ libelleProposable($index) }}</option> }
            </select>
            <select [ngModel]="paireB()" (ngModelChange)="paireB.set($event)" name="paireB" aria-label="Second plongeur">
              <option [ngValue]="null">— Plongeur —</option>
              @for (m of proposables(); track $index) { <option [ngValue]="$index">{{ libelleProposable($index) }}</option> }
            </select>
            <button type="button" class="bouton-discret" (click)="ajouterPaire(true)">Garder ensemble</button>
            <button type="button" class="bouton-discret" (click)="ajouterPaire(false)">Séparer</button>
          </div>
          @for (p of paires(); track $index) {
            <p class="paire">
              {{ p.ensemble ? 'Ensemble' : 'Séparés' }} : {{ libelleProposable(p.a) }} et {{ libelleProposable(p.b) }}
              <button type="button" class="bouton-discret danger" (click)="retirerPaire($index)"
                      aria-label="Retirer ce binôme">✕</button>
            </p>
          }

          <div class="actions-dialogue">
            <button type="button" class="bouton-principal" [disabled]="envoiProposition()" (click)="proposer()">
              {{ envoiProposition() ? 'Calcul…' : 'Proposer' }}
            </button>
            <button type="button" class="bouton-discret" (click)="propositionOuverte.set(false)">Annuler</button>
          </div>
        }
      </app-dialogue>

      @if (bilanProposition(); as b) {
        <section class="carte panneau bilan-proposition" role="status">
          <div class="ligne-titre">
            <h3>Proposition automatique : à relire</h3>
            <button type="button" class="bouton-discret" (click)="bilanProposition.set(null)">Fermer</button>
          </div>
          <p class="secondaire">
            {{ b.palanquees.length | pluriel:'palanquée proposée':'palanquées proposées' }}. Vérifiez-les, ajustez-les si besoin,
            puis enregistrez la fiche : le directeur de plongée reste seul juge.
          </p>
          @if (b.nonPlaces.length > 0) {
            <p><strong>Non placés :</strong></p>
            <ul>
              @for (n of b.nonPlaces; track $index) { <li>{{ n.prenom }} {{ n.nom }} — {{ n.raison }}</li> }
            </ul>
          }
          @if (b.encadrantsLibres.length > 0) {
            <p><strong>Encadrants sans palanquée :</strong> {{ b.encadrantsLibres.join(', ') }}
              (sécurité surface, serre-file…)</p>
          }
          @for (a of b.avertissements; track $index) { <p class="alerte-profondeur">⚠ {{ a }}</p> }
        </section>
      }

      @for (p of palanquees(); track p; let iP = $index) {
        <!-- Toujours compacte : profil prévu modifiable sur place, une ligne par plongeur, touchée pour le modifier. -->
        <section class="carte panneau palanquee">
          <div class="ligne-titre">
            <h3>{{ nomPalanquee(p) }}</h3>
            <button type="button" class="bouton-discret danger retirer-palanquee"
                    [attr.aria-label]="'Retirer ' + nomPalanquee(p).replace('Palanquée', 'la palanquée')"
                    (click)="retirerPalanquee(iP)">Retirer</button>
          </div>

          <div class="ligne-profil">
            <label>Profondeur prévue (m) <input type="number" min="0" inputmode="numeric"
                   [(ngModel)]="p.profondeurPrevue" [name]="'pp-' + iP"></label>
            <label>Durée prévue (min) <input type="number" min="0" inputmode="numeric"
                   [(ngModel)]="p.dureePrevue" [name]="'dp-' + iP"></label>
          </div>

          <div cdkDropList [id]="'palanquee-' + p.numero" [cdkDropListDisabled]="!auth.etablitFichesSecurite()" [cdkDropListData]="p.membres"
               class="zone-membres" [class.zone-membres-vide]="p.membres.length === 0"
               [cdkDropListConnectedTo]="tousLesIds()" (cdkDropListDropped)="onDropPalanquee($event, iP)">
            @if (p.membres.length === 0) {
              <p class="vide">Glissez un plongeur ici, ou touchez « + Plongeur ».</p>
            }
            @for (m of p.membres; track m; let iM = $index) {
              <div class="plongeur-resume" cdkDrag [cdkDragStartDelay]="delaiGlisser">
                <button type="button" class="modifier-plongeur"
                        [attr.aria-label]="'Modifier ' + libelleMembre(m)" (click)="modifierPlongeur(iP, iM)">
                  <span class="texte-plongeur">
                    <span [class.chef]="m.fonction !== 'PLONGEUR'">{{ libelleMembre(m) }}</span>
                    @if (libelleGaz(m); as gaz) { <span class="gaz-plongeur">{{ gaz }}</span> }
                    @if (alerteProfondeur(p, m); as alerte) {
                      <span class="alerte-profondeur">⚠ {{ alerte }}</span>
                    }
                    @if (alerteMod(p, m); as alerte) {
                      <span class="alerte-profondeur">⚠ {{ alerte }}</span>
                    }
                    @if (aussiSurFicheLiee(m); as alerte) {
                      <span class="alerte-profondeur">⚠ {{ alerte }}</span>
                    }
                  </span>
                  <span class="crayon" aria-hidden="true">✎</span>
                </button>
              </div>
            }
          </div>

          <button type="button" class="bouton-discret ajouter-plongeur" (click)="ajouterMembre(iP)">+ Plongeur</button>
        </section>
      }

      <div class="ajouts-palanquees action-ordinateur">
        <button type="button" class="bouton-discret bouton-ajout-palanquee" (click)="ouvrirNouvellePalanquee(null)">+ Palanquée</button>
        <button type="button" class="bouton-discret bouton-reprendre-palanquee" (click)="ouvrirReprise()">
          Reprendre une palanquée d'une autre séance…
        </button>
      </div>

      <app-dialogue [ouvert]="repriseOuverte()" titre="Reprendre une palanquée d'une autre séance"
                    [erreur]="erreurReprise()" (fermer)="repriseOuverte.set(false)">
        <p class="secondaire">
          Les palanquées choisies sont copiées à la suite de celles de cette fiche, avec leurs plongeurs
          et leur profil prévu (pas ce qui a été réellement plongé). La fiche d'origine ne change pas ;
          rien n'est enregistré avant « Enregistrer la fiche ».
        </p>
        <label for="reprise-seance">Séance d'origine</label>
        <app-combobox idChamp="reprise-seance" [options]="seancesAReprendre()" [valeur]="seanceAReprendre()"
                      (valeurChange)="choisirSeanceAReprendre($event)"
                      aide="Rechercher une date, un lieu…" texteVide="Aucune autre séance n'a de fiche établie." />

        @if (seanceAReprendre() !== null) {
          <fieldset class="choix-palanquees-dup">
            <legend>Palanquées à reprendre</legend>
            @if (chargementReprise()) {
              <p class="vide">Chargement de la fiche…</p>
            } @else {
              @for (p of palanqueesAReprendre(); track p.numero) {
                <label class="case">
                  <input type="checkbox" [checked]="palanqueesCochees().has(p.numero)"
                         (change)="basculerPalanqueeReprise(p.numero)">
                  {{ nomPalanquee(p) }}
                  <span class="secondaire">— {{ resumePalanquee(p) }}</span>
                </label>
              } @empty {
                <p class="secondaire">La fiche de cette séance n'a aucune palanquée.</p>
              }
            }
          </fieldset>
        }

        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" [disabled]="palanqueesCochees().size === 0"
                  (click)="reprendre()">
            Ajouter à cette fiche
          </button>
          <button type="button" class="bouton-discret" (click)="repriseOuverte.set(false)">Annuler</button>
        </div>
      </app-dialogue>

      <!-- Une seule fenêtre : le profil prévu d'une nouvelle palanquée, la fonction d'un encadrant ajouté, ou les deux. -->
      <app-dialogue [ouvert]="demandeAjout() !== null" [titre]="titreDemandeAjout()"
                    [erreur]="erreurDemandeAjout()" (fermer)="fermerDemandeAjout()">
        @if (demandeAjout(); as d) {
          @if (d.profil; as profil) {
            <p class="secondaire">
              Le profil prévu de la palanquée : un plongeur dont l'aptitude ne permet pas cette profondeur
              n'y sera pas accepté.
            </p>
            <label for="nouvelle-profondeur">Profondeur prévue (m)</label>
            <input id="nouvelle-profondeur" name="nouvelleProfondeur" type="number" min="1" inputmode="numeric"
                   [(ngModel)]="profil.profondeur">
            <label for="nouvelle-duree">Durée prévue (min)</label>
            <input id="nouvelle-duree" name="nouvelleDuree" type="number" min="1" inputmode="numeric"
                   [(ngModel)]="profil.duree">
          }
          @if (d.encadrant; as e) {
            @if (d.profil) {
              <fieldset class="choix-fonction-groupe">
                <legend>
                  Fonction de {{ (e.prenom + ' ' + e.nom).trim() || 'cet encadrant' }}{{ e.aptitude ? ' (' + e.aptitude + ')' : '' }}
                </legend>
                <div class="segments">
                  @for (f of fonctions; track f.valeur) {
                    <button type="button" [class.selectionne]="d.fonction === f.valeur"
                            [attr.aria-pressed]="d.fonction === f.valeur" (click)="d.fonction = f.valeur">
                      {{ f.libelle }}
                    </button>
                  }
                </div>
              </fieldset>
            } @else {
              <p class="secondaire">
                {{ e.aptitude ? 'Aptitude ' + e.aptitude + '. ' : '' }}Quel est son rôle
                dans cette palanquée ? Il se modifie ensuite dans la case « Fonction ».
              </p>
              <div class="choix-fonction">
                @for (f of fonctionsEncadrant; track f.valeur; let premier = $first) {
                  <button type="button" [class]="premier ? 'bouton-principal' : 'bouton-discret'"
                          (click)="choisirFonction(f.valeur)">{{ f.libelle }}</button>
                }
              </div>
            }
          }
          @if (d.profil) {
            <div class="actions-dialogue">
              <button type="button" class="bouton-principal" (click)="creerNouvellePalanquee()">Créer la palanquée</button>
              <button type="button" class="bouton-discret" (click)="fermerDemandeAjout()">Annuler</button>
            </div>
          }
        }
      </app-dialogue>

      <!-- Un plongeur de la fiche, touché sur sa ligne (ou ajouté par « + Plongeur ») : tout ce qui le concerne. -->
      <app-dialogue [ouvert]="plongeurEnEdition() !== null" [titre]="titreEdition()"
                    [erreur]="erreurEdition()" (fermer)="fermerEdition()">
        @if (plongeurEnEdition(); as e) {
          @if (palanquees()[e.palanquee]?.membres[e.membre]; as m) {
            <label for="edition-connu">Plongeur du club (remplit nom, aptitude et qualification)</label>
            <input id="edition-connu" type="text" class="selecteur-connu" placeholder="Rechercher un nom…"
                   list="plongeurs-club" (change)="choisirPlongeurConnu(e.palanquee, e.membre, $event)">

            <!-- Étiquettes visibles : sur une fiche remplie, un texte d'aide disparaît et on ne sait plus quel champ est lequel. -->
            <div class="ligne-plongeur">
              <label class="champ">Prénom
                <input type="text" [(ngModel)]="m.prenom" name="edition-prenom">
              </label>
              <label class="champ">Nom
                <input type="text" [(ngModel)]="m.nom" name="edition-nom">
              </label>
              <label class="champ">Aptitude
                <input type="text" placeholder="ex. N2, E2…" [(ngModel)]="m.aptitude" name="edition-aptitude">
              </label>
            </div>

            <!-- Sélecteur compact sur une ligne, comme un champ : le cas courant (« Plongeur ») en premier. -->
            <fieldset class="champ fonction-plongeur">
              <legend>Fonction</legend>
              <div class="segments">
                @for (f of fonctions; track f.valeur) {
                  <button type="button" [class.selectionne]="m.fonction === f.valeur"
                          [attr.aria-pressed]="m.fonction === f.valeur" (click)="m.fonction = f.valeur">
                    {{ f.libelle }}
                  </button>
                }
              </div>
              @if (fonctionADonner(m)) {
                <p class="indice-fonction">{{ m.aptitude ? 'Aptitude ' + m.aptitude + ' : ' : '' }}peut encadrer, précisez sa fonction.</p>
              }
            </fieldset>

            <!-- Rarement remplis : repliés, sauf si l'un d'eux l'est déjà (rien de saisi n'est caché). -->
            <details class="details-plongeur" [open]="aDesDetails(m)">
              <summary>Détails : gaz, désaturation, qualification préparée, observations…</summary>
              <div class="ligne-plongeur">
                <label class="champ">Aptitude donnée par le DP
                  <input type="text" [(ngModel)]="m.aptitudeDonneeParDp" name="edition-aptitude-dp">
                </label>
                <label class="champ">Qualification préparée
                  <input type="text" placeholder="si en formation" [(ngModel)]="m.qualificationPreparee"
                         name="edition-qualif">
                </label>
                <label class="champ">Gaz
                  <input type="text" placeholder="ex. Air, Nitrox 32…" [(ngModel)]="m.gaz" name="edition-gaz">
                </label>
                <!-- Un mélange autre que l'air : sa ppO2 maximale, et la profondeur maximale d'utilisation qui en découle. -->
                @if (profondeurMaximaleUtilisation(m.gaz, m.ppo2Max); as mod) {
                  <div class="champ champ-large melange">
                    <span id="edition-ppo2">ppO2 max (bar)</span>
                    <div class="choix-ppo2" role="group" aria-labelledby="edition-ppo2">
                      @for (v of ppo2Possibles; track v) {
                        <button type="button" class="bouton-discret" [class.selectionne]="(m.ppo2Max ?? ppo2ParDefaut) === v"
                                [attr.aria-pressed]="(m.ppo2Max ?? ppo2ParDefaut) === v" (click)="m.ppo2Max = v">
                          {{ v.toFixed(1).replace('.', ',') }}
                        </button>
                      }
                    </div>
                    <p class="mod" role="status">MOD : <strong>{{ mod }} m</strong></p>
                  </div>
                }
                <label class="champ">Désaturation
                  <input type="text" placeholder="ex. Ordinateur, tables" [(ngModel)]="m.moyenDesaturation"
                         name="edition-desat">
                </label>
                <label class="champ champ-large">Observations
                  <input type="text" [(ngModel)]="m.observations" name="edition-observations">
                </label>
              </div>
            </details>
            @if (alerteProfondeur(palanquees()[e.palanquee], m); as alerte) {
              <p class="alerte-profondeur">⚠ {{ alerte }}</p>
            }
            @if (alerteMod(palanquees()[e.palanquee], m); as alerte) {
              <p class="alerte-profondeur">⚠ {{ alerte }}</p>
            }
            @if (aussiSurFicheLiee(m); as alerte) {
              <p class="alerte-profondeur">⚠ {{ alerte }}</p>
            }

            <div class="actions-dialogue">
              <button type="button" class="bouton-principal" (click)="fermerEdition()">OK</button>
              @if (!ligneVide(m)) {
                <button type="button" class="bouton-discret deplacer-plongeur" (click)="deplacerDepuisEdition()">
                  ⇄ Changer de palanquée
                </button>
              }
              <button type="button" class="bouton-discret danger retirer-plongeur" (click)="retirerDepuisEdition()">
                Retirer de la palanquée
              </button>
            </div>
          }
        }
      </app-dialogue>

      @if (membreAPlacer(); as m) {
        <div class="barre-placement" role="dialog" aria-label="Choisir la palanquée">
          <p><strong>{{ m.prenom }} {{ m.nom }}</strong> → quelle palanquée ?</p>
          <div class="choix-palanquees">
            @for (p of palanquees(); track p; let iP = $index) {
              <button type="button" class="bouton-principal" (click)="placer(m, iP)">
                {{ nomPalanquee(p) }} ({{ p.membres.length }})
              </button>
            }
            <button type="button" class="bouton-discret" (click)="ouvrirNouvellePalanquee(m)">
              + Nouvelle palanquée
            </button>
            <button type="button" class="bouton-discret" (click)="membreAPlacer.set(null)">Annuler</button>
          </div>
        </div>
      }

      @if (plongeurADeplacer(); as d) {
        <div class="barre-placement" role="dialog" aria-label="Choisir la palanquée de destination">
          <p>
            <strong>{{ nomADeplacer() }}</strong>
            ({{ palanquees()[d.palanquee] ? nomPalanquee(palanquees()[d.palanquee]).replace('Palanquée', 'palanquée') : '' }})
            → vers quelle palanquée ?
          </p>
          <div class="choix-palanquees">
            @for (p of palanquees(); track p; let iP = $index) {
              @if (iP !== d.palanquee) {
                <button type="button" class="bouton-principal" (click)="deplacerVers(iP)">
                  {{ nomPalanquee(p) }} ({{ p.membres.length }})
                </button>
              }
            }
            <button type="button" class="bouton-discret" (click)="ouvrirNouvellePalanquee('deplacement')">+ Nouvelle palanquée</button>
            <button type="button" class="bouton-discret" (click)="plongeurADeplacer.set(null)">Annuler</button>
          </div>
        </div>
      }

      </fieldset>

      <!-- Toujours à portée de doigt, au-dessus de la barre d'onglets du téléphone : la fiche est longue. -->
      <div class="actions-bas" [class.a-enregistrer]="modificationsNonEnregistrees()">
        @if (message(); as m) {
          <div class="alerte message-bas" role="status">
            {{ m }}
            <button type="button" class="bouton-discret" aria-label="Fermer le message" (click)="message.set(null)">✕</button>
          </div>
        }
        @if (auth.etablitFichesSecurite()) {
          <button type="button" class="bouton-principal action-ordinateur" (click)="enregistrer()" [disabled]="envoi()">
            {{ envoi() ? 'Enregistrement…' : 'Enregistrer la fiche' }}
          </button>
          <span class="etat-enregistrement" role="status">
            @if (modificationsNonEnregistrees()) {
              ● Modifications non enregistrées
            } @else if (enAttente()) {
              Gardée sur l'appareil, en attente du réseau
            } @else if (ficheId() !== null) {
              ✓ Enregistrée
            }
          </span>
        }
        @if (ficheId() !== null) {
          <button type="button" class="bouton-discret action-ordinateur" (click)="imprimer()" [disabled]="impressionEnCours()">
            {{ impressionEnCours() ? 'Génération…' : 'Imprimer (PDF)' }}
          </button>
        }
        @if (dejaEnregistree()) {
          <a class="bouton-discret action-ordinateur" [routerLink]="['/fiches-securite', seanceId, 'realise']">
            Compléter au retour de plongée →
          </a>
        }
      </div>

      <!--
        Téléphone : un seul bouton rond, en bas à gauche, qui ouvre toutes les
        actions de la fiche ; elles ne prennent plus de place dans la page.
      -->
      @if (auth.etablitFichesSecurite() || ficheId() !== null || dejaEnregistree()) {
        @if (menuActionsOuvert()) {
          <div class="fond-menu-actions" (click)="menuActionsOuvert.set(false)"></div>
          <div class="menu-actions" id="menu-actions" role="menu" aria-label="Actions de la fiche">
            @if (auth.etablitFichesSecurite()) {
              <button type="button" role="menuitem" class="bouton-principal" [disabled]="envoi()"
                      (click)="menuActionsOuvert.set(false); enregistrer()">
                {{ envoi() ? 'Enregistrement…' : 'Enregistrer la fiche' }}
              </button>
              <button type="button" role="menuitem" class="bouton-discret"
                      (click)="menuActionsOuvert.set(false); ouvrirNouvellePalanquee(null)">+ Palanquée</button>
              <button type="button" role="menuitem" class="bouton-discret"
                      (click)="menuActionsOuvert.set(false); ouvrirReprise()">
                Reprendre une palanquée d'une autre séance…
              </button>
              @if (groupeSelectionne() && seance()?.milieu === 'NATUREL') {
                <button type="button" role="menuitem" class="bouton-discret"
                        (click)="menuActionsOuvert.set(false); ouvrirProposition()">
                  Proposer les palanquées automatiquement
                </button>
              }
            }
            @if (ficheId() !== null) {
              <button type="button" role="menuitem" class="bouton-discret" [disabled]="impressionEnCours()"
                      (click)="menuActionsOuvert.set(false); imprimer()">
                {{ impressionEnCours() ? 'Génération…' : 'Imprimer (PDF)' }}
              </button>
            }
            @if (dejaEnregistree()) {
              <a role="menuitem" class="bouton-discret" [routerLink]="['/fiches-securite', seanceId, 'realise']">
                Compléter au retour de plongée →
              </a>
            }
          </div>
        }
        <button type="button" class="bouton-flottant" aria-controls="menu-actions"
                [attr.aria-expanded]="menuActionsOuvert()"
                [attr.aria-label]="menuActionsOuvert() ? 'Fermer les actions de la fiche' : 'Actions de la fiche'"
                (click)="menuActionsOuvert.set(!menuActionsOuvert())">
          <span aria-hidden="true">{{ menuActionsOuvert() ? '✕' : '☰' }}</span>
          @if (modificationsNonEnregistrees() && !menuActionsOuvert()) {
            <span class="pastille-a-enregistrer" aria-hidden="true"></span>
          }
        </button>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin: var(--pas-3) 0 0; }
    .lecture-seule { border: 0; margin: 0; padding: 0; min-width: 0; }
    .titre-etape { margin: var(--pas-3) 0 0; }
    .panneau { padding: var(--pas-3); margin: var(--pas-2) 0 var(--pas-3); }
    /*
     * Sur grand écran, le groupe reste visible en tête pendant le défilement des
     * palanquées, pour y glisser un plongeur à tout moment ; sa liste est bornée
     * en hauteur pour ne jamais masquer les palanquées. Sur téléphone, il
     * défile normalement (il serait plus haut que l'écran) : on place un
     * plongeur en le touchant puis en choisissant sa palanquée.
     */
    @media (min-width: 721px) and (min-height: 600px) {
      .panneau-groupe { position: sticky; top: 0; z-index: 5; box-shadow: 0 4px 10px rgba(0,0,0,.08); }
      .panneau-groupe .pool-plongeurs { max-height: 30vh; overflow-y: auto; }
    }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    textarea { resize: vertical; }

    .grille-conditions {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--pas-2);
      margin: var(--pas-2) 0;
    }
    .grille-conditions label { margin: 0 0 4px; }

    .ligne-titre { display: flex; justify-content: space-between; align-items: center; }
    .ligne-profil {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--pas);
      font-size: .8125rem; margin-bottom: var(--pas);
    }
    .ligne-profil label { margin: 0; font-weight: 400; }
    .ligne-profil input { width: 100%; }

    .palanquee h3 { margin: 0; }
    .retirer-palanquee, .ajouter-plongeur { min-height: 44px; }
    .ajouter-plongeur { margin-top: var(--pas); }
    .plongeur-resume { border-top: 1px solid var(--trait); }
    /* Toute la ligne se touche pour modifier le plongeur. */
    .modifier-plongeur {
      display: flex; align-items: center; gap: var(--pas); width: 100%; min-height: 48px; box-sizing: border-box;
      padding: var(--pas) 0; margin: 0; background: none; border: 0; border-radius: 0;
      font: inherit; color: inherit; text-align: left; cursor: pointer;
    }
    .modifier-plongeur:hover:not(:disabled) { background: var(--brume, #eef4f5); }
    .texte-plongeur { flex: 1; display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 var(--pas); }
    .texte-plongeur .chef { font-weight: 700; }
    .texte-plongeur .alerte-profondeur { margin: 0; font-size: .8125rem; }
    .crayon { color: var(--profond); padding: 0 var(--pas); }
    .modifier-plongeur:disabled .crayon { display: none; }
    .bouton-ajout-palanquee, .bouton-reprendre-palanquee { min-height: 44px; }
    .ajouts-palanquees { display: flex; flex-wrap: wrap; gap: var(--pas); }

    .champ { margin: 0; font-weight: 400; font-size: .8125rem; color: var(--craie); }
    .champ input, .champ select { display: block; width: 100%; margin: 2px 0 0; color: var(--encre); }
    .selecteur-connu { width: 100%; }
    .gaz-plongeur { font-size: .8125rem; color: var(--craie); }
    .melange { display: flex; flex-wrap: wrap; align-items: center; gap: var(--pas); }
    .choix-ppo2 { display: flex; gap: var(--pas); }
    .choix-ppo2 > button { min-width: 56px; min-height: 44px; margin: 0; }
    .choix-ppo2 > button.selectionne { background: var(--profond); color: #fff; border-color: var(--profond); }
    .mod { margin: 0; font-size: .9375rem; color: var(--encre); }
    /* Sélecteur segmenté : trois choix accolés sur une ligne, 44 px de haut pour le doigt, pas plus. */
    .fonction-plongeur { border: 0; padding: 0; margin: 0 0 var(--pas); min-width: 0; }
    .fonction-plongeur legend { padding: 0; margin-bottom: 2px; }
    .segments {
      display: flex; width: 100%; max-width: 440px; margin-top: 2px;
      border: 1px solid var(--trait); border-radius: var(--r-s); overflow: hidden; background: var(--carte);
    }
    .segments > button {
      flex: 1 1 0; min-width: 0; min-height: 44px; margin: 0; padding: 2px var(--pas);
      border: 0; border-left: 1px solid var(--trait); border-radius: 0; background: none;
      font: inherit; font-size: .875rem; line-height: 1.15; color: var(--encre); cursor: pointer;
    }
    .segments > button:first-child { border-left: 0; }
    .segments > button.selectionne { background: var(--profond); color: #fff; font-weight: 600; }
    .indice-fonction { margin: 4px 0 0; font-size: .8125rem; color: #8a5a00; }
    .ligne-plongeur {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--pas);
      margin-bottom: var(--pas);
    }
    .champ-large { grid-column: 1 / -1; }
    .details-plongeur { margin-bottom: var(--pas); }
    .details-plongeur summary {
      cursor: pointer; font-size: .875rem; color: var(--profond); min-height: 44px;
      display: flex; align-items: center;
    }

    .danger { color: #B3261E; border-color: #B3261E; }
    .alerte-profondeur { margin: -4px 0 var(--pas); font-size: .8125rem; color: #8a5a00; }
    .actions-bas {
      position: sticky; bottom: var(--hauteur-onglets); z-index: 6;
      display: flex; gap: var(--pas-2); flex-wrap: wrap; align-items: center;
      margin: var(--pas-3) 0; padding: var(--pas-2) 0; background: var(--fond); border-top: 1px solid var(--trait);
    }
    .actions-bas .bouton-principal { width: auto; margin: 0; }
    .message-bas { flex: 1 1 100%; margin: 0; display: flex; align-items: center; justify-content: space-between; gap: var(--pas); }
    .message-bas button { min-width: 44px; min-height: 44px; }
    .etat-enregistrement { font-size: .875rem; color: var(--craie); }
    .a-enregistrer .etat-enregistrement { color: #8a5a00; font-weight: 700; }

    /* Bouton rond et ses actions : téléphone seulement (sous 860 px, comme la barre d'onglets). */
    .bouton-flottant, .menu-actions, .fond-menu-actions { display: none; }
    @media (max-width: 860px) {
      .action-ordinateur { display: none; }
      /* La barre du bas ne garde que l'état et les messages, à droite du bouton rond. */
      .actions-bas { min-height: 72px; padding-left: 76px; }
      .bouton-flottant {
        display: flex; align-items: center; justify-content: center;
        position: fixed; left: var(--pas-2); z-index: 35;
        bottom: calc(var(--hauteur-onglets) + var(--pas));
        width: 56px; height: 56px; border-radius: 50%; padding: 0;
        background: var(--profond); color: #fff; border: 0; font-size: 1.5rem;
        box-shadow: 0 4px 12px rgba(0,0,0,.3);
      }
      .pastille-a-enregistrer {
        position: absolute; top: 2px; right: 2px; width: 14px; height: 14px; border-radius: 50%;
        background: var(--accent); border: 2px solid #fff;
      }
      .fond-menu-actions { display: block; position: fixed; inset: 0; z-index: 34; background: rgba(0,0,0,.25); }
      .menu-actions {
        display: flex; flex-direction: column; gap: var(--pas);
        position: fixed; left: var(--pas-2); z-index: 36;
        bottom: calc(var(--hauteur-onglets) + var(--pas) + 64px);
        width: min(320px, calc(100vw - 2 * var(--pas-2)));
        padding: var(--pas-2); background: var(--carte); border-radius: var(--r-s);
        box-shadow: 0 6px 20px rgba(0,0,0,.3);
      }
      .menu-actions > * { width: 100%; margin: 0; min-height: 44px; text-align: left; }
      .menu-actions a { display: flex; align-items: center; }
    }

    .ligne-groupe { display: flex; gap: var(--pas); flex-wrap: wrap; align-items: center; margin-bottom: var(--pas-2); }
    .ligne-groupe select { max-width: 280px; }
    .ligne-groupe input[type="text"] { flex: 1 1 240px; }
    .liaison { border-top: 1px solid var(--trait); padding-top: var(--pas); margin-bottom: var(--pas-2); }
    .liaison .secondaire { margin: 0 0 var(--pas); }
    .lien-fiche-liee { margin-left: var(--pas); white-space: nowrap; }
    .choix-fonction { display: flex; flex-direction: column; gap: var(--pas-2); margin-top: var(--pas-3); }
    .choix-fonction > button { min-height: 44px; width: 100%; margin: 0; }
    .choix-fonction-groupe { border: 0; padding: 0; margin: var(--pas-3) 0 0; min-width: 0; }
    .choix-fonction-groupe legend { padding: 0; margin-bottom: var(--pas); font-weight: 600; }
    .choix-palanquees-dup { border: 0; padding: 0; margin: var(--pas-2) 0 0; min-width: 0; }
    .choix-palanquees-dup legend { font-weight: 700; font-size: .9375rem; padding: 0; margin-bottom: var(--pas); }
    .choix-palanquees-dup .case {
      display: flex; align-items: center; gap: var(--pas); min-height: 44px; margin: 0; font-weight: 400;
    }
    .choix-palanquees-dup .case input { width: 22px; height: 22px; flex: none; }
    .seance-liee { margin: 0 0 var(--pas); }
    /* Les options portent le lieu, le milieu et l'info complémentaire : plus large que le choix du groupe. */
    .ligne-groupe select.choix-seance { flex: 1 1 320px; max-width: 100%; min-height: 44px; }
    .detail-seance {
      margin: 0; padding: var(--pas); font-size: .875rem;
      border-left: 3px solid var(--profond); background: var(--brume, #eef4f5); border-radius: var(--r-s);
    }

    .pool-plongeurs {
      display: flex; flex-wrap: wrap; gap: var(--pas); min-height: 44px;
      padding: var(--pas); border: 1px dashed var(--trait); border-radius: var(--r-s);
    }
    /* Toujours une zone visible et suffisamment grande pour y déposer un plongeur, même sans aucun membre. */
    .zone-membres-vide {
      min-height: 60px; display: flex; align-items: center; justify-content: center;
      border: 1px dashed var(--trait); border-radius: var(--r-s); margin-top: var(--pas);
    }
    .zone-membres-vide .vide { margin: 0; }
    .jeton-plongeur { display: inline-flex; align-items: center; gap: 6px; }
    .nom-court { display: none; }
    .niveau-jeton { font-weight: 700; color: var(--profond); }
    .jeton-plongeur.selectionne .niveau-jeton { color: #fff; }

    .jeton-plongeur.selectionne {
      background: var(--profond); border-color: var(--profond); color: #fff; font-weight: 700;
    }
    /* Au-dessus de la barre d'onglets du téléphone, le temps du choix. */
    .barre-placement {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
      max-height: 45vh; overflow-y: auto;
      padding: var(--pas-2) var(--pas-3) calc(var(--pas-2) + env(safe-area-inset-bottom, 0px));
      background: var(--carte); border-top: 1px solid var(--trait);
      box-shadow: 0 -6px 16px rgba(0,0,0,.15);
    }
    .barre-placement p { margin: 0 0 var(--pas); }
    .choix-palanquees { display: flex; flex-wrap: wrap; gap: var(--pas); }
    .choix-palanquees .bouton-principal { width: auto; margin: 0; }
    .jeton-plongeur {
      padding: var(--pas) var(--pas-2); border-radius: 999px; background: var(--brume, #eef4f5);
      border: 1px solid var(--trait); cursor: grab; font-size: .875rem; user-select: none;
      min-height: 44px; color: var(--encre); font-weight: 400;
    }
    /*
     * Téléphone : puces compactes, trois par ligne (nom de famille réduit à son
     * initiale, niveau en dessous), en gardant 44 px de haut pour le doigt.
     */
    @media (max-width: 600px) {
      .panneau-groupe { padding: var(--pas-2); }
      .pool-plongeurs {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
        gap: 6px; padding: 6px;
      }
      .jeton-plongeur {
        flex-direction: column; justify-content: center; gap: 0;
        padding: 2px 6px; border-radius: var(--r-s); line-height: 1.15; min-width: 0;
      }
      .nom-long { display: none; }
      .nom-court {
        display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        font-size: .8125rem;
      }
      .niveau-jeton { font-size: .75rem; }
      .pool-plongeurs .vide { grid-column: 1 / -1; }
    }

    .bouton-proposer { width: auto; margin: var(--pas-2) 0 0; }
    .case { display: flex; align-items: center; gap: var(--pas); font-weight: 400; min-height: 44px; margin: 0; }
    .case input { width: 22px; height: 22px; }
    .sous-titre { margin: var(--pas-3) 0 var(--pas); font-size: 1rem; }
    .paire { display: flex; align-items: center; gap: var(--pas); margin: 0 0 var(--pas); }
    .bilan-proposition { border-left: 4px solid var(--profond); }
    .bilan-proposition ul { margin: 0 0 var(--pas); padding-left: var(--pas-3); }

    .cdk-drag-preview { box-shadow: 0 4px 12px rgba(0,0,0,.2); }
    .cdk-drag-placeholder { opacity: 0.3; }
    .cdk-drop-list-dragging .plongeur:not(.cdk-drag-placeholder) { transition: transform 200ms ease; }
  `]
})
export class FicheSecuriteComponent implements AvecModifications {
  readonly lieuEtSite = lieuEtSite;
  readonly aDesDetails = aDesDetails;
  /** « 3 plongeurs · 20 m · 40 min », sous le titre de chaque palanquée. */
  readonly resumeComposition = resumeComposition;
  readonly nomPalanquee = nomPalanquee;
  readonly libelleMembre = libelleMembre;
  readonly ligneVide = ligneVide;
  readonly libelleGaz = libelleGaz;
  readonly alerteMod = alerteMod;
  readonly profondeurMaximaleUtilisation = profondeurMaximaleUtilisation;
  readonly ppo2Possibles = PPO2_POSSIBLES;
  readonly ppo2ParDefaut = PPO2_PAR_DEFAUT;
  private api = inject(ApiService);
  private file = inject(FileEcrituresService);
  private route = inject(ActivatedRoute);
  private navigation = inject(NavigationService);
  auth = inject(AuthService);

  seanceId = Number(this.route.snapshot.paramMap.get('id'));

  seance = signal<SeanceVue | null>(null);
  moniteurs = signal<MoniteurOptionVue[]>([]);

  /**
   * Directeurs de plongée proposés : E3 et E4 seulement, quel que soit le
   * milieu. Simple confort d'affichage : le serveur refuse de toute façon un
   * DP non habilité.
   */
  dpsPossibles = computed<OptionCombobox[]>(() => this.moniteurs()
    .filter(m => m.niveauEncadrement === 'E3' || m.niveauEncadrement === 'E4')
    .map(m => ({ id: m.id, libelle: m.nomComplet, detail: m.niveauEncadrement })));

  /**
   * DP déjà enregistré (fiche ancienne) qui ne serait plus accepté pour cette
   * séance. Méthode et non computed : le formulaire modifie `dpId` en place,
   * sans passer par le signal.
   */
  dpNonHabilite(dpId: number | null): MoniteurOptionVue | null {
    if (dpId == null || this.dpsPossibles().some(o => o.id === dpId)) return null;
    return this.moniteurs().find(m => m.id === dpId) ?? null;
  }
  chargement = signal(true);
  message = signal<string | null>(null);
  envoi = signal(false);
  /** Enregistrée sur le serveur, ou sur l'appareil en attente du réseau. */
  dejaEnregistree = computed(() => this.ficheId() !== null || this.enAttente());
  /** Une version de la fiche attend le réseau sur cet appareil. */
  enAttente = signal(false);

  ficheId = signal<number | null>(null);
  entete = signal<FormulaireEntete | null>(null);
  palanquees = signal<PalanqueeVue[]>([]);

  plongeursConnus = signal<PlongeurConnuVue[]>([]);

  saisonId = signal<number | null>(null);
  groupes = signal<GroupePlongeursVue[]>([]);
  groupeSelectionneId = signal<number | null>(null);
  groupeSelectionne = computed(() => this.groupes().find(g => g.id === this.groupeSelectionneId()) ?? null);
  creationGroupeOuverte = signal(false);
  nomNouveauGroupe = signal('');
  envoiGroupe = signal(false);

  /** Toutes les séances connues, pour proposer celles du même jour à lier. */
  toutesSeances = signal<SeanceVue[]>([]);
  /** Séances du même jour liées à celle-ci (deux bateaux…), et les plongeurs déjà placés sur leurs fiches. */
  seancesLiees = signal<SeanceLieeVue[]>([]);
  seanceALier = signal<number | null>(null);
  envoiLiaison = signal(false);

  seancesLiables = computed(() => {
    const courante = this.seance();
    if (!courante) return [];
    const liees = new Set(this.seancesLiees().map(l => l.seanceId));
    return this.toutesSeances()
      .filter(s => s.date === courante.date && s.id !== courante.id && !liees.has(s.id))
      .sort((a, b) => a.ordre - b.ordre || a.id - b.id);
  });

  /** Plongeur déjà dans une palanquée d'une fiche liée → libellé de la séance et numéro de palanquée. */
  placesSurFichesLiees = computed(() =>
    this.seancesLiees().flatMap(l => l.plongeursPlaces.map(p => ({
      plongeur: p, libelle: `${this.libelleSeance(l)}, palanquée ${p.palanquee}`
    }))));

  /** Où ce plongeur est déjà placé sur une fiche liée, null s'il n'y est pas. */
  private placeSurFicheLiee(m: Identite): string | null {
    return this.placesSurFichesLiees().find(x => memePlongeur(x.plongeur, m))?.libelle ?? null;
  }

  private placeSurCetteFiche(m: Identite): boolean {
    return this.palanquees().some(p => p.membres.some(x => memePlongeur(x, m)));
  }

  /**
   * Les membres du groupe déjà répartis dans une palanquée de cette fiche, ou
   * d'une fiche liée, ne se glissent plus depuis le pool.
   */
  poolDisponible = computed(() => {
    const groupe = this.groupeSelectionne();
    if (!groupe) return [];
    return groupe.membres.filter(m => !this.placeSurCetteFiche(m) && this.placeSurFicheLiee(m) === null);
  });

  /** Membres du groupe retirés du pool parce qu'ils sont déjà sur une fiche liée (et pas sur celle-ci). */
  masquesParLiaison = computed(() => {
    const groupe = this.groupeSelectionne();
    if (!groupe) return 0;
    return groupe.membres.filter(m => !this.placeSurCetteFiche(m) && this.placeSurFicheLiee(m) !== null).length;
  });

  /** Un id de dropList CDK par palanquée, pour connecter le pool du groupe et permettre le glisser-déposer entre elles. */
  idsPalanquees = computed(() => this.palanquees().map(p => 'palanquee-' + p.numero));
  tousLesIds = computed(() => ['pool', ...this.idsPalanquees()]);

  constructor() {
    // La liste rouvre sur la date de la séance, pas sur toutes les dates.
    this.navigation.preciserRetour(computed(() => ({
      libelle: 'Fiches de sécurité', lien: '/fiches-securite', parametres: { date: this.seance()?.date ?? null }
    })));
    // « Ouvrir sa fiche » d'une séance liée garde ce composant : on recharge pour la nouvelle séance.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(p => {
      const id = Number(p.get('id'));
      if (id === this.seanceId) return;
      this.seanceId = id;
      this.chargement.set(true);
      this.message.set(null);
      this.bilanProposition.set(null);
      this.membreAPlacer.set(null);
      this.plongeurADeplacer.set(null);
      void this.charger();
    });
    void this.charger();
  }

  private async charger(): Promise<void> {
    try {
      // Chaque lecture retombe sur le cache hors ligne (voir « Préparer hors ligne »).
      const [seances, moniteurs, plongeursConnus, ficheLue, saisons] = await Promise.all([
        this.api.seances(),
        this.api.moniteursActifs(),
        this.api.plongeursConnus(),
        this.api.ficheSecurite(this.seanceId),
        this.api.saisonsHorsLigne()
      ]);
      const { fiche, enAttente } = this.file.ficheAJour(this.seanceId, ficheLue, moniteurs);
      this.enAttente.set(enAttente);
      this.seance.set(seances.find(s => s.id === this.seanceId) ?? null);
      this.toutesSeances.set(seances);
      // Une fiche gardée hors ligne avant l'arrivée des séances liées n'a pas ce champ.
      this.seancesLiees.set(fiche.seancesLiees ?? []);
      this.moniteurs.set(moniteurs);
      this.plongeursConnus.set(plongeursConnus);
      this.ficheId.set(fiche.id);
      this.entete.set({
        dpId: fiche.dpId, meteo: fiche.meteo, etatMer: fiche.etatMer, visibilite: fiche.visibilite,
        courant: fiche.courant, maree: fiche.maree, temperatureEau: fiche.temperatureEau,
        securiteSurface: fiche.securiteSurface, planSecours: fiche.planSecours,
        observations: fiche.observations
      });
      this.palanquees.set(fiche.palanquees.length > 0 ? fiche.palanquees : [palanqueeVide(1)]);
      this.retenirEtatEnregistre();

      const saisonOuverte = saisons.find(s => s.ouverte);
      if (saisonOuverte) {
        this.saisonId.set(saisonOuverte.id);
        this.groupes.set(await this.api.groupesPlongeurs(saisonOuverte.id).catch(() => []));
      }
    } catch {
      this.message.set(navigator.onLine
        ? 'Impossible de charger la fiche de sécurité.'
        : "Cette fiche n'est pas disponible hors ligne. Utilisez « Préparer hors ligne » avec du réseau, "
          + "avant de partir sur site, pour l'embarquer.");
    } finally {
      this.chargement.set(false);
    }
  }

  private numeroSuivantPalanquee(): number {
    return this.palanquees().length > 0 ? Math.max(...this.palanquees().map(p => p.numero)) + 1 : 1;
  }

  private ajouterPalanquee(profondeurPrevue: number, dureePrevue: number): void {
    this.palanquees.set([...this.palanquees(),
      { ...palanqueeVide(this.numeroSuivantPalanquee()), profondeurPrevue, dureePrevue }]);
  }

  // --- Fenêtre d'ajout : profil prévu d'une nouvelle palanquée, fonction d'un encadrant ----------

  readonly fonctionsEncadrant: { valeur: PlongeurVue['fonction']; libelle: string }[] = [
    { valeur: 'ENCADRANT', libelle: 'Encadrant' },
    { valeur: 'GUIDE_PALANQUEE', libelle: 'Guide de palanquée' },
    { valeur: 'PLONGEUR', libelle: 'Plongeur' }
  ];

  /** Les mêmes, dans l'ordre du sélecteur compact : le cas courant d'abord. */
  readonly fonctions = [...this.fonctionsEncadrant].reverse();

  /**
   * Fenêtre d'ajout, modifiée en place ; null : fermée. Elle ne pose que les
   * questions du cas rencontré (`questionsAjout`) :
   * - `profil` : profondeur et durée d'une nouvelle palanquée, null pour une palanquée existante ;
   * - `pour` : le membre du groupe à placer dans la nouvelle palanquée, « deplacement » pour le
   *   plongeur en cours de déplacement, null pour une palanquée vide ;
   * - `encadrant` : le plongeur dont on demande la fonction (déjà placé quand il n'y a pas de
   *   profil), null quand elle n'est pas demandée.
   */
  demandeAjout = signal<{
    profil: { profondeur: number | null; duree: number | null } | null;
    pour: MembreGroupeVue | 'deplacement' | null;
    encadrant: PlongeurVue | null;
    fonction: PlongeurVue['fonction'];
  } | null>(null);
  erreurDemandeAjout = signal<string | null>(null);

  titreDemandeAjout = computed(() => {
    const d = this.demandeAjout();
    if (!d || d.profil || !d.encadrant) return 'Nouvelle palanquée';
    return 'Fonction de ' + (`${d.encadrant.prenom} ${d.encadrant.nom}`.trim() || 'cet encadrant');
  });

  fermerDemandeAjout(): void {
    this.demandeAjout.set(null);
  }

  ouvrirNouvellePalanquee(pour: MembreGroupeVue | 'deplacement' | null): void {
    const plongeur = pour === 'deplacement' ? this.plongeurEnDeplacement() : pour ? versPlongeur(pour) : null;
    const questions = questionsAjout(true, plongeur);
    this.erreurDemandeAjout.set(null);
    this.demandeAjout.set({
      profil: { profondeur: null, duree: null }, pour,
      encadrant: questions.fonction ? plongeur : null, fonction: 'ENCADRANT'
    });
  }

  private plongeurEnDeplacement(): PlongeurVue | null {
    const d = this.plongeurADeplacer();
    return (d && this.palanquees()[d.palanquee]?.membres[d.membre]) || null;
  }

  creerNouvellePalanquee(): void {
    const n = this.demandeAjout();
    if (!n?.profil) return;
    const erreur = erreurProfilPrevu(n.profil.profondeur, n.profil.duree);
    if (erreur) {
      this.erreurDemandeAjout.set(erreur);
      return;
    }
    const profil = { profondeurPrevue: n.profil.profondeur!, dureePrevue: n.profil.duree! };
    const future = { ...palanqueeVide(this.numeroSuivantPalanquee()), ...profil };
    /** La fonction choisie dans la fenêtre, quand elle y était demandée. */
    const fonction = n.encadrant ? n.fonction : null;

    if (n.pour === 'deplacement') {
      const d = this.plongeurADeplacer();
      const m = this.plongeurEnDeplacement();
      const refus = m ? refusAjout(future, m) : null;
      if (refus) {
        this.erreurDemandeAjout.set(refus);
        return;
      }
      this.demandeAjout.set(null);
      this.plongeurADeplacer.set(null);
      if (!d || !m) return;
      const palanquees = fonction === null ? this.palanquees() : this.palanquees().map((p, i) => i !== d.palanquee ? p
        : { ...p, membres: p.membres.map((x, j) => j === d.membre ? { ...x, fonction } : x) });
      this.palanquees.set(deplacerPlongeur(palanquees, d.palanquee, d.membre, null, profil));
      return;
    }

    if (n.pour !== null) {
      const refus = refusAjout(future, versPlongeur(n.pour));
      if (refus) {
        this.erreurDemandeAjout.set(refus);
        return;
      }
    }
    this.demandeAjout.set(null);
    this.ajouterPalanquee(profil.profondeurPrevue, profil.dureePrevue);
    if (n.pour !== null) this.placer(n.pour, this.palanquees().length - 1, fonction);
  }

  // --- Fenêtre d'un plongeur, ouverte en touchant sa ligne ----------------------------------------

  /**
   * Plongeur dont la fenêtre est ouverte, repéré par ses indices : la
   * fenêtre est modale, rien d'autre ne bouge les palanquées pendant ce temps.
   */
  plongeurEnEdition = signal<{ palanquee: number; membre: number } | null>(null);
  erreurEdition = signal<string | null>(null);

  titreEdition(): string {
    const e = this.plongeurEnEdition();
    const m = e ? this.palanquees()[e.palanquee]?.membres[e.membre] : undefined;
    return m && !ligneVide(m) ? (`${m.prenom} ${m.nom}`.trim() || 'Plongeur') : 'Nouveau plongeur';
  }

  /** Un encadrant possible encore « Plongeur » : la fenêtre l'invite à choisir sa fonction. */
  fonctionADonner(m: PlongeurVue): boolean {
    return questionsAjout(false, m).fonction;
  }

  modifierPlongeur(indexPalanquee: number, indexMembre: number): void {
    this.membreAPlacer.set(null);
    this.plongeurADeplacer.set(null);
    this.erreurEdition.set(null);
    this.plongeurEnEdition.set({ palanquee: indexPalanquee, membre: indexMembre });
  }

  /** Un plongeur ajouté puis laissé sans rien saisir ne reste pas sur la fiche. */
  fermerEdition(): void {
    const e = this.plongeurEnEdition();
    if (!e) return;
    this.plongeurEnEdition.set(null);
    const m = this.palanquees()[e.palanquee]?.membres[e.membre];
    if (m && ligneVide(m)) this.retirerMembre(e.palanquee, e.membre);
    else this.palanquees.set([...this.palanquees()]);
  }

  deplacerDepuisEdition(): void {
    const e = this.plongeurEnEdition();
    this.plongeurEnEdition.set(null);
    if (e) this.choisirADeplacer(e.palanquee, e.membre);
  }

  retirerDepuisEdition(): void {
    const e = this.plongeurEnEdition();
    this.plongeurEnEdition.set(null);
    if (e) this.retirerMembre(e.palanquee, e.membre);
  }

  retirerPalanquee(index: number): void {
    this.plongeurADeplacer.set(null);
    const p = this.palanquees()[index];
    if (p.membres.some(m => m.nom || m.prenom)
        && !confirm(`Retirer ${nomPalanquee(p).replace(/^Palanquée/, 'la palanquée')} et ses plongeurs (${resumeComposition(p)}) ?`)) {
      return;
    }
    this.palanquees.set(this.palanquees().filter((_, i) => i !== index));
  }

  // --- Modifications non enregistrées ------------------------------------------------------------

  /** Empreinte du formulaire tel qu'enregistré (ou chargé) ; le comparer dit s'il reste à enregistrer. */
  private empreinteEnregistree: string | null = null;

  private retenirEtatEnregistre(): void {
    this.empreinteEnregistree = empreinteFiche(this.entete() ?? {}, this.palanquees());
  }

  /**
   * Méthode et non computed : le formulaire modifie l'en-tête et les
   * plongeurs en place, sans passer par les signaux. Sans le droit d'établir
   * la fiche, rien n'est à enregistrer.
   */
  modificationsNonEnregistrees(): boolean {
    if (!this.auth.etablitFichesSecurite() || this.empreinteEnregistree === null) return false;
    return empreinteFiche(this.entete() ?? {}, this.palanquees()) !== this.empreinteEnregistree;
  }

  // --- Bouton rond du téléphone ------------------------------------------------------------------

  menuActionsOuvert = signal(false);

  @HostListener('document:keydown.escape')
  fermerMenuActions(): void {
    this.menuActionsOuvert.set(false);
  }

  /** Fermer l'onglet ou recharger la page : le navigateur demande confirmation. */
  @HostListener('window:beforeunload', ['$event'])
  avantFermeture(evenement: BeforeUnloadEvent): void {
    if (this.modificationsNonEnregistrees()) evenement.preventDefault();
  }

  // --- Impression --------------------------------------------------------------------------------

  impressionEnCours = signal(false);

  /**
   * La fiche enregistrée sur le serveur, avec l'autre plongée de sa feuille
   * (même modèle que « Télécharger le PDF » au retour de plongée). Des
   * modifications pas encore enregistrées n'y seraient pas : on le dit.
   */
  imprimer(): void {
    if (this.modificationsNonEnregistrees() || this.enAttente()) {
      this.message.set("Enregistrez d'abord la fiche (avec du réseau) : le PDF imprime la fiche enregistrée.");
      return;
    }
    this.impressionEnCours.set(true);
    this.api.ficheSecuritePdf(this.seanceId).subscribe({
      next: blob => {
        telechargerFichier(blob, `fiche-securite-${this.seance()?.date ?? this.seanceId}.pdf`);
        this.impressionEnCours.set(false);
      },
      error: async (e: HttpErrorResponse) => {
        this.impressionEnCours.set(false);
        this.message.set(await detailErreurFichier(e) ?? (navigator.onLine
          ? "Le PDF de la fiche n'a pas pu être généré."
          : 'Impression impossible hors ligne : reconnectez-vous pour générer le PDF.'));
      }
    });
  }

  /** Le nouveau plongeur s'ouvre aussitôt dans sa fenêtre, recherche dans le club en tête. */
  ajouterMembre(indexPalanquee: number): void {
    const liste = this.palanquees().map((p, i) =>
      i === indexPalanquee ? { ...p, membres: [...p.membres, plongeurVide()] } : p);
    this.palanquees.set(liste);
    this.modifierPlongeur(indexPalanquee, liste[indexPalanquee].membres.length - 1);
  }

  retirerMembre(indexPalanquee: number, indexMembre: number): void {
    this.plongeurADeplacer.set(null);
    const liste = this.palanquees().map((p, i) =>
      i === indexPalanquee ? { ...p, membres: p.membres.filter((_, j) => j !== indexMembre) } : p);
    this.palanquees.set(liste);
  }

  /**
   * Dépose dans une palanquée : soit une copie d'un membre du pool (le groupe
   * reste intact, réutilisable sur d'autres fiches), soit un déplacement ou
   * réordonnancement entre palanquées de plongeurs déjà saisis sur cette fiche.
   */
  /** Au doigt, le glisser ne démarre qu'après un appui long : un simple balayage fait défiler la page. */
  readonly delaiGlisser = { touch: 400, mouse: 0 };

  /** Plongeur du groupe touché, en attente du choix de sa palanquée (alternative au glisser-déposer). */
  membreAPlacer = signal<MembreGroupeVue | null>(null);

  /** « LACUES » → « L. » : assez pour distinguer deux prénoms identiques sur une petite puce. */
  initiale(nom: string): string {
    const n = (nom ?? '').trim();
    return n ? n[0].toUpperCase() + '.' : '';
  }

  selectionnerPourPlacer(m: MembreGroupeVue): void {
    this.plongeurADeplacer.set(null);
    this.membreAPlacer.set(this.membreAPlacer() === m ? null : m);
  }

  /**
   * Plongeur déjà sur la fiche, touché pour changer de palanquée (sans
   * glisser, plus sûr au doigt). Repéré par ses indices : toute autre
   * modification des palanquées referme le choix.
   */
  plongeurADeplacer = signal<{ palanquee: number; membre: number } | null>(null);

  estADeplacer(indexPalanquee: number, indexMembre: number): boolean {
    const d = this.plongeurADeplacer();
    return d !== null && d.palanquee === indexPalanquee && d.membre === indexMembre;
  }

  choisirADeplacer(indexPalanquee: number, indexMembre: number): void {
    this.membreAPlacer.set(null);
    this.plongeurADeplacer.set(this.estADeplacer(indexPalanquee, indexMembre)
      ? null : { palanquee: indexPalanquee, membre: indexMembre });
  }

  nomADeplacer(): string {
    const d = this.plongeurADeplacer();
    const m = d ? this.palanquees()[d.palanquee]?.membres[d.membre] : undefined;
    return m ? (`${m.prenom} ${m.nom}`.trim() || 'Ce plongeur') : '';
  }

  /** Vers la palanquée d'indice `cible`, ou une nouvelle si null. */
  deplacerVers(cible: number | null): void {
    const d = this.plongeurADeplacer();
    this.plongeurADeplacer.set(null);
    const plongeur = d ? this.palanquees()[d.palanquee]?.membres[d.membre] : undefined;
    if (!d || !plongeur) return;
    const refus = cible !== null ? refusAjout(this.palanquees()[cible], plongeur) : null;
    if (refus) {
      this.message.set(refus);
      return;
    }
    this.palanquees.set(deplacerPlongeur(this.palanquees(), d.palanquee, d.membre, cible));
  }

  /** `fonction` : déjà choisie dans la fenêtre de la nouvelle palanquée, elle ne se redemande pas. */
  placer(m: MembreGroupeVue, indexPalanquee: number, fonction: PlongeurVue['fonction'] | null = null): void {
    const palanquee = this.palanquees()[indexPalanquee];
    this.ajouterDepuisGroupe(m, indexPalanquee, palanquee.membres.length, fonction);
    this.membreAPlacer.set(null);
  }

  /**
   * Copie un membre du groupe dans une palanquée : le groupe reste intact,
   * réutilisable sur d'autres fiches. Refusé (message) si son aptitude ne
   * permet pas la profondeur prévue.
   */
  private ajouterDepuisGroupe(source: MembreGroupeVue, indexPalanquee: number, position: number,
                              fonction: PlongeurVue['fonction'] | null = null): void {
    const nouveau = fonction === null ? versPlongeur(source) : { ...versPlongeur(source), fonction };
    const refus = refusAjout(this.palanquees()[indexPalanquee], nouveau);
    if (refus) {
      this.message.set(refus);
      return;
    }
    const liste = this.palanquees().map((p, i) => {
      if (i !== indexPalanquee) return p;
      const membres = [...p.membres];
      membres.splice(position, 0, nouveau);
      return { ...p, membres };
    });
    this.palanquees.set(liste);
    this.demanderFonctionSiEncadrant(nouveau);
  }

  // --- Fonction d'un encadrant ajouté à une palanquée existante --------------------------------

  /** Un encadrant ajouté encore « Plongeur » : on demande sa fonction plutôt que de la laisser par défaut. */
  private demanderFonctionSiEncadrant(m: PlongeurVue): void {
    if (!questionsAjout(false, m).fonction) return;
    this.erreurDemandeAjout.set(null);
    this.demandeAjout.set({ profil: null, pour: null, encadrant: m, fonction: 'PLONGEUR' });
  }

  /** Par l'objet lui-même : entre-temps, il a pu être glissé ailleurs ou changer de rang. */
  choisirFonction(fonction: PlongeurVue['fonction']): void {
    const cible = this.demandeAjout()?.encadrant;
    this.demandeAjout.set(null);
    if (!cible) return;
    this.palanquees.set(this.palanquees().map(p => p.membres.includes(cible)
      ? { ...p, membres: p.membres.map(m => m === cible ? { ...m, fonction } : m) }
      : p));
  }

  onDropPalanquee(event: CdkDragDrop<PlongeurVue[]>, indexPalanquee: number): void {
    this.plongeurADeplacer.set(null);
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.palanquees.set([...this.palanquees()]);
      return;
    }

    if (event.previousContainer.id === 'pool') {
      this.ajouterDepuisGroupe(event.item.data as MembreGroupeVue, indexPalanquee, event.currentIndex);
      this.membreAPlacer.set(null);
      return;
    }

    const refus = refusAjout(this.palanquees()[indexPalanquee],
      (event.previousContainer.data as PlongeurVue[])[event.previousIndex]);
    if (refus) {
      this.message.set(refus);
      return;
    }
    transferArrayItem(event.previousContainer.data as PlongeurVue[], event.container.data as PlongeurVue[],
      event.previousIndex, event.currentIndex);
    this.palanquees.set([...this.palanquees()]);
  }

  /** Capture les plongeurs actuellement saisis sur cette fiche comme groupe nommé, réutilisable ensuite. */
  creerGroupe(): void {
    const saisonId = this.saisonId();
    if (!saisonId) {
      this.message.set('Aucune saison ouverte : impossible de créer un groupe.');
      return;
    }
    if (!this.nomNouveauGroupe().trim()) {
      this.message.set('Le nom du groupe est obligatoire.');
      return;
    }

    const membres: MembreGroupeVue[] = [];
    for (const p of this.palanquees()) {
      for (const m of p.membres) {
        if (!m.nom && !m.prenom) continue;
        if (membres.some(x => memePlongeur(x, m))) continue;
        membres.push({
          eleveId: m.eleveId, utilisateurId: m.utilisateurId, nom: m.nom, prenom: m.prenom,
          ...separerAptitude(m.aptitude), qualificationPreparee: m.qualificationPreparee
        });
      }
    }

    this.envoiGroupe.set(true);
    this.api.creerGroupePlongeurs({ nom: this.nomNouveauGroupe(), saisonId, membres: [...membres.values()] })
      .subscribe({
        next: groupe => {
          this.envoiGroupe.set(false);
          this.groupes.set([...this.groupes(), groupe]);
          this.groupeSelectionneId.set(groupe.id);
          this.creationGroupeOuverte.set(false);
          this.nomNouveauGroupe.set('');
          this.message.set('Groupe créé.');
        },
        error: (e: HttpErrorResponse) => {
          this.envoiGroupe.set(false);
          this.message.set(e.error?.detail ?? "La création du groupe a échoué.");
        }
      });
  }

  supprimerGroupeCourant(): void {
    const id = this.groupeSelectionneId();
    if (!id) return;
    if (!confirm('Supprimer ce groupe de plongeurs ? Les fiches déjà établies ne sont pas modifiées.')) return;
    this.api.supprimerGroupePlongeurs(id).subscribe({
      next: () => {
        this.groupes.set(this.groupes().filter(g => g.id !== id));
        this.groupeSelectionneId.set(null);
      },
      error: () => this.message.set('La suppression du groupe a échoué.')
    });
  }

  /** « Séance 2 — Carrière de Blaisy · La Vierge » : les séances liées sont du même jour, le rang suffit. */
  libelleSeance(s: { ordre: number | null; lieu: string | null; site: string | null }): string {
    const ou = lieuEtSite(s);
    return `Séance ${s.ordre ?? 1}${ou ? ' — ' + ou : ''}`;
  }

  /**
   * « Milieu naturel · 20 m max · Bateau 2 · fiche établie » : de quoi
   * distinguer deux séances du même jour au même endroit.
   */
  detailsSeance(seanceId: number): string {
    const s = this.toutesSeances().find(x => x.id === seanceId);
    if (!s) return '';
    return [
      s.milieu === 'NATUREL' ? 'Milieu naturel' : 'Milieu artificiel',
      s.profondeurMax ? s.profondeurMax + ' m max' : null,
      s.commentaire?.trim() || null,
      s.ficheSecurite ? 'fiche établie' : 'sans fiche'
    ].filter(v => v).join(' · ');
  }

  /** La séance choisie dans la liste, détaillée sous celle-ci avant de confirmer le lien. */
  seanceChoisiePourLien = computed(() =>
    this.toutesSeances().find(s => s.id === this.seanceALier()) ?? null);

  /** Lier demande le réseau : la fiche liée doit être lue sur le serveur. */
  lier(): void {
    const autre = this.seanceALier();
    if (!autre) return;
    this.envoiLiaison.set(true);
    this.api.lierSeance(this.seanceId, autre).subscribe({
      next: f => {
        this.envoiLiaison.set(false);
        this.seancesLiees.set(f.seancesLiees);
        this.seanceALier.set(null);
        this.message.set('Séances liées : les plongeurs déjà placés sur l\'autre fiche ne sont plus proposés.');
      },
      error: (e: HttpErrorResponse) => {
        this.envoiLiaison.set(false);
        this.message.set(e.error?.detail ?? 'Impossible de lier les séances (réseau nécessaire).');
      }
    });
  }

  delier(): void {
    this.envoiLiaison.set(true);
    this.api.delierSeance(this.seanceId).subscribe({
      next: f => {
        this.envoiLiaison.set(false);
        this.seancesLiees.set(f.seancesLiees);
        this.message.set('Cette séance n\'est plus liée.');
      },
      error: (e: HttpErrorResponse) => {
        this.envoiLiaison.set(false);
        this.message.set(e.error?.detail ?? 'Impossible de délier la séance (réseau nécessaire).');
      }
    });
  }

  /** Formulaire de « Dupliquer et lier », modifié en place ; null quand la fenêtre est fermée. */
  duplication = signal<FormulaireDuplication | null>(null);
  erreurDuplication = signal<string | null>(null);
  envoiDuplication = signal(false);
  /** Les palanquées de la fiche enregistrée sur le serveur : ce sont elles que la duplication déplace. */
  palanqueesEnregistrees = signal<PalanqueeVue[]>([]);

  /** N° de plongée proposé pour la copie : le suivant du dernier de la journée. */
  numeroSuivant(): number {
    const jour = this.seance()?.date;
    const numeros = this.toutesSeances().filter(s => s.date === jour).map(s => s.ordre ?? 1);
    return (numeros.length > 0 ? Math.max(...numeros) : 0) + 1;
  }

  async ouvrirDuplication(): Promise<void> {
    if (this.enAttente()) {
      this.message.set("Une version de cette fiche attend le réseau : dupliquez la séance une fois qu'elle est partie.");
      return;
    }
    if (this.modificationsNonEnregistrees()) {
      this.message.set("Enregistrez d'abord la fiche : la duplication part de la fiche enregistrée.");
      return;
    }
    this.erreurDuplication.set(null);
    this.palanqueesEnregistrees.set([]);
    this.duplication.set({
      dpId: null, ordre: this.numeroSuivant(),
      info: null, infoOrigine: this.seance()?.commentaire ?? null, palanquees: []
    });
    try {
      this.palanqueesEnregistrees.set((await this.api.ficheSecurite(this.seanceId)).palanquees);
    } catch {
      this.erreurDuplication.set('Impossible de lire la fiche enregistrée (réseau nécessaire).');
    }
  }

  basculerPalanqueeDupliquee(numero: number): void {
    const d = this.duplication();
    if (!d) return;
    d.palanquees = d.palanquees.includes(numero)
      ? d.palanquees.filter(n => n !== numero)
      : [...d.palanquees, numero].sort((a, b) => a - b);
  }

  /** « Anne A., Bruno B. · 20 m » : de quoi reconnaître une palanquée dans la liste à cocher. */
  resumePalanquee(p: PalanqueeVue): string {
    const noms = p.membres.map(m => `${m.prenom} ${this.initiale(m.nom)}`.trim()).filter(n => n).join(', ');
    return [noms || 'sans plongeur', p.profondeurPrevue ? p.profondeurPrevue + ' m' : null]
      .filter(v => v).join(' · ');
  }

  /** Réseau nécessaire : la séance, sa fiche et le lien sont créés ensemble par le serveur. */
  dupliquer(): void {
    const d = this.duplication();
    if (!d) return;
    if (!d.dpId) {
      this.erreurDuplication.set('Choisissez le directeur de plongée de la nouvelle séance.');
      return;
    }
    const demande: DemandeDuplicationSeance = {
      dpId: d.dpId, ordre: d.ordre || null, palanquees: d.palanquees,
      info: d.info?.trim() || null,
      // Une chaîne vide efface l'info de cette séance ; null la laisserait inchangée.
      infoOrigine: d.infoOrigine?.trim() ?? ''
    };
    this.envoiDuplication.set(true);
    this.erreurDuplication.set(null);
    this.api.dupliquerSeance(this.seanceId, demande).subscribe({
      next: async r => {
        this.envoiDuplication.set(false);
        this.duplication.set(null);
        await this.charger();
        this.message.set(`Séance n° ${r.ordre} créée et liée : ouvrez sa fiche depuis « Liée à ».`);
      },
      error: (e: HttpErrorResponse) => {
        this.envoiDuplication.set(false);
        this.erreurDuplication.set(e.error?.detail ?? 'Impossible de dupliquer la séance (réseau nécessaire).');
      }
    });
  }

  // --- Reprendre une palanquée d'une autre séance ------------------------------------------------

  repriseOuverte = signal(false);
  erreurReprise = signal<string | null>(null);
  seanceAReprendre = signal<number | null>(null);
  chargementReprise = signal(false);
  palanqueesAReprendre = signal<PalanqueeVue[]>([]);
  palanqueesCochees = signal<Set<number>>(new Set());

  /** Les autres séances dont la fiche est établie, la plus récente en tête. */
  seancesAReprendre = computed<OptionCombobox[]>(() => this.toutesSeances()
    .filter(s => s.ficheSecurite && s.id !== this.seanceId)
    .sort((a, b) => b.date.localeCompare(a.date) || a.ordre - b.ordre)
    .map(s => ({ id: s.id, libelle: `${dateFr(s.date)} — ${this.libelleSeance(s)}`, detail: this.detailsSeance(s.id) })));

  ouvrirReprise(): void {
    this.erreurReprise.set(null);
    this.seanceAReprendre.set(null);
    this.palanqueesAReprendre.set([]);
    this.palanqueesCochees.set(new Set());
    this.repriseOuverte.set(true);
  }

  /** La fiche lue retombe sur le cache hors ligne : on reprend aussi sur site une fiche embarquée. */
  async choisirSeanceAReprendre(id: number | null): Promise<void> {
    this.seanceAReprendre.set(id);
    this.palanqueesAReprendre.set([]);
    this.palanqueesCochees.set(new Set());
    this.erreurReprise.set(null);
    if (id === null) return;
    this.chargementReprise.set(true);
    try {
      const fiche = await this.api.ficheSecurite(id);
      if (this.seanceAReprendre() === id) this.palanqueesAReprendre.set(fiche.palanquees);
    } catch {
      this.erreurReprise.set(navigator.onLine
        ? 'Impossible de lire la fiche de cette séance.'
        : "La fiche de cette séance n'est pas disponible hors ligne.");
    } finally {
      this.chargementReprise.set(false);
    }
  }

  basculerPalanqueeReprise(numero: number): void {
    const cochees = new Set(this.palanqueesCochees());
    if (cochees.has(numero)) cochees.delete(numero); else cochees.add(numero);
    this.palanqueesCochees.set(cochees);
  }

  reprendre(): void {
    const reprises = this.palanqueesAReprendre().filter(p => this.palanqueesCochees().has(p.numero));
    if (reprises.length === 0) return;
    this.plongeurADeplacer.set(null);
    this.palanquees.set(reprendrePalanquees(this.palanquees(), reprises));
    this.repriseOuverte.set(false);
    this.message.set(reprises.length > 1
      ? `${reprises.length} palanquées reprises : relisez-les, ajustez le profil prévu si besoin, puis enregistrez la fiche.`
      : 'Palanquée reprise : relisez-la, ajustez le profil prévu si besoin, puis enregistrez la fiche.');
  }

  /** Avertissement d'affichage : le même plongeur placé aussi sur une fiche liée. */
  aussiSurFicheLiee(m: PlongeurVue): string | null {
    if (!m.nom && !m.prenom && m.eleveId === null && m.utilisateurId === null) return null;
    const ailleurs = this.placeSurFicheLiee(m);
    return ailleurs ? `Aussi placé sur la fiche liée (${ailleurs}).` : null;
  }

  /**
   * L'ajout d'un plongeur au-delà de son aptitude est refusé (refusAjout) ;
   * reste à signaler celui dont l'aptitude ou la profondeur prévue a changé
   * après coup : le DP corrige, rien n'est bloqué à l'enregistrement.
   */
  alerteProfondeur(p: PalanqueeVue, m: PlongeurVue): string | null {
    if (!p.profondeurPrevue) return null;
    const max = profondeurPermise(m);
    if (max === null || p.profondeurPrevue <= max) return null;
    return `${m.aptitude} limite ${max} m, palanquée prévue à ${p.profondeurPrevue} m.`;
  }

  /**
   * Libellé affiché dans la combobox (liste native `<datalist>`, filtrable au
   * clavier — plus praticable qu'un <select> une fois le club bien fourni).
   * L'identifiant entre parenthèses est retrouvé par choisirPlongeurConnu :
   * un simple appariement sur le texte affiché serait ambigu en cas
   * d'homonymie.
   */
  libellePlongeurConnu(c: PlongeurConnuVue): string {
    const type = c.eleveId !== null ? 'ELEVE:' + c.eleveId : 'ENCADRANT:' + c.utilisateurId;
    return `${c.prenom} ${c.nom}${c.aptitude ? ' — ' + c.aptitude : ''} (${type})`;
  }

  /**
   * Pré-remplit nom/prénom/aptitude/qualification depuis le dossier du
   * plongeur choisi dans sa fenêtre, éditable ensuite. Un encadrant n'ouvre
   * pas une seconde fenêtre : la sienne l'invite à choisir sa fonction.
   */
  choisirPlongeurConnu(indexPalanquee: number, indexMembre: number, event: Event): void {
    const champ = event.target as HTMLInputElement;
    const correspondance = champ.value.match(/\((ELEVE|ENCADRANT):(\d+)\)\s*$/);
    if (!correspondance) return;
    const [, type, idTexte] = correspondance;
    const id = Number(idTexte);
    const candidat = this.plongeursConnus().find(c =>
      (type === 'ELEVE' && c.eleveId === id) || (type === 'ENCADRANT' && c.utilisateurId === id));
    champ.value = '';
    if (!candidat) return;

    const choisi: PlongeurVue = {
      ...this.palanquees()[indexPalanquee].membres[indexMembre],
      eleveId: candidat.eleveId, utilisateurId: candidat.utilisateurId,
      nom: candidat.nom, prenom: candidat.prenom,
      aptitude: candidat.aptitude, qualificationPreparee: candidat.qualificationPreparee
    };
    const refus = refusAjout(this.palanquees()[indexPalanquee], choisi);
    this.erreurEdition.set(refus);
    if (refus) return;
    const liste = this.palanquees().map((p, i) => i !== indexPalanquee ? p : {
      ...p, membres: p.membres.map((m, j) => j !== indexMembre ? m : choisi)
    });
    this.palanquees.set(liste);
  }

  // --- Proposition automatique des palanquées (milieu naturel) -----------------------------------

  propositionOuverte = signal(false);
  erreurProposition = signal<string | null>(null);
  envoiProposition = signal(false);
  criteres = signal<CriteresProposition | null>(null);
  /** Membres du groupe soumis à la proposition, figés à l'ouverture : les paires s'y réfèrent par indice. */
  proposables = signal<MembreGroupeVue[]>([]);
  encadrantsCoches = signal<Set<number>>(new Set());
  paires = signal<{ a: number; b: number; ensemble: boolean }[]>([]);
  paireA = signal<number | null>(null);
  paireB = signal<number | null>(null);
  bilanProposition = signal<PropositionPalanqueesVue | null>(null);

  /** Indices des membres qui peuvent encadrer : compte moniteur ou aptitude d'encadrant. */
  encadrantsPossibles = computed(() => this.proposables()
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => estEncadrantPossible({ utilisateurId: m.utilisateurId, aptitude: aptitudeSurFiche(m) }))
    .map(({ i }) => i));

  /**
   * Toute la composition du groupe est proposée (sauf les plongeurs déjà sur
   * une fiche liée) : la proposition remplace les palanquées du formulaire.
   */
  ouvrirProposition(): void {
    const groupe = this.groupeSelectionne();
    if (!groupe) return;
    this.proposables.set(groupe.membres.filter(m => this.placeSurFicheLiee(m) === null));
    this.encadrantsCoches.set(new Set(this.encadrantsPossibles()));
    this.paires.set([]);
    this.paireA.set(null);
    this.paireB.set(null);
    this.criteres.set({
      profondeur: this.seance()?.profondeurMax ?? 20, type: 'EXPLORATION', maxPlongeurs: 4,
      autonomesEnsemble: true, regrouperParNiveau: true
    });
    this.erreurProposition.set(null);
    this.propositionOuverte.set(true);
  }

  libelleProposable(i: number): string {
    const m = this.proposables()[i];
    if (!m) return '';
    const aptitude = aptitudeSurFiche(m);
    return `${m.prenom} ${m.nom}${aptitude ? ' (' + aptitude + ')' : ''}`;
  }

  aptitudeSurFiche = aptitudeSurFiche;

  basculerEncadrant(i: number): void {
    const coches = new Set(this.encadrantsCoches());
    if (coches.has(i)) coches.delete(i); else coches.add(i);
    this.encadrantsCoches.set(coches);
  }

  ajouterPaire(ensemble: boolean): void {
    const a = this.paireA(), b = this.paireB();
    if (a === null || b === null || a === b) {
      this.erreurProposition.set('Choisissez deux plongeurs différents.');
      return;
    }
    this.erreurProposition.set(null);
    this.paires.set([...this.paires(), { a, b, ensemble }]);
    this.paireA.set(null);
    this.paireB.set(null);
  }

  retirerPaire(index: number): void {
    this.paires.set(this.paires().filter((_, i) => i !== index));
  }

  /** Le calcul est fait par le serveur : réseau nécessaire. */
  proposer(): void {
    const c = this.criteres();
    if (!c) return;
    const demande: DemandePropositionPalanquees = {
      ...c,
      plongeurs: this.proposables().map((m, i) => ({
        eleveId: m.eleveId, utilisateurId: m.utilisateurId, nom: m.nom, prenom: m.prenom,
        aptitude: aptitudeSurFiche(m), qualificationPreparee: m.qualificationPreparee,
        encadrant: this.encadrantsCoches().has(i)
      })),
      ensemble: this.paires().filter(p => p.ensemble).map(p => [p.a, p.b] as [number, number]),
      separes: this.paires().filter(p => !p.ensemble).map(p => [p.a, p.b] as [number, number])
    };
    this.envoiProposition.set(true);
    this.erreurProposition.set(null);
    this.api.proposerPalanquees(this.seanceId, demande).subscribe({
      next: r => {
        this.envoiProposition.set(false);
        const dejaSaisies = this.palanquees().some(p => p.membres.some(m => m.nom || m.prenom));
        if (dejaSaisies && !confirm('Remplacer les palanquées déjà saisies sur cette fiche par la proposition ?')) {
          return;
        }
        this.palanquees.set(r.palanquees.length > 0 ? r.palanquees : [palanqueeVide(1)]);
        this.bilanProposition.set(r);
        this.plongeurADeplacer.set(null);
        this.propositionOuverte.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.envoiProposition.set(false);
        this.erreurProposition.set(e.error?.detail
          ?? 'La proposition demande le réseau : réessayez une fois connecté.');
      }
    });
  }

  /** Établissement : DP, conditions, composition des palanquées et profil prévu. */
  /**
   * Hors ligne (ou serveur injoignable), la fiche est gardée sur l'appareil
   * et part au retour du réseau : on peut composer les palanquées sur site.
   */
  async enregistrer(): Promise<void> {
    const f = this.entete();
    if (!f?.dpId) {
      this.message.set('Le directeur de plongée est obligatoire.');
      return;
    }
    const { palanquees, erreur } = palanqueesAEnregistrer(this.palanquees());
    if (erreur) {
      this.message.set(erreur);
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    try {
      const issue = await this.file.enregistrer<FicheSecuriteVue>({
        type: 'fiche', seanceId: this.seanceId, demande: {
          dpId: f.dpId,
          meteo: f.meteo, etatMer: f.etatMer, visibilite: f.visibilite,
          courant: f.courant, maree: f.maree, temperatureEau: f.temperatureEau,
          securiteSurface: f.securiteSurface, planSecours: f.planSecours,
          observations: f.observations,
          palanquees: palanquees.map(p => ({
            numero: p.numero, profondeurPrevue: p.profondeurPrevue, dureePrevue: p.dureePrevue,
            membres: p.membres
          }))
        }
      }, 'Fiche de sécurité', this.seance()?.date ?? dateDuJour());

      if (issue.etat === 'envoyee') {
        this.ficheId.set(issue.reponse.id);
        this.palanquees.set(issue.reponse.palanquees);
        this.retenirEtatEnregistre();
        this.enAttente.set(this.file.pourSeance(this.seanceId, 'realise').length > 0);
        this.message.set('Fiche enregistrée.');
      } else if (issue.etat === 'en-attente') {
        this.retenirEtatEnregistre();
        this.enAttente.set(true);
        this.message.set("Hors ligne : fiche gardée sur l'appareil. Elle partira au retour du réseau.");
      } else {
        this.message.set(issue.raison);
      }
    } catch {
      this.message.set("L'enregistrement de la fiche a échoué.");
    } finally {
      this.envoi.set(false);
    }
  }

}
