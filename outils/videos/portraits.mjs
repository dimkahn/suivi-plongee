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

/** Photos de matériel pour les prêts : un bloc et un détendeur dessinés, sur fond clair. */
export async function dessinerMateriel() {
  const bloc = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <rect width="800" height="600" fill="#DCE8EC"/><rect y="470" width="800" height="130" fill="#B9C9CF"/>
    <rect x="330" y="140" width="140" height="380" rx="60" fill="#E8A33B"/>
    <rect x="330" y="230" width="140" height="26" fill="#1F2A30" opacity=".25"/>
    <rect x="378" y="96" width="44" height="54" rx="8" fill="#6B7780"/>
    <rect x="360" y="80" width="80" height="24" rx="8" fill="#3E4A52"/>
    <text x="400" y="400" font-family="sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="#fff">B-02</text>
  </svg>`;
  const detendeur = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <rect width="800" height="600" fill="#E6EEF1"/>
    <circle cx="300" cy="300" r="70" fill="#3E4A52"/><circle cx="300" cy="300" r="34" fill="#9AA6AE"/>
    <path d="M370 300 C470 300 470 200 560 200" stroke="#1F2A30" stroke-width="18" fill="none"/>
    <circle cx="590" cy="200" r="52" fill="#FF7F50"/><rect x="570" y="250" width="40" height="40" rx="8" fill="#1F2A30"/>
    <path d="M300 370 C300 470 420 480 480 470" stroke="#1F2A30" stroke-width="14" fill="none"/>
    <circle cx="510" cy="468" r="36" fill="#F4F4F4" stroke="#1F2A30" stroke-width="8"/>
  </svg>`;
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage({ viewport: { width: 800, height: 600 } });
  const images = [];
  for (const svg of [bloc, detendeur]) {
    await page.setContent(`<body style="margin:0">${svg}</body>`);
    images.push(await page.screenshot({ type: 'jpeg', quality: 85 }));
  }
  await navigateur.close();
  return images;
}
