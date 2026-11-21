import { IntroComponent } from '../../core/intro.component';
import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AdhesionVue, CandidatInscription, CursusVue, EleveVue, GroupeEntrainementVue, SaisonVue } from '../../core/modeles';
import { etatCaci, libelleCaci } from '../../core/caci';
import { DateFrPipe } from '../../core/date-fr';
import { PhotoEleveComponent } from '../../core/photo-eleve.component';
import { normaliser } from '../../core/seance-lieu';
import { DialogueComponent } from '../../core/dialogue.component';
import { STATUTS_CURSUS, libelleStatutCursus } from '../../core/statuts-cursus';
import { ChargementComponent } from '../../core/chargement.component';


@Component({
  selector: 'app-cursus-admin',
  imports: [ChargementComponent, FormsModule, DialogueComponent, NgTemplateOutlet, RouterLink, DateFrPipe, PhotoEleveComponent, IntroComponent],
  template: `
    <div class="entete">
      <div>
        <h1>Inscriptions</h1>
        <app-intro><p class="secondaire">
          Inscrit un élève dans une formation : le référentiel actif du niveau choisi est figé
          automatiquement, il ne bougera plus même si le MFT est révisé en cours de saison.
        </p></app-intro>
      </div>
      <button type="button" class="bouton-principal" (click)="ouvrirCreation()">Nouvelle inscription</button>
    </div>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <app-dialogue [ouvert]="creationOuverte()" titre="Nouvelle inscription" [erreur]="message()"
                  (fermer)="creationOuverte.set(false)">

      <label for="saison">Saison</label>
      <select id="saison" name="saison" [ngModel]="saisonId()" (ngModelChange)="choisirSaison($event)">
        <option [ngValue]="null">Choisir…</option>
        @for (s of saisons(); track s.id) {
          <option [ngValue]="s.id">{{ s.libelle }}{{ s.ouverte ? '' : ' (fermée)' }}</option>
        }
      </select>

      <label for="eleve">Élève</label>
      <div class="combobox">
        <input id="eleve" type="text" name="eleve" autocomplete="off"
               role="combobox" aria-autocomplete="list" aria-controls="liste-eleves"
               [attr.aria-expanded]="comboboxOuvert()"
               [attr.aria-activedescendant]="optionActive() ? 'option-eleve-' + optionActive()!.eleveId : null"
               [disabled]="saisonId() === null"
               [placeholder]="aideRecherche()"
               [ngModel]="rechercheEleve()" (ngModelChange)="saisirEleve($event)"
               (focus)="ouvrirCombobox()" (blur)="fermerComboboxDifferee()" (keydown)="clavierCombobox($event)">
        @if (comboboxOuvert()) {
          <ul id="liste-eleves" role="listbox" class="options" aria-label="Élèves">
            @for (c of candidatsFiltres(); track c.eleveId; let i = $index) {
              <li role="option" [id]="'option-eleve-' + c.eleveId"
                  [attr.aria-selected]="candidatChoisi()?.eleveId === c.eleveId"
                  [class.active]="indexActif() === i">
                <button type="button" tabindex="-1" (mousedown)="choisirEleve(c)">
                  <span class="option-nom">{{ c.prenom }} {{ c.nom }}</span>
                  <span class="option-detail">
                    <span class="badge-niveau" [class.debutant]="!c.niveauActuel">{{ niveauCourt(c) }}</span>
                    @if (c.saisonsPrecedentes === 0) {
                      <span class="badge-nouveau">1re saison</span>
                    } @else {
                      <span>{{ anciennete(c) }}</span>
                    }
                    @if (c.inscriptionsSaison.length > 0) {
                      <span class="deja">déjà inscrit : {{ c.inscriptionsSaison.join(', ') }}</span>
                    }
                  </span>
                </button>
              </li>
            } @empty {
              <li class="vide">Aucun élève ne correspond.</li>
            }
          </ul>
        }
      </div>

      @if (candidatChoisi(); as c) {
        <dl class="resume-eleve" aria-live="polite">
          <dt>Niveau actuel</dt>
          <dd>
            {{ c.niveauActuel ?? 'Aucun brevet connu' }}
            @if (c.niveauDeclare) { <span class="secondaire">— déclaré sur la fiche élève</span> }
            @if (!c.niveauActuel) {
              <span class="secondaire">— à renseigner dans « Élèves » s'il a un brevet obtenu ailleurs</span>
            }
          </dd>
          <dt>Au club</dt>
          <dd>
            @if (c.saisonsPrecedentes === 0) {
              <span class="badge-nouveau">Première saison</span>
            } @else {
              {{ anciennete(c) }} · dernière : {{ c.derniereSaison }}
            }
          </dd>
          @if (c.inscriptionsSaison.length > 0 || c.adhesionSaison) {
            <dt>Cette saison</dt>
            <dd>
              @if (c.inscriptionsSaison.length > 0) { Déjà inscrit en {{ c.inscriptionsSaison.join(', ') }}. }
              @if (c.adhesionSaison) { Adhérent sans formation. }
            </dd>
          }
        </dl>
        <p class="secondaire motif">{{ c.motifProposition }}</p>
      }

      <label for="niveau">Niveau préparé</label>
      <select id="niveau" name="niveau" [ngModel]="niveau" (ngModelChange)="changerNiveau($event)">
        @for (n of niveaux; track n) {
          <option [value]="n">{{ n }}{{ candidatChoisi()?.niveauPropose === n ? ' (proposé)' : '' }}</option>
        }
        <option value="MAINTIEN">Aucun — maintien, sans formation</option>
      </select>
      @if (niveau === 'MAINTIEN') {
        <p class="secondaire">
          L'élève plonge avec le club cette saison sans préparer de niveau : pas de référentiel.
        </p>
      }

      <label for="groupe">Groupe d'entraînement</label>
      @if (groupes().length === 0) {
        <p class="secondaire">
          Aucun groupe pour cette saison : créez-les dans « Groupes d'entraînement », puis rangez l'élève.
        </p>
      } @else {
        <select id="groupe" name="groupe" [ngModel]="groupeId" (ngModelChange)="choisirGroupe($event)">
          <option [ngValue]="null">{{ libelleSansChangement() }}</option>
          @for (g of groupes(); track g.id) {
            @if (g.id !== groupeActuel()?.id) {
              <option [ngValue]="g.id">{{ g.nom }}{{ g.id === groupeSuggere()?.id ? ' (suggéré)' : '' }}</option>
            }
          }
        </select>
        @if (groupeActuel() && groupeId !== null) {
          <p class="secondaire">L'élève quittera « {{ groupeActuel()!.nom }} » : un seul groupe par saison.</p>
        }
      }

      <div class="actions-dialogue">
        <button [attr.aria-busy]="envoi() || null" type="button" class="bouton-principal" (click)="inscrire()" [disabled]="envoi()">
          {{ envoi() ? 'Inscription…' : 'Inscrire' }}
        </button>
        <button type="button" class="bouton-discret" (click)="creationOuverte.set(false)">Annuler</button>
      </div>
    </app-dialogue>

    <section class="filtres">
      <div>
        <label for="filtre-saison">Saison</label>
        <select id="filtre-saison" name="filtreSaison" [ngModel]="saisonAffichee()" (ngModelChange)="choisirSaisonAffichee($event)">
          @for (s of saisons(); track s.id) {
            <option [ngValue]="s.libelle">{{ s.libelle }}{{ s.ouverte ? ' (en cours)' : '' }}</option>
          }
          <option [ngValue]="null">Toutes les saisons</option>
        </select>
      </div>
      <div>
        <label for="filtre-groupe">Groupe</label>
        <select id="filtre-groupe" name="filtreGroupe" [ngModel]="groupeFiltre()" (ngModelChange)="groupeFiltre.set($event)">
          <option [ngValue]="null">Tous les groupes</option>
          @for (n of nomsGroupes(); track n) { <option [ngValue]="n">{{ n }}</option> }
          <option [ngValue]="SANS_GROUPE">Sans groupe</option>
        </select>
      </div>
      <div>
        <label for="filtre-nom">Rechercher un élève</label>
        <input id="filtre-nom" type="search" name="filtreNom" placeholder="Nom ou prénom"
               [ngModel]="filtreNom()" (ngModelChange)="filtreNom.set($event)">
      </div>
    </section>

    @if (chargement()) {
      <app-chargement />
    } @else if (liste().length === 0) {
      <div class="carte vide"><p>Aucun cursus enregistré.</p></div>
    } @else if (listeFiltree().length === 0) {
      <div class="carte vide">
        <p>{{ filtreNom().trim() || groupeFiltre() !== null ? 'Aucune inscription ne correspond aux filtres.' : 'Aucune inscription en formation pour cette saison.' }}</p>
      </div>
    } @else {
      <p class="secondaire compte">{{ listeFiltree().length }} inscription{{ listeFiltree().length > 1 ? 's' : '' }} en formation</p>
      <ul class="cartes">
        @for (c of listeFiltree(); track c.id) {
          <li class="carte">
            <ng-container [ngTemplateOutlet]="fiche"
                          [ngTemplateOutletContext]="{ eleveId: c.eleveId, nom: c.eleve, saison: c.saison,
                                                       sousTitre: c.niveau + ' · ' + c.saison, etat: libelleStatut(c.statut) }" />
            <div class="actions">
              <button type="button" class="bouton-discret" (click)="commencerEdition(c)">Modifier</button>
              <a class="bouton-discret" routerLink="/admin/eleves"
                 [queryParams]="{ modifier: c.eleveId, retour: '/admin/cursus' }">Fiche de l'élève</a>
            </div>
          </li>
        }
      </ul>
    }

    <!-- Ce que l'on sait de l'élève : photo (droit à l'image), naissance, licence, CACI, groupe de la saison. -->
    <ng-template #fiche let-eleveId="eleveId" let-nom="nom" let-saison="saison" let-sousTitre="sousTitre" let-etat="etat">
      <div class="tete">
        <app-photo-eleve [eleveId]="eleveId" [nom]="nom" [aPhoto]="dossier(eleveId)?.aPhoto ?? false" [taille]="56" />
        <div class="identite">
          <span class="nom">{{ nom }}</span>
          <span class="secondaire">{{ sousTitre }}</span>
          <span class="etat">{{ etat }}</span>
        </div>
      </div>
      <dl class="infos">
        @if (dossier(eleveId); as e) {
          <dt>Naissance</dt>
          <dd>{{ e.dateNaissance ? (e.dateNaissance | dateFr) : 'non renseignée' }}</dd>
          <dt>Licence</dt>
          <dd>{{ e.numeroLicence || 'aucune' }}</dd>
          <dt>CACI</dt>
          <dd><span class="etiquette-etat" [class]="'etiquette-etat ' + tonCaci(e.certificatValideJusquAu)">
            {{ libelleCaci(e.certificatValideJusquAu) }}</span></dd>
        }
        <dt>Groupe</dt>
        <dd>{{ groupeDe(eleveId, saison) ?? 'Sans groupe' }}</dd>
      </dl>
    </ng-template>

    <app-dialogue [ouvert]="cursusEnEdition() !== null" [erreur]="message()" (fermer)="annulerEdition()"
                  [titre]="'Modifier l’inscription de ' + (cursusEnEdition()?.eleve ?? '')">
      @if (cursusEnEdition(); as c) {
        @if (formulaireEdition(); as f) {
          <p class="secondaire">{{ c.niveau }} · {{ c.saison }}</p>
          <label for="niveau-edition">Niveau préparé</label>
          <select id="niveau-edition" name="niveauEdition" [(ngModel)]="f.niveau">
            @for (n of niveaux; track n) { <option [value]="n">{{ n }}</option> }
            <option value="MAINTIEN">Aucun — maintien, sans formation</option>
          </select>
          @if (f.niveau !== c.niveau) {
            <p class="secondaire">
              Possible seulement si aucune compétence n'a encore été notée
              @if (f.niveau === 'MAINTIEN') { ni aucune présence }
              pour cette formation.
            </p>
          }
          @if (f.niveau !== 'MAINTIEN') {
            <label for="statut-edition">Statut</label>
            <select id="statut-edition" name="statut" [(ngModel)]="f.statut">
              @for (s of statuts; track s) { <option [value]="s">{{ libelleStatut(s) }}</option> }
            </select>
            @if (f.statut === 'OBTENU_AILLEURS' && c.statut !== 'OBTENU_AILLEURS') {
              <p class="secondaire">
                Brevet passé dans une autre structure : la fiche de l'élève prendra le niveau {{ f.niveau }},
                et il ne figurera plus parmi les P{{ f.niveau }} (Infos élèves, feuilles de présence).
              </p>
            }
          }
          <div class="actions-dialogue">
            <button [attr.aria-busy]="envoi() || null" type="button" class="bouton-principal" (click)="enregistrer(c)" [disabled]="envoi()">
              {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
            <button type="button" class="bouton-discret" (click)="annulerEdition()">Annuler</button>
          </div>
          <p class="secondaire">
            Inscription faite par erreur ? Elle se supprime tant qu'aucune compétence ni présence n'y est notée.
          </p>
          <button type="button" class="bouton-discret danger supprimer-inscription" (click)="supprimer(c)"
                  [disabled]="envoi()">Supprimer l'inscription</button>
        }
      }
    </app-dialogue>

    @if (adhesionsFiltrees().length > 0) {
      <h2 class="titre-maintien">Maintien, sans formation</h2>
      <ul class="cartes">
        @for (a of adhesionsFiltrees(); track a.id) {
          <li class="carte">
            <ng-container [ngTemplateOutlet]="fiche"
                          [ngTemplateOutletContext]="{ eleveId: a.eleveId, nom: a.eleve, saison: a.saison,
                                                       sousTitre: 'Maintien · ' + a.saison, etat: 'Sans formation' }" />
            <div class="actions">
              <button type="button" class="bouton-discret" (click)="retirerAdhesion(a)">Retirer de la saison</button>
              <a class="bouton-discret" routerLink="/admin/eleves"
                 [queryParams]="{ modifier: a.eleveId, retour: '/admin/cursus' }">Fiche de l'élève</a>
            </div>
          </li>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .entete { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas-2); flex-wrap: wrap; }
    .entete > div { flex: 1 1 320px; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }

    .filtres { display: flex; flex-wrap: wrap; gap: var(--pas-2) var(--pas-3); margin-bottom: var(--pas-3); }
    .filtres > div { min-width: 220px; flex: 1 1 220px; max-width: 320px; }
    .filtres label { margin: 0 0 4px; }
    .filtres input { margin: 0; }

    .combobox { position: relative; max-width: 320px; }
    .combobox input { width: 100%; }
    .options {
      position: absolute; z-index: 1; top: 100%; left: 0; right: 0; margin-top: 2px;
      max-height: 240px; overflow-y: auto; background: var(--carte); border: 1px solid var(--trait);
      border-radius: var(--r-s); box-shadow: 0 4px 12px rgba(0,0,0,.12);
      display: block !important; gap: 0 !important;
    }
    .options li { padding: 0 !important; }
    .options li[aria-selected="true"] button { font-weight: 700; background: var(--fond); }
    .options button {
      display: block; width: 100%; padding: var(--pas) var(--pas-2); min-height: 44px;
      text-align: left; background: none; border: none; color: var(--encre);
    }
    .options button:hover, .options button:focus { background: var(--fond); }
    .options li.active button { background: var(--fond); outline: 2px solid var(--profond); outline-offset: -2px; }
    .option-nom { display: block; }
    .option-detail { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; font-size: .8125rem; color: var(--craie); }
    .badge-niveau {
      padding: 0 6px; border-radius: var(--r-s); background: var(--profond); color: #fff; font-weight: 700;
    }
    .badge-niveau.debutant { background: #EEF2F4; color: var(--craie); }
    .badge-nouveau {
      padding: 0 6px; border-radius: var(--r-s); background: var(--acquis-clair); color: var(--acquis);
      font-weight: 700; font-size: .8125rem;
    }
    .deja { color: var(--en-cours); font-weight: 700; }
    .resume-eleve {
      display: grid; grid-template-columns: max-content 1fr; gap: 4px var(--pas-2);
      margin: var(--pas-2) 0 0; padding: var(--pas-2); border-radius: var(--r-s); background: var(--fond);
      font-size: .9375rem;
    }
    .resume-eleve dt { color: var(--craie); }
    .resume-eleve dd { margin: 0; font-weight: 700; }
    .motif { margin: var(--pas) 0 0; }
    .options .vide { padding: var(--pas) var(--pas-2) !important; color: var(--craie); font-size: .875rem; }

    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2); }
    li { padding: var(--pas-2); }
    /* Plusieurs cartes par ligne dès que la largeur le permet ; une seule au téléphone. */
    .cartes { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); align-items: stretch; }
    .cartes > li { display: flex; flex-direction: column; }
    .compte { margin: 0 0 var(--pas); }
    .tete { display: flex; align-items: flex-start; gap: var(--pas-2); }
    .identite { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0; }
    .infos {
      display: grid; grid-template-columns: max-content 1fr; gap: 4px var(--pas-2); align-items: baseline;
      margin: var(--pas-2) 0 0; font-size: .875rem;
    }
    .infos dt { color: var(--craie); }
    .infos dd { margin: 0; }
    .cartes .actions { margin-top: auto; padding-top: var(--pas-2); }
    a.bouton-discret { display: inline-flex; align-items: center; text-decoration: none; }
    .nom { font-weight: 700; }
    .titre-maintien { margin: var(--pas-3) 0 var(--pas-2); }
    .etat {
      flex: none; padding: 2px 10px; border-radius: var(--r-s); font-size: .8125rem; font-weight: 700;
      background: #EEF2F4; color: var(--craie);
    }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }
    .actions .bouton-principal { width: auto; margin-top: 0; }

  `]
})
export class CursusAdminComponent {
  private api = inject(ApiService);

