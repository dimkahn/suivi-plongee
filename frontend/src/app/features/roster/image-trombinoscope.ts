/**
 * Image PNG d'un trombinoscope (un groupe d'entraînement, par exemple),
 * dessinée dans le navigateur à partir des photos déjà affichées : rien ne
 * repasse par le serveur.
 *
 * Une personne sans photo, ou dont la photo a été masquée à l'export, reçoit
 * la même icône : l'image ne laisse pas deviner qui a été masqué.
 */
export interface PersonneImage {
  nom: string;
  sousTitre: string;
  /** Adresse (blob:) de la photo à dessiner ; null = icône. */
  photo: string | null;
}

const CARTE_L = 220;
const CARTE_H = 250;
const DIAMETRE = 150;
const MARGE = 40;
const HAUT_TITRE = 110;
const COLONNES_MAX = 5;

const ENCRE = '#0F172A';
const CRAIE = '#64748B';
const FOND = '#F8FAFC';
const PROFOND = '#0891B2';
const TRAIT = '#E2E8F0';

export async function dessinerTrombinoscope(titre: string, personnes: PersonneImage[]): Promise<Blob> {
  // Poppins et Nunito ne sont dessinées que si le navigateur les a déjà chargées.
  await document.fonts?.ready;
  const photos = await Promise.all(personnes.map(p => p.photo ? chargerImage(p.photo) : Promise.resolve(null)));

  const colonnes = Math.max(1, Math.min(COLONNES_MAX, personnes.length));
  const lignes = Math.ceil(personnes.length / colonnes);
  const largeur = MARGE * 2 + colonnes * CARTE_L;
  const hauteur = HAUT_TITRE + lignes * CARTE_H + MARGE;

  const canvas = document.createElement('canvas');
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Ce navigateur ne sait pas dessiner l'image.");

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, largeur, hauteur);

  ctx.fillStyle = ENCRE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = "700 34px Poppins, sans-serif";
  ctx.fillText(tronquer(ctx, titre, largeur - MARGE * 2), largeur / 2, MARGE + 30);
  ctx.fillStyle = PROFOND;
  ctx.fillRect(largeur / 2 - 40, MARGE + 46, 80, 4);

  personnes.forEach((p, i) => {
    const x = MARGE + (i % colonnes) * CARTE_L;
    const y = HAUT_TITRE + Math.floor(i / colonnes) * CARTE_H;
    const cx = x + CARTE_L / 2;
    const cy = y + 10 + DIAMETRE / 2;
    const photo = photos[i];
    if (photo) dessinerPhoto(ctx, photo, cx, cy);
    else dessinerIcone(ctx, cx, cy);

    ctx.fillStyle = ENCRE;
    ctx.font = "700 18px Nunito, sans-serif";
    ctx.fillText(tronquer(ctx, p.nom, CARTE_L - 16), cx, cy + DIAMETRE / 2 + 30);
    ctx.fillStyle = CRAIE;
    ctx.font = "400 15px Nunito, sans-serif";
    ctx.fillText(tronquer(ctx, p.sousTitre, CARTE_L - 16), cx, cy + DIAMETRE / 2 + 52);
  });

  return new Promise((resoudre, rejeter) =>
    canvas.toBlob(b => b ? resoudre(b) : rejeter(new Error("L'image n'a pas pu être fabriquée.")), 'image/png'));
}

function chargerImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resoudre => {
    const img = new Image();
    img.onload = () => resoudre(img);
    // Photo illisible : l'icône la remplace plutôt que de faire échouer tout l'export.
    img.onerror = () => resoudre(null);
    img.src = url;
  });
}

/** Photo recadrée au centre, dans un rond comme à l'écran. */
function dessinerPhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number): void {
  const cote = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - cote) / 2;
  const sy = (img.naturalHeight - cote) / 2;
  ctx.save();
  cercle(ctx, cx, cy);
  ctx.clip();
  ctx.drawImage(img, sx, sy, cote, cote, cx - DIAMETRE / 2, cy - DIAMETRE / 2, DIAMETRE, DIAMETRE);
  ctx.restore();
}

/** Silhouette neutre (tête et épaules) à la place de la photo. */
function dessinerIcone(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const r = DIAMETRE / 2;
  ctx.save();
  cercle(ctx, cx, cy);
  ctx.fillStyle = FOND;
  ctx.fill();
  ctx.strokeStyle = TRAIT;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.clip();
  ctx.fillStyle = CRAIE;
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.18, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.78, r * 0.62, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function cercle(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, DIAMETRE / 2, 0, Math.PI * 2);
  ctx.closePath();
}

/** Coupe le texte d'un « … » s'il dépasse la largeur de la carte. */
function tronquer(ctx: CanvasRenderingContext2D, texte: string, largeurMax: number): string {
  if (ctx.measureText(texte).width <= largeurMax) return texte;
  let t = texte;
  while (t.length > 1 && ctx.measureText(t + '…').width > largeurMax) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}
