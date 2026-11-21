/**
 * La photo d'une note mise au propre, comme un scanner, sur le téléphone même
 * (rien n'est envoyé pour cela) : bords de la note trouvés, note découpée et
 * remise droite, puis un filtre de netteté. Calculs purs sur les pixels
 * (RGBA, comme un `ImageData`), sans canvas, testés à part ; l'écran est
 * `ScanNoteComponent`.
 */

export interface Point { x: number; y: number }

/** Les quatre coins de la note sur la photo, en pixels de la photo. */
export interface Coins { hautGauche: Point; hautDroit: Point; basDroit: Point; basGauche: Point }

/** Une image en RGBA, ligne après ligne (le format d'un `ImageData`). */
export interface Pixels { largeur: number; hauteur: number; donnees: Uint8ClampedArray }

/**
 * « Document » : fond blanchi, ombres effacées, texte foncé, le mieux pour un
 * ticket de caisse ; « Netteté » : couleurs gardées, contraste et détails
 * renforcés ; « Couleur » : la photo telle quelle.
 */
export type FiltreNote = 'document' | 'nettete' | 'couleur';

/** Les 8 coefficients d'une transformation de perspective (le 9ᵉ vaut 1). */
export type Homographie = number[];

/** En dessous, la tache claire n'est pas la note (un reflet, un papier au loin). */
const PART_MIN_NOTE = 0.1;
/** Au-dessus, la note remplit déjà la photo : rien à découper. */
const PART_MAX_NOTE = 0.97;
/** Écart de luminosité minimal entre la note et la table. */
const ECART_MIN = 30;

export function coinsDeLaPhoto(largeur: number, hauteur: number): Coins {
  return {
    hautGauche: { x: 0, y: 0 }, hautDroit: { x: largeur, y: 0 },
    basDroit: { x: largeur, y: hauteur }, basGauche: { x: 0, y: hauteur }
  };
}

function luminances(p: Pixels): Float32Array {
  const l = new Float32Array(p.largeur * p.hauteur);
  for (let i = 0, j = 0; i < l.length; i++, j += 4) {
    l[i] = 0.299 * p.donnees[j] + 0.587 * p.donnees[j + 1] + 0.114 * p.donnees[j + 2];
  }
  return l;
}

/** Le seuil d'Otsu : celui qui sépare le mieux les pixels clairs des sombres. */
function seuilOtsu(l: Float32Array): { seuil: number; ecart: number } {
  const histo = new Array<number>(256).fill(0);
  for (const v of l) histo[Math.min(255, Math.round(v))]++;
  const total = l.length;
  const somme = histo.reduce((s, n, v) => s + n * v, 0);
  let sommeSombre = 0, nbSombre = 0, meilleur = -1, seuil = 0, ecart = 0;
  for (let t = 0; t < 255; t++) {
    nbSombre += histo[t];
    sommeSombre += t * histo[t];
    const nbClair = total - nbSombre;
    if (nbSombre === 0 || nbClair === 0) continue;
    const moySombre = sommeSombre / nbSombre;
    const moyClair = (somme - sommeSombre) / nbClair;
    const variance = nbSombre * nbClair * (moyClair - moySombre) ** 2;
    if (variance > meilleur) {
      meilleur = variance;
      seuil = t;
      ecart = moyClair - moySombre;
    }
  }
  return { seuil, ecart };
}

/**
 * Les coins de la note : la plus grande tache claire de la photo (une note
 * sur une table, un sac, un siège de voiture), ses coins pris aux points les
 * plus loin dans chaque diagonale. Null si rien ne ressemble à une note : on
 * garde alors toute la photo. À donner sur une photo réduite (~300 px), le
 * calcul est proportionnel au nombre de pixels.
 */
