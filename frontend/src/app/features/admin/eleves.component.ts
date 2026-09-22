import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AdhesionVue, CursusVue, EleveVue, SaisonVue } from '../../core/modeles';
import { DateFrPipe } from '../../core/date-fr';

const STATUTS = ['EN_COURS', 'VALIDE', 'DELIVRE', 'SUSPENDU', 'ABANDON'] as const;

interface FormulaireEleve {
  nom: string;
  prenom: string;
  dateNaissance: string;
  numeroLicence: string;
  certificatValideJusquAu: string;
  dernierNiveau: string;
  autorisationLegale: boolean;
}

function formulaireVide(): FormulaireEleve {
  return { nom: '', prenom: '', dateNaissance: '', numeroLicence: '',
           certificatValideJusquAu: '', dernierNiveau: '', autorisationLegale: false };
}

function depuis(e: EleveVue): FormulaireEleve {
  return {
    nom: e.nom, prenom: e.prenom, dateNaissance: e.dateNaissance ?? '',
    numeroLicence: e.numeroLicence ?? '', certificatValideJusquAu: e.certificatValideJusquAu ?? '',
    dernierNiveau: e.dernierNiveau ?? '', autorisationLegale: e.autorisationLegale
  };
}

function trier(eleves: EleveVue[]): EleveVue[] {
  return eleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
}

