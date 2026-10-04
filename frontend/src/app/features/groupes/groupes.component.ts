import { Component, WritableSignal, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import {
  BilanEnvoiParametres, GroupePlongeursVue, MembreGroupeVue, PlongeurConnuVue, SaisonVue, SortieVue
} from '../../core/modeles';
import { dateDuJour } from '../../core/date-fr';
import { ComboboxComponent, OptionCombobox } from '../../core/combobox.component';

function membreVide(): MembreGroupeVue {
  return { eleveId: null, utilisateurId: null, nom: '', prenom: '', aptitude: null, qualificationPreparee: null };
}

/**
 * Gestion des groupes nommés et réutilisables de plongeurs (typiquement composés
 * pour un séjour) : ils peuvent aussi être créés à la volée depuis une fiche de
 * sécurité (voir fiche-securite.component.ts), à partir des plongeurs déjà
 * saisis sur la fiche — cet écran est le seul à permettre l'édition complète
 * (nom, ajout/retrait de membres) une fois le groupe créé.
 */
@Component({
  selector: 'app-groupes',
  imports: [FormsModule, ComboboxComponent],
  template: `
    <h1>Groupes de plongeurs</h1>
    <p class="secondaire">
      Composez une fois la liste des plongeurs d'un séjour, puis réutilisez le
      groupe dans plusieurs fiches de sécurité sans ressaisie. Un groupe peut
      aussi être créé directement depuis une fiche, à partir des plongeurs déjà
      saisis.
    </p>

    <label for="saison">Saison</label>
    <select id="saison" name="saison" [ngModel]="saisonId()" (ngModelChange)="changerSaison($event)">
      @for (s of saisons(); track s.id) {
        <option [ngValue]="s.id">{{ s.libelle }}{{ s.ouverte ? ' (ouverte)' : '' }}</option>
      }
    </select>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <section class="carte panneau">
      <h2>Nouveau groupe</h2>
      <label for="nomNouveauGroupe">Nom du groupe</label>
      <input id="nomNouveauGroupe" type="text" name="nomNouveauGroupe" [(ngModel)]="nomNouveauGroupe"
             placeholder="ex. Séjour Égypte mai 2026">

      @for (m of nouveauxMembres(); track m; let i = $index) {
        <div class="ligne-membre">
          <app-combobox class="selecteur-connu" [idChamp]="'nv-connu-' + i" [options]="optionsConnus()"
                        [valeur]="indexConnu(m)" (valeurChange)="choisirPlongeurConnu(nouveauxMembres, i, $event)"
                        aide="Rechercher un plongeur du club…" texteVide="Aucun plongeur ne correspond." />
          <input type="text" placeholder="Prénom" [(ngModel)]="m.prenom" [name]="'nv-prenom-' + i">
          <input type="text" placeholder="Nom" [(ngModel)]="m.nom" [name]="'nv-nom-' + i">
          <input type="text" placeholder="Aptitude (ex. N2, E2…)" [(ngModel)]="m.aptitude" [name]="'nv-aptitude-' + i">
          <input type="text" placeholder="Qualification préparée" [(ngModel)]="m.qualificationPreparee"
                 [name]="'nv-qualif-' + i">
          <input type="email" [placeholder]="placeholderEmail(m)" [(ngModel)]="m.email" [name]="'nv-email-' + i"
                 autocomplete="off">
          <button type="button" class="bouton-discret danger" (click)="retirerMembre(nouveauxMembres, i)">✕</button>
        </div>
      }
      <div class="actions">
        <button type="button" class="bouton-discret" (click)="ajouterMembre(nouveauxMembres)">+ Plongeur</button>
        <button type="button" class="bouton-principal" [disabled]="envoi()" (click)="creerGroupe()">
          {{ envoi() ? 'Création…' : 'Créer le groupe' }}
        </button>
      </div>
    </section>

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (liste().length === 0) {
      <div class="carte vide"><p>Aucun groupe pour cette saison.</p></div>
    } @else {
      <ul>
        @for (g of liste(); track g.id) {
          <li class="carte">
            @if (enEditionId() === g.id) {
              <label [for]="'nom-' + g.id">Nom du groupe</label>
              <input [id]="'nom-' + g.id" type="text" [(ngModel)]="nomEdition" [name]="'nom-edit-' + g.id">

              @for (m of brouillonMembres(); track m; let i = $index) {
                <div class="ligne-membre">
                  <app-combobox class="selecteur-connu" [idChamp]="'ed-connu-' + g.id + '-' + i"
                                [options]="optionsConnus()" [valeur]="indexConnu(m)"
                                (valeurChange)="choisirPlongeurConnu(brouillonMembres, i, $event)"
                                aide="Rechercher un plongeur du club…" texteVide="Aucun plongeur ne correspond." />
                  <input type="text" placeholder="Prénom" [(ngModel)]="m.prenom" [name]="'ed-prenom-' + g.id + '-' + i">
                  <input type="text" placeholder="Nom" [(ngModel)]="m.nom" [name]="'ed-nom-' + g.id + '-' + i">
                  <input type="text" placeholder="Aptitude (ex. N2, E2…)" [(ngModel)]="m.aptitude"
                         [name]="'ed-aptitude-' + g.id + '-' + i">
                  <input type="text" placeholder="Qualification préparée" [(ngModel)]="m.qualificationPreparee"
                         [name]="'ed-qualif-' + g.id + '-' + i">
                  <input type="email" [placeholder]="placeholderEmail(m)" [(ngModel)]="m.email"
                         [name]="'ed-email-' + g.id + '-' + i" autocomplete="off">
                  <button type="button" class="bouton-discret danger" (click)="retirerMembre(brouillonMembres, i)">
                    ✕
                  </button>
                </div>
              }
              <div class="actions">
                <button type="button" class="bouton-discret" (click)="ajouterMembre(brouillonMembres)">
                  + Plongeur
                </button>
                <button type="button" class="bouton-principal" [disabled]="envoi()" (click)="enregistrer(g)">
                  {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
                </button>
                <button type="button" class="bouton-discret" (click)="annulerEdition()">Annuler</button>
              </div>
            } @else {
              <div class="ligne">
                <div class="identite">
                  <span class="nom">{{ g.nom }}</span>
                  <span class="secondaire">
                    {{ g.membres.length }} plongeur{{ g.membres.length > 1 ? 's' : '' }}
                    @if (g.membres.length > 0) {
                      — {{ g.membres.map(m => m.prenom + ' ' + m.nom).join(', ') }}
                    }
                  </span>
                  @if (sansEmail(g).length > 0) {
                    <span class="secondaire">Sans e-mail : {{ sansEmail(g).join(', ') }}</span>
                  }
                </div>
              </div>

              @if (envoiOuvert() === g.id) {
                <div class="envoi">
                  <h3>Envoyer les paramètres par e-mail</h3>
                  <p class="secondaire">
                    En fin de séjour : chaque plongeur du groupe reçoit un e-mail avec ses seules plongées de la
                    sortie (date, site, profondeur, durée, heures, paliers et membres de sa palanquée), relevées
                    sur les fiches de sécurité.
                  </p>
                  <label [for]="'sortie-' + g.id">Sortie</label>
                  <select [id]="'sortie-' + g.id" [(ngModel)]="sortieChoisie" [name]="'sortie-' + g.id">
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
                  <div class="actions">
                    <button type="button" class="bouton-principal" [disabled]="envoiEmails() || sortieChoisie === null"
                            (click)="envoyerParametres(g)">
                      {{ envoiEmails() ? 'Envoi…' : 'Envoyer les e-mails' }}
                    </button>
                    <button type="button" class="bouton-discret" (click)="envoiOuvert.set(null)">Fermer</button>
                  </div>
                </div>
              } @else {
                <div class="actions">
                  <button type="button" class="bouton-discret" (click)="commencerEdition(g)">Modifier</button>
                  <button type="button" class="bouton-discret" (click)="ouvrirEnvoi(g)">
                    Envoyer les paramètres par e-mail
                  </button>
                  <button type="button" class="bouton-discret danger" (click)="supprimer(g)">Supprimer</button>
                </div>
              }
            }
          </li>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    #saison { max-width: 320px; margin-bottom: var(--pas-2); }
    .panneau { padding: var(--pas-3); margin: var(--pas-2) 0 var(--pas-3); }
    .panneau h2 { margin-bottom: 4px; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }

    .ligne-membre { display: flex; gap: var(--pas); flex-wrap: wrap; align-items: center; margin: var(--pas) 0; }
    .ligne-membre input[type="text"] { flex: 1 1 140px; }
    .selecteur-connu { display: block; flex: 1 1 100%; }

    .danger { color: #B3261E; border-color: #B3261E; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }

    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2); }
    li { padding: var(--pas-2); }
    .ligne { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas-2); }
    .identite { display: flex; flex-direction: column; gap: 2px; }
    .nom { font-weight: 700; }
    .envoi { margin-top: var(--pas-2); padding: var(--pas-2); background: var(--fond); border-radius: var(--r-s); }
    .envoi h3 { margin-bottom: 4px; }
    .envoi select { max-width: 420px; }
    .envoi .alerte p { margin: 2px 0; }

    @media (max-width: 600px) {
      .ligne { flex-direction: column; }
    }
  `]
})
export class GroupesComponent {
  private api = inject(ApiService);

