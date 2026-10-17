import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import {
  BilanEnvoiParametres, GroupePlongeursVue, MembreGroupeVue, MoniteurOptionVue, PlongeurConnuVue, SaisonVue, SortieVue
} from '../../core/modeles';
import { dateDuJour } from '../../core/date-fr';
import { normaliser } from '../../core/seance-lieu';
import { ComboboxComponent, OptionCombobox } from '../../core/combobox.component';
import { DialogueComponent } from '../../core/dialogue.component';

/** Une ligne de la liste en cours de saisie : `cle` la suit à l'écran (ajouts en tête, retraits). */
type LigneMembre = MembreGroupeVue & { cle: number };

let prochaineCle = 0;

function ligne(m: MembreGroupeVue): LigneMembre {
  return { ...m, cle: ++prochaineCle };
}

function membreVide(): LigneMembre {
  return ligne({ id: null, eleveId: null, utilisateurId: null, nom: '', prenom: '', aptitude: null, niveauEncadrement: null,
    qualificationPreparee: null });
}

/** Au-delà, un champ de recherche filtre la liste des plongeurs. */
const SEUIL_RECHERCHE = 6;

/**
 * Gestion des groupes nommés et réutilisables de plongeurs (typiquement composés
 * pour un séjour) : ils peuvent aussi être créés à la volée depuis une fiche de
 * sécurité (voir fiche-securite.component.ts), à partir des plongeurs déjà
 * saisis sur la fiche — cet écran est le seul à permettre l'édition complète
 * (nom, ajout/retrait de membres) une fois le groupe créé.
 *
 * Seuls le créateur de la liste et les organisateurs qu'il désigne la
 * modifient (V81, choix du club 2026) ; les autres encadrants la consultent.
 *
 * Ergonomie (demande du club, 2026) : une ligne courte par plongeur, détail
 * ouvert à la demande ; l'ajout est en haut de la fenêtre (un plongeur du club
 * se choisit d'un geste, champs pré-remplis ; un extérieur s'ouvre en tête de
 * liste) ; recherche dans la liste dès qu'elle s'allonge.
 */
