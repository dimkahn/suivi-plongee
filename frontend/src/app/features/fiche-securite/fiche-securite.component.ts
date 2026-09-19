import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import {
  GroupePlongeursVue, MembreGroupeVue, MoniteurOptionVue, PalanqueeVue, PlongeurConnuVue, PlongeurVue, SeanceVue
} from '../../core/modeles';

function plongeurVide(): PlongeurVue {
  return {
    eleveId: null, utilisateurId: null, nom: '', prenom: '', aptitude: null, qualificationPreparee: null,
    fonction: 'PLONGEUR', gaz: null, moyenDesaturation: null, observations: null
  };
}

function palanqueeVide(numero: number): PalanqueeVue {
  return {
    numero, profondeurPrevue: null, dureePrevue: null,
    profondeurRealisee: null, dureeRealisee: null, paliers: null,
    heureImmersion: null, heureSortie: null, membres: [plongeurVide()]
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
  imports: [FormsModule, RouterLink, DragDropModule],
  template: `
    <a routerLink="/fiches-securite" class="bouton-discret">← Fiches de sécurité</a>

    <datalist id="plongeurs-club">
      @for (c of plongeursConnus(); track libellePlongeurConnu(c)) {
        <option [value]="libellePlongeurConnu(c)"></option>
      }
    </datalist>

    @if (seance(); as s) {
      <h1>Fiche de sécurité — {{ s.date }}{{ s.lieu ? ' — ' + s.lieu : '' }}</h1>
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
        <select id="dp" name="dp" [(ngModel)]="f.dpId">
          <option [ngValue]="null">— Choisir —</option>
          @for (m of moniteurs(); track m.id) {
            <option [ngValue]="m.id">{{ m.nomComplet }}{{ m.niveauEncadrement ? ' (' + m.niveauEncadrement + ')' : '' }}</option>
          }
        </select>

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

      <section class="carte panneau">
        <h3>Groupe de plongeurs (réutilisable pour un séjour)</h3>
        <p class="secondaire">
          Composez une fois la liste des plongeurs d'un séjour, puis glissez-les
          dans les palanquées ci-dessous à chaque nouvelle fiche, sans ressaisie.
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
          <div cdkDropList id="pool" [cdkDropListData]="g.membres" [cdkDropListConnectedTo]="idsPalanquees()"
               class="pool-plongeurs">
            @for (m of g.membres; track m) {
              <div class="jeton-plongeur" cdkDrag [cdkDragData]="m">
                {{ m.prenom }} {{ m.nom }}{{ m.aptitude ? ' — ' + m.aptitude : '' }}
              </div>
            }
            @if (g.membres.length === 0) {
              <p class="vide">Ce groupe n'a aucun plongeur.</p>
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
               [cdkDropListConnectedTo]="tousLesIds()" (cdkDropListDropped)="onDropPalanquee($event, iP)">
            @for (m of p.membres; track m; let iM = $index) {
              <div class="plongeur" cdkDrag>
                <label class="discrete">Plongeur du club (optionnel, pré-remplit aptitude et qualification)</label>
                <input type="text" class="selecteur-connu" placeholder="Rechercher un nom…" list="plongeurs-club"
                       (change)="choisirPlongeurConnu(iP, iM, $event)">

                <div class="ligne-plongeur">
                  <input type="text" placeholder="Prénom" [(ngModel)]="m.prenom" [name]="'prenom-' + iP + '-' + iM">
                  <input type="text" placeholder="Nom" [(ngModel)]="m.nom" [name]="'nom-' + iP + '-' + iM">
                  <input type="text" placeholder="Aptitude (ex. N2, E2…)" [(ngModel)]="m.aptitude"
                         [name]="'aptitude-' + iP + '-' + iM">
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

      <div class="actions-bas">
        <button type="button" class="bouton-principal" (click)="enregistrer()" [disabled]="envoi()">
          {{ envoi() ? 'Enregistrement…' : 'Enregistrer la fiche' }}
        </button>
        @if (dejaEnregistree()) {
          <button type="button" class="bouton-discret" (click)="telechargerPdf()" [disabled]="exportEnCours()">
            {{ exportEnCours() ? 'Génération…' : 'Télécharger le PDF' }}
          </button>
          <button type="button" class="bouton-discret" (click)="telechargerExcel()" [disabled]="exportExcelEnCours()">
            {{ exportExcelEnCours() ? 'Génération…' : "Télécharger l'Excel" }}
          </button>
        }
      </div>

      @if (dejaEnregistree()) {
        <h2 class="titre-etape">2. Compléter au retour de plongée</h2>
        <p class="secondaire">
          Le profil réellement plongé par chaque palanquée. Sans effet sur le
          directeur de plongée, les conditions ou la composition des palanquées.
        </p>

        <label for="rechercheRealise">Retrouver une palanquée par un de ses plongeurs</label>
        <input id="rechercheRealise" type="text" placeholder="Nom ou prénom…"
               [ngModel]="rechercheRealise()" (ngModelChange)="rechercheRealise.set($event)">

        @if (palanqueesFiltrees().length === 0) {
          <p class="vide">Aucune palanquée ne correspond à « {{ rechercheRealise() }} ».</p>
        }

        @for (p of palanqueesFiltrees(); track p) {
          <section class="carte panneau">
            <h3>Palanquée {{ p.numero }}</h3>
            <div class="ligne-profil">
              <label>Profondeur réalisée (m) <input type="number" min="0" [(ngModel)]="p.profondeurRealisee"
                     [name]="'preal-' + p.numero"></label>
              <label>Durée réalisée (min) <input type="number" min="0" [(ngModel)]="p.dureeRealisee"
                     [name]="'dreal-' + p.numero"></label>
              <label>Paliers <input type="text" [(ngModel)]="p.paliers" [name]="'pal-' + p.numero"></label>
              <label>Immersion <input type="time" [(ngModel)]="p.heureImmersion" [name]="'hi-' + p.numero"></label>
              <label>Sortie <input type="time" [(ngModel)]="p.heureSortie" [name]="'hs-' + p.numero"></label>
            </div>
          </section>
        }

        <div class="actions-bas">
          <button type="button" class="bouton-principal" (click)="enregistrerRealise()" [disabled]="envoiRealise()">
            {{ envoiRealise() ? 'Enregistrement…' : 'Enregistrer les paramètres réalisés' }}
          </button>
        </div>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin: var(--pas-3) 0 0; }
    .titre-etape { margin: var(--pas-3) 0 0; }
    .panneau { padding: var(--pas-3); margin: var(--pas-2) 0 var(--pas-3); }
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
    .jeton-plongeur {
      padding: var(--pas) var(--pas-2); border-radius: 999px; background: var(--brume, #eef4f5);
      border: 1px solid var(--trait); cursor: grab; font-size: .875rem; user-select: none;
    }
    .cdk-drag-preview { box-shadow: 0 4px 12px rgba(0,0,0,.2); }
    .cdk-drag-placeholder { opacity: 0.3; }
    .cdk-drop-list-dragging .plongeur:not(.cdk-drag-placeholder) { transition: transform 200ms ease; }
  `]
})
export class FicheSecuriteComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  seanceId = Number(this.route.snapshot.paramMap.get('id'));

  seance = signal<SeanceVue | null>(null);
  moniteurs = signal<MoniteurOptionVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  envoi = signal(false);
  envoiRealise = signal(false);
  exportEnCours = signal(false);
  exportExcelEnCours = signal(false);
  dejaEnregistree = computed(() => this.ficheId() !== null);

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

  /** Un id de dropList CDK par palanquée, pour connecter le pool du groupe et permettre le glisser-déposer entre elles. */
  idsPalanquees = computed(() => this.palanquees().map(p => 'palanquee-' + p.numero));
  tousLesIds = computed(() => ['pool', ...this.idsPalanquees()]);

  rechercheRealise = signal('');
  /** Filtre la liste affichée à l'étape 2 sur le nom/prénom d'un plongeur, pour retrouver vite une palanquée. */
  palanqueesFiltrees = computed(() => {
    const recherche = this.normaliser(this.rechercheRealise());
    if (!recherche) return this.palanquees();
    return this.palanquees().filter(p =>
      p.membres.some(m => this.normaliser(m.nom).includes(recherche) || this.normaliser(m.prenom).includes(recherche)));
  });

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    try {
      const [seances, moniteurs, plongeursConnus, fiche, saisons] = await Promise.all([
        this.api.seances(),
        firstValueFrom(this.api.moniteursActifs()),
        firstValueFrom(this.api.plongeursConnus()),
        firstValueFrom(this.api.ficheSecurite(this.seanceId)),
        firstValueFrom(this.api.saisons())
      ]);
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
        this.groupes.set(await firstValueFrom(this.api.groupesPlongeurs(saisonOuverte.id)));
      }
    } catch {
      this.message.set('Impossible de charger la fiche de sécurité.');
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
  onDropPalanquee(event: CdkDragDrop<PlongeurVue[]>, indexPalanquee: number): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.palanquees.set([...this.palanquees()]);
      return;
    }

    if (event.previousContainer.id === 'pool') {
      const source = event.item.data as MembreGroupeVue;
      const nouveau: PlongeurVue = {
        eleveId: source.eleveId, utilisateurId: source.utilisateurId, nom: source.nom, prenom: source.prenom,
        aptitude: source.aptitude, qualificationPreparee: source.qualificationPreparee,
        fonction: 'PLONGEUR', gaz: null, moyenDesaturation: null, observations: null
      };
      const liste = this.palanquees().map((p, i) => {
        if (i !== indexPalanquee) return p;
        const membres = [...p.membres];
        membres.splice(event.currentIndex, 0, nouveau);
        return { ...p, membres };
      });
      this.palanquees.set(liste);
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
        const cle = m.eleveId !== null ? `E${m.eleveId}` : m.utilisateurId !== null ? `U${m.utilisateurId}`
          : `N${m.nom}|${m.prenom}`;
        membres.set(cle, {
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
  enregistrer(): void {
    const f = this.entete();
    if (!f?.dpId) {
      this.message.set('Le directeur de plongée est obligatoire.');
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    this.api.enregistrerFicheSecurite(this.seanceId, {
      dpId: f.dpId,
      meteo: f.meteo, etatMer: f.etatMer, visibilite: f.visibilite,
      courant: f.courant, maree: f.maree, temperatureEau: f.temperatureEau,
      securiteSurface: f.securiteSurface, planSecours: f.planSecours,
      observations: f.observations,
      palanquees: this.palanquees().map(p => ({
        numero: p.numero, profondeurPrevue: p.profondeurPrevue, dureePrevue: p.dureePrevue,
        membres: p.membres
      }))
    }).subscribe({
      next: fiche => {
        this.envoi.set(false);
        this.ficheId.set(fiche.id);
        this.palanquees.set(fiche.palanquees);
        this.message.set('Fiche enregistrée.');
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "L'enregistrement de la fiche a échoué.");
      }
    });
  }

  /** Complément au retour de plongée : le profil réellement plongé, palanquée par palanquée. */
  enregistrerRealise(): void {
    this.envoiRealise.set(true);
    this.message.set(null);
    this.api.enregistrerProfilRealise(this.seanceId, this.palanquees().map(p => ({
      numero: p.numero, profondeurRealisee: p.profondeurRealisee, dureeRealisee: p.dureeRealisee,
      paliers: p.paliers, heureImmersion: p.heureImmersion, heureSortie: p.heureSortie
    }))).subscribe({
      next: fiche => {
        this.envoiRealise.set(false);
        this.palanquees.set(fiche.palanquees);
        this.message.set('Paramètres réalisés enregistrés.');
      },
      error: (e: HttpErrorResponse) => {
        this.envoiRealise.set(false);
        this.message.set(e.error?.detail ?? "L'enregistrement des paramètres réalisés a échoué.");
      }
    });
  }

  /** Casse et accents ignorés : « Loic » retrouve « Loïc » sur un clavier qui ne les tape pas facilement. */
  private normaliser(texte: string): string {
    return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  }

  telechargerPdf(): void {
    this.exportEnCours.set(true);
    this.api.ficheSecuritePdf(this.seanceId).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const lien = document.createElement('a');
        lien.href = url;
        lien.download = `fiche-securite-${this.seance()?.date ?? this.seanceId}.pdf`;
        lien.click();
        URL.revokeObjectURL(url);
        this.exportEnCours.set(false);
      },
      error: () => {
        this.message.set('Le PDF n’a pas pu être généré.');
        this.exportEnCours.set(false);
      }
    });
  }

  telechargerExcel(): void {
    this.exportExcelEnCours.set(true);
    this.api.ficheSecuriteExcel(this.seanceId).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const lien = document.createElement('a');
        lien.href = url;
        lien.download = `fiche-securite-${this.seance()?.date ?? this.seanceId}.xlsx`;
        lien.click();
        URL.revokeObjectURL(url);
        this.exportExcelEnCours.set(false);
      },
      error: () => {
        this.message.set('Le fichier Excel n’a pas pu être généré.');
        this.exportExcelEnCours.set(false);
      }
    });
  }
}
