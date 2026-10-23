import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AvatarComponent } from '../../core/avatar.component';
import { OngletsComponent } from '../../core/onglets.component';
import { ReseauService } from '../../core/reseau.service';
import { SejourApi } from './sejour-api';
import { LigneTrombinoscopeSejour, duGroupe, filtresGroupes } from './trombinoscope-sejour';

/**
 * Le trombinoscope d'un séjour, ouvert par un encadrant depuis l'onglet
 * « Participants » : les visages, filtrés par groupe de plongeurs. Photo
 * reprise du dossier élève ou du compte d'encadrant, jamais sans le droit à
 * l'image (vérifié par le serveur) ; sinon les initiales. Réseau
 * obligatoire : les photos ne sont pas gardées sur le téléphone.
 */
@Component({
  selector: 'app-trombinoscope-sejour',
  imports: [AvatarComponent, OngletsComponent],
  template: `
    @if (lignes() === null) {
      <p class="vide">Chargement…</p>
    } @else if (erreur()) {
      <p class="vide">{{ erreur() }}</p>
    } @else if (lignes()!.length === 0) {
      <p class="vide">Personne d'inscrit pour l'instant.</p>
    } @else {
      @if (filtres().length > 2) {
        <app-onglets class="filtres-groupes" [options]="filtres()" [choisi]="filtre()" [boutons]="true"
                     libelle="Filtrer par groupe de plongeurs" (choisir)="filtre.set($event)" />
      }
      <p class="secondaire">{{ affichees().length }} personne{{ affichees().length > 1 ? 's' : '' }}.
        Sans photo si le droit à l'image n'a pas été recueilli.</p>
      <ul class="grille">
        @for (l of affichees(); track l.participantId) {
          <li class="fiche">
            <app-avatar [url]="urls().get(l.participantId) ?? null" [nom]="{ prenom: l.prenom, nom: l.nom }"
                        [alt]="l.prenom + ' ' + l.nom" [libelleInitiales]="l.prenom + ' ' + l.nom" />
            <span class="nom">{{ l.prenom }} {{ l.nom }}</span>
            <span class="secondaire">{{ l.aptitude ?? (l.plongeur ? 'Plongeur' : 'Accompagnant') }}</span>
            @if (l.groupe && filtre() === '') { <span class="secondaire">{{ l.groupe }}</span> }
          </li>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .filtres-groupes { margin-top: 0; }
    .grille { list-style: none; padding: 0; margin: var(--pas-2) 0 0;
              display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: var(--pas-2); }
    .fiche { display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; }
    app-avatar { --taille-avatar: 96px; }
    .nom { font-weight: 700; margin-top: 4px; }
  `]
})
export class TrombinoscopeSejourComponent implements OnInit, OnDestroy {
  private api = inject(SejourApi);
  private reseau = inject(ReseauService);

  readonly sejourId = input.required<number>();

  lignes = signal<LigneTrombinoscopeSejour[] | null>(null);
  erreur = signal<string | null>(null);
  /** Le groupe choisi ('' : tous). */
  filtre = signal('');
  /** Les photos chargées, par participant (adresses blob:, libérées à la fermeture). */
  urls = signal<Map<number, string>>(new Map());

  filtres = computed(() => filtresGroupes(this.lignes() ?? []));
  affichees = computed(() => duGroupe(this.lignes() ?? [], this.filtre()));

  async ngOnInit(): Promise<void> {
    try {
      const lignes = await firstValueFrom(this.api.trombinoscope(this.sejourId()));
      this.lignes.set(lignes);
      for (const l of lignes) if (l.aPhoto) this.chargerPhoto(l.participantId);
    } catch {
      this.erreur.set(this.reseau.enLigne()
        ? 'Impossible de charger le trombinoscope.'
        : 'Le trombinoscope a besoin du réseau : réessayez quand vous en aurez.');
      this.lignes.set([]);
    }
  }

  private chargerPhoto(participantId: number): void {
    firstValueFrom(this.api.photoParticipant(this.sejourId(), participantId)).then(
      blob => this.urls.update(m => new Map(m).set(participantId, URL.createObjectURL(blob))),
      () => { /* pas de photo consultable : les initiales restent */ }
    );
  }

  ngOnDestroy(): void {
    for (const url of this.urls().values()) URL.revokeObjectURL(url);
  }
}
