import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { MoniteurOptionVue, PalanqueeVue, PlongeurConnuVue, PlongeurVue, SeanceVue } from '../../core/modeles';

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
  imports: [FormsModule, RouterLink],
  template: `
    <a routerLink="/fiches-securite" class="bouton-discret">← Fiches de sécurité</a>

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

          @for (m of p.membres; track m; let iM = $index) {
            <div class="plongeur">
              <label class="discrete">Plongeur du club (optionnel, pré-remplit aptitude et qualification)</label>
              <select class="selecteur-connu" (change)="choisirPlongeurConnu(iP, iM, $event)">
                <option value="">— Choisir dans le club —</option>
                @if (elevesConnus().length > 0) {
                  <optgroup label="Élèves">
                    @for (c of elevesConnus(); track c.eleveId) {
                      <option [value]="'ELEVE:' + c.eleveId">
                        {{ c.prenom }} {{ c.nom }}{{ c.aptitude ? ' — ' + c.aptitude : '' }}
                      </option>
                    }
                  </optgroup>
                }
                @if (encadrantsConnus().length > 0) {
                  <optgroup label="Encadrants">
                    @for (c of encadrantsConnus(); track c.utilisateurId) {
                      <option [value]="'ENCADRANT:' + c.utilisateurId">
                        {{ c.prenom }} {{ c.nom }}{{ c.aptitude ? ' — ' + c.aptitude : '' }}
                      </option>
                    }
                  </optgroup>
                }
              </select>

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
            </div>
          }

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
    .actions-bas { display: flex; gap: var(--pas-2); flex-wrap: wrap; margin: var(--pas-3) 0; }
    #rechercheRealise { max-width: 320px; }
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
  dejaEnregistree = computed(() => this.ficheId() !== null);

  ficheId = signal<number | null>(null);
  entete = signal<FormulaireEntete | null>(null);
  palanquees = signal<PalanqueeVue[]>([]);

  plongeursConnus = signal<PlongeurConnuVue[]>([]);
  elevesConnus = computed(() => this.plongeursConnus().filter(c => c.eleveId !== null));
  encadrantsConnus = computed(() => this.plongeursConnus().filter(c => c.utilisateurId !== null));

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
      const [seances, moniteurs, plongeursConnus, fiche] = await Promise.all([
        this.api.seances(),
        firstValueFrom(this.api.moniteursActifs()),
        firstValueFrom(this.api.plongeursConnus()),
        firstValueFrom(this.api.ficheSecurite(this.seanceId))
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

  /** Pré-remplit nom/prénom/aptitude/qualification depuis le dossier du plongeur choisi, éditable ensuite. */
  choisirPlongeurConnu(indexPalanquee: number, indexMembre: number, event: Event): void {
    const valeur = (event.target as HTMLSelectElement).value;
    if (!valeur) return;
    const [type, idTexte] = valeur.split(':');
    const id = Number(idTexte);
    const candidat = this.plongeursConnus().find(c =>
      (type === 'ELEVE' && c.eleveId === id) || (type === 'ENCADRANT' && c.utilisateurId === id));
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
}
