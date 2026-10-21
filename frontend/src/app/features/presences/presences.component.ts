import {
  Component, ElementRef, OnDestroy, computed, inject, input, signal, viewChild, ChangeDetectionStrategy
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { libellePreparation } from '../../core/niveaux';
import { ApiService } from '../../core/api.service';
import { ReseauService } from '../../core/reseau.service';
import { FileEcrituresService } from '../../core/file-ecritures.service';
import { FileAttenteService } from '../../core/file-attente.service';
import { dateDansJours, dateDuJour, dateFr } from '../../core/date-fr';
import { PlurielPipe } from '../../core/pluriel';
import {
  ExerciceVue, GroupeEntrainementVue, LignePresence, ProgressionVue, SeanceVue
} from '../../core/modeles';
import { RouterLink } from '@angular/router';
import { FiltreGroupe, FiltreGroupeComponent, passeFiltreGroupe } from '../../core/filtre-groupe.component';
import { CalendrierSeancesComponent } from '../../core/calendrier-seances.component';
import { lieuEtSite } from '../../core/seance-lieu';
import { AvatarComponent } from '../../core/avatar.component';
import { ProgrammeSeanceComponent } from '../../core/programme-seance.component';
import { AuthService } from '../../core/auth.service';
import { NotationGroupeeComponent } from './notation-groupee.component';
import { PastillePhaseComponent, libellePhase } from '../../core/phase-exercice';
import { SchemaExerciceComponent } from '../../core/schema-exercice.component';

/** Un bouton de la ligne : ce qu'a fait un élève présent. */
interface Choix {
  cle: 'NAGE' | 'BLOC' | 'THEORIE';
  libelle: string;
  classe: string;
}

/**
 * Pas de bouton « Absent » : un élève sans choix est absent. Plongée, Excusé et
 * Absent ne sont plus proposés ; une saisie ancienne de ce type reste affichée.
 * Nage et bloc s'excluent ; la théorie s'ajoute à l'un ou l'autre, ou se fait seule.
 */
const CHOIX: Choix[] = [
  { cle: 'NAGE', libelle: 'Nage', classe: 'present' },
  { cle: 'BLOC', libelle: 'Bloc', classe: 'present' },
  { cle: 'THEORIE', libelle: 'Théorie', classe: 'present' }
];

type EtatPresence = Pick<LignePresence, 'statut' | 'atelier' | 'theorie'>;

/** Nage ou bloc fait par un élève présent, sinon null. */
function eauDe(l: LignePresence): 'NAGE' | 'BLOC' | null {
  return l.statut === 'PRESENT' && (l.atelier === 'NAGE' || l.atelier === 'BLOC') ? l.atelier : null;
}

/** Théorie faite, seule ou en plus ; une saisie gardée avant l'ajout de la case n'a que l'atelier. */
function theorieDe(l: LignePresence): boolean {
  return l.statut === 'PRESENT' && (l.atelier === 'THEORIE' || !!l.theorie);
}

function estActif(l: LignePresence, c: Choix): boolean {
  return c.cle === 'THEORIE' ? theorieDe(l) : eauDe(l) === c.cle;
}

/**
 * L'état après un toucher : le choix actif s'efface, l'autre s'ajoute. Sans
 * nage ni bloc, la théorie seule reste l'atelier THEORIE ; sans rien, absent.
 */
function apresToucher(l: LignePresence, c: Choix): EtatPresence {
  let eau = eauDe(l);
  let theorie = theorieDe(l);
  if (c.cle === 'THEORIE') theorie = !theorie;
  else eau = eau === c.cle ? null : c.cle;
  if (eau) return { statut: 'PRESENT', atelier: eau, theorie };
  if (theorie) return { statut: 'PRESENT', atelier: 'THEORIE', theorie: true };
  return { statut: null, atelier: null, theorie: false };
}

function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/**
 * Feuille de présence d'une séance : ce que chaque élève a fait (nage ou bloc,
 * avec ou sans théorie, ou théorie seule) ; sans choix, il est absent. Remplace la grille de dates en
 * colonnes du tableur ; les compteurs « séances bloc / nage » de Infos élèves
 * en découlent. Enregistrement immédiat à chaque toucher ; hors ligne, le
 * choix est gardé sur l'appareil ({@link FileEcrituresService}) et part au
 * retour du réseau.
 *
 * Sur téléphone, les boutons de choix ne tiennent pas sur chaque carte sans
 * forcer une seule carte par ligne : on les remplace par une barre en bas
 * d'écran, ouverte en touchant la carte, ce qui laisse plusieurs élèves par
 * ligne (voir le média-query 600px plus bas).
 */
@Component({
  selector: 'app-presences',
  imports: [FormsModule, RouterLink, AvatarComponent, CalendrierSeancesComponent, ProgrammeSeanceComponent, FiltreGroupeComponent,
            NotationGroupeeComponent, PastillePhaseComponent, SchemaExerciceComponent, PlurielPipe],
  template: `
    <!-- L'aide de l'écran est « Comment faire ? », dans la barre de page (manuel « Faire l'appel »). -->
    <div class="titre">
      <h1>Présences</h1>
    </div>

    @if (!reseau.enLigne()) {
      <div class="alerte" role="status">
        Hors ligne : vos choix sont gardés sur l'appareil et partiront au retour du réseau.
      </div>
    }
    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <label for="seance">Séance</label>
    <button id="seance" type="button" class="choix-seance" aria-haspopup="dialog" (click)="ouvrirDialogueSeance()">
      <span class="icone-calendrier" aria-hidden="true">📅</span>
      <span class="libelle-choix">{{ seanceChoisie() ? libelleSeance(seanceChoisie()!) : 'Choisir une séance' }}</span>
      <span class="changer">Changer</span>
    </button>

    <dialog #dialogueSeance class="dialogue-seance" aria-labelledby="titre-dialogue-seance"
            (close)="dialogueSeanceOuvert.set(false)">
      @if (dialogueSeanceOuvert()) {
        <div class="entete-dialogue">
          <h2 id="titre-dialogue-seance">Choisir la séance</h2>
          <button type="button" class="bouton-discret" (click)="fermerDialogueSeance()">Fermer</button>
        </div>
        <app-calendrier-seances [seances]="seances()" [jourMax]="jourMax"
                                [seanceMarquee]="seanceId()"
                                [jourSelectionne]="jourDialogue()"
                                (jourSelectionneChange)="toucherJour($event)" />
        @if (jourDialogue(); as j) {
          @let duJour = seancesDuJour(j);
          @if (duJour.length === 0) {
            <p class="secondaire aucune">Aucune séance ce jour-là.</p>
          } @else {
            <ul class="seances-du-jour">
              @for (s of duJour; track s.id) {
                <li>
                  <button type="button" class="bouton-discret" [class.actif]="s.id === seanceId()"
                          (click)="choisirDepuisDialogue(s)">
                    {{ libelleSeance(s) }}
                    <span class="milieu">{{ s.milieu === 'NATUREL' ? 'Milieu naturel' : 'Piscine / fosse' }}</span>
                  </button>
                </li>
              }
            </ul>
          }
        }
      }
    </dialog>

    @if (seanceChoisie(); as s) {
      <div class="programme">
        <app-programme-seance [progressions]="progressionsAffichees()" [date]="s.date"/>
      </div>

      <section class="exercices" aria-label="Exercices de la séance">
        <div class="entete-exercices">
          <h2>
            <button type="button" class="bascule-exercices" aria-controls="contenu-exercices"
                    [attr.aria-expanded]="exercicesOuverts()" (click)="exercicesOuverts.set(!exercicesOuverts())">
              <span class="fleche" aria-hidden="true">{{ exercicesOuverts() ? '▾' : '▸' }}</span>
              Exercices de la séance
              @if (exercicesAffiches().length > 0) {
                <span class="secondaire compte-exercices">({{ exercicesAffiches().length }})</span>
              }
            </button>
          </h2>
          <a class="bouton-discret" [routerLink]="['/seances', s.id, 'programme']"
             [queryParams]="lienProgramme()">
            Préparer le programme
          </a>
        </div>
        @if (exercicesOuverts()) {
          <div id="contenu-exercices">
            @if (exercicesAffiches().length > 0) {
              <button type="button" class="bouton-discret tout-deplier" (click)="basculerTousLesExercices()">
                {{ tousDeplies() ? 'Tout replier' : 'Tout déplier' }}
              </button>
              @for (p of programmesAffiches(); track p.groupeId) {
                <h3>{{ p.titre }}</h3>
                <ol class="liste-exercices">
                  @for (e of p.exercices; track e.id) {
                    @let ouvert = detailsOuverts().has(e.id);
                    <li class="exercice" [class.ouvert]="ouvert">
                      <button type="button" class="titre-exercice" [attr.aria-expanded]="ouvert"
                              (click)="basculerExercice(e.id)">
                        <span class="fleche" aria-hidden="true">{{ ouvert ? '▾' : '▸' }}</span>
                        @if (e.phase) {
                          <app-pastille-phase [phase]="e.phase" [numero]="e.exerciceBase?.numero ?? null"
                                              [intitule]="e.exerciceBase ? e.exerciceBase.intitule : 'exercice libre'" />
                        }
                        <span class="intitule-exercice">
                          <strong>{{ e.intitule }}</strong>
                          <span class="secondaire">
                            @if (e.niveau) { {{ libellePreparation(e.niveau) }} }
                            @if (e.dureeMinutes) { · {{ e.dureeMinutes }} min }
                            @if (e.criteres.length > 0) { · {{ e.criteres.length | pluriel:'critère' }} }
                            @if (e.aSchema) { · schéma }
                          </span>
                        </span>
                      </button>
                      @if (ouvert) {
                        <div class="detail-exercice">
                          @if (e.phase) {
                            <p><span class="rubrique">Phase :</span> {{ libellePhase(e.phase) }}</p>
                          }
                          @if (e.consignes) {
                            <p class="rubrique">Déroulement et consignes</p>
                            <p class="texte-libre">{{ e.consignes }}</p>
                          }
                          @if (e.critereReussite) {
                            <p class="rubrique">Critère de réussite</p>
                            <p class="texte-libre">{{ e.critereReussite }}</p>
                          }
                          @if (e.criteres.length > 0) {
                            <p class="rubrique">Critères travaillés</p>
                            <ul class="criteres-exercice">
                              @for (c of e.criteres; track c.id) {
                                <li><span class="secondaire">{{ c.bloc }} —</span> {{ c.savoirFaire }}</li>
                              }
                            </ul>
                          }
                          @if (e.aSchema) {
                            <p class="rubrique">Schéma</p>
                            @if (e.exerciceBase; as base) {
                              <app-schema-exercice [exerciceId]="base.id" [libelle]="base.numero + ' ' + base.intitule" />
                            } @else {
                              <app-schema-exercice [seanceId]="s.id" [schemaId]="e.schemaId" [libelle]="e.intitule" />
                            }
                          }
                          @if (!e.consignes && !e.critereReussite && e.criteres.length === 0 && !e.aSchema) {
                            <p class="secondaire">Pas d'autre détail pour cet exercice.</p>
                          }
                        </div>
                      }
                    </li>
                  }
                </ol>
              }
            } @else if (reseau.enLigne()) {
              <p class="secondaire">Aucun exercice préparé pour cette séance.</p>
            } @else {
              <p class="secondaire">Le programme d'exercices s'affiche avec du réseau.</p>
            }
          </div>
        }
      </section>
    }

    @if (seanceId()) {
      <div class="filtres">
        @if (groupes().length > 0) {
          <app-filtre-groupe [groupes]="groupes()" [ids]="eleveIds()" [(valeur)]="groupeFiltre" />
        }
        <input type="search" class="recherche" aria-label="Rechercher un élève"
               placeholder="Rechercher un élève…"
               [ngModel]="rechercheEleve()" (ngModelChange)="rechercheEleve.set($event)">
      </div>

      @if (chargement()) {
        <p class="vide">Chargement…</p>
      } @else if (lignes().length === 0) {
        <div class="carte vide"><p>Aucun élève inscrit sur la saison de cette séance.</p></div>
      } @else {
        <p class="bilan" role="status">
          {{ bilan().presents | pluriel:'présent' }} · {{ bilan().absents | pluriel:'absent' }}
          @if (bilan().enAttente > 0) { · {{ bilan().enAttente }} en attente d'envoi }
          @if (nonNotes().length > 0) { · <strong class="compte-non-notes">{{ nonNotes().length | pluriel:'présent' }} sans évaluation</strong> }
        </p>
        @if (nonNotes().length > 0 || seulementNonNotes()) {
          <button type="button" class="bouton-discret filtre-non-notes" [class.actif]="seulementNonNotes()"
                  [attr.aria-pressed]="seulementNonNotes()" (click)="seulementNonNotes.set(!seulementNonNotes())">
            {{ seulementNonNotes() ? 'Voir tous les élèves' : 'Voir les présents sans évaluation' }}
          </button>
        }

        @if (!seanceAVenir() && bilan().presents > 0) {
          <a class="bouton-discret synthese" [routerLink]="['/seances', seanceId(), 'synthese']"
             [queryParams]="lienSynthese()">
            Synthèse des notes
          </a>
        }

        @if (seanceAVenir()) {
          <div class="alerte" role="status">
            Séance à venir : vous pouvez annoncer qui sera présent ; la notation sera possible le jour de la séance.
          </div>
        } @else if (auth.estMoniteur()) {
          @if (seanceChoisie(); as s) {
            <div class="notation-groupee">
              <app-notation-groupee [seance]="s" [presents]="presentsANoter()" [progressions]="progressions()"
                                    [exercices]="exercicesAffiches()" (notee)="apresNotation($event)" />
              <span class="secondaire">Les présents affichés, sur un ou plusieurs critères, chacun avec son commentaire.</span>
            </div>
          }
        }

        @if (lignesFiltrees().length === 0) {
          <div class="carte vide">
            <p>{{ seulementNonNotes() ? 'Tous les présents affichés ont reçu au moins une évaluation.' : 'Aucun élève ne correspond aux filtres.' }}</p>
          </div>
        }
        <ul class="eleves">
          @for (l of lignesFiltrees(); track l.cursusId) {
            <li class="carte">
              <button type="button" class="zone-identite" (click)="ouvrirChoixMobile(l)">
                <app-avatar [url]="urlPhoto(l.eleveId)" [nom]="l.eleve" [alt]="l.eleve" [libelleInitiales]="l.eleve" />
                <span class="identite">
                  <span class="nom">{{ l.eleve }}</span>
                  <span class="niveau">{{ libellePreparation(l.niveau) }}</span>
                  @if (enregistrements().has(l.cursusId)) {
                    <span class="enregistrement" role="status">
                      <span class="chargeur" aria-hidden="true"></span>Enregistrement…
                    </span>
                  } @else if (libelleEtat(l); as libelle) {
                    <span class="etat-mini present" [class.differe]="enAttente().has(l.cursusId)">{{ libelle }}</span>
                  } @else if (!l.statut) {
                    <span class="secondaire">Absent</span>
                  } @else {
                    <span class="secondaire">{{ libelleAncien(l) }}</span>
                  }
                </span>
              </button>
              @if (estNonNote(l)) {
                <a class="non-note" [routerLink]="['/cursus', l.cursusId]" [queryParams]="lienGrille()"
                   [attr.aria-label]="l.eleve + ' : pas encore évalué, ouvrir sa grille'">Pas encore évalué</a>
              } @else if (peutNoter(l)) {
                <a class="noter" [routerLink]="['/cursus', l.cursusId]" [queryParams]="lienGrille()"
                   [attr.aria-label]="'Noter ' + l.eleve + ' sur cette séance, ouvrir sa grille'">Noter</a>
              }
              <div class="choix" role="group" [attr.aria-label]="'Présence de ' + l.eleve">
                @for (c of choix; track c.cle) {
                  <button type="button" [class]="'etat ' + c.classe"
                          [class.actif]="estActif(l, c)"
                          [class.differe]="estActif(l, c) && enAttente().has(l.cursusId)"
                          [attr.aria-pressed]="estActif(l, c)"
                          [disabled]="enregistrements().has(l.cursusId)"
                          (click)="choisir(l, c)">
                    {{ c.libelle }}
                  </button>
                }
              </div>
            </li>
          }
        </ul>

        @if (ligneSelectionnee(); as l) {
          <div class="barre-choix" role="dialog" [attr.aria-label]="'Présence de ' + l.eleve">
            <p><strong>{{ l.eleve }}</strong> — qu'a-t-il fait ?</p>
            <div class="choix-rapide">
              @for (c of choix; track c.cle) {
                <button type="button" [class]="'etat ' + c.classe" [class.actif]="estActif(l, c)"
                        [attr.aria-pressed]="estActif(l, c)" [disabled]="enregistrements().has(l.cursusId)"
                        (click)="choisirEtFermer(l, c)">
                  {{ c.libelle }}
                </button>
              }
              <button type="button" class="bouton-discret" (click)="cursusSelectionne.set(null)">Fermer</button>
            </div>
            <p class="secondaire aide-theorie">La théorie s'ajoute à la nage ou au bloc, ou se coche seule.</p>
          </div>
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .titre { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--pas); }
    h1 { margin: 0; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }


    .programme { margin-top: var(--pas-2); }
    .exercices {
      margin-top: var(--pas-2); padding: var(--pas-2); border: 1px solid var(--trait);
      border-radius: var(--r-s); background: var(--fond);
    }
    .entete-exercices { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--pas); }
    .entete-exercices h2 { margin: 0; font-size: 1rem; }
    .bascule-exercices {
      display: inline-flex; align-items: center; gap: var(--pas); min-height: 44px; padding: 0;
      border: 0; background: none; font: inherit; font-weight: 700; color: inherit; cursor: pointer; text-align: left;
    }
    .compte-exercices { font-weight: 400; }
    .fleche { display: inline-block; width: 1em; color: var(--profond); }
    .tout-deplier { margin-top: var(--pas); }
    .exercices h3 { margin: var(--pas-2) 0 0; font-size: .9375rem; color: var(--profond); }
    .exercices p { margin: var(--pas) 0 0; }
    .liste-exercices { list-style: none; margin: var(--pas) 0 0; padding: 0; display: grid; gap: var(--pas); }
    .exercice { border: 1px solid var(--trait); border-radius: var(--r-s); background: var(--carte); }
    .titre-exercice {
      display: flex; align-items: center; gap: var(--pas); width: 100%; min-height: 44px;
      padding: var(--pas) var(--pas-2); border: 0; background: none; font: inherit; color: inherit;
      text-align: left; cursor: pointer;
    }
    .intitule-exercice { display: flex; flex-direction: column; gap: 2px; }
    .intitule-exercice .secondaire { font-size: .8125rem; }
    .detail-exercice { padding: 0 var(--pas-2) var(--pas-2); border-top: 1px solid var(--trait); font-size: .875rem; }
    .detail-exercice .rubrique { margin-top: var(--pas-2); font-weight: 700; color: var(--profond); }
    .detail-exercice span.rubrique { margin: 0; }
    .detail-exercice .texte-libre { margin-top: 4px; white-space: pre-line; }
    .criteres-exercice { margin: 4px 0 0; padding-left: 1.25rem; display: grid; gap: 2px; }
    .detail-exercice app-schema-exercice { margin-top: var(--pas); }
    .filtres {
      display: flex; flex-wrap: wrap; gap: var(--pas-2); align-items: center;
      margin: var(--pas-3) 0 var(--pas-2);
    }
    .recherche { max-width: 320px; margin: 0; }

    /* Le bilan reste en haut de l'écran pendant qu'on fait défiler la liste des élèves. */
    .bilan {
      position: sticky; top: 0; z-index: 5; max-width: none;
      margin: 0 calc(-1 * var(--pas)) var(--pas-2); padding: var(--pas) var(--pas);
      background: var(--fond); border-bottom: 1px solid var(--trait);
      color: var(--encre); font-size: .9375rem; font-weight: 600;
    }
    .compte-non-notes { color: var(--en-cours); }
    .filtre-non-notes { margin-bottom: var(--pas-2); }
    .synthese { display: inline-flex; align-items: center; min-height: 44px; margin: 0 var(--pas) var(--pas-2) 0; }
    .filtre-non-notes.actif { background: var(--profond); border-color: var(--profond); color: #fff; }
    /* Présent sans aucune note sur la séance : un lien vers sa grille pour le noter. */
    .non-note {
      display: inline-flex; align-items: center; justify-content: center; min-height: 44px;
      padding: 0 var(--pas); border: 1px dashed var(--en-cours); border-radius: var(--r-s);
      background: var(--en-cours-clair); color: var(--en-cours); font-size: .8125rem; font-weight: 700;
      text-decoration: none; text-align: center;
    }
    /* Présent déjà noté : le même lien, plus discret, pour ajouter une note. */
    .noter {
      display: inline-flex; align-items: center; justify-content: center; min-height: 44px;
      padding: 0 var(--pas); border: 1px solid var(--trait); border-radius: var(--r-s);
      color: var(--profond); font-size: .8125rem; font-weight: 700;
      text-decoration: none; text-align: center;
    }
    .notation-groupee {
      display: flex; flex-wrap: wrap; align-items: center; gap: var(--pas-2); margin-bottom: var(--pas-2);
    }

    /* Plusieurs élèves par ligne dès que la largeur le permet. */
    .eleves {
      list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2);
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    }
    .eleves li {
      padding: var(--pas-2); display: flex; justify-content: space-between; align-items: center;
      gap: var(--pas-2); flex-wrap: wrap;
    }
    /* Grand écran : identité en haut, les quatre choix alignés dessous. */
    @media (min-width: 601px) {
      .eleves li { flex-direction: column; align-items: stretch; }
    }
    .zone-identite {
      display: flex; align-items: center; gap: var(--pas); flex: 1 1 auto; min-width: 0;
      padding: 0; text-align: left; background: none; border: none;
    }
    app-avatar { --taille-avatar: 56px; }
    .identite { display: flex; align-items: center; gap: var(--pas); flex-wrap: wrap; min-width: 0; }
    .nom { font-weight: 700; }
    .niveau {
      border: 1px solid var(--trait); border-radius: var(--r-s); padding: 0 8px;
      font-size: .8125rem; font-weight: 700; color: var(--craie);
    }
    .etat-mini {
      display: none; /* superflu sur grand écran : les boutons montrent déjà l'état actif */
      font-size: .8125rem; font-weight: 700; padding: 0 8px; border-radius: var(--r-s);
    }

    /* Les quatre choix sur une seule ligne, à largeur égale, sous l'identité. */
    .choix { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
    .choix .etat { min-width: 0; padding: 8px 4px; }
    .etat {
      min-height: 44px; min-width: 72px; padding: 8px 12px;
      border: 1px solid var(--trait); border-radius: var(--r-s); background: var(--carte);
      color: var(--encre); font-weight: 600;
    }
    .etat.present.actif, .etat-mini.present { background: var(--acquis); border-color: var(--acquis); color: #fff; }
    /* Le pointillé dit « gardé sur l'appareil, pas encore chez le serveur », comme dans la grille. */
    .etat.differe, .etat-mini.differe { border: 1px dashed #fff; outline: 2px dashed var(--acquis); outline-offset: 1px; }
    .etat:disabled { opacity: .6; cursor: not-allowed; }

    .enregistrement {
      display: inline-flex; align-items: center; gap: 6px;
      color: var(--profond); font-size: .875rem; font-weight: 700;
    }
    .chargeur {
      display: inline-block; width: 1em; height: 1em;
      border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%;
      animation: tourner .8s linear infinite;
    }
    @keyframes tourner { to { transform: rotate(360deg); } }

    .barre-choix {
      /* Au-dessus de la barre d'onglets du téléphone, le temps du choix. */
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
      padding: var(--pas-2) var(--pas-3) calc(var(--pas-2) + env(safe-area-inset-bottom, 0px));
      background: var(--carte); border-top: 1px solid var(--trait);
      box-shadow: 0 -6px 16px rgba(0,0,0,.15);
    }
    .barre-choix p { margin: 0 0 var(--pas); }
    .barre-choix .aide-theorie { margin: var(--pas) 0 0; font-size: .8125rem; }
    .choix-rapide { display: flex; flex-wrap: wrap; gap: var(--pas); }
    .choix-rapide .etat { flex: 1 1 72px; }

    /*
     * Sur téléphone : la carte devient compacte (avatar + nom + état), sans
     * les boutons de choix qui ne tiendraient pas à plusieurs par ligne.
     * Toucher la carte ouvre la barre de choix en bas d'écran à la place.
     */
    @media (max-width: 600px) {
      .eleves { grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); }
      .eleves li { flex-direction: column; padding: var(--pas); gap: 4px; }
      .zone-identite { flex-direction: column; text-align: center; gap: 4px; }
      .identite { flex-direction: column; gap: 2px; }
      .etat-mini { display: inline-block; }
      .choix { display: none; }
      .recherche { max-width: none; }
    }
  `]
})
export class PresencesComponent implements OnDestroy {
  private api = inject(ApiService);
  auth = inject(AuthService);
  reseau = inject(ReseauService);
  private file = inject(FileEcrituresService);
  private notes = inject(FileAttenteService);

