// Portraits dessinés (SVG → PNG) pour le trombinoscope des vidéos : des
// illustrations, jamais des photos de vraies personnes.

import { chromium } from 'playwright';

const PEAUX = ['#F2C9A5', '#E0AC83', '#C68B63', '#8D5B3E', '#F6D7BE'];
const CHEVEUX = ['#2B1B12', '#6B3E1F', '#C9A15A', '#1C1C1C', '#8A4B2A'];
const FONDS = ['#0B7A99', '#FF7F50', '#2E9E8F', '#5C6BC0', '#E0A43B', '#7A8FA6'];

/** Un portrait déterministe pour un numéro donné. */
function svg(n, coupe) {
  const peau = PEAUX[n % PEAUX.length];
  const cheveux = CHEVEUX[(n * 3) % CHEVEUX.length];
  const fond = FONDS[n % FONDS.length];
  const coupes = {
    courte: `<path d="M118 170 Q120 88 200 84 Q280 88 282 170 Q260 118 200 116 Q140 118 118 170Z" fill="${cheveux}"/>`,
    longue: `<path d="M110 250 Q96 96 200 84 Q304 96 290 250 L270 250 Q276 140 200 118 Q124 140 130 250Z" fill="${cheveux}"/>`,
    queue:  `<path d="M118 170 Q120 88 200 84 Q280 88 282 170 Q258 116 200 114 Q142 116 118 170Z" fill="${cheveux}"/>
             <circle cx="292" cy="150" r="26" fill="${cheveux}"/>`
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <rect width="400" height="400" fill="${fond}"/>
    <path d="M70 400 Q80 300 200 292 Q320 300 330 400Z" fill="#12394A"/>
    <rect x="178" y="236" width="44" height="60" rx="16" fill="${peau}"/>
    <ellipse cx="200" cy="180" rx="80" ry="92" fill="${peau}"/>
    ${coupes[coupe] ?? coupes.courte}
    <circle cx="172" cy="184" r="7" fill="#1F2A30"/><circle cx="228" cy="184" r="7" fill="#1F2A30"/>
    <path d="M176 224 Q200 242 224 224" stroke="#1F2A30" stroke-width="6" fill="none" stroke-linecap="round"/>
  </svg>`;
}

/** Rend les portraits demandés ; renvoie un tableau de Buffer PNG. */
export async function dessinerPortraits(demandes) {
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage({ viewport: { width: 400, height: 400 } });
  const images = [];
  for (const [n, coupe] of demandes) {
    await page.setContent(`<body style="margin:0">${svg(n, coupe)}</body>`);
    images.push(await page.screenshot({ type: 'png' }));
  }
  await navigateur.close();
  return images;
}
