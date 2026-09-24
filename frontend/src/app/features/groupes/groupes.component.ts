import { Component, WritableSignal, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { GroupePlongeursVue, MembreGroupeVue, PlongeurConnuVue, SaisonVue } from '../../core/modeles';

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
  imports: [FormsModule],
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

    <datalist id="plongeurs-club">
      @for (c of plongeursConnus(); track libellePlongeurConnu(c)) {
        <option [value]="libellePlongeurConnu(c)"></option>
      }
    </datalist>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <section class="carte panneau">
      <h2>Nouveau groupe</h2>
      <label for="nomNouveauGroupe">Nom du groupe</label>
      <input id="nomNouveauGroupe" type="text" name="nomNouveauGroupe" [(ngModel)]="nomNouveauGroupe"
             placeholder="ex. Séjour Égypte mai 2026">

      @for (m of nouveauxMembres(); track m; let i = $index) {
        <div class="ligne-membre">
          <input type="text" class="selecteur-connu" placeholder="Rechercher un plongeur du club…"
                 list="plongeurs-club" (change)="choisirPlongeurConnu(nouveauxMembres, i, $event)">
          <input type="text" placeholder="Prénom" [(ngModel)]="m.prenom" [name]="'nv-prenom-' + i">
          <input type="text" placeholder="Nom" [(ngModel)]="m.nom" [name]="'nv-nom-' + i">
          <input type="text" placeholder="Aptitude (ex. N2, E2…)" [(ngModel)]="m.aptitude" [name]="'nv-aptitude-' + i">
          <input type="text" placeholder="Qualification préparée" [(ngModel)]="m.qualificationPreparee"
                 [name]="'nv-qualif-' + i">
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
                  <input type="text" class="selecteur-connu" placeholder="Rechercher un plongeur du club…"
                         list="plongeurs-club" (change)="choisirPlongeurConnu(brouillonMembres, i, $event)">
                  <input type="text" placeholder="Prénom" [(ngModel)]="m.prenom" [name]="'ed-prenom-' + g.id + '-' + i">
                  <input type="text" placeholder="Nom" [(ngModel)]="m.nom" [name]="'ed-nom-' + g.id + '-' + i">
                  <input type="text" placeholder="Aptitude (ex. N2, E2…)" [(ngModel)]="m.aptitude"
                         [name]="'ed-aptitude-' + g.id + '-' + i">
                  <input type="text" placeholder="Qualification préparée" [(ngModel)]="m.qualificationPreparee"
                         [name]="'ed-qualif-' + g.id + '-' + i">
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
                </div>
              </div>
              <div class="actions">
                <button type="button" class="bouton-discret" (click)="commencerEdition(g)">Modifier</button>
                <button type="button" class="bouton-discret danger" (click)="supprimer(g)">Supprimer</button>
              </div>
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
    .selecteur-connu { flex-basis: 220px; }

    .danger { color: #B3261E; border-color: #B3261E; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }

    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2); }
    li { padding: var(--pas-2); }
    .ligne { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--pas-2); }
    .identite { display: flex; flex-direction: column; gap: 2px; }
    .nom { font-weight: 700; }

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

  constructor() {
    void this.initialiser();
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

  /** Libellé affiché dans la combobox, voir la même logique dans fiche-securite.component.ts. */
  libellePlongeurConnu(c: PlongeurConnuVue): string {
    const type = c.eleveId !== null ? 'ELEVE:' + c.eleveId : 'ENCADRANT:' + c.utilisateurId;
    return `${c.prenom} ${c.nom}${c.aptitude ? ' — ' + c.aptitude : ''} (${type})`;
  }

  /** Pré-remplit un membre depuis le dossier du plongeur choisi, éditable ensuite. */
  choisirPlongeurConnu(membres: WritableSignal<MembreGroupeVue[]>, index: number, event: Event): void {
    const champ = event.target as HTMLInputElement;
    const correspondance = champ.value.match(/\((ELEVE|ENCADRANT):(\d+)\)\s*$/);
    if (!correspondance) return;
    const [, type, idTexte] = correspondance;
    const id = Number(idTexte);
    const candidat = this.plongeursConnus().find(c =>
      (type === 'ELEVE' && c.eleveId === id) || (type === 'ENCADRANT' && c.utilisateurId === id));
    champ.value = '';
    if (!candidat) return;

    membres.set(membres().map((m, i) => i !== index ? m : {
      ...m, eleveId: candidat.eleveId, utilisateurId: candidat.utilisateurId,
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