@Component({
  selector: 'app-groupes',
  imports: [FormsModule, ComboboxComponent, DialogueComponent],
  template: `
    <h1>Groupes de plongeurs</h1>
    <p class="secondaire">
      Composez une fois la liste des plongeurs d'un séjour, puis reprenez-la dans chaque fiche de sécurité.
      Seuls le créateur d'une liste et les organisateurs qu'il désigne la modifient.
    </p>

    <div class="barre">
      <div class="champ-saison">
        <label for="saison">Saison</label>
        <select id="saison" name="saison" [ngModel]="saisonId()" (ngModelChange)="changerSaison($event)">
          @for (s of saisons(); track s.id) {
            <option [ngValue]="s.id">{{ s.libelle }}{{ s.ouverte ? ' (ouverte)' : '' }}</option>
          }
        </select>
      </div>
      <button type="button" class="bouton-principal" (click)="ouvrirCreation()">Nouveau groupe</button>
    </div>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (liste().length === 0) {
      <div class="carte vide"><p>Aucun groupe pour cette saison.</p></div>
    } @else {
      <ul class="groupes">
        @for (g of liste(); track g.id) {
          <li class="carte">
            <div class="identite">
              <span class="nom">{{ g.nom }}</span>
              <span class="secondaire">
                {{ g.membres.length }} plongeur{{ g.membres.length > 1 ? 's' : '' }}
                @if (g.membres.length > 0) { — {{ resume(g) }} }
              </span>
              <span class="secondaire organisateurs">
                @if (g.organisateurs.length) {
                  Organisé par
                  @for (o of g.organisateurs; track o.id) {
                    {{ $first ? '' : ($last ? ' et ' : ', ') }}<strong>{{ o.nomComplet }}</strong>@if (o.createur) { (créateur) }
                  }
                } @else {
                  Aucun organisateur : un administrateur peut en désigner un.
                }
                @if (!g.gere) { · lecture seule }
              </span>
              @if (sansEmail(g).length > 0) {
                <span class="secondaire">Sans e-mail : {{ sansEmail(g).join(', ') }}</span>
              }
            </div>
            <div class="actions">
              <button type="button" class="bouton-discret" (click)="ouvrirGroupe(g)">{{ g.gere ? 'Modifier' : 'Voir' }}</button>
              <button type="button" class="bouton-discret" (click)="ouvrirEnvoi(g)">Envoyer les paramètres par e-mail</button>
              @if (g.peutDesigner) {
                <button type="button" class="bouton-discret" (click)="ouvrirOrganisateurs(g)">Choisir les organisateurs</button>
              }
              @if (g.gere) {
                <button type="button" class="bouton-discret danger" (click)="supprimer(g)">Supprimer</button>
              }
            </div>
          </li>
        }
      </ul>
    }

    <!-- Création, modification ou lecture d'un groupe : une même fenêtre. -->
    <app-dialogue [ouvert]="editeurOuvert()" [large]="true" [erreur]="message()" (fermer)="fermerEditeur()"
                  [titre]="titreEditeur()">
      @if (editeurOuvert()) {
        @if (lectureSeule()) {
          <p class="secondaire">Lecture seule : seuls le créateur de la liste et les organisateurs qu'il a désignés la modifient.</p>
        } @else {
          <label for="nom-groupe">Nom du groupe</label>
          <input id="nom-groupe" type="text" name="nom-groupe" [(ngModel)]="nomGroupe"
                 placeholder="ex. Séjour Égypte mai 2026">

          <div class="ajout">
            <label for="ajout-connu">Ajouter un plongeur</label>
            <app-combobox idChamp="ajout-connu" [options]="optionsAjout()" [valeur]="choixAjout()"
                          (valeurChange)="ajouterConnu($event)"
                          aide="Rechercher un plongeur du club…" texteVide="Aucun plongeur du club ne correspond." />
            <button type="button" class="bouton-discret" (click)="ajouterExterieur()">+ Plongeur extérieur au club</button>
          </div>
        }

        <div class="titre-liste">
          <h3>{{ membres().length }} plongeur{{ membres().length > 1 ? 's' : '' }}</h3>
          @if (membres().length > seuilRecherche) {
            <input type="search" class="recherche" name="recherche" [ngModel]="recherche()"
                   (ngModelChange)="recherche.set($event)" placeholder="Chercher dans la liste…"
                   aria-label="Chercher un plongeur dans la liste">
          }
        </div>
        @if (membres().length === 0) {
          <p class="vide">Aucun plongeur pour l'instant : cherchez-en un du club ci-dessus, ou ajoutez un extérieur.</p>
        }
        <ul class="membres">
          @for (m of membresFiltres(); track m.cle) {
            <li [class.nouveau]="m.cle === dernierAjout()" [class.ouvert]="m.cle === enEdition()" [id]="'membre-' + m.cle">
              <div class="resume-membre">
                <div class="qui">
                  <strong>{{ m.prenom || '…' }} {{ m.nom }}</strong>
                  <span class="secondaire">{{ details(m) }}</span>
                </div>
                @if (!lectureSeule()) {
                  <button type="button" class="bouton-discret" (click)="basculerEdition(m)"
                          [attr.aria-expanded]="m.cle === enEdition()"
                          [attr.aria-label]="(m.cle === enEdition() ? 'Fermer le détail de ' : 'Modifier ') + m.prenom + ' ' + m.nom">
                    {{ m.cle === enEdition() ? 'OK' : 'Modifier' }}
                  </button>
                  <button type="button" class="bouton-discret danger" (click)="retirer(m)"
                          [attr.aria-label]="'Retirer ' + m.prenom + ' ' + m.nom">✕</button>
                }
              </div>
              @if (m.cle === enEdition()) {
                <div class="detail-membre">
                  @if (m.eleveId !== null || m.utilisateurId !== null) {
                    <p class="secondaire lien-dossier">
                      Plongeur du club (dossier lié).
                      <button type="button" class="bouton-discret" (click)="delier(m)">Saisie libre</button>
                    </p>
                  }
                  <div class="grille">
                    <div>
                      <label [for]="'prenom-' + m.cle">Prénom</label>
                      <input [id]="'prenom-' + m.cle" type="text" [(ngModel)]="m.prenom" [name]="'prenom-' + m.cle">
                    </div>
                    <div>
                      <label [for]="'nom-' + m.cle">Nom</label>
                      <input [id]="'nom-' + m.cle" type="text" [(ngModel)]="m.nom" [name]="'nom-' + m.cle">
                    </div>
                    <div>
                      <label [for]="'aptitude-' + m.cle">Niveau de plongeur</label>
                      <input [id]="'aptitude-' + m.cle" type="text" placeholder="ex. N2, PE40, N4" [(ngModel)]="m.aptitude"
                             [name]="'aptitude-' + m.cle">
                    </div>
                    <div>
                      <label [for]="'encadrement-' + m.cle">Niveau d'encadrement</label>
                      <input [id]="'encadrement-' + m.cle" type="text" placeholder="ex. E1, E2, MF1"
                             [(ngModel)]="m.niveauEncadrement" [name]="'encadrement-' + m.cle">
                    </div>
                    <div>
                      <label [for]="'qualif-' + m.cle">Niveau préparé</label>
                      <input [id]="'qualif-' + m.cle" type="text" placeholder="ex. N3, E3" [(ngModel)]="m.qualificationPreparee"
                             [name]="'qualif-' + m.cle">
                    </div>
                    <div class="large">
                      <label [for]="'email-' + m.cle">E-mail</label>
                      <input [id]="'email-' + m.cle" type="email" [placeholder]="placeholderEmail(m)" [(ngModel)]="m.email"
                             [name]="'email-' + m.cle" autocomplete="off">
                    </div>
                  </div>
                </div>
              }
            </li>
          } @empty {
            @if (membres().length > 0) { <li class="vide">Personne ne correspond à « {{ recherche() }} ».</li> }
          }
        </ul>

        <div class="actions-dialogue">
          @if (lectureSeule()) {
            <button type="button" class="bouton-discret" (click)="fermerEditeur()">Fermer</button>
          } @else {
            <button type="button" class="bouton-principal" [disabled]="envoi()" (click)="enregistrer()">
              {{ envoi() ? 'Enregistrement…' : (editeurId() === null ? 'Créer le groupe' : 'Enregistrer') }}
            </button>
            <button type="button" class="bouton-discret" (click)="fermerEditeur()">Annuler</button>
          }
        </div>
      }
    </app-dialogue>

    <app-dialogue [ouvert]="groupeOrganisateurs() !== null" [erreur]="message()" titre="Organisateurs du groupe"
                  (fermer)="organisateursOuverts.set(null)">
      @if (groupeOrganisateurs(); as g) {
        <p class="secondaire">
          Les organisateurs modifient « {{ g.nom }} » avec son créateur : nom, plongeurs, suppression.
          Les autres moniteurs la consultent et la reprennent dans leurs fiches de sécurité.
        </p>
        @if (candidats().length === 0) { <p class="secondaire">Chargement des moniteurs…</p> }
        @for (m of candidats(); track m.id) {
          <label class="case" [class.indisponible]="estCreateur(g, m.id)">
            <input type="checkbox" [checked]="estCreateur(g, m.id) || organisateursChoisis().has(m.id)"
                   [disabled]="estCreateur(g, m.id)" (change)="basculerOrganisateur(m.id)" />
            {{ m.nomComplet }}@if (estCreateur(g, m.id)) { (créateur, toujours organisateur) }
          </label>
        }
        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" [disabled]="envoi()" (click)="enregistrerOrganisateurs(g)">Enregistrer</button>
          <button type="button" class="bouton-discret" (click)="organisateursOuverts.set(null)">Annuler</button>
        </div>
      }
    </app-dialogue>

    <app-dialogue [ouvert]="groupeEnvoi() !== null" titre="Envoyer les paramètres par e-mail" [erreur]="message()"
                  (fermer)="envoiOuvert.set(null)">
      @if (groupeEnvoi(); as g) {
        <p class="secondaire">
          En fin de séjour : chaque plongeur du groupe reçoit un e-mail avec ses seules plongées de la
          sortie (date, site, profondeur, durée, heures, paliers et membres de sa palanquée), relevées
          sur les fiches de sécurité.
        </p>
        <p class="secondaire">Groupe « {{ g.nom }} ».</p>
        <label for="sortie-envoi">Sortie</label>
        <select id="sortie-envoi" [(ngModel)]="sortieChoisie" name="sortie-envoi">
          <option [ngValue]="null" disabled>Choisir la sortie…</option>
          @for (s of sorties(); track s.id) {
            <option [ngValue]="s.id">{{ s.nom }} ({{ s.nombrePlongees }} plongée{{ s.nombrePlongees > 1 ? 's' : '' }})</option>
          }
        </select>
        @if (sorties().length === 0) {
          <p class="vide">Aucune sortie récente : la sortie se crée dans « Sorties » (administration).</p>
        }
        @if (bilan(); as b) {
          <div class="alerte" role="status">
            @if (b.envoyes.length > 0) {
              <p>E-mail envoyé à {{ b.envoyes.length }} plongeur{{ b.envoyes.length > 1 ? 's' : '' }} :
                {{ libellesEnvoyes(b) }}.</p>
            } @else {
              <p>Aucun e-mail envoyé.</p>
            }
            @if (b.sansEmail.length > 0) { <p>Sans e-mail, rien envoyé : {{ b.sansEmail.join(', ') }}.</p> }
            @if (b.sansPlongee.length > 0) {
              <p>Dans aucune palanquée de la sortie : {{ b.sansPlongee.join(', ') }}.</p>
            }
            @if (b.echecs.length > 0) { <p>Échec de l'envoi : {{ b.echecs.join(', ') }}.</p> }
          </div>
        }
        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" [disabled]="envoiEmails() || sortieChoisie === null"
                  (click)="envoyerParametres(g)">
            {{ envoiEmails() ? 'Envoi…' : 'Envoyer les e-mails' }}
          </button>
          <button type="button" class="bouton-discret" (click)="envoiOuvert.set(null)">Fermer</button>
        </div>
      }
    </app-dialogue>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .barre { display: flex; gap: var(--pas-2); align-items: flex-end; flex-wrap: wrap; margin-bottom: var(--pas-2); }
    .champ-saison { flex: 0 1 320px; }
    .champ-saison select { margin: 0; }

    .danger { color: #B3261E; border-color: #B3261E; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }

    .groupes { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2); }
    .groupes > li { padding: var(--pas-2); }
    .identite { display: flex; flex-direction: column; gap: 2px; }
    .nom { font-weight: 700; }
    .alerte p { margin: 2px 0; }

    .ajout { display: grid; gap: var(--pas); padding: var(--pas-2); margin: var(--pas-2) 0;
             background: var(--fond); border-radius: var(--r-s); }
    .ajout label { margin: 0; }
    .ajout > button { justify-self: start; }

    .titre-liste { display: flex; justify-content: space-between; align-items: center; gap: var(--pas-2); flex-wrap: wrap;
                   margin-top: var(--pas-2); }
    .titre-liste h3 { margin: 0; font-size: 1rem; }
    .recherche { flex: 0 1 260px; margin: 0; }

    .membres { list-style: none; margin: var(--pas) 0 0; padding: 0; display: grid; gap: 4px; }
    .membres > li { border: 1px solid var(--trait); border-radius: var(--r-s); padding: 4px var(--pas) 4px var(--pas-2);
                    background: var(--carte); }
    .membres > li.ouvert { border-color: var(--profond); }
    .membres > li.nouveau { animation: arrivee 1.6s ease-out; }
    @keyframes arrivee { from { background: var(--accent-clair); } to { background: var(--carte); } }
    .resume-membre { display: flex; align-items: center; gap: var(--pas); min-height: 44px; }
    .qui { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .qui .secondaire { font-size: .875rem; overflow-wrap: anywhere; }
    .detail-membre { padding: var(--pas) 0 var(--pas); }
    .detail-membre label { margin: var(--pas) 0 4px; font-size: .875rem; }
    .detail-membre input { margin: 0; }
    .grille { display: grid; grid-template-columns: 1fr 1fr; gap: 0 var(--pas-2); }
    .grille .large { grid-column: 1 / -1; }
    .lien-dossier { margin: 0; display: flex; align-items: center; gap: var(--pas); flex-wrap: wrap; }

    .case { display: flex; align-items: center; gap: var(--pas); font-weight: 400; min-height: 44px; margin: 0; }
    .case input { width: auto; flex: none; }
    .case.indisponible { color: var(--craie); }

    @media (max-width: 600px) {
      .grille { grid-template-columns: 1fr; }
    }
  `]
})
export class GroupesComponent {
  private api = inject(ApiService);
  readonly seuilRecherche = SEUIL_RECHERCHE;

