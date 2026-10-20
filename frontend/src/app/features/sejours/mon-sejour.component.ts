import { Component, ChangeDetectionStrategy, OnInit, computed, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { dateFr } from '../../core/date-fr';
import { nomEquipement } from '../../core/nom-equipement';
import { MonMateriel, PretsDuSejour, monMateriel } from './materiel-sejour';
import { CarteVoyageComponent } from './carte-voyage.component';
import { ParticipantVue, REGIMES, SejourVue, TRANSPORTS, Trajet, euros, heure, jourLong, nomComplet } from './sejour-api';

/**
 * Où mène chaque tuile : un onglet du séjour, ou la fenêtre « Mes informations » ;
 * « declarer » : l'onglet « Matériel », fenêtre de déclaration ouverte.
 */
export type CibleMonSejour = 'transports' | 'hebergement' | 'frais' | 'materiel' | 'declarer' | 'infos';

interface Tuile {
  cible: CibleMonSejour;
  etiquette: string;
  /** La ligne en gras ; null : rien de renseigné, la tuile affiche « à préciser ». */
  principal: string | null;
  details: string[];
  /** Vide, ou à compléter par le participant lui-même : la tuile est soulignée. */
  aCompleter: boolean;
  vide: string;
}

/** Un voyage par un transport public, avec au moins son jour ou son heure : montré en carte. */
function enCarte(t: Trajet | null): boolean {
  return !!t && (!!t.date || !!t.heure) && ['AVION', 'TRAIN', 'BATEAU', 'CAR'].includes(t.transport ?? '');
}

/**
 * La carte « Mon séjour » du participant connecté (demande du club, 2026 :
 * l'ancienne ligne repliée était trop pauvre et peu lisible). Toujours
 * dépliée, une tuile par sujet : voyage aller, voyage retour, voiture,
 * chambre, comptes, matériel emprunté, et ses informations (téléphone,
 * repas, personne à prévenir). Ce qui manque est dit en tête, avec le
 * bouton pour le donner ; toucher une tuile ouvre l'onglet qui en donne le
 * détail. Tant qu'il n'a ni déclaré d'emprunt ni dit n'avoir rien emprunté,
 * un encart lui demande s'il a pris du matériel du club (demande du club,
 * 2026).
 */
@Component({
  selector: 'app-mon-sejour',
  imports: [CarteVoyageComponent],
  template: `
    <section class="carte mon-sejour" aria-labelledby="titre-mon-sejour">
      <div class="tete">
        <h2 id="titre-mon-sejour">Mon séjour</h2>
        <span class="pastille">{{ moi().plongeur ? 'Plongeur' : 'Accompagnant' }}</span>
        <button type="button" class="bouton-principal sans-impression" (click)="ouvrir.emit('infos')">
          Modifier mes informations
        </button>
      </div>
      @if (manque().length > 0) {
        <p class="a-completer sans-impression">À compléter : {{ manque().join(', ') }}.</p>
      }
      @if (materiel()?.etat === 'question') {
        <div class="question-materiel sans-impression" role="group" aria-labelledby="question-materiel">
          <p id="question-materiel" class="question">Avez-vous emprunté du matériel du club ?</p>
          <p class="precision">Bloc, détendeur, gilet, combinaison : déclarez-le, le directeur technique saura où il est.</p>
          <div class="reponses">
            <button type="button" class="bouton-principal" (click)="ouvrir.emit('declarer')">
              Oui, je déclare mon matériel
            </button>
            <button type="button" class="bouton-discret" (click)="rienEmprunte()" [disabled]="envoi()">
              @if (envoi()) { Envoi… } @else { Non, je n'ai rien emprunté }
            </button>
          </div>
          @if (erreur(); as e) { <p class="erreur" role="alert">{{ e }}</p> }
        </div>
      }
      @if (voyages().length > 0) {
        <div class="voyages">
          @for (v of voyages(); track v.etiquette) {
            <app-carte-voyage [trajet]="v.trajet" [aller]="v.aller" [etiquette]="v.etiquette" />
          }
        </div>
      }
      <ul class="tuiles">
        @for (t of tuiles(); track t.etiquette) {
          <li>
            <button type="button" class="tuile" [class.manquant]="t.aCompleter" (click)="ouvrir.emit(t.cible)">
              <span class="etiquette">{{ t.etiquette }}</span>
              @if (t.principal) {
                <strong class="principal">{{ t.principal }}</strong>
              } @else {
                <span class="principal vide">{{ t.vide }}</span>
              }
              @for (d of t.details; track $index) { <span class="detail">{{ d }}</span> }
            </button>
          </li>
        }
      </ul>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .mon-sejour { margin: var(--pas-2) 0; padding: var(--pas-2); border-left: 6px solid var(--profond); }
    .tete { display: flex; align-items: center; gap: var(--pas); flex-wrap: wrap; }
    .tete h2 { margin: 0; }
    .tete .bouton-principal { margin-left: auto; }
    .pastille { padding: 2px 10px; border-radius: var(--r-s); font-size: .8125rem; font-weight: 700;
                background: #E0F2FE; color: var(--profond-fonce); }
    .a-completer { margin: var(--pas) 0 0; padding: var(--pas) var(--pas-2); border-radius: var(--r-s);
                   background: var(--en-cours-clair); color: var(--en-cours); font-weight: 700; }
    .question-materiel { margin: var(--pas-2) 0 0; padding: var(--pas-2); border-radius: var(--r-s);
                         border: 2px solid var(--en-cours); background: var(--en-cours-clair); }
    .question { margin: 0; font-size: 1.125rem; font-weight: 700; color: var(--en-cours); }
    .precision { margin: 4px 0 0; font-size: .9375rem; }
    .reponses { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas); }
    .erreur { margin: var(--pas) 0 0; color: #B91C1C; font-weight: 700; }
    /* grid-auto-rows : aller et retour de même hauteur, côte à côte comme l'un sous l'autre. */
    .voyages { display: grid; gap: var(--pas); margin-top: var(--pas-2); grid-auto-rows: 1fr;
               grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
    @media (max-width: 380px) { .voyages { grid-template-columns: 1fr; } }
    .tuiles { list-style: none; margin: var(--pas-2) 0 0; padding: 0; display: grid; gap: var(--pas);
              grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
    .tuile { width: 100%; height: 100%; min-height: 44px; margin: 0; padding: var(--pas) var(--pas-2);
             display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left;
             background: #F8FAFC; border: 1px solid var(--trait); border-radius: var(--r-s);
             color: inherit; font: inherit; cursor: pointer; }
    .tuile:hover { border-color: var(--profond); }
    .tuile.manquant { border-color: var(--en-cours); background: var(--en-cours-clair); }
    .etiquette { font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--craie); }
    .principal { font-size: 1rem; color: var(--profond-fonce); }
    .principal.vide { font-weight: 700; color: var(--en-cours); }
    .detail { font-size: .875rem; color: var(--craie); }
    @media (max-width: 640px) {
      .tuiles { grid-template-columns: 1fr 1fr; }
      .tete .bouton-principal { margin-left: 0; width: 100%; }
      .reponses button { width: 100%; }
    }
    @media (max-width: 380px) { .tuiles { grid-template-columns: 1fr; } }
    @media print {
      .mon-sejour { break-inside: avoid; box-shadow: none; }
      .tuile { background: none; }
    }
  `]
})
export class MonSejourComponent implements OnInit {
  sejour = input.required<SejourVue>();
  moi = input.required<ParticipantVue>();
  /** Le matériel emprunté, partagé avec l'onglet « Matériel » ; sans lui, ni question ni tuile. */
  prets = input<PretsDuSejour | null>(null);
  ouvrir = output<CibleMonSejour>();

