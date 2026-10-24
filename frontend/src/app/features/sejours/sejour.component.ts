import {
  Component, ChangeDetectionStrategy, Injector, afterNextRender, computed, effect, inject, signal, untracked, viewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, from, map, mergeMap, of, throwError } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ReseauService } from '../../core/reseau.service';
import { PlurielPipe } from '../../core/pluriel';
import { FileSejourService } from './file-sejour.service';
import { ModificationSejour, appliquerEnAttente, cleSejour } from './sejour-hors-ligne';
import { MoniteurOptionVue, PlongeurConnuVue } from '../../core/modeles';
import { DialogueComponent } from '../../core/dialogue.component';
import { OngletsComponent, OptionOnglet } from '../../core/onglets.component';
import { ComboboxComponent, OptionCombobox } from '../../core/combobox.component';
import { dateDuJour, periode } from '../../core/date-fr';
import {
  AFFAIRES_TYPE, BilanEnvoiCarnet, CATEGORIES, CategorieAffaire, DemandeAffaire, DemandeEvenement, DemandeLogement, DemandeParticipant,
  DemandeMesInformations, DemandeVoiture, EvenementVue, GroupeProposeVue, LogementVue, ParticipantVue, REGIMES, RegimeAlimentaire,
  FraisVue, PortFrais, PortPrets, SejourApi, SejourVue,
  CONSEIL_ASSURANCE_TYPE, TRANSPORTS, Trajet, VoitureVue, autreJour, copieTrajet, euros, heure, jourLong, nomComplet,
  remboursementsDe, texteTrajet, trajetSaisi
} from './sejour-api';
import { enCarte, memeVoyageQue } from './voyage';
import { CarteVoyageComponent, montrerCarte } from './carte-voyage.component';
import { AttestationAssuranceComponent } from './attestation-assurance.component';
import { programmeParJour } from './programme-du-jour';
import { JourneeSejourComponent } from './journee-sejour.component';
import { PalanqueesPlongeeComponent } from './palanquees-plongee.component';
import { SejourFraisComponent } from './sejour-frais.component';
import { SejourMaterielComponent } from './sejour-materiel.component';
import { PretsDuSejour } from './materiel-sejour';
import { MesInformationsComponent } from './mes-informations.component';
import { CibleMonSejour, MonSejourComponent } from './mon-sejour.component';
import { TrombinoscopeSejourComponent } from './trombinoscope-sejour.component';
import { SejourCoursesComponent } from './sejour-courses.component';
import { SejourRestaurantComponent } from './sejour-restaurant.component';

type Onglet = 'programme' | 'participants' | 'transports' | 'hebergement' | 'frais' | 'materiel' | 'courses' | 'restaurant'
  | 'pratique';

/** Un groupe d'arrivées (ou de départs) : même jour, même heure, même vol. */
interface GroupeTrajet {
  quand: string;
  comment: string;
  lieu: string | null;
  /** Retour seulement : quand arrive l’avion ou le train, « à 21h35 » ou « le mercredi 16/06/2027 à 06h10 ». */
  arrivee: string | null;
  noms: string[];
  /** Le trajet commun et ceux qui le prennent, pour y ajouter d'autres participants. */
  trajet: Trajet;
  ids: number[];
}

function trajetVide(): Trajet {
  return copieTrajet(null);
}

/** Un vol déjà saisi, à poser sur d'autres : sans le dossier ni le lien de celui qui l'avait (propres à chacun). */
function volSansReservation(t: Trajet | null): Trajet {
  return { ...copieTrajet(t), dossier: null, lienEnregistrement: null };
}

/** Le brouillon de la fenêtre : arrivée et départ toujours présents, vidés à l'envoi s'ils sont restés vides. */
type BrouillonParticipant = DemandeParticipant & { arrivee: Trajet; depart: Trajet };

function participantVide(): BrouillonParticipant {
  return {
    eleveId: null, utilisateurId: null, nom: '', prenom: '', plongeur: true, telephone: null, email: null,
    regimes: [], regimePrecision: null, urgenceNom: null, urgenceTelephone: null,
    arrivee: trajetVide(), depart: trajetVide(), remarques: null, membreGroupeId: null
  };
}

/**
 * Le séjour d'une sortie, en sept onglets : programme ; participants et
 * repas ; transports (arrivées et départs, voitures) ; hébergement ; frais ;
 * matériel emprunté au club ; pratique (affaires à prévoir, infos pratiques). Les points à vérifier
 * sont comptés sur l'onglet qui permet de les régler. Pendant le séjour,
 * l'encart « Aujourd'hui » (JourneeSejourComponent) passe avant tout.
 * Son créateur (qui a créé la sortie) et les organisateurs qu'il désigne le
 * remplissent (fenêtres de saisie) ; les autres encadrants le lisent ; un participant qui a un compte lit son carnet
 * (sans les coordonnées ni les régimes des autres). « Version imprimable »
 * ouvre le carnet mis en page pour le papier (CarnetImprimableComponent).
 */
