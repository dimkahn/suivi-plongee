import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { PalanqueeVue, PlongeurVue, SeanceVue } from '../../core/modeles';

/**
 * Étape 2, à part de l'établissement (voir FicheSecuriteComponent) : le
 * profil réellement plongé, saisi au retour, sans repasser par le directeur
 * de plongée, les conditions ou la composition des palanquées. Un écran
 * séparé plutôt qu'une section de la même page : ce n'est pas le même
 * moment (avant la mise à l'eau / au retour), ni forcément la même personne
 * qui saisit.
 */
@Component({
  selector: 'app-fiche-securite-realise',
  imports: [FormsModule, RouterLink],
  template: `
    <a [routerLink]="['/fiches-securite', seanceId]" class="bouton-discret">← Établissement de la fiche</a>

    @if (seance(); as s) {
      <h1>Compléter la fiche — {{ s.date }}{{ s.lieu ? ' — ' + s.lieu : '' }}</h1>
      <p class="secondaire">
        {{ s.milieu === 'NATUREL' ? 'Milieu naturel' : 'Milieu artificiel' }}
        {{ s.profondeurMax ? ' · ' + s.profondeurMax + ' m max' : '' }}
      </p>
    }

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (!ficheEtablie()) {
      <p class="vide">
        Cette séance n'a pas encore de fiche de sécurité établie.
        <a [routerLink]="['/fiches-securite', seanceId]">Établir la fiche</a> d'abord.
      </p>
    } @else {
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
          <p class="membres">
            @for (m of p.membres; track m; let last = $last) {
              <span [class.correspondance]="estCorrespondance(m)">{{ m.prenom }} {{ m.nom }}</span>{{ last ? '' : ', ' }}
            }
          </p>
          <p class="prevu">
            Prévu : {{ p.profondeurPrevue ? p.profondeurPrevue + ' m' : '—' }}
            / {{ p.dureePrevue ? p.dureePrevue + ' min' : '—' }}
          </p>
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
        <button type="button" class="bouton-discret" (click)="telechargerPdf()" [disabled]="exportEnCours()">
          {{ exportEnCours() ? 'Génération…' : 'Télécharger le PDF' }}
        </button>
        <button type="button" class="bouton-discret" (click)="telechargerExcel()" [disabled]="exportExcelEnCours()">
          {{ exportExcelEnCours() ? 'Génération…' : "Télécharger l'Excel" }}
        </button>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin: var(--pas-3) 0 0; }
    .panneau { padding: var(--pas-3); margin: var(--pas-2) 0 var(--pas-3); }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }

    .membres { margin: 0 0 var(--pas-2); color: var(--craie); }
    .prevu { margin: 0 0 var(--pas-2); font-size: .8125rem; color: var(--craie); font-weight: 700; }
    .correspondance {
      background: #fff3b0; color: #1c2d33; border-radius: 3px; padding: 0 3px; font-weight: 700;
    }

    .ligne-profil {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--pas);
      font-size: .8125rem; margin-bottom: var(--pas);
    }
    .ligne-profil label { margin: 0; font-weight: 400; }
    .ligne-profil input { width: 100%; }

    .actions-bas { display: flex; gap: var(--pas-2); flex-wrap: wrap; margin: var(--pas-3) 0; }
    #rechercheRealise { max-width: 320px; }
  `]
})
export class FicheSecuriteRealiseComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  seanceId = Number(this.route.snapshot.paramMap.get('id'));

  seance = signal<SeanceVue | null>(null);
  chargement = signal(true);
  message = signal<string | null>(null);
  envoiRealise = signal(false);
  exportEnCours = signal(false);
  exportExcelEnCours = signal(false);

  ficheEtablie = signal(false);
  palanquees = signal<PalanqueeVue[]>([]);

  rechercheRealise = signal('');
  /** Ne garde que les palanquées ayant au moins un plongeur correspondant à la recherche. */
  palanqueesFiltrees = computed(() => {
    if (!this.rechercheRealise()) return this.palanquees();
    return this.palanquees().filter(p => p.membres.some(m => this.estCorrespondance(m)));
  });

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    try {
      const [seances, fiche] = await Promise.all([
        this.api.seances(),
        firstValueFrom(this.api.ficheSecurite(this.seanceId))
      ]);
      this.seance.set(seances.find(s => s.id === this.seanceId) ?? null);
      this.ficheEtablie.set(fiche.id !== null);
      this.palanquees.set(fiche.palanquees);
    } catch {
      this.message.set('Impossible de charger la fiche de sécurité.');
    } finally {
      this.chargement.set(false);
    }
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

  /** Met en surbrillance un plongeur dont le nom ou prénom correspond à la recherche en cours. */
  estCorrespondance(m: PlongeurVue): boolean {
    const recherche = this.normaliser(this.rechercheRealise());
    if (!recherche) return false;
    return this.normaliser(m.nom).includes(recherche) || this.normaliser(m.prenom).includes(recherche);
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