  /** Élèves de la séance affichée dont le dernier choix n'est pas encore parti. */
  enAttente = computed(() => {
    const seanceId = this.seanceId();
    return new Set(seanceId ? this.file.pourSeance(seanceId, 'presence').map(p => p.cursusId) : []);
  });

  readonly choix = CHOIX;
  readonly libellePreparation = libellePreparation;
  readonly estActif = estActif;

  /**
   * Ce qu'a fait l'élève, en clair (« Bloc + théorie ») ; null si rien de
   * saisi ou si la saisie n'a pas de bouton (plongée, excusé...), dite en texte.
   */
  libelleEtat(l: LignePresence): string | null {
    const eau = eauDe(l);
    const theorie = theorieDe(l);
    if (eau) return CHOIX.find(c => c.cle === eau)!.libelle + (theorie ? ' + théorie' : '');
    return theorie ? 'Théorie' : null;
  }

  libelleAncien(l: LignePresence): string {
    if (l.statut === 'ABSENT') return 'Absent';
    if (l.statut === 'EXCUSE') return 'Excusé';
    if (l.atelier === 'PLONGEE') return 'Présent, plongée';
    return 'Présent, atelier non précisé';
  }

  seances = signal<SeanceVue[]>([]);
  seanceId = signal<number | null>(null);
  /** Séance à ouvrir d'emblée, tirée de l'adresse (?seance=12). */
  seance = input<string>();
  /** Groupe à filtrer d'emblée, tiré de l'adresse (?groupe=3 ou ?groupe=SANS), au retour de la grille. */
  groupe = input<string>();
  /** Programmes d'exercices de la séance choisie : le commun et ceux des groupes. */
  exercices = signal<ExerciceVue[]>([]);
  /** « Exercices de la séance » s'ouvre replié, pour que la liste des élèves arrive vite sur téléphone. */
  exercicesOuverts = signal(false);
  /** Exercices dépliés : déroulement, critère de réussite, critères travaillés et schéma. */
  detailsOuverts = signal<ReadonlySet<number>>(new Set());
  readonly libellePhase = libellePhase;

