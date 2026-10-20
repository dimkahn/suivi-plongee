import { Component, ChangeDetectionStrategy, effect, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DemandeMesInformations, ParticipantVue, REGIMES, RegimeAlimentaire, TRANSPORTS, Trajet, copieTrajet, trajetSaisi
} from './sejour-api';

type Brouillon = DemandeMesInformations & { arrivee: Trajet; depart: Trajet };

/**
 * Ce qu'un participant renseigne lui-même pour le séjour : téléphone,
 * arrivée et départ (numéro de vol ou de train), repas, personne à
 * prévenir, message à l'organisateur. Sert dans l'appli (« Modifier mes
 * informations ») et sur la page du lien reçu par e-mail ; le parent
 * envoie au serveur. Aucune information médicale.
 */
@Component({
  selector: 'app-mes-informations',
  imports: [FormsModule],
  template: `
    <form (ngSubmit)="valider()">
      <label for="mi-tel">Mon téléphone</label>
      <input id="mi-tel" name="tel" type="tel" autocomplete="tel" maxlength="30" [(ngModel)]="b.telephone">

      @for (sens of sens; track sens.code) {
        <fieldset>
          <legend>{{ sens.libelle }}</legend>
          <div class="grille">
            <div><label [for]="'mi-' + sens.code + '-date'">Jour</label>
              <input [id]="'mi-' + sens.code + '-date'" [name]="sens.code + '-date'" type="date" [(ngModel)]="b[sens.code].date"></div>
            <div><label [for]="'mi-' + sens.code + '-heure'">{{ sens.heure }}</label>
              <input [id]="'mi-' + sens.code + '-heure'" [name]="sens.code + '-heure'" type="time" [(ngModel)]="b[sens.code].heure"></div>
            <div><label [for]="'mi-' + sens.code + '-moyen'">Moyen</label>
              <select [id]="'mi-' + sens.code + '-moyen'" [name]="sens.code + '-moyen'" [(ngModel)]="b[sens.code].transport">
                <option [ngValue]="null">—</option>
                @for (t of transports; track t.code) { <option [ngValue]="t.code">{{ t.libelle }}</option> }
              </select></div>
            <div><label [for]="'mi-' + sens.code + '-numero'">N° de vol ou de train</label>
              <input [id]="'mi-' + sens.code + '-numero'" [name]="sens.code + '-numero'" maxlength="30"
                     placeholder="AF7520" [(ngModel)]="b[sens.code].numero"></div>
            <div><label [for]="'mi-' + sens.code + '-lieu'">{{ sens.lieu }}</label>
              <input [id]="'mi-' + sens.code + '-lieu'" [name]="sens.code + '-lieu'" maxlength="120" [(ngModel)]="b[sens.code].lieu"></div>
            @if (sens.code === 'arrivee') {
              <div><label for="mi-arrivee-date-depart">Jour de départ de l'avion ou du train</label>
                <input id="mi-arrivee-date-depart" name="arrivee-date-depart" type="date" [(ngModel)]="b.arrivee.dateDepart"></div>
              <div><label for="mi-arrivee-heure-depart">Heure de départ de l'avion ou du train</label>
                <input id="mi-arrivee-heure-depart" name="arrivee-heure-depart" type="time" [(ngModel)]="b.arrivee.heureDepart"></div>
              <div><label for="mi-arrivee-lieu-depart">Aéroport ou gare de départ</label>
                <input id="mi-arrivee-lieu-depart" name="arrivee-lieu-depart" maxlength="120" placeholder="Paris-Orly"
                       [(ngModel)]="b.arrivee.lieuDepart"></div>
            } @else {
              <div><label for="mi-depart-date-arrivee">Jour d'arrivée de l'avion ou du train</label>
                <input id="mi-depart-date-arrivee" name="depart-date-arrivee" type="date" [(ngModel)]="b.depart.dateArrivee"></div>
              <div><label for="mi-depart-heure-arrivee">Heure d'arrivée de l'avion ou du train</label>
                <input id="mi-depart-heure-arrivee" name="depart-heure-arrivee" type="time" [(ngModel)]="b.depart.heureArrivee"></div>
              <div><label for="mi-depart-lieu-arrivee">Aéroport ou gare d'arrivée</label>
                <input id="mi-depart-lieu-arrivee" name="depart-lieu-arrivee" maxlength="120" placeholder="Paris-Orly"
                       [(ngModel)]="b.depart.lieuArrivee"></div>
            }
            @if (b[sens.code].transport && b[sens.code].transport !== 'VOITURE') {
              <div><label [for]="'mi-' + sens.code + '-terminal'">Terminal de départ</label>
                <input [id]="'mi-' + sens.code + '-terminal'" [name]="sens.code + '-terminal'" maxlength="30"
                       placeholder="4" [(ngModel)]="b[sens.code].terminal"></div>
              <div><label [for]="'mi-' + sens.code + '-ouverture'">Ouverture de l'enregistrement en ligne</label>
                <input [id]="'mi-' + sens.code + '-ouverture'" [name]="sens.code + '-ouverture'" type="datetime-local"
                       [(ngModel)]="b[sens.code].ouvertureEnregistrement"></div>
              <div><label [for]="'mi-' + sens.code + '-dossier'">N° de dossier (réservation)</label>
                <input [id]="'mi-' + sens.code + '-dossier'" [name]="sens.code + '-dossier'" maxlength="30"
                       placeholder="ABC123" autocapitalize="characters" [(ngModel)]="b[sens.code].dossier"></div>
              <div><label [for]="'mi-' + sens.code + '-lien'">Lien d'enregistrement</label>
                <input [id]="'mi-' + sens.code + '-lien'" [name]="sens.code + '-lien'" type="url" maxlength="500"
                       placeholder="https://…" [(ngModel)]="b[sens.code].lienEnregistrement"></div>
            }
          </div>
          @if (b[sens.code].transport && b[sens.code].transport !== 'VOITURE') {
            <p class="secondaire">Le n° de dossier et le lien ne sont vus que par vous et les organisateurs du séjour.
              Le lien se trouve souvent dans le mail de la compagnie (« S'enregistrer », « Gérer ma réservation »).</p>
          }
          @if (sens.code === 'arrivee') {
            <p class="secondaire">L'heure de départ sert à vous dire, le jour venu, à quelle heure être à l'aéroport ou à la gare.</p>
          }
        </fieldset>
      }

      <fieldset>
        <legend>Mes repas</legend>
        <div class="cases">
          @for (r of regimes; track r.code) {
            <label class="case"><input type="checkbox" [checked]="b.regimes.includes(r.code)"
                                       (change)="basculer(r.code)"> {{ r.libelle }}</label>
          }
        </div>
        <label for="mi-precision">Précision pour la cuisine</label>
        <input id="mi-precision" name="precision" maxlength="300" placeholder="Pas de poisson cru…" [(ngModel)]="b.regimePrecision">
        <p class="secondaire">Aucune information médicale ici (allergie, traitement) : voyez-la avec l'organisateur.</p>
      </fieldset>

      <fieldset>
        <legend>Personne à prévenir en cas d'urgence</legend>
        <div class="grille">
          <div><label for="mi-urg-nom">Nom</label>
            <input id="mi-urg-nom" name="urgNom" maxlength="120" [(ngModel)]="b.urgenceNom"></div>
          <div><label for="mi-urg-tel">Téléphone</label>
            <input id="mi-urg-tel" name="urgTel" type="tel" maxlength="30" [(ngModel)]="b.urgenceTelephone"></div>
        </div>
      </fieldset>

      <label for="mi-remarques">Un mot pour l'organisateur</label>
      <textarea id="mi-remarques" name="remarques" rows="2" [(ngModel)]="b.remarques"></textarea>

      <div class="actions-dialogue">
        <button type="submit" class="bouton-principal" [disabled]="envoi()">
          {{ envoi() ? 'Enregistrement…' : 'Enregistrer mes informations' }}
        </button>
        @if (annulable()) {
          <button type="button" class="bouton-discret" (click)="annuler.emit()">Annuler</button>
        }
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0 var(--pas-2); }
    fieldset { border: 1px solid var(--trait); border-radius: var(--r-s); margin: var(--pas-2) 0; padding: var(--pas) var(--pas-2); }
    legend { font-weight: 700; padding: 0 var(--pas); }
    textarea { resize: vertical; }
    .cases { display: flex; flex-wrap: wrap; gap: 0 var(--pas-2); }
    .case { display: flex; align-items: center; gap: var(--pas); font-weight: 400; min-height: 44px; margin: 0; }
    .case input { width: auto; flex: none; }
  `]
})
export class MesInformationsComponent {
  participant = input.required<ParticipantVue>();
  envoi = input(false);
  annulable = input(true);
  enregistrer = output<DemandeMesInformations>();
  annuler = output<void>();

