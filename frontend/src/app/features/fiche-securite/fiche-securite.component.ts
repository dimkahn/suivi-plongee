import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { FileEcrituresService } from '../../core/file-ecritures.service';
import { DateFrPipe, dateDuJour } from '../../core/date-fr';
import { lieuEtSite } from '../../core/seance-lieu';
import { ComboboxComponent, OptionCombobox } from '../../core/combobox.component';
import {
  FicheSecuriteVue, GroupePlongeursVue, MembreGroupeVue, MoniteurOptionVue, PalanqueeVue, PlongeurConnuVue,
  PlongeurVue, SeanceVue
} from '../../core/modeles';

function plongeurVide(): PlongeurVue {
  return {
    eleveId: null, utilisateurId: null, nom: '', prenom: '', aptitude: null, aptitudeDonneeParDp: null,
    qualificationPreparee: null, fonction: 'PLONGEUR', gaz: null, moyenDesaturation: null, observations: null
  };
}

function palanqueeVide(numero: number): PalanqueeVue {
  return {
    numero, profondeurPrevue: null, dureePrevue: null,
    profondeurRealisee: null, dureeRealisee: null, paliers: null,
    heureImmersion: null, heureSortie: null, membres: []
  };
}

/**
 * Profondeur max (en m) des prérogatives FFESSM courantes, pour repérer une
 * palanquée dont la profondeur prévue dépasse l'aptitude d'un de ses
 * membres. Simple avertissement d'affichage, pas une règle bloquante (voir
 * la note du projet sur le retrait de la vérification stricte côté serveur) :
 * le DP reste seul juge, l'aptitude est un texte libre pas toujours normalisé.
 */
const PROFONDEUR_MAX_PAR_APTITUDE: Record<string, number> = {
  E1: 20, N1: 20, PA20: 20,
  E2: 40, N2: 40, PE40: 40, PA40: 40,
  N3: 60, PE60: 60
  // E3, E4 : pas de limite (formateurs).
};

/** Cherche les codes connus dans le texte libre de l'aptitude et retient le plus profond. */
function profondeurMaxPourAptitude(aptitude: string | null): number | null {
  if (!aptitude) return null;
  const codes = aptitude.toUpperCase().match(/E[1-4]|PA20|PE40|PA40|PE60|N[1-3]/g);
  if (!codes) return null;
  if (codes.includes('E3') || codes.includes('E4')) return null;
  const profondeurs = codes.map(c => PROFONDEUR_MAX_PAR_APTITUDE[c]).filter((p): p is number => p !== undefined);
  return profondeurs.length > 0 ? Math.max(...profondeurs) : null;
}