  tousDeplies = computed(() => {
    const affiches = this.exercicesAffiches();
    return affiches.length > 0 && affiches.every(e => this.detailsOuverts().has(e.id));
  });

  basculerExercice(id: number): void {
    const ouverts = new Set(this.detailsOuverts());
    if (!ouverts.delete(id)) ouverts.add(id);
    this.detailsOuverts.set(ouverts);
  }

  basculerTousLesExercices(): void {
    this.detailsOuverts.set(this.tousDeplies() ? new Set() : new Set(this.exercicesAffiches().map(e => e.id)));
  }

  /** Filtrée sur un groupe : son programme et le commun ; sinon tous. */
  exercicesAffiches = computed(() => {
    const filtre = this.groupeFiltre();
    return typeof filtre === 'number'
      ? this.exercices().filter(e => e.groupeId == null || e.groupeId === filtre)
      : this.exercices();
  });

  /** Le programme commun d'abord, puis un programme par groupe, dans l'ordre du planning. */
  programmesAffiches = computed(() => {
    const exercices = this.exercicesAffiches();
    // Un groupe absent de la liste chargée (autre saison, liste indisponible) garde ses exercices.
    const ids = new Set<number | null>([null, ...this.groupes().map(g => g.id), ...exercices.map(e => e.groupeId)]);
    const programmes = [...ids].map(groupeId => ({
      groupeId,
      titre: groupeId == null ? 'Programme commun'
        : this.groupes().find(g => g.id === groupeId)?.nom ?? 'Groupe',
      exercices: exercices.filter(e => e.groupeId === groupeId)
    }));
    return programmes.filter(p => p.exercices.length > 0);
  });