  readonly regimes = REGIMES;
  readonly transports = TRANSPORTS;
  readonly sens = [
    { code: 'arrivee' as const, libelle: 'Mon arrivée', heure: "Heure d'arrivée", lieu: "Aéroport, gare ou lieu d'arrivée" },
    { code: 'depart' as const, libelle: 'Mon départ', heure: 'Heure de départ', lieu: 'Aéroport, gare ou lieu de départ' }
  ];

  b: Brouillon = this.brouillon(null);

  constructor() {
    effect(() => { this.b = this.brouillon(this.participant()); });
  }

  basculer(code: RegimeAlimentaire): void {
    const r = this.b.regimes;
    this.b.regimes = r.includes(code) ? r.filter(x => x !== code) : [...r, code];
  }

  valider(): void {
    this.enregistrer.emit({ ...this.b, arrivee: trajetSaisi(this.b.arrivee), depart: trajetSaisi(this.b.depart) });
  }

  private brouillon(p: ParticipantVue | null): Brouillon {
    return {
      telephone: p?.telephone ?? null, regimes: [...(p?.regimes ?? [])], regimePrecision: p?.regimePrecision ?? null,
      urgenceNom: p?.urgenceNom ?? null, urgenceTelephone: p?.urgenceTelephone ?? null,
      arrivee: copieTrajet(p?.arrivee ?? null), depart: copieTrajet(p?.depart ?? null), remarques: p?.remarques ?? null
    };
  }
}