@Component({
  selector: 'app-sejour',
  imports: [FormsModule, RouterLink, OngletsComponent, JourneeSejourComponent, PalanqueesPlongeeComponent, DialogueComponent, ComboboxComponent, SejourFraisComponent, SejourMaterielComponent,
            MesInformationsComponent, MonSejourComponent, CarteVoyageComponent, AttestationAssuranceComponent, PlurielPipe,
            TrombinoscopeSejourComponent, SejourCoursesComponent, SejourRestaurantComponent],
  template: `
    @if (sejour(); as s) {
      <header class="entete">
        <h1>{{ s.sortie.nom }}</h1>
        <p class="secondaire">
          {{ majuscule(periode(s.sortie.dateDebut, s.sortie.dateFin)) }}@if (s.sortie.lieu) { · {{ s.sortie.lieu }}}
          · {{ s.participants.length }} participant{{ s.participants.length > 1 ? 's' : '' }}
        </p>
      </header>

      <!-- Sans réseau : la copie du téléphone, et ce qui attend d'être envoyé (demande du club, 2026). -->
      @if (copieDu() !== null || enAttente().length > 0) {
        <section class="carte bandeau-hors-ligne sans-impression" role="status" aria-label="Séjour hors ligne">
          @if (copieDu(); as d) {
            <p><strong>Hors ligne.</strong> Le séjour tel qu'il était {{ quand(d) }}, sur ce téléphone.</p>
          }
          @if (enAttente().length > 0) {
            <p>
              {{ enAttente().length | pluriel:'modification' }} gardée{{ enAttente().length > 1 ? 's' : '' }} sur ce
              téléphone, déjà visible{{ enAttente().length > 1 ? 's' : '' }} ici :
              {{ fileSejour.synchronisation() ? 'envoi en cours…' : reseau.enLigne() ? 'envoi au plus tôt.' : 'envoi au retour du réseau.' }}
            </p>
            <ul class="en-attente">
              @for (e of enAttente(); track e.cle) { <li>{{ e.libelle }}</li> }
            </ul>
            @if (reseau.enLigne() && !fileSejour.synchronisation()) {
              <button type="button" class="bouton-discret envoyer-maintenant" (click)="envoyerMaintenant()">Envoyer maintenant</button>
            }
          }
        </section>
      }

      <!-- Seuls le créateur et les organisateurs qu'il désigne modifient le séjour (choix du club, 2026). -->
      <section class="carte bandeau-organisation" aria-label="Organisation du séjour">
        <div class="organisateurs">
          <span class="etiquette">Organisation</span>
          @if (s.organisateurs.length) {
            <span>
              @for (o of s.organisateurs; track o.id) {
                {{ $first ? '' : ($last ? ' et ' : ', ') }}<strong>{{ o.nomComplet }}</strong>@if (o.createur) { <span class="secondaire"> (créateur)</span> }
              }
            </span>
          } @else if (s.encadrant) {
            <span class="secondaire">Aucun organisateur : un administrateur peut en désigner un.</span>
          }
          @if (commeParticipant()) {
            <span class="pastille vue-participant">Vue d'un participant</span>
          } @else if (s.gere) {
            <span class="pastille droit">Vous pouvez modifier</span>
          } @else if (s.encadrant) {
            <span class="pastille">Lecture seule</span>
          }
          @if (s.peutDesigner) {
            <button type="button" class="bouton-lien" (click)="ouvrirOrganisateurs()">
              Choisir les organisateurs
            </button>
          }
        </div>
        <div class="barre-actions" role="group" aria-label="Partager le carnet">
          @if (s.encadrant || commeParticipant()) {
            <button type="button" class="bouton-discret action mode-participant" (click)="basculerMode()"
                    [attr.aria-pressed]="commeParticipant()"
                    title="Le séjour tel que le voit un participant : son carnet, sans les coordonnées des autres">
              @if (commeParticipant()) {
                <span aria-hidden="true">↩</span> Revenir à l'organisation
              } @else {
                <span aria-hidden="true">👁</span> Voir comme un participant
              }
            </button>
          }
          <a class="bouton-discret action" [routerLink]="['/sejours', s.sortie.id, 'imprimer']">
            <span aria-hidden="true">🖨</span> Version imprimable
          </a>
          @if (s.participants.length > 0 && !copieDu()) {
            <button type="button" class="bouton-discret action ouvrir-trombinoscope" (click)="trombinoscopeOuvert.set(true)">
              <span aria-hidden="true">👥</span> Trombinoscope
            </button>
          }
          @if (s.gere) {
            <button type="button" class="bouton-discret action" (click)="choisirDestinataires('carnet')" [disabled]="envoi()">
              <span aria-hidden="true">✉</span> Envoyer le carnet…
            </button>
            @if (s.participants.length > 0) {
              <button type="button" class="bouton-discret action" (click)="choisirDestinataires('invitations')" [disabled]="envoi()"
                      title="Les personnes choisies reçoivent un e-mail pour renseigner leur voyage, leurs repas, la personne à prévenir et leurs frais">
                <span aria-hidden="true">✎</span> Demander les informations…
              </button>
            }
          }
        </div>
      </section>

      <!-- Les visages par groupe de plongeurs, pour tous les participants ; le serveur choisit les photos (demande du club, 2026). -->
      <app-dialogue [ouvert]="trombinoscopeOuvert()" [large]="true" [titre]="'Trombinoscope — ' + s.sortie.nom"
                    (fermer)="trombinoscopeOuvert.set(false)">
        @if (trombinoscopeOuvert()) {
          <app-trombinoscope-sejour [port]="portTrombinoscope()" [gere]="s.gere && !commeParticipant()"
                                    [vueParticipant]="!s.encadrant || commeParticipant()" [nomSejour]="s.sortie.nom" />
        }
      </app-dialogue>

      @if (message(); as m) { <div class="alerte sans-impression" role="status">{{ m }}</div> }

      <!-- Le programme du jour, du voyage aller au voyage retour ; la veille, un rappel (demande du club, 2026). -->
      <app-journee-sejour class="sans-impression" [participants]="voyageurs()" [montrerNoms]="s.encadrant" [encadrant]="s.encadrant"
                          [moiId]="moi()?.id ?? null" [dateDebut]="s.sortie.dateDebut" [dateFin]="s.sortie.dateFin"
                          [programme]="programme()" [affaires]="s.affaires" [comptes]="mesComptes()"
                          [cartes]="portCartes" />

      <!-- Frais partagés : en tête de page, pour qu'on les trouve sans chercher (demande du club, 2026). -->
      <section class="carte encart-frais sans-impression" aria-label="Frais du séjour">
        <div class="encart-frais-texte">
          <h2>Frais du séjour</h2>
          <p>
            <strong>{{ euros(s.frais.comptes.totalCentimes) }}</strong> dépensés
            · {{ s.frais.depenses.length }} dépense{{ s.frais.depenses.length > 1 ? 's' : '' }}
            · @if (s.frais.comptes.remboursements.length) {
              {{ s.frais.comptes.remboursements.length }} remboursement{{ s.frais.comptes.remboursements.length > 1 ? 's' : '' }} à faire
            } @else {
              comptes à l'équilibre
            }
          </p>
          @if (moi(); as m) {
            @for (r of mesRemboursements(m.id); track $index) {
              <p class="encart-frais-moi">{{ majuscule(r) }}</p>
            }
          }
        </div>
        <button type="button" class="bouton-principal" (click)="ouvrirFrais()">
          {{ s.frais.droits.peutAjouter ? 'Gérer les frais' : 'Voir les frais' }}
        </button>
      </section>

      @if (moi(); as m) {
        <app-mon-sejour [sejour]="s" [moi]="m" [prets]="prets" [cartes]="portCartes"
                        [attestations]="portAttestations" (ouvrir)="ouvrirDepuisMonSejour($event)" />
        <app-dialogue [ouvert]="mesInfosOuvertes()" [large]="true" [erreur]="erreur()" titre="Mes informations pour le séjour"
                      (fermer)="mesInfosOuvertes.set(false)">
          @if (mesInfosOuvertes()) {
            <app-mes-informations [participant]="m" [envoi]="envoi()" (enregistrer)="enregistrerMesInformations($event)"
                                  (annuler)="mesInfosOuvertes.set(false)" />
          }
        </app-dialogue>
      }

      <app-onglets class="sans-impression" id="onglets-sejour" [options]="onglets()" [choisi]="onglet()"
                   (choisir)="onglet.set($event)" [defilant]="true" />

      <!-- Programme -->
      @if (voir('programme')) {
        <section>
          <div class="titre-section">
            <h2>Programme</h2>
            @if (s.gere) {
              <button type="button" class="bouton-principal sans-impression" (click)="ouvrirEvenement(null)">
                Ajouter un rendez-vous
              </button>
            }
          </div>
          @if (programme().length === 0) {
            <p class="vide">Rien au programme pour l'instant.</p>
          }
          @for (j of programme(); track j.jour) {
            <div class="carte jour" [class.aujourdhui]="j.jour === aujourdhui()">
              <h3>{{ jourLong(j.jour) }}@if (j.jour === aujourdhui()) { · aujourd'hui}</h3>
              <ul class="lignes">
                @for (l of j.lignes; track $index) {
                  <li>
                    <span class="heure">{{ l.heure }}</span>
                    <span class="quoi">
                      <strong>{{ l.titre }}</strong>@if (l.lieu) { <span class="secondaire"> — {{ l.lieu }}</span>}
                      @if (l.details) { <span class="texte-libre secondaire">{{ l.details }}</span> }
                      @if (l.palanquees.length > 0) {
                        <app-palanquees-plongee [palanquees]="l.palanquees" [encadrant]="s.encadrant" />
                      }
                    </span>
                    @if (s.gere && l.evenement; as e) {
                      <span class="sans-impression boutons-ligne">
                        <button type="button" class="bouton-discret" (click)="ouvrirEvenement(e)"
                                [attr.aria-label]="'Modifier ' + e.titre">Modifier</button>
                      </span>
                    }
                  </li>
                }
              </ul>
            </div>
          }
        </section>
      }

      <!-- Participants (encadrants) -->
      @if (s.encadrant && voir('participants')) {
        <section>
          <div class="titre-section">
            <h2>Participants</h2>
            @if (s.gere) {
              <div class="actions sans-impression">
                <button type="button" class="bouton-principal" (click)="ouvrirParticipant(null)">Ajouter un participant</button>
                @if (s.participants.length > 0) {
                  <button type="button" class="bouton-discret" (click)="choisirDestinataires('invitations')" [disabled]="envoi()"
                          title="Les personnes choisies reçoivent un e-mail pour renseigner leur voyage, leurs repas, la personne à prévenir et leurs frais">
                    Demander les informations…
                  </button>
                }
                @if (s.groupesProposes.length > 0) {
                  <select aria-label="Inscrire un groupe de plongeurs" [ngModel]="null"
                          (ngModelChange)="importerGroupe($event)">
                    <option [ngValue]="null">Inscrire un groupe de plongeurs…</option>
                    @for (g of s.groupesProposes; track g.id) {
                      <option [ngValue]="g.id">{{ g.nom }} ({{ g.membres }})</option>
                    }
                  </select>
                }
              </div>
            }
          </div>
          @if (s.participants.length === 0) {
            <p class="vide">Personne d'inscrit pour l'instant.</p>
          } @else {
            <p class="secondaire">{{ complets() }} sur {{ s.participants.length }} ont donné leur arrivée, leur départ et
              la personne à prévenir. Touchez un nom pour voir sa fiche.</p>
            @if (s.gere) {
              <p class="secondaire">{{ assures() }} sur {{ s.participants.length }} ont joint leur attestation d'assurance.</p>
            }
          }
          @if (s.gere) {
            <div class="carte conseil-assurance">
              <div class="ligne">
                <strong>Conseil d'assurance</strong>
                <button type="button" class="bouton-discret sans-impression" (click)="ouvrirConseilAssurance()">Modifier</button>
              </div>
              @if (s.conseilAssurance) {
                <p class="texte-libre secondaire">{{ s.conseilAssurance }}</p>
              } @else {
                <p class="secondaire">Message type (Lafont), vu dans « Mon séjour » par chaque participant qui n'a pas encore
                  joint son attestation : « Modifier » pour écrire le vôtre.</p>
                <p class="texte-libre secondaire">{{ conseilType }}</p>
              }
            </div>
          }
          <ul class="liste-participants">
            @for (p of s.participants; track p.id) {
              <li class="carte">
                <details>
                  <summary>
                    <span class="nom">{{ nomComplet(p) }}</span>
                    <span class="pastille" [class.accompagnant]="!p.plongeur">{{ p.plongeur ? 'Plongeur' : 'Accompagnant' }}</span>
                    @if (p.groupe) { <span class="secondaire">Groupe « {{ p.groupe }} »</span> }
                    @if (manque(p); as m) {
                      @if (m.length === 0) {
                        <span class="etat-infos complet">✓ Infos données</span>
                      } @else {
                        <span class="etat-infos">À compléter : {{ m.join(', ') }}</span>
                      }
                    }
                  </summary>
                @if (p.telephone || p.email) {
                  <p>
                    @if (p.telephone) { <a [href]="'tel:' + p.telephone">{{ p.telephone }}</a> }
                    @if (p.telephone && p.email) { · }
                    @if (p.email) { <span class="secondaire">{{ p.email }}</span> }
                  </p>
                }
                @if (p.urgenceNom || p.urgenceTelephone) {
                  <p><strong>À prévenir :</strong> {{ p.urgenceNom }}
                    @if (p.urgenceTelephone) { <a [href]="'tel:' + p.urgenceTelephone">{{ p.urgenceTelephone }}</a> }</p>
                }
                @if (p.regimes.length || p.regimePrecision) {
                  <p><strong>Repas :</strong> {{ libellesRegimes(p.regimes) }}@if (p.regimePrecision) { ({{ p.regimePrecision }})}</p>
                }
                <p class="secondaire">Arrivée : {{ texteTrajet(p.arrivee) }} · Départ : {{ texteTrajet(p.depart) }}</p>
                @if (p.remarques) { <p class="texte-libre secondaire">{{ p.remarques }}</p> }
                @if (s.gere) {
                  <app-attestation-assurance [type]="p.attestationAssurance" [port]="portAttestations" [participantId]="p.id" />
                  <div class="actions sans-impression">
                    <button type="button" class="bouton-discret" (click)="ouvrirParticipant(p)">Modifier</button>
                    @if (p.email) {
                      <button type="button" class="bouton-discret" (click)="envoyerInvitations(p)" [disabled]="envoi()"
                              title="Un e-mail pour qu'il renseigne lui-même son voyage, ses repas, la personne à prévenir et ses frais">
                        Lui demander ses informations
                      </button>
                    }
                    <button type="button" class="bouton-discret danger" (click)="supprimerParticipant(p)">Retirer</button>
                  </div>
                }
                </details>
              </li>
            }
          </ul>

          <h3>Repas</h3>
          <p>{{ s.participants.length }} couverts, dont {{ sansRegime().length }} sans régime particulier.</p>
          @if (repas().length > 0 || precisions().length > 0) {
            <ul class="lignes-repas">
              @for (r of repas(); track r.libelle) {
                <li><strong>{{ r.libelle }} : {{ r.noms.length }}</strong> — {{ r.noms.join(', ') }}</li>
              }
              @for (p of precisions(); track p.id) {
                <li>Précision pour la cuisine, <strong>{{ nomComplet(p) }}</strong> : {{ p.regimePrecision }}</li>
              }
            </ul>
          }
        </section>
      }

      <!-- Transports : arrivées et départs, voitures -->
      @if (voir('transports') && avertissementsDe().transports.length > 0) {
        <ul class="avertissements sans-impression" aria-label="À vérifier">
          @for (a of avertissementsDe().transports; track a) { <li>{{ a }}</li> }
        </ul>
      }
      @if (voir('transports')) {
        <section>
          <div class="titre-section">
            <h2>Arrivées et départs</h2>
            @if (s.gere) {
              <button type="button" class="bouton-principal sans-impression" (click)="ouvrirVolCommun('ARRIVEE', null)"
                      [disabled]="s.participants.length === 0">Un même vol pour plusieurs</button>
            }
          </div>
          <div class="deux-colonnes">
            @for (sens of sensTrajets; track sens.code) {
              <div>
                <h3>{{ sens.libelle }}</h3>
                @if (groupesTrajets(sens.code).length === 0) { <p class="vide">Rien de renseigné.</p> }
                <ul class="cartes">
                  @for (g of groupesTrajets(sens.code); track $index) {
                    @if (enCarte(g.trajet)) {
                      <li class="vol">
                        <app-carte-voyage [trajet]="g.trajet" [aller]="sens.code === 'arrivee'"
                                          [etiquette]="g.ids.length + (g.ids.length > 1 ? ' personnes' : ' personne')">
                          <div class="passagers">
                            <p class="titre-passagers">Qui {{ g.trajet.transport === 'TRAIN' ? 'prend ce train' : 'est dans ce ' + (g.trajet.transport === 'AVION' ? 'vol' : 'voyage') }}</p>
                            <ul>
                              @for (p of passagers(g, sens.code); track p.id) {
                                <li>{{ p.nom }}@if (p.dossier) { <span class="secondaire sans-impression"> · dossier {{ p.dossier }}</span> }
                                  @if (p.carte) {
                                    <button type="button" class="bouton-discret sans-impression carte-passager"
                                            (click)="montrerCarte(p.id, sens.code)">Carte d'embarquement</button>
                                  }
                                </li>
                              }
                            </ul>
                            @if (s.gere) {
                              <button type="button" class="bouton-discret sans-impression"
                                      (click)="ouvrirVolCommun(sens.code === 'arrivee' ? 'ARRIVEE' : 'DEPART', g)">
                                Ajouter des personnes à ce {{ g.trajet.transport === 'TRAIN' ? 'train' : 'vol' }}
                              </button>
                            }
                          </div>
                        </app-carte-voyage>
                      </li>
                    } @else {
                    <li class="carte">
                      <span class="nom">{{ g.quand }}</span>
                      @if (g.comment) { <span> · {{ g.comment }}</span> }
                      @if (g.lieu) { <span class="secondaire"> · {{ g.lieu }}</span> }
                      @if (g.arrivee) { <span class="secondaire"> · arrivée {{ g.arrivee }}</span> }
                      <p>{{ g.noms.join(', ') }}</p>
                      @if (s.gere) {
                        <button type="button" class="bouton-discret sans-impression"
                                (click)="ouvrirVolCommun(sens.code === 'arrivee' ? 'ARRIVEE' : 'DEPART', g)">
                          Ajouter des personnes à ce {{ g.trajet.transport === 'TRAIN' ? 'train' : 'vol' }}
                        </button>
                      }
                    </li>
                    }
                  }
                </ul>
                @if (sansTrajet(sens.code).length > 0) {
                  <p class="secondaire">Pas encore renseigné : {{ sansTrajet(sens.code).join(', ') }}</p>
                }
              </div>
            }
          </div>
        </section>
      }

      @if (voir('transports')) {
        <section class="section-voitures">
          <div class="titre-section">
            <h2>Voitures</h2>
            @if (s.gere) {
              <button type="button" class="bouton-principal sans-impression" (click)="ouvrirVoiture(null)"
                      [disabled]="s.participants.length === 0">Ajouter une voiture</button>
            }
          </div>
          @if (s.voitures.length === 0) { <p class="vide">Aucune voiture pour l'instant.</p> }
          <ul class="cartes">
            @for (v of s.voitures; track v.id) {
              <li class="carte">
                <div class="ligne">
                  <span class="nom">{{ v.nom }}</span>
                  <span class="pastille" [class.plein]="aBord(v) > v.places">{{ aBord(v) }} / {{ v.places }} places</span>
                </div>
                @if (v.trajet) { <p class="secondaire">{{ v.trajet }}</p> }
                <p><strong>Conducteur :</strong> {{ v.conducteurId ? nomDe(v.conducteurId) : 'à trouver' }}</p>
                <p><strong>Passagers :</strong> {{ v.passagerIds.length ? noms(v.passagerIds) : 'aucun' }}</p>
                @if (v.remarques) { <p class="texte-libre secondaire">{{ v.remarques }}</p> }
                @if (s.gere) {
                  <div class="actions sans-impression">
                    <button type="button" class="bouton-discret" (click)="ouvrirVoiture(v)">Modifier</button>
                    <button type="button" class="bouton-discret danger" (click)="supprimerVoiture(v)">Supprimer</button>
                  </div>
                }
              </li>
            }
          </ul>
        </section>
      }

      <!-- Hébergement : logements et chambres -->
      @if (voir('hebergement') && avertissementsDe().hebergement.length > 0) {
        <ul class="avertissements sans-impression" aria-label="À vérifier">
          @for (a of avertissementsDe().hebergement; track a) { <li>{{ a }}</li> }
        </ul>
      }
      @if (voir('hebergement')) {
        <section>
          <div class="titre-section">
            <h2>Logements et chambres</h2>
            @if (s.gere) {
              <button type="button" class="bouton-principal sans-impression" (click)="ouvrirLogement(null)">
                Ajouter un logement
              </button>
            }
          </div>
          @if (s.logements.length === 0) { <p class="vide">Aucun logement pour l'instant.</p> }
          @for (l of s.logements; track l.id) {
            <div class="carte logement">
              <div class="ligne">
                <h3>{{ l.nom }}</h3>
                @if (s.gere) {
                  <span class="actions sans-impression">
                    <button type="button" class="bouton-discret" (click)="ouvrirLogement(l)">Modifier</button>
                    <button type="button" class="bouton-discret danger" (click)="supprimerLogement(l)">Supprimer</button>
                  </span>
                }
              </div>
              @if (l.adresse) { <p class="secondaire">{{ l.adresse }}</p> }
              @if (l.remarques) { <p class="texte-libre secondaire">{{ l.remarques }}</p> }
              <ul class="chambres">
                @for (c of l.chambres; track c.id) {
                  <li>
                    <div class="ligne">
                      <strong>{{ c.nom }}</strong>
                      <span class="pastille" [class.plein]="c.occupantIds.length > c.couchages">
                        {{ c.occupantIds.length }} / {{ c.couchages }}
                      </span>
                    </div>
                    @if (c.remarques) { <span class="secondaire">{{ c.remarques }}</span> }
                    <p>{{ c.occupantIds.length ? noms(c.occupantIds) : 'Libre' }}</p>
                  </li>
                }
              </ul>
            </div>
          }
        </section>
      }

      <!-- Pratique : affaires à prévoir, infos pratiques -->
      @if (voir('pratique')) {
        <section>
          <div class="titre-section">
            <h2>Affaires à prévoir</h2>
            @if (s.gere) {
              <button type="button" class="bouton-principal sans-impression" (click)="ouvrirAffaires()">Modifier la liste</button>
            }
          </div>
          @if (s.affaires.length === 0) { <p class="vide">Pas encore de liste.</p> }
          <div class="deux-colonnes">
            @for (c of categories; track c.code) {
              @if (affairesDe(c.code).length > 0) {
                <div>
                  <h3>{{ c.libelle }}</h3>
                  <ul class="coches">
                    @for (a of affairesDe(c.code); track a.id) {
                      <li><span class="case-papier" aria-hidden="true"></span>{{ a.libelle }}
                        @if (a.indispensable) { <strong class="indispensable">indispensable</strong> }</li>
                    }
                  </ul>
                </div>
              }
            }
          </div>
        </section>
      }

      <!-- Frais partagés -->
      @if (voir('frais')) {
        <section id="frais-sejour">
          <app-sejour-frais [frais]="s.frais" [participants]="s.participants" [port]="portFrais" />
          @if (s.gere) {
            <p class="secondaire sans-impression acces-frais">
              Les participants qui ne sont pas moniteurs voient et saisissent leurs frais par le lien reçu avec
              « Demander à chacun ses informations » (onglet Participants).
            </p>
          }
        </section>
      }

      <!-- Matériel du club emprunté : chargé à l'ouverture de l'onglet -->
      @if (voir('materiel')) {
        <section id="materiel-sejour">
          <app-sejour-materiel [prets]="prets" />
          @if (s.gere) {
            <p class="secondaire sans-impression acces-frais">
              Les participants qui ne sont pas moniteurs déclarent leurs emprunts par le même lien que les frais.
            </p>
          }
        </section>
      }

      <!-- Liste de courses (encadrants, qui voient les régimes) : réseau obligatoire -->
      @if (s.encadrant && voir('courses')) {
        <section id="courses-sejour">
          @if (copieDu()) {
            <p class="vide">La liste de courses demande le réseau.</p>
          } @else {
            <app-sejour-courses [sejour]="s" [port]="portRepas" [gere]="s.gere" />
          }
        </section>
      }

      <!-- Menus des restaurants : chacun choisit, les organisateurs importent et lisent la commande ; réseau obligatoire -->
      @if (voir('restaurant')) {
        <section id="restaurant-sejour">
          @if (copieDu()) {
            <p class="vide">Les menus du restaurant demandent le réseau.</p>
          } @else {
            <app-sejour-restaurant [port]="portMenus" [dateDebut]="s.sortie.dateDebut" [dateFin]="s.sortie.dateFin"
                                   [vueParticipant]="commeParticipant()" />
          }
        </section>
      }

      @if (voir('pratique')) {
        <section>
          <div class="titre-section">
            <h2>Infos pratiques</h2>
            @if (s.gere) {
              <button type="button" class="bouton-principal sans-impression" (click)="ouvrirInfos()">Modifier</button>
            }
          </div>
          @if (s.infosPratiques) {
            <p class="carte texte-libre">{{ s.infosPratiques }}</p>
          } @else {
            <p class="vide">Numéros d'urgence, centre de plongée, rendez-vous… à compléter.</p>
          }
        </section>
      }
    } @else if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (message(); as m) {
      <div class="alerte" role="alert">{{ m }}</div>
    }

    <!-- Fenêtres de saisie -->
    <app-dialogue [ouvert]="participantOuvert()" [large]="true" [erreur]="erreur()"
                  [titre]="participantId === null ? 'Ajouter un participant' : 'Modifier le participant'"
                  (fermer)="participantOuvert.set(false)">
      @if (participantId === null) {
        <label for="p-connu">Un membre du club</label>
        <app-combobox idChamp="p-connu" [options]="optionsConnus()" [valeur]="null"
                      (valeurChange)="choisirConnu($event)"
                      aide="Rechercher un élève ou un encadrant…" texteVide="Personne ne correspond." />
        <p class="secondaire">Ou saisissez un invité à la main.</p>
      }
      <div class="grille">
        <div><label for="p-prenom">Prénom *</label><input id="p-prenom" [(ngModel)]="participant.prenom" maxlength="120"></div>
        <div><label for="p-nom">Nom *</label><input id="p-nom" [(ngModel)]="participant.nom" maxlength="120"></div>
        <div><label for="p-tel">Téléphone</label><input id="p-tel" type="tel" [(ngModel)]="participant.telephone" maxlength="30"></div>
        <div><label for="p-email">E-mail</label><input id="p-email" type="email" [(ngModel)]="participant.email" maxlength="180"></div>
      </div>
      <label class="case"><input type="checkbox" [ngModel]="participant.plongeur" (ngModelChange)="changerPlongeur($event)">
        Plonge (sinon : accompagnant)</label>
      @if (participant.plongeur && (participant.membreGroupeId !== null || plongeursLiables().length > 0)) {
        <label for="p-plongeur-groupe">Plongeur du groupe</label>
        <select id="p-plongeur-groupe" [ngModel]="participant.membreGroupeId" (ngModelChange)="lierAuPlongeur($event)">
          <option [ngValue]="null">— aucun groupe de plongeurs —</option>
          @for (g of sejour()?.groupesProposes ?? []; track g.id) {
            <optgroup [label]="g.nom">
              @for (m of g.plongeurs; track m.id) {
                @if (m.id === participant.membreGroupeId || estLiable(m.id)) {
                  <option [ngValue]="m.id">{{ m.prenom }} {{ m.nom }}@if (m.aptitude) { ({{ m.aptitude }})}</option>
                }
              }
            </optgroup>
          }
        </select>
        <p class="secondaire">Lié à un plongeur du groupe, le nom, le prénom et l'e-mail suivent : changés ici, ils le
          sont dans le groupe, et inversement.</p>
      }

      @if ((sejour()?.participants ?? []).length > 0) {
        <label for="p-meme-voyage">Même voyage que…</label>
        <select id="p-meme-voyage" [ngModel]="null" (ngModelChange)="memeVoyageQue($event)">
          <option [ngValue]="null">— reprendre l'arrivée et le départ d'un autre participant —</option>
          @for (autre of sejour()?.participants ?? []; track autre.id) {
            @if (autre.id !== participantId && (autre.arrivee || autre.depart)) {
              <option [ngValue]="autre.id">{{ nomComplet(autre) }} ({{ texteTrajet(autre.arrivee) }})</option>
            }
          }
        </select>
      }
      @for (sens of sensTrajets; track sens.code) {
        <fieldset>
          <legend>{{ sens.libelle }}</legend>
          <div class="grille">
            <div><label [for]="'p-' + sens.code + '-date'">Jour</label>
              <input [id]="'p-' + sens.code + '-date'" type="date" [(ngModel)]="participant[sens.code].date"></div>
            <div><label [for]="'p-' + sens.code + '-heure'">{{ sens.heure }}</label>
              <input [id]="'p-' + sens.code + '-heure'" type="time" [(ngModel)]="participant[sens.code].heure"></div>
            <div><label [for]="'p-' + sens.code + '-moyen'">Moyen</label>
              <select [id]="'p-' + sens.code + '-moyen'" [(ngModel)]="participant[sens.code].transport">
                <option [ngValue]="null">—</option>
                @for (t of transports; track t.code) { <option [ngValue]="t.code">{{ t.libelle }}</option> }
              </select></div>
            <div><label [for]="'p-' + sens.code + '-numero'">N° de vol ou de train</label>
              <input [id]="'p-' + sens.code + '-numero'" [(ngModel)]="participant[sens.code].numero" maxlength="30"
                     placeholder="AF7520"></div>
            <div><label [for]="'p-' + sens.code + '-lieu'">{{ sens.lieu }}</label>
              <input [id]="'p-' + sens.code + '-lieu'" [(ngModel)]="participant[sens.code].lieu" maxlength="120"></div>
            @if (sens.code === 'arrivee') {
              <div><label for="p-arrivee-date-depart">Jour de départ de l'avion ou du train</label>
                <input id="p-arrivee-date-depart" type="date" [(ngModel)]="participant.arrivee.dateDepart"></div>
              <div><label for="p-arrivee-heure-depart">Heure de départ de l'avion ou du train</label>
                <input id="p-arrivee-heure-depart" type="time" [(ngModel)]="participant.arrivee.heureDepart"></div>
              <div><label for="p-arrivee-lieu-depart">Aéroport ou gare de départ</label>
                <input id="p-arrivee-lieu-depart" [(ngModel)]="participant.arrivee.lieuDepart" maxlength="120"
                       placeholder="Paris-Orly"></div>
            } @else {
              <div><label for="p-depart-date-arrivee">Jour d'arrivée de l'avion ou du train</label>
                <input id="p-depart-date-arrivee" type="date" [(ngModel)]="participant.depart.dateArrivee"></div>
              <div><label for="p-depart-heure-arrivee">Heure d'arrivée de l'avion ou du train</label>
                <input id="p-depart-heure-arrivee" type="time" [(ngModel)]="participant.depart.heureArrivee"></div>
              <div><label for="p-depart-lieu-arrivee">Aéroport ou gare d'arrivée</label>
                <input id="p-depart-lieu-arrivee" [(ngModel)]="participant.depart.lieuArrivee" maxlength="120"
                       placeholder="Paris-Orly"></div>
            }
            @if (participant[sens.code].transport && participant[sens.code].transport !== 'VOITURE') {
              <div><label [for]="'p-' + sens.code + '-terminal'">Terminal de départ</label>
                <input [id]="'p-' + sens.code + '-terminal'" [(ngModel)]="participant[sens.code].terminal" maxlength="30"
                       placeholder="4"></div>
              <div><label [for]="'p-' + sens.code + '-ouverture'">Ouverture de l'enregistrement en ligne</label>
                <input [id]="'p-' + sens.code + '-ouverture'" type="datetime-local"
                       [(ngModel)]="participant[sens.code].ouvertureEnregistrement"></div>
              <div><label [for]="'p-' + sens.code + '-dossier'">N° de dossier (réservation)</label>
                <input [id]="'p-' + sens.code + '-dossier'" [(ngModel)]="participant[sens.code].dossier" maxlength="30"
                       placeholder="ABC123" autocapitalize="characters"></div>
              <div><label [for]="'p-' + sens.code + '-lien'">Lien d'enregistrement</label>
                <input [id]="'p-' + sens.code + '-lien'" type="url" [(ngModel)]="participant[sens.code].lienEnregistrement"
                       maxlength="500" placeholder="https://…"></div>
            }
          </div>
          @if (participant[sens.code].transport && participant[sens.code].transport !== 'VOITURE') {
            <p class="secondaire">Le n° de dossier et le lien ne sont vus que par le voyageur et les organisateurs.</p>
          }
        </fieldset>
      }

      <fieldset>
        <legend>Repas</legend>
        <div class="regimes">
          @for (r of regimes; track r.code) {
            <label class="case"><input type="checkbox" [checked]="participant.regimes.includes(r.code)"
                                       (change)="basculerRegime(r.code)"> {{ r.libelle }}</label>
          }
        </div>
        <label for="p-precision">Précision pour la cuisine</label>
        <input id="p-precision" [(ngModel)]="participant.regimePrecision" maxlength="300" placeholder="Pas de poisson cru…">
        <p class="secondaire">Aucune information médicale ici (allergie, traitement) : seulement des choix de table.</p>
      </fieldset>

      <fieldset>
        <legend>Personne à prévenir en cas d'urgence</legend>
        <div class="grille">
          <div><label for="p-urg-nom">Nom</label><input id="p-urg-nom" [(ngModel)]="participant.urgenceNom" maxlength="120"></div>
          <div><label for="p-urg-tel">Téléphone</label>
            <input id="p-urg-tel" type="tel" [(ngModel)]="participant.urgenceTelephone" maxlength="30"></div>
        </div>
      </fieldset>
      <label for="p-remarques">Remarques</label>
      <textarea id="p-remarques" rows="2" [(ngModel)]="participant.remarques"></textarea>
      <div class="actions-dialogue">
        <button type="button" class="bouton-principal" (click)="enregistrerParticipant()" [disabled]="envoi()">Enregistrer</button>
        <button type="button" class="bouton-discret" (click)="participantOuvert.set(false)">Annuler</button>
      </div>
    </app-dialogue>

    <app-dialogue [ouvert]="voitureOuverte()" [large]="true" [erreur]="erreur()"
                  [titre]="voitureId === null ? 'Ajouter une voiture' : 'Modifier la voiture'"
                  (fermer)="voitureOuverte.set(false)">
      <div class="grille">
        <div><label for="v-nom">Nom *</label>
          <input id="v-nom" [(ngModel)]="voiture.nom" maxlength="120" placeholder="Voiture de Gwendoline"></div>
        <div><label for="v-places">Places, conducteur compris *</label>
          <input id="v-places" type="number" min="1" max="9" [(ngModel)]="voiture.places"></div>
        <div><label for="v-conducteur">Conducteur</label>
          <select id="v-conducteur" [(ngModel)]="voiture.conducteurId">
            <option [ngValue]="null">À trouver</option>
            @for (p of sejour()?.participants ?? []; track p.id) {
              @let ailleurs = autreVoiture(p.id);
              <option [ngValue]="p.id" [disabled]="!!ailleurs">{{ nomComplet(p) }}@if (ailleurs) { (déjà dans « {{ ailleurs }} »)}</option>
            }
          </select></div>
        <div><label for="v-trajet">Trajet</label>
          <input id="v-trajet" [(ngModel)]="voiture.trajet" maxlength="200" placeholder="Aller-retour depuis le club"></div>
      </div>
      <fieldset>
        <legend>Passagers</legend>
        <p class="aide">Une personne n'est que dans une seule voiture : celles déjà dans une autre
          voiture (conducteur ou passager) sont grisées.</p>
        <div class="regimes">
          @for (p of sejour()?.participants ?? []; track p.id) {
            @if (p.id !== voiture.conducteurId) {
              @let ailleurs = autreVoiture(p.id);
              <label class="case" [class.indisponible]="ailleurs">
                <input type="checkbox" [checked]="voiture.passagerIds.includes(p.id)"
                       [disabled]="!!ailleurs && !voiture.passagerIds.includes(p.id)"
                       (change)="basculer(voiture.passagerIds, p.id)"> {{ nomComplet(p) }}
                @if (ailleurs) { <small>(déjà dans « {{ ailleurs }} »)</small> }</label>
            }
          }
        </div>
      </fieldset>
      <label for="v-remarques">Remarques</label>
      <textarea id="v-remarques" rows="2" [(ngModel)]="voiture.remarques"></textarea>
      <div class="actions-dialogue">
        <button type="button" class="bouton-principal" (click)="enregistrerVoiture()" [disabled]="envoi()">Enregistrer</button>
        <button type="button" class="bouton-discret" (click)="voitureOuverte.set(false)">Annuler</button>
      </div>
    </app-dialogue>

    <app-dialogue [ouvert]="logementOuvert()" [large]="true" [erreur]="erreur()"
                  [titre]="logementId === null ? 'Ajouter un logement' : 'Modifier le logement'"
                  (fermer)="logementOuvert.set(false)">
      <div class="grille">
        <div><label for="l-nom">Nom *</label><input id="l-nom" [(ngModel)]="logement.nom" maxlength="120" placeholder="Gîte des Salins"></div>
        <div><label for="l-adresse">Adresse</label><input id="l-adresse" [(ngModel)]="logement.adresse" maxlength="300"></div>
      </div>
      <label for="l-remarques">Remarques</label>
      <textarea id="l-remarques" rows="2" [(ngModel)]="logement.remarques" placeholder="Code de la boîte à clés, horaires…"></textarea>
      @for (c of logement.chambres; track $index; let i = $index) {
        <fieldset>
          <legend>Chambre {{ i + 1 }}</legend>
          <div class="grille">
            <div><label [for]="'c-nom-' + i">Nom *</label><input [id]="'c-nom-' + i" [(ngModel)]="c.nom" maxlength="120"></div>
            <div><label [for]="'c-couchages-' + i">Couchages *</label>
              <input [id]="'c-couchages-' + i" type="number" min="1" max="30" [(ngModel)]="c.couchages"></div>
            <div><label [for]="'c-remarques-' + i">Remarques</label>
              <input [id]="'c-remarques-' + i" [(ngModel)]="c.remarques" maxlength="300" placeholder="Lit double"></div>
          </div>
          <p class="secondaire">Occupants ({{ c.occupantIds.length }} / {{ c.couchages }})</p>
          <div class="regimes">
            @for (p of sejour()?.participants ?? []; track p.id) {
              @if (c.occupantIds.includes(p.id) || libre(p.id)) {
                <label class="case"><input type="checkbox" [checked]="c.occupantIds.includes(p.id)"
                                           (change)="basculer(c.occupantIds, p.id)"> {{ nomComplet(p) }}</label>
              }
            }
          </div>
          <button type="button" class="bouton-discret danger" (click)="logement.chambres.splice(i, 1)">Retirer la chambre</button>
        </fieldset>
      }
      <button type="button" class="bouton-discret" (click)="ajouterChambre()">+ Ajouter une chambre</button>
      <div class="actions-dialogue">
        <button type="button" class="bouton-principal" (click)="enregistrerLogement()" [disabled]="envoi()">Enregistrer</button>
        <button type="button" class="bouton-discret" (click)="logementOuvert.set(false)">Annuler</button>
      </div>
    </app-dialogue>

    <app-dialogue [ouvert]="affairesOuvertes()" [large]="true" [erreur]="erreur()" titre="Affaires à prévoir"
                  (fermer)="affairesOuvertes.set(false)">
      <button type="button" class="bouton-discret" (click)="partirDeLaListeType()">Partir de la liste type</button>
      <ul class="edition-affaires">
        @for (a of affaires; track $index; let i = $index) {
          <li>
            <select [attr.aria-label]="'Rubrique de la ligne ' + (i + 1)" [(ngModel)]="a.categorie">
              @for (c of categories; track c.code) { <option [ngValue]="c.code">{{ c.libelle }}</option> }
            </select>
            <input [attr.aria-label]="'Affaire ' + (i + 1)" [(ngModel)]="a.libelle" maxlength="200">
            <label class="case"><input type="checkbox" [(ngModel)]="a.indispensable"> Indispensable</label>
            <button type="button" class="bouton-discret danger" [attr.aria-label]="'Retirer la ligne ' + (i + 1)"
                    (click)="affaires.splice(i, 1)">✕</button>
          </li>
        }
      </ul>
      <button type="button" class="bouton-discret" (click)="ajouterAffaire()">
        + Ajouter une ligne
      </button>
      <div class="actions-dialogue">
        <button type="button" class="bouton-principal" (click)="enregistrerAffaires()" [disabled]="envoi()">Enregistrer</button>
        <button type="button" class="bouton-discret" (click)="affairesOuvertes.set(false)">Annuler</button>
      </div>
    </app-dialogue>

    <!-- Choisir à qui envoyer un e-mail du séjour : relancer ceux qui ne l'ont pas reçu sans l'envoyer à tous (demande du club, 2026). -->
    <app-dialogue [ouvert]="destinatairesOuverts()" [large]="true" [erreur]="erreur()"
                  [titre]="envoiChoisi === 'carnet' ? 'Envoyer le carnet par e-mail' : 'Demander leurs informations'"
                  (fermer)="destinatairesOuverts.set(false)">
      <p>
        {{ envoiChoisi === 'carnet'
          ? 'Chaque personne cochée reçoit son carnet du séjour à jour.'
          : 'Chaque personne cochée reçoit un e-mail pour renseigner son voyage, ses repas, la personne à prévenir et ses frais.' }}
        Les autres ne reçoivent rien.
      </p>
      <fieldset>
        <legend>À qui envoyer</legend>
        <div class="actions">
          <button type="button" class="bouton-discret" (click)="cocherDestinataires('tous')">Tout le monde</button>
          @if (envoiChoisi === 'invitations') {
            <button type="button" class="bouton-discret" (click)="cocherDestinataires('incomplets')">Ceux à qui il manque des infos</button>
          }
          <button type="button" class="bouton-discret" (click)="cocherDestinataires('personne')">Personne</button>
        </div>
        <ul class="liste-vol">
          @for (p of sejour()?.participants ?? []; track p.id) {
            <li>
              <label class="case"><input type="checkbox" [disabled]="!p.email" [checked]="destinataires.includes(p.id)"
                                         (change)="basculer(destinataires, p.id)">
                {{ nomComplet(p) }}</label>
              <span class="secondaire">{{ p.email ?? "pas d'e-mail" }}</span>
            </li>
          }
        </ul>
      </fieldset>
      <div class="actions-dialogue">
        <button type="button" class="bouton-principal" (click)="envoyerAuxDestinataires()"
                [disabled]="envoi() || destinataires.length === 0">
          Envoyer à {{ destinataires.length }} personne{{ destinataires.length > 1 ? 's' : '' }}
        </button>
        <button type="button" class="bouton-discret" (click)="destinatairesOuverts.set(false)">Annuler</button>
      </div>
    </app-dialogue>

    <app-dialogue [ouvert]="volOuvert()" [large]="true" [erreur]="erreur()" titre="Un même vol pour plusieurs participants"
                  (fermer)="volOuvert.set(false)">
      <div class="grille">
        <div><label for="vc-sens">C'est</label>
          <select id="vc-sens" [(ngModel)]="vol.sens">
            <option ngValue="ARRIVEE">Une arrivée</option>
            <option ngValue="DEPART">Un départ</option>
          </select></div>
        @if (volsConnus().length > 0) {
          <div><label for="vc-connu">Partir d'un vol déjà saisi</label>
            <select id="vc-connu" [ngModel]="null" (ngModelChange)="reprendreVol($event)">
              <option [ngValue]="null">—</option>
              @for (g of volsConnus(); track $index; let i = $index) {
                <option [ngValue]="i">{{ g.quand }}@if (g.comment) { · {{ g.comment }}} ({{ g.noms.length }})</option>
              }
            </select></div>
        }
      </div>
      <div class="grille">
        <div><label for="vc-date">Jour</label><input id="vc-date" type="date" [(ngModel)]="vol.trajet.date"></div>
        <div><label for="vc-heure">{{ vol.sens === 'ARRIVEE' ? "Heure d'arrivée" : 'Heure de départ' }}</label>
          <input id="vc-heure" type="time" [(ngModel)]="vol.trajet.heure"></div>
        <div><label for="vc-moyen">Moyen</label>
          <select id="vc-moyen" [(ngModel)]="vol.trajet.transport">
            <option [ngValue]="null">—</option>
            @for (t of transports; track t.code) { <option [ngValue]="t.code">{{ t.libelle }}</option> }
          </select></div>
        <div><label for="vc-numero">N° de vol ou de train</label>
          <input id="vc-numero" [(ngModel)]="vol.trajet.numero" maxlength="30" placeholder="AF7520"></div>
        <div><label for="vc-lieu">{{ vol.sens === 'ARRIVEE' ? "Aéroport, gare ou lieu d'arrivée" : 'Aéroport, gare ou lieu de départ' }}</label>
          <input id="vc-lieu" [(ngModel)]="vol.trajet.lieu" maxlength="120"></div>
        @if (vol.sens === 'ARRIVEE') {
          <div><label for="vc-date-depart">Jour de départ de l'avion ou du train</label>
            <input id="vc-date-depart" type="date" [(ngModel)]="vol.trajet.dateDepart"></div>
          <div><label for="vc-heure-depart">Heure de départ de l'avion ou du train</label>
            <input id="vc-heure-depart" type="time" [(ngModel)]="vol.trajet.heureDepart"></div>
          <div><label for="vc-lieu-depart">Aéroport ou gare de départ</label>
            <input id="vc-lieu-depart" [(ngModel)]="vol.trajet.lieuDepart" maxlength="120" placeholder="Paris-Orly"></div>
        } @else {
          <div><label for="vc-date-arrivee">Jour d'arrivée de l'avion ou du train</label>
            <input id="vc-date-arrivee" type="date" [(ngModel)]="vol.trajet.dateArrivee"></div>
          <div><label for="vc-heure-arrivee">Heure d'arrivée de l'avion ou du train</label>
            <input id="vc-heure-arrivee" type="time" [(ngModel)]="vol.trajet.heureArrivee"></div>
          <div><label for="vc-lieu-arrivee">Aéroport ou gare d'arrivée</label>
            <input id="vc-lieu-arrivee" [(ngModel)]="vol.trajet.lieuArrivee" maxlength="120" placeholder="Paris-Orly"></div>
        }
        @if (vol.trajet.transport && vol.trajet.transport !== 'VOITURE') {
          <div><label for="vc-terminal">Terminal de départ</label>
            <input id="vc-terminal" [(ngModel)]="vol.trajet.terminal" maxlength="30" placeholder="4"></div>
          <div><label for="vc-ouverture">Ouverture de l'enregistrement en ligne</label>
            <input id="vc-ouverture" type="datetime-local" [(ngModel)]="vol.trajet.ouvertureEnregistrement"></div>
          <div><label for="vc-dossier">N° de dossier commun</label>
            <input id="vc-dossier" [(ngModel)]="vol.trajet.dossier" maxlength="30" placeholder="ABC123"
                   autocapitalize="characters"></div>
          <div><label for="vc-lien">Lien d'enregistrement commun</label>
            <input id="vc-lien" type="url" [(ngModel)]="vol.trajet.lienEnregistrement" maxlength="500" placeholder="https://…"></div>
        }
      </div>
      @if (vol.trajet.transport && vol.trajet.transport !== 'VOITURE') {
        <p class="secondaire">Dossier et lien laissés vides : chacun garde le sien (une réservation de groupe : un seul dossier pour tous).</p>
      }
      <fieldset>
        <legend>Qui prend ce {{ vol.trajet.transport === 'TRAIN' ? 'train' : 'vol' }}</legend>
        <div class="actions">
          <button type="button" class="bouton-discret" (click)="cocherVol('tous')">Tout le monde</button>
          <button type="button" class="bouton-discret" (click)="cocherVol('sans')">Ceux qui n'ont rien</button>
          <button type="button" class="bouton-discret" (click)="cocherVol('personne')">Personne</button>
        </div>
        <ul class="liste-vol">
          @for (p of sejour()?.participants ?? []; track p.id) {
            <li>
              <label class="case"><input type="checkbox" [checked]="vol.ids.includes(p.id)" (change)="basculer(vol.ids, p.id)">
                {{ nomComplet(p) }}</label>
              <span class="secondaire">{{ trajetActuel(p) }}</span>
            </li>
          }
        </ul>
        <p class="secondaire">Les personnes cochées prennent ce trajet ; celui qu'elles avaient est remplacé. Les autres ne changent pas.</p>
      </fieldset>
      <div class="actions-dialogue">
        <button type="button" class="bouton-principal" (click)="enregistrerVolCommun()" [disabled]="envoi()">
          Enregistrer pour {{ vol.ids.length }} personne{{ vol.ids.length > 1 ? 's' : '' }}
        </button>
        <button type="button" class="bouton-discret" (click)="volOuvert.set(false)">Annuler</button>
      </div>
    </app-dialogue>

    <app-dialogue [ouvert]="evenementOuvert()" [erreur]="erreur()"
                  [titre]="evenementId === null ? 'Ajouter un rendez-vous' : 'Modifier le rendez-vous'"
                  (fermer)="evenementOuvert.set(false)">
      <div class="grille">
        <div><label for="e-jour">Jour *</label><input id="e-jour" type="date" [(ngModel)]="evenement.jour"></div>
        <div><label for="e-debut">De</label><input id="e-debut" type="time" [(ngModel)]="evenement.heureDebut"></div>
        <div><label for="e-fin">À</label><input id="e-fin" type="time" [(ngModel)]="evenement.heureFin"></div>
      </div>
      <label for="e-titre">Quoi *</label>
      <input id="e-titre" [(ngModel)]="evenement.titre" maxlength="160" placeholder="Rendez-vous au ponton">
      <label for="e-lieu">Où</label>
      <input id="e-lieu" [(ngModel)]="evenement.lieu" maxlength="160">
      <label for="e-details">Détails</label>
      <textarea id="e-details" rows="2" [(ngModel)]="evenement.details"></textarea>
      <div class="actions-dialogue">
        <button type="button" class="bouton-principal" (click)="enregistrerEvenement()" [disabled]="envoi()">Enregistrer</button>
        @if (evenementId !== null) {
          <button type="button" class="bouton-discret danger" (click)="supprimerEvenement()">Supprimer</button>
        }
        <button type="button" class="bouton-discret" (click)="evenementOuvert.set(false)">Annuler</button>
      </div>
    </app-dialogue>

    <app-dialogue [ouvert]="infosOuvertes()" [large]="true" [erreur]="erreur()" titre="Infos pratiques"
                  (fermer)="infosOuvertes.set(false)">
      <label for="i-texte">Numéros utiles, rendez-vous, centre de plongée, caisson le plus proche…</label>
      <textarea id="i-texte" rows="10" [(ngModel)]="infos"></textarea>
      <div class="actions-dialogue">
        <button type="button" class="bouton-principal" (click)="enregistrerInfos()" [disabled]="envoi()">Enregistrer</button>
        <button type="button" class="bouton-discret" (click)="infosOuvertes.set(false)">Annuler</button>
      </div>
    </app-dialogue>

    <app-dialogue [ouvert]="conseilOuvert()" [large]="true" [erreur]="erreur()" titre="Conseil d'assurance"
                  (fermer)="conseilOuvert.set(false)">
      <label for="c-assurance">Montré dans « Mon séjour » à chaque participant qui n'a pas encore joint son attestation d'assurance. Les adresses web y deviennent des liens. Laissé vide, c'est le message type qui s'affiche.</label>
      <textarea id="c-assurance" rows="6" maxlength="2000" [(ngModel)]="conseil"></textarea>
      <p>
        <button type="button" class="bouton-discret" (click)="conseil = conseilType">Reprendre le message type (Lafont)</button>
      </p>
      <div class="actions-dialogue">
        <button type="button" class="bouton-principal" (click)="enregistrerConseilAssurance()" [disabled]="envoi()">Enregistrer</button>
        <button type="button" class="bouton-discret" (click)="conseilOuvert.set(false)">Annuler</button>
      </div>
    </app-dialogue>

    <app-dialogue [ouvert]="organisateursOuverts()" [erreur]="erreur()" titre="Organisateurs du séjour"
                  (fermer)="organisateursOuverts.set(false)">
      <p class="aide">
        Les organisateurs modifient le séjour avec vous : participants, voitures, hébergement, programme, frais,
        envois par e-mail. Les autres moniteurs le lisent avec leur compte, les participants par le lien reçu par e-mail.
      </p>
      @if (candidats().length === 0) {
        <p class="secondaire">Chargement des moniteurs…</p>
      }
      @for (m of candidats(); track m.id) {
        <label class="case" [class.indisponible]="estCreateur(m.id)">
          <input type="checkbox" [checked]="estCreateur(m.id) || organisateursChoisis().has(m.id)"
                 [disabled]="estCreateur(m.id)" (change)="basculerOrganisateur(m.id)" />
          {{ m.nomComplet }}@if (estCreateur(m.id)) { (créateur, toujours organisateur) }
        </label>
      }
      <div class="actions-dialogue">
        <button type="button" class="bouton-principal" (click)="enregistrerOrganisateurs()" [disabled]="envoi()">Enregistrer</button>
        <button type="button" class="bouton-discret" (click)="organisateursOuverts.set(false)">Annuler</button>
      </div>
    </app-dialogue>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .entete h1 { margin-bottom: 4px; }
    .entete p { margin: 0 0 var(--pas-2); }
    .bandeau-organisation { display: flex; justify-content: space-between; align-items: center; gap: var(--pas) var(--pas-2);
                            flex-wrap: wrap; padding: var(--pas) var(--pas-2); margin-bottom: var(--pas-2); }
    .organisateurs { display: flex; align-items: center; gap: 4px var(--pas); flex-wrap: wrap; min-height: 44px; }
    .etiquette { font-size: .8125rem; text-transform: uppercase; letter-spacing: .04em; color: var(--craie); font-weight: 700; }
    .pastille.droit { background: var(--acquis-clair); color: var(--acquis); }
    .pastille.vue-participant { background: var(--en-cours-clair); color: var(--en-cours); }
    .mode-participant[aria-pressed="true"] { border-color: var(--en-cours); color: var(--en-cours); font-weight: 700; }
    @media print { .mode-participant { display: none; } }
    .bouton-lien { background: none; border: none; padding: 0 4px; min-height: 44px; color: var(--profond); font: inherit;
                   font-weight: 700; text-decoration: underline; cursor: pointer; }
    .barre-actions { display: flex; gap: var(--pas); flex-wrap: wrap; }
    .barre-actions .action { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; text-decoration: none;
                             border: 1px solid var(--trait); border-radius: var(--r-s); color: var(--encre); }
    @media (max-width: 640px) {
      .barre-actions { width: 100%; }
      .barre-actions .action { flex: 1 1 100%; justify-content: center; }
    }
    h2 { margin: var(--pas-3, 24px) 0 var(--pas); }
    h3 { margin: var(--pas) 0; font-size: 1rem; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0 var(--pas-2); }
    fieldset { border: 1px solid var(--trait); border-radius: var(--r-s); margin: var(--pas-2) 0; padding: var(--pas) var(--pas-2); }
    legend { font-weight: 700; padding: 0 var(--pas); }
    textarea { resize: vertical; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; align-items: center; }
    .titre-section { display: flex; justify-content: space-between; align-items: center; gap: var(--pas); flex-wrap: wrap; }
    .avertissements { margin: var(--pas-2) 0; padding: var(--pas) var(--pas-2) var(--pas) 2rem; border-radius: var(--r-s);
                      background: var(--en-cours-clair); color: var(--en-cours); }
    .encart-frais { margin: var(--pas-2) 0; padding: var(--pas-2); display: flex; align-items: center; gap: var(--pas-2);
                    flex-wrap: wrap; border-left: 6px solid var(--accent); }
    .encart-frais-texte { flex: 1 1 18rem; }
    .encart-frais h2 { margin: 0; }
    .encart-frais p { margin: var(--pas) 0 0; }
    .encart-frais-moi { font-weight: 700; color: var(--profond); }
    .encart-frais .bouton-principal { min-height: 48px; font-size: 1.0625rem; }
    summary { min-height: 44px; display: flex; align-items: center; gap: 4px var(--pas); flex-wrap: wrap; cursor: pointer; }
    .liste-participants { list-style: none; margin: var(--pas) 0 0; padding: 0; display: grid; gap: var(--pas); }
    .liste-participants > li { padding: 0 var(--pas-2); }
    .liste-participants details[open] { padding-bottom: var(--pas-2); }
    .liste-participants p { margin: var(--pas) 0 0; }
    .etat-infos { margin-left: auto; font-size: .8125rem; color: var(--en-cours); }
    .etat-infos.complet { color: #047857; }
    .lignes-repas { margin: 0; padding-left: 1.25rem; display: grid; gap: 4px; }
    .cartes { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2);
              grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
    .cartes > li { padding: var(--pas-2); }
    .cartes > li.vol { padding: 0; break-inside: avoid; }
    /* Les voitures bien séparées des vols au-dessus. */
    .section-voitures { margin-top: calc(var(--pas-2) * 2); padding-top: var(--pas-2); border-top: 2px solid var(--trait); }
    .passagers { margin-top: var(--pas); padding-top: var(--pas); border-top: 1px solid var(--trait); }
    .titre-passagers { margin: 0; font-size: .75rem; font-weight: 700; text-transform: uppercase;
                       letter-spacing: .04em; color: var(--craie); }
    .passagers ul { margin: 4px 0 var(--pas); padding-left: 1.25rem; }
    .passagers li { padding: 2px 0; }
    .carte-passager { margin: 2px 0 2px var(--pas); min-height: 44px; }
    .conseil-assurance { margin: var(--pas) 0; padding: var(--pas) var(--pas-2); }
    .conseil-assurance p { margin: var(--pas) 0 0; }
    .conseil-assurance button { min-height: 44px; }
    .cartes p { margin: var(--pas) 0 0; }
    .ligne { display: flex; justify-content: space-between; align-items: center; gap: var(--pas); }
    .nom { font-weight: 700; }
    .pastille { flex: none; padding: 2px 10px; border-radius: var(--r-s); font-size: .8125rem; font-weight: 700;
                background: #E0F2FE; color: var(--profond-fonce); }
    .pastille.accompagnant { background: #F1F5F9; color: var(--craie); }
    .pastille.plein { background: var(--en-cours-clair); color: var(--en-cours); }
    .texte-libre { white-space: pre-line; display: block; }
    .jour { padding: var(--pas-2); margin-bottom: var(--pas-2); }
    .jour.aujourdhui { border-left: 6px solid var(--profond); }
    .jour h3 { margin-top: 0; }
    .lignes { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas); }
    .lignes li { display: flex; gap: var(--pas-2); align-items: flex-start; }
    .heure { flex: none; width: 6.5rem; font-weight: 700; color: var(--profond-fonce); }
    .quoi { flex: 1; }
    .boutons-ligne { flex: none; }
    .deux-colonnes { display: grid; gap: var(--pas-2); grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    .logement { padding: var(--pas-2); margin-bottom: var(--pas-2); }
    .logement h3 { margin: 0; }
    .chambres { list-style: none; margin: var(--pas) 0 0; padding: 0; display: grid; gap: var(--pas);
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
    .chambres li { border: 1px solid var(--trait); border-radius: var(--r-s); padding: var(--pas); }
    .chambres p { margin: var(--pas) 0 0; }
    .coches { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas); }
    .coches li { display: flex; gap: var(--pas); align-items: baseline; flex-wrap: wrap; }
    .case-papier { flex: none; width: 14px; height: 14px; border: 2px solid var(--craie); border-radius: 3px; }
    .indispensable { font-size: .8125rem; color: var(--en-cours); }
    .regimes { display: flex; flex-wrap: wrap; gap: 0 var(--pas-2); }
    .case { display: flex; align-items: center; gap: var(--pas); font-weight: 400; min-height: 44px; margin: 0; }
    .case input { width: auto; flex: none; }
    .case.indisponible { color: var(--craie); }
    .aide { margin: 0 0 var(--pas); font-size: .9rem; color: var(--craie); }
    .liste-vol { list-style: none; margin: var(--pas) 0 0; padding: 0; display: grid; gap: 0 var(--pas-2);
                 grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .liste-vol li { display: flex; flex-direction: column; padding-bottom: var(--pas); }
    .liste-vol .secondaire { font-size: .8125rem; margin-left: calc(var(--pas) + 20px); }
    .edition-affaires { list-style: none; margin: var(--pas-2) 0; padding: 0; display: grid; gap: var(--pas); }
    .edition-affaires li { display: grid; grid-template-columns: 10rem 1fr auto auto; gap: var(--pas); align-items: center; }
    .edition-affaires input, .edition-affaires select { margin: 0; }
    @media (max-width: 640px) {
      .edition-affaires li { grid-template-columns: 1fr auto; }
      .heure { width: 4.5rem; }
    }
    .danger { color: #B91C1C; border-color: #FCA5A5; }
    .bandeau-hors-ligne { padding: var(--pas-2); margin: var(--pas-2) 0; background: var(--en-cours-clair); }
    .bandeau-hors-ligne p { margin: 0 0 var(--pas); }
    .bandeau-hors-ligne .en-attente { margin: 0 0 var(--pas); padding-left: var(--pas-3); font-size: .9rem; }
    .envoyer-maintenant { min-height: 44px; }
    .acces-frais { display: flex; align-items: center; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }
    @media print {
      .sans-impression { display: none !important; }
      .carte { break-inside: avoid; box-shadow: none; }
    }
  `]
})
export class SejourComponent {
  private api = inject(SejourApi);
  private apiClub = inject(ApiService);
  private route = inject(ActivatedRoute);