  /** L'éditeur s'ouvre sur le groupe filtré. */
  lienProgramme = computed(() => {
    const filtre = this.groupeFiltre();
    return typeof filtre === 'number' ? { groupe: filtre } : {};
  });

  /** La synthèse s'ouvre sur le niveau du groupe filtré, et garde le groupe pour le retour. */
  lienSynthese = computed(() => {
    const filtre = this.groupeFiltre();
    const niveau = typeof filtre === 'number' ? this.groupes().find(g => g.id === filtre)?.niveauPrepare : null;
    return { niveau: niveau ?? null, groupe: filtre === 'TOUS' ? null : filtre };
  });

  /** La grille d'un élève garde la séance et le groupe filtré, pour revenir à la feuille telle quelle. */
  lienGrille = computed(() => {
    const filtre = this.groupeFiltre();
    return { seance: this.seanceId(), depuis: 'presences', groupe: filtre === 'TOUS' ? null : filtre };
  });

  lignes = signal<LignePresence[]>([]);
  chargement = signal(false);
  message = signal<string | null>(null);
  enregistrements = signal<Set<number>>(new Set());

  /** Groupes d'entraînement de la saison ouverte (ceux du planning du bassin). */
  groupes = signal<GroupeEntrainementVue[]>([]);
  groupeFiltre = signal<FiltreGroupe>('TOUS');
  eleveIds = computed(() => this.lignes().map(l => l.eleveId));
  rechercheEleve = signal('');

