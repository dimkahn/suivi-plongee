import { Component, ElementRef, HostListener, computed, inject, signal, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { dateFr } from '../../core/date-fr';
import { ComboboxComponent, OptionCombobox } from '../../core/combobox.component';
import { JOURS, codeCase, jourDe } from '../../core/planning';
import {
  CasePlanningVue, DemandeCasePlanning, GroupePlanningVue, MoniteurOptionVue, PlanningVue, ReponseDisponibilite,
  SaisonVue, SoireePlanningVue
} from '../../core/modeles';

/** Périodes proposées pour ne pas afficher toute la saison d'un coup (mois 1-12). */
const PERIODES = [
  { cle: 'tout', libelle: 'Toute la saison', mois: [] as number[] },
  { cle: 't1', libelle: 'Septembre – décembre', mois: [9, 10, 11, 12] },
  { cle: 't2', libelle: 'Janvier – mars', mois: [1, 2, 3] },
  { cle: 't3', libelle: 'Avril – juin', mois: [4, 5, 6] }
];

/** Choix proposés dans l'éditeur d'une case. */
type ChoixCase = 'ATTITREE' | 'LIGNES' | 'FOSSE' | 'FOSSE_LIMITEE' | 'ACTIVITE' | 'ABSENT';

interface EditionCase {
  groupe: GroupePlanningVue;
  date: string;
  choix: ChoixCase;
  /** Lignes d'eau cochées (choix LIGNES), une ou plusieurs. */
  lignes: number[];
  /** Fosse choisie (choix FOSSE ou FOSSE_LIMITEE). */
  espaceId: number | null;
  profondeurLimitee: number;
  activite: string;
  /** Cases sélectionnées qui reçoivent toutes le même choix ; null : la seule case groupe × date. */
  cibles: CibleCase[] | null;
}

interface CibleCase {
  date: string;
  groupeId: number;
}

/** Appui en cours sur une case : glisser à la souris, ou appui long au doigt. */
interface Appui {
  groupe: number;
  soiree: number;
  souris: boolean;
  x: number;
  y: number;
  glisse: boolean;
  /** Sélection d'avant le glisser (Ctrl enfoncé), à laquelle s'ajoute le rectangle. */
  base: Set<string>;
  minuterie: ReturnType<typeof setTimeout> | null;
}

/** Durée d'un appui long au doigt, en millisecondes. */
const DUREE_APPUI_LONG = 500;

interface EditionSoiree {
  date: string;
  dpFosseId: number | null;
  dpPiscineId: number | null;
  note: string;
}

/**
 * Planning du bassin, tenu par l'admin : une ligne par groupe d'entraînement,
 * une colonne par soirée. Une case vaut la ligne attitrée du groupe tant
 * qu'on n'y touche pas ; on la change pour une ou plusieurs autres lignes, la fosse (ou la
 * fosse limitée, le « F6 »), une activité ou une absence. Les avertissements
 * viennent du serveur et n'empêchent rien.
 */
@Component({
  selector: 'app-planning-admin',
  imports: [FormsModule, RouterLink, ComboboxComponent],
  template: `
    <h1>Planning du bassin</h1>
    <p class="secondaire">
      Touchez une case pour placer un groupe ce soir-là, ou les lignes « DP fosse » et « DP piscine » pour
      choisir les directeurs de plongée et les présences annoncées des encadrants. Une case en gris clair est la ligne
      attitrée du groupe.
    </p>
    <p class="secondaire aide-selection">
      Plusieurs cases d'un coup : glissez la souris sur les cases (Ctrl + clic pour en ajouter ou en retirer) ;
      sur téléphone, appui long sur une case puis touchez les autres. Une barre en bas propose alors
      « Pas de séance », « Lignes attitrées » ou un autre choix pour toutes.
    </p>
    <p class="secondaire">
      Les soirées du planning sont les dates de la saison qui ont une séance en piscine ou en fosse (les
      sorties en milieu naturel n'y figurent pas) : pour ajouter un soir, créez la séance dans <a routerLink="/admin/seances">Séances</a>, ou toutes celles de l'année d'un coup avec
      <a routerLink="/admin/seances/generer">Générer la saison</a>.
    </p>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <div class="filtres">
      <div>
        <label for="saison">Saison</label>
        <select id="saison" [ngModel]="saisonId()" (ngModelChange)="choisirSaison($event)">
          @for (s of saisons(); track s.id) {
            <option [ngValue]="s.id">{{ s.libelle }}{{ s.ouverte ? ' (ouverte)' : '' }}</option>
          }
        </select>
      </div>
      <div>
        <label for="jour">Jour</label>
        <select id="jour" [ngModel]="jour()" (ngModelChange)="jour.set($event)">
          <option [ngValue]="null">Tous les jours</option>
          @for (j of joursDisponibles(); track j.jour) {
            <option [ngValue]="j.jour">{{ j.libelle }} ({{ j.nombre }})</option>
          }
        </select>
      </div>
      <div>
        <label for="periode">Période</label>
        <select id="periode" [ngModel]="periode()" (ngModelChange)="periode.set($event)">
          @for (p of periodes; track p.cle) { <option [ngValue]="p.cle">{{ p.libelle }}</option> }
        </select>
      </div>
    </div>

    @if (chargement()) {
      <p class="secondaire">Chargement…</p>
    } @else if (planning(); as p) {
      @if (p.groupes.length === 0) {
        <div class="carte vide">
          <p>Aucun groupe d'entraînement pour cette saison : créez-les d'abord dans « Groupes d'entraînement ».</p>
        </div>
      } @else if (soireesAffichees().length === 0) {
        <div class="carte vide">
          <p>
            Aucune séance en piscine ou en fosse sur cette période{{ jour() !== null ? ' pour ce jour de la semaine' : '' }}.
            Créez les séances dans <a routerLink="/admin/seances">Séances</a> ou
            <a routerLink="/admin/seances/generer">Générer la saison</a> : chaque date qui a une séance en milieu
            artificiel devient une soirée du planning.
          </p>
        </div>
      } @else {
        <div class="defilement" role="region" aria-label="Planning" tabindex="0">
          <table>
            <thead>
              <tr>
                <th scope="col" class="colonne-groupe">Groupe</th>
                @for (s of soireesAffichees(); track s.date) {
                  <th scope="col" [class.alerte-colonne]="s.avertissements.length > 0">
                    <span class="jour">{{ jourCourt(s.date) }}</span>
                    <span class="date">{{ dateCourte(s.date) }}</span>
                    @if (s.avertissements.length > 0) {
                      <span class="picto" [attr.aria-label]="s.avertissements.length + ' avertissement(s)'">⚠</span>
                    }
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              <tr class="ligne-responsable">
                <th scope="row" class="colonne-groupe">DP fosse</th>
                @for (s of soireesAffichees(); track s.date) {
                  <td>
                    <button type="button" class="case responsable dp-fosse" (click)="editerSoiree(s)"
                            [attr.aria-label]="'DP fosse du ' + dateLongue(s.date) + ' : ' + (s.dpFosse ?? 'aucun')">
                      {{ prenom(s.dpFosse) }}
                      @if (s.note) { <span class="note-indicateur" aria-hidden="true">•</span> }
                    </button>
                  </td>
                }
              </tr>
              <tr class="ligne-responsable">
                <th scope="row" class="colonne-groupe">DP piscine</th>
                @for (s of soireesAffichees(); track s.date) {
                  <td>
                    <button type="button" class="case responsable dp-piscine" (click)="editerSoiree(s)"
                            [attr.aria-label]="'DP piscine du ' + dateLongue(s.date) + ' : ' + (s.dpPiscine ?? 'aucun')">
                      {{ prenom(s.dpPiscine) }}
                    </button>
                  </td>
                }
              </tr>
              <tr class="ligne-encadrants">
                <th scope="row" class="colonne-groupe">
                  Encadrants
                  <span class="detail-groupe">présents / absents</span>
                </th>
                @for (s of soireesAffichees(); track s.date) {
                  <td>
                    <button type="button" class="case" (click)="editerSoiree(s)"
                            [attr.aria-label]="dateLongue(s.date) + ' : ' + s.presents.length + ' présent(s), '
                              + s.absents.length + ' absent(s)'">
                      <span class="nb-presents">{{ s.presents.length }}</span>@if (s.absents.length > 0) {<span class="nb-absents">/{{ s.absents.length }}</span>}
                    </button>
                  </td>
                }
              </tr>
              @for (g of p.groupes; track g.id; let i = $index) {
                <tr>
                  <th scope="row" class="colonne-groupe">
                    <span class="nom-groupe">{{ g.nom }}</span>
                    <span class="detail-groupe">{{ encadrantsCourts(g) }}</span>
                  </th>
                  @for (s of soireesAffichees(); track s.date; let j = $index) {
                    @let c = s.cases[i];
                    @let choisie = selection().has(cle(g.id, s.date));
                    <td>
                      <button type="button" class="case"
                              [class]="'case type-' + c.type + (c.espaceType === 'FOSSE' ? ' fosse' : '') + (choisie ? ' selectionnee' : '')"
                              [attr.aria-pressed]="enSelection() ? choisie : null"
                              (pointerdown)="debutAppui($event, i, j)" (pointerenter)="survolAppui(i, j)"
                              (contextmenu)="menuContextuel($event)"
                              (click)="toucherCase($event, g, s, c)"
                              [attr.aria-label]="g.nom + ', ' + dateLongue(s.date) + ' : ' + c.libelle
                                + (absentsDuGroupe(g, s).length ? ', absents : ' + absentsDuGroupe(g, s).join(', ') : '')
                                + (venusCeSoir(c).length ? ', venus d\\'un autre groupe : ' + venusCeSoir(c).join(', ') : '')">
                        {{ code(c) }}
                        @for (nom of absentsDuGroupe(g, s); track nom) {
                          <s class="encadrant-absent" aria-hidden="true">{{ nom }}</s>
                        }
                        @for (nom of venusCeSoir(c); track nom) {
                          <span class="encadrant-venu" aria-hidden="true">+{{ nom }}</span>
                        }
                      </button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>

        <p class="legende secondaire">
          Chiffre : ligne d'eau · F10 : fosse · F6 : fosse limitée à 6 m (débutants, groupes encadrés par un E1)
          · — : groupe absent · • : note sur la soirée · <s>Prénom</s> : encadrant du groupe absent ce soir-là
          · +Prénom : encadrant venu d'un autre groupe ce soir-là
        </p>

        @if (ciblesSelection().length > 0) {
          <div class="barre-selection" role="region" aria-label="Cases sélectionnées">
            <p>
              <strong>{{ ciblesSelection().length }} case{{ ciblesSelection().length > 1 ? 's' : '' }}
                sélectionnée{{ ciblesSelection().length > 1 ? 's' : '' }}</strong>
              <span class="secondaire"> · touchez une case pour l'ajouter ou la retirer</span>
            </p>
            <div class="actions-selection">
              <button type="button" class="bouton-principal" [disabled]="envoi()"
                      (click)="appliquerSelection({ type: 'ABSENT' })">Pas de séance</button>
              <button type="button" class="bouton-discret" [disabled]="envoi()"
                      (click)="appliquerSelection({ type: 'ATTITREE' })">Lignes attitrées</button>
              <button type="button" class="bouton-discret" [disabled]="envoi()" (click)="editerSelection()">Autre choix…</button>
              <button type="button" class="bouton-discret" (click)="viderSelection()">Annuler la sélection</button>
            </div>
          </div>
          <div class="reserve-barre" aria-hidden="true"></div>
        }

        @if (avertissements().length > 0) {
          <section class="carte avertissements" aria-label="Avertissements">
            <h2>À vérifier</h2>
            <ul>
              @for (a of avertissements(); track a.date + a.texte) {
                <li><strong>{{ dateCourte(a.date) }}</strong> — {{ a.texte }}</li>
              }
            </ul>
          </section>
        }
      }
    }

    <dialog #dialogue class="dialogue" (close)="fermer()" aria-labelledby="titre-dialogue">
      @if (editionCase(); as e) {
        @if (e.cibles; as cibles) {
          <h2 id="titre-dialogue">{{ cibles.length }} cases sélectionnées</h2>
          <p class="secondaire">Le choix s'applique à chaque groupe, pour chaque soirée sélectionnée.</p>
        } @else {
          <h2 id="titre-dialogue">{{ e.groupe.nom }}</h2>
          <p class="secondaire">{{ dateLongue(e.date) }} · {{ e.groupe.nombreEleves }} élèves</p>
          <p class="secondaire">
            Encadrants ce soir : {{ encadrantsCase(e) || 'aucun' }}. Pour mettre un encadrant dans un autre groupe,
            touchez la ligne « Encadrants » de la soirée.
          </p>
        }
        <fieldset class="choix">
          <legend class="visuellement-cache">Place du groupe</legend>
          <label class="option">
            <input type="radio" name="choix" [checked]="e.choix === 'ATTITREE'" (change)="e.choix = 'ATTITREE'">
            @if (e.cibles) {
              Les lignes attitrées de chaque groupe
            } @else {
              {{ e.groupe.espaceAttitreIds.length > 1 ? 'Ses lignes attitrées' : 'Sa ligne attitrée' }}{{ e.groupe.espacesAttitres ? ' (' + e.groupe.espacesAttitres + ')' : ' (aucune)' }}
            }
          </label>
          @if (espacesLignes().length > 0) {
            <p class="sous-titre">Autres lignes d'eau ce soir-là (une ou plusieurs)</p>
            <div class="lignes">
              @for (esp of espacesLignes(); track esp.id) {
                <label class="option">
                  <input type="checkbox" [checked]="e.choix === 'LIGNES' && e.lignes.includes(esp.id)"
                         (change)="basculerLigne(e, esp.id)">
                  {{ esp.nom }}
                </label>
              }
            </div>
          }
          @for (esp of espacesFosses(); track esp.id) {
            <label class="option">
              <input type="radio" name="choix" [checked]="e.choix === 'FOSSE' && e.espaceId === esp.id"
                     (change)="e.choix = 'FOSSE'; e.espaceId = esp.id">
              {{ esp.nom }}{{ esp.profondeurMax ? ' (' + esp.profondeurMax + ' m)' : '' }}
            </label>
            <label class="option">
              <input type="radio" name="choix" [checked]="e.choix === 'FOSSE_LIMITEE' && e.espaceId === esp.id"
                     (change)="e.choix = 'FOSSE_LIMITEE'; e.espaceId = esp.id">
              {{ esp.nom }} limitée à
              <input type="number" class="profondeur" min="1" [max]="esp.profondeurMax ?? 99"
                     [(ngModel)]="e.profondeurLimitee" aria-label="Profondeur limite en mètres"
                     (focus)="e.choix = 'FOSSE_LIMITEE'; e.espaceId = esp.id"> m
            </label>
          }
          <label class="option">
            <input type="radio" name="choix" [checked]="e.choix === 'ACTIVITE'" (change)="e.choix = 'ACTIVITE'">
            Activité :
            <input type="text" class="activite" [(ngModel)]="e.activite" placeholder="ex. Baptêmes"
                   aria-label="Nom de l'activité" (focus)="e.choix = 'ACTIVITE'">
          </label>
          <label class="option">
            <input type="radio" name="choix" [checked]="e.choix === 'ABSENT'" (change)="e.choix = 'ABSENT'">
            Pas de séance pour ce groupe
          </label>
        </fieldset>
        <div class="actions">
          <button type="button" class="bouton-principal" (click)="enregistrerCase()"
                  [disabled]="envoi() || (e.choix === 'LIGNES' && e.lignes.length === 0)">
            {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
          <button type="button" class="bouton-discret" (click)="fermer()">Annuler</button>
        </div>
      }
      @if (editionSoiree(); as e) {
        <h2 id="titre-dialogue">Soirée du {{ dateLongue(e.date) }}</h2>
        <label for="dp-fosse">DP fosse</label>
        <app-combobox idChamp="dp-fosse" [options]="optionsResponsables()" [(valeur)]="e.dpFosseId"
                      aide="Rechercher un encadrant…" texteVide="Aucun encadrant ne correspond." />
        <label for="dp-piscine">DP piscine</label>
        <app-combobox idChamp="dp-piscine" [options]="optionsResponsables()" [(valeur)]="e.dpPiscineId"
                      aide="Rechercher un encadrant…" texteVide="Aucun encadrant ne correspond." />
        <p class="secondaire">
          Le directeur de plongée de la fiche de sécurité de chaque séance se choisit à part (E3 minimum).
        </p>
        <label for="note">Note</label>
        <input id="note" type="text" [(ngModel)]="e.note" maxlength="200" placeholder="ex. Baptêmes, piscine fermée à 21 h">
        <div class="actions">
          <button type="button" class="bouton-principal" (click)="enregistrerSoiree()" [disabled]="envoi()">
            {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
          <button type="button" class="bouton-discret" (click)="fermer()">Annuler</button>
        </div>

        @if (soireeEditee(); as s) {
          <h3>Présences et groupes des encadrants</h3>
          <p class="secondaire">
            Chacun répond depuis son planning ; touchez un bouton pour répondre à la place d'un encadrant
            (enregistré aussitôt, toucher à nouveau l'efface). Le menu met un encadrant dans un autre groupe
            pour ce soir seulement (remplacer un collègue absent, renforcer un groupe).
          </p>
          <ul class="presences">
            @for (m of moniteurs(); track m.id) {
              <li>
                <span class="qui">
                  {{ m.nomComplet }} <span class="secondaire">{{ m.niveauEncadrement }}</span>
                  <select class="groupe-du-soir" [ngModel]="groupeDuSoir(s, m.id)" [disabled]="envoi()"
                          (ngModelChange)="changerGroupe(s, m.id, $event)"
                          [attr.aria-label]="'Groupe de ' + m.nomComplet + ' ce soir'">
                    <option [ngValue]="null">{{ libelleGroupesAttitres(m.id) }}</option>
                    @for (g of planning()?.groupes ?? []; track g.id) {
                      <option [ngValue]="g.id">Ce soir : {{ g.nom }}</option>
                    }
                  </select>
                </span>
                <span class="boutons">
                  <button type="button" class="bouton-discret" [class.present]="reponseDe(s, m.id) === 'PRESENT'"
                          [attr.aria-pressed]="reponseDe(s, m.id) === 'PRESENT'" [disabled]="envoi()"
                          [attr.aria-label]="m.nomComplet + ' présent'" (click)="repondrePour(s, m.id, 'PRESENT')">✓</button>
                  <button type="button" class="bouton-discret" [class.absent]="reponseDe(s, m.id) === 'ABSENT'"
                          [attr.aria-pressed]="reponseDe(s, m.id) === 'ABSENT'" [disabled]="envoi()"
                          [attr.aria-label]="m.nomComplet + ' absent'" (click)="repondrePour(s, m.id, 'ABSENT')">✗</button>
                </span>
              </li>
            }
          </ul>
        }
      }
    </dialog>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .filtres { display: flex; flex-wrap: wrap; gap: var(--pas) var(--pas-3); margin: var(--pas-2) 0; }
    .filtres > div { flex: 1 1 160px; max-width: 260px; }
    .filtres label, .dialogue label[for] { display: block; margin: 0 0 4px; font-weight: 700; font-size: .9375rem; }
    .filtres select { margin: 0; }

    /* Le tableau défile seul dans son cadre : la page, elle, ne défile jamais de côté. */
    .defilement { overflow-x: auto; border: 1px solid var(--trait); border-radius: var(--r-s); background: var(--carte); }
    table { border-collapse: separate; border-spacing: 0; font-size: .875rem; }
    th, td { border-bottom: 1px solid var(--trait); padding: 2px; text-align: center; }
    thead th { position: sticky; top: 0; background: var(--carte); padding: 6px 2px; min-width: 52px; }
    .colonne-groupe {
      position: sticky; left: 0; z-index: 1; background: var(--carte); text-align: left;
      padding: 6px var(--pas); min-width: 120px; max-width: 150px; border-right: 1px solid var(--trait);
    }
    thead .colonne-groupe { z-index: 2; }
    .jour { display: block; font-size: .75rem; color: var(--craie); font-weight: 400; }
    .date { display: block; font-weight: 700; }
    .picto { color: var(--en-cours); }
    .alerte-colonne { background: var(--en-cours-clair) !important; }
    .nom-groupe { display: block; font-weight: 700; }
    .detail-groupe { display: block; font-size: .75rem; color: var(--craie); font-weight: 400; }
    .case {
      width: 100%; min-width: 48px; min-height: 44px; padding: 0 4px; border: 1px solid transparent;
      border-radius: var(--r-s); background: none; font: inherit; font-weight: 700; cursor: pointer; color: var(--encre);
    }
    .case:hover { border-color: var(--trait); }
    /* Glisser à la souris ou appui long au doigt : ni sélection de texte, ni menu du téléphone. */
    .case { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
    .case.selectionnee { outline: 3px solid var(--accent); outline-offset: -3px; background-color: #FDE7E1; }
    .barre-selection {
      /* Au-dessus de la barre d'onglets du téléphone, le temps de la sélection. */
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
      padding: var(--pas-2) var(--pas-3) calc(var(--pas-2) + env(safe-area-inset-bottom, 0px));
      background: var(--carte); border-top: 1px solid var(--trait); box-shadow: 0 -6px 16px rgba(0,0,0,.15);
    }
    .barre-selection p { margin: 0 0 var(--pas); }
    .actions-selection { display: flex; flex-wrap: wrap; gap: var(--pas); }
    .actions-selection button { width: auto; min-height: 44px; flex: 1 1 auto; }
    .reserve-barre { height: 140px; }
    .type-ATTITREE { color: var(--craie); font-weight: 400; }
    .type-AUCUN { color: #B3261E; }
    .fosse { background: #E0F2F7; color: var(--profond-fonce); }
    .type-ACTIVITE { background: #FEF9C3; font-size: .75rem; }
    .type-ABSENT { color: var(--craie); }
    .responsable { font-weight: 400; font-size: .8125rem; color: #B3261E; }
    .nb-presents { color: var(--acquis); }
    .nb-absents { color: #B3261E; font-weight: 400; }
    .encadrant-absent { display: block; font-size: .6875rem; font-weight: 700; line-height: 1.2; }
    .encadrant-venu { display: block; font-size: .6875rem; font-weight: 700; line-height: 1.2; color: var(--profond); }
    .presences .qui { display: grid; gap: 2px; flex: 1; min-width: 0; }
    .groupe-du-soir { margin: 0 0 4px; min-height: 44px; font-size: .875rem; }
    .dialogue h3 { margin: var(--pas-3) 0 4px; font-size: 1rem; }
    .presences { list-style: none; margin: var(--pas) 0 0; padding: 0; max-height: 40vh; overflow-y: auto; }
    .presences li {
      display: flex; align-items: center; justify-content: space-between; gap: var(--pas);
      border-bottom: 1px solid var(--trait); padding: 2px 0;
    }
    .presences .boutons { white-space: nowrap; }
    .presences .bouton-discret { min-width: 44px; min-height: 44px; padding: 0; margin-left: 4px; }
    .present { background: var(--acquis); color: #fff; border-color: var(--acquis); }
    .absent { background: #B3261E; color: #fff; border-color: #B3261E; }
    .note-indicateur { color: var(--profond); }
    .legende { margin-top: var(--pas); }
    .avertissements { padding: var(--pas-2); margin-top: var(--pas-2); }
    .avertissements h2 { margin: 0 0 var(--pas); font-size: 1rem; color: var(--en-cours); }
    .avertissements ul { margin: 0; padding-left: 1.25rem; display: grid; gap: 4px; }

    .dialogue { width: min(440px, calc(100vw - 32px)); border: none; border-radius: var(--r); padding: var(--pas-3); }
    .dialogue::backdrop { background: rgba(12, 53, 71, .5); }
    .dialogue h2 { margin: 0 0 4px; font-size: 1.125rem; }
    .choix { border: none; margin: var(--pas-2) 0 0; padding: 0; display: grid; gap: 2px; }
    .option { display: flex; align-items: center; gap: var(--pas); min-height: 44px; flex-wrap: wrap; }
    .option input[type="radio"], .option input[type="checkbox"] { width: auto; margin: 0; }
    .sous-titre { margin: var(--pas) 0 0; font-size: .875rem; color: var(--craie); }
    .lignes { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 0 var(--pas); }
    .profondeur { width: 64px; margin: 0; }
    .activite { flex: 1 1 140px; margin: 0; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }
    .actions .bouton-principal { width: auto; }
    .visuellement-cache { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .vide { padding: var(--pas-2); }
    .vide p { margin: 0; }
  `]
})
export class PlanningAdminComponent {
  private api = inject(ApiService);
  private dialogue = viewChild.required<ElementRef<HTMLDialogElement>>('dialogue');
  readonly periodes = PERIODES;