  readonly statuts = STATUTS_CURSUS;

  liste = signal<CursusVue[]>([]);
  saisons = signal<SaisonVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  envoi = signal(false);

  /** Formulaire d'inscription caché par défaut. */
  creationOuverte = signal(false);

  filtreNom = signal('');
  /** Libellé de la saison affichée (la saison en cours par défaut) ; null : toutes. */
  saisonAffichee = signal<string | null>(null);
  listeFiltree = computed(() => {
    const recherche = this.filtreNom().trim().toLocaleLowerCase();
    const saison = this.saisonAffichee();
    return this.liste().filter(c => (saison === null || c.saison === saison)
      && (!recherche || c.eleve.toLocaleLowerCase().includes(recherche))
      && this.dansLeGroupeFiltre(c.eleveId, c.saison));
  });

  /** Valeur du filtre « Sans groupe » (un nom de groupe n'est jamais vide). */
  readonly SANS_GROUPE = '';
  /** Nom du groupe filtré, SANS_GROUPE, ou null : tous. Par nom, pour « Toutes les saisons ». */
  groupeFiltre = signal<string | null>(null);
  /** Les groupes des saisons affichées, dans l'ordre de l'écran des groupes, sans doublon de nom. */
  nomsGroupes = computed(() => {
    const saison = this.saisonAffichee();
    const groupes = [...this.groupesParSaison().entries()]
      .filter(([libelle]) => saison === null || libelle === saison)
      .flatMap(([, g]) => [...g].sort((a, b) => a.ordre - b.ordre));
    return [...new Set(groupes.map(g => g.nom))];
  });