  saisons = signal<SaisonVue[]>([]);
  saisonId = signal<number | null>(null);
  plongeursConnus = signal<PlongeurConnuVue[]>([]);

  liste = signal<GroupePlongeursVue[]>([]);
  chargement = signal(true);
  message = signal<string | null>(null);
  envoi = signal(false);

  nomNouveauGroupe = '';
  nouveauxMembres = signal<MembreGroupeVue[]>([membreVide()]);

  enEditionId = signal<number | null>(null);
  nomEdition = '';
  brouillonMembres = signal<MembreGroupeVue[]>([]);

  /** Groupe dont le panneau d'envoi des paramètres par e-mail est ouvert. */
  envoiOuvert = signal<number | null>(null);
  sorties = signal<SortieVue[]>([]);
  sortieChoisie: number | null = null;
  envoiEmails = signal(false);
  bilan = signal<BilanEnvoiParametres | null>(null);

  constructor() {
    void this.initialiser();
  }

  /** L'e-mail du dossier en indication : vide, c'est lui qui sert à l'envoi. */
  placeholderEmail(m: MembreGroupeVue): string {
    if (m.emailDossier) return `E-mail (sinon ${m.emailDossier})`;
    return m.eleveId !== null || m.utilisateurId !== null ? 'E-mail (sinon celui du dossier)' : 'E-mail';
  }