  /** Élève dont la carte a été touchée sur téléphone : barre de choix ouverte en bas d'écran. */
  cursusSelectionne = signal<number | null>(null);
  /** Sa ligne à jour : la barre reste ouverte quand on ajoute la théorie. */
  ligneSelectionnee = computed(() => this.lignes().find(l => l.cursusId === this.cursusSelectionne()) ?? null);

  private urlsPhotos = signal<Map<number, string>>(new Map());

  /**
   * Séance proposée par défaut : celle du jour, sinon la prochaine qu'on peut
   * déjà annoncer, sinon la dernière passée.
   */
  seanceParDefaut = computed(() => {
    const aujourdhui = dateDuJour();
    const ordonnees = [...this.seancesOuvertes()].sort((a, b) =>
      a.date.localeCompare(b.date) || a.ordre - b.ordre);
    return ordonnees.find(s => s.date >= aujourdhui) ?? ordonnees.at(-1);
  });

  /** Les présences s'annoncent au plus une semaine à l'avance : au-delà, le serveur refuserait. */
  seancesOuvertes = computed(() => this.seances().filter(s => s.date <= this.jourMax));

  seanceChoisie = computed(() => this.seances().find(s => s.id === this.seanceId()) ?? null);
  /** Séance pas encore passée : présence annoncée, mais rien à noter avant le jour J. */
  seanceAVenir = computed(() => {
    const s = this.seanceChoisie();
    return !!s && s.date > dateDuJour();
  });
  /**
   * Progressions suivies par la saison ; un groupe choisi qui prépare un
   * niveau restreint aussi le programme affiché à ce niveau.
   */
  progressions = signal<ProgressionVue[]>([]);
  progressionsAffichees = computed(() => {
    const filtre = this.groupeFiltre();
    const niveau = typeof filtre === 'number' ? this.groupes().find(g => g.id === filtre)?.niveauPrepare : null;
    return niveau ? this.progressions().filter(p => p.niveau === niveau) : this.progressions();
  });