@Component({
  selector: 'app-eleves',
  imports: [FormsModule, DateFrPipe],
  template: `
    <h1>Élèves</h1>
    <p class="secondaire">Dossier, autorisation de pratiquer, droit à l'image et photo.</p>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <section class="carte panneau">
      <h2>Ajouter un élève</h2>
      @if (formulaireCreation(); as f) {
        <label for="prenom">Prénom</label>
        <input id="prenom" type="text" name="prenom" [(ngModel)]="f.prenom">
        <label for="nom">Nom</label>
        <input id="nom" type="text" name="nom" [(ngModel)]="f.nom">
        <label for="naissance">Date de naissance</label>
        <input id="naissance" type="date" name="naissance" [(ngModel)]="f.dateNaissance">
        <label for="licence">N° de licence</label>
        <input id="licence" type="text" name="licence" [(ngModel)]="f.numeroLicence" placeholder="Facultatif">
        <label for="caci">CACI valide jusqu'au</label>
        <input id="caci" type="date" name="caci" [(ngModel)]="f.certificatValideJusquAu">
        <label for="niveau">Dernier niveau de plongée</label>
        <input id="niveau" type="text" name="niveau" [(ngModel)]="f.dernierNiveau"
               placeholder="Facultatif, ex. N2 — si obtenu avant l'outil ou dans un autre club">
        <label class="case">
          <input type="checkbox" name="autorisationLegale" [(ngModel)]="f.autorisationLegale">
          Autorisation du responsable légal recueillie
        </label>
        <button type="button" class="bouton-principal" (click)="creer()" [disabled]="envoi()">
          {{ envoi() ? 'Création…' : "Ajouter l'élève" }}
        </button>
      }
    </section>

    <section class="filtres">
      <div>
        <label for="filtre-nom">Rechercher un élève</label>
        <input id="filtre-nom" type="search" name="filtreNom" placeholder="Nom ou prénom"
               [ngModel]="filtreNom()" (ngModelChange)="filtreNom.set($event)">
      </div>
      <div>
        <label for="filtre-saison">Saison</label>
        <select id="filtre-saison" name="filtreSaison" [ngModel]="filtreSaisonId()"
                (ngModelChange)="changerSaison($event)">
          @for (s of saisons(); track s.id) {
            <option [ngValue]="s.id">{{ s.libelle }}{{ s.ouverte ? ' (en cours)' : '' }}</option>
          }
        </select>
      </div>
      <div>
        <label for="filtre-statut">Statut de l'inscription</label>
        <select id="filtre-statut" name="filtreStatut" [ngModel]="filtreStatut()"
                (ngModelChange)="filtreStatut.set($event)">
          <option value="TOUS">Tous</option>
          <option value="NON_INSCRIT">Sans rattachement à la saison</option>
          @for (s of statuts; track s) { <option [value]="s">{{ s }}</option> }
        </select>
      </div>
    </section>

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (liste().length === 0) {
      <div class="carte vide"><p>Aucun élève enregistré.</p></div>
    } @else if (listeFiltree().length === 0) {
      <div class="carte vide"><p>Aucun élève ne correspond aux filtres.</p></div>
    } @else {
      <ul>
        @for (e of listeFiltree(); track e.id) {
          <li class="carte">
            @if (edition() === e.id) {
              @if (formulaireEdition(); as f) {
                <label [for]="'prenom-' + e.id">Prénom</label>
                <input [id]="'prenom-' + e.id" type="text" name="prenom" [(ngModel)]="f.prenom">
                <label [for]="'nom-' + e.id">Nom</label>
                <input [id]="'nom-' + e.id" type="text" name="nom" [(ngModel)]="f.nom">
                <label [for]="'naissance-' + e.id">Date de naissance</label>
                <input [id]="'naissance-' + e.id" type="date" name="naissance" [(ngModel)]="f.dateNaissance">
                <label [for]="'licence-' + e.id">N° de licence</label>
                <input [id]="'licence-' + e.id" type="text" name="licence" [(ngModel)]="f.numeroLicence">
                <label [for]="'caci-' + e.id">CACI valide jusqu'au</label>
                <input [id]="'caci-' + e.id" type="date" name="caci" [(ngModel)]="f.certificatValideJusquAu">
                <label [for]="'niveau-' + e.id">Dernier niveau de plongée</label>
                <input [id]="'niveau-' + e.id" type="text" name="niveau" [(ngModel)]="f.dernierNiveau"
                       placeholder="Facultatif, ex. N2 — si obtenu avant l'outil ou dans un autre club">
                <label class="case">
                  <input type="checkbox" name="autorisationLegale" [(ngModel)]="f.autorisationLegale">
                  Autorisation du responsable légal recueillie
                </label>
                <div class="actions">
                  <button type="button" class="bouton-principal" (click)="enregistrer(e)" [disabled]="envoi()">
                    {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
                  </button>
                  <button type="button" class="bouton-discret" (click)="annulerEdition()">Annuler</button>
                </div>
              }
            } @else {
              <div class="ligne">
                <div class="identite">
                  <span class="nom">{{ e.prenom }} {{ e.nom }}</span>
                  <span class="secondaire">
                    {{ e.numeroLicence ? 'Licence ' + e.numeroLicence : 'Sans licence' }}
                    · CACI {{ e.certificatValideJusquAu ? (e.certificatValideJusquAu | dateFr) : 'non renseigné' }}
                  </span>
                  <span class="secondaire">
                    Autorisation légale {{ e.autorisationLegale ? 'recueillie' : 'manquante' }}
                    · Droit à l'image {{ e.autorisationImage ? 'recueilli' : 'non recueilli' }}
                  </span>
                  @if (filtreSaisonId(); as saisonId) {
                    <span class="secondaire">
                      @if (adhesionDe(e); as a) {
                        Adhésion sans formation pour {{ saisonLibelle(saisonId) }}
                      } @else if (!aCursus(e)) {
                        Pas de rattachement à {{ saisonLibelle(saisonId) }}
                      }
                    </span>
                  }
                </div>
              </div>

              <div class="actions">
                <button type="button" class="bouton-discret" (click)="commencerEdition(e)">Modifier</button>
                <button type="button" class="bouton-discret" (click)="changerAutorisationImage(e)">
                  {{ e.autorisationImage ? "Retirer le droit à l'image" : "Recueillir le droit à l'image" }}
                </button>
                @if (e.autorisationImage) {
                  <label class="bouton-discret upload">
                    Déposer une photo
                    <input type="file" accept="image/jpeg,image/png" hidden
                           (change)="deposerPhoto(e, $event)">
                  </label>
                }
                @if (filtreSaisonId() && !aCursus(e)) {
                  @if (adhesionDe(e); as a) {
                    <button type="button" class="bouton-discret" (click)="retirerDeLaSaison(a)">
                      Retirer de la saison
                    </button>
                  } @else {
                    <button type="button" class="bouton-discret" (click)="ajouterALaSaison(e)"
                            [disabled]="envoiAdhesion() === e.id">
                      {{ envoiAdhesion() === e.id ? 'Ajout…' : 'Ajouter à la saison (sans formation)' }}
                    </button>
                  }
                }
                <button type="button" class="bouton-discret" (click)="basculerHistorique(e)">
                  {{ historiqueOuvert() === e.id ? 'Masquer l’historique' : 'Historique des saisons' }}
                </button>
                <button type="button" class="bouton-discret danger" (click)="archiver(e)">Archiver</button>
              </div>

              @if (historiqueOuvert() === e.id) {
                <div class="historique">
                  @if (chargementHistorique()) {
                    <p class="secondaire">Chargement…</p>
                  } @else if ((historique() ?? []).length === 0) {
                    <p class="secondaire">
                      Aucune adhésion sans formation enregistrée pour cet élève (une formation en cours
                      figure dans l'écran Inscriptions).
                    </p>
                  } @else {
                    <ul class="saisons">
                      @for (a of historique(); track a.id) {
                        <li>{{ a.saison }} <span class="secondaire">— depuis le {{ a.adhereLe | dateFr }}</span></li>
                      }
                    </ul>
                  }
                </div>
              }
            }
          </li>
        }
      </ul>
    }

    <section class="archives">
      <button type="button" class="bouton-discret" (click)="basculerArchives()">
        {{ archivesOuvertes() ? 'Masquer les élèves archivés' : 'Afficher les élèves archivés' }}
      </button>

      @if (archivesOuvertes()) {
        @if (archives() === null) {
          <p class="secondaire">Chargement…</p>
        } @else if (archives()!.length === 0) {
          <div class="carte vide"><p>Aucun élève archivé.</p></div>
        } @else {
          <p class="secondaire">
            La suppression est définitive : elle efface aussi les formations, évaluations,
            compétences validées et brevets délivrés de l'élève. Les fiches de sécurité
            gardent son nom.
          </p>
          <ul>
            @for (e of archives(); track e.id) {
              <li class="carte">
                <span class="nom">{{ e.prenom }} {{ e.nom }}</span>
                <span class="secondaire">
                  {{ e.numeroLicence ? 'Licence ' + e.numeroLicence : '' }}
                </span>
                <div class="actions">
                  <button type="button" class="bouton-discret" (click)="desarchiver(e)">Désarchiver</button>
                  <button type="button" class="bouton-discret danger" (click)="supprimer(e)"
                          [disabled]="suppressionEnCours() === e.id">
                    {{ suppressionEnCours() === e.id ? 'Suppression…' : 'Supprimer définitivement' }}
                  </button>
                </div>
              </li>
            }
          </ul>
        }
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .panneau { max-width: 480px; padding: var(--pas-3); margin: var(--pas-3) 0; }
    .panneau h2 { margin-bottom: 4px; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .case { display: flex; align-items: center; gap: var(--pas); font-weight: 400; }
    .case input { width: auto; }
    .bouton-principal { width: 100%; margin-top: var(--pas-3); }

    .filtres {
      display: flex; flex-wrap: wrap; gap: var(--pas-2) var(--pas-3); align-items: flex-end;
      margin-bottom: var(--pas-2);
    }
    .filtres > div { min-width: 220px; flex: 1 1 220px; }
    .filtres label { margin: 0 0 4px; }
    .filtres input, .filtres select { margin: 0; }

    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2); }
    li { padding: var(--pas-2); }
    .ligne { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas-2); }
    .identite { display: flex; flex-direction: column; gap: 2px; }
    .nom { font-weight: 700; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }
    .actions .bouton-principal { width: auto; margin-top: 0; }
    .upload { cursor: pointer; }
    .danger { color: #B3261E; border-color: #B3261E; }
    .historique {
      margin-top: var(--pas); padding: var(--pas-2); border-radius: var(--r-s); background: var(--fond);
    }
    .archives { margin-top: var(--pas-4); display: grid; gap: var(--pas-2); }
    .archives > .bouton-discret { justify-self: start; }
    .saisons { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }

    @media (max-width: 600px) {
      .ligne { flex-direction: column; }
    }
  `]
})
export class ElevesComponent {
  private api = inject(ApiService);

