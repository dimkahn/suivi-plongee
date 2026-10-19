// Tourne une ou plusieurs vidéos. Chaque scénario est un fichier de
// scenarios/ ; sa vidéo (WebM, sans son) et son image d'aperçu arrivent
// dans sorties/, avec catalogue.json, lu par la page publique /videos.
// Les sous-titres affichés pendant le tournage sont gardés : ils forment
// la transcription de la page et le texte de voix off de SCENARIOS.md,
// réécrit à chaque passage.
//
//   node enregistrer.mjs              tous les scénarios, format téléphone
//   FORMAT=ordinateur node enregistrer.mjs   tous, format ordinateur
//   node enregistrer.mjs M03 A        M03 et toute la série administrateur
//   RYTHME=1.5 node enregistrer.mjs   pauses 50 % plus longues
//   node enregistrer.mjs --catalogue  réécrit seulement catalogue.json
//                                     (après une conversion en MP4)
//
// Chaque scénario se tourne au format téléphone et au format ordinateur
// (choix du club, 2026 ; `formats` du scénario pour s'en tenir à un seul) :
// <nom>.telephone.webm et <nom>.ordinateur.webm, avec leur .json et leur
// .jpg. Un format par passage : tourner.sh redémarre le backend entre les deux.
//
// Prérequis : backend en profil dev redémarré, puis `node preparer-donnees.mjs`,
// frontend sur http://localhost:4200 (ou tout faire avec tourner.sh). Les
// scénarios sont écrits pour être tournés dans n'importe quel ordre sur les
// mêmes données, mais pas deux fois : pour retourner une vidéo, ou tourner
// l'autre format, repartir d'un backend redémarré.

import { readdir, readFile, rename, mkdir, rm, writeFile, stat } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORMATS, ouvrirTournage, ouvrirVoix, gestes } from './commun.mjs';

/** Les formats d'un scénario : les deux, sauf s'il en désigne lui-même. */
const formatsDe = s => s.formats ?? Object.keys(FORMATS);
const FORMAT = process.env.FORMAT ?? 'telephone';
if (!FORMATS[FORMAT]) {
  console.error(`FORMAT=${FORMAT} inconnu : ${Object.keys(FORMATS).join(' ou ')}.`);
  process.exit(1);
}

const ICI = dirname(fileURLToPath(import.meta.url));
const SORTIES = join(ICI, 'sorties');
/** Les manuels d'utilisation de la page Aide, qui citent les vidéos par leur code. */
const MANUELS = join(ICI, '../../frontend/src/app/features/aide/manuels');

/** Ordre des rubriques de la page publique. */
const PUBLICS = ['Découverte', 'Moniteur', 'Administrateur', 'Directeur technique', 'Élève'];

const catalogueSeul = process.argv.includes('--catalogue');
const demandes = process.argv.slice(2).filter(a => !a.startsWith('--')).map(a => a.toUpperCase());
const tous = (await readdir(join(ICI, 'scenarios'))).filter(f => f.endsWith('.mjs')).sort();
const fichiers = catalogueSeul ? []
  : tous.filter(f => demandes.length === 0 || demandes.some(d => f.toUpperCase().startsWith(d)));

await mkdir(SORTIES, { recursive: true });
if (catalogueSeul) {
  await ecrireCatalogue();
  process.exit(0);
}

if (fichiers.length === 0) {
  console.error(`Aucun scénario ne correspond à : ${demandes.join(', ')}`);
  process.exit(1);
}

let echecs = 0;
// Voix off : chaque sous-titre lu par Piper, monté ensuite par monter.mjs.
const voix = await ouvrirVoix(join(SORTIES, 'voix'));

