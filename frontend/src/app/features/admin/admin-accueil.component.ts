import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Ecran {
  lien: string;
  nom: string;
  detail: string;
}

/**
 * Les écrans d'administration, rangés par moment de l'année plutôt qu'en
 * une seule liste : on retrouve d'un coup d'œil ce qui sert à la rentrée,
 * ce qui sert chaque semaine, et ce qui ne bouge presque jamais.
 */
const RUBRIQUES: { titre: string; aide: string; ecrans: Ecran[] }[] = [
  {
    titre: 'Début de saison',
    aide: 'Dans l\'ordre : la saison, ses séances, les inscriptions, puis les groupes.',
    ecrans: [
      { lien: '/admin/saisons', nom: 'Saisons', detail: 'Ouverture et fermeture des saisons, progressions suivies' },
      { lien: '/admin/seances', nom: 'Séances',
        detail: 'Calendrier de la saison : créer, modifier, générer une saison ou un séjour' },
      { lien: '/admin/cursus', nom: 'Inscriptions', detail: 'Inscrire un élève dans une formation, changer de niveau' },
      { lien: '/admin/groupes-entrainement', nom: 'Groupes d\'entraînement',
        detail: 'Groupes de la saison, encadrants attitrés, lignes d\'eau et fosse, élèves' }
    ]
  },
  {
    titre: 'Chaque semaine',
    aide: 'Les soirées au bassin et les sorties en milieu naturel.',
    ecrans: [
      { lien: '/admin/planning', nom: 'Planning du bassin',
        detail: 'Soir par soir : ligne d\'eau ou fosse de chaque groupe, DP fosse et DP piscine' },
      { lien: '/admin/sorties', nom: 'Sorties',
        detail: 'Week-ends et séjours : dates, lieu, plongées qui en font partie ; prêts de matériel' }
    ]
  },
  {
    titre: 'Personnes',
    aide: 'Les comptes des encadrants et de la sécurité surface, les dossiers des élèves.',
    ecrans: [
      { lien: '/admin/moniteurs', nom: 'Moniteurs',
        detail: 'Comptes des encadrants : ajout, modification, niveau, activation, mot de passe' },
      { lien: '/admin/securite-surface', nom: 'Sécurité surface',
        detail: 'Comptes de qui n\'est pas moniteur : séances confiées, fin d\'accès, réactivation' },
      { lien: '/admin/eleves', nom: 'Élèves', detail: 'Dossiers, autorisations, droit à l\'image' },
      { lien: '/admin/relances-caci', nom: 'Relances CACI',
        detail: 'Historique des e-mails de relance des certificats médicaux, gardé deux ans' }
    ]
  },
  {
    titre: 'Matériel',
    aide: 'Le domaine du directeur technique, que l\'administrateur supplée.',
    ecrans: [
      { lien: '/materiel', nom: 'Inventaire du matériel',
        detail: 'Blocs, détendeurs, gilets, combinaisons : fiches, contrôles, TIV, étiquettes, import Excel' },
      { lien: '/materiel/prets', nom: 'Prêts de matériel', detail: 'Prêter, rendre, photos avant et après' }
    ]
  },
  {
    titre: 'Contenu pédagogique',
    aide: 'Ce qui se règle rarement : le MFT, ses exercices et les progressions du club.',
    ecrans: [
      { lien: '/admin/referentiel', nom: 'Référentiel MFT', detail: 'Créer, modifier et supprimer versions, compétences et critères' },
      { lien: '/admin/exercices', nom: 'Base d\'exercices',
        detail: 'Exercices d\'initiation, de perfectionnement et de maîtrise de chaque compétence' },
      { lien: '/admin/progressions', nom: 'Progressions types',
        detail: 'Chaque niveau découpé en périodes de mois ou en plongées, avec les compétences travaillées' }
    ]
  },
  {
    titre: 'Structure',
    aide: 'Ce qui se règle une fois, à l\'installation.',
    ecrans: [
      { lien: '/admin/identite', nom: 'Identité de la structure',
        detail: 'Nom, logo et couleurs du club ou du centre : connexion, écrans, icône de l\'appli, documents' }
    ]
  }
];

@Component({
  selector: 'app-admin-accueil',
  imports: [RouterLink],
  template: `
    <h1>Administration</h1>
    <p class="secondaire">Gestion du club : comptes, élèves, saisons, séances et inscriptions.</p>

    @for (r of rubriques; track r.titre) {
      <section class="rubrique" [attr.aria-labelledby]="'rubrique-' + $index">
        <h2 [id]="'rubrique-' + $index">{{ r.titre }}</h2>
        <p class="secondaire">{{ r.aide }}</p>
        <ul>
          @for (e of r.ecrans; track e.lien) {
            <li class="carte">
              <a [routerLink]="e.lien">
                <span class="nom">{{ e.nom }}</span>
                <span class="secondaire">{{ e.detail }}</span>
              </a>
            </li>
          }
        </ul>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .rubrique { margin-top: var(--pas-4); }
    .rubrique h2 { margin-bottom: 4px; }
    .rubrique > p { margin-bottom: var(--pas-2); }
    ul {
      list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2);
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    }
    li a {
      display: flex; flex-direction: column; gap: 2px; padding: var(--pas-2); height: 100%;
      text-decoration: none; color: inherit; min-height: 44px;
    }
    .nom { font-weight: 700; }
  `]
})
export class AdminAccueilComponent {
  readonly rubriques = RUBRIQUES;
}