  saisons = signal<SaisonVue[]>([]);
  saisonId = signal<number | null>(null);
  plongeursConnus = signal<PlongeurConnuVue[]>([]);

  liste = signal<GroupePlongeursVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  envoi = signal(false);

  // ---- Fenêtre d'un groupe (création, modification, lecture) ----
  editeurOuvert = signal(false);
  /** Id du groupe ouvert ; null : nouveau groupe. */
  editeurId = signal<number | null>(null);
  lectureSeule = signal(false);
  nomGroupe = '';
  membres = signal<LigneMembre[]>([]);
  /** Ligne dont le détail est ouvert. */
  enEdition = signal<number | null>(null);
  /** Ligne ajoutée à l'instant, mise en évidence. */
  dernierAjout = signal<number | null>(null);
  recherche = signal('');
  /** Le choix du champ d'ajout : remis à vide juste après l'ajout. */
  choixAjout = signal<number | null>(null);

  titreEditeur = computed(() => {
    if (this.editeurId() === null) return 'Nouveau groupe';
    const g = this.liste().find(x => x.id === this.editeurId());
    return this.lectureSeule() ? `« ${g?.nom ?? ''} »` : `Modifier « ${g?.nom ?? ''} »`;
  });

  membresFiltres = computed(() => {
    const r = normaliser(this.recherche().trim());
    if (!r || this.membres().length <= SEUIL_RECHERCHE) return this.membres();
    return this.membres().filter(m => m.cle === this.enEdition()
      || normaliser(`${m.prenom} ${m.nom} ${m.aptitude ?? ''} ${m.niveauEncadrement ?? ''}`).includes(r));
  });