export function detecterBords(p: Pixels): Coins | null {
  const { largeur, hauteur } = p;
  const l = luminances(p);
  const { seuil, ecart } = seuilOtsu(l);
  if (ecart < ECART_MIN) return null;

  // Plus grande tache claire, de proche en proche (4 voisins).
  const tache = new Int32Array(l.length).fill(-1);
  const pile = new Int32Array(l.length);
  let meilleure = -1, tailleMeilleure = 0;
  for (let depart = 0; depart < l.length; depart++) {
    if (l[depart] <= seuil || tache[depart] !== -1) continue;
    let haut = 0, taille = 0;
    pile[haut++] = depart;
    tache[depart] = depart;
    while (haut > 0) {
      const i = pile[--haut];
      taille++;
      const x = i % largeur;
      for (const v of [x > 0 ? i - 1 : -1, x < largeur - 1 ? i + 1 : -1, i - largeur, i + largeur]) {
        if (v >= 0 && v < l.length && tache[v] === -1 && l[v] > seuil) {
          tache[v] = depart;
          pile[haut++] = v;
        }
      }
    }
    if (taille > tailleMeilleure) {
      tailleMeilleure = taille;
      meilleure = depart;
    }
  }
  const part = tailleMeilleure / l.length;
  if (part < PART_MIN_NOTE || part > PART_MAX_NOTE) return null;

  let hg = { x: 0, y: 0, s: Infinity }, bd = { x: 0, y: 0, s: -Infinity };
  let hd = { x: 0, y: 0, s: -Infinity }, bg = { x: 0, y: 0, s: Infinity };
  for (let i = 0; i < l.length; i++) {
    if (tache[i] !== meilleure) continue;
    const x = (i % largeur) + 0.5, y = Math.floor(i / largeur) + 0.5;
    if (x + y < hg.s) hg = { x, y, s: x + y };
    if (x + y > bd.s) bd = { x, y, s: x + y };
    if (x - y > hd.s) hd = { x, y, s: x - y };
    if (x - y < bg.s) bg = { x, y, s: x - y };
  }
  const coins = { hautGauche: hg, hautDroit: hd, basDroit: bd, basGauche: bg };
  if (aire(coins) < PART_MIN_NOTE * largeur * hauteur) return null;
  const sansScore = ({ x, y }: Point): Point => ({ x, y });
  return {
    hautGauche: sansScore(hg), hautDroit: sansScore(hd), basDroit: sansScore(bd), basGauche: sansScore(bg)
  };
}

/**
 * Le contour montré en direct sur l'aperçu de l'appareil photo : chaque coin
 * avance de `poids` vers celui trouvé sur la nouvelle image (le cadre suit la
 * note sans trembler) ; plus de note trouvée, plus de contour.
 */
export function lisserCoins(precedents: Coins | null, trouves: Coins | null, poids: number): Coins | null {
  if (!trouves || !precedents) return trouves;
  const vers = (a: Point, b: Point): Point => ({ x: a.x + (b.x - a.x) * poids, y: a.y + (b.y - a.y) * poids });
  return {
    hautGauche: vers(precedents.hautGauche, trouves.hautGauche), hautDroit: vers(precedents.hautDroit, trouves.hautDroit),
    basDroit: vers(precedents.basDroit, trouves.basDroit), basGauche: vers(precedents.basGauche, trouves.basGauche)
  };
}

/** Aire du quadrilatère (formule du lacet). */
export function aire(c: Coins): number {
  const q = [c.hautGauche, c.hautDroit, c.basDroit, c.basGauche];
  let s = 0;
  q.forEach((a, i) => {
    const b = q[(i + 1) % 4];
    s += a.x * b.y - b.x * a.y;
  });
  return Math.abs(s) / 2;
}