  sansEmail(g: GroupePlongeursVue): string[] {
    return g.membres.filter(m => !m.email && !m.emailDossier).map(m => `${m.prenom} ${m.nom}`);
  }

  libellesEnvoyes(b: BilanEnvoiParametres): string {
    return b.envoyes.map(d => `${d.nom} (${d.nombrePlongees} plongée${d.nombrePlongees > 1 ? 's' : ''})`).join(', ');
  }

  async ouvrirEnvoi(g: GroupePlongeursVue): Promise<void> {
    this.message.set(null);
    this.bilan.set(null);
    this.annulerEdition();
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
    this.annulerEdition();
    void this.chargerGroupes(saisonId);
  }

  ajouterMembre(membres: WritableSignal<MembreGroupeVue[]>): void {
    membres.set([...membres(), membreVide()]);
  }

  retirerMembre(membres: WritableSignal<MembreGroupeVue[]>, index: number): void {
    membres.set(membres().filter((_, i) => i !== index));
  }

  /**
   * Plongeurs du club proposés dans la liste de choix ; l'id d'une option est
   * sa position dans `plongeursConnus` (élèves et encadrants ont chacun leur
   * propre numérotation d'id). Le détail donne niveau, niveau en préparation
   * et niveau d'encadrement.
   */
  optionsConnus = computed<OptionCombobox[]>(() => this.plongeursConnus().map((c, i) => ({
    id: i,
    libelle: `${c.prenom} ${c.nom}`,
    detail: [
      `Niveau ${c.niveau ?? 'non renseigné'}`,
      c.niveauPreparation ? `en préparation ${c.niveauPreparation}` : null,
      c.niveauEncadrement ? `encadrant ${c.niveauEncadrement}` : null
    ].filter(Boolean).join(' · ')
  })));