  saisons = signal<SaisonVue[]>([]);
  saisonId = signal<number | null>(null);
  planning = signal<PlanningVue | null>(null);
  moniteurs = signal<MoniteurOptionVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  envoi = signal(false);
  /** Jour de la semaine affiché (0 = dimanche) ; null : tous. */
  jour = signal<number | null>(null);
  periode = signal('tout');
  editionCase = signal<EditionCase | null>(null);
  editionSoiree = signal<EditionSoiree | null>(null);
  /** Cases sélectionnées (clé groupe|date) pour leur donner le même choix d'un coup. */
  selection = signal<Set<string>>(new Set());
  private appui: Appui | null = null;
  private ignorerClic = false;

  /** Cases sélectionnées encore affichées (un changement de filtre ne modifie pas ce qu'on ne voit pas). */
  ciblesSelection = computed<CibleCase[]>(() => {
    const choix = this.selection();
    if (choix.size === 0) return [];
    const groupes = this.planning()?.groupes ?? [];
    return this.soireesAffichees().flatMap(s => groupes
      .filter(g => choix.has(this.cle(g.id, s.date)))
      .map(g => ({ date: s.date, groupeId: g.id })));
  });
  enSelection = computed(() => this.ciblesSelection().length > 0);

  joursDisponibles = computed(() => {
    const compte = new Map<number, number>();
    for (const s of this.planning()?.soirees ?? []) compte.set(jourDe(s.date), (compte.get(jourDe(s.date)) ?? 0) + 1);
    return [...compte.entries()].sort((a, b) => ((a[0] + 6) % 7) - ((b[0] + 6) % 7))
      .map(([jour, nombre]) => ({ jour, nombre, libelle: JOURS[jour].charAt(0).toUpperCase() + JOURS[jour].slice(1) }));
  });

