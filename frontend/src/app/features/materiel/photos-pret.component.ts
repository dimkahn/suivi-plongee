import {
  Component, ElementRef, OnDestroy, OnInit, computed, inject, input, output, signal, viewChild, ChangeDetectionStrategy
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { MomentPhotoPret, PhotoPretVue, PretVue } from '../../core/modeles';
import { reduirePhoto } from '../../core/reduire-photo';

/**
 * Photos de l'état du matériel à la remise (avant) et au retour (après)
 * d'un prêt. Le serveur tient les règles : « avant » seulement tant que le
 * prêt est en cours, « après » même une fois rendu, suppression seulement
 * tant qu'il est en cours. On photographie le matériel, pas les personnes.
 */
@Component({
  selector: 'app-photos-pret',
  imports: [FormsModule],
  template: `
    @if (erreur(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @for (m of moments(); track m.valeur) {
      <section class="moment">
        <h3>{{ m.titre }} <span class="secondaire">({{ parMoment(m.valeur).length }})</span></h3>
        @if (parMoment(m.valeur).length === 0) {
          <p class="secondaire">Aucune photo.</p>
        } @else {
          <ul class="vignettes">
            @for (p of parMoment(m.valeur); track p.id) {
              <li>
                <button type="button" class="vignette" (click)="agrandir(p)"
                        [attr.aria-label]="'Agrandir la photo' + (p.legende ? ' : ' + p.legende : '')">
                  @if (urls()[p.id]; as url) { <img [src]="url" alt=""> } @else { <span class="attente">…</span> }
                </button>
                <span class="legende">
                  {{ p.equipementReference ?? 'Tout le lot' }}@if (p.legende) { · {{ p.legende }}}
                </span>
                @if (!pret().dateRetour) {
                  <button type="button" class="bouton-discret supprimer" (click)="supprimer(p)"
                          [attr.aria-label]="'Supprimer la photo ' + (p.legende ?? '')">Supprimer</button>
                }
              </li>
            }
          </ul>
        }

        @if (m.valeur === 'APRES' || !pret().dateRetour) {
          <div class="ajout">
            <div class="grille">
              <div>
                <label [for]="idChamp(m.valeur, 'equipement')">Équipement photographié</label>
                <select [id]="idChamp(m.valeur, 'equipement')" [(ngModel)]="equipementIds[m.valeur]">
                  <option [ngValue]="null">Tout le lot</option>
                  @for (e of pret().equipements; track e.id) {
                    <option [ngValue]="e.id">{{ e.typeLibelle }} {{ e.reference }}</option>
                  }
                </select>
              </div>
              <div>
                <label [for]="idChamp(m.valeur, 'legende')">Légende</label>
                <input [id]="idChamp(m.valeur, 'legende')" [(ngModel)]="legendes[m.valeur]" maxlength="120"
                       placeholder="Facultatif : accroc, rayure…">
              </div>
            </div>
            <input #fichiers type="file" accept="image/*" multiple class="masque"
                   [id]="idChamp(m.valeur, 'fichiers')" (change)="deposer(m.valeur, $event)">
            <label [for]="idChamp(m.valeur, 'fichiers')" class="bouton-principal bouton-photo"
                   [class.occupe]="envoi() !== null">
              {{ envoi()?.moment === m.valeur ? 'Envoi ' + envoi()!.fait + '/' + envoi()!.total + '…' : 'Prendre ou choisir des photos' }}
            </label>
          </div>
        }
      </section>
    }
    <p class="secondaire">Photographiez le matériel, pas les personnes.</p>

    <dialog #fenetre class="dialogue-photo" (close)="agrandie.set(null)" (click)="fermerSiFond($event)">
      @if (agrandie(); as p) {
        <div class="entete-dialogue">
          <strong>{{ p.moment === 'AVANT' ? 'Avant' : 'Après' }} · {{ p.equipementReference ?? 'Tout le lot' }}</strong>
          <button type="button" class="bouton-discret" (click)="dialogue().nativeElement.close()">Fermer</button>
        </div>
        @if (urls()[p.id]; as url) { <img [src]="url" [alt]="p.legende ?? 'Photo du matériel'"> }
        <p class="secondaire">
          @if (p.legende) { {{ p.legende }} · }
          Prise le {{ dateHeure(p.priseLe) }}@if (p.prisePar) { par {{ p.prisePar }}}
        </p>
      }
    </dialog>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host { display: block; }
    h3 { font-size: .9375rem; margin: var(--pas-2) 0 var(--pas); }
    .moment + .moment { border-top: 1px solid var(--trait); }
    .vignettes { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas);
                 grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
    .vignettes li { display: flex; flex-direction: column; gap: 4px; }
    .vignette { padding: 0; border: 1px solid var(--trait); border-radius: var(--r-s); overflow: hidden;
                aspect-ratio: 1; background: var(--fond); min-height: 44px; }
    .vignette img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .attente { color: var(--craie); }
    .legende { font-size: .8125rem; color: var(--craie); overflow-wrap: anywhere; }
    .supprimer { padding: 4px 8px; font-size: .8125rem; }
    .ajout { margin-top: var(--pas); }
    label { display: block; margin: var(--pas) 0 4px; font-weight: 700; font-size: .875rem; }
    .grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0 var(--pas-2); }
    .masque { position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden; }
    .bouton-photo { display: inline-flex; align-items: center; margin-top: var(--pas); cursor: pointer; }
    .bouton-photo.occupe { background: var(--craie); pointer-events: none; }
    .masque:focus-visible + .bouton-photo { outline: 3px solid var(--profond); outline-offset: 2px; }

    .dialogue-photo {
      width: min(900px, calc(100vw - 16px)); max-height: calc(100dvh - 16px); padding: var(--pas-2);
      border: none; border-radius: var(--r); background: var(--carte); color: var(--encre);
    }
    .dialogue-photo::backdrop { background: rgba(15, 23, 42, .7); }
    .dialogue-photo img { display: block; max-width: 100%; max-height: calc(100dvh - 180px); margin: var(--pas) auto; }
    .entete-dialogue { display: flex; justify-content: space-between; align-items: center; gap: var(--pas); }
  `]
})
export class PhotosPretComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);

  readonly pret = input.required<PretVue>();
  /** Nombre de photos avant et après, à chaque changement : la carte du prêt l'affiche. */
  readonly nombres = output<{ avant: number; apres: number }>();

  readonly dialogue = viewChild.required<ElementRef<HTMLDialogElement>>('fenetre');

  photos = signal<PhotoPretVue[]>([]);
  urls = signal<Record<number, string>>({});
  erreur = signal<string | null>(null);
  envoi = signal<{ moment: MomentPhotoPret; fait: number; total: number } | null>(null);
  agrandie = signal<PhotoPretVue | null>(null);

  equipementIds: Record<MomentPhotoPret, number | null> = { AVANT: null, APRES: null };
  legendes: Record<MomentPhotoPret, string> = { AVANT: '', APRES: '' };

  /** Prêt rendu : les photos « après » d'abord, c'est ce qu'on vient faire. */
  moments = computed(() => {
    const avant = { valeur: 'AVANT' as const, titre: 'Avant le prêt' };
    const apres = { valeur: 'APRES' as const, titre: 'Au retour' };
    return this.pret().dateRetour ? [apres, avant] : [avant, apres];
  });

  ngOnInit(): void {
    void this.charger();
  }

  parMoment(m: MomentPhotoPret): PhotoPretVue[] {
    return this.photos().filter(p => p.moment === m);
  }

  idChamp(m: MomentPhotoPret, champ: string): string {
    return `photo-${this.pret().id}-${m}-${champ}`;
  }

  async deposer(moment: MomentPhotoPret, ev: Event): Promise<void> {
    const champ = ev.target as HTMLInputElement;
    const fichiers = [...(champ.files ?? [])];
    champ.value = '';
    if (fichiers.length === 0) return;
    this.erreur.set(null);
    this.envoi.set({ moment, fait: 0, total: fichiers.length });
    try {
      for (const [i, f] of fichiers.entries()) {
        const reduite = await reduirePhoto(f);
        const photo = await firstValueFrom(this.api.deposerPhotoPret(
          this.pret().id, reduite, moment, this.equipementIds[moment], this.legendes[moment].trim() || null));
        this.photos.set([...this.photos(), photo]);
        this.urls.set({ ...this.urls(), [photo.id]: URL.createObjectURL(reduite) });
        this.envoi.set({ moment, fait: i + 1, total: fichiers.length });
      }
      this.legendes[moment] = '';
    } catch (e) {
      this.erreur.set(e instanceof HttpErrorResponse
        ? e.error?.detail ?? "La photo n'a pas pu être envoyée."
        : "Cette photo n'a pas pu être lue : essayez en JPEG ou PNG.");
    } finally {
      this.envoi.set(null);
      this.signalerNombres();
    }
  }

  supprimer(p: PhotoPretVue): void {
    if (!confirm('Supprimer cette photo ?')) return;
    this.api.supprimerPhotoPret(p.id).subscribe({
      next: () => {
        this.photos.set(this.photos().filter(x => x.id !== p.id));
        const url = this.urls()[p.id];
        if (url) URL.revokeObjectURL(url);
        this.signalerNombres();
      },
      error: (e: HttpErrorResponse) => this.erreur.set(e.error?.detail ?? "La photo n'a pas pu être supprimée.")
    });
  }

  agrandir(p: PhotoPretVue): void {
    this.agrandie.set(p);
    this.dialogue().nativeElement.showModal();
  }

  fermerSiFond(ev: MouseEvent): void {
    if (ev.target === this.dialogue().nativeElement) this.dialogue().nativeElement.close();
  }

  dateHeure(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  }

  ngOnDestroy(): void {
    for (const url of Object.values(this.urls())) URL.revokeObjectURL(url);
  }

  private signalerNombres(): void {
    this.nombres.emit({ avant: this.parMoment('AVANT').length, apres: this.parMoment('APRES').length });
  }

  private async charger(): Promise<void> {
    try {
      this.photos.set(await firstValueFrom(this.api.photosPret(this.pret().id)));
    } catch {
      this.erreur.set('Impossible de charger les photos de ce prêt.');
      return;
    }
    // Les vignettes arrivent une à une : une photo lente ne bloque pas les autres.
    for (const p of this.photos()) {
      this.api.photoPret(p.id).subscribe({
        next: blob => this.urls.set({ ...this.urls(), [p.id]: URL.createObjectURL(blob) }),
        error: () => {}
      });
    }
  }
}