  readonly periode = periode;
  readonly euros = euros;
  readonly jourLong = jourLong;
  readonly nomComplet = nomComplet;
  readonly regimes = REGIMES;
  readonly transports = TRANSPORTS;
  readonly categories = CATEGORIES;
  readonly sensTrajets = [
    { code: 'arrivee' as const, libelle: 'Arrivées', heure: "Heure d'arrivée", lieu: "Aéroport, gare ou lieu d'arrivée" },
    { code: 'depart' as const, libelle: 'Départs', heure: 'Heure de départ', lieu: 'Aéroport, gare ou lieu de départ' }
  ];

  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  readonly fileSejour = inject(FileSejourService);
  readonly reseau = inject(ReseauService);
  /** Le séjour tel que le serveur (ou la copie du téléphone) le connaît. */
  private base = signal<SejourVue | null>(null);
  /** Ce qui est montré : la base, avec les modifications qui attendent d'être envoyées. */
  readonly sejour = computed(() => {
    const b = this.base();
    return b ? appliquerEnAttente(b, this.fileSejour.pour(this.id)) : null;
  });
  readonly enAttente = computed(() => this.fileSejour.pour(this.id));
  /** La date de la copie montrée faute de réseau ; null : lu sur le serveur. */
  copieDu = signal<number | null>(null);
  /** Un encadrant regarde le séjour comme un participant (« Voir comme un participant »). */
  commeParticipant = signal(false);
  chargement = signal(true);
  message = signal<string | null>(null);
  erreur = signal<string | null>(null);
  envoi = signal(false);
  onglet = signal<Onglet>('programme');
  /** La fenêtre « Trombinoscope » du bandeau Organisation (tous les participants, réseau obligatoire). */
  trombinoscopeOuvert = signal(false);