  readonly aujourdhui = dateDuJour();
  /** Dernier jour dont on peut renseigner les présences (miroir de Seance.JOURS_ANTICIPATION_PRESENCE). */
  readonly jourMax = dateDansJours(7);
  private dialogueSeance = viewChild.required<ElementRef<HTMLDialogElement>>('dialogueSeance');
  dialogueSeanceOuvert = signal(false);
  /** Jour touché dans le calendrier du dialogue. */
  jourDialogue = signal<string | null>(null);

  /** Élèves du groupe filtré, sans tenir compte de la recherche : ce que compte le bilan. */
  lignesDuGroupe = computed(() => {
    const filtre = this.groupeFiltre();
    const groupes = this.groupes();
    return this.lignes().filter(l => passeFiltreGroupe(l.eleveId, filtre, groupes));
  });

  lignesFiltrees = computed(() => {
    const recherche = normaliser(this.rechercheEleve());
    const seulementNonNotes = this.seulementNonNotes();
    return this.lignesDuGroupe().filter(l =>
      (!recherche || normaliser(l.eleve).includes(recherche))
      && (!seulementNonNotes || this.estNonNote(l)));
  });

  /** Filtre « présents sans évaluation » : qui reste à noter après la séance. */
  seulementNonNotes = signal(false);