  /** Position dans `plongeursConnus` du plongeur de cette ligne, null s'il a été saisi à la main. */
  indexConnu(m: MembreGroupeVue): number | null {
    if (m.eleveId === null && m.utilisateurId === null) return null;
    const i = this.plongeursConnus().findIndex(c =>
      (m.eleveId !== null && c.eleveId === m.eleveId) || (m.utilisateurId !== null && c.utilisateurId === m.utilisateurId));
    return i >= 0 ? i : null;
  }

  /**
   * Pré-remplit un membre depuis le dossier du plongeur choisi, éditable
   * ensuite. Choix effacé : la ligne n'est plus rattachée à un dossier, les
   * champs déjà remplis restent, en saisie libre.
   */
  choisirPlongeurConnu(membres: WritableSignal<MembreGroupeVue[]>, index: number, choix: number | null): void {
    const candidat = choix === null ? null : this.plongeursConnus()[choix];
    if (!candidat) {
      membres.set(membres().map((m, i) => i !== index ? m
        : { ...m, eleveId: null, utilisateurId: null, emailDossier: null }));
      return;
    }
    membres.set(membres().map((m, i) => i !== index ? m : {
      ...m, eleveId: candidat.eleveId, utilisateurId: candidat.utilisateurId, emailDossier: null,
      nom: candidat.nom, prenom: candidat.prenom,
      aptitude: candidat.aptitude, qualificationPreparee: candidat.qualificationPreparee
    }));
  }

  creerGroupe(): void {
    const saisonId = this.saisonId();
    if (!saisonId) return;
    if (!this.nomNouveauGroupe.trim()) {
      this.message.set('Le nom du groupe est obligatoire.');
      return;
    }
    const membres = this.nouveauxMembres().filter(m => m.nom.trim() || m.prenom.trim());

    this.envoi.set(true);
    this.message.set(null);
    this.api.creerGroupePlongeurs({ nom: this.nomNouveauGroupe, saisonId, membres }).subscribe({
      next: groupe => {
        this.envoi.set(false);
        this.liste.set([...this.liste(), groupe]);
        this.nomNouveauGroupe = '';
        this.nouveauxMembres.set([membreVide()]);
        this.message.set('Groupe créé.');
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "La création du groupe a échoué.");
      }
    });
  }

  commencerEdition(g: GroupePlongeursVue): void {
    this.message.set(null);
    this.nomEdition = g.nom;
    this.brouillonMembres.set(g.membres.map(m => ({ ...m })));
    this.enEditionId.set(g.id);
  }

  annulerEdition(): void {
    this.enEditionId.set(null);
  }

  enregistrer(g: GroupePlongeursVue): void {
    const saisonId = this.saisonId();
    if (!saisonId) return;
    if (!this.nomEdition.trim()) {
      this.message.set('Le nom du groupe est obligatoire.');
      return;
    }
    const membres = this.brouillonMembres().filter(m => m.nom.trim() || m.prenom.trim());

    this.envoi.set(true);
    this.message.set(null);
    this.api.modifierGroupePlongeurs(g.id, { nom: this.nomEdition, saisonId, membres }).subscribe({
      next: maj => {
        this.envoi.set(false);
        this.liste.set(this.liste().map(x => x.id === maj.id ? maj : x));
        this.enEditionId.set(null);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.message.set(e.error?.detail ?? "La modification du groupe a échoué.");
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
}