  /**
   * Les avertissements du serveur (SejourService.avertissements), rangés
   * dans l'onglet qui permet de les régler : chambres dans Hébergement,
   * voitures dans Transports.
   */
  readonly avertissementsDe = computed(() => {
    const liste = this.sejour()?.avertissements ?? [];
    const chambre = (a: string) => a.startsWith('Chambre ') || a.startsWith('Sans chambre');
    return { hebergement: liste.filter(chambre), transports: liste.filter(a => !chambre(a)) };
  });

  readonly onglets = computed(() => {
    const s = this.sejour();
    const a = this.avertissementsDe();
    const liste: OptionOnglet<Onglet>[] = [
      { valeur: 'frais', libelle: 'Frais' },
      { valeur: 'programme', libelle: 'Programme' },
      { valeur: 'participants', libelle: 'Participants' },
      { valeur: 'transports', libelle: 'Transports', alertes: a.transports.length },
      { valeur: 'hebergement', libelle: 'Hébergement', alertes: a.hebergement.length },
      { valeur: 'materiel', libelle: 'Matériel' },
      { valeur: 'courses', libelle: 'Courses' },
      { valeur: 'restaurant', libelle: 'Restaurant' },
      { valeur: 'pratique', libelle: 'Pratique' }
    ];
    return s?.encadrant ? liste : liste.filter(o => o.valeur !== 'participants' && o.valeur !== 'courses');
  });