  /** Dossiers des élèves actifs, pour la photo et les informations des cartes. */
  private dossiers = signal<Map<number, EleveVue>>(new Map());
  /** Groupes d'entraînement de chaque saison, par libellé de saison. */
  private groupesParSaison = signal<Map<string, GroupeEntrainementVue[]>>(new Map());
  readonly libelleCaci = libelleCaci;

  readonly niveaux = ['N1', 'N2', 'N3'] as const;

  /** Élèves proposés, vus depuis la saison choisie (niveau actuel, ancienneté, niveau suggéré). */
  candidats = signal<CandidatInscription[]>([]);
  rechercheEleve = signal('');
  comboboxOuvert = signal(false);
  /** Option mise en surbrillance au clavier ; -1 : aucune. */
  indexActif = signal(-1);
  candidatsFiltres = computed(() => {
    const recherche = normaliser(this.rechercheEleve());
    if (!recherche) return this.candidats();
    return this.candidats().filter(c => normaliser(`${c.prenom} ${c.nom}`).includes(recherche)
      || normaliser(`${c.nom} ${c.prenom}`).includes(recherche));
  });
  aideRecherche = computed(() => this.saisonId() === null
    ? "Choisissez d'abord la saison" : 'Rechercher par nom ou prénom…');
  optionActive = computed(() => this.candidatsFiltres()[this.indexActif()] ?? null);

