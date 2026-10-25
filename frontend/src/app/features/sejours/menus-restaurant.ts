import { Observable } from 'rxjs';
import { REPAS, Repas } from './liste-courses';
import { euros, jourLong } from './sejour-api';

// ----------------------------------------------------------------
//  Les menus des restaurants du séjour (MenusRestaurantService) :
//  l'organisateur importe le classeur Excel du menu d'un repas,
//  chacun y choisit ses plats, l'organisateur lit la commande.
// ----------------------------------------------------------------

export interface PlatVue {
  id: number;
  categorie: string | null;
  nom: string;
  description: string | null;
  prixCentimes: number | null;
}

export interface CommandeVue {
  plats: { platId: number; nombre: number }[];
  /** {@code payeDeSonCote} : l'addition est payée sans lui dans les frais (il règle sa part lui-même). */
  participants: {
    participantId: number; nom: string; prenom: string; platIds: number[]; totalCentimes: number; payeDeSonCote: boolean
  }[];
  sansChoix: { participantId: number; nom: string; prenom: string }[];
  totalCentimes: number;
}

export interface MenuVue {
  id: number;
  jour: string;
  repas: Repas;
  restaurant: string | null;
  plats: PlatVue[];
  /** Les plats choisis par celui qui lit (vide s'il n'est pas inscrit). */
  monChoix: number[];
  /** La commande complète : pour les organisateurs seulement (null sinon, filtré par le serveur). */
  commande: CommandeVue | null;
  /** L'addition payée (payeurId null : par le club) ; null tant qu'elle ne l'est pas. Les choix ne changent plus ensuite. */
  reglement: { payeurId: number | null; nom: string | null; prenom: string | null } | null;
}

export interface DemandeMenu {
  restaurant: string | null;
  plats: { id: number | null; categorie: string | null; nom: string; description: string | null; prixCentimes: number | null }[];
}

export interface MenusVue {
  menus: MenuVue[];
  /** Le participant de celui qui lit ; null s'il n'est pas inscrit (un encadrant qui n'y va pas). */
  participantId: number | null;
  gere: boolean;
}

/** Lire, importer, supprimer et choisir ; chaque appel renvoie les menus à jour. */
export interface PortMenus {
  lire(): Observable<MenusVue>;
  importer(jour: string, repas: Repas, restaurant: string, fichier: File): Observable<MenusVue>;
  supprimer(menuId: number): Observable<MenusVue>;
  /** Le menu corrigé à la main : les plats dans l'ordre (id null : ajouté) ; un plat absent est retiré. */
  modifier(menuId: number, demande: DemandeMenu): Observable<MenusVue>;
  /**
   * L'addition payée par {@code payeurId} (null : le club) : une dépense par personne dans les frais,
   * sauf pour {@code deLeurCote}, qui paient eux-mêmes leur part.
   */
  regler(menuId: number, payeurId: number | null, deLeurCote: number[]): Observable<MenusVue>;
  /** {@code participantId} : soi-même, ou un autre participant pour un organisateur (ignoré par la page du lien). */
  choisir(menuId: number, participantId: number, platIds: number[]): Observable<MenusVue>;
}

/**
 * Le prompt à donner à une IA (ChatGPT, Claude, Le Chat…) avec la photo ou
 * le PDF du menu, pour obtenir le fichier que lit le serveur (LecteurMenu).
 */
export const PROMPT_MENU = `Voici le menu d'un restaurant (photo, PDF ou texte joint). Fabrique-moi un fichier Excel (.xlsx) à télécharger, avec :
- une seule feuille ;
- en première ligne, exactement ces 4 en-têtes : Catégorie | Plat | Description | Prix ;
- puis une ligne par plat ou boisson, dans l'ordre du menu.
Catégorie : comme sur le menu (Entrée, Plat, Dessert, Boisson, Menu enfant, Formule…).
Plat : le nom tel qu'il est écrit.
Description : la garniture ou la composition si elle est indiquée, sinon vide.
Prix : en euros, un nombre seul (par exemple 12,50), sans le symbole €, vide s'il n'est pas indiqué. Pour un plat proposé à deux prix (verre ou bouteille, petite ou grande), fais deux lignes.
N'invente rien : ce qui est illisible reste vide. Pas de titre, de ligne de total ni de cellules fusionnées.`;