  /** Élèves de la séance affichée qui ont une note gardée sur l'appareil, pas encore partie. */
  private notesEnAttente = computed(() => {
    const seanceId = this.seanceId();
    return new Set(this.notes.enAttente().filter(s => s.seanceId === seanceId).map(s => s.cursusId));
  });

  /**
   * Présent à une séance passée (ou du jour), et aucune note reçue dessus, ni
   * enregistrée par le serveur ni en attente sur l'appareil. Une feuille
   * embarquée avant l'arrivée du compte ne dit rien (`evaluations` absent).
   */
  estNonNote(l: LignePresence): boolean {
    return !this.seanceAVenir() && l.statut === 'PRESENT' && l.evaluations === 0
      && !this.notesEnAttente().has(l.cursusId);
  }

  /**
   * Présent à une séance passée (ou du jour) : sa grille s'ouvre sur cette
   * séance pour le noter, qu'il ait déjà des notes ou non.
   */
  peutNoter(l: LignePresence): boolean {
    return this.auth.estMoniteur() && !this.seanceAVenir() && l.statut === 'PRESENT';
  }

  /** Présents sans évaluation du groupe filtré, quelle que soit la recherche. */
  nonNotes = computed(() => this.lignesDuGroupe().filter(l => this.estNonNote(l)));

  /** Après une notation groupée, la feuille se recharge : les élèves notés ne sont plus « sans évaluation ». */
  apresNotation(bilan: string): void {
    const seanceId = this.seanceId();
    if (seanceId) void this.chargerFeuille(seanceId).then(() => this.message.set(bilan));
    else this.message.set(bilan);
  }

  /**
   * Élèves proposés à la notation groupée : présents dans le filtre courant,
   * et dont la présence est déjà chez le serveur (il refuse de noter un élève
   * qu'il ne sait pas présent).
   */
  presentsANoter = computed(() => {
    const enAttente = this.enAttente();
    return this.lignesFiltrees().filter(l => l.statut === 'PRESENT' && !enAttente.has(l.cursusId));
  });

