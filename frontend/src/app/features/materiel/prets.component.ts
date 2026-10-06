import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import {
  EmprunteurVue, EquipementVue, PretVue, SortieVue, TYPES_EQUIPEMENT, TypeEquipement
} from '../../core/modeles';
import { ComboboxComponent, OptionCombobox } from '../../core/combobox.component';
import { DateFrPipe, dateDuJour, periode } from '../../core/date-fr';
import { normaliser } from '../../core/seance-lieu';
import { descriptionEquipement } from './materiel';
import { PhotosPretComponent } from './photos-pret.component';
import { DialogueComponent } from '../../core/dialogue.component';

/** Élèves et encadrants partagent la même liste : ids pairs pour les élèves, impairs pour les encadrants. */
function cleEmprunteur(e: EmprunteurVue): number {
  return e.type === 'ELEVE' ? e.id * 2 : e.id * 2 + 1;
}

interface LigneRetour { incident: string; horsService: boolean; }

/**
 * Prêts de matériel pour les sorties : nouveau prêt, prêts en cours avec
 * leur retour, historique. Le serveur vérifie chaque équipement (déjà
 * prêté, hors échéance jusqu'au retour prévu, hors service) et la
 * désinfection des détendeurs (art. A322-81).
 */
@Component({
  selector: 'app-prets',
  imports: [FormsModule, RouterLink, DateFrPipe, ComboboxComponent, PhotosPretComponent, DialogueComponent],
  template: `
    <a routerLink="/materiel" class="retour">← Matériel</a>
    <div class="entete">
      <h1>Prêts de matériel</h1>
      <button type="button" class="bouton-principal" (click)="ouvrirFormulaire()">Nouveau prêt</button>
    </div>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <app-dialogue [ouvert]="formulaireOuvert()" titre="Nouveau prêt" [large]="true" [erreur]="message()"
                  (fermer)="formulaireOuvert.set(false)">
      <form (ngSubmit)="preter()">

        <label for="emprunteur">Emprunteur *</label>
        <app-combobox idChamp="emprunteur" [options]="optionsEmprunteurs()" [(valeur)]="emprunteur"
                      aide="Rechercher un élève ou un encadrant…" texteVide="Personne ne correspond." />

        <label for="sortie">Sortie</label>
        <select id="sortie" name="sortie" [ngModel]="sortieId" (ngModelChange)="choisirSortie($event)">
          <option [ngValue]="null">Aucune (préciser le motif)</option>
          @for (s of sorties(); track s.id) {
            <option [ngValue]="s.id">{{ libelleSortie(s) }}</option>
          }
        </select>
        <p class="secondaire">
          Sortie absente de la liste ? <a routerLink="/admin/sorties">Gérer les sorties</a>
        </p>

        @if (sortieId === null) {
          <label for="motif">Motif</label>
          <input id="motif" name="motif" [(ngModel)]="motif" maxlength="120" placeholder="Sortie mer, stage, fosse…">
        }

        <div class="grille">
          <div>
            <label for="datePret">Date du prêt *</label>
            <input id="datePret" name="datePret" type="date" [(ngModel)]="datePret">
          </div>
          <div>
            <label for="retourPrevu">Retour prévu</label>
            <input id="retourPrevu" name="retourPrevu" type="date" [min]="datePret" [(ngModel)]="dateRetourPrevue">
          </div>
        </div>
        <p class="secondaire">
          Le matériel doit rester dans ses échéances (TIV, requalification…) jusqu'au retour prévu.
        </p>

        <fieldset>
          <legend>Matériel ({{ selection().size }} choisi{{ selection().size > 1 ? 's' : '' }})</legend>
          @if (choisis().length > 0) {
            <ul class="choisis">
              @for (e of choisis(); track e.id) {
                <li>
                  <span>{{ e.typeLibelle }} {{ e.reference }}@if (e.ancienneReference) { (ancien n° {{ e.ancienneReference }})}</span>
                  <button type="button" class="bouton-discret" (click)="basculer(e.id)"
                          [attr.aria-label]="'Retirer ' + e.reference">Retirer</button>
                </li>
              }
            </ul>
          }
          <div class="types" role="group" aria-label="Type de matériel">
            @for (t of types; track t.valeur) {
              <button type="button" class="bouton-discret" [class.actif]="typeChoix() === t.valeur"
                      (click)="typeChoix.set(t.valeur)">{{ t.pluriel }}</button>
            }
          </div>
          <label for="rechercheMateriel" class="masque">Rechercher du matériel</label>
          <input id="rechercheMateriel" name="rechercheMateriel" type="search" placeholder="Référence, ancien n°, taille, marque…"
                 [ngModel]="rechercheMateriel()" (ngModelChange)="rechercheMateriel.set($event)">
          <ul class="disponibles">
            @for (e of disponibles(); track e.id) {
              <li>
                <label class="case">
                  <input type="checkbox" [checked]="selection().has(e.id)" (change)="basculer(e.id)">
                  <span class="identite">
                    <strong>
                      {{ e.reference }}@if (e.ancienneReference) { <span class="ancien">· ancien n° {{ e.ancienneReference }}</span> }
                    </strong>
                    @if (description(e); as d) { <span class="secondaire">{{ d }}</span> }
                    @for (a of e.alertes; track a.message) { <span class="avertissement">{{ a.message }}</span> }
                  </span>
                </label>
              </li>
            } @empty {
              <li class="secondaire">Aucun équipement disponible de ce type.</li>
            }
          </ul>
          @if (indisponibles() > 0) {
            <p class="secondaire">
              {{ indisponibles() }} autre(s) non proposé(s) : déjà prêté, hors service ou à régulariser
              (voir l'<a routerLink="/materiel">inventaire</a>).
            </p>
          }
        </fieldset>

        @if (avecDetendeur()) {
          <label class="case important">
            <input type="checkbox" name="desinfectes" [(ngModel)]="detendeursDesinfectes">
            Les détendeurs ont été désinfectés avant remise (Code du sport, art. A322-81)
          </label>
        }

        <label for="remarquesPret">Remarques</label>
        <textarea id="remarquesPret" name="remarquesPret" rows="2" [(ngModel)]="remarques"></textarea>

        <div class="actions-dialogue">
          <button type="submit" class="bouton-principal" [disabled]="envoi()">
            {{ envoi() ? 'Enregistrement…' : 'Enregistrer le prêt' }}
          </button>
          <button type="button" class="bouton-discret" (click)="formulaireOuvert.set(false)">Annuler</button>
        </div>
      </form>
    </app-dialogue>

    <div class="onglets" role="tablist">
      <button type="button" role="tab" class="bouton-discret" [class.actif]="onglet() === 'EN_COURS'"
              [attr.aria-selected]="onglet() === 'EN_COURS'" (click)="onglet.set('EN_COURS')">
        En cours ({{ enCours().length }})
      </button>
      <button type="button" role="tab" class="bouton-discret" [class.actif]="onglet() === 'RENDUS'"
              [attr.aria-selected]="onglet() === 'RENDUS'" (click)="afficherRendus()">
        Rendus
      </button>
    </div>

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else {
      @let liste = onglet() === 'EN_COURS' ? enCours() : rendus();
      @if (liste.length === 0) {
        <div class="carte vide"><p>{{ onglet() === 'EN_COURS' ? 'Aucun prêt en cours.' : 'Aucun prêt rendu.' }}</p></div>
      } @else {
        <ul class="prets">
          @for (p of liste; track p.id) {
            <li class="carte">
              <div class="ligne">
                <div class="identite">
                  <span class="nom">{{ p.emprunteur }}</span>
                  <span class="secondaire">
                    @if (p.sortieId && p.sortieDebut) {
                      {{ p.sortieNom }} · {{ periode(p.sortieDebut, p.sortieFin) }}@if (p.sortieLieu) { · {{ p.sortieLieu }}}
                    }
                    @else if (p.motif) { {{ p.motif }} }
                  </span>
                </div>
                @if (p.enRetard) { <span class="etat retard">En retard</span> }
                @if (p.dateRetour) { <span class="etat rendu">Rendu</span> }
              </div>
              <p class="dates">
                Prêté le {{ p.datePret | dateFr }}@if (p.pretePar) { par {{ p.pretePar }}}
                @if (p.dateRetour) {
                  · rendu le {{ p.dateRetour | dateFr }}@if (p.recuPar) {, reçu par {{ p.recuPar }}}
                } @else if (p.dateRetourPrevue) {
                  · retour prévu le {{ p.dateRetourPrevue | dateFr }}
                }
              </p>
              <ul class="materiel-prete">
                @for (e of p.equipements; track e.id) {
                  <li>
                    <a [routerLink]="['/materiel', e.id]">{{ e.typeLibelle }} {{ e.reference }}</a>
                    @if (e.description) { <span class="secondaire"> · {{ e.description }}</span> }
                  </li>
                }
              </ul>
              @if (p.remarques) { <p class="texte-libre secondaire">{{ p.remarques }}</p> }

              @if (retourOuvert() !== p.id) {
                <button type="button" class="bouton-discret bouton-photos" (click)="basculerPhotos(p.id)"
                        [attr.aria-expanded]="photosOuvertes().has(p.id)">
                  Photos · avant {{ p.photosAvant }} · après {{ p.photosApres }}
                </button>
                @if (photosOuvertes().has(p.id)) {
                  <app-photos-pret class="galerie" [pret]="p" (nombres)="majNombres(p.id, $event)" />
                }
              }

              @if (!p.dateRetour) {
                  <div class="actions">
                    <button type="button" class="bouton-principal" (click)="ouvrirRetour(p)">Enregistrer le retour</button>
                    <button type="button" class="bouton-discret" (click)="annuler(p)">Annuler le prêt</button>
                  </div>
              }
            </li>
          }
        </ul>
      }
    }

    <app-dialogue [ouvert]="pretEnRetour() !== null" [erreur]="message()" (fermer)="retourOuvert.set(null)"
                  [titre]="'Retour du matériel de ' + (pretEnRetour()?.emprunteur ?? '')">
      @if (pretEnRetour(); as p) {
                    <label [for]="'dateRetour-' + p.id">Date de retour</label>
                    <input [id]="'dateRetour-' + p.id" type="date" [min]="p.datePret" [max]="aujourdhui"
                           [(ngModel)]="dateRetour">
                    @for (e of p.equipements; track e.id) {
                      <div class="retour-equipement">
                        <label [for]="'incident-' + e.id">{{ e.typeLibelle }} {{ e.reference }} : incident éventuel</label>
                        <input [id]="'incident-' + e.id" [(ngModel)]="lignesRetour[e.id].incident"
                               placeholder="Rien à signaler">
                        <label class="case">
                          <input type="checkbox" [(ngModel)]="lignesRetour[e.id].horsService">
                          Mettre hors service
                        </label>
                      </div>
                    }
                    <h3 class="titre-photos">Photos de l'état au retour</h3>
                    <app-photos-pret [pret]="p" (nombres)="majNombres(p.id, $event)" />
                    <label [for]="'remarquesRetour-' + p.id">Remarques</label>
                    <textarea [id]="'remarquesRetour-' + p.id" rows="2" [(ngModel)]="remarquesRetour"></textarea>
                    <div class="actions-dialogue">
                      <button type="button" class="bouton-principal" (click)="rendre(p)" [disabled]="envoi()">
                        {{ envoi() ? 'Enregistrement…' : 'Valider le retour' }}
                      </button>
                      <button type="button" class="bouton-discret" (click)="retourOuvert.set(null)">Annuler</button>
                    </div>
      }
    </app-dialogue>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .ancien { font-weight: 400; color: var(--craie); }
    .retour { display: inline-flex; align-items: center; min-height: 44px; margin-bottom: var(--pas); }
    .entete { display: flex; justify-content: space-between; align-items: center; gap: var(--pas-2); flex-wrap: wrap;
              margin-bottom: var(--pas-2); }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0 var(--pas-2); }
    fieldset { border: none; padding: 0; margin: var(--pas-2) 0 0; }
    legend { font-family: var(--font-titres); font-weight: 700; margin-bottom: var(--pas); }
    .case { display: flex; align-items: flex-start; gap: var(--pas); font-weight: 400; min-height: 44px; margin: 0; padding: var(--pas) 0; }
    .case input { width: auto; flex: none; margin-top: 4px; }
    .important { font-weight: 700; background: var(--en-cours-clair); padding: var(--pas) var(--pas-2);
                 border-radius: var(--r-s); margin-top: var(--pas-2); }
    .masque { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .types { display: flex; gap: var(--pas); flex-wrap: wrap; margin-bottom: var(--pas); }
    .types .actif, .onglets .actif { background: var(--profond); color: #fff; border-color: var(--profond); font-weight: 700; }
    .choisis { list-style: none; margin: 0 0 var(--pas-2); padding: 0; display: flex; gap: var(--pas); flex-wrap: wrap; }
    .choisis li { display: flex; align-items: center; gap: var(--pas); padding-left: var(--pas-2);
                  background: #E0F2FE; border-radius: var(--r-s); font-weight: 700; }
    .disponibles { list-style: none; margin: var(--pas) 0 0; padding: 0; max-height: 360px; overflow-y: auto;
                   border: 1px solid var(--trait); border-radius: var(--r-s); }
    .disponibles li { padding: 0 var(--pas-2); border-bottom: 1px solid var(--trait); }
    .disponibles li:last-child { border-bottom: none; }
    .identite { display: flex; flex-direction: column; gap: 2px; }
    .avertissement { color: var(--en-cours); font-size: .8125rem; }
    textarea { resize: vertical; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }

    .onglets { display: flex; gap: var(--pas); margin-bottom: var(--pas-2); }
    .prets { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2); }
    .prets > li { padding: var(--pas-2); }
    .ligne { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas); }
    .nom { font-weight: 700; }
    .etat { flex: none; padding: 2px 10px; border-radius: var(--r-s); font-size: .8125rem; font-weight: 700; }
    .retard { background: #FEE2E2; color: #B91C1C; }
    .rendu { background: #EEF2F4; color: var(--craie); }
    .dates { margin: var(--pas) 0; }
    .materiel-prete { margin: 0; padding-left: 1.25rem; display: grid; gap: 2px; }
    .texte-libre { white-space: pre-line; margin: var(--pas) 0 0; }
    .retour-equipement { border-top: 1px solid var(--trait); margin-top: var(--pas-2); }
    .bouton-photos { margin-top: var(--pas-2); }
    .galerie { margin-top: var(--pas); padding: var(--pas) var(--pas-2); background: var(--fond); border-radius: var(--r-s); }
    .titre-photos { margin: var(--pas-2) 0 0; padding-top: var(--pas-2); border-top: 1px solid var(--trait); font-size: 1rem; }
  `]
})
export class PretsComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  readonly types = TYPES_EQUIPEMENT;
  readonly description = descriptionEquipement;
  readonly aujourdhui = dateDuJour();

  onglet = signal<'EN_COURS' | 'RENDUS'>('EN_COURS');
  enCours = signal<PretVue[]>([]);
  rendus = signal<PretVue[]>([]);
  private rendusCharges = false;
  chargement = signal(true);
  message = signal<string | null>(null);
  envoi = signal(false);

  formulaireOuvert = signal(false);
  equipements = signal<EquipementVue[]>([]);
  emprunteurs = signal<EmprunteurVue[]>([]);
  sorties = signal<SortieVue[]>([]);

  emprunteur: number | null = null;
  sortieId: number | null = null;
  motif = '';
  datePret = dateDuJour();
  dateRetourPrevue = '';
  detendeursDesinfectes = false;
  remarques = '';
  selection = signal<Set<number>>(new Set());
  typeChoix = signal<TypeEquipement>('BLOC');
  rechercheMateriel = signal('');

  retourOuvert = signal<number | null>(null);
  pretEnRetour = computed(() => this.enCours().find(p => p.id === this.retourOuvert()) ?? null);
  photosOuvertes = signal<Set<number>>(new Set());
  dateRetour = dateDuJour();
  lignesRetour: Record<number, LigneRetour> = {};
  remarquesRetour = '';

  optionsEmprunteurs = computed<OptionCombobox[]>(() => this.emprunteurs().map(e => ({
    id: cleEmprunteur(e),
    libelle: e.nomComplet,
    detail: e.type === 'ELEVE' ? `Élève${e.precision ? ' · ' + e.precision : ''}` : `Encadrant${e.precision ? ' · ' + e.precision : ''}`
  })));

  private enService = computed(() => this.equipements().filter(e => e.statut !== 'REBUTE'));

  disponibles = computed(() => {
    const r = normaliser(this.rechercheMateriel().trim());
    return this.enService().filter(e => e.statut === 'DISPONIBLE' && e.type === this.typeChoix()
      && (!r || [e.reference, e.ancienneReference, e.marque, e.modele, e.taille].some(v => v != null && normaliser(v).includes(r))));
  });

  indisponibles = computed(() =>
    this.enService().filter(e => e.type === this.typeChoix() && e.statut !== 'DISPONIBLE').length);

  choisis = computed(() => this.equipements().filter(e => this.selection().has(e.id)));

  avecDetendeur = computed(() => this.choisis().some(e => e.type === 'DETENDEUR'));

  constructor() {
    void this.charger();
    const equipement = Number(this.route.snapshot.queryParamMap.get('equipement'));
    if (equipement) void this.ouvrirFormulaire(equipement);
  }

  readonly periode = periode;

  /** « Week-end à Blaisy · du 10/10/2026 au 11/10/2026 · 4 plongées ». */
  libelleSortie(s: SortieVue): string {
    return [s.nom, periode(s.dateDebut, s.dateFin),
      s.nombrePlongees ? `${s.nombrePlongees} plongée${s.nombrePlongees > 1 ? 's' : ''}` : null]
      .filter(Boolean).join(' · ');
  }

  /** Le matériel revient à la fin de la sortie : on le propose, modifiable. */
  choisirSortie(id: number | null): void {
    this.sortieId = id;
    const s = this.sorties().find(x => x.id === id);
    if (s && s.dateFin >= this.datePret) this.dateRetourPrevue = s.dateFin;
  }

  basculer(id: number): void {
    const s = new Set(this.selection());
    if (s.has(id)) s.delete(id); else s.add(id);
    this.selection.set(s);
  }

  async ouvrirFormulaire(equipementPreselectionne?: number): Promise<void> {
    this.message.set(null);
    this.formulaireOuvert.set(true);
    try {
      const [equipements, emprunteurs, sorties] = await Promise.all([
        firstValueFrom(this.api.equipements()),
        firstValueFrom(this.api.emprunteurs()),
        firstValueFrom(this.api.sorties(true))
      ]);
      this.equipements.set(equipements);
      this.emprunteurs.set(emprunteurs);
      this.sorties.set(sorties);
      const e = equipements.find(x => x.id === equipementPreselectionne);
      if (e) {
        this.selection.set(new Set([e.id]));
        this.typeChoix.set(e.type);
      }
    } catch {
      this.message.set('Impossible de charger le matériel et les emprunteurs.');
    }
  }

  preter(): void {
    const choisi = this.emprunteurs().find(e => cleEmprunteur(e) === this.emprunteur);
    if (!choisi) { this.message.set("Choisissez l'emprunteur."); return; }
    if (!this.datePret) { this.message.set('La date du prêt est obligatoire.'); return; }
    if (this.selection().size === 0) { this.message.set('Choisissez au moins un équipement.'); return; }
    this.envoi.set(true);
    this.message.set(null);
    this.api.preter({
      eleveId: choisi.type === 'ELEVE' ? choisi.id : null,
      utilisateurId: choisi.type === 'ENCADRANT' ? choisi.id : null,
      sortieId: this.sortieId,
      motif: this.sortieId === null ? (this.motif.trim() || null) : null,
      datePret: this.datePret,
      dateRetourPrevue: this.dateRetourPrevue || null,
      equipementIds: [...this.selection()],
      detendeursDesinfectes: this.detendeursDesinfectes,
      remarques: this.remarques.trim() || null
    }).subscribe({
      next: p => {
        this.envoi.set(false);
        this.enCours.set([p, ...this.enCours()]);
        this.onglet.set('EN_COURS');
        this.reinitialiserFormulaire();
        this.photosOuvertes.set(new Set([...this.photosOuvertes(), p.id]));
        this.message.set(`Prêt enregistré pour ${p.emprunteur}. Vous pouvez photographier le matériel avant de le remettre.`);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "Le prêt n'a pas pu être enregistré.");
      }
    });
  }

  basculerPhotos(id: number): void {
    const s = new Set(this.photosOuvertes());
    if (s.has(id)) s.delete(id); else s.add(id);
    this.photosOuvertes.set(s);
  }

  majNombres(id: number, n: { avant: number; apres: number }): void {
    const maj = (liste: PretVue[]) =>
      liste.map(x => x.id === id ? { ...x, photosAvant: n.avant, photosApres: n.apres } : x);
    this.enCours.set(maj(this.enCours()));
    this.rendus.set(maj(this.rendus()));
  }

  ouvrirRetour(p: PretVue): void {
    this.message.set(null);
    this.dateRetour = this.aujourdhui;
    this.remarquesRetour = '';
    this.lignesRetour = {};
    for (const e of p.equipements) this.lignesRetour[e.id] = { incident: '', horsService: false };
    this.retourOuvert.set(p.id);
  }

  rendre(p: PretVue): void {
    this.envoi.set(true);
    this.message.set(null);
    this.api.rendrePret(p.id, {
      dateRetour: this.dateRetour,
      equipements: p.equipements.map(e => ({
        equipementId: e.id,
        incident: this.lignesRetour[e.id]?.incident.trim() || null,
        horsService: !!this.lignesRetour[e.id]?.horsService
      })),
      remarques: this.remarquesRetour.trim() || null
    }).subscribe({
      next: rendu => {
        this.envoi.set(false);
        this.retourOuvert.set(null);
        this.enCours.set(this.enCours().filter(x => x.id !== rendu.id));
        this.rendus.set([rendu, ...this.rendus()]);
        this.message.set(`Retour de ${rendu.emprunteur} enregistré.`);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "Le retour n'a pas pu être enregistré.");
      }
    });
  }

  annuler(p: PretVue): void {
    if (!confirm(`Annuler le prêt à ${p.emprunteur} ? À réserver à une saisie par erreur.`)) return;
    this.api.annulerPret(p.id).subscribe({
      next: () => this.enCours.set(this.enCours().filter(x => x.id !== p.id)),
      error: (e: HttpErrorResponse) => this.message.set(e.error?.detail ?? "Le prêt n'a pas pu être annulé.")
    });
  }

  async afficherRendus(): Promise<void> {
    this.onglet.set('RENDUS');
    if (this.rendusCharges) return;
    try {
      this.rendus.set(await firstValueFrom(this.api.prets(false)));
      this.rendusCharges = true;
    } catch {
      this.message.set("Impossible de charger l'historique des prêts.");
    }
  }

  private reinitialiserFormulaire(): void {
    this.formulaireOuvert.set(false);
    this.emprunteur = null;
    this.sortieId = null;
    this.motif = '';
    this.datePret = dateDuJour();
    this.dateRetourPrevue = '';
    this.detendeursDesinfectes = false;
    this.remarques = '';
    this.selection.set(new Set());
    this.rechercheMateriel.set('');
  }

  private async charger(): Promise<void> {
    this.chargement.set(true);
    try {
      this.enCours.set(await firstValueFrom(this.api.prets(true)));
    } catch {
      this.message.set('Impossible de charger les prêts.');
    } finally {
      this.chargement.set(false);
    }
  }
}