for (const fichier of fichiers) {
  const scenario = (await import(`./scenarios/${fichier}`)).default;
  if (!formatsDe(scenario).includes(FORMAT)) continue;
  // « M06-valider-une-competence.telephone » : un jeu de fichiers par format.
  const nom = `${fichier.replace(/\.mjs$/, '')}.${FORMAT}`;
  const brouillon = join(SORTIES, `.${nom}`);
  const cheminVignette = join(SORTIES, `${nom}.jpg`);
  process.stdout.write(`${scenario.id} (${FORMAT}) — ${scenario.titre}… `);

  await rm(join(SORTIES, `${nom}-ECHEC.png`), { force: true });
  const { navigateur, contexte, page, debutVideo } = await ouvrirTournage({
    compte: scenario.compte, connecte: scenario.connecte ?? true,
    format: FORMAT, dossier: brouillon
  });
  const debut = Date.now();
  let vignettePrise = false;
  const texte = [];
  try {
    const g = gestes(page, { vignette: cheminVignette, voix, debutVideo, format: FORMAT });
    const vignette = g.vignette;
    g.vignette = async () => { vignettePrise = true; await vignette(); };
    const legende = g.legende;
    g.legende = async (t, ...reste) => {
      if (t && texte.at(-1) !== t) texte.push(t);
      await legende(t, ...reste);
    };
    await scenario.jouer(g);
    await g.attendreVoix(); // ne pas couper la dernière phrase
    if (!vignettePrise) await vignette();
    const duree = Math.round((Date.now() - debut) / 1000);
    await contexte.close(); // termine l'écriture de la vidéo
    const [video] = await readdir(brouillon);
    await rename(join(brouillon, video), join(SORTIES, `${nom}.webm`));
    await writeFile(join(SORTIES, `${nom}.json`), JSON.stringify({
      duree, texte, voix: g.pistes.map(p => ({ debut: p.debut, fichier: basename(p.fichier) }))
    }));
    console.log(`sorties/${nom}.webm (${duree} s)`);
  } catch (e) {
    echecs++;
    await page.screenshot({ path: join(SORTIES, `${nom}-ECHEC.png`) }).catch(() => {});
    await contexte.close().catch(() => {});
    console.log(`ÉCHEC\n  ${e.message.split('\n')[0]}\n  (capture : sorties/${nom}-ECHEC.png)`);
  } finally {
    await navigateur.close();
    await rm(brouillon, { recursive: true, force: true });
  }
}

voix?.fermer();
await ecrireCatalogue();
process.exit(echecs ? 1 : 0);

/**
 * catalogue.json : tous les scénarios, rangés par public. `formats` donne,
 * pour le téléphone et l'ordinateur, les fichiers déjà tournés (vidéo WebM,
 * MP4 s'il existe, image d'aperçu, durée, texte) ; un format pas encore
 * tourné vaut null, et la page l'annonce « à venir ». Les champs à plat
 * (webm, mp4…) reprennent le premier format tourné : l'appli d'avant le
 * choix du format, encore en ligne pendant une publication, les lit.
 */
async function ecrireCatalogue() {
  const existe = async f => stat(join(SORTIES, f)).then(() => true, () => false);
  const videos = [];
  for (const fichier of tous) {
    const s = (await import(`./scenarios/${fichier}`)).default;
    const base = fichier.replace(/\.mjs$/, '');
    const formats = {};
    for (const format of formatsDe(s)) {
      formats[format] = await fichiersDuFormat(`${base}.${format}`, existe);
      // Tournage d'avant les deux formats (« <nom>.webm », dans le format du scénario) :
      // gardé jusqu'à ce que ce format soit retourné.
      if (!formats[format] && (s.format ?? 'telephone') === format) {
        formats[format] = await fichiersDuFormat(base, existe);
      }
    }
    const [formatPrincipal, principal] = Object.entries(formats).find(([, f]) => f) ?? [formatsDe(s)[0], null];
    videos.push({
      id: s.id, titre: s.titre, public: s.public, resume: s.resume,
      format: formatPrincipal,
      webm: principal?.webm ?? null, mp4: principal?.mp4 ?? null, vignette: principal?.vignette ?? null,
      duree: principal?.duree ?? null, texte: principal?.texte ?? [], voix: principal?.voix ?? false,
      version: principal?.version ?? null,
      formats: Object.fromEntries(Object.entries(formats).map(([f, v]) => [f, v && { ...v, format: undefined }])),
      compte: s.compte
    });
  }
  const ordre = v => [PUBLICS.indexOf(v.public), v.id.replace(/\d+/, n => n.padStart(3, '0'))];
  videos.sort((a, b) => {
    const [pa, ia] = ordre(a), [pb, ib] = ordre(b);
    return pa - pb || ia.localeCompare(ib);
  });
  await writeFile(join(SORTIES, 'catalogue.json'), JSON.stringify({
    genereLe: new Date().toISOString(), publics: PUBLICS,
    videos: videos.map(({ compte, ...v }) => v)
  }, null, 2));
  await ecrireScenarios(videos);
}