  /** Ceux qui ont tout renseigné (arrivée, départ, personne à prévenir), pour l'onglet Participants. */
  readonly complets = computed(() => (this.sejour()?.participants ?? []).filter(p => this.manque(p).length === 0).length);
  /** Qui a joint son attestation d'assurance : le serveur ne le dit qu'aux organisateurs. */
  readonly assures = computed(() => (this.sejour()?.participants ?? []).filter(p => !!p.attestationAssurance).length);

  readonly moi = computed(() => this.sejour()?.participants.find(p => p.moi) ?? null);
  private readonly parId = computed(() => new Map((this.sejour()?.participants ?? []).map(p => [p.id, p])));

  /** Les jours du séjour (et ceux des rendez-vous hors de ses dates), avec rendez-vous puis plongées. */
  readonly programme = computed(() => {
    const s = this.sejour();
    return s ? programmeParJour(s.evenements, s.sortie.seances, s.palanquees) : [];
  });

  /** La date de l'appareil : le jour du programme est marqué « aujourd'hui ». */
  readonly aujourdhui = signal(dateDuJour());

  /** Les voyages de l'encart « Aujourd'hui » : un encadrant voit ceux de tous, un participant les siens. */
  readonly voyageurs = computed(() => {
    const s = this.sejour();
    const moi = this.moi();
    return s?.encadrant ? s.participants : moi ? [moi] : [];
  });
  readonly mesComptes = computed(() => {
    const moi = this.moi();
    return moi ? this.mesRemboursements(moi.id) : [];
  });

