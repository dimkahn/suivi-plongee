/**
 * Les manuels d'utilisation de l'appli, un fichier Markdown par
 * fonctionnalité (manuels/*.md, voir manuels/LISEZ-MOI.md pour le format).
 * Ils sont embarqués dans l'appli : la FAQ marche sans réseau et sans
 * serveur, et un manuel change avec l'écran qu'il décrit, au même commit.
 */

/** Un morceau de texte : simple, en gras, ou lien vers un écran de l'appli. */
export interface Segment {
  texte: string;
  gras?: boolean;
  /** Adresse dans l'appli (« /presences »). */
  lien?: string;
}

export type Bloc =
  | { type: 'titre'; texte: string }
  | { type: 'paragraphe'; segments: Segment[] }
  | { type: 'liste'; ordonnee: boolean; elements: Segment[][] };

export interface Manuel {
  /** Le nom du fichier sans « .md » : sert d'adresse (/aide?m=…). */
  id: string;
  titre: string;
  rubrique: string;
  /** Les vidéos d'aide qui montrent la fonctionnalité (« M3 »). */
  videos: string[];
  /** L'écran de l'appli concerné, s'il y en a un. */
  ecran: string | null;
  /** Les questions auxquelles le manuel répond, telles qu'on les poserait. */
  questions: string[];
  /** Le premier paragraphe : la réponse courte. */
  resume: Segment[];
  blocs: Bloc[];
  /** Pour la recherche : les racines des mots, calculées une fois. */
  recherche: { fort: string[]; faible: string[] };
}

/** L'ordre des rubriques, le même que celui de la page des vidéos. */
export const RUBRIQUES = ['Découverte', 'Moniteur', 'Administrateur', 'Directeur technique', 'Élève'];

/**
 * Lit un manuel : un en-tête entre deux lignes « --- » (titre, rubrique,
 * videos, ecran, mots, puis la liste des questions), puis le texte en
 * Markdown simple (## titres, listes « - » ou « 1. », **gras**,
 * [lien](/ecran)).
 */
export function lireManuel(id: string, source: string): Manuel {
  const lignes = source.replace(/\r\n?/g, '\n').split('\n');
  if (lignes[0]?.trim() !== '---') throw new Error(`Manuel ${id} : l'en-tête « --- » manque.`);
  const fin = lignes.indexOf('---', 1);
  if (fin < 0) throw new Error(`Manuel ${id} : l'en-tête n'est pas refermé par « --- ».`);

  const entete: Record<string, string> = {};
  const questions: string[] = [];
  for (const ligne of lignes.slice(1, fin)) {
    const question = /^\s*-\s+(.+)$/.exec(ligne);
    if (question) { questions.push(question[1].trim()); continue; }
    const champ = /^(\w+)\s*:\s*(.*)$/.exec(ligne);
    if (champ) entete[champ[1]] = champ[2].trim();
  }
  const blocs = lireBlocs(lignes.slice(fin + 1));
  const premier = blocs.findIndex(b => b.type === 'paragraphe');
  const resume = premier >= 0 ? (blocs[premier] as { segments: Segment[] }).segments : [];
  const titre = entete['titre'] || id;
  const motsCles = entete['mots'] ?? '';

  return {
    id,
    titre,
    rubrique: entete['rubrique'] || 'Découverte',
    videos: liste(entete['videos']),
    ecran: entete['ecran'] || null,
    questions,
    resume,
    blocs: blocs.filter((_, i) => i !== premier),
    recherche: {
      fort: motsUtiles([titre, motsCles, ...questions].join(' ')),
      faible: motsUtiles(lignes.slice(fin + 1).join(' '))
    }
  };
}

function liste(valeur: string | undefined): string[] {
  return (valeur ?? '').split(',').map(v => v.trim()).filter(v => v.length > 0);
}

