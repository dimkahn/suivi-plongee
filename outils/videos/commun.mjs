// Outils communs aux scénarios : navigateur au format téléphone (ou
// ordinateur pour l'administration), connexion, sous-titres incrustés et
// « toucher » visible (un rond à l'endroit touché), pour qu'on voie à la
// vidéo ce que l'utilisateur fait avec son doigt ou sa souris.

import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APPLI = process.env.APPLI ?? 'http://localhost:4200';
export const MOT_DE_PASSE = 'plongee2026';

// Pixel 7 : 412 × 839 points utiles. Playwright filme la page à sa taille
// CSS et ne l'agrandit jamais : une vidéo plus grande que l'écran laisserait
// la page dans un coin, entourée de gris. L'administration se fait plutôt à
// un bureau : format ordinateur, 1280 × 800.
const TELEPHONE = devices['Pixel 7'];
const FORMATS = {
  telephone: {
    contexte: TELEPHONE,
    video: { ...TELEPHONE.viewport }
  },
  ordinateur: {
    contexte: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
    video: { width: 1280, height: 800 }
  }
};

/** Multiplie toutes les pauses (RYTHME=1.5 pour une vidéo plus posée). */
const RYTHME = Number(process.env.RYTHME ?? 1);
/**
 * Multiplie en plus l'arrêt avant chaque toucher et la durée du rond orange
 * (RYTHME_CLIC=2 pour mieux voir où le doigt se pose), sans rien ralentir d'autre.
 */
const RYTHME_CLIC = Number(process.env.RYTHME_CLIC ?? 1);

// Injecté dans chaque page : une zone de sous-titre et le rond du toucher.
// Styles en ligne : ne dépend pas de la feuille de style de l'appli.
const INCRUSTATIONS = `
  (() => {
    const installer = () => {
      if (document.getElementById('video-soustitre')) return;
      const st = document.createElement('div');
      st.id = 'video-soustitre';
      Object.assign(st.style, {
        position: 'fixed', left: '12px', right: '12px', bottom: '20px', zIndex: 2147483647,
        padding: '12px 16px', borderRadius: '14px', pointerEvents: 'none',
        background: 'rgba(8, 36, 52, .92)', color: '#fff',
        font: '600 17px/1.35 Nunito, system-ui, sans-serif', textAlign: 'center',
        boxShadow: '0 6px 18px rgba(0,0,0,.25)', opacity: '0', transition: 'opacity .25s'
      });
      document.documentElement.appendChild(st);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installer);
    else installer();
    // Un <dialog> modal passe au-dessus de tout, z-index compris : le
    // sous-titre et le rond du toucher se logent dedans tant qu'il est ouvert.
    const hote = () => document.querySelector('dialog[open]') ?? document.documentElement;
    window.__videoSousTitre = (texte, enHaut) => {
      installer();
      const st = document.getElementById('video-soustitre');
      if (st.parentNode !== hote()) hote().appendChild(st);
      // En haut quand le geste filmé se passe en bas de l'écran (barre de choix).
      st.style.top = enHaut ? '84px' : 'auto';
      st.style.bottom = enHaut ? 'auto' : '20px';
      st.textContent = texte ?? '';
      st.style.opacity = texte ? '1' : '0';
    };
    window.__videoToucher = (x, y, lenteur = 1) => {
      const rond = document.createElement('div');
      Object.assign(rond.style, {
        position: 'fixed', left: (x - 22) + 'px', top: (y - 22) + 'px', width: '44px', height: '44px',
        borderRadius: '50%', background: 'rgba(255, 127, 80, .45)', border: '3px solid #ff7f50',
        zIndex: 2147483646, pointerEvents: 'none',
        transition: 'transform ' + (.5 * lenteur) + 's, opacity ' + (.5 * lenteur) + 's'
      });
      hote().appendChild(rond);
      requestAnimationFrame(() => { rond.style.transform = 'scale(1.6)'; rond.style.opacity = '0'; });
      setTimeout(() => rond.remove(), 700 * lenteur);
    };
  })();
`;

/**
 * Ouvre un navigateur, connecte `compte` hors caméra (sauf `connecte: false`)
 * et renvoie une page qui enregistre la vidéo dans `dossier`.
 */
