import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { PlongeurConnuVue } from '../../core/modeles';
import { DialogueComponent } from '../../core/dialogue.component';
import { ComboboxComponent, OptionCombobox } from '../../core/combobox.component';
import { periode } from '../../core/date-fr';
import {
  AFFAIRES_TYPE, CATEGORIES, CategorieAffaire, DemandeAffaire, DemandeEvenement, DemandeLogement, DemandeParticipant,
  DemandeVoiture, EvenementVue, LogementVue, ParticipantVue, REGIMES, RegimeAlimentaire, SejourApi, SejourVue,
  TRANSPORTS, Trajet, VoitureVue, euros, heure, jourLong, nomComplet
} from './sejour-api';
import { SejourFraisComponent } from './sejour-frais.component';

type Onglet = 'programme' | 'participants' | 'trajets' | 'voitures' | 'chambres' | 'repas' | 'affaires' | 'frais'
  | 'infos' | 'tout';

/** Une ligne du programme d'un jour : rendez-vous saisi, ou plongée de la sortie. */
interface LigneProgramme {
  heure: string;
  titre: string;
  lieu: string | null;
  details: string | null;
  evenement: EvenementVue | null;
}

/** Un groupe d'arrivées (ou de départs) : même jour, même heure, même vol. */
interface GroupeTrajet {
  quand: string;
  comment: string;
  lieu: string | null;
  noms: string[];
}

function trajetVide(): Trajet {
  return { date: null, heure: null, transport: null, numero: null, lieu: null };
}

/** Le brouillon de la fenêtre : arrivée et départ toujours présents, vidés à l'envoi s'ils sont restés vides. */
type BrouillonParticipant = DemandeParticipant & { arrivee: Trajet; depart: Trajet };

function participantVide(): BrouillonParticipant {
  return {
    eleveId: null, utilisateurId: null, nom: '', prenom: '', plongeur: true, telephone: null, email: null,
    regimes: [], regimePrecision: null, urgenceNom: null, urgenceTelephone: null,
    arrivee: trajetVide(), depart: trajetVide(), remarques: null
  };
}

/**
 * Le séjour d'une sortie, en onglets : programme, participants, arrivées et
 * départs, voitures, chambres, repas, affaires à prévoir, infos pratiques.
 * L'admin et le directeur technique le remplissent (fenêtres de saisie) ;
 * les encadrants le lisent ; un participant qui a un compte lit son carnet
 * (sans les coordonnées ni les régimes des autres). « Imprimer le carnet »
 * met tout sur une page, à imprimer ou enregistrer en PDF.
 */