  soireesAffichees = computed(() => {
    const mois = PERIODES.find(p => p.cle === this.periode())?.mois ?? [];
    return (this.planning()?.soirees ?? [])
      .filter(s => this.jour() === null || jourDe(s.date) === this.jour())
      .filter(s => mois.length === 0 || mois.includes(Number(s.date.slice(5, 7))));
  });

  avertissements = computed(() => this.soireesAffichees()
    .flatMap(s => s.avertissements.map(texte => ({ date: s.date, texte }))));

  espacesLignes = computed(() => (this.planning()?.espaces ?? []).filter(e => e.type === 'LIGNE'));
  espacesFosses = computed(() => (this.planning()?.espaces ?? []).filter(e => e.type === 'FOSSE'));
  /** Soirée ouverte dans le dialogue, à jour des réponses saisies depuis celui-ci. */
  soireeEditee = computed(() => {
    const date = this.editionSoiree()?.date;
    return date ? this.planning()?.soirees.find(s => s.date === date) ?? null : null;
  });

  /** Encadrants de la soirée ouverte ; ceux qui ont répondu présent sont signalés. */
  optionsResponsables = computed<OptionCombobox[]>(() => {
    const presents = new Set(this.soireeEditee()?.presents.map(e => e.id) ?? []);
    return this.moniteurs().map(m => ({
      id: m.id, libelle: m.nomComplet,
      detail: presents.has(m.id) ? `${m.niveauEncadrement} · présent` : m.niveauEncadrement
    }));
  });

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    try {
      const [saisons, moniteurs] = await Promise.all([firstValueFrom(this.api.saisons()), this.api.moniteursActifs()]);
      this.saisons.set(saisons);
      this.moniteurs.set(moniteurs);
      const ouverte = saisons.find(s => s.ouverte) ?? saisons[0];
      if (ouverte) await this.choisirSaison(ouverte.id);
    } catch {
      this.message.set('Impossible de charger le planning.');
    } finally {
      this.chargement.set(false);
    }
  }

  async choisirSaison(id: number): Promise<void> {
    this.saisonId.set(id);
    this.viderSelection();
    try {
      const p = await firstValueFrom(this.api.planning(id));
      if (this.saisonId() !== id) return;
      this.planning.set(p);
      // Par défaut, le jour qui porte le plus de soirées (le lundi soir au club).
      const jours = this.joursDisponibles();
      this.jour.set(jours.length === 0 ? null : jours.reduce((a, b) => b.nombre > a.nombre ? b : a).jour);
    } catch {
      this.message.set('Impossible de charger le planning de cette saison.');
    }
  }

  /** Code court, comme dans le tableur : « 3 », « F10 », « F6 », « — », ou l'activité. */
  code(c: CasePlanningVue): string {
    return codeCase(c, this.planning()?.espaces ?? []);
  }

  jourCourt(date: string): string {
    return JOURS[jourDe(date)].slice(0, 3) + '.';
  }

  dateCourte(date: string): string {
    return dateFr(date).slice(0, 5);
  }

  dateLongue(date: string): string {
    return `${JOURS[jourDe(date)]} ${dateFr(date)}`;
  }

  prenom(nomComplet: string | null): string {
    return nomComplet ? nomComplet.split(' ')[0] : '+';
  }

  encadrantsCourts(g: GroupePlanningVue): string {
    return g.encadrants.map(e => e.nomComplet.split(' ')[0]).join(' & ') || 'Sans encadrant';
  }

  /** Prénoms des encadrants du groupe ce soir-là qui ont répondu absent, rayés dans la case. */
  absentsDuGroupe(g: GroupePlanningVue, s: SoireePlanningVue): string[] {
    const c = s.cases.find(x => x.groupeId === g.id);
    return (c?.encadrants ?? g.encadrants).filter(e => s.absents.some(a => a.id === e.id))
      .map(e => e.nomComplet.split(' ')[0]);
  }

  /** Prénoms des encadrants mis dans ce groupe pour la soirée, venus d'un autre groupe. */
  venusCeSoir(c: CasePlanningVue): string[] {
    return (c.encadrants ?? []).filter(e => e.affecteCeSoir).map(e => e.nomComplet.split(' ')[0]);
  }

  /** Encadrants du groupe ouvert dans le dialogue, pour la soirée choisie. */
  encadrantsCase(e: EditionCase): string {
    const c = this.planning()?.soirees.find(s => s.date === e.date)?.cases.find(x => x.groupeId === e.groupe.id);
    return (c?.encadrants ?? e.groupe.encadrants)
      .map(x => x.nomComplet + ('affecteCeSoir' in x && x.affecteCeSoir ? ' (ce soir)' : '')).join(', ');
  }

  /** Groupe où l'encadrant est mis ce soir-là ; null : avec ses groupes attitrés. */
  groupeDuSoir(s: SoireePlanningVue, utilisateurId: number): number | null {
    return s.changementsEncadrants?.find(c => c.utilisateurId === utilisateurId)?.groupeId ?? null;
  }

  libelleGroupesAttitres(utilisateurId: number): string {
    const noms = (this.planning()?.groupes ?? []).filter(g => g.encadrants.some(e => e.id === utilisateurId))
      .map(g => g.nom);
    return noms.length ? `Son groupe : ${noms.join(', ')}` : 'Sans groupe';
  }

  /** Enregistré aussitôt ; le dialogue reste ouvert. */
  changerGroupe(s: SoireePlanningVue, utilisateurId: number, groupeId: number | null): void {
    const saisonId = this.saisonId();
    if (saisonId === null) return;
    this.envoi.set(true);
    this.api.definirGroupeEncadrant(saisonId, s.date, utilisateurId, groupeId).subscribe({
      next: soiree => {
        this.envoi.set(false);
        this.remplacerSoiree(soiree);
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.fermer();
        this.message.set(err.error?.detail ?? "Le changement de groupe n'a pas pu être enregistré.");
      }
    });
  }

  editerCase(g: GroupePlanningVue, s: SoireePlanningVue, c: CasePlanningVue): void {
    this.message.set(null);
    const fosse = c.espaceType === 'FOSSE';
    const choix: ChoixCase = c.type === 'ESPACE'
      ? (!fosse ? 'LIGNES' : c.profondeurLimitee !== null ? 'FOSSE_LIMITEE' : 'FOSSE')
      : c.type === 'ACTIVITE' || c.type === 'ABSENT' ? c.type : 'ATTITREE';
    const lignes = choix !== 'LIGNES' ? [] : c.espaces?.length ? c.espaces.map(o => o.id) : [c.espaceId!];
    this.editionSoiree.set(null);
    this.editionCase.set({
      groupe: g, date: s.date, choix, lignes, espaceId: fosse ? c.espaceId : null,
      profondeurLimitee: c.profondeurLimitee ?? 6, activite: c.activite ?? '', cibles: null
    });
    this.dialogue().nativeElement.showModal();
  }

  // --- Sélection de plusieurs cases -------------------------------------

  cle(groupeId: number, date: string): string {
    return `${groupeId}|${date}`;
  }

  /** Clic (ou toucher) sur une case : en sélection, l'ajoute ou la retire ; sinon ouvre son éditeur. */
  toucherCase(ev: MouseEvent, g: GroupePlanningVue, s: SoireePlanningVue, c: CasePlanningVue): void {
    if (this.ignorerClic) {
      this.ignorerClic = false;
      return;
    }
    if (ev.ctrlKey || ev.metaKey || this.enSelection()) {
      this.basculerSelection(this.cle(g.id, s.date));
      return;
    }
    this.editerCase(g, s, c);
  }

  /** Souris : début d'un glisser. Doigt : un appui long entre en sélection. */
  debutAppui(ev: PointerEvent, groupe: number, soiree: number): void {
    this.annulerAppui();
    const souris = ev.pointerType === 'mouse';
    if (souris && ev.button !== 0) return;
    const appui: Appui = {
      groupe, soiree, souris, x: ev.clientX, y: ev.clientY, glisse: false,
      base: souris && (ev.ctrlKey || ev.metaKey) ? new Set(this.selection()) : new Set(), minuterie: null
    };
    if (!souris) {
      appui.minuterie = setTimeout(() => {
        appui.minuterie = null;
        this.ignorerClic = true;
        this.appui = null;
        const p = this.planning();
        const s = this.soireesAffichees()[soiree];
        if (p && s) this.basculerSelection(this.cle(p.groupes[groupe].id, s.date));
        navigator.vibrate?.(30);
      }, DUREE_APPUI_LONG);
    }
    this.appui = appui;
  }

  /** Souris enfoncée qui passe sur une autre case : sélectionne le rectangle depuis la première. */
  survolAppui(groupe: number, soiree: number): void {
    const a = this.appui;
    if (!a?.souris || (!a.glisse && groupe === a.groupe && soiree === a.soiree)) return;
    a.glisse = true;
    const groupes = this.planning()?.groupes ?? [];
    const soirees = this.soireesAffichees();
    const choix = new Set(a.base);
    for (let i = Math.min(a.groupe, groupe); i <= Math.max(a.groupe, groupe); i++) {
      for (let j = Math.min(a.soiree, soiree); j <= Math.max(a.soiree, soiree); j++) {
        choix.add(this.cle(groupes[i].id, soirees[j].date));
      }
    }
    this.selection.set(choix);
  }

  /** Le doigt bouge (défilement du tableau) : ce n'est pas un appui long. */
  @HostListener('document:pointermove', ['$event'])
  bougerAppui(ev: PointerEvent): void {
    const a = this.appui;
    if (a && !a.souris && Math.hypot(ev.clientX - a.x, ev.clientY - a.y) > 10) this.annulerAppui();
  }

  @HostListener('document:pointerup')
  @HostListener('document:pointercancel')
  finAppui(): void {
    if (this.appui?.glisse) {
      // Le clic qui suit la fin d'un glisser ne doit pas rebasculer la case.
      this.ignorerClic = true;
    }
    this.annulerAppui();
    if (this.ignorerClic) setTimeout(() => this.ignorerClic = false);
  }

  /** Pas de menu du navigateur sur un appui long au doigt. */
  menuContextuel(ev: MouseEvent): void {
    if (this.ignorerClic || this.appui || ('pointerType' in ev && (ev as PointerEvent).pointerType !== 'mouse')) {
      ev.preventDefault();
    }
  }

  @HostListener('document:keydown.escape')
  echap(): void {
    if (!this.dialogue().nativeElement.open) this.viderSelection();
  }

  viderSelection(): void {
    this.selection.set(new Set());
  }

  private basculerSelection(cle: string): void {
    const choix = new Set(this.selection());
    if (!choix.delete(cle)) choix.add(cle);
    this.selection.set(choix);
  }

  private annulerAppui(): void {
    if (this.appui?.minuterie) clearTimeout(this.appui.minuterie);
    this.appui = null;
  }

  /** Une consigne simple (pas de séance, lignes attitrées) appliquée tout de suite aux cases sélectionnées. */
  appliquerSelection(demande: DemandeCasePlanning): void {
    this.envoyerCases(this.ciblesSelection(), demande);
  }

  /** Ouvre l'éditeur pour donner un autre choix (fosse, lignes, activité) à toutes les cases sélectionnées. */
  editerSelection(): void {
    const cibles = this.ciblesSelection();
    const groupe = this.planning()?.groupes.find(g => g.id === cibles[0]?.groupeId);
    if (!groupe) return;
    this.message.set(null);
    this.editionSoiree.set(null);
    this.editionCase.set({
      groupe, date: cibles[0].date, choix: 'ABSENT', lignes: [], espaceId: null, profondeurLimitee: 6,
      activite: '', cibles
    });
    this.dialogue().nativeElement.showModal();
  }

  private envoyerCases(cibles: CibleCase[], demande: DemandeCasePlanning): void {
    const saisonId = this.saisonId();
    if (saisonId === null || cibles.length === 0) return;
    this.message.set(null);
    this.envoi.set(true);
    this.api.definirCasesPlanning(saisonId, cibles, demande).subscribe({
      next: soirees => {
        this.envoi.set(false);
        soirees.forEach(s => this.remplacerSoiree(s));
        this.fermer();
        this.viderSelection();
        this.message.set(`${cibles.length} case${cibles.length > 1 ? 's' : ''} modifiée${cibles.length > 1 ? 's' : ''}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.fermer();
        this.message.set(err.error?.detail ?? "Les cases n'ont pas pu être modifiées : rien n'a été enregistré.");
      }
    });
  }

  editerSoiree(s: SoireePlanningVue): void {
    this.message.set(null);
    this.editionCase.set(null);
    this.editionSoiree.set({ date: s.date, dpFosseId: s.dpFosseId, dpPiscineId: s.dpPiscineId, note: s.note ?? '' });
    this.dialogue().nativeElement.showModal();
  }

  fermer(): void {
    if (this.dialogue().nativeElement.open) this.dialogue().nativeElement.close();
    this.editionCase.set(null);
    this.editionSoiree.set(null);
  }

  enregistrerCase(): void {
    const e = this.editionCase();
    const saisonId = this.saisonId();
    if (!e || saisonId === null) return;
    let demande: DemandeCasePlanning;
    switch (e.choix) {
      case 'LIGNES': {
        // Exactement les lignes attitrées : rien à retenir, la case suit la ligne attitrée.
        const attitrees = e.groupe.espaceAttitreIds;
        demande = !e.cibles && attitrees.length === e.lignes.length && attitrees.every(id => e.lignes.includes(id))
          ? { type: 'ATTITREE' } : { type: 'ESPACE', espaceIds: e.lignes };
        break;
      }
      case 'FOSSE': demande = { type: 'ESPACE', espaceId: e.espaceId }; break;
      case 'FOSSE_LIMITEE': demande = { type: 'ESPACE', espaceId: e.espaceId, profondeurLimitee: e.profondeurLimitee }; break;
      case 'ACTIVITE': demande = { type: 'ACTIVITE', activite: e.activite }; break;
      default: demande = { type: e.choix };
    }
    if (e.cibles) {
      this.envoyerCases(e.cibles, demande);
      return;
    }
    this.envoyer(this.api.definirCasePlanning(saisonId, e.date, e.groupe.id, demande));
  }

  /** Coche ou décoche une ligne d'eau ; cocher la première remplace le choix précédent (fosse, activité…). */
  basculerLigne(e: EditionCase, id: number): void {
    if (e.choix !== 'LIGNES') {
      e.choix = 'LIGNES';
      e.lignes = [];
    }
    e.lignes = e.lignes.includes(id) ? e.lignes.filter(l => l !== id) : [...e.lignes, id];
  }

  enregistrerSoiree(): void {
    const e = this.editionSoiree();
    const saisonId = this.saisonId();
    if (!e || saisonId === null) return;
    this.envoyer(this.api.definirSoireePlanning(saisonId, e.date,
      { dpFosseId: e.dpFosseId, dpPiscineId: e.dpPiscineId, note: e.note.trim() || null }));
  }

  reponseDe(s: SoireePlanningVue, utilisateurId: number): ReponseDisponibilite | null {
    if (s.presents.some(e => e.id === utilisateurId)) return 'PRESENT';
    if (s.absents.some(e => e.id === utilisateurId)) return 'ABSENT';
    return null;
  }

  /** Réponse saisie à la place d'un encadrant ; toucher la réponse déjà donnée l'efface. Le dialogue reste ouvert. */
  repondrePour(s: SoireePlanningVue, utilisateurId: number, reponse: ReponseDisponibilite): void {
    const saisonId = this.saisonId();
    if (saisonId === null) return;
    this.envoi.set(true);
    this.api.definirDisponibilite(saisonId, s.date, utilisateurId,
      this.reponseDe(s, utilisateurId) === reponse ? null : reponse).subscribe({
      next: soiree => {
        this.envoi.set(false);
        this.remplacerSoiree(soiree);
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.fermer();
        this.message.set(err.error?.detail ?? "La réponse n'a pas pu être enregistrée.");
      }
    });
  }

  private remplacerSoiree(soiree: SoireePlanningVue): void {
    const p = this.planning();
    if (p) this.planning.set({ ...p, soirees: p.soirees.map(s => s.date === soiree.date ? soiree : s) });
  }

  /** La réponse est la soirée recalculée (cases et avertissements) : on la remplace telle quelle. */
  private envoyer(appel: ReturnType<ApiService['definirSoireePlanning']>): void {
    this.envoi.set(true);
    appel.subscribe({
      next: soiree => {
        this.envoi.set(false);
        this.remplacerSoiree(soiree);
        this.fermer();
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.fermer();
        this.message.set(err.error?.detail ?? "La modification n'a pas pu être enregistrée.");
      }
    });
  }
}