  // ---- Organisateurs ----
  organisateursOuverts = signal<number | null>(null);
  groupeOrganisateurs = computed(() => this.liste().find(g => g.id === this.organisateursOuverts()) ?? null);
  candidats = signal<MoniteurOptionVue[]>([]);
  organisateursChoisis = signal<Set<number>>(new Set());

  // ---- Envoi des paramètres ----
  /** Groupe dont le panneau d'envoi des paramètres par e-mail est ouvert. */
  envoiOuvert = signal<number | null>(null);
  groupeEnvoi = computed(() => this.liste().find(g => g.id === this.envoiOuvert()) ?? null);
  sorties = signal<SortieVue[]>([]);
  sortieChoisie: number | null = null;
  envoiEmails = signal(false);
  bilan = signal<BilanEnvoiParametres | null>(null);

  constructor() {
    void this.initialiser();
  }

  /** « Anis Ferry, Béa Morel et 4 autres ». */
  resume(g: GroupePlongeursVue): string {
    const noms = g.membres.map(m => `${m.prenom} ${m.nom}`);
    return noms.length <= 4 ? noms.join(', ') : `${noms.slice(0, 3).join(', ')} et ${noms.length - 3} autres`;
  }

  /** « N4 · encadrant E1 · prépare E2 · anis@exemple.fr » ; l'e-mail du dossier entre parenthèses. */
  details(m: MembreGroupeVue): string {
    const email = m.email ? m.email : m.emailDossier ? `${m.emailDossier} (dossier)` : 'sans e-mail';
    return [m.aptitude, m.niveauEncadrement ? `encadrant ${m.niveauEncadrement}` : null,
      m.qualificationPreparee ? `prépare ${m.qualificationPreparee}` : null, email]
      .filter(Boolean).join(' · ');
  }