/** Identifie un plongeur par son eleveId/utilisateurId, ou à défaut par son nom/prénom. */
function cleIdentite(p: { eleveId: number | null; utilisateurId: number | null; nom: string; prenom: string }): string {
  if (p.eleveId !== null) return 'E' + p.eleveId;
  if (p.utilisateurId !== null) return 'U' + p.utilisateurId;
  return 'N' + p.nom + '|' + p.prenom;
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

@Component({
  selector: 'app-fiche-securite',
  imports: [FormsModule, RouterLink, DragDropModule, DateFrPipe, ComboboxComponent],
  template: `
    <a routerLink="/fiches-securite" class="bouton-discret">← Fiches de sécurité</a>

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

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (entete(); as f) {
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
        @if (seance()?.milieu === 'NATUREL') {
          <p class="secondaire">En milieu naturel, seuls les E3 et E4 peuvent diriger la plongée.</p>
        }
        @if (dpNonHabilite(f.dpId); as m) {
          <div class="alerte" role="status">
            {{ m.nomComplet }} ({{ m.niveauEncadrement }}) est enregistré comme directeur de plongée,
            mais ne peut pas diriger en milieu naturel : choisissez un E3 ou un E4.
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
          <button type="button" class="bouton-discret" (click)="creationGroupeOuverte.set(!creationGroupeOuverte())">
            + Nouveau groupe
          </button>
          @if (groupeSelectionneId()) {
            <button type="button" class="bouton-discret danger" (click)="supprimerGroupeCourant()">
              Supprimer ce groupe
            </button>
          }
          <a routerLink="/groupes" class="bouton-discret">Gérer les groupes →</a>
        </div>

        @if (creationGroupeOuverte()) {
          <div class="ligne-groupe">
            <input type="text" placeholder="Nom du groupe (ex. Séjour Égypte mai 2026)"
                   [ngModel]="nomNouveauGroupe()" (ngModelChange)="nomNouveauGroupe.set($event)" name="nomGroupe">
            <button type="button" class="bouton-principal" [disabled]="envoiGroupe()" (click)="creerGroupe()">
              Créer à partir des plongeurs de cette fiche
            </button>
            <button type="button" class="bouton-discret" (click)="creationGroupeOuverte.set(false)">Annuler</button>
          </div>
        }

        @if (groupeSelectionne(); as g) {
          <div cdkDropList id="pool" [cdkDropListData]="poolDisponible()" [cdkDropListConnectedTo]="idsPalanquees()"
               class="pool-plongeurs">
            @for (m of poolDisponible(); track m) {
              <button type="button" class="jeton-plongeur" cdkDrag [cdkDragData]="m"
                      [cdkDragStartDelay]="delaiGlisser"
                      [class.selectionne]="membreAPlacer() === m" [attr.aria-pressed]="membreAPlacer() === m"
                      [attr.aria-label]="m.prenom + ' ' + m.nom + (m.aptitude ? ', ' + m.aptitude : '')"
                      (click)="selectionnerPourPlacer(m)">
                <span class="nom-long">{{ m.prenom }} {{ m.nom }}</span>
                <span class="nom-court">{{ m.prenom }} {{ initiale(m.nom) }}</span>
                @if (m.aptitude) { <span class="niveau-jeton">{{ m.aptitude }}</span> }
              </button>
            }
            @if (poolDisponible().length === 0) {
              <p class="vide">
                {{ g.membres.length === 0 ? "Ce groupe n'a aucun plongeur."
                                          : 'Tous les plongeurs de ce groupe sont déjà répartis dans une palanquée.' }}
              </p>
            }
          </div>
        }
      </section>

      @for (p of palanquees(); track p; let iP = $index) {
        <section class="carte panneau">
          <div class="ligne-titre">
            <h3>Palanquée {{ p.numero }}</h3>
            <button type="button" class="bouton-discret danger" (click)="retirerPalanquee(iP)">Retirer</button>
          </div>

          <div class="ligne-profil">
            <label>Profondeur prévue (m) <input type="number" min="0" [(ngModel)]="p.profondeurPrevue"
                   [name]="'pp-' + iP"></label>
            <label>Durée prévue (min) <input type="number" min="0" [(ngModel)]="p.dureePrevue"
                   [name]="'dp-' + iP"></label>
          </div>

          <div cdkDropList [id]="'palanquee-' + p.numero" [cdkDropListData]="p.membres"
               class="zone-membres" [class.zone-membres-vide]="p.membres.length === 0"
               [cdkDropListConnectedTo]="tousLesIds()" (cdkDropListDropped)="onDropPalanquee($event, iP)">
            @if (p.membres.length === 0) {
              <p class="vide">Glissez un plongeur ici, ou cliquez sur « + Plongeur ».</p>
            }
            @for (m of p.membres; track m; let iM = $index) {
              <div class="plongeur" cdkDrag [cdkDragStartDelay]="delaiGlisser">
                <label class="discrete">Plongeur du club (optionnel, pré-remplit aptitude et qualification)</label>
                <input type="text" class="selecteur-connu" placeholder="Rechercher un nom…" list="plongeurs-club"
                       (change)="choisirPlongeurConnu(iP, iM, $event)">

                <div class="ligne-plongeur">
                  <input type="text" placeholder="Prénom" [(ngModel)]="m.prenom" [name]="'prenom-' + iP + '-' + iM">
                  <input type="text" placeholder="Nom" [(ngModel)]="m.nom" [name]="'nom-' + iP + '-' + iM">
                  <input type="text" placeholder="Aptitude (ex. N2, E2…)" [(ngModel)]="m.aptitude"
                         [name]="'aptitude-' + iP + '-' + iM">
                  <input type="text" placeholder="Aptitude donnée par le DP" [(ngModel)]="m.aptitudeDonneeParDp"
                         [name]="'aptitude-dp-' + iP + '-' + iM">
                  <input type="text" placeholder="Qualification préparée (si en formation)"
                         [(ngModel)]="m.qualificationPreparee" [name]="'qualif-' + iP + '-' + iM">
                  <select [(ngModel)]="m.fonction" [name]="'fonction-' + iP + '-' + iM">
                    <option value="PLONGEUR">Plongeur</option>
                    <option value="GUIDE_PALANQUEE">Guide de palanquée</option>
                    <option value="ENCADRANT">Encadrant</option>
                  </select>
                  <input type="text" placeholder="Gaz (ex. Air, Nitrox 32…)" [(ngModel)]="m.gaz"
                         [name]="'gaz-' + iP + '-' + iM">
                  <input type="text" placeholder="Désaturation" [(ngModel)]="m.moyenDesaturation"
                         [name]="'desat-' + iP + '-' + iM">
                  <input type="text" placeholder="Observations" [(ngModel)]="m.observations"
                         [name]="'observations-' + iP + '-' + iM">
                  <button type="button" class="bouton-discret danger" (click)="retirerMembre(iP, iM)">✕</button>
                </div>
                @if (alerteProfondeur(p, m); as alerte) {
                  <p class="alerte-profondeur">⚠ {{ alerte }}</p>
                }
              </div>
            }
          </div>

          <button type="button" class="bouton-discret" (click)="ajouterMembre(iP)">+ Plongeur</button>
        </section>
      }

      <button type="button" class="bouton-discret" (click)="ajouterPalanquee()">+ Palanquée</button>

      @if (membreAPlacer(); as m) {
        <div class="barre-placement" role="dialog" aria-label="Choisir la palanquée">
          <p><strong>{{ m.prenom }} {{ m.nom }}</strong> → quelle palanquée ?</p>
          <div class="choix-palanquees">
            @for (p of palanquees(); track p; let iP = $index) {
              <button type="button" class="bouton-principal" (click)="placer(m, iP)">
                Palanquée {{ p.numero }} ({{ p.membres.length }})
              </button>
            }
            <button type="button" class="bouton-discret" (click)="placerDansNouvellePalanquee(m)">
              + Nouvelle palanquée
            </button>
            <button type="button" class="bouton-discret" (click)="membreAPlacer.set(null)">Annuler</button>
          </div>
        </div>
      }

      <div class="actions-bas">
        <button type="button" class="bouton-principal" (click)="enregistrer()" [disabled]="envoi()">
          {{ envoi() ? 'Enregistrement…' : 'Enregistrer la fiche' }}
        </button>
        @if (dejaEnregistree()) {
          <a class="bouton-discret" [routerLink]="['/fiches-securite', seanceId, 'realise']">
            Compléter au retour de plongée →
          </a>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin: var(--pas-3) 0 0; }
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

    .plongeur { border-top: 1px solid var(--trait); padding-top: var(--pas-2); margin-top: var(--pas-2); }
    .discrete { font-weight: 400; font-size: .8125rem; color: var(--craie); margin: 0 0 4px; }
    .selecteur-connu { max-width: 320px; margin-bottom: var(--pas); }
    .ligne-plongeur { display: flex; gap: var(--pas); flex-wrap: wrap; align-items: center; margin-bottom: var(--pas); }
    .ligne-plongeur input[type="text"] { flex: 1 1 140px; }

    .danger { color: #B3261E; border-color: #B3261E; }
    .alerte-profondeur { margin: -4px 0 var(--pas); font-size: .8125rem; color: #8a5a00; }
    .actions-bas { display: flex; gap: var(--pas-2); flex-wrap: wrap; margin: var(--pas-3) 0; }
    #rechercheRealise { max-width: 320px; }

    .ligne-groupe { display: flex; gap: var(--pas); flex-wrap: wrap; align-items: center; margin-bottom: var(--pas-2); }
    .ligne-groupe select { max-width: 280px; }
    .ligne-groupe input[type="text"] { flex: 1 1 240px; }

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
    .barre-placement {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
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

    .cdk-drag-preview { box-shadow: 0 4px 12px rgba(0,0,0,.2); }
    .cdk-drag-placeholder { opacity: 0.3; }
    .cdk-drop-list-dragging .plongeur:not(.cdk-drag-placeholder) { transition: transform 200ms ease; }
  `]
})
export class FicheSecuriteComponent {
  readonly lieuEtSite = lieuEtSite;
  private api = inject(ApiService);
  private file = inject(FileEcrituresService);
  private route = inject(ActivatedRoute);

