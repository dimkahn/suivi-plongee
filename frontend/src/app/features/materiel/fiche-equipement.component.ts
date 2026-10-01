import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import {
  DemandeEquipement, DemandeIntervention, EquipementVue, FicheEquipementVue, LIBELLES_STATUT_EQUIPEMENT,
  TYPES_EQUIPEMENT, TYPES_INTERVENTION, TypeEquipement
} from '../../core/modeles';
import { DateFrPipe, dateDuJour, dateFr } from '../../core/date-fr';
import { descriptionEquipement } from './materiel';

function demandeVide(type: TypeEquipement): DemandeEquipement {
  return {
    type, reference: '', ancienneReference: null, proprietaire: null, constructeur: null,
    marque: null, modele: null, numeroSerie: null, taille: null,
    dateFabrication: null, dateAchat: null, dateMiseEnService: null, dateRebutPrevue: null,
    notice: null, consignesEntretien: null, periodiciteRevisionMois: null,
    volumeLitres: null, pressionServiceBar: null, pressionEpreuveBar: null, matiere: null, robinetterie: null,
    numeroRobinet: null, datePremiereEpreuve: null, nitrox: false, regimeTiv: true, composition: null, epaisseurMm: null,
    horsService: false, remarques: null,
    derniereInspectionVisuelle: null, derniereRequalification: null, derniereRevision: null
  };
}

function demandeDepuis(e: EquipementVue): DemandeEquipement {
  const d = demandeVide(e.type);
  for (const cle of Object.keys(d) as (keyof DemandeEquipement)[]) {
    if (cle in e) (d as unknown as Record<string, unknown>)[cle] = (e as unknown as Record<string, unknown>)[cle];
  }
  return d;
}

/** Les champs vides du formulaire partent à null, pas en chaîne vide. */
function nettoyer(d: DemandeEquipement): DemandeEquipement {
  const copie = { ...d } as unknown as Record<string, unknown>;
  for (const [cle, valeur] of Object.entries(copie)) {
    if (valeur === '' || (typeof valeur === 'string' && valeur.trim() === '')) copie[cle] = null;
  }
  return copie as unknown as DemandeEquipement;
}

/**
 * Fiche de gestion d'un équipement (Code du sport, annexe III-27) : sa
 * description, ses échéances, son journal d'interventions et ses prêts.
 * Sert aussi à l'enregistrement d'un nouvel équipement (/materiel/nouveau).
 */