  /** L'e-mail du dossier en indication : vide, c'est lui qui sert à l'envoi. */
  placeholderEmail(m: MembreGroupeVue): string {
    if (m.emailDossier) return `Vide : ${m.emailDossier} (dossier)`;
    return m.eleveId !== null || m.utilisateurId !== null ? 'Vide : celui du dossier' : 'E-mail';
  }

  sansEmail(g: GroupePlongeursVue): string[] {
    return g.membres.filter(m => !m.email && !m.emailDossier).map(m => `${m.prenom} ${m.nom}`);
  }

  libellesEnvoyes(b: BilanEnvoiParametres): string {
    return b.envoyes.map(d => `${d.nom} (${d.nombrePlongees} plongée${d.nombrePlongees > 1 ? 's' : ''})`).join(', ');
  }

  private async initialiser(): Promise<void> {
    try {
      const [saisons, plongeursConnus] = await Promise.all([
        firstValueFrom(this.api.saisons()),
        this.api.plongeursConnus()
      ]);
      this.saisons.set(saisons);
      this.plongeursConnus.set(plongeursConnus);
      const saisonOuverte = saisons.find(s => s.ouverte) ?? saisons[0] ?? null;
      if (saisonOuverte) {
        this.saisonId.set(saisonOuverte.id);
        await this.chargerGroupes(saisonOuverte.id);
      } else {
        this.chargement.set(false);
      }
    } catch {
      this.message.set('Impossible de charger les saisons.');
      this.chargement.set(false);
    }
  }