  readonly statuts = STATUTS;

  liste = signal<EleveVue[]>([]);
  saisons = signal<SaisonVue[]>([]);
  cursusDeLaSaison = signal<CursusVue[]>([]);
  adhesionsDeLaSaison = signal<AdhesionVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  envoi = signal(false);
  envoiAdhesion = signal<number | null>(null);

  archivesOuvertes = signal(false);
  archives = signal<EleveVue[] | null>(null);
  suppressionEnCours = signal<number | null>(null);

  historiqueOuvert = signal<number | null>(null);
  chargementHistorique = signal(false);
  historique = signal<AdhesionVue[] | null>(null);

  filtreNom = signal('');
  filtreSaisonId = signal<number | null>(null);
  filtreStatut = signal('TOUS');

  /**
   * Un élève ne porte pas de saison ni de statut en propre : on croise avec ses
   * cursus (inscriptions) dans la saison choisie pour filtrer par statut.
   */
  listeFiltree = computed(() => {
    const recherche = this.filtreNom().trim().toLocaleLowerCase();
    const statut = this.filtreStatut();
    const cursusParEleve = new Map<number, CursusVue[]>();
    for (const c of this.cursusDeLaSaison()) {
      const liste = cursusParEleve.get(c.eleveId) ?? [];
      liste.push(c);
      cursusParEleve.set(c.eleveId, liste);
    }
    const adhesionsParEleve = new Map(this.adhesionsDeLaSaison().map(a => [a.eleveId, a]));
    return this.liste().filter(e => {
      if (recherche && !`${e.prenom} ${e.nom}`.toLocaleLowerCase().includes(recherche)) return false;
      if (statut === 'TOUS') return true;
      const cursus = cursusParEleve.get(e.id) ?? [];
      // Sans formation cette saison : compte comme rattaché s'il a une adhésion.
      if (statut === 'NON_INSCRIT') return cursus.length === 0 && !adhesionsParEleve.has(e.id);
      return cursus.some(c => c.statut === statut);
    });
  });

