// Outils communs aux scénarios : navigateur au format téléphone (ou
// ordinateur pour l'administration), connexion, sous-titres incrustés et
// « toucher » visible (un rond à l'endroit touché), pour qu'on voie à la
// vidéo ce que l'utilisateur fait avec son doigt ou sa souris.

import { chromium, devices } from 'playwright';

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
    window.__videoSousTitre = (texte, enHaut) => {
      installer();
      const st = document.getElementById('video-soustitre');
      // En haut quand le geste filmé se passe en bas de l'écran (barre de choix).
      st.style.top = enHaut ? '84px' : 'auto';
      st.style.bottom = enHaut ? 'auto' : '20px';
      st.textContent = texte ?? '';
      st.style.opacity = texte ? '1' : '0';
    };
    window.__videoToucher = (x, y) => {
      const rond = document.createElement('div');
      Object.assign(rond.style, {
        position: 'fixed', left: (x - 22) + 'px', top: (y - 22) + 'px', width: '44px', height: '44px',
        borderRadius: '50%', background: 'rgba(255, 127, 80, .45)', border: '3px solid #ff7f50',
        zIndex: 2147483646, pointerEvents: 'none', transition: 'transform .5s, opacity .5s'
      });
      document.documentElement.appendChild(rond);
      requestAnimationFrame(() => { rond.style.transform = 'scale(1.6)'; rond.style.opacity = '0'; });
      setTimeout(() => rond.remove(), 700);
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
  return { navigateur, contexte, page };
}

export async function seConnecter(page, email) {
  await page.goto(`${APPLI}/connexion`);
  await page.fill('#email', email);
  await page.fill('#mdp', MOT_DE_PASSE);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(u => !u.pathname.includes('connexion'));
}

/**
 * Les gestes filmés, liés à une page. `vignette` : chemin de l'image
 * d'aperçu de la vidéo, prise par le geste du même nom.
 */
export function gestes(page, { vignette: cheminVignette } = {}) {
  const pause = ms => page.waitForTimeout(ms * RYTHME);

  /**
   * Affiche un sous-titre ; `duree` : temps de lecture laissé avant la suite.
   * `enHaut` : sous l'en-tête plutôt qu'en bas, pour ne pas cacher le geste.
   */
  const legende = async (texte, duree = 2500, { enHaut = false } = {}) => {
    await page.evaluate(([t, h]) => window.__videoSousTitre?.(t, h), [texte, enHaut]);
    if (duree) await pause(duree);
  };

  /** Fait défiler jusqu'à l'élément, montre le toucher, puis clique. */
  const toucher = async (cible, { apres = 900 } = {}) => {
    const el = typeof cible === 'string' ? page.locator(cible).first() : cible;
    await el.scrollIntoViewIfNeeded();
    await pause(350);
    const boite = await el.boundingBox();
    if (boite) {
      await page.evaluate(([x, y]) => window.__videoToucher?.(x, y),
        [boite.x + boite.width / 2, boite.y + boite.height / 2]);
    }
    await pause(250);
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
    await toucher(jours.last(), { apres: 900 });
    await toucher(dialogue.locator('.seances-du-jour button').first(), { apres: 1200 });
  };

  return {
    page, pause, legende, toucher, saisir, defiler, enHaut, menu, administration,
    choisir, cocher, dater, reseau, vignette, choisirDerniereSeance, rechercherEtChoisir, suggestion
  };
}