  private async chargerGroupes(saisonId: number): Promise<void> {
    this.chargement.set(true);
    try {
      this.liste.set(await this.api.groupesPlongeurs(saisonId));
    } catch {
      this.message.set('Impossible de charger les groupes.');
    } finally {
      this.chargement.set(false);
    }
  }

  changerSaison(saisonId: number): void {
    this.saisonId.set(saisonId);
    this.fermerEditeur();
    void this.chargerGroupes(saisonId);
  }

  // ---------------- Fenêtre d'un groupe ----------------

  ouvrirCreation(): void {
    this.preparerEditeur(null, '', [], false);
  }

  ouvrirGroupe(g: GroupePlongeursVue): void {
    this.preparerEditeur(g.id, g.nom, g.membres, !g.gere);
  }

  private preparerEditeur(id: number | null, nom: string, membres: MembreGroupeVue[], lecture: boolean): void {
    this.message.set(null);
    this.editeurId.set(id);
    this.nomGroupe = nom;
    this.membres.set(membres.map(ligne));
    this.lectureSeule.set(lecture);
    this.enEdition.set(null);
    this.dernierAjout.set(null);
    this.recherche.set('');
    this.editeurOuvert.set(true);
  }

  fermerEditeur(): void {
    this.editeurOuvert.set(false);
  }