  aCursus(e: EleveVue): boolean {
    return this.cursusDeLaSaison().some(c => c.eleveId === e.id);
  }

  adhesionDe(e: EleveVue): AdhesionVue | null {
    return this.adhesionsDeLaSaison().find(a => a.eleveId === e.id) ?? null;
  }

  saisonLibelle(saisonId: number): string {
    return this.saisons().find(s => s.id === saisonId)?.libelle ?? '';
  }

  formulaireCreation = signal<FormulaireEleve>(formulaireVide());
  edition = signal<number | null>(null);
  formulaireEdition = signal<FormulaireEleve | null>(null);

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    this.chargement.set(true);
    try {
      const [liste, saisons] = await Promise.all([
        firstValueFrom(this.api.eleves()),
        firstValueFrom(this.api.saisons())
      ]);
      this.liste.set(liste);
      this.saisons.set(saisons);
      const saisonCourante = saisons.find(s => s.ouverte) ?? saisons[0] ?? null;
      if (saisonCourante) await this.changerSaison(saisonCourante.id);
    } catch {
      this.message.set('Impossible de charger la liste des élèves.');
    } finally {
      this.chargement.set(false);
    }
  }

  async changerSaison(saisonId: number): Promise<void> {
    this.filtreSaisonId.set(saisonId);
    try {
      const [cursus, adhesions] = await Promise.all([
        firstValueFrom(this.api.cursusDeLaSaison(saisonId)),
        firstValueFrom(this.api.adhesionsDeLaSaison(saisonId))
      ]);
      this.cursusDeLaSaison.set(cursus);
      this.adhesionsDeLaSaison.set(adhesions);
    } catch {
      this.message.set("Impossible de charger les inscriptions de cette saison.");
    }
  }

  /** Élève déjà breveté qui continue de plonger sans ouvrir de nouvelle formation. */
  ajouterALaSaison(e: EleveVue): void {
    const saisonId = this.filtreSaisonId();
    if (!saisonId) return;
    this.envoiAdhesion.set(e.id);
    this.message.set(null);
    this.api.adherer({ eleveId: e.id, saisonId }).subscribe({
      next: a => {
        this.envoiAdhesion.set(null);
        this.adhesionsDeLaSaison.set([...this.adhesionsDeLaSaison(), a]);
      },
      error: (err: HttpErrorResponse) => {
        this.envoiAdhesion.set(null);
        this.message.set(err.error?.detail ?? "L'ajout à la saison n'a pas pu être enregistré.");
      }
    });
  }

  retirerDeLaSaison(a: AdhesionVue): void {
    this.message.set(null);
    this.api.retirerAdhesion(a.id).subscribe({
      next: () => this.adhesionsDeLaSaison.set(this.adhesionsDeLaSaison().filter(x => x.id !== a.id)),
      error: (err: HttpErrorResponse) =>
        this.message.set(err.error?.detail ?? "Le retrait n'a pas pu être enregistré.")
    });
  }

  basculerHistorique(e: EleveVue): void {
    if (this.historiqueOuvert() === e.id) {
      this.historiqueOuvert.set(null);
      return;
    }
    this.historiqueOuvert.set(e.id);
    this.chargementHistorique.set(true);
    this.historique.set(null);
    this.api.historiqueAdhesions(e.id).subscribe({
      next: h => {
        this.chargementHistorique.set(false);
        this.historique.set(h);
      },
      error: () => {
        this.chargementHistorique.set(false);
        this.historique.set([]);
      }
    });
  }

  creer(): void {
    const f = this.formulaireCreation();
    if (!f.nom || !f.prenom) {
      this.message.set('Nom et prénom sont obligatoires.');
      return;
    }
    this.envoi.set(true);
    this.message.set(null);
    this.api.creerEleve({
      nom: f.nom, prenom: f.prenom, dateNaissance: f.dateNaissance || null,
      numeroLicence: f.numeroLicence || null, certificatValideJusquAu: f.certificatValideJusquAu || null,
      dernierNiveau: f.dernierNiveau || null, autorisationLegale: f.autorisationLegale
    }).subscribe({
      next: e => {
        this.envoi.set(false);
        this.liste.set([...this.liste(), e].sort((a, b) => a.nom.localeCompare(b.nom)));
        this.formulaireCreation.set(formulaireVide());
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(err.error?.detail ?? "L'ajout n'a pas pu être enregistré.");
      }
    });
  }

  commencerEdition(e: EleveVue): void {
    this.message.set(null);
    this.edition.set(e.id);
    this.formulaireEdition.set(depuis(e));
  }

  annulerEdition(): void {
    this.edition.set(null);
    this.formulaireEdition.set(null);
  }

  enregistrer(e: EleveVue): void {
    const f = this.formulaireEdition();
    if (!f) return;
    this.envoi.set(true);
    this.api.modifierEleve(e.id, {
      nom: f.nom, prenom: f.prenom, dateNaissance: f.dateNaissance || null,
      numeroLicence: f.numeroLicence || null, certificatValideJusquAu: f.certificatValideJusquAu || null,
      dernierNiveau: f.dernierNiveau || null, autorisationLegale: f.autorisationLegale
    }).subscribe({
      next: maj => {
        this.envoi.set(false);
        this.remplacer(maj);
        this.annulerEdition();
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(err.error?.detail ?? "La modification n'a pas pu être enregistrée.");
      }
    });
  }

  changerAutorisationImage(e: EleveVue): void {
    this.message.set(null);
    this.api.changerAutorisationImage(e.id, !e.autorisationImage).subscribe({
      next: () => this.remplacer({ ...e, autorisationImage: !e.autorisationImage }),
      error: (err: HttpErrorResponse) =>
        this.message.set(err.error?.detail ?? "L'action n'a pas pu être enregistrée.")
    });
  }

  deposerPhoto(e: EleveVue, evenement: Event): void {
    const fichier = (evenement.target as HTMLInputElement).files?.[0];
    if (!fichier) return;
    this.message.set(null);
    this.api.deposerPhotoEleve(e.id, fichier).subscribe({
      next: () => this.message.set(`Photo enregistrée pour ${e.prenom} ${e.nom}.`),
      error: (err: HttpErrorResponse) =>
        this.message.set(err.error?.detail ?? "La photo n'a pas pu être déposée.")
    });
  }

  archiver(e: EleveVue): void {
    if (!confirm(`Archiver ${e.prenom} ${e.nom} ? Il·elle disparaîtra des listes actives.`)) return;
    this.api.archiverEleve(e.id).subscribe({
      next: maj => {
        this.liste.set(this.liste().filter(x => x.id !== e.id));
        const archives = this.archives();
        if (archives) this.archives.set(trier([...archives, maj]));
      },
      error: (err: HttpErrorResponse) =>
        this.message.set(err.error?.detail ?? "L'archivage n'a pas pu être enregistré.")
    });
  }

  basculerArchives(): void {
    const ouvrir = !this.archivesOuvertes();
    this.archivesOuvertes.set(ouvrir);
    if (!ouvrir || this.archives() !== null) return;
    this.api.elevesArchives().subscribe({
      next: a => this.archives.set(a),
      error: () => {
        this.archives.set([]);
        this.message.set('Impossible de charger les élèves archivés.');
      }
    });
  }

  desarchiver(e: EleveVue): void {
    this.message.set(null);
    this.api.desarchiverEleve(e.id).subscribe({
      next: maj => {
        this.archives.set((this.archives() ?? []).filter(x => x.id !== e.id));
        this.liste.set(trier([...this.liste(), maj]));
      },
      error: (err: HttpErrorResponse) =>
        this.message.set(err.error?.detail ?? "Le désarchivage n'a pas pu être enregistré.")
    });
  }

  supprimer(e: EleveVue): void {
    if (!confirm(
      `Supprimer définitivement ${e.prenom} ${e.nom} ?\n\n` +
      `Ses formations, évaluations, compétences validées, brevets délivrés, présences et photo ` +
      `seront effacés. Cette action est irréversible.`)) return;
    this.suppressionEnCours.set(e.id);
    this.message.set(null);
    this.api.supprimerEleve(e.id).subscribe({
      next: () => {
        this.suppressionEnCours.set(null);
        this.archives.set((this.archives() ?? []).filter(x => x.id !== e.id));
        this.message.set(`${e.prenom} ${e.nom} a été supprimé·e définitivement.`);
      },
      error: (err: HttpErrorResponse) => {
        this.suppressionEnCours.set(null);
        this.message.set(err.error?.detail ?? "La suppression n'a pas pu être effectuée.");
      }
    });
  }

  private remplacer(maj: EleveVue): void {
    this.liste.set(this.liste().map(e => e.id === maj.id ? maj : e));
  }
}