@Component({
  selector: 'app-fiche-equipement',
  imports: [FormsModule, RouterLink, DateFrPipe],
  template: `
    <a routerLink="/materiel" class="retour pas-imprime">← Matériel</a>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (creation() || edition()) {
      <h1>{{ creation() ? 'Nouvel équipement' : 'Modifier ' + (fiche()?.equipement?.typeLibelle ?? '') + ' ' + (fiche()?.equipement?.reference ?? '') }}</h1>

      <form class="carte formulaire" (ngSubmit)="enregistrer()">
        @if (creation()) {
          <fieldset>
            <legend>Type de matériel</legend>
            <div class="types">
              @for (t of types; track t.valeur) {
                <label class="choix" [class.actif]="f.type === t.valeur">
                  <input type="radio" name="type" [value]="t.valeur" [(ngModel)]="f.type">
                  {{ t.libelle }}
                </label>
              }
            </div>
          </fieldset>
        }

        <fieldset>
          <legend>Identification</legend>
          <div class="grille">
            <div>
              <label for="reference">Référence du club *</label>
              <input id="reference" name="reference" [(ngModel)]="f.reference" required maxlength="30"
                     [placeholder]="exempleReference()">
            </div>
            <div>
              <label for="ancienneReference">Ancienne référence</label>
              <input id="ancienneReference" name="ancienneReference" [(ngModel)]="f.ancienneReference" maxlength="30">
            </div>
            <div>
              <label for="numeroSerie">N° de série</label>
              <input id="numeroSerie" name="numeroSerie" [(ngModel)]="f.numeroSerie" maxlength="60">
            </div>
            <div>
              <label for="proprietaire">Propriétaire</label>
              <input id="proprietaire" name="proprietaire" [(ngModel)]="f.proprietaire" maxlength="80"
                     placeholder="Vide : le club">
            </div>
            <div>
              <label for="marque">Marque</label>
              <input id="marque" name="marque" [(ngModel)]="f.marque" maxlength="80">
            </div>
            @if (f.type === 'BLOC') {
              <div>
                <label for="constructeur">Constructeur</label>
                <input id="constructeur" name="constructeur" [(ngModel)]="f.constructeur" maxlength="80"
                       placeholder="Roth, Heiser…">
              </div>
            }
            <div>
              <label for="modele">Modèle</label>
              <input id="modele" name="modele" [(ngModel)]="f.modele" maxlength="80">
            </div>
            @if (f.type !== 'BLOC') {
              <div>
                <label for="taille">Taille</label>
                <input id="taille" name="taille" [(ngModel)]="f.taille" maxlength="20" placeholder="M, L, 2…">
              </div>
            }
            @if (f.type === 'COMBINAISON') {
              <div>
                <label for="epaisseur">Épaisseur (mm)</label>
                <input id="epaisseur" name="epaisseur" type="number" min="0.5" step="0.5" [(ngModel)]="f.epaisseurMm">
              </div>
            }
          </div>
          @if (f.type === 'DETENDEUR') {
            <label for="composition">Composition</label>
            <input id="composition" name="composition" [(ngModel)]="f.composition" maxlength="255"
                   placeholder="1er étage, 2e étage, octopus, manomètre">
            <p class="secondaire">
              L'assemblage conditionne la conformité à la norme EN 250 : notez chaque élément.
            </p>
          }
        </fieldset>

        @if (f.type === 'BLOC') {
          <fieldset>
            <legend>Caractéristiques du bloc</legend>
            <div class="grille">
              <div>
                <label for="volume">Volume (L)</label>
                <input id="volume" name="volume" type="number" min="0.1" step="0.1" [(ngModel)]="f.volumeLitres">
              </div>
              <div>
                <label for="matiere">Matière</label>
                <select id="matiere" name="matiere" [(ngModel)]="f.matiere">
                  <option [ngValue]="null">—</option>
                  <option ngValue="ACIER">Acier</option>
                  <option ngValue="ALUMINIUM">Aluminium</option>
                </select>
              </div>
              <div>
                <label for="pressionService">Pression de service (bar)</label>
                <input id="pressionService" name="pressionService" type="number" min="1" [(ngModel)]="f.pressionServiceBar">
              </div>
              <div>
                <label for="pressionEpreuve">Pression d'épreuve (bar)</label>
                <input id="pressionEpreuve" name="pressionEpreuve" type="number" min="1" [(ngModel)]="f.pressionEpreuveBar">
              </div>
              <div>
                <label for="robinetterie">Robinetterie</label>
                <input id="robinetterie" name="robinetterie" [(ngModel)]="f.robinetterie" maxlength="80"
                       placeholder="Marque, mono-sortie DIN/étrier…">
              </div>
              <div>
                <label for="numeroRobinet">N° du robinet</label>
                <input id="numeroRobinet" name="numeroRobinet" [(ngModel)]="f.numeroRobinet" maxlength="60">
              </div>
              <div>
                <label for="premiereEpreuve">Date de première épreuve</label>
                <input id="premiereEpreuve" name="premiereEpreuve" type="date" [(ngModel)]="f.datePremiereEpreuve">
              </div>
            </div>
            <label class="case">
              <input type="checkbox" name="nitrox" [(ngModel)]="f.nitrox">
              Bloc nitrox (dégraissé, compatible oxygène)
            </label>
            <label class="case">
              <input type="checkbox" name="regimeTiv" [(ngModel)]="f.regimeTiv">
              Suivi sous le régime TIV (inspection annuelle : requalification tous les 6 ans au lieu de 2)
            </label>
          </fieldset>
        }

        <fieldset>
          <legend>Dates</legend>
          <div class="grille">
            <div>
              <label for="fabrication">Fabrication</label>
              <input id="fabrication" name="fabrication" type="date" [(ngModel)]="f.dateFabrication">
            </div>
            <div>
              <label for="achat">Achat</label>
              <input id="achat" name="achat" type="date" [(ngModel)]="f.dateAchat">
            </div>
            <div>
              <label for="miseEnService">Mise en service</label>
              <input id="miseEnService" name="miseEnService" type="date" [(ngModel)]="f.dateMiseEnService">
            </div>
            <div>
              <label for="rebutPrevu">Mise au rebut prévue</label>
              <input id="rebutPrevu" name="rebutPrevu" type="date" [(ngModel)]="f.dateRebutPrevue">
            </div>
          </div>
          <p class="secondaire">
            Mise au rebut prévue : pour le matériel qui vieillit (durée de vie donnée par la notice). Une fois
            la date atteinte, il n'est plus prêté.
          </p>
        </fieldset>

        <fieldset>
          <legend>Entretien</legend>
          <label for="notice">Notice du fabricant</label>
          <input id="notice" name="notice" [(ngModel)]="f.notice" maxlength="255"
                 placeholder="Où la trouver : classeur, lien…">
          @if (f.type !== 'BLOC') {
            <label for="periodicite">Révision tous les (mois)</label>
            <input id="periodicite" name="periodicite" type="number" min="1" [(ngModel)]="f.periodiciteRevisionMois">
            <p class="secondaire">D'après la notice (souvent 12 ou 24 mois). Vide : pas de suivi d'échéance.</p>
          }
          <label for="consignes">Organisation de l'entretien</label>
          <textarea id="consignes" name="consignes" rows="3" [(ngModel)]="f.consignesEntretien"
                    placeholder="Rinçage, désinfection, révision : qui fait quoi, et quand"></textarea>
        </fieldset>

        @if (creation()) {
          <fieldset>
            <legend>Historique (équipement déjà en service)</legend>
            <p class="secondaire">Facultatif : chaque date remplie crée une ligne « conforme » dans le journal.</p>
            <div class="grille">
              @if (f.type === 'BLOC') {
                <div>
                  <label for="derniereTiv">Dernière inspection visuelle (TIV)</label>
                  <input id="derniereTiv" name="derniereTiv" type="date" [(ngModel)]="f.derniereInspectionVisuelle">
                </div>
                <div>
                  <label for="derniereRequal">Dernière requalification</label>
                  <input id="derniereRequal" name="derniereRequal" type="date" [(ngModel)]="f.derniereRequalification">
                </div>
              } @else {
                <div>
                  <label for="derniereRevision">Dernière révision</label>
                  <input id="derniereRevision" name="derniereRevision" type="date" [(ngModel)]="f.derniereRevision">
                </div>
              }
            </div>
          </fieldset>
        }

        <fieldset>
          <legend>Divers</legend>
          @if (!creation()) {
            <label class="case">
              <input type="checkbox" name="horsService" [(ngModel)]="f.horsService">
              Hors service (plus prêté jusqu'à nouvel ordre)
            </label>
          }
          <label for="remarques">Remarques</label>
          <textarea id="remarques" name="remarques" rows="2" [(ngModel)]="f.remarques"></textarea>
        </fieldset>

        <div class="actions">
          <button type="submit" class="bouton-principal" [disabled]="envoi()">
            {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
          <button type="button" class="bouton-discret" (click)="annulerEdition()">Annuler</button>
        </div>
      </form>
    } @else if (fiche(); as fi) {
      @let e = fi.equipement;
      <div class="entete">
        <div>
          <h1>{{ e.typeLibelle }} {{ e.reference }}</h1>
          @if (e.ancienneReference) { <p class="ancien">Ancien n° {{ e.ancienneReference }}</p> }
          @if (description(e); as d) { <p class="secondaire">{{ d }}</p> }
        </div>
        <span [class]="'etat statut-' + e.statut">{{ libelleStatut[e.statut] }}</span>
      </div>

      @for (a of e.alertes; track a.message) {
        <div class="alerte" [class.bloquant]="a.gravite === 'BLOQUANT'" role="status">{{ a.message }}</div>
      }
      @if (e.pretEnCours; as p) {
        <p>
          Prêté à <strong>{{ p.emprunteur }}</strong>@if (p.dateRetourPrevue) {, retour prévu le {{ p.dateRetourPrevue | dateFr }}}.
          <a routerLink="/materiel/prets" class="pas-imprime">Voir les prêts</a>
        </p>
      }

      <div class="actions pas-imprime">
        @if (e.statut !== 'REBUTE') {
          <button type="button" class="bouton-discret" (click)="commencerEdition()">Modifier</button>
        }
        @if (e.statut === 'DISPONIBLE') {
          <a [routerLink]="['/materiel/prets']" [queryParams]="{ equipement: e.id }" class="bouton-principal">Prêter</a>
        }
        <button type="button" class="bouton-discret" (click)="imprimer()">Imprimer la fiche</button>
      </div>

      <section class="carte bloc-fiche">
        <h2>Échéances</h2>
        <dl class="echeances">
          @if (e.type === 'BLOC') {
            <div><dt>Dernière inspection visuelle</dt><dd>{{ (e.derniereInspection | dateFr) || '—' }}</dd></div>
            <div><dt>Prochaine inspection (12 mois max.)</dt><dd>{{ (e.prochaineInspection | dateFr) || '—' }}</dd></div>
            <div><dt>Dernière requalification</dt><dd>{{ (e.derniereRequalification | dateFr) || '—' }}</dd></div>
            <div>
              <dt>Prochaine requalification ({{ e.regimeTiv ? '6 ans, régime TIV' : '2 ans' }})</dt>
              <dd>{{ (e.prochaineRequalification | dateFr) || '—' }}</dd>
            </div>
          } @else if (e.periodiciteRevisionMois) {
            <div><dt>Dernière révision</dt><dd>{{ (e.derniereRevision | dateFr) || '—' }}</dd></div>
            <div>
              <dt>Prochaine révision ({{ e.periodiciteRevisionMois }} mois)</dt>
              <dd>{{ (e.prochaineRevision | dateFr) || '—' }}</dd>
            </div>
          } @else {
            <div><dt>Révision</dt><dd>Pas de périodicité renseignée</dd></div>
          }
          <div><dt>Mise au rebut prévue</dt><dd>{{ (e.dateRebutPrevue | dateFr) || '—' }}</dd></div>
        </dl>
      </section>

      <section class="carte bloc-fiche">
        <h2>Fiche</h2>
        <dl class="caracteristiques">
          @for (c of caracteristiques(); track c.libelle) {
            <div><dt>{{ c.libelle }}</dt><dd>{{ c.valeur }}</dd></div>
          }
        </dl>
        @if (e.consignesEntretien) {
          <h3>Organisation de l'entretien</h3>
          <p class="texte-libre">{{ e.consignesEntretien }}</p>
        }
        @if (e.remarques) {
          <h3>Remarques</h3>
          <p class="texte-libre">{{ e.remarques }}</p>
        }
      </section>

      <section class="carte bloc-fiche">
        <h2>Journal</h2>
        <p class="secondaire">
          Contrôles, révisions, réparations, pièces remplacées, désinfections, incidents. Le journal ne se modifie
          pas : une erreur se corrige par une nouvelle ligne.
        </p>

        @if (e.statut !== 'REBUTE' && !ajoutJournal()) {
          <div class="actions ouvrir-journal pas-imprime">
            @if (e.type === 'BLOC') {
              <a [routerLink]="['/materiel', e.id, 'tiv']" class="bouton-principal">Remplir la fiche d'inspection TIV</a>
            }
            <button type="button" class="bouton-discret" (click)="ajoutJournal.set(true)">
              Ajouter une entrée au journal
            </button>
          </div>
        }
        @if (e.statut !== 'REBUTE' && ajoutJournal()) {
          <form class="ajout-journal pas-imprime" (ngSubmit)="ajouterIntervention()">
            <div class="grille">
              <div>
                <label for="typeIntervention">Intervention</label>
                <select id="typeIntervention" name="typeIntervention" [(ngModel)]="i.type">
                  @for (t of typesIntervention(); track t.valeur) {
                    <option [ngValue]="t.valeur">{{ t.libelle }}</option>
                  }
                </select>
              </div>
              <div>
                <label for="dateIntervention">Date</label>
                <input id="dateIntervention" name="dateIntervention" type="date" [max]="aujourdhui"
                       [(ngModel)]="i.dateIntervention">
              </div>
              <div>
                <label for="intervenant">Intervenant</label>
                <input id="intervenant" name="intervenant" [(ngModel)]="i.intervenant" maxlength="120"
                       placeholder="TIV (nom, n°), atelier…">
              </div>
              <div>
                <label for="resultat">Résultat</label>
                <select id="resultat" name="resultat" [(ngModel)]="i.resultat">
                  <option [ngValue]="null">Sans objet</option>
                  <option ngValue="CONFORME">Conforme</option>
                  <option ngValue="NON_CONFORME">Non conforme</option>
                </select>
              </div>
            </div>
            <label for="descriptionIntervention">Détail</label>
            <textarea id="descriptionIntervention" name="descriptionIntervention" rows="2"
                      [(ngModel)]="i.description"
                      [placeholder]="i.type === 'INCIDENT' ? 'Que s\\'est-il passé ? (obligatoire)' : 'Pièces changées, observations…'">
            </textarea>
            <div class="actions">
              <button type="submit" class="bouton-principal" [disabled]="envoi()">Ajouter au journal</button>
              <button type="button" class="bouton-discret" (click)="fermerAjoutJournal()">Annuler</button>
            </div>
          </form>
        }

        @if (fi.journal.length === 0) {
          <p class="vide">Aucune intervention enregistrée.</p>
        } @else {
          <ol class="journal">
            @for (j of fi.journal; track j.id) {
              <li>
                <div class="ligne-journal">
                  <strong>{{ j.dateIntervention | dateFr }} · {{ j.typeLibelle }}</strong>
                  @if (j.resultat) {
                    <span class="resultat" [class.non-conforme]="j.resultat === 'NON_CONFORME'">
                      {{ j.resultat === 'CONFORME' ? 'Conforme' : 'Non conforme' }}
                    </span>
                  }
                </div>
                @if (j.intervenant) { <span class="secondaire">{{ j.intervenant }}</span> }
                @if (j.description) { <p class="texte-libre">{{ j.description }}</p> }
                @if (j.inspectionTivId) {
                  <a [routerLink]="['/materiel/tiv', j.inspectionTivId]" class="lien-tiv pas-imprime">Voir la fiche d'inspection</a>
                }
                <span class="secondaire">Saisi par {{ j.saisiPar ?? 'un compte supprimé' }}</span>
              </li>
            }
          </ol>
        }
      </section>

      <section class="carte bloc-fiche">
        <h2>Prêts</h2>
        @if (fi.prets.length === 0) {
          <p class="vide">Jamais prêté.</p>
        } @else {
          <ul class="prets">
            @for (p of fi.prets; track p.id) {
              <li>
                <strong>{{ p.emprunteur }}</strong>
                — du {{ p.datePret | dateFr }}
                @if (p.dateRetour) { au {{ p.dateRetour | dateFr }} } @else { <em>(en cours)</em> }
                @if (p.sortieNom || p.motif) { <span class="secondaire"> · {{ p.sortieNom ?? p.motif }}</span> }
              </li>
            }
          </ul>
        }
      </section>

      <section class="carte bloc-fiche pas-imprime">
        <h2>Mise au rebut</h2>
        @if (e.dateRebut) {
          <p>Mis au rebut le {{ e.dateRebut | dateFr }} : {{ e.motifRebut }}</p>
          <p class="secondaire">
            La fiche est à conserver jusqu'au {{ conservationJusquAu(e.dateRebut) | dateFr }}
            (trois ans après la mise au rebut, art. A322-177).
          </p>
          <button type="button" class="bouton-discret" (click)="remettreEnStock()">
            Annuler la mise au rebut
          </button>
        } @else {
          <div class="grille">
            <div>
              <label for="dateRebut">Date</label>
              <input id="dateRebut" type="date" [max]="aujourdhui" [(ngModel)]="rebut.date">
            </div>
            <div>
              <label for="motifRebut">Motif</label>
              <input id="motifRebut" [(ngModel)]="rebut.motif" maxlength="255" placeholder="Corrosion, fin de vie…">
            </div>
          </div>
          <button type="button" class="bouton-discret" (click)="mettreAuRebut()" [disabled]="envoi()">
            Mettre au rebut
          </button>
        }
        @if (fi.journal.length === 0 && fi.prets.length === 0) {
          <p class="secondaire">Enregistré par erreur ? Sans historique, il peut encore être supprimé.</p>
          <button type="button" class="bouton-discret danger" (click)="supprimer()">Supprimer l'équipement</button>
        }
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .retour { display: inline-flex; align-items: center; min-height: 44px; margin-bottom: var(--pas); }
    h1 { margin-bottom: var(--pas); }
    h3 { margin: var(--pas-2) 0 4px; font-size: .9375rem; }
    .entete { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas-2); }
    .etat { flex: none; padding: 4px 12px; border-radius: var(--r-s); font-size: .875rem; font-weight: 700; }
    .statut-DISPONIBLE { background: var(--acquis-clair); color: var(--acquis); }
    .statut-PRETE { background: #E0F2FE; color: var(--profond-fonce); }
    .statut-A_REGULARISER { background: #FEE2E2; color: #B91C1C; }
    .statut-HORS_SERVICE { background: var(--en-cours-clair); color: var(--en-cours); }
    .statut-REBUTE { background: #EEF2F4; color: var(--craie); }
    .alerte.bloquant { border-left-color: #B91C1C; background: #FEE2E2; }

    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin: var(--pas-2) 0; }
    .actions a { display: inline-flex; align-items: center; text-decoration: none; }

    .formulaire { padding: var(--pas-3); margin-top: var(--pas-2); max-width: 760px; }
    fieldset { border: none; padding: 0; margin: 0 0 var(--pas-3); }
    legend { font-family: var(--font-titres); font-weight: 700; font-size: 1.0625rem; margin-bottom: var(--pas); }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0 var(--pas-2); }
    .case { display: flex; align-items: center; gap: var(--pas); font-weight: 400; min-height: 44px; margin: var(--pas) 0; }
    .case input { width: auto; flex: none; }
    .types { display: flex; gap: var(--pas); flex-wrap: wrap; }
    .choix {
      display: flex; align-items: center; gap: var(--pas); margin: 0; min-height: 44px; padding: 0 var(--pas-2);
      border: 1px solid var(--trait); border-radius: var(--r-s); cursor: pointer; font-weight: 400;
    }
    .choix input { width: auto; }
    .choix.actif { border-color: var(--profond); background: #E0F2FE; font-weight: 700; }
    textarea { resize: vertical; }

    .bloc-fiche { padding: var(--pas-2) var(--pas-3); margin-bottom: var(--pas-2); }
    .bloc-fiche h2 { margin-bottom: var(--pas); }
    dl { margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--pas) var(--pas-2); }
    dt { font-size: .8125rem; color: var(--craie); }
    dd { margin: 0; font-weight: 700; }
    .texte-libre { white-space: pre-line; margin: 4px 0; }

    .ajout-journal { padding: var(--pas-2); margin-bottom: var(--pas-2); background: var(--fond); border-radius: var(--r-s); }
    .ajout-journal .actions { margin-bottom: 0; }
    .ouvrir-journal { margin: 0 0 var(--pas-2); }
    .lien-tiv { display: inline-flex; align-items: center; min-height: 44px; }
    .ancien { margin: 0 0 4px; font-weight: 700; color: var(--craie); }
    .journal { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2); }
    .journal li { border-left: 3px solid var(--trait); padding-left: var(--pas-2); display: flex; flex-direction: column; gap: 2px; }
    .ligne-journal { display: flex; gap: var(--pas); align-items: center; flex-wrap: wrap; }
    .resultat { padding: 1px 8px; border-radius: var(--r-s); font-size: .8125rem; font-weight: 700;
                background: var(--acquis-clair); color: var(--acquis); }
    .resultat.non-conforme { background: #FEE2E2; color: #B91C1C; }
    .prets { margin: 0; padding-left: 1.25rem; display: grid; gap: 4px; }
    .danger { color: #B91C1C; border-color: #FCA5A5; margin-top: var(--pas); }

    @media (max-width: 600px) {
      .formulaire { padding: var(--pas-2); }
      .bloc-fiche { padding: var(--pas-2); }
    }
    @media print {
      .pas-imprime { display: none !important; }
      .carte { box-shadow: none; border: 1px solid #ccc; break-inside: avoid; }
    }
  `]
})
export class FicheEquipementComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly types = TYPES_EQUIPEMENT;
  readonly libelleStatut = LIBELLES_STATUT_EQUIPEMENT;
  readonly description = descriptionEquipement;
  readonly aujourdhui = dateDuJour();

  id = signal<number | null>(null);
  creation = computed(() => this.id() === null);
  fiche = signal<FicheEquipementVue | null>(null);
  chargement = signal(true);
  message = signal<string | null>(null);
  envoi = signal(false);
  edition = signal(false);
  /** Le formulaire du journal reste replié tant qu'on ne le demande pas. */
  ajoutJournal = signal(false);

  /** Formulaire de création ou de modification. */
  f: DemandeEquipement = demandeVide('BLOC');
  i: DemandeIntervention = this.interventionVide();
  rebut = { date: dateDuJour(), motif: '' };

  typesIntervention = computed(() => {
    const e = this.fiche()?.equipement;
    return TYPES_INTERVENTION.filter(t => !t.blocSeulement || e?.type === 'BLOC');
  });

  caracteristiques = computed(() => {
    const e = this.fiche()?.equipement;
    if (!e) return [];
    const lignes: { libelle: string; valeur: string | number | null }[] = [
      { libelle: 'Référence du club', valeur: e.reference },
      { libelle: 'Ancienne référence', valeur: e.ancienneReference },
      { libelle: 'Propriétaire', valeur: e.proprietaire ?? 'Le club' },
      { libelle: 'Constructeur', valeur: e.constructeur },
      { libelle: 'Marque', valeur: e.marque },
      { libelle: 'Modèle', valeur: e.modele },
      { libelle: 'N° de série', valeur: e.numeroSerie },
      { libelle: 'Taille', valeur: e.taille },
      { libelle: 'Épaisseur', valeur: e.epaisseurMm != null ? `${e.epaisseurMm} mm` : null },
      { libelle: 'Composition', valeur: e.composition },
      { libelle: 'Volume', valeur: e.volumeLitres != null ? `${e.volumeLitres} L` : null },
      { libelle: 'Matière', valeur: e.matiere === 'ACIER' ? 'Acier' : e.matiere === 'ALUMINIUM' ? 'Aluminium' : null },
      { libelle: 'Pression de service', valeur: e.pressionServiceBar != null ? `${e.pressionServiceBar} bar` : null },
      { libelle: "Pression d'épreuve", valeur: e.pressionEpreuveBar != null ? `${e.pressionEpreuveBar} bar` : null },
      { libelle: 'Robinetterie', valeur: e.robinetterie },
      { libelle: 'N° du robinet', valeur: e.numeroRobinet },
      { libelle: 'Première épreuve', valeur: this.fr(e.datePremiereEpreuve) },
      { libelle: 'Nitrox', valeur: e.type === 'BLOC' ? (e.nitrox ? 'Oui' : 'Non') : null },
      { libelle: 'Régime TIV', valeur: e.type === 'BLOC' ? (e.regimeTiv ? 'Oui' : 'Non') : null },
      { libelle: 'Fabrication', valeur: this.fr(e.dateFabrication) },
      { libelle: 'Achat', valeur: this.fr(e.dateAchat) },
      { libelle: 'Mise en service', valeur: this.fr(e.dateMiseEnService) },
      { libelle: 'Notice du fabricant', valeur: e.notice }
    ];
    return lignes.filter(l => l.valeur != null && l.valeur !== '') as { libelle: string; valeur: string | number }[];
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(p => {
      const brut = p.get('id');
      const id = brut === 'nouveau' ? null : Number(brut);
      this.id.set(id);
      this.edition.set(false);
      this.ajoutJournal.set(false);
      this.message.set(null);
      if (id === null) {
        const type = this.route.snapshot.queryParamMap.get('type') as TypeEquipement | null;
        this.f = demandeVide(type && TYPES_EQUIPEMENT.some(t => t.valeur === type) ? type : 'BLOC');
        this.fiche.set(null);
        this.chargement.set(false);
      } else {
        void this.charger(id);
      }
    });
  }

  exempleReference(): string {
    return { BLOC: 'B-12', DETENDEUR: 'D-03', GILET: 'G-07', COMBINAISON: 'C-15' }[this.f.type];
  }

  conservationJusquAu(dateRebut: string): string {
    const [a, m, j] = dateRebut.split('-');
    return `${Number(a) + 3}-${m}-${j}`;
  }

  commencerEdition(): void {
    const e = this.fiche()?.equipement;
    if (!e) return;
    this.f = demandeDepuis(e);
    this.message.set(null);
    this.edition.set(true);
  }

  annulerEdition(): void {
    if (this.creation()) {
      void this.router.navigate(['/materiel']);
    } else {
      this.edition.set(false);
    }
  }

  enregistrer(): void {
    if (!this.f.reference?.trim()) {
      this.message.set('La référence du club est obligatoire.');
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    const demande = nettoyer(this.f);
    const id = this.id();
    const appel = id === null ? this.api.creerEquipement(demande) : this.api.modifierEquipement(id, demande);
    appel.subscribe({
      next: e => {
        this.envoi.set(false);
        if (id === null) {
          void this.router.navigate(['/materiel', e.id]);
        } else {
          this.edition.set(false);
          void this.charger(id);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(err.error?.detail ?? "L'équipement n'a pas pu être enregistré.");
      }
    });
  }

  ajouterIntervention(): void {
    const id = this.id();
    if (id === null) return;
    if (!this.i.dateIntervention) {
      this.message.set("La date de l'intervention est obligatoire.");
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    this.api.ajouterIntervention(id, {
      ...this.i, intervenant: this.i.intervenant?.trim() || null, description: this.i.description?.trim() || null
    }).subscribe({
      next: () => {
        this.envoi.set(false);
        this.fermerAjoutJournal();
        void this.charger(id);
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(err.error?.detail ?? "L'intervention n'a pas pu être enregistrée.");
      }
    });
  }

  fermerAjoutJournal(): void {
    this.i = this.interventionVide();
    const e = this.fiche()?.equipement;
    if (e?.type === 'BLOC') this.i = { ...this.i, type: 'INSPECTION_VISUELLE' };
    this.ajoutJournal.set(false);
  }

  mettreAuRebut(): void {
    const id = this.id();
    if (id === null) return;
    if (!this.rebut.date || !this.rebut.motif.trim()) {
      this.message.set('La date et le motif de la mise au rebut sont obligatoires.');
      return;
    }
    if (!confirm('Mettre cet équipement au rebut ? Il ne sera plus prêté.')) return;
    this.envoi.set(true);
    this.api.mettreAuRebut(id, this.rebut.date, this.rebut.motif.trim()).subscribe({
      next: () => { this.envoi.set(false); void this.charger(id); },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(err.error?.detail ?? "La mise au rebut n'a pas pu être enregistrée.");
      }
    });
  }

  remettreEnStock(): void {
    const id = this.id();
    if (id === null) return;
    this.api.remettreEnStock(id).subscribe({
      next: () => void this.charger(id),
      error: (err: HttpErrorResponse) => this.message.set(err.error?.detail ?? "L'action n'a pas pu être enregistrée.")
    });
  }

  supprimer(): void {
    const id = this.id();
    if (id === null || !confirm('Supprimer définitivement cet équipement ?')) return;
    this.api.supprimerEquipement(id).subscribe({
      next: () => void this.router.navigate(['/materiel']),
      error: (err: HttpErrorResponse) => this.message.set(err.error?.detail ?? "La suppression n'a pas pu être faite.")
    });
  }

  imprimer(): void {
    window.print();
  }

  private interventionVide(): DemandeIntervention {
    return { type: 'CONTROLE', dateIntervention: dateDuJour(), intervenant: null, resultat: 'CONFORME', description: null };
  }

  private fr(iso: string | null): string | null {
    return iso ? dateFr(iso) : null;
  }

  private async charger(id: number): Promise<void> {
    this.chargement.set(this.fiche()?.equipement.id !== id);
    try {
      const fiche = await firstValueFrom(this.api.ficheEquipement(id));
      this.fiche.set(fiche);
      if (fiche.equipement.type === 'BLOC' && this.i.type === 'CONTROLE' && !this.i.description) {
        this.i = { ...this.i, type: 'INSPECTION_VISUELLE' };
      }
    } catch {
      this.message.set("Impossible de charger la fiche de l'équipement.");
    } finally {
      this.chargement.set(false);
    }
  }
}