/** La transformation de perspective qui envoie chacun des 4 points `de` sur le point `vers` de même rang. */
export function homographie(de: Point[], vers: Point[]): Homographie {
  const a: number[][] = [];
  de.forEach(({ x, y }, i) => {
    const { x: u, y: v } = vers[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  });
  // Élimination de Gauss, pivot partiel.
  for (let c = 0; c < 8; c++) {
    let pivot = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    [a[c], a[pivot]] = [a[pivot], a[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c || a[c][c] === 0) continue;
      const f = a[r][c] / a[c][c];
      for (let k = c; k < 9; k++) a[r][k] -= f * a[c][k];
    }
  }
  return a.map((ligne, i) => ligne[8] / ligne[i]);
}

export function appliquerHomographie(h: Homographie, { x, y }: Point): Point {
  const w = h[6] * x + h[7] * y + 1;
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * La note découpée selon ses coins et remise droite (perspective corrigée),
 * à sa taille sur la photo, plus grand côté ramené à `coteMax`.
 */
export function redresser(p: Pixels, coins: Coins, coteMax: number): Pixels {
  const { hautGauche: hg, hautDroit: hd, basDroit: bd, basGauche: bg } = coins;
  let largeur = Math.max(distance(hg, hd), distance(bg, bd));
  let hauteur = Math.max(distance(hg, bg), distance(hd, bd));
  const echelle = Math.min(1, coteMax / Math.max(largeur, hauteur));
  largeur = Math.max(1, Math.round(largeur * echelle));
  hauteur = Math.max(1, Math.round(hauteur * echelle));
  const h = homographie(
    [{ x: 0, y: 0 }, { x: largeur, y: 0 }, { x: largeur, y: hauteur }, { x: 0, y: hauteur }], [hg, hd, bd, bg]);

  const donnees = new Uint8ClampedArray(largeur * hauteur * 4);
  const src = p.donnees, l = p.largeur, maxX = p.largeur - 1, maxY = p.hauteur - 1;
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const s = appliquerHomographie(h, { x: x + 0.5, y: y + 0.5 });
      // Lecture bilinéaire entre les quatre pixels voisins.
      const sx = Math.min(maxX, Math.max(0, s.x - 0.5)), sy = Math.min(maxY, Math.max(0, s.y - 0.5));
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = Math.min(maxX, x0 + 1), y1 = Math.min(maxY, y0 + 1);
      const fx = sx - x0, fy = sy - y0;
      const i00 = (y0 * l + x0) * 4, i10 = (y0 * l + x1) * 4, i01 = (y1 * l + x0) * 4, i11 = (y1 * l + x1) * 4;
      const o = (y * largeur + x) * 4;
      for (let c = 0; c < 4; c++) {
        const haut = src[i00 + c] + (src[i10 + c] - src[i00 + c]) * fx;
        const bas = src[i01 + c] + (src[i11 + c] - src[i01 + c]) * fx;
        donnees[o + c] = Math.round(haut + (bas - haut) * fy);
      }
    }
  }
  return { largeur, hauteur, donnees };
}

/** Une nouvelle image, la photo reçue n'est pas modifiée. */
export function filtrer(p: Pixels, filtre: FiltreNote): Pixels {
  if (filtre === 'couleur') return { ...p, donnees: new Uint8ClampedArray(p.donnees) };
  return filtre === 'document' ? filtreDocument(p) : filtreNettete(p);
}

/** Contraste étiré (1 % des pixels les plus sombres au noir, 1 % des plus clairs au blanc), puis détails accentués. */
function filtreNettete(p: Pixels): Pixels {
  const l = luminances(p);
  const tries = Float32Array.from(l).sort();
  const bas = tries[Math.floor(tries.length * 0.01)];
  const haut = tries[Math.min(tries.length - 1, Math.floor(tries.length * 0.99))];
  const etire = new Uint8ClampedArray(p.donnees.length);
  const facteur = haut - bas >= 1 ? 255 / (haut - bas) : 1;
  const decalage = haut - bas >= 1 ? bas : 0;
  for (let i = 0; i < etire.length; i++) {
    etire[i] = i % 4 === 3 ? p.donnees[i] : (p.donnees[i] - decalage) * facteur;
  }
  // Masque flou : chaque pixel s'éloigne de la moyenne de ses voisins.
  const { largeur, hauteur } = p;
  const donnees = new Uint8ClampedArray(etire);
  for (let y = 1; y < hauteur - 1; y++) {
    for (let x = 1; x < largeur - 1; x++) {
      const o = (y * largeur + x) * 4;
      for (let c = 0; c < 3; c++) {
        let somme = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) somme += etire[o + (dy * largeur + dx) * 4 + c];
        donnees[o + c] = etire[o + c] + 0.8 * (etire[o + c] - somme / 9);
      }
    }
  }
  return { largeur, hauteur, donnees };
}