/** Fichiers tournés sous le nom `nom` (sans extension), ou null s'il n'y a pas de vidéo. */
async function fichiersDuFormat(nom, existe) {
  if (!await existe(`${nom}.webm`)) return null;
  let duree = null, texte = [], sonore = false;
  if (await existe(`${nom}.json`)) {
    ({ duree, texte = [], sonore = false } = JSON.parse(await readFile(join(SORTIES, `${nom}.json`), 'utf8')));
  }
  // Version : date de la dernière écriture des fichiers de la vidéo. La page
  // l'ajoute à leur adresse, pour qu'une vidéo retournée ne soit pas lue
  // dans le cache du navigateur (Caddy laisse les vidéos en cache).
  const dates = await Promise.all([`${nom}.webm`, `${nom}.mp4`, `${nom}.jpg`]
    .map(f => stat(join(SORTIES, f)).then(i => i.mtimeMs, () => 0)));
  const derniere = Math.max(...dates);
  const format = /\.(telephone|ordinateur)$/.exec(nom)?.[1];
  return {
    format,
    webm: `${nom}.webm`,
    mp4: await existe(`${nom}.mp4`) ? `${nom}.mp4` : null,
    vignette: await existe(`${nom}.jpg`) ? `${nom}.jpg` : null,
    duree, texte, voix: sonore,
    version: derniere ? Math.round(derniere).toString(36) : null
  };
}

/** SCENARIOS.md : le plan de chaque vidéo et son texte, pour tourner ou commenter soi-même. */
async function ecrireScenarios(videos) {
  const lignes = [
    '# Vidéos explicatives — les scénarios',
    '',
    '<!-- Généré par `node enregistrer.mjs` (ou `--catalogue`) : ne pas modifier à la main.',
    '     Le texte vient des sous-titres des scénarios (scenarios/*.mjs). -->',
    '',
    'Une vidéo par geste, rangées par rôle. Chacune existe en deux formes : ce texte (le',
    'déroulé et la voix off, pour tourner soi-même ou commenter une vidéo muette) et le',
    'scénario Playwright qui l\'enregistre (voir `LISEZ-MOI.md`). Mot de passe des comptes',
    'de démonstration : `plongee2026`. La page publique `/videos` de l\'appli les présente',
    'dans le même ordre.',
    ''
  ];
  const manuels = await manuelsParVideo();
  const sansManuel = videos.filter(v => !manuels.has(v.id)).map(v => v.id);
  if (sansManuel.length) {
    console.warn(`Vidéos qu'aucun manuel ne cite (frontend/src/app/features/aide/manuels/) : ${sansManuel.join(', ')}`);
  }
  for (const rubrique of PUBLICS) {
    const liste = videos.filter(v => v.public === rubrique);
    if (liste.length === 0) continue;
    lignes.push(`## ${rubrique}`, '');
    for (const v of liste) {
      const noms = { telephone: 'téléphone', ordinateur: 'ordinateur' };
      const formats = Object.keys(v.formats).map(f => noms[f]).join(' et ');
      const manuel = manuels.get(v.id);
      lignes.push(`### ${v.id} — ${v.titre}`, '', v.resume, '',
        `Compte : \`${v.compte}\` · format${Object.keys(v.formats).length > 1 ? 's' : ''} ${formats}`
          + (v.duree ? ` · ${v.duree} s` : '') + (manuel ? ` · manuel : \`${manuel}\`` : ''), '');
      if (v.texte.length === 0) {
        lignes.push('_Pas encore tournée : le texte viendra au premier enregistrement._', '');
      } else {
        v.texte.forEach((t, i) => lignes.push(`${i + 1}. ${t}`));
        lignes.push('');
        // L'autre format, quand sa voix off diffère (« Plus » sur téléphone, le menu en haut sur ordinateur).
        for (const [f, fichiers] of Object.entries(v.formats)) {
          if (f === v.format || !fichiers?.texte?.length || fichiers.texte.join('\n') === v.texte.join('\n')) continue;
          lignes.push(`Au format ${noms[f]} :`, '');
          fichiers.texte.forEach((t, i) => lignes.push(`${i + 1}. ${t}`));
          lignes.push('');
        }
      }
    }
  }
  await writeFile(join(ICI, 'SCENARIOS.md'), lignes.join('\n'));
}

/** Code de vidéo → fichier du premier manuel qui la cite (ligne « videos: » de son en-tête). */
async function manuelsParVideo() {
  const resultat = new Map();
  const fichiers = await readdir(MANUELS).catch(() => []);
  for (const f of fichiers.filter(f => f.endsWith('.md') && f !== 'LISEZ-MOI.md').sort()) {
    const ligne = /^videos:(.*)$/m.exec(await readFile(join(MANUELS, f), 'utf8'));
    for (const id of (ligne?.[1] ?? '').split(',').map(v => v.trim()).filter(Boolean)) {
      if (!resultat.has(id)) resultat.set(id, f);
    }
  }
  return resultat;
}