  seanceId = Number(this.route.snapshot.paramMap.get('id'));

  seance = signal<SeanceVue | null>(null);
  moniteurs = signal<MoniteurOptionVue[]>([]);

  /**
   * Directeurs de plongée proposés : tout moniteur actif en piscine ou en
   * fosse, E3 et E4 seulement en milieu naturel. Simple confort d'affichage :
   * le serveur refuse de toute façon un DP non habilité.
   */
  dpsPossibles = computed<OptionCombobox[]>(() => this.moniteurs()
    .filter(m => this.seance()?.milieu !== 'NATUREL' || m.niveauEncadrement === 'E3' || m.niveauEncadrement === 'E4')
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

  /** Les membres du groupe déjà répartis dans une palanquée de cette fiche ne se glissent plus depuis le pool. */
  poolDisponible = computed(() => {
    const groupe = this.groupeSelectionne();
    if (!groupe) return [];
    const dejaPlaces = new Set(this.palanquees().flatMap(p => p.membres.map(cleIdentite)));
    return groupe.membres.filter(m => !dejaPlaces.has(cleIdentite(m)));
  });

  /** Un id de dropList CDK par palanquée, pour connecter le pool du groupe et permettre le glisser-déposer entre elles. */
  idsPalanquees = computed(() => this.palanquees().map(p => 'palanquee-' + p.numero));
  tousLesIds = computed(() => ['pool', ...this.idsPalanquees()]);

  constructor() {
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

  ajouterPalanquee(): void {
    const numero = this.palanquees().length > 0
      ? Math.max(...this.palanquees().map(p => p.numero)) + 1
      : 1;
    this.palanquees.set([...this.palanquees(), palanqueeVide(numero)]);
  }

  retirerPalanquee(index: number): void {
    this.palanquees.set(this.palanquees().filter((_, i) => i !== index));
  }

  ajouterMembre(indexPalanquee: number): void {
    const liste = this.palanquees().map((p, i) =>
      i === indexPalanquee ? { ...p, membres: [...p.membres, plongeurVide()] } : p);
    this.palanquees.set(liste);
  }

  retirerMembre(indexPalanquee: number, indexMembre: number): void {
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
    this.membreAPlacer.set(this.membreAPlacer() === m ? null : m);
  }

  placer(m: MembreGroupeVue, indexPalanquee: number): void {
    const palanquee = this.palanquees()[indexPalanquee];
    this.ajouterDepuisGroupe(m, indexPalanquee, palanquee.membres.length);
    this.membreAPlacer.set(null);
  }

  placerDansNouvellePalanquee(m: MembreGroupeVue): void {
    this.ajouterPalanquee();
    this.placer(m, this.palanquees().length - 1);
  }

  /** Copie un membre du groupe dans une palanquée : le groupe reste intact, réutilisable sur d'autres fiches. */
  private ajouterDepuisGroupe(source: MembreGroupeVue, indexPalanquee: number, position: number): void {
    const nouveau: PlongeurVue = {
      eleveId: source.eleveId, utilisateurId: source.utilisateurId, nom: source.nom, prenom: source.prenom,
      aptitude: source.aptitude, aptitudeDonneeParDp: null, qualificationPreparee: source.qualificationPreparee,
      fonction: 'PLONGEUR', gaz: null, moyenDesaturation: null, observations: null
    };
    const liste = this.palanquees().map((p, i) => {
      if (i !== indexPalanquee) return p;
      const membres = [...p.membres];
      membres.splice(position, 0, nouveau);
      return { ...p, membres };
    });
    this.palanquees.set(liste);
  }

  onDropPalanquee(event: CdkDragDrop<PlongeurVue[]>, indexPalanquee: number): void {
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

    const membres = new Map<string, MembreGroupeVue>();
    for (const p of this.palanquees()) {
      for (const m of p.membres) {
        if (!m.nom && !m.prenom) continue;
        membres.set(cleIdentite(m), {
          eleveId: m.eleveId, utilisateurId: m.utilisateurId, nom: m.nom, prenom: m.prenom,
          aptitude: m.aptitude, qualificationPreparee: m.qualificationPreparee
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

  /**
   * Avertissement d'affichage seulement (voir la note au-dessus de
   * PROFONDEUR_MAX_PAR_APTITUDE) : signale qu'un plongeur n'a pas
   * l'aptitude requise pour la profondeur prévue de sa palanquée.
   */
  alerteProfondeur(p: PalanqueeVue, m: PlongeurVue): string | null {
    if (!p.profondeurPrevue) return null;
    const max = profondeurMaxPourAptitude(m.aptitude);
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

  /** Pré-remplit nom/prénom/aptitude/qualification depuis le dossier du plongeur choisi, éditable ensuite. */
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

    const liste = this.palanquees().map((p, i) => i !== indexPalanquee ? p : {
      ...p, membres: p.membres.map((m, j) => j !== indexMembre ? m : {
        ...m, eleveId: candidat.eleveId, utilisateurId: candidat.utilisateurId,
        nom: candidat.nom, prenom: candidat.prenom,
        aptitude: candidat.aptitude, qualificationPreparee: candidat.qualificationPreparee
      })
    });
    this.palanquees.set(liste);
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
          palanquees: this.palanquees().map(p => ({
            numero: p.numero, profondeurPrevue: p.profondeurPrevue, dureePrevue: p.dureePrevue,
            membres: p.membres
          }))
        }
      }, 'Fiche de sécurité', this.seance()?.date ?? dateDuJour());

      if (issue.etat === 'envoyee') {
        this.ficheId.set(issue.reponse.id);
        this.palanquees.set(issue.reponse.palanquees);
        this.enAttente.set(this.file.pourSeance(this.seanceId, 'realise').length > 0);
        this.message.set('Fiche enregistrée.');
      } else if (issue.etat === 'en-attente') {
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