  candidatChoisi = signal<CandidatInscription | null>(null);
  saisonId = signal<number | null>(null);
  /** MAINTIEN : l'élève ne prépare aucun niveau (adhésion sans formation). */
  niveau: 'N1' | 'N2' | 'N3' | 'MAINTIEN' = 'N1';

  /** Adhésions sans formation de la saison ouverte, affichées sous les inscriptions. */
  adhesions = signal<AdhesionVue[]>([]);
  adhesionsFiltrees = computed(() => {
    const r = normaliser(this.filtreNom());
    const saison = this.saisonAffichee();
    return this.adhesions().filter(a => (saison === null || a.saison === saison)
      && (!r || normaliser(a.eleve).includes(r))
      && this.dansLeGroupeFiltre(a.eleveId, a.saison));
  });

  /** Groupes d'entraînement de la saison choisie. */
  groupes = signal<GroupeEntrainementVue[]>([]);
  /** null : le groupe de l'élève ne change pas (il reste dans son groupe actuel, ou sans groupe). */
  groupeId: number | null = null;
  /** Choisi à la main : on ne le remplace plus par la suggestion quand le niveau change. */
  private groupeTouche = false;
  private niveauSignal = signal<'N1' | 'N2' | 'N3' | 'MAINTIEN'>('N1');

