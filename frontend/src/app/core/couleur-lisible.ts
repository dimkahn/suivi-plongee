/**
 * Une couleur de marque assez foncée pour du texte sur blanc et pour du texte
 * blanc sur elle (4,5:1, WCAG AA) : celle d'origine si elle l'est déjà, sinon
 * la même teinte assombrie juste ce qu'il faut. Au bord du bassin, au soleil,
 * un bleu clair ne se lit pas.
 */
export function couleurLisible(couleur: string): string {
  if (contraste(couleur, '#FFFFFF') >= 4.5) return couleur;
  const rgb = parseInt(couleur.slice(1), 16);
  const depart = [rgb >> 16 & 0xff, rgb >> 8 & 0xff, rgb & 0xff];
  // Même teinte, chaque canal multiplié par un même facteur : le premier qui suffit.
  for (let f = 0.99; f > 0; f -= 0.01) {
    const essai = '#' + depart.map(v => Math.round(v * f).toString(16).padStart(2, '0')).join('').toUpperCase();
    if (contraste(essai, '#FFFFFF') >= 4.5) return essai;
  }
  return '#000000';
}

/** Rapport de contraste WCAG entre deux couleurs « #RRGGBB ». */
export function contraste(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function luminance(couleur: string): number {
  const rgb = parseInt(couleur.slice(1), 16);
  const c = [rgb >> 16 & 0xff, rgb >> 8 & 0xff, rgb & 0xff].map(v => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