  envoi = signal(false);
  erreur = signal<string | null>(null);

  readonly materiel = computed<MonMateriel | null>(() => monMateriel(this.prets()?.vue() ?? null, this.moi().id));

  ngOnInit(): void {
    // Sans réseau, ni question ni tuile : l'onglet « Matériel » dit l'erreur.
    this.prets()?.lire().subscribe({ error: () => undefined });
  }

  rienEmprunte(): void {
    const prets = this.prets();
    if (!prets) return;
    this.envoi.set(true);
    this.erreur.set(null);
    prets.rienEmprunte(true).subscribe({
      next: () => this.envoi.set(false),
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.erreur.set(e.error?.detail ?? "La réponse n'a pas pu être enregistrée (réseau nécessaire).");
      }
    });
  }

  /** Ce que le participant peut encore donner lui-même par « Modifier mes informations ». */
  readonly manque = computed(() => {
    const m = this.moi();
    const rien = (t: Trajet | null) => !t?.date && !t?.heure;
    return [
      rien(m.arrivee) ? 'votre voyage aller' : null,
      rien(m.depart) ? 'votre voyage retour' : null,
      !m.telephone ? 'votre téléphone' : null,
      !m.urgenceNom && !m.urgenceTelephone ? 'la personne à prévenir' : null
    ].filter((x): x is string => x !== null);
  });

  /**
   * Les voyages en avion, train, bateau ou car, en carte (heures face à face,
   * terminal, enregistrement, dossier) ; les autres restent en tuile.
   */
  readonly voyages = computed(() => {
    const m = this.moi();
    return [
      { etiquette: 'Voyage aller', trajet: m.arrivee, aller: true },
      { etiquette: 'Voyage retour', trajet: m.depart, aller: false }
    ].filter((v): v is { etiquette: string; trajet: Trajet; aller: boolean } => enCarte(v.trajet));
  });

  readonly tuiles = computed<Tuile[]>(() => {
    const s = this.sejour();
    const m = this.moi();
    return [
      ...(enCarte(m.arrivee) ? [] : [this.tuileTrajet('Voyage aller', m.arrivee, true)]),
      ...(enCarte(m.depart) ? [] : [this.tuileTrajet('Voyage retour', m.depart, false)]),
      ...this.tuilesVoiture(s, m),
      this.tuileChambre(s, m),
      this.tuileComptes(s, m),
      ...this.tuileMateriel(),
      this.tuileInfos(m)
    ];
  });

  private nomDe(id: number | null): string {
    const p = this.sejour().participants.find(x => x.id === id);
    return p ? nomComplet(p) : '?';
  }

  /** « Vendredi 04/06 à 10h35 », « avion AF7520 · Toulon-Hyères », « départ à 8h50 de Paris-Orly ». */
  private tuileTrajet(etiquette: string, t: Trajet | null, aller: boolean): Tuile {
    const saisi = !!(t?.date || t?.heure);
    const quand = t?.date ? jourLong(t.date).slice(0, -5) + (t.heure ? ' à ' + heure(t.heure) : '')
      : t?.heure ? 'À ' + heure(t.heure) : null;
    const moyen = [TRANSPORTS.find(x => x.code === t?.transport)?.libelle, t?.numero].filter(Boolean).join(' ');
    // Le jour où part (aller) ou arrive (retour) l'avion, s'il n'est pas celui du trajet : « le samedi 05/06 ».
    const autre = aller ? t?.dateDepart : t?.dateArrivee;
    const leJour = autre && autre !== t?.date ? ' le ' + jourLong(autre).slice(0, -5).toLowerCase() : '';
    const details = [
      [moyen, t?.lieu].filter(Boolean).join(' · ') || null,
      aller && (t?.heureDepart || t?.lieuDepart || leJour)
        ? 'Départ' + leJour + (t?.heureDepart ? ' à ' + heure(t.heureDepart) : '') + (t?.lieuDepart ? ' de ' + t.lieuDepart : '')
        : null,
      !aller && (t?.heureArrivee || t?.lieuArrivee || leJour)
        ? 'Arrivée' + leJour + (t?.heureArrivee ? ' à ' + heure(t.heureArrivee) : '') + (t?.lieuArrivee ? ' à ' + t.lieuArrivee : '')
        : null
    ].filter((x): x is string => !!x);
    return { cible: 'transports', etiquette, principal: saisi ? quand : null, details, aCompleter: !saisi, vide: 'À préciser' };
  }

  private tuilesVoiture(s: SejourVue, m: ParticipantVue): Tuile[] {
    const voitures = s.voitures.filter(v => v.conducteurId === m.id || v.passagerIds.includes(m.id));
    if (voitures.length === 0) {
      return s.voitures.length === 0 ? []
        : [{ cible: 'transports', etiquette: 'Voiture', principal: null, details: [], aCompleter: false, vide: 'Pas de place' }];
    }
    return voitures.map(v => {
      const passagers = v.passagerIds.filter(i => i !== m.id).map(i => this.nomDe(i));
      return {
        cible: 'transports' as const, etiquette: 'Voiture', principal: v.nom,
        details: [
          v.conducteurId === m.id ? 'Vous conduisez' : v.conducteurId ? 'Conduite par ' + this.nomDe(v.conducteurId) : 'Conducteur à trouver',
          v.trajet,
          passagers.length ? 'Avec ' + passagers.join(', ') : null
        ].filter((x): x is string => !!x),
        aCompleter: false, vide: ''
      };
    });
  }

  private tuileChambre(s: SejourVue, m: ParticipantVue): Tuile {
    for (const l of s.logements) {
      const c = l.chambres.find(ch => ch.occupantIds.includes(m.id));
      if (c) {
        const avec = c.occupantIds.filter(o => o !== m.id).map(o => this.nomDe(o));
        return {
          cible: 'hebergement', etiquette: 'Chambre', principal: c.nom,
          details: [l.nom, l.adresse, avec.length ? 'Avec ' + avec.join(', ') : 'Seul(e)'].filter((x): x is string => !!x),
          aCompleter: false, vide: ''
        };
      }
    }
    return {
      cible: 'hebergement', etiquette: 'Chambre', principal: null, details: [], aCompleter: false,
      vide: s.logements.length ? 'Pas encore attribuée' : 'Logement à venir'
    };
  }

  /** Son solde (payé, sa part) et les remboursements qui le concernent. */
  private tuileComptes(s: SejourVue, m: ParticipantVue): Tuile {
    const solde = s.frais.comptes.soldes.find(x => x.participantId === m.id);
    const lignes = s.frais.comptes.remboursements
      .filter(r => r.deId === m.id || r.aId === m.id)
      .map(r => r.deId === m.id
        ? `Vous devez ${euros(r.montantCentimes)} à ${this.nomDe(r.aId)}`
        : `${this.nomDe(r.deId)} vous doit ${euros(r.montantCentimes)}`);
    if (!solde || (solde.payeCentimes === 0 && solde.duCentimes === 0)) {
      return { cible: 'frais', etiquette: 'Mes comptes', principal: null, details: lignes, aCompleter: false, vide: 'Aucune dépense pour vous' };
    }
    const principal = lignes.length === 0 ? 'À l\'équilibre'
      : solde.soldeCentimes < 0 ? `Vous devez ${euros(-solde.soldeCentimes)}` : `On vous doit ${euros(solde.soldeCentimes)}`;
    return {
      cible: 'frais', etiquette: 'Mes comptes', principal,
      details: [`Payé ${euros(solde.payeCentimes)} · votre part ${euros(solde.duCentimes)}`, ...lignes],
      aCompleter: false, vide: ''
    };
  }

  /** Ses emprunts (« Gilet G-12, Bloc B-07 »), ou « Rien emprunté » ; pendant la question, pas de tuile. */
  private tuileMateriel(): Tuile[] {
    const mm = this.materiel();
    if (mm?.etat === 'rien') {
      return [{ cible: 'materiel', etiquette: 'Matériel emprunté', principal: 'Aucun',
                details: ['Vous avez dit n\'avoir rien emprunté'], aCompleter: false, vide: '' }];
    }
    if (mm?.etat !== 'emprunts') return [];
    const enCours = mm.prets.filter(p => !p.dateRetour);
    const retour = enCours.map(p => p.dateRetourPrevue).filter((d): d is string => !!d).sort()[0];
    return [{
      cible: 'materiel', etiquette: 'Matériel emprunté',
      principal: mm.prets.flatMap(p => p.equipements).map(e => `${e.typeLibelle} ${nomEquipement(e)}`).join(', '),
      details: [
        enCours.length === 0 ? 'Tout est rendu' : retour ? 'À rendre le ' + dateFr(retour) : null,
        enCours.some(p => p.enRetard) ? 'En retard' : null
      ].filter((x): x is string => !!x),
      aCompleter: enCours.some(p => p.enRetard), vide: ''
    }];
  }

  private tuileInfos(m: ParticipantVue): Tuile {
    const regimes = REGIMES.filter(r => m.regimes.includes(r.code)).map(r => r.libelle.toLowerCase()).join(', ');
    const urgence = [m.urgenceNom, m.urgenceTelephone].filter(Boolean).join(', ');
    return {
      cible: 'infos', etiquette: 'Mes informations', principal: m.telephone,
      details: [
        'Repas : ' + (regimes || 'sans régime particulier') + (m.regimePrecision ? ` (${m.regimePrecision})` : ''),
        'À prévenir : ' + (urgence || 'à préciser')
      ],
      aCompleter: !m.telephone || !urgence, vide: 'Téléphone à préciser'
    };
  }
}