  readonly sansRegime = computed(() => (this.sejour()?.participants ?? []).filter(p => p.regimes.length === 0));
  readonly repas = computed(() => REGIMES
    .map(r => ({
      libelle: r.libelle,
      noms: (this.sejour()?.participants ?? []).filter(p => p.regimes.includes(r.code)).map(nomComplet)
    }))
    .filter(r => r.noms.length > 0));
  readonly precisions = computed(() => (this.sejour()?.participants ?? []).filter(p => p.regimePrecision));

  // Brouillons des fenêtres de saisie.
  participantOuvert = signal(false);
  participantId: number | null = null;
  participant: BrouillonParticipant = participantVide();
  connus = signal<PlongeurConnuVue[]>([]);
  readonly optionsConnus = computed<OptionCombobox[]>(() => this.connus().map((c, i) => ({
    id: i, libelle: `${c.prenom} ${c.nom}`,
    detail: [c.niveau, c.niveauEncadrement].filter(Boolean).join(' · ') || null
  })));

  voitureOuverte = signal(false);
  voitureId: number | null = null;
  voiture: DemandeVoiture = { nom: '', places: 5, conducteurId: null, trajet: null, remarques: null, passagerIds: [] };

  logementOuvert = signal(false);
  logementId: number | null = null;
  logement: DemandeLogement = { nom: '', adresse: null, remarques: null, chambres: [] };

  affairesOuvertes = signal(false);
  affaires: DemandeAffaire[] = [];

  evenementOuvert = signal(false);
  evenementId: number | null = null;
  evenement: DemandeEvenement = { jour: '', heureDebut: null, heureFin: null, titre: '', lieu: null, details: null };

  infosOuvertes = signal(false);
  infos = '';

  conseilOuvert = signal(false);
  conseil = '';
  readonly conseilType = CONSEIL_ASSURANCE_TYPE;

  organisateursOuverts = signal(false);
  candidats = signal<MoniteurOptionVue[]>([]);
  organisateursChoisis = signal<Set<number>>(new Set());

  constructor() {
    void this.charger();
    // Une modification gardée hors ligne vient de partir : le séjour renvoyé devient la base.
    effect(() => {
      const s = this.fileSejour.sejourAJour();
      if (s?.sortie.id === this.id) untracked(() => this.maj(s));
    });
    // Le réseau revient : la copie du téléphone laisse la place au séjour à jour, une fois la file partie.
    effect(() => {
      if (this.reseau.enLigne() && untracked(this.copieDu) !== null) {
        untracked(() => void this.fileSejour.vider().then(() => this.charger()));
      }
    });
  }

  /** « le 12/06 à 18h30 », « aujourd'hui à 9h05 » : quand la copie du téléphone a été faite. */
  quand(ms: number): string {
    const d = new Date(ms);
    const deux = (n: number) => String(n).padStart(2, '0');
    const jour = d.toDateString() === new Date().toDateString()
      ? 'aujourd’hui' : `le ${deux(d.getDate())}/${deux(d.getMonth() + 1)}`;
    return `${jour} à ${d.getHours()}h${deux(d.getMinutes())}`;
  }

  envoyerMaintenant(): void {
    void this.fileSejour.vider().then(() => {
      if (this.enAttente().length === 0 && this.copieDu() !== null) void this.charger();
    });
  }

  voir(o: Onglet): boolean {
    return this.onglet() === o;
  }

  /** Ce qu'un participant n'a pas encore renseigné ; vide s'il a tout donné. */
  manque(p: ParticipantVue): string[] {
    const rien = (t: Trajet | null) => !t?.date && !t?.heure;
    return [
      rien(p.arrivee) ? 'arrivée' : null,
      rien(p.depart) ? 'départ' : null,
      !p.urgenceNom && !p.urgenceTelephone ? 'personne à prévenir' : null
    ].filter((x): x is string => x !== null);
  }