  /** Le groupe où l'élève est déjà rangé cette saison, s'il y en a un. */
  groupeActuel = computed(() => {
    const c = this.candidatChoisi();
    return c ? this.groupes().find(g => g.eleves.some(e => e.id === c.eleveId)) ?? null : null;
  });

  libelleSansChangement = computed(() => {
    const g = this.groupeActuel();
    return g ? `Laisser dans « ${g.nom} »` : "Ne pas ranger pour l'instant";
  });

  /** Premier groupe (dans l'ordre d'affichage) qui prépare le niveau choisi, comme la suggestion de l'écran des groupes. */
  groupeSuggere = computed(() =>
    [...this.groupes()].sort((a, b) => a.ordre - b.ordre).find(g => g.niveauPrepare === this.niveauSignal()) ?? null);

  edition = signal<number | null>(null);
  cursusEnEdition = computed(() => this.liste().find(c => c.id === this.edition()) ?? null);
  formulaireEdition = signal<{
    statut: string; niveau: 'N1' | 'N2' | 'N3' | 'MAINTIEN';
  } | null>(null);

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    this.chargement.set(true);
    try {
      const [cursus, saisons] = await Promise.all([
        this.api.cursus(),
        firstValueFrom(this.api.saisons())
      ]);
      this.liste.set(cursus);
      this.saisons.set(saisons);
      // Saison ouverte la plus récente par défaut : c'est presque toujours celle qu'on inscrit.
      const ouverte = saisons.find(s => s.ouverte);
      this.saisonAffichee.set((ouverte ?? saisons[0])?.libelle ?? null);
      if (ouverte) this.choisirSaison(ouverte.id);
      this.chargerAdhesions();
      this.chargerGroupes();
      this.api.eleves().subscribe({
        next: eleves => this.dossiers.set(new Map(eleves.map(e => [e.id, e]))),
        error: () => this.message.set('Impossible de charger les dossiers des élèves.')
      });
    } catch {
      this.message.set("Impossible de charger les données d'inscription.");
    } finally {
      this.chargement.set(false);
    }
  }

  /** Changer de saison change le regard porté sur chaque élève : on recharge et on repart de zéro. */
  choisirSaison(id: number | null): void {
    this.saisonId.set(id);
    this.candidatChoisi.set(null);
    this.rechercheEleve.set('');
    this.candidats.set([]);
    this.groupes.set([]);
    this.groupeId = null;
    this.groupeTouche = false;
    if (id === null) return;
    this.api.candidatsInscription(id).subscribe({
      next: c => { if (this.saisonId() === id) this.candidats.set(c); },
      error: () => this.message.set('Impossible de charger les élèves pour cette saison.')
    });
    this.api.groupesEntrainement(id).subscribe({
      next: g => { if (this.saisonId() === id) this.groupes.set(g); },
      error: () => this.message.set("Impossible de charger les groupes d'entraînement de cette saison.")
    });
  }

  changerNiveau(n: 'N1' | 'N2' | 'N3' | 'MAINTIEN'): void {
    this.niveau = n;
    this.niveauSignal.set(n);
    if (!this.groupeTouche) this.proposerGroupe();
  }

  choisirGroupe(id: number | null): void {
    this.groupeId = id;
    this.groupeTouche = true;
  }

  /** Élève déjà dans un groupe : on l'y laisse ; sinon, le groupe qui prépare son niveau. */
  private proposerGroupe(): void {
    this.groupeId = this.groupeActuel() ? null : this.groupeSuggere()?.id ?? null;
  }

  /** Tant qu'aucune option n'a été choisie, aucun élève n'est retenu pour l'inscription. */
  saisirEleve(texte: string): void {
    this.rechercheEleve.set(texte);
    this.candidatChoisi.set(null);
    this.comboboxOuvert.set(true);
    this.indexActif.set(texte.trim() ? 0 : -1);
  }

  ouvrirCombobox(): void {
    this.comboboxOuvert.set(true);
  }

  /** Différé pour laisser le clic sur une option se produire avant la fermeture. */
  fermerComboboxDifferee(): void {
    setTimeout(() => this.comboboxOuvert.set(false), 150);
  }

  /** Flèches pour parcourir, Entrée pour choisir, Échap pour refermer. */
  clavierCombobox(ev: KeyboardEvent): void {
    const nb = this.candidatsFiltres().length;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.comboboxOuvert.set(true);
      if (nb === 0) return;
      const pas = ev.key === 'ArrowDown' ? 1 : -1;
      this.indexActif.set((this.indexActif() + pas + nb) % nb);
      document.getElementById(`option-eleve-${this.optionActive()?.eleveId}`)?.scrollIntoView({ block: 'nearest' });
    } else if (ev.key === 'Enter') {
      const c = this.optionActive();
      if (this.comboboxOuvert() && c) {
        ev.preventDefault();
        this.choisirEleve(c);
      }
    } else if (ev.key === 'Escape') {
      // Échap referme d'abord la liste, pas la fenêtre de dialogue.
      if (this.comboboxOuvert()) ev.preventDefault();
      this.comboboxOuvert.set(false);
    }
  }

  choisirEleve(c: CandidatInscription): void {
    this.candidatChoisi.set(c);
    this.rechercheEleve.set(`${c.prenom} ${c.nom}`);
    this.comboboxOuvert.set(false);
    this.indexActif.set(-1);
    if (c.niveauPropose) this.niveau = c.niveauPropose;
    this.niveauSignal.set(this.niveau);
    this.groupeTouche = false;
    this.proposerGroupe();
  }

  niveauCourt(c: CandidatInscription): string {
    return c.niveauActuel ? c.niveauActuel + (c.niveauDeclare ? ' (déclaré)' : '') : 'Aucun brevet';
  }

  /** « 2e saison » : la saison choisie plus celles d'avant. */
  anciennete(c: CandidatInscription): string {
    return `${c.saisonsPrecedentes + 1}e saison au club`;
  }

  libelleStatut(statut: string): string {
    return libelleStatutCursus(statut);
  }

  ouvrirCreation(): void {
    this.message.set(null);
    this.creationOuverte.set(true);
  }

  inscrire(): void {
    const c = this.candidatChoisi();
    const saisonId = this.saisonId();
    if (!c || !saisonId) {
      this.message.set('Choisissez la saison puis un élève dans la liste.');
      return;
    }
    if (this.niveau === 'MAINTIEN') {
      this.inscrireEnMaintien(c.eleveId, `${c.prenom} ${c.nom}`, saisonId);
      return;
    }
    const niveau = this.niveau;
    this.envoi.set(true);
    this.message.set(null);
    this.api.inscrireCursus({
      eleveId: c.eleveId, saisonId, niveau, groupeId: this.groupeId
    }).subscribe({
      next: cursus => {
        this.envoi.set(false);
        this.creationOuverte.set(false);
        this.liste.set([cursus, ...this.liste()]);
        const groupe = this.groupes().find(g => g.id === this.groupeId);
        this.message.set(`${cursus.eleve} est inscrit·e en ${cursus.niveau}`
          + (groupe ? `, dans le groupe « ${groupe.nom} ».` : '.'));
        // Recharge les candidats (et les groupes) : l'élève affiche désormais son inscription de la saison.
        this.choisirSaison(saisonId);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "L'inscription n'a pas pu être enregistrée.");
      }
    });
  }

  private inscrireEnMaintien(eleveId: number, nom: string, saisonId: number): void {
    const groupe = this.groupes().find(g => g.id === this.groupeId);
    this.envoi.set(true);
    this.message.set(null);
    this.api.adherer({ eleveId, saisonId, groupeId: this.groupeId }).subscribe({
      next: () => {
        this.envoi.set(false);
        this.creationOuverte.set(false);
        this.message.set(`${nom} est inscrit·e en maintien, sans formation`
          + (groupe ? `, dans le groupe « ${groupe.nom} ».` : '.'));
        this.choisirSaison(saisonId);
        this.chargerAdhesions();
        this.chargerGroupes();
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "L'inscription n'a pas pu être enregistrée.");
      }
    });
  }

  commencerEdition(c: CursusVue): void {
    this.message.set(null);
    this.edition.set(c.id);
    this.formulaireEdition.set({ statut: c.statut, niveau: c.niveau });
  }

  private passerEnMaintien(c: CursusVue): void {
    if (!confirm(`${c.eleve} ne prépare plus le ${c.niveau} : passer en maintien, sans formation ?`)) return;
    this.envoi.set(true);
    this.message.set(null);
    this.api.passerEnMaintien(c.id).subscribe({
      next: () => {
        this.envoi.set(false);
        this.liste.set(this.liste().filter(x => x.id !== c.id));
        this.annulerEdition();
        this.chargerAdhesions();
        this.chargerGroupes();
        this.message.set(`${c.eleve} est passé·e en maintien, sans formation.`);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "Le passage en maintien n'a pas pu être enregistré.");
      }
    });
  }

  /** Inscription faite par erreur ; seule formation de la saison : l'élève reste en maintien. */
  supprimer(c: CursusVue): void {
    if (!confirm(`Supprimer l'inscription de ${c.eleve} en ${c.niveau} (${c.saison}) ?`)) return;
    this.envoi.set(true);
    this.message.set(null);
    this.api.supprimerCursus(c.id).subscribe({
      next: () => {
        this.envoi.set(false);
        this.liste.set(this.liste().filter(x => x.id !== c.id));
        this.annulerEdition();
        this.chargerAdhesions();
        this.chargerGroupes();
        this.message.set(`L'inscription de ${c.eleve} en ${c.niveau} est supprimée.`);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "L'inscription n'a pas pu être supprimée.");
      }
    });
  }

  retirerAdhesion(a: AdhesionVue): void {
    if (!confirm(`Retirer ${a.eleve} de la saison ${a.saison} ?`)) return;
    this.api.retirerAdhesion(a.id).subscribe({
      next: () => this.adhesions.set(this.adhesions().filter(x => x.id !== a.id)),
      error: (e: HttpErrorResponse) => this.message.set(e.error?.detail ?? "L'adhésion n'a pas pu être retirée.")
    });
  }

  /** Maintiens de toutes les saisons : le filtre de saison choisit ceux qu'on voit. */
  private chargerAdhesions(): void {
    Promise.all(this.saisons().map(s => firstValueFrom(this.api.adhesionsDeLaSaison(s.id)))).then(
      listes => this.adhesions.set(listes.flat()),
      () => this.message.set('Impossible de charger les élèves en maintien.')
    );
  }

  /** Groupes de chaque saison, pour dire sur chaque carte dans quel groupe est l'élève. */
  private chargerGroupes(): void {
    Promise.all(this.saisons().map(s => firstValueFrom(this.api.groupesEntrainement(s.id)).then(g => [s.libelle, g] as const)))
      .then(
        paires => this.groupesParSaison.set(new Map(paires)),
        () => this.message.set("Impossible de charger les groupes d'entraînement.")
      );
  }

  /** Un groupe n'existe que dans sa saison : changer de saison remet « Tous les groupes ». */
  choisirSaisonAffichee(libelle: string | null): void {
    this.saisonAffichee.set(libelle);
    this.groupeFiltre.set(null);
  }

  private dansLeGroupeFiltre(eleveId: number, saison: string): boolean {
    const filtre = this.groupeFiltre();
    return filtre === null || (this.groupeDe(eleveId, saison) ?? this.SANS_GROUPE) === filtre;
  }

  dossier(eleveId: number): EleveVue | null {
    return this.dossiers().get(eleveId) ?? null;
  }

  groupeDe(eleveId: number, saison: string): string | null {
    return this.groupesParSaison().get(saison)?.find(g => g.eleves.some(e => e.id === eleveId))?.nom ?? null;
  }

  /** Ton de l'étiquette du CACI : vert valide, orange bientôt échu, rouge expiré ou non renseigné. */
  tonCaci(finValidite: string | null): string {
    const etat = etatCaci(finValidite);
    return etat === 'valide' ? 'ok' : etat === 'bientot' ? 'attention' : 'danger';
  }

  annulerEdition(): void {
    this.edition.set(null);
    this.formulaireEdition.set(null);
  }

  enregistrer(c: CursusVue): void {
    const f = this.formulaireEdition();
    if (!f) return;
    if (f.niveau === 'MAINTIEN') {
      this.passerEnMaintien(c);
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    this.api.modifierCursus(c.id, {
      statut: f.statut, niveau: f.niveau
    }).subscribe({
      next: maj => {
        this.envoi.set(false);
        this.liste.set(this.liste().map(x => x.id === maj.id ? maj : x));
        this.annulerEdition();
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "La modification n'a pas pu être enregistrée.");
      }
    });
  }
}