/** « Dîner du samedi 05/06/2027 ». */
export function repasDuJour(m: { jour: string; repas: Repas }): string {
  const libelle = REPAS.find(r => r.code === m.repas)?.libelle ?? m.repas;
  const jour = jourLong(m.jour);
  return `${libelle} du ${jour.charAt(0).toLowerCase()}${jour.slice(1)}`;
}

/** Les plats par catégorie, dans l'ordre de leur première apparition ; ceux sans catégorie à la fin (« Autres »). */
export function parCategorie(plats: PlatVue[]): { categorie: string; plats: PlatVue[] }[] {
  const groupes = new Map<string, PlatVue[]>();
  for (const p of plats.filter(x => x.categorie)) {
    groupes.set(p.categorie!, [...(groupes.get(p.categorie!) ?? []), p]);
  }
  const autres = plats.filter(x => !x.categorie);
  if (autres.length > 0) groupes.set('Autres', [...(groupes.get('Autres') ?? []), ...autres]);
  return [...groupes].map(([categorie, liste]) => ({ categorie, plats: liste }));
}

/**
 * Le prix saisi dans le menu modifié, en centimes : « 12,50 », « 12.5 € » ou « 9 ».
 * Null : sans prix (case vide) ; undefined : ce n'est pas un prix.
 */
export function prixEnCentimes(texte: string): number | null | undefined {
  const t = texte.replace('€', '').trim();
  if (t === '') return null;
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(t);
  if (!m) return undefined;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

/** « 12,50 » : le prix à modifier ; vide sans prix. */
export function prixEnTexte(centimes: number | null): string {
  return centimes === null ? '' : `${Math.floor(centimes / 100)},${String(centimes % 100).padStart(2, '0')}`;
}

/** Le prix des plats choisis ; un plat sans prix compte pour rien. */
export function totalDuChoix(plats: PlatVue[], platIds: number[]): number {
  return plats.filter(p => platIds.includes(p.id)).reduce((t, p) => t + (p.prixCentimes ?? 0), 0);
}

/**
 * La commande en texte, à envoyer au restaurant : plats par catégorie, puis
 * le détail par personne, en prénom et initiale du nom seulement (le texte
 * sort du club, des mineurs sont suivis) ; ceux qui n'ont pas choisi restent
 * à l'écran.
 */
export function texteDeLaCommande(m: MenuVue): string {
  const c = m.commande;
  if (!c) return '';
  const repas = repasDuJour(m);
  const lignes = [`Commande — ${m.restaurant ? m.restaurant + ', ' : ''}${repas.charAt(0).toLowerCase()}${repas.slice(1)}`, ''];
  const nombre = new Map(c.plats.map(l => [l.platId, l.nombre]));
  for (const g of parCategorie(m.plats.filter(p => nombre.has(p.id)))) {
    lignes.push(g.categorie);
    for (const p of g.plats) lignes.push(`- ${nombre.get(p.id)} × ${p.nom}`);
    lignes.push('');
  }
  const nom = new Map(m.plats.map(p => [p.id, p.nom]));
  lignes.push('Par personne');
  for (const p of c.participants) {
    lignes.push(`- ${p.prenom} ${p.nom.charAt(0).toUpperCase()}. : ${p.platIds.map(id => nom.get(id)).join(', ')}`);
  }
  if (c.totalCentimes > 0) lignes.push('', `Total : ${euros(c.totalCentimes)}`);
  return lignes.join('\n');
}