export async function ouvrirTournage({ compte, connecte = true, dossier, format = 'telephone' }) {
  const { contexte: appareil, video } = FORMATS[format];
  const navigateur = await chromium.launch();
  let etat;
  if (connecte) {
    // Connexion dans un contexte sans caméra ; « Se souvenir de moi » pose le
    // cookie de rafraîchissement, que le contexte filmé reprend.
    const coulisses = await navigateur.newContext({ ...appareil, locale: 'fr-FR' });
    const p = await coulisses.newPage();
    await seConnecter(p, compte);
    etat = await coulisses.storageState();
    await coulisses.close();
  }
  const contexte = await navigateur.newContext({
    ...appareil, locale: 'fr-FR', timezoneId: 'Europe/Paris', storageState: etat,
    recordVideo: { dir: dossier, size: video }
  });
  await contexte.addInitScript(INCRUSTATIONS);
  const page = await contexte.newPage();
  // La vidéo commence avec la page : repère des instants de la voix off.
  return { navigateur, contexte, page, debutVideo: Date.now() };
}

export async function seConnecter(page, email) {
  await page.goto(`${APPLI}/connexion`);
  await page.fill('#email', email);
  await page.fill('#mdp', MOT_DE_PASSE);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(u => !u.pathname.includes('connexion'));
}

const ICI = dirname(fileURLToPath(import.meta.url));
/** Piper et sa voix, installés par tourner.sh (hors dépôt). */
export const DOSSIER_PIPER = join(ICI, '.piper');
const MODELE_VOIX = join(DOSSIER_PIPER, 'voix', `${process.env.VOIX_MODELE ?? 'fr_FR-siwis-medium'}.onnx`);

/**
 * Démarre la voix off (voix.py, Piper) pour tout le tournage, ou renvoie
 * null si elle est coupée (VOIX=0) ou pas installée : les vidéos restent
 * alors muettes, comme avant. `dire(texte)` écrit la phrase dans `dossier`
 * et renvoie { fichier, duree } (secondes), ou null si la synthèse échoue.
 */
export async function ouvrirVoix(dossier) {
  if (process.env.VOIX === '0') return null;
  if (!existsSync(MODELE_VOIX)) {
    console.log(`Voix off absente (${MODELE_VOIX}) : vidéos muettes. tourner.sh l'installe.`);
    return null;
  }
  await mkdir(dossier, { recursive: true });
  const python = spawn(process.env.PYTHON ?? 'python3', [join(ICI, 'voix.py'), MODELE_VOIX], {
    env: { ...process.env, PYTHONPATH: DOSSIER_PIPER },
    stdio: ['pipe', 'pipe', 'inherit']
  });
  const reponses = createInterface({ input: python.stdout })[Symbol.asyncIterator]();
  const lire = async () => {
    const { value, done } = await reponses.next();
    if (done) throw new Error('la voix off (voix.py) s\'est arrêtée');
    return JSON.parse(value);
  };
  await lire(); // {"pret": true} : modèle chargé
  let file = Promise.resolve();
  const dire = texte => {
    const fichier = join(dossier, createHash('sha1').update(texte).digest('hex').slice(0, 16) + '.wav');
    // Une demande à la fois : les réponses arrivent dans l'ordre des lignes.
    const reponse = file.then(async () => {
      python.stdin.write(JSON.stringify({ texte: aDire(texte), fichier }) + '\n');
      const r = await lire();
      if (r.erreur) { console.log(`\n  voix off : ${r.erreur}`); return null; }
      return { fichier, duree: r.duree };
    });
    file = reponse.catch(() => {});
    return reponse;
  };
  return { dire, fermer: () => python.stdin.end() };
}