  /**
   * Plongeurs du club proposés à l'ajout, sauf ceux déjà dans la liste ; l'id
   * d'une option est sa position dans `plongeursConnus` (élèves et encadrants
   * ont chacun leur propre numérotation d'id). Le détail donne niveau, niveau
   * en préparation et niveau d'encadrement.
   */
  optionsAjout = computed<OptionCombobox[]>(() => {
    const deja = this.membres();
    return this.plongeursConnus().flatMap((c, i) => deja.some(m => this.memeDossier(m, c)) ? [] : [{
      id: i,
      libelle: `${c.prenom} ${c.nom}`,
      detail: [
        `Niveau ${c.niveau ?? 'non renseigné'}`,
        c.niveauPreparation ? `en préparation ${c.niveauPreparation}` : null,
        c.niveauEncadrement ? `encadrant ${c.niveauEncadrement}` : null
      ].filter(Boolean).join(' · ')
    }]);
  });

  private memeDossier(m: MembreGroupeVue, c: PlongeurConnuVue): boolean {
    return (m.eleveId !== null && c.eleveId === m.eleveId) || (m.utilisateurId !== null && c.utilisateurId === m.utilisateurId);
  }

  /**
   * Un plongeur du club choisi : ajouté en tête, pré-rempli depuis son dossier
   * (niveau de plongeur, niveau d'encadrement et niveau préparé, chacun à sa
   * place) ; le champ se vide pour le suivant.
   */
  ajouterConnu(choix: number | null): void {
    this.choixAjout.set(choix);
    const c = choix === null ? null : this.plongeursConnus()[choix];
    if (!c) return;
    const nouveau = ligne({
      id: null, eleveId: c.eleveId, utilisateurId: c.utilisateurId, nom: c.nom, prenom: c.prenom,
      aptitude: c.niveau, niveauEncadrement: c.niveauEncadrement, qualificationPreparee: c.qualificationPreparee,
      emailDossier: null
    });
    this.membres.set([nouveau, ...this.membres()]);
    this.signalerAjout(nouveau.cle);
    setTimeout(() => this.choixAjout.set(null));
  }

  /** Un plongeur d'un autre club : une ligne vide en tête, détail ouvert, prénom prêt à saisir. */
  ajouterExterieur(): void {
    const nouveau = membreVide();
    this.membres.set([nouveau, ...this.membres()]);
    this.recherche.set('');
    this.enEdition.set(nouveau.cle);
    this.signalerAjout(nouveau.cle);
    setTimeout(() => document.getElementById('prenom-' + nouveau.cle)?.focus());
  }