/**
 * Chaque pixel comparé au papier autour de lui (estimé sans le texte : le
 * plus clair du voisinage, adouci) : l'ombre de la main ou du téléphone
 * disparaît, le papier devient blanc, l'encre reste foncée.
 */
function filtreDocument(p: Pixels): Pixels {
  const { largeur, hauteur } = p;
  const l = luminances(p);
  // Le papier, sur une grille réduite : le plus clair de chaque bloc, puis de ses voisins, puis adouci.
  const bloc = Math.max(1, Math.round(Math.max(largeur, hauteur) / 200));
  const gl = Math.ceil(largeur / bloc), gh = Math.ceil(hauteur / bloc);
  let grille: Float32Array = new Float32Array(gl * gh);
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const g = Math.floor(y / bloc) * gl + Math.floor(x / bloc);
      grille[g] = Math.max(grille[g], l[y * largeur + x]);
    }
  }
  grille = voisinage(grille, gl, gh, 3, (a, b) => Math.max(a, b), -Infinity);
  grille = moyenne(grille, gl, gh, 2);

  const donnees = new Uint8ClampedArray(p.donnees.length);
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const papier = lireGrille(grille, gl, gh, (x + 0.5) / bloc - 0.5, (y + 0.5) / bloc - 0.5);
      const rapport = l[y * largeur + x] / Math.max(1, papier);
      const v = ((rapport - 0.45) / (0.88 - 0.45)) * 255;
      const o = (y * largeur + x) * 4;
      donnees[o] = donnees[o + 1] = donnees[o + 2] = v;
      donnees[o + 3] = 255;
    }
  }
  return { largeur, hauteur, donnees };
}

/** Combine chaque case avec ses voisines jusqu'à `rayon`, d'abord en ligne puis en colonne. */
function voisinage(g: Float32Array, l: number, h: number, rayon: number,
                   combiner: (a: number, b: number) => number, depart: number): Float32Array {
  const ligne = new Float32Array(g.length), sortie = new Float32Array(g.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      let v = depart;
      for (let k = Math.max(0, x - rayon); k <= Math.min(l - 1, x + rayon); k++) v = combiner(v, g[y * l + k]);
      ligne[y * l + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      let v = depart;
      for (let k = Math.max(0, y - rayon); k <= Math.min(h - 1, y + rayon); k++) v = combiner(v, ligne[k * l + x]);
      sortie[y * l + x] = v;
    }
  }
  return sortie;
}

function moyenne(g: Float32Array, l: number, h: number, rayon: number): Float32Array {
  const ligne = new Float32Array(g.length), sortie = new Float32Array(g.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      let s = 0, n = 0;
      for (let k = Math.max(0, x - rayon); k <= Math.min(l - 1, x + rayon); k++, n++) s += g[y * l + k];
      ligne[y * l + x] = s / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      let s = 0, n = 0;
      for (let k = Math.max(0, y - rayon); k <= Math.min(h - 1, y + rayon); k++, n++) s += ligne[k * l + x];
      sortie[y * l + x] = s / n;
    }
  }
  return sortie;
}

/** Lecture bilinéaire de la grille, bords prolongés. */
function lireGrille(g: Float32Array, l: number, h: number, x: number, y: number): number {
  const cx = Math.min(l - 1, Math.max(0, x)), cy = Math.min(h - 1, Math.max(0, y));
  const x0 = Math.floor(cx), y0 = Math.floor(cy), x1 = Math.min(l - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  const fx = cx - x0, fy = cy - y0;
  const haut = g[y0 * l + x0] + (g[y0 * l + x1] - g[y0 * l + x0]) * fx;
  const bas = g[y1 * l + x0] + (g[y1 * l + x1] - g[y1 * l + x0]) * fx;
  return haut + (bas - haut) * fy;
}