/** Le texte d'un sous-titre tel qu'il se prononce. */
function aDire(texte) {
  return texte
    .replace(/⚠\s*/g, '')
    .replace(/[«»]/g, '')
    .replace(/…/g, '.')
    .replace(/\bCACI\b/g, 'caci')
    .replace(/\bE([1-5])\b/g, 'E $1')
    .replace(/\bN([1-5])\b/g, 'N $1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Les gestes filmés, liés à une page. `vignette` : chemin de l'image
 * d'aperçu de la vidéo, prise par le geste du même nom. `voix` (ouvrirVoix)
 * et `debutVideo` : pour dire chaque sous-titre et noter à quel instant de
 * la vidéo il commence (`pistes`, reprises au montage par monter.mjs).
 */
export function gestes(page, { vignette: cheminVignette, voix = null, debutVideo = Date.now() } = {}) {
  const pause = ms => page.waitForTimeout(ms * RYTHME);

  // La voix off remplace les sous-titres ; sans voix, ils restent affichés.
  // SOUS_TITRES=1 ou 0 force l'un ou l'autre.
  const sousTitres = process.env.SOUS_TITRES ? process.env.SOUS_TITRES !== '0' : !voix;

  /** Les phrases dites : { debut (ms depuis le début de la vidéo), fichier }. */
  const pistes = [];
  let finVoix = 0;
  /** Attend que la phrase en cours soit finie. */
  const attendreVoix = async () => {
    const reste = finVoix - Date.now();
    if (reste > 0) await page.waitForTimeout(reste);
  };

  /**
   * Dit une phrase (voix off) ou l'affiche en sous-titre s'il n'y a pas de
   * voix ; dans les deux cas, elle entre dans le texte de la vidéo
   * (transcription de la page, SCENARIOS.md). `duree` : temps laissé avant
   * la suite. `enHaut` : sous-titre sous l'en-tête plutôt qu'en bas, pour
   * ne pas cacher le geste. Avec la voix off, la phrase attend la fin de la précédente,
   * et `duree` s'allonge si la phrase est plus longue ; avec `duree` à 0,
   * les gestes qui suivent se font pendant qu'elle est dite.
   */
  const legende = async (texte, duree = 2500, { enHaut = false } = {}) => {
    // Synthèse pendant que la phrase précédente se dit encore.
    const parole = voix && texte ? await voix.dire(texte) : null;
    await attendreVoix();
    if (sousTitres) await page.evaluate(([t, h]) => window.__videoSousTitre?.(t, h), [texte, enHaut]);
    if (parole) {
      pistes.push({ debut: Date.now() - debutVideo, fichier: parole.fichier });
      finVoix = Date.now() + Math.round(parole.duree * 1000) + 300;
    }
    if (duree) {
      await pause(duree);
      await attendreVoix();
    }
  };

  /** Fait défiler jusqu'à l'élément, montre le toucher, puis clique. */
  const toucher = async (cible, { apres = 900 } = {}) => {
    const el = typeof cible === 'string' ? page.locator(cible).first() : cible;
    await el.scrollIntoViewIfNeeded();
    await pause(350 * RYTHME_CLIC);
    const boite = await el.boundingBox();
    if (boite) {
      await page.evaluate(([x, y, l]) => window.__videoToucher?.(x, y, l),
        [boite.x + boite.width / 2, boite.y + boite.height / 2, RYTHME * RYTHME_CLIC]);
    }
    await pause(250 * RYTHME_CLIC);
    await el.click();
    await pause(apres);
  };

  /** Tape un texte lettre à lettre, comme au clavier du téléphone. */
  const saisir = async (cible, texte) => {
    const el = typeof cible === 'string' ? page.locator(cible).first() : cible;
    await toucher(el, { apres: 200 });
    await el.pressSequentially(texte, { delay: 55 * RYTHME });
    await pause(500);
  };

  /** Défilement doux, pour montrer une page longue. */
  const defiler = async (pixels, duree = 1200) => {
    const pas = 12;
    for (let i = 0; i < pas; i++) {
      await page.mouse.wheel(0, pixels / pas);
      await page.waitForTimeout((duree / pas) * RYTHME);
    }
    await pause(400);
  };

  const enHaut = async () => {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await pause(700);
  };

  /** Touche une entrée du menu ; sur téléphone, ouvre d'abord le menu (☰). */
  const menu = async entree => {
    const bouton = page.getByRole('button', { name: 'Menu' });
    if (await bouton.isVisible()) await toucher(bouton, { apres: 700 });
    await toucher(page.locator('#menu-principal').getByText(entree, { exact: true }), { apres: 1200 });
  };

  /** Menu « Administration », puis la carte `ecran` de la page d'accueil admin. */
  const administration = async ecran => {
    await menu('Administration');
    await toucher(page.locator('main a').filter({ hasText: ecran }).first(), { apres: 1200 });
  };

  /** Choisit l'option `libelle` d'une liste déroulante (`exact: false` : début du libellé). */
  const choisir = async (cible, libelle, { exact = true } = {}) => {
    const el = typeof cible === 'string' ? page.locator(cible).first() : cible;
    await toucher(el, { apres: 200 });
    let valeur = libelle;
    if (!exact) {
      valeur = await el.evaluate((s, debut) => {
        const o = [...s.options].find(x => x.textContent.trim().startsWith(debut));
        return o ? o.textContent.trim() : debut;
      }, libelle);
    }
    await el.selectOption({ label: valeur });
    await page.keyboard.press('Escape').catch(() => {});
    await pause(600);
  };

  /** Coche ou décoche une case (cible : la case elle-même ou son libellé). */
  const cocher = async (cible, valeur = true) => {
    const el = typeof cible === 'string' ? page.locator(cible).first() : cible;
    if ((await el.isChecked()) !== valeur) await toucher(el, { apres: 500 });
  };

  /** Remplit un champ date (AAAA-MM-JJ) : le sélecteur natif ne se filme pas. */
  const dater = async (cible, date) => {
    const el = typeof cible === 'string' ? page.locator(cible).first() : cible;
    await toucher(el, { apres: 200 });
    await el.fill(date);
    await pause(500);
  };

  /** Liste à recherche de l'appli (app-combobox) : tape `texte`, touche l'option `option`. */
  const rechercherEtChoisir = async (idChamp, texte, option = texte) => {
    await saisir(`#${idChamp}`, texte);
    await toucher(page.locator(`#${idChamp}-liste button`).filter({ hasText: option }).first(), { apres: 700 });
  };

  /**
   * Liste native <datalist> (plongeur du club) : tape le début du nom, puis
   * reprend l'option complète, comme un toucher sur la suggestion du clavier.
   */
  const suggestion = async (cible, debut) => {
    const el = typeof cible === 'string' ? page.locator(cible).first() : cible;
    await saisir(el, debut);
    await el.evaluate((champ, d) => {
      const liste = document.getElementById(champ.getAttribute('list'));
      const o = [...(liste?.options ?? [])].find(x => x.value.startsWith(d));
      if (o) champ.value = o.value;
      champ.dispatchEvent(new Event('change', { bubbles: true }));
    }, debut);
    await pause(800);
  };

  /** Coupe ou rétablit le réseau (mode avion). */
  const reseau = async actif => {
    await page.context().setOffline(!actif);
    await pause(600);
  };

  /** Capture l'image d'aperçu de la vidéo (la dernière prise l'emporte). */
  const vignette = async () => {
    if (!cheminVignette) return;
    await page.evaluate(() => window.__videoSousTitre?.(null));
    await page.waitForTimeout(300);
    await page.screenshot({ path: cheminVignette, type: 'jpeg', quality: 80 });
  };

  /**
   * Dans le calendrier « Séance », touche le dernier jour passé qui porte des
   * séances, puis la première séance de ce jour (le lundi : la piscine).
   */
  const choisirDerniereSeance = async () => {
    await toucher(page.locator('button#seance'), { apres: 900 });
    const dialogue = page.locator('dialog[open]');
    const jours = dialogue.locator('button.jour[aria-label*="séance"]:not([disabled])');
    // Les présences s'ouvrent une semaine à l'avance : on garde le dernier jour passé ou du jour.
    const libelles = await jours.evaluateAll(boutons => boutons.map(b => b.getAttribute('aria-label') ?? ''));
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);
    const passes = libelles.map((l, i) => {
      const [j, m, a] = l.slice(0, 10).split('/').map(Number);
      return new Date(a, m - 1, j) <= aujourdhui ? i : -1;
    }).filter(i => i >= 0);
    await toucher(passes.length ? jours.nth(passes.at(-1)) : jours.last(), { apres: 900 });
    await toucher(dialogue.locator('.seances-du-jour button').first(), { apres: 1200 });
  };

  return {
    page, pause, legende, attendreVoix, pistes, toucher, saisir, defiler, enHaut, menu, administration,
    choisir, cocher, dater, reseau, vignette, choisirDerniereSeance, rechercherEtChoisir, suggestion
  };
}