@Component({
  selector: 'app-sejour',
  imports: [FormsModule, DialogueComponent, ComboboxComponent, SejourFraisComponent],
  template: `
    @if (sejour(); as s) {
      <div class="entete">
        <div>
          <h1>{{ s.sortie.nom }}</h1>
          <p class="secondaire">
            {{ majuscule(periode(s.sortie.dateDebut, s.sortie.dateFin)) }}@if (s.sortie.lieu) { · {{ s.sortie.lieu }}}
            · {{ s.participants.length }} participant{{ s.participants.length > 1 ? 's' : '' }}
          </p>
        </div>
        <div class="actions sans-impression">
          <button type="button" class="bouton-discret" (click)="imprimer()">Imprimer le carnet</button>
          @if (s.gere) {
            <button type="button" class="bouton-discret" (click)="envoyerCarnet()" [disabled]="envoi()">
              Envoyer le carnet par e-mail
            </button>
          }
        </div>
      </div>

      @if (message(); as m) { <div class="alerte sans-impression" role="status">{{ m }}</div> }

      @if (s.avertissements.length > 0) {
        <ul class="avertissements sans-impression" aria-label="À vérifier">
          @for (a of s.avertissements; track a) { <li>{{ a }}</li> }
        </ul>
      }

      @if (moi(); as m) {
        <section class="carte mon-voyage">
          <h2>Mon séjour</h2>
          <p><strong>Arrivée :</strong> {{ texteTrajet(m.arrivee) }}</p>
          <p><strong>Départ :</strong> {{ texteTrajet(m.depart) }}</p>
          @for (v of voituresDe(m.id); track v.id) {
            <p><strong>Voiture :</strong> « {{ v.nom }} »@if (v.trajet) {, {{ v.trajet }}}
              — {{ v.conducteurId === m.id ? 'vous conduisez' : 'conduite par ' + nomDe(v.conducteurId) }}</p>
          }
          @if (chambreDe(m.id); as c) {
            <p><strong>Chambre :</strong> « {{ c.chambre }} », {{ c.logement }}@if (c.avec.length) {, avec {{ c.avec.join(', ') }}}</p>
          }
          @for (r of mesRemboursements(m.id); track $index) {
            <p><strong>Frais :</strong> {{ r }}</p>
          }
        </section>
      }

      <div class="onglets sans-impression" role="tablist">
        @for (o of onglets(); track o.code) {
          <button type="button" role="tab" class="bouton-discret" [class.actif]="onglet() === o.code"
                  [attr.aria-selected]="onglet() === o.code" (click)="onglet.set(o.code)">{{ o.libelle }}</button>
        }
      </div>

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
            <div class="carte jour">
              <h3>{{ jourLong(j.jour) }}</h3>
              <ul class="lignes">
                @for (l of j.lignes; track $index) {
                  <li>
                    <span class="heure">{{ l.heure }}</span>
                    <span class="quoi">
                      <strong>{{ l.titre }}</strong>@if (l.lieu) { <span class="secondaire"> — {{ l.lieu }}</span>}
                      @if (l.details) { <span class="texte-libre secondaire">{{ l.details }}</span> }
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
          @if (s.participants.length === 0) { <p class="vide">Personne d'inscrit pour l'instant.</p> }
          <ul class="cartes">
            @for (p of s.participants; track p.id) {
              <li class="carte">
                <div class="ligne">
                  <span class="nom">{{ nomComplet(p) }}</span>
                  <span class="pastille" [class.accompagnant]="!p.plongeur">{{ p.plongeur ? 'Plongeur' : 'Accompagnant' }}</span>
                </div>
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
                  <div class="actions sans-impression">
                    <button type="button" class="bouton-discret" (click)="ouvrirParticipant(p)">Modifier</button>
                    @if (p.email && p.utilisateurId === null) {
                      <button type="button" class="bouton-discret" (click)="envoyerAccesFrais(p)" [disabled]="envoi()"
                              title="Un lien et un code par e-mail, pour voir et saisir ses frais sans compte">
                        Envoyer le lien des frais
                      </button>
                    }
                    <button type="button" class="bouton-discret danger" (click)="supprimerParticipant(p)">Retirer</button>
                  </div>
                }
              </li>
            }
          </ul>
        </section>
      }

      <!-- Arrivées et départs -->
      @if (voir('trajets')) {
        <section>
          <h2>Arrivées et départs</h2>
          <div class="deux-colonnes">
            @for (sens of sensTrajets; track sens.code) {
              <div>
                <h3>{{ sens.libelle }}</h3>
                @if (groupesTrajets(sens.code).length === 0) { <p class="vide">Rien de renseigné.</p> }
                <ul class="cartes">
                  @for (g of groupesTrajets(sens.code); track $index) {
                    <li class="carte">
                      <span class="nom">{{ g.quand }}</span>
                      @if (g.comment) { <span> · {{ g.comment }}</span> }
                      @if (g.lieu) { <span class="secondaire"> · {{ g.lieu }}</span> }
                      <p>{{ g.noms.join(', ') }}</p>
                    </li>
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

      <!-- Voitures -->
      @if (voir('voitures')) {
        <section>
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

      <!-- Logements et chambres -->
      @if (voir('chambres')) {
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

      <!-- Repas (encadrants) -->
      @if (s.encadrant && voir('repas')) {
        <section>
          <h2>Repas</h2>
          <p>{{ s.participants.length }} couverts, dont {{ sansRegime().length }} sans régime particulier.</p>
          @if (repas().length === 0) { <p class="vide">Aucun régime particulier.</p> }
          <ul class="cartes">
            @for (r of repas(); track r.libelle) {
              <li class="carte"><span class="nom">{{ r.libelle }} : {{ r.noms.length }}</span><p>{{ r.noms.join(', ') }}</p></li>
            }
          </ul>
          @if (precisions().length > 0) {
            <h3>Précisions pour la cuisine</h3>
            <ul>
              @for (p of precisions(); track p.id) { <li>{{ nomComplet(p) }} : {{ p.regimePrecision }}</li> }
            </ul>
          }
        </section>
      }

      <!-- Affaires -->
      @if (voir('affaires')) {
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
        <section>
          <app-sejour-frais [frais]="s.frais" [participants]="s.participants" [port]="portFrais" />
          @if (s.gere) {
            <p class="secondaire sans-impression acces-frais">
              Les participants sans compte peuvent voir et saisir leurs frais par un lien et un code reçus par e-mail.
              <button type="button" class="bouton-discret" (click)="envoyerAccesFrais(null)" [disabled]="envoi()">
                Envoyer le lien des frais aux participants sans compte
              </button>
            </p>
          }
        </section>
      }

      <!-- Infos pratiques -->
      @if (voir('infos')) {
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
      <label class="case"><input type="checkbox" [(ngModel)]="participant.plongeur"> Plonge (sinon : accompagnant)</label>

      @for (sens of sensTrajets; track sens.code) {
        <fieldset>
          <legend>{{ sens.libelle }}</legend>
          <div class="grille">
            <div><label [for]="'p-' + sens.code + '-date'">Jour</label>
              <input [id]="'p-' + sens.code + '-date'" type="date" [(ngModel)]="participant[sens.code].date"></div>
            <div><label [for]="'p-' + sens.code + '-heure'">Heure</label>
              <input [id]="'p-' + sens.code + '-heure'" type="time" [(ngModel)]="participant[sens.code].heure"></div>
            <div><label [for]="'p-' + sens.code + '-moyen'">Moyen</label>
              <select [id]="'p-' + sens.code + '-moyen'" [(ngModel)]="participant[sens.code].transport">
                <option [ngValue]="null">—</option>
                @for (t of transports; track t.code) { <option [ngValue]="t.code">{{ t.libelle }}</option> }
              </select></div>
            <div><label [for]="'p-' + sens.code + '-numero'">N° de vol ou de train</label>
              <input [id]="'p-' + sens.code + '-numero'" [(ngModel)]="participant[sens.code].numero" maxlength="30"
                     placeholder="AF7520"></div>
            <div><label [for]="'p-' + sens.code + '-lieu'">Aéroport, gare, lieu</label>
              <input [id]="'p-' + sens.code + '-lieu'" [(ngModel)]="participant[sens.code].lieu" maxlength="120"></div>
          </div>
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
            @for (p of sejour()?.participants ?? []; track p.id) { <option [ngValue]="p.id">{{ nomComplet(p) }}</option> }
          </select></div>
        <div><label for="v-trajet">Trajet</label>
          <input id="v-trajet" [(ngModel)]="voiture.trajet" maxlength="200" placeholder="Aller-retour depuis le club"></div>
      </div>
      <fieldset>
        <legend>Passagers</legend>
        <div class="regimes">
          @for (p of sejour()?.participants ?? []; track p.id) {
            @if (p.id !== voiture.conducteurId) {
              <label class="case"><input type="checkbox" [checked]="voiture.passagerIds.includes(p.id)"
                                         (change)="basculer(voiture.passagerIds, p.id)"> {{ nomComplet(p) }}</label>
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
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .entete { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas-2); flex-wrap: wrap; }
    .entete h1 { margin-bottom: var(--pas); }
    h2 { margin: var(--pas-3, 24px) 0 var(--pas); }
    h3 { margin: var(--pas) 0; font-size: 1rem; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0 var(--pas-2); }
    fieldset { border: 1px solid var(--trait); border-radius: var(--r-s); margin: var(--pas-2) 0; padding: var(--pas) var(--pas-2); }
    legend { font-weight: 700; padding: 0 var(--pas); }
    textarea { resize: vertical; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; align-items: center; }
    .titre-section { display: flex; justify-content: space-between; align-items: center; gap: var(--pas); flex-wrap: wrap; }
    .onglets { display: flex; gap: var(--pas); margin: var(--pas-2) 0; flex-wrap: wrap; }
    .onglets .actif { background: var(--profond); color: #fff; border-color: var(--profond); font-weight: 700; }
    .avertissements { margin: var(--pas-2) 0; padding: var(--pas) var(--pas-2) var(--pas) 2rem; border-radius: var(--r-s);
                      background: var(--en-cours-clair); color: var(--en-cours); }
    .mon-voyage { padding: var(--pas-2); margin: var(--pas-2) 0; }
    .mon-voyage h2 { margin-top: 0; }
    .mon-voyage p { margin: var(--pas) 0 0; }
    .cartes { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2);
              grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
    .cartes > li { padding: var(--pas-2); }
    .cartes p { margin: var(--pas) 0 0; }
    .ligne { display: flex; justify-content: space-between; align-items: center; gap: var(--pas); }
    .nom { font-weight: 700; }
    .pastille { flex: none; padding: 2px 10px; border-radius: var(--r-s); font-size: .8125rem; font-weight: 700;
                background: #E0F2FE; color: var(--profond-fonce); }
    .pastille.accompagnant { background: #F1F5F9; color: var(--craie); }
    .pastille.plein { background: var(--en-cours-clair); color: var(--en-cours); }
    .texte-libre { white-space: pre-line; display: block; }
    .jour { padding: var(--pas-2); margin-bottom: var(--pas-2); }
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
    .edition-affaires { list-style: none; margin: var(--pas-2) 0; padding: 0; display: grid; gap: var(--pas); }
    .edition-affaires li { display: grid; grid-template-columns: 10rem 1fr auto auto; gap: var(--pas); align-items: center; }
    .edition-affaires input, .edition-affaires select { margin: 0; }
    @media (max-width: 640px) {
      .edition-affaires li { grid-template-columns: 1fr auto; }
      .heure { width: 4.5rem; }
    }
    .danger { color: #B91C1C; border-color: #FCA5A5; }
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
  readonly jourLong = jourLong;
  readonly nomComplet = nomComplet;
  readonly regimes = REGIMES;
  readonly transports = TRANSPORTS;
  readonly categories = CATEGORIES;
  readonly sensTrajets = [
    { code: 'arrivee' as const, libelle: 'Arrivées' },
    { code: 'depart' as const, libelle: 'Départs' }
  ];

  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  sejour = signal<SejourVue | null>(null);
  chargement = signal(true);
  message = signal<string | null>(null);
  erreur = signal<string | null>(null);
  envoi = signal(false);
  onglet = signal<Onglet>('programme');

  readonly onglets = computed(() => {
    const s = this.sejour();
    const liste: { code: Onglet; libelle: string }[] = [
      { code: 'programme', libelle: 'Programme' },
      { code: 'participants', libelle: 'Participants' },
      { code: 'trajets', libelle: 'Arrivées et départs' },
      { code: 'voitures', libelle: 'Voitures' },
      { code: 'chambres', libelle: 'Chambres' },
      { code: 'repas', libelle: 'Repas' },
      { code: 'affaires', libelle: 'Affaires' },
      { code: 'frais', libelle: 'Frais' },
      { code: 'infos', libelle: 'Infos pratiques' },
      { code: 'tout', libelle: 'Tout' }
    ];
    return s?.encadrant ? liste : liste.filter(o => o.code !== 'participants' && o.code !== 'repas');
  });

  readonly moi = computed(() => this.sejour()?.participants.find(p => p.moi) ?? null);
  private readonly parId = computed(() => new Map((this.sejour()?.participants ?? []).map(p => [p.id, p])));

  /** Les jours du séjour (et ceux des rendez-vous hors de ses dates), avec rendez-vous puis plongées. */
  readonly programme = computed(() => {
    const s = this.sejour();
    if (!s) return [];
    const jours = new Map<string, LigneProgramme[]>();
    const ajouter = (jour: string, l: LigneProgramme) => jours.set(jour, [...(jours.get(jour) ?? []), l]);
    for (const e of s.evenements) {
      ajouter(e.jour, {
        heure: e.heureDebut ? heure(e.heureDebut) + (e.heureFin ? ' – ' + heure(e.heureFin) : '') : '',
        titre: e.titre, lieu: e.lieu, details: e.details, evenement: e
      });
    }
    for (const se of s.sortie.seances) {
      ajouter(se.date, {
        heure: '', titre: 'Plongée' + (se.ordre ? ' ' + se.ordre : ''),
        lieu: [se.lieu, se.site].filter(Boolean).join(' – ') || null, details: se.commentaire, evenement: null
      });
    }
    return [...jours.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([jour, lignes]) => ({ jour, lignes }));
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

  constructor() {
    void this.charger();
  }

  voir(o: Onglet): boolean {
    return this.onglet() === o || this.onglet() === 'tout';
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

  chambreDe(id: number): { chambre: string; logement: string; avec: string[] } | null {
    for (const l of this.sejour()?.logements ?? []) {
      for (const c of l.chambres) {
        if (c.occupantIds.includes(id)) {
          return { chambre: c.nom, logement: l.nom, avec: c.occupantIds.filter(o => o !== id).map(o => this.nomDe(o)) };
        }
      }
    }
    return null;
  }

  /** « vous devez 25,00 € à Inès Roux », « Léo Durand vous doit 10,00 € ». */
  mesRemboursements(id: number): string[] {
    return (this.sejour()?.frais.comptes.remboursements ?? [])
      .filter(r => r.deId === id || r.aId === id)
      .map(r => r.deId === id
        ? `vous devez ${euros(r.montantCentimes)} à ${this.nomDe(r.aId)}`
        : `${this.nomDe(r.deId)} vous doit ${euros(r.montantCentimes)}`);
  }

  libellesRegimes(codes: RegimeAlimentaire[]): string {
    return REGIMES.filter(r => codes.includes(r.code)).map(r => r.libelle.toLowerCase()).join(', ');
  }

  /** « Vendredi 03/06/2027 à 18h30, avion AF7520, Aéroport de Toulon-Hyères ». */
  texteTrajet(t: Trajet | null): string {
    if (!t) return 'à préciser';
    const moyen = TRANSPORTS.find(x => x.code === t.transport)?.libelle.toLowerCase();
    return [
      t.date ? jourLong(t.date) + (t.heure ? ' à ' + heure(t.heure) : '') : (t.heure ? 'à ' + heure(t.heure) : null),
      [moyen, t.numero].filter(Boolean).join(' ') || null,
      t.lieu
    ].filter(Boolean).join(', ') || 'à préciser';
  }

  /** Les arrivées (ou départs) regroupées par jour, heure et vol : qui attendre ensemble. */
  groupesTrajets(sens: 'arrivee' | 'depart'): GroupeTrajet[] {
    const groupes = new Map<string, GroupeTrajet & { tri: string }>();
    for (const p of this.sejour()?.participants ?? []) {
      const t = p[sens];
      if (!t || (!t.date && !t.heure)) continue;
      const cle = [t.date, t.heure?.slice(0, 5), t.transport, t.numero, t.lieu].join('|');
      const g = groupes.get(cle) ?? {
        tri: `${t.date ?? ''} ${t.heure ?? ''}`,
        quand: t.date ? jourLong(t.date) + (t.heure ? ' à ' + heure(t.heure) : '') : 'à ' + heure(t.heure),
        comment: [TRANSPORTS.find(x => x.code === t.transport)?.libelle, t.numero].filter(Boolean).join(' '),
        lieu: t.lieu, noms: []
      };
      g.noms.push(nomComplet(p));
      groupes.set(cle, g);
    }
    return [...groupes.values()].sort((a, b) => a.tri.localeCompare(b.tri));
  }

  sansTrajet(sens: 'arrivee' | 'depart'): string[] {
    return (this.sejour()?.participants ?? []).filter(p => !p[sens]?.date && !p[sens]?.heure).map(nomComplet);
  }

  affairesDe(c: CategorieAffaire) {
    return (this.sejour()?.affaires ?? []).filter(a => a.categorie === c);
  }

  imprimer(): void {
    this.onglet.set('tout');
    setTimeout(() => window.print(), 100);
  }

  /** Les frais du séjour pour l'onglet « Frais » : chaque écriture met le séjour à jour. */
  readonly portFrais = this.api.portFrais(this.id, s => this.sejour.set(s));

  /** Le lien des frais et la façon d'entrer (code par e-mail) ; null : à tous les participants sans compte. */
  envoyerAccesFrais(p: ParticipantVue | null): void {
    if (!confirm(p ? `Envoyer à ${nomComplet(p)} le lien des frais du séjour ?`
      : 'Envoyer le lien des frais à tous les participants sans compte qui ont un e-mail ?')) return;
    this.envoi.set(true);
    this.message.set(null);
    this.api.envoyerAccesFrais(this.id, p?.id ?? null).subscribe({
      next: b => {
        this.envoi.set(false);
        this.message.set([
          b.envoyes.length ? `Lien des frais envoyé à : ${b.envoyes.join(', ')}.` : 'Aucun lien envoyé.',
          b.sansEmail.length ? `Sans e-mail : ${b.sansEmail.join(', ')}.` : '',
          b.echecs.length ? `Échec de l'envoi pour : ${b.echecs.join(', ')}.` : ''
        ].filter(Boolean).join(' '));
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "Le lien n'a pas pu être envoyé.");
      }
    });
  }

  envoyerCarnet(): void {
    if (!confirm('Envoyer à chaque participant son carnet du séjour par e-mail ?')) return;
    this.envoi.set(true);
    this.api.envoyerCarnet(this.id).subscribe({
      next: b => {
        this.envoi.set(false);
        this.message.set([
          `Carnet envoyé à ${b.envoyes.length} participant${b.envoyes.length > 1 ? 's' : ''}.`,
          b.sansEmail.length ? `Sans e-mail : ${b.sansEmail.join(', ')}.` : '',
          b.echecs.length ? `Échec de l'envoi pour : ${b.echecs.join(', ')}.` : ''
        ].filter(Boolean).join(' '));
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "Le carnet n'a pas pu être envoyé.");
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
      arrivee: { ...(p.arrivee ?? trajetVide()), heure: p.arrivee?.heure?.slice(0, 5) ?? null },
      depart: { ...(p.depart ?? trajetVide()), heure: p.depart?.heure?.slice(0, 5) ?? null },
      remarques: p.remarques
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
    const trajet = (t: Trajet | null): Trajet | null =>
      !t || (!t.date && !t.heure && !t.transport && !t.numero?.trim() && !t.lieu?.trim()) ? null : t;
    const demande = { ...d, arrivee: trajet(d.arrivee), depart: trajet(d.depart) };
    this.ecrire(this.participantId === null
      ? this.api.ajouterParticipant(this.id, demande)
      : this.api.modifierParticipant(this.id, this.participantId, demande), () => this.participantOuvert.set(false));
  }

  supprimerParticipant(p: ParticipantVue): void {
    if (!confirm(`Retirer ${nomComplet(p)} du séjour ? Il quitte aussi sa voiture et sa chambre.`)) return;
    this.ecrire(this.api.supprimerParticipant(this.id, p.id));
  }

  importerGroupe(groupeId: number | null): void {
    if (groupeId === null) return;
    this.ecrire(this.api.importerGroupe(this.id, groupeId),
      () => this.message.set('Les membres du groupe qui n’étaient pas encore inscrits ont été ajoutés.'));
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
    this.ecrire(this.api.enregistrerVoiture(this.id, this.voitureId, d), () => this.voitureOuverte.set(false));
  }

  supprimerVoiture(v: VoitureVue): void {
    if (!confirm(`Supprimer la voiture « ${v.nom} » ?`)) return;
    this.ecrire(this.api.supprimerVoiture(this.id, v.id));
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
    this.ecrire(this.api.enregistrerLogement(this.id, this.logementId, this.logement), () => this.logementOuvert.set(false));
  }

  supprimerLogement(l: LogementVue): void {
    if (!confirm(`Supprimer « ${l.nom} » et ses chambres ?`)) return;
    this.ecrire(this.api.supprimerLogement(this.id, l.id));
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
    this.ecrire(this.api.definirAffaires(this.id, liste), () => this.affairesOuvertes.set(false));
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
    this.ecrire(this.api.enregistrerEvenement(this.id, this.evenementId, d), () => this.evenementOuvert.set(false));
  }

  supprimerEvenement(): void {
    if (this.evenementId === null || !confirm('Supprimer ce rendez-vous ?')) return;
    this.ecrire(this.api.supprimerEvenement(this.id, this.evenementId), () => this.evenementOuvert.set(false));
  }

  // ---------------- Infos ----------------

  ouvrirInfos(): void {
    this.erreur.set(null);
    this.infos = this.sejour()?.infosPratiques ?? '';
    this.infosOuvertes.set(true);
  }

  enregistrerInfos(): void {
    this.ecrire(this.api.definirInfos(this.id, this.infos.trim() || null), () => this.infosOuvertes.set(false));
  }

  /** Toute écriture renvoie le séjour à jour ; un refus s'affiche dans la fenêtre ouverte (ou en haut). */
  private ecrire(appel: Observable<SejourVue>, ensuite?: () => void): void {
    this.envoi.set(true);
    this.erreur.set(null);
    this.message.set(null);
    appel.subscribe({
      next: s => {
        this.envoi.set(false);
        this.sejour.set(s);
        ensuite?.();
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        const texte = e.error?.detail ?? "L'enregistrement n'a pas abouti (réseau nécessaire).";
        this.erreur.set(texte);
        if (!this.participantOuvert() && !this.voitureOuverte() && !this.logementOuvert()
          && !this.affairesOuvertes() && !this.evenementOuvert() && !this.infosOuvertes()) {
          this.message.set(texte);
        }
      }
    });
  }

  private async charger(): Promise<void> {
    try {
      this.sejour.set(await firstValueFrom(this.api.lire(this.id)));
    } catch (e) {
      const statut = (e as HttpErrorResponse).status;
      this.message.set(statut === 403 ? "Ce séjour n'est ouvert qu'à ses participants et aux encadrants."
        : statut === 404 ? 'Séjour introuvable.' : 'Impossible de charger le séjour (réseau nécessaire).');
    } finally {
      this.chargement.set(false);
    }
  }
}