  private signalerAjout(cle: number): void {
    this.dernierAjout.set(cle);
    setTimeout(() => document.getElementById('membre-' + cle)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  basculerEdition(m: LigneMembre): void {
    this.enEdition.set(this.enEdition() === m.cle ? null : m.cle);
  }

  retirer(m: LigneMembre): void {
    this.membres.set(this.membres().filter(x => x.cle !== m.cle));
    if (this.enEdition() === m.cle) this.enEdition.set(null);
  }

  /** La ligne n'est plus rattachée à un dossier : les champs restent, en saisie libre. */
  delier(m: LigneMembre): void {
    m.eleveId = null;
    m.utilisateurId = null;
    m.emailDossier = null;
    this.membres.set([...this.membres()]);
  }

  enregistrer(): void {
    const saisonId = this.saisonId();
    if (!saisonId) return;
    if (!this.nomGroupe.trim()) {
      this.message.set('Le nom du groupe est obligatoire.');
      return;
    }
    const lignes = this.membres().filter(m => m.nom.trim() || m.prenom.trim());
    const incomplet = lignes.find(m => !m.nom.trim() || !m.prenom.trim());
    if (incomplet) {
      this.enEdition.set(incomplet.cle);
      this.message.set('Chaque plongeur a un prénom et un nom.');
      return;
    }
    const membres: MembreGroupeVue[] = lignes.map(({ cle: _cle, ...m }) => m);
    const demande = { nom: this.nomGroupe, saisonId, membres };
    const id = this.editeurId();

    this.envoi.set(true);
    this.message.set(null);
    const appel = id === null ? this.api.creerGroupePlongeurs(demande) : this.api.modifierGroupePlongeurs(id, demande);
    appel.subscribe({
      next: groupe => {
        this.envoi.set(false);
        this.editeurOuvert.set(false);
        this.liste.set(id === null ? [...this.liste(), groupe] : this.liste().map(x => x.id === groupe.id ? groupe : x));
        this.message.set(id === null ? 'Groupe créé.' : null);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? (e.status === 403
          ? 'Seuls le créateur de la liste et les organisateurs qu\'il a désignés la modifient.'
          : 'L\'enregistrement du groupe a échoué.'));
      }
    });
  }

  supprimer(g: GroupePlongeursVue): void {
    if (!confirm(`Supprimer le groupe « ${g.nom} » ? Les fiches déjà établies ne sont pas modifiées.`)) return;
    this.message.set(null);
    this.api.supprimerGroupePlongeurs(g.id).subscribe({
      next: () => this.liste.set(this.liste().filter(x => x.id !== g.id)),
      error: () => this.message.set('La suppression du groupe a échoué.')
    });
  }

  // ---------------- Organisateurs ----------------

  estCreateur(g: GroupePlongeursVue, id: number): boolean {
    return g.organisateurs.some(o => o.createur && o.id === id);
  }

  async ouvrirOrganisateurs(g: GroupePlongeursVue): Promise<void> {
    this.message.set(null);
    this.organisateursChoisis.set(new Set(g.organisateurs.filter(o => !o.createur).map(o => o.id)));
    this.organisateursOuverts.set(g.id);
    try {
      this.candidats.set(await this.api.moniteursActifs());
    } catch {
      this.message.set('Impossible de charger la liste des moniteurs (réseau nécessaire).');
    }
  }

  basculerOrganisateur(id: number): void {
    const choisis = new Set(this.organisateursChoisis());
    if (!choisis.delete(id)) choisis.add(id);
    this.organisateursChoisis.set(choisis);
  }

  enregistrerOrganisateurs(g: GroupePlongeursVue): void {
    this.envoi.set(true);
    this.message.set(null);
    this.api.definirOrganisateursGroupe(g.id, [...this.organisateursChoisis()]).subscribe({
      next: maj => {
        this.envoi.set(false);
        this.liste.set(this.liste().map(x => x.id === maj.id ? maj : x));
        this.organisateursOuverts.set(null);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? 'L\'enregistrement des organisateurs a échoué.');
      }
    });
  }

  // ---------------- Envoi des paramètres ----------------

  async ouvrirEnvoi(g: GroupePlongeursVue): Promise<void> {
    this.message.set(null);
    this.bilan.set(null);
    this.fermerEditeur();
    try {
      // À venir ou finies depuis peu : celle qui vient de se terminer en tête de liste.
      const sorties = await firstValueFrom(this.api.sorties(true));
      this.sorties.set(sorties.filter(s => s.nombrePlongees > 0));
      const passees = this.sorties().filter(s => s.dateFin <= dateDuJour());
      this.sortieChoisie = passees.at(-1)?.id ?? this.sorties()[0]?.id ?? null;
      this.envoiOuvert.set(g.id);
    } catch {
      this.message.set('Impossible de charger les sorties (réseau nécessaire).');
    }
  }

  envoyerParametres(g: GroupePlongeursVue): void {
    const sortie = this.sorties().find(s => s.id === this.sortieChoisie);
    if (!sortie) return;
    if (!confirm(`Envoyer à chaque plongeur de « ${g.nom} » les paramètres de ses plongées de « ${sortie.nom} » ?`)) {
      return;
    }
    this.envoiEmails.set(true);
    this.bilan.set(null);
    this.api.envoyerParametresSejour(g.id, sortie.id).subscribe({
      next: b => {
        this.envoiEmails.set(false);
        this.bilan.set(b);
      },
      error: (e: HttpErrorResponse) => {
        this.envoiEmails.set(false);
        this.message.set(e.error?.detail ?? "L'envoi des e-mails a échoué.");
      }
    });
  }
}