  /** Le bilan suit le groupe filtré (pas la recherche, qui ne sert qu'à trouver un élève). */
  bilan = computed(() => {
    const lignes = this.lignesDuGroupe();
    const enAttente = this.enAttente();
    return {
      presents: lignes.filter(l => l.statut === 'PRESENT').length,
      absents: lignes.filter(l => l.statut !== 'PRESENT').length,
      enAttente: lignes.filter(l => enAttente.has(l.cursusId)).length
    };
  });

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    try {
      this.seances.set(await this.api.seances());
      // Le groupe filtré avant d'ouvrir la grille d'un élève (?groupe=3 ou ?groupe=SANS).
      const groupe = this.groupe();
      if (groupe === 'SANS') this.groupeFiltre.set('SANS');
      else if (groupe && Number.isInteger(Number(groupe))) this.groupeFiltre.set(Number(groupe));
      // Facultatif : sans progression rattachée à la saison, pas de programme affiché.
      this.api.progressionsDeLaSaison().then(p => this.progressions.set(p), () => {});
      // Facultatif aussi : sans groupe (ou hors ligne sans cache), pas de filtre.
      this.api.groupesEntrainementSaisonOuverte().then(g => this.groupes.set(g), () => {});
      // La séance demandée (?seance=12, depuis « Infos élèves »), sinon celle du jour ou la prochaine.
      const demandee = this.seancesOuvertes().find(s => s.id === Number(this.seance()));
      const proposee = demandee ?? this.seanceParDefaut();
      if (proposee) this.choisirSeance(proposee);
    } catch {
      this.message.set('Impossible de charger les séances.');
    }
  }

  libelleSeance(s: SeanceVue): string {
    const memeJour = this.seances().filter(x => x.date === s.date).length > 1;
    return `${dateFr(s.date)}${memeJour ? ' (séance ' + s.ordre + ')' : ''} — ${lieuEtSite(s) || 'lieu non précisé'}`;
  }

  ouvrirDialogueSeance(): void {
    // Le calendrier s'ouvre sur le mois de la séance en cours.
    this.jourDialogue.set(this.seanceChoisie()?.date ?? this.aujourdhui);
    this.dialogueSeanceOuvert.set(true);
    this.dialogueSeance().nativeElement.showModal();
  }

  fermerDialogueSeance(): void {
    this.dialogueSeance().nativeElement.close();
  }

  seancesDuJour(jour: string): SeanceVue[] {
    return this.seancesOuvertes().filter(s => s.date === jour);
  }

  /** Un seul choix possible ce jour-là : on le prend tout de suite, sans second toucher. */
  toucherJour(jour: string | null): void {
    this.jourDialogue.set(jour);
    const duJour = jour ? this.seancesDuJour(jour) : [];
    if (duJour.length === 1) this.choisirDepuisDialogue(duJour[0]);
  }

  choisirDepuisDialogue(s: SeanceVue): void {
    this.choisirSeance(s);
    this.fermerDialogueSeance();
  }

  choisirSeance(s: SeanceVue): void {
    if (this.seanceId() === s.id) return;
    this.seanceId.set(s.id);
    void this.chargerFeuille(s.id);
    this.chargerExercices(s.id);
  }

  /** Facultatif : sans réseau ou sans programme, la liste reste vide. */
  private chargerExercices(seanceId: number): void {
    this.exercices.set([]);
    if (!this.reseau.enLigne()) return;
    this.api.programmeSeance(seanceId).subscribe({
      next: p => { if (this.seanceId() === seanceId) this.exercices.set(p.exercices); },
      error: () => { /* le programme n'est qu'un complément de la feuille */ }
    });
  }

  private async chargerFeuille(seanceId: number): Promise<void> {
    this.chargement.set(true);
    this.message.set(null);
    try {
      const feuille = await this.api.feuillePresence(seanceId);
      // Une autre séance a pu être choisie pendant le chargement.
      if (this.seanceId() === seanceId) {
        // Les choix pas encore partis priment sur ce que le serveur (ou le cache) connaît.
        const enAttente = new Map(this.file.pourSeance(seanceId, 'presence').map(p => [p.cursusId, p]));
        const lignes = feuille.eleves.map(l => {
          const p = enAttente.get(l.cursusId);
          return p ? { ...l, statut: p.statut, atelier: p.atelier, theorie: p.theorie ?? p.atelier === 'THEORIE' } : l;
        });
        this.lignes.set(lignes);
        this.chargerPhotosManquantes(lignes);
      }
    } catch (e) {
      this.lignes.set([]);
      this.message.set(!this.reseau.enLigne()
        ? "Cette feuille n'est pas disponible hors ligne. Utilisez « Préparer hors ligne » avec du réseau, "
          + 'avant de partir, pour l\'embarquer.'
        : (e as HttpErrorResponse).error?.detail ?? 'Impossible de charger la feuille de présence.');
    } finally {
      this.chargement.set(false);
    }
  }

  private chargerPhotosManquantes(lignes: LignePresence[]): void {
    const deja = this.urlsPhotos();
    for (const l of lignes) {
      if (l.aPhoto && !deja.has(l.eleveId)) this.chargerPhoto(l.eleveId);
    }
  }

  private chargerPhoto(eleveId: number): void {
    this.api.photoEleve(eleveId).then(
      blob => {
        const copie = new Map(this.urlsPhotos());
        copie.set(eleveId, URL.createObjectURL(blob));
        this.urlsPhotos.set(copie);
      },
      () => { /* pas de photo consultable : la silhouette reste affichée */ }
    );
  }

  urlPhoto(eleveId: number): string | null {
    return this.urlsPhotos().get(eleveId) ?? null;
  }

  /** Sur téléphone (voir le média-query 600px), la carte n'affiche plus les boutons : la toucher ouvre la barre du bas. */
  ouvrirChoixMobile(l: LignePresence): void {
    if (window.innerWidth > 600) return;
    if (this.enregistrements().has(l.cursusId)) return;
    this.cursusSelectionne.set(l.cursusId);
  }

  /** Nage ou bloc ferme la barre ; la théorie la laisse ouverte, pour y ajouter la nage ou le bloc. */
  async choisirEtFermer(ligne: LignePresence, c: Choix): Promise<void> {
    if (c.cle !== 'THEORIE') this.cursusSelectionne.set(null);
    await this.choisir(ligne, c);
  }

  /** Enregistre le choix ; toucher de nouveau le choix actif l'efface. */
  async choisir(ligne: LignePresence, c: Choix): Promise<void> {
    const seanceId = this.seanceId();
    if (!seanceId) return;
    const avant: EtatPresence = { statut: ligne.statut, atelier: ligne.atelier, theorie: ligne.theorie };

    const apres = apresToucher(ligne, c);
    this.remplacer(ligne.cursusId, apres);
    this.marquer(ligne.cursusId, true);
    this.message.set(null);
    try {
      const seance = this.seances().find(s => s.id === seanceId);
      const issue = await this.file.enregistrer(
        { type: 'presence', seanceId, cursusId: ligne.cursusId, ...apres },
        `Présence de ${ligne.eleve}`, seance?.date ?? dateDuJour());
      if (issue.etat === 'refusee') {
        this.remplacer(ligne.cursusId, avant);
        this.message.set(issue.raison);
      }
    } catch {
      // Écriture sur l'appareil impossible (stockage plein, navigation privée…).
      this.remplacer(ligne.cursusId, avant);
      this.message.set(`La présence de ${ligne.eleve} n'a pas pu être enregistrée.`);
    } finally {
      this.marquer(ligne.cursusId, false);
    }
  }

  private remplacer(cursusId: number, valeur: EtatPresence): void {
    this.lignes.set(this.lignes().map(l => l.cursusId === cursusId ? { ...l, ...valeur } : l));
  }

  private marquer(cursusId: number, enCours: boolean): void {
    const suivant = new Set(this.enregistrements());
    if (enCours) suivant.add(cursusId); else suivant.delete(cursusId);
    this.enregistrements.set(suivant);
  }

  ngOnDestroy(): void {
    for (const url of this.urlsPhotos().values()) URL.revokeObjectURL(url);
  }
}