  majuscule(t: string): string {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  nomDe(id: number | null): string {
    const p = id === null ? undefined : this.parId().get(id);
    return p ? nomComplet(p) : '?';
  }

  noms(ids: number[]): string {
    return ids.map(i => this.nomDe(i)).join(', ');
  }

  aBord(v: VoitureVue): number {
    return v.passagerIds.length + (v.conducteurId ? 1 : 0);
  }

  voituresDe(id: number): VoitureVue[] {
    return (this.sejour()?.voitures ?? []).filter(v => v.conducteurId === id || v.passagerIds.includes(id));
  }

  /** Le nom de l'autre voiture où est déjà ce participant (une seule voiture par personne), sinon null. */
  autreVoiture(id: number): string | null {
    return this.voituresDe(id).find(v => v.id !== this.voitureId)?.nom ?? null;
  }

  /** « vous devez 25,00 € à Inès Roux », « vous devez 40,00 € au club », « Léo Durand vous doit 10,00 € ». */
  mesRemboursements(id: number): string[] {
    return remboursementsDe(this.sejour()?.frais.comptes.remboursements ?? [], id, i => this.nomDe(i));
  }

  libellesRegimes(codes: RegimeAlimentaire[]): string {
    return REGIMES.filter(r => codes.includes(r.code)).map(r => r.libelle.toLowerCase()).join(', ');
  }

  readonly texteTrajet = texteTrajet;

  readonly enCarte = enCarte;

  /**
   * Les passagers d'un vol, avec leur dossier : le serveur ne le renvoie
   * qu'aux organisateurs (et à chacun le sien).
   */
  passagers(g: GroupeTrajet, sens: 'arrivee' | 'depart'):
    { id: number; nom: string; dossier: string | null; carte: boolean }[] {
    return (this.sejour()?.participants ?? [])
      .filter(p => g.ids.includes(p.id))
      .map(p => ({ id: p.id, nom: nomComplet(p), dossier: p[sens]?.dossier ?? null, carte: !!p[sens]?.carteEmbarquement }));
  }

  /** Les cartes d'embarquement : la sienne dans « Mon séjour », celles des passagers pour les organisateurs. */
  readonly portCartes = this.api.portCartes(this.id, s => this.maj(s));
  /** Les attestations d'assurance : la sienne dans « Mon séjour », celles de chacun pour les organisateurs. */
  readonly portAttestations = this.api.portAttestations(this.id, s => this.maj(s));
  /** Le trombinoscope : complet pour un encadrant, celui des participants « comme un participant ». */
  readonly portTrombinoscope = computed(() => this.api.portTrombinoscope(this.id, this.commeParticipant()));

  montrerCarte(participantId: number, sens: 'arrivee' | 'depart'): void {
    this.erreur.set(null);
    montrerCarte(this.portCartes.lire(participantId, sens === 'arrivee' ? 'ARRIVEE' : 'DEPART'),
      () => this.erreur.set("La carte d'embarquement n'a pas pu être ouverte (réseau nécessaire)."));
  }

  /** Les arrivées (ou départs) regroupées par jour, heure et vol : qui attendre ensemble. */
  groupesTrajets(sens: 'arrivee' | 'depart'): GroupeTrajet[] {
    const groupes = new Map<string, GroupeTrajet & { tri: string }>();
    for (const p of this.sejour()?.participants ?? []) {
      const t = p[sens];
      if (!t || (!t.date && !t.heure)) continue;
      const cle = [t.date, t.heure?.slice(0, 5), t.transport, t.numero, t.lieu, t.heureDepart?.slice(0, 5), t.lieuDepart,
        t.heureArrivee?.slice(0, 5), t.dateDepart, t.dateArrivee, t.lieuArrivee, t.terminal,
        t.ouvertureEnregistrement?.slice(0, 16)]
        .join('|');
      const g = groupes.get(cle) ?? {
        tri: `${t.date ?? ''} ${t.heure ?? ''}`,
        quand: t.date ? jourLong(t.date) + (t.heure ? ' à ' + heure(t.heure) : '') : 'à ' + heure(t.heure),
        comment: [TRANSPORTS.find(x => x.code === t.transport)?.libelle, t.numero].filter(Boolean).join(' '),
        lieu: t.lieu,
        // « à 21h35 à Paris-Orly », ou « le mercredi 16/06/2027 à 06h10 » pour un vol qui arrive un autre jour.
        arrivee: (autreJour(t, t.dateArrivee) + (t.heureArrivee ? ' à ' + heure(t.heureArrivee) : '')
          + (t.lieuArrivee ? ' à ' + t.lieuArrivee : '')).trim() || null,
        // Le vol du groupe, sans le dossier ni le lien de celui qui l'ouvre (propres à chacun).
        noms: [], trajet: volSansReservation(t), ids: []
      };
      g.noms.push(nomComplet(p));
      g.ids.push(p.id);
      groupes.set(cle, g);
    }
    return [...groupes.values()].sort((a, b) => a.tri.localeCompare(b.tri));
  }

  /** Recopie l'arrivée et le départ d'un autre participant dans la fiche ouverte, sans son dossier ni son lien. */
  memeVoyageQue(id: number | null): void {
    const autre = (this.sejour()?.participants ?? []).find(p => p.id === id);
    if (!autre) return;
    this.participant.arrivee = memeVoyageQue(autre.arrivee, this.participant.arrivee);
    this.participant.depart = memeVoyageQue(autre.depart, this.participant.depart);
  }

  // ---------------- Un même vol pour plusieurs ----------------

  volOuvert = signal(false);
  vol: { sens: 'ARRIVEE' | 'DEPART'; trajet: Trajet; ids: number[] } = { sens: 'ARRIVEE', trajet: trajetVide(), ids: [] };
  /** Les vols déjà saisis pour ce sens, pour en partir sans rien recopier. */
  volsConnus = signal<GroupeTrajet[]>([]);

  /** g : un vol déjà saisi, à compléter de nouvelles personnes ; null : un vol à saisir. */
  ouvrirVolCommun(sens: 'ARRIVEE' | 'DEPART', g: GroupeTrajet | null): void {
    this.erreur.set(null);
    this.vol = {
      sens,
      trajet: volSansReservation(g?.trajet ?? null),
      ids: g ? [...g.ids] : []
    };
    this.volsConnus.set(this.groupesTrajets(sens === 'ARRIVEE' ? 'arrivee' : 'depart'));
    this.volOuvert.set(true);
  }

  reprendreVol(i: number | null): void {
    const g = i === null ? null : this.volsConnus()[i];
    if (!g) return;
    this.vol.trajet = volSansReservation(g.trajet);
    this.vol.ids = [...new Set([...this.vol.ids, ...g.ids])];
  }

  cocherVol(qui: 'tous' | 'sans' | 'personne'): void {
    const sens = this.vol.sens === 'ARRIVEE' ? 'arrivee' : 'depart';
    this.vol.ids = (this.sejour()?.participants ?? [])
      .filter(p => qui === 'tous' || (qui === 'sans' && !p[sens]?.date && !p[sens]?.heure))
      .map(p => p.id);
  }

  /** « déjà : vendredi 03/06/2027 à 18h30, avion AF7520 » sous chaque nom. */
  trajetActuel(p: ParticipantVue): string {
    const t = this.vol.sens === 'ARRIVEE' ? p.arrivee : p.depart;
    return t ? 'déjà : ' + this.texteTrajet(t) : '';
  }

  enregistrerVolCommun(): void {
    const t = this.vol.trajet;
    if (!t.date && !t.heure) {
      this.erreur.set('Indiquez au moins le jour ou l’heure.');
      return;
    }
    if (this.vol.ids.length === 0) {
      this.erreur.set('Cochez au moins une personne.');
      return;
    }
    const aller = this.vol.sens === 'ARRIVEE';
    const trajet = {
      ...t, numero: t.numero?.trim() || null, lieu: t.lieu?.trim() || null,
      heureDepart: aller ? t.heureDepart || null : null, lieuDepart: aller ? t.lieuDepart?.trim() || null : null,
      heureArrivee: aller ? null : t.heureArrivee || null, lieuArrivee: aller ? null : t.lieuArrivee?.trim() || null,
      dateDepart: aller ? t.dateDepart || null : null, dateArrivee: aller ? null : t.dateArrivee || null,
      terminal: t.terminal?.trim() || null, ouvertureEnregistrement: t.ouvertureEnregistrement || null,
      dossier: t.dossier?.trim() || null, lienEnregistrement: t.lienEnregistrement?.trim() || null
    };
    this.modifier({ type: 'trajet', sens: this.vol.sens, trajet, participantIds: this.vol.ids },
      aller ? 'Trajet aller commun' : 'Trajet retour commun', () => {
      this.volOuvert.set(false);
      this.message.set(`Trajet enregistré pour ${this.vol.ids.length} personne${this.vol.ids.length > 1 ? 's' : ''}.`);
    });
  }

  sansTrajet(sens: 'arrivee' | 'depart'): string[] {
    return (this.sejour()?.participants ?? []).filter(p => !p[sens]?.date && !p[sens]?.heure).map(nomComplet);
  }

  affairesDe(c: CategorieAffaire) {
    return (this.sejour()?.affaires ?? []).filter(a => a.categorie === c);
  }

  /** Tous les onglets, dépliés, le temps de l'impression ; puis retour à l'onglet ouvert. */
  /** Le bouton de l'encart en tête de page : ouvre l'onglet « Frais » et y descend. */
  ouvrirFrais(): void {
    this.onglet.set('frais');
    setTimeout(() => document.getElementById('frais-sejour')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  /** Une tuile de « Mon séjour » : la fenêtre « Mes informations », ou l'onglet qui en donne le détail. */
  ouvrirDepuisMonSejour(cible: CibleMonSejour): void {
    if (cible === 'infos') {
      this.mesInfosOuvertes.set(true);
    } else if (cible === 'frais') {
      this.ouvrirFrais();
    } else if (cible === 'declarer') {
      // « Oui, je déclare mon matériel » : l'onglet « Matériel », fenêtre de déclaration ouverte.
      this.onglet.set('materiel');
      this.ouvrirDeclarationApresRendu();
    } else {
      this.onglet.set(cible);
      setTimeout(() => document.getElementById('onglets-sejour')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }

  /**
   * Les frais du séjour pour l'onglet « Frais » : chaque écriture met le séjour à jour. Dépenses et
   * remboursements passent par la file du téléphone (gardés sans réseau) ; photos et lecture des
   * notes demandent le réseau.
   */
  readonly portFrais: PortFrais = this.portFraisHorsLigne(this.api.portFrais(this.id, s => this.maj(s)));

  /** Les repas pris au restaurant, pour l'onglet « Courses ». */
  readonly portRepas = this.api.portRepas(this.id);

  /** Les menus des restaurants, pour l'onglet « Restaurant ». */
  readonly portMenus = this.api.portMenus(this.id);

  /** Le matériel emprunté, pour l'onglet « Matériel » et la carte « Mon séjour » ; lu sans réseau sur la copie. */
  readonly prets = new PretsDuSejour(this.portPretsAvecCopie(this.api.portPrets(this.id)));
  private readonly materiel = viewChild(SejourMaterielComponent);
  private readonly injector = inject(Injector);

  /**
   * La fenêtre de déclaration de l'onglet « Matériel », une fois l'onglet
   * affiché : avant son rendu, le composant n'existe pas encore (un
   * setTimeout passait parfois avant, et rien ne s'ouvrait).
   */
  private ouvrirDeclarationApresRendu(): void {
    afterNextRender(() => this.materiel()?.ouvrir(), { injector: this.injector });
  }

  mesInfosOuvertes = signal(false);

  /** Le participant connecté complète ses informations (voyage, repas, personne à prévenir). */
  enregistrerMesInformations(d: DemandeMesInformations): void {
    this.modifier({ type: 'mes-informations', demande: d }, 'Mes informations', () => {
      this.mesInfosOuvertes.set(false);
      this.message.set('Vos informations sont enregistrées.');
    });
  }

  /**
   * Un e-mail à un participant pour qu'il renseigne ses informations et ses frais :
   * un moniteur dans l'appli, les autres par un lien et un code.
   */
  envoyerInvitations(p: ParticipantVue): void {
    if (!confirm(`Envoyer à ${nomComplet(p)} un e-mail pour qu'il renseigne ses informations pour le séjour ?`)) return;
    this.envoyerEmails('invitations', [p.id]);
  }

  destinatairesOuverts = signal(false);
  envoiChoisi: 'invitations' | 'carnet' = 'carnet';
  destinataires: number[] = [];

  /** La fenêtre « À qui envoyer » : tous ceux qui ont un e-mail cochés, à décocher au besoin. */
  choisirDestinataires(envoi: 'invitations' | 'carnet'): void {
    this.erreur.set(null);
    this.envoiChoisi = envoi;
    this.cocherDestinataires('tous');
    this.destinatairesOuverts.set(true);
  }

  cocherDestinataires(qui: 'tous' | 'incomplets' | 'personne'): void {
    this.destinataires = (this.sejour()?.participants ?? [])
      .filter(p => p.email && (qui === 'tous' || (qui === 'incomplets' && this.manque(p).length > 0)))
      .map(p => p.id);
  }

  envoyerAuxDestinataires(): void {
    if (this.destinataires.length === 0) {
      this.erreur.set('Cochez au moins une personne.');
      return;
    }
    this.envoyerEmails(this.envoiChoisi, [...this.destinataires], () => this.destinatairesOuverts.set(false));
  }

  private envoyerEmails(envoi: 'invitations' | 'carnet', ids: number[], ensuite?: () => void): void {
    this.envoi.set(true);
    this.message.set(null);
    this.erreur.set(null);
    const requete: Observable<BilanEnvoiCarnet> = envoi === 'carnet'
      ? this.api.envoyerCarnet(this.id, ids) : this.api.envoyerInvitations(this.id, ids);
    requete.subscribe({
      next: b => {
        this.envoi.set(false);
        ensuite?.();
        this.message.set([
          b.envoyes.length
            ? `${envoi === 'carnet' ? 'Carnet envoyé' : 'Demande envoyée'} à : ${b.envoyes.join(', ')}.`
            : 'Aucun e-mail envoyé.',
          b.sansEmail.length ? `Sans e-mail : ${b.sansEmail.join(', ')}.` : '',
          b.echecs.length ? `Échec de l'envoi pour : ${b.echecs.join(', ')}.` : ''
        ].filter(Boolean).join(' '));
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        const texte = e.error?.detail ?? "L'e-mail n'a pas pu être envoyé (réseau nécessaire).";
        if (this.destinatairesOuverts()) this.erreur.set(texte); else this.message.set(texte);
      }
    });
  }

  // ---------------- Participants ----------------

  async ouvrirParticipant(p: ParticipantVue | null): Promise<void> {
    this.erreur.set(null);
    this.participantId = p?.id ?? null;
    this.participant = p ? {
      eleveId: p.eleveId, utilisateurId: p.utilisateurId, nom: p.nom, prenom: p.prenom, plongeur: p.plongeur,
      telephone: p.telephone, email: p.email, regimes: [...p.regimes], regimePrecision: p.regimePrecision,
      urgenceNom: p.urgenceNom, urgenceTelephone: p.urgenceTelephone,
      arrivee: copieTrajet(p.arrivee),
      depart: copieTrajet(p.depart),
      remarques: p.remarques,
      membreGroupeId: p.membreGroupeId
    } : participantVide();
    this.participantOuvert.set(true);
    if (!p && this.connus().length === 0) {
      try { this.connus.set(await this.apiClub.plongeursConnus()); } catch { /* saisie à la main */ }
    }
  }

  choisirConnu(index: number | null): void {
    const c = index === null ? null : this.connus()[index];
    if (!c) return;
    this.participant.eleveId = c.eleveId;
    this.participant.utilisateurId = c.utilisateurId;
    this.participant.nom = c.nom;
    this.participant.prenom = c.prenom;
  }

  /**
   * Les plongeurs des groupes de la saison qu'on peut lier à ce participant :
   * ceux qui ne le sont pas déjà à un autre participant du séjour.
   */
  plongeursLiables(): GroupeProposeVue[] {
    const s = this.sejour();
    if (!s) return [];
    const pris = new Set(s.participants.filter(p => p.id !== this.participantId && p.membreGroupeId !== null)
      .map(p => p.membreGroupeId));
    return s.groupesProposes.map(g => ({ ...g, plongeurs: g.plongeurs.filter(m => !pris.has(m.id)) }))
      .filter(g => g.plongeurs.length > 0);
  }

  estLiable(membreId: number): boolean {
    return this.plongeursLiables().some(g => g.plongeurs.some(m => m.id === membreId));
  }

  /** Lié à un plongeur d'un groupe : nom, prénom, e-mail et dossier en sont repris. */
  lierAuPlongeur(membreId: number | null): void {
    this.participant.membreGroupeId = membreId;
    if (membreId === null) return;
    const m = this.sejour()?.groupesProposes.flatMap(g => g.plongeurs).find(x => x.id === membreId);
    if (!m) return;
    this.participant.plongeur = true;
    this.participant.nom = m.nom;
    this.participant.prenom = m.prenom;
    if (m.email) this.participant.email = m.email;
    if (m.eleveId !== null || m.utilisateurId !== null) {
      this.participant.eleveId = m.eleveId;
      this.participant.utilisateurId = m.utilisateurId;
    }
  }

  /** Un accompagnant ne plonge pas : il n'a pas de plongeur de groupe. */
  changerPlongeur(plonge: boolean): void {
    this.participant.plongeur = plonge;
    if (!plonge) this.participant.membreGroupeId = null;
  }

  basculerRegime(code: RegimeAlimentaire): void {
    const r = this.participant.regimes;
    this.participant.regimes = r.includes(code) ? r.filter(x => x !== code) : [...r, code];
  }

  enregistrerParticipant(): void {
    const d = this.participant;
    if (!d.nom.trim() || !d.prenom.trim()) {
      this.erreur.set('Le prénom et le nom sont obligatoires.');
      return;
    }
    const demande = { ...d, arrivee: trajetSaisi(d.arrivee), depart: trajetSaisi(d.depart) };
    this.modifier({ type: 'participant', id: this.participantId, demande }, `Participant « ${nomComplet(demande)} »`,
      () => this.participantOuvert.set(false));
  }

  supprimerParticipant(p: ParticipantVue): void {
    if (!confirm(`Retirer ${nomComplet(p)} du séjour ? Il quitte aussi sa voiture et sa chambre.`)) return;
    this.modifier({ type: 'suppression', objet: 'participant', id: p.id }, `Retrait de ${nomComplet(p)}`);
  }

  importerGroupe(groupeId: number | null): void {
    if (groupeId === null) return;
    this.ecrire(this.api.importerGroupe(this.id, groupeId), () => {
      const nonLies = this.nonLiesDuGroupe(groupeId);
      this.message.set('Les membres du groupe qui n’étaient pas encore inscrits ont été ajoutés, '
        + 'chacun lié à son plongeur du groupe.'
        + (nonLies.length === 0 ? '' : ` Déjà inscrits avec un autre nom ou un autre e-mail, donc pas liés : `
          + `${nonLies.join(', ')}. Ouvrez leur fiche et choisissez-les dans « Plongeur du groupe » si c’est la même personne.`));
    });
  }

  /**
   * Les participants qui sont sans doute des plongeurs du groupe (même dossier,
   * ou mêmes nom et prénom) mais que le serveur n'a pas liés : leur nom ou leur
   * e-mail diffère, il n'écrase pas ce qui a été saisi.
   */
  private nonLiesDuGroupe(groupeId: number): string[] {
    const s = this.sejour();
    const g = s?.groupesProposes.find(x => x.id === groupeId);
    if (!s || !g) return [];
    const memeNom = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
    return g.plongeurs
      .filter(m => !s.participants.some(p => p.membreGroupeId === m.id))
      .map(m => s.participants.find(p => p.membreGroupeId === null && (
        (m.eleveId !== null && p.eleveId === m.eleveId) || (m.utilisateurId !== null && p.utilisateurId === m.utilisateurId)
        || (memeNom(p.nom, m.nom) && memeNom(p.prenom, m.prenom)))))
      .filter((p): p is ParticipantVue => !!p)
      .map(p => nomComplet(p));
  }

  // ---------------- Voitures ----------------

  ouvrirVoiture(v: VoitureVue | null): void {
    this.erreur.set(null);
    this.voitureId = v?.id ?? null;
    this.voiture = v
      ? { nom: v.nom, places: v.places, conducteurId: v.conducteurId, trajet: v.trajet, remarques: v.remarques,
          passagerIds: [...v.passagerIds] }
      : { nom: '', places: 5, conducteurId: null, trajet: null, remarques: null, passagerIds: [] };
    this.voitureOuverte.set(true);
  }

  basculer(liste: number[], id: number): void {
    const i = liste.indexOf(id);
    if (i >= 0) liste.splice(i, 1); else liste.push(id);
  }

  enregistrerVoiture(): void {
    if (!this.voiture.nom.trim() || !this.voiture.places) {
      this.erreur.set('Le nom et le nombre de places sont obligatoires.');
      return;
    }
    const d = { ...this.voiture, passagerIds: this.voiture.passagerIds.filter(p => p !== this.voiture.conducteurId) };
    this.modifier({ type: 'voiture', id: this.voitureId, demande: d }, `Voiture « ${d.nom} »`,
      () => this.voitureOuverte.set(false));
  }

  supprimerVoiture(v: VoitureVue): void {
    if (!confirm(`Supprimer la voiture « ${v.nom} » ?`)) return;
    this.modifier({ type: 'suppression', objet: 'voiture', id: v.id }, `Suppression de la voiture « ${v.nom} »`);
  }

  // ---------------- Logements ----------------

  ouvrirLogement(l: LogementVue | null): void {
    this.erreur.set(null);
    this.logementId = l?.id ?? null;
    this.logement = l
      ? { nom: l.nom, adresse: l.adresse, remarques: l.remarques,
          chambres: l.chambres.map(c => ({ nom: c.nom, couchages: c.couchages, remarques: c.remarques,
            occupantIds: [...c.occupantIds] })) }
      : { nom: '', adresse: null, remarques: null, chambres: [] };
    if (!l) this.ajouterChambre();
    this.logementOuvert.set(true);
  }

  ajouterChambre(): void {
    this.logement.chambres.push({
      nom: `Chambre ${this.logement.chambres.length + 1}`, couchages: 2, remarques: null, occupantIds: []
    });
  }

  /** Pas encore dans une chambre : ni d'un autre logement, ni d'une autre chambre de celui-ci. */
  libre(id: number): boolean {
    const ailleurs = (this.sejour()?.logements ?? [])
      .filter(l => l.id !== this.logementId)
      .some(l => l.chambres.some(c => c.occupantIds.includes(id)));
    return !ailleurs && !this.logement.chambres.some(c => c.occupantIds.includes(id));
  }

  enregistrerLogement(): void {
    if (!this.logement.nom.trim() || this.logement.chambres.some(c => !c.nom.trim() || !c.couchages)) {
      this.erreur.set('Le nom du logement, et le nom et les couchages de chaque chambre, sont obligatoires.');
      return;
    }
    this.modifier({ type: 'logement', id: this.logementId, demande: this.logement }, `Logement « ${this.logement.nom} »`,
      () => this.logementOuvert.set(false));
  }

  supprimerLogement(l: LogementVue): void {
    if (!confirm(`Supprimer « ${l.nom} » et ses chambres ?`)) return;
    this.modifier({ type: 'suppression', objet: 'logement', id: l.id }, `Suppression de « ${l.nom} »`);
  }

  // ---------------- Affaires ----------------

  ouvrirAffaires(): void {
    this.erreur.set(null);
    this.affaires = (this.sejour()?.affaires ?? []).map(a => ({ categorie: a.categorie, libelle: a.libelle, indispensable: a.indispensable }));
    this.affairesOuvertes.set(true);
  }

  ajouterAffaire(): void {
    this.affaires.push({ categorie: 'PLONGEE', libelle: '', indispensable: false });
  }

  /** Ajoute les lignes de la liste type qui manquent, sans toucher aux autres. */
  partirDeLaListeType(): void {
    const deja = new Set(this.affaires.map(a => a.libelle.trim().toLowerCase()));
    this.affaires.push(...AFFAIRES_TYPE.filter(a => !deja.has(a.libelle.toLowerCase())).map(a => ({ ...a })));
  }

  enregistrerAffaires(): void {
    const liste = this.affaires.filter(a => a.libelle.trim());
    const ordre = CATEGORIES.map(c => c.code);
    liste.sort((a, b) => ordre.indexOf(a.categorie) - ordre.indexOf(b.categorie));
    this.modifier({ type: 'affaires', affaires: liste }, 'Affaires à prévoir', () => this.affairesOuvertes.set(false));
  }

  // ---------------- Programme ----------------

  ouvrirEvenement(e: EvenementVue | null): void {
    this.erreur.set(null);
    this.evenementId = e?.id ?? null;
    this.evenement = e
      ? { jour: e.jour, heureDebut: e.heureDebut?.slice(0, 5) ?? null, heureFin: e.heureFin?.slice(0, 5) ?? null,
          titre: e.titre, lieu: e.lieu, details: e.details }
      : { jour: this.sejour()?.sortie.dateDebut ?? '', heureDebut: null, heureFin: null, titre: '', lieu: null, details: null };
    this.evenementOuvert.set(true);
  }

  enregistrerEvenement(): void {
    if (!this.evenement.jour || !this.evenement.titre.trim()) {
      this.erreur.set('Le jour et le titre sont obligatoires.');
      return;
    }
    const d = { ...this.evenement, heureDebut: this.evenement.heureDebut || null, heureFin: this.evenement.heureFin || null };
    this.modifier({ type: 'evenement', id: this.evenementId, demande: d }, `Rendez-vous « ${d.titre} »`,
      () => this.evenementOuvert.set(false));
  }

  supprimerEvenement(): void {
    if (this.evenementId === null || !confirm('Supprimer ce rendez-vous ?')) return;
    this.modifier({ type: 'suppression', objet: 'evenement', id: this.evenementId }, 'Suppression d’un rendez-vous',
      () => this.evenementOuvert.set(false));
  }

  // ---------------- Infos ----------------

  ouvrirInfos(): void {
    this.erreur.set(null);
    this.infos = this.sejour()?.infosPratiques ?? '';
    this.infosOuvertes.set(true);
  }

  enregistrerInfos(): void {
    this.modifier({ type: 'infos', texte: this.infos.trim() || null }, 'Infos pratiques', () => this.infosOuvertes.set(false));
  }

  /** Le conseil d'assurance du séjour ; sans le sien, on part du message type (vidé, c'est lui qui revient). */
  ouvrirConseilAssurance(): void {
    this.erreur.set(null);
    this.conseil = this.sejour()?.conseilAssurance ?? CONSEIL_ASSURANCE_TYPE;
    this.conseilOuvert.set(true);
  }

  enregistrerConseilAssurance(): void {
    this.modifier({ type: 'conseil', texte: this.conseil.trim() || null }, 'Conseil d’assurance',
      () => this.conseilOuvert.set(false));
  }

  // ---------------- Organisateurs ----------------

  estCreateur(id: number): boolean {
    return this.sejour()?.organisateurs.some(o => o.createur && o.id === id) ?? false;
  }

  async ouvrirOrganisateurs(): Promise<void> {
    this.erreur.set(null);
    this.organisateursChoisis.set(new Set((this.sejour()?.organisateurs ?? []).filter(o => !o.createur).map(o => o.id)));
    this.organisateursOuverts.set(true);
    try {
      this.candidats.set(await this.apiClub.moniteursActifs());
    } catch {
      this.erreur.set('Impossible de charger la liste des moniteurs (réseau nécessaire).');
    }
  }

  basculerOrganisateur(id: number): void {
    const choisis = new Set(this.organisateursChoisis());
    if (!choisis.delete(id)) choisis.add(id);
    this.organisateursChoisis.set(choisis);
  }

  enregistrerOrganisateurs(): void {
    this.ecrire(this.api.definirOrganisateurs(this.id, [...this.organisateursChoisis()]),
      () => this.organisateursOuverts.set(false));
  }

  /** Toute écriture renvoie le séjour à jour ; un refus s'affiche dans la fenêtre ouverte (ou en haut). */
  private ecrire(appel: Observable<SejourVue>, ensuite?: () => void): void {
    this.envoi.set(true);
    this.erreur.set(null);
    this.message.set(null);
    appel.subscribe({
      next: s => {
        this.envoi.set(false);
        this.maj(s);
        ensuite?.();
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        const texte = e.error?.detail ?? "L'enregistrement n'a pas abouti (réseau nécessaire).";
        this.erreur.set(texte);
        if (!this.fenetreOuverte()) this.message.set(texte);
      }
    });
  }

  /**
   * Passe de l'organisation à la vue d'un participant, et retour : le
   * serveur renvoie alors le carnet, filtré comme pour un participant.
   */
  basculerMode(): void {
    this.commeParticipant.update(v => !v);
    this.message.set(null);
    this.erreur.set(null);
    if (this.commeParticipant() && this.onglet() === 'participants') this.onglet.set('programme');
    void this.charger();
  }

  /**
   * Une modification du séjour, gardée sur le téléphone puis envoyée (tout de
   * suite si le réseau est là) : le séjour montré la porte aussitôt. Un refus
   * immédiat s'affiche comme {@link ecrire} ; un refus différé, au bandeau.
   */
  private modifier(modification: ModificationSejour, libelle: string, ensuite?: () => void): void {
    const nomSejour = this.sejour()?.sortie.nom ?? '';
    this.envoi.set(true);
    this.erreur.set(null);
    this.message.set(null);
    void this.fileSejour.enregistrer({ sejourId: this.id, nomSejour, modification, libelle }).then(issue => {
      this.envoi.set(false);
      if (issue.etat === 'refusee') {
        this.erreur.set(issue.raison);
        if (!this.fenetreOuverte()) this.message.set(issue.raison);
        return;
      }
      if (issue.etat === 'envoyee' && issue.reponse) {
        this.maj(issue.reponse);
        this.copieDu.set(null);
      }
      ensuite?.();
      if (issue.etat === 'en-attente') this.message.set(MESSAGE_EN_ATTENTE);
    });
  }

  private fenetreOuverte(): boolean {
    return this.participantOuvert() || this.voitureOuverte() || this.logementOuvert() || this.mesInfosOuvertes()
      || this.volOuvert() || this.affairesOuvertes() || this.evenementOuvert() || this.infosOuvertes()
      || this.conseilOuvert() || this.organisateursOuverts();
  }

  /**
   * Les frais par la file du téléphone : la dépense ou le remboursement
   * partent tout de suite avec du réseau, sinon attendent et se montrent
   * déjà, comptes recalculés. Une photo se joint à une dépense envoyée.
   */
  private portFraisHorsLigne(enLigne: PortFrais): PortFrais {
    const fraisMontres = () => this.sejour()!.frais;
    const passer = <T>(modification: ModificationSejour, libelle: string,
                       envoyee: (reponse: T | null) => T | FraisVue): Observable<T | FraisVue> =>
      from(this.fileSejour.enregistrer<T>({ sejourId: this.id, nomSejour: this.sejour()?.sortie.nom ?? '',
        modification, libelle })).pipe(mergeMap(issue => {
        if (issue.etat === 'refusee') {
          return throwError(() => new HttpErrorResponse({ status: 422, error: { detail: issue.raison } }));
        }
        if (issue.etat === 'envoyee') {
          this.copieDu.set(null);
          return of(envoyee(issue.reponse));
        }
        return of(fraisMontres());
      }));
    return {
      ...enLigne,
      enregistrerDepense: (depenseId, d) => {
        const enAttente = this.fileSejour.pour(this.id).map(e => e.idProvisoire);
        return passer<{ depenseId: number; sejour: SejourVue } | SejourVue>(
          { type: 'depense', id: depenseId, demande: d }, `Dépense « ${d.libelle} »`,
          r => r ?? fraisMontres()).pipe(map(r => {
            if ('depenseId' in r) {
              this.maj(r.sejour);
              return { depenseId: r.depenseId, frais: r.sejour.frais };
            }
            if ('sortie' in r) this.maj(r);
            // Gardée sur le téléphone : son id provisoire, celui de la nouvelle entrée de la file.
            const id = depenseId ?? this.fileSejour.pour(this.id).map(e => e.idProvisoire)
              .find(i => i !== null && !enAttente.includes(i)) ?? null;
            return { depenseId: id ?? 0, frais: this.sejour()!.frais };
          }));
      },
      supprimerDepense: depenseId => this.fraisDe(passer<SejourVue>(
        { type: 'suppression', objet: 'depense', id: depenseId }, 'Suppression d’une dépense', r => r ?? fraisMontres())),
      ajouterPhoto: (depenseId, fichier) => depenseId < 0
        ? throwError(() => new HttpErrorResponse({ status: 0, error: { detail:
            'La dépense est gardée sur ce téléphone. La photo de la note se joindra une fois la dépense envoyée '
            + '(réseau nécessaire) : rouvrez alors la dépense.' } }))
        : enLigne.ajouterPhoto(depenseId, fichier),
      ajouterVersement: d => this.fraisDe(passer<SejourVue>(
        { type: 'versement', demande: d }, 'Remboursement', r => r ?? fraisMontres())),
      supprimerVersement: versementId => this.fraisDe(passer<SejourVue>(
        { type: 'suppression', objet: 'versement', id: versementId }, 'Annulation d’un remboursement',
        r => r ?? fraisMontres()))
    };
  }

  /** Le séjour renvoyé met l'écran à jour ; l'onglet reçoit les frais montrés. */
  private fraisDe(o: Observable<SejourVue | FraisVue>): Observable<FraisVue> {
    return o.pipe(map(r => {
      if ('sortie' in r) this.maj(r);
      return this.sejour()!.frais;
    }));
  }

  /** Le matériel emprunté se lit sur la copie du téléphone sans réseau ; il ne se déclare qu'avec le réseau. */
  private portPretsAvecCopie(enLigne: PortPrets): PortPrets {
    return {
      ...enLigne,
      lire: () => from(this.fileSejour.lireAvecCopie(`prets-sejour:${this.id}`, () => enLigne.lire())).pipe(map(l => l.valeur))
    };
  }

  /** Le séjour renvoyé par une écriture ; en vue participant, relu comme un participant le voit. */
  private maj(s: SejourVue): void {
    if (!this.commeParticipant()) {
      this.base.set(s);
      return;
    }
    this.api.lire(this.id, true).subscribe({ next: v => this.base.set(v), error: () => this.base.set(s) });
  }

  private async charger(): Promise<void> {
    try {
      const cp = this.commeParticipant();
      const lu = await this.fileSejour.lireAvecCopie(cleSejour(this.id, cp), () => this.api.lire(this.id, cp));
      this.base.set(lu.valeur);
      this.copieDu.set(lu.copieDu);
    } catch (e) {
      const statut = (e as HttpErrorResponse).status;
      this.base.set(null);
      this.message.set(statut === 403 ? "Ce séjour n'est ouvert qu'à ses participants et aux encadrants."
        : statut === 404 ? 'Séjour introuvable.'
        : 'Impossible de charger le séjour : pas de réseau, et il n’a pas encore été ouvert sur ce téléphone.');
    } finally {
      this.chargement.set(false);
    }
  }
}

const MESSAGE_EN_ATTENTE = 'Pas de réseau : la modification est gardée sur ce téléphone '
  + 'et partira toute seule au retour du réseau.';
