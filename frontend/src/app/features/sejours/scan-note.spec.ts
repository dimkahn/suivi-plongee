import { describe, expect, it } from 'vitest';
import { Coins, Pixels, Point, appliquerHomographie, detecterBords, filtrer, homographie, redresser } from './scan-note';

/** Une image unie, en gris. */
function imageUnie(largeur: number, hauteur: number, gris: number): Pixels {
  const donnees = new Uint8ClampedArray(largeur * hauteur * 4);
  for (let i = 0; i < largeur * hauteur; i++) donnees.set([gris, gris, gris, 255], i * 4);
  return { largeur, hauteur, donnees };
}

function gris(p: Pixels, x: number, y: number): number {
  return p.donnees[(y * p.largeur + x) * 4];
}

function peindre(p: Pixels, x: number, y: number, valeur: number): void {
  p.donnees.set([valeur, valeur, valeur, 255], (y * p.largeur + x) * 4);
}

/** Vrai si le point est dans le quadrilatère convexe (sens horaire à l'écran). */
function dedans(q: Point[], x: number, y: number): boolean {
  return q.every((a, i) => {
    const b = q[(i + 1) % q.length];
    return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) >= 0;
  });
}

/** Une note claire posée de travers sur une table sombre. */
function noteSurTable(coins: Point[]): Pixels {
  const p = imageUnie(200, 160, 50);
  for (let y = 0; y < p.hauteur; y++) {
    for (let x = 0; x < p.largeur; x++) if (dedans(coins, x + 0.5, y + 0.5)) peindre(p, x, y, 225);
  }
  return p;
}

function proche(a: Point, b: Point, ecart: number): void {
  expect(Math.abs(a.x - b.x), `x ${a.x} au lieu de ${b.x}`).toBeLessThanOrEqual(ecart);
  expect(Math.abs(a.y - b.y), `y ${a.y} au lieu de ${b.y}`).toBeLessThanOrEqual(ecart);
}

describe('Détection des bords de la note', () => {
  it('trouve les quatre coins d’une note claire posée de travers sur une table sombre', () => {
    const vrais = [{ x: 60, y: 20 }, { x: 170, y: 40 }, { x: 140, y: 145 }, { x: 30, y: 120 }];
    const c = detecterBords(noteSurTable(vrais));
    expect(c).not.toBeNull();
    proche(c!.hautGauche, vrais[0], 3);
    proche(c!.hautDroit, vrais[1], 3);
    proche(c!.basDroit, vrais[2], 3);
    proche(c!.basGauche, vrais[3], 3);
  });

  it('ne trouve rien sur une photo unie : on garde toute la photo', () => {
    expect(detecterBords(imageUnie(120, 90, 128))).toBeNull();
  });

  it('ne retient pas une tache claire trop petite pour être la note', () => {
    expect(detecterBords(noteSurTable([{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 30, y: 30 }, { x: 10, y: 30 }])))
      .toBeNull();
  });
});

describe('Redressement de la note', () => {
  it('l’homographie envoie chaque coin sur le coin voulu', () => {
    const de = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }];
    const vers = [{ x: 12, y: 8 }, { x: 95, y: 20 }, { x: 80, y: 70 }, { x: 5, y: 60 }];
    const h = homographie(de, vers);
    de.forEach((p, i) => proche(appliquerHomographie(h, p), vers[i], 1e-6));
  });

  it('découpe la note selon ses coins et la remet droite, à sa taille', () => {
    const p = imageUnie(100, 80, 40);
    for (let y = 20; y < 60; y++) for (let x = 10; x < 70; x++) peindre(p, x, y, 220);
    const coins: Coins = {
      hautGauche: { x: 10, y: 20 }, hautDroit: { x: 70, y: 20 }, basDroit: { x: 70, y: 60 }, basGauche: { x: 10, y: 60 }
    };
    const r = redresser(p, coins, 1600);
    expect(r.largeur).toBe(60);
    expect(r.hauteur).toBe(40);
    for (let y = 1; y < r.hauteur - 1; y++) for (let x = 1; x < r.largeur - 1; x++) expect(gris(r, x, y)).toBe(220);
  });

  it('ne dépasse pas le côté maximal demandé', () => {
    const p = imageUnie(400, 100, 200);
    const r = redresser(p, {
      hautGauche: { x: 0, y: 0 }, hautDroit: { x: 400, y: 0 }, basDroit: { x: 400, y: 100 }, basGauche: { x: 0, y: 100 }
    }, 200);
    expect(r.largeur).toBe(200);
    expect(r.hauteur).toBe(50);
  });
});

describe('Filtres de netteté', () => {
  it('« Document » blanchit le fond mal éclairé et garde le texte foncé', () => {
    // Fond qui passe de 200 (lumière) à 110 (ombre de la main), un trait de texte à 40 % du fond.
    const p = imageUnie(120, 60, 0);
    for (let y = 0; y < 60; y++) {
      for (let x = 0; x < 120; x++) {
        const fond = 200 - (90 * x) / 119;
        peindre(p, x, y, Math.round(y >= 28 && y < 32 ? fond * 0.4 : fond));
      }
    }
    const r = filtrer(p, 'document');
    expect(gris(r, 5, 10)).toBeGreaterThanOrEqual(245);
    expect(gris(r, 115, 10)).toBeGreaterThanOrEqual(245);
    expect(gris(r, 5, 30)).toBeLessThanOrEqual(60);
    expect(gris(r, 115, 30)).toBeLessThanOrEqual(60);
  });

  it('« Netteté » étire les niveaux d’une photo terne sur toute la gamme', () => {
    const p = imageUnie(50, 50, 0);
    for (let y = 0; y < 50; y++) for (let x = 0; x < 50; x++) peindre(p, x, y, x < 25 ? 100 : 150);
    const r = filtrer(p, 'nettete');
    expect(gris(r, 5, 25)).toBeLessThanOrEqual(10);
    expect(gris(r, 45, 25)).toBeGreaterThanOrEqual(245);
  });

  it('« Couleur d’origine » ne change rien', () => {
    const p = noteSurTable([{ x: 60, y: 20 }, { x: 170, y: 40 }, { x: 140, y: 145 }, { x: 30, y: 120 }]);
    const r = filtrer(p, 'couleur');
    expect(r.donnees.every((v, i) => v === p.donnees[i])).toBe(true);
  });
});
