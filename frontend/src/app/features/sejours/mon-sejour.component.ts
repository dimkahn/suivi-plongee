import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import { ParticipantVue, REGIMES, SejourVue, TRANSPORTS, Trajet, euros, heure, jourLong, nomComplet } from './sejour-api';

/** Où mène chaque tuile : un onglet du séjour, ou la fenêtre « Mes informations ». */
export type CibleMonSejour = 'transports' | 'hebergement' | 'frais' | 'infos';

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

/**
 * La carte « Mon séjour » du participant connecté (demande du club, 2026 :
 * l'ancienne ligne repliée était trop pauvre et peu lisible). Toujours
 * dépliée, une tuile par sujet : voyage aller, voyage retour, voiture,
 * chambre, comptes, et ses informations (téléphone, repas, personne à
 * prévenir). Ce qui manque est dit en tête, avec le bouton pour le donner ;
 * toucher une tuile ouvre l'onglet qui en donne le détail.
 */
@Component({
  selector: 'app-mon-sejour',
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
    }
    @media (max-width: 380px) { .tuiles { grid-template-columns: 1fr; } }
    @media print {
      .mon-sejour { break-inside: avoid; box-shadow: none; }
      .tuile { background: none; }
    }
  `]
})
export class MonSejourComponent {
  sejour = input.required<SejourVue>();
  moi = input.required<ParticipantVue>();
  ouvrir = output<CibleMonSejour>();

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

  readonly tuiles = computed<Tuile[]>(() => {
    const s = this.sejour();
    const m = this.moi();
    return [
      this.tuileTrajet('Voyage aller', m.arrivee, true),
      this.tuileTrajet('Voyage retour', m.depart, false),
      ...this.tuilesVoiture(s, m),
      this.tuileChambre(s, m),
      this.tuileComptes(s, m),
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
    const details = [
      [moyen, t?.lieu].filter(Boolean).join(' · ') || null,
      aller && (t?.heureDepart || t?.lieuDepart)
        ? 'Départ' + (t.heureDepart ? ' à ' + heure(t.heureDepart) : '') + (t.lieuDepart ? ' de ' + t.lieuDepart : '')
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