function lireBlocs(lignes: string[]): Bloc[] {
  const blocs: Bloc[] = [];
  let paragraphe: string[] = [];
  let enListe: { ordonnee: boolean; elements: string[] } | null = null;

  const fermer = () => {
    if (paragraphe.length) blocs.push({ type: 'paragraphe', segments: lireSegments(paragraphe.join(' ')) });
    if (enListe) blocs.push({ type: 'liste', ordonnee: enListe.ordonnee, elements: enListe.elements.map(lireSegments) });
    paragraphe = [];
    enListe = null;
  };

  for (const brute of lignes) {
    const ligne = brute.trim();
    const titre = /^#{1,4}\s+(.+)$/.exec(ligne);
    const puce = /^[-*]\s+(.+)$/.exec(ligne);
    const numero = /^\d+[.)]\s+(.+)$/.exec(ligne);
    if (ligne === '') {
      fermer();
    } else if (titre) {
      fermer();
      blocs.push({ type: 'titre', texte: titre[1] });
    } else if (puce || numero) {
      const ordonnee = !!numero;
      if (paragraphe.length || (enListe && enListe.ordonnee !== ordonnee)) fermer();
      enListe ??= { ordonnee, elements: [] };
      enListe.elements.push((puce ?? numero)![1]);
    } else if (enListe) {
      // Suite d'un élément de liste écrit sur plusieurs lignes.
      enListe.elements[enListe.elements.length - 1] += ' ' + ligne;
    } else {
      paragraphe.push(ligne);
    }
  }
  fermer();
  return blocs;
}

/** **gras** et [texte](/ecran) ; le reste est du texte simple. */
export function lireSegments(texte: string): Segment[] {
  const segments: Segment[] = [];
  const motif = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let position = 0;
  for (let m = motif.exec(texte); m; m = motif.exec(texte)) {
    if (m.index > position) segments.push({ texte: texte.slice(position, m.index) });
    if (m[1] !== undefined) {
      segments.push({ texte: m[1], gras: true });
    } else if (m[3].startsWith('/')) {
      segments.push({ texte: m[2], lien: m[3] });
    } else {
      // Pas de lien vers l'extérieur depuis un manuel : le texte seul.
      segments.push({ texte: m[2] });
    }
    position = m.index + m[0].length;
  }
  if (position < texte.length) segments.push({ texte: texte.slice(position) });
  return segments;
}

/** Minuscules, sans accents ni ponctuation : « Où est mon groupe ? » → « ou est mon groupe ». */
export function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Les mots qui ne disent rien de la question posée. */
const MOTS_VIDES = new Set((
  'a ai au aux avec c ca ce ces cet cette comment d dans de des du elle en est et etre faire fait il ils j je ' +
  'l la le les leur lui m ma me mes moi mon n ne on ou par pas peut peux pour quand que quel quelle quels ' +
  'quelles qui quoi s sa se ses si son sur t ta te tes toi ton tu un une vous votre vos y'
).split(' '));

function motsUtiles(texte: string): string[] {
  return [...new Set(normaliser(texte).split(' ')
    .filter(m => m.length > 1 && !MOTS_VIDES.has(m))
    .map(racine))];
}

/** Une racine grossière, pour que « séances » trouve « séance » et « noter » trouve « notation ». */
function racine(mot: string): string {
  let r = mot;
  if (r.length > 4) r = r.replace(/(ations?|ements?|ement|ees?|es|er|ez|s|x)$/, '');
  return r;
}

/** « not » trouve « notation » ; « seances » trouve « seanc » ; « N2 » ou « DP », seulement eux-mêmes. */
function contient(champ: string[], racineCherchee: string): boolean {
  if (racineCherchee.length < 3) return champ.includes(racineCherchee);
  return champ.some(m => m.startsWith(racineCherchee) || (m.length >= 4 && racineCherchee.startsWith(m)));
}

/**
 * Les manuels qui répondent le mieux à une question, du plus pertinent au
 * moins pertinent. Un mot trouvé dans le titre, les mots-clés ou les
 * questions compte triple ; trouvé seulement dans le texte, simple. On ne
 * garde que les manuels assez proches du meilleur.
 */
export function chercher(manuels: Manuel[], question: string): Manuel[] {
  const cherches = motsUtiles(question);
  if (cherches.length === 0) return [];
  const notes = manuels.map(m => {
    const { fort, faible } = m.recherche;
    let note = 0;
    for (const c of cherches) {
      if (contient(fort, c)) note += 3;
      else if (contient(faible, c)) note += 1;
    }
    return { m, note };
  }).filter(n => n.note > 0);
  if (notes.length === 0) return [];
  const meilleure = Math.max(...notes.map(n => n.note));
  return notes
    .filter(n => n.note >= meilleure * 0.5)
    .sort((a, b) => b.note - a.note)
    .slice(0, 8)
    .map(n => n.m);
}
