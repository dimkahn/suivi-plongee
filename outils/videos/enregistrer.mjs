// Tourne une ou plusieurs vidéos. Chaque scénario est un fichier de
// scenarios/ ; sa vidéo (WebM, sans son) et son image d'aperçu arrivent
// dans sorties/, avec catalogue.json, lu par la page publique /videos.
// Les sous-titres affichés pendant le tournage sont gardés : ils forment
// la transcription de la page et le texte de voix off de SCENARIOS.md,
// réécrit à chaque passage.
//
//   node enregistrer.mjs              tous les scénarios
//   node enregistrer.mjs M03 A        M03 et toute la série administrateur
//   RYTHME=1.5 node enregistrer.mjs   pauses 50 % plus longues
//   node enregistrer.mjs --catalogue  réécrit seulement catalogue.json
//                                     (après une conversion en MP4)
//
// Prérequis : backend en profil dev redémarré, puis `node preparer-donnees.mjs`,
// frontend sur http://localhost:4200 (ou tout faire avec tourner.sh). Les
// scénarios sont écrits pour être tournés dans n'importe quel ordre sur les
// mêmes données, mais pas deux fois : pour retourner une vidéo, repartir d'un
// backend redémarré.

import { readdir, readFile, rename, mkdir, rm, writeFile, stat } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ouvrirTournage, ouvrirVoix, gestes } from './commun.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const SORTIES = join(ICI, 'sorties');

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
  const nom = fichier.replace(/\.mjs$/, '');
  const brouillon = join(SORTIES, `.${nom}`);
  const cheminVignette = join(SORTIES, `${nom}.jpg`);
  process.stdout.write(`${scenario.id} — ${scenario.titre}… `);

  await rm(join(SORTIES, `${nom}-ECHEC.png`), { force: true });
  const { navigateur, contexte, page, debutVideo } = await ouvrirTournage({
    compte: scenario.compte, connecte: scenario.connecte ?? true,
    format: scenario.format ?? 'telephone', dossier: brouillon
  });
  const debut = Date.now();
  let vignettePrise = false;
  const texte = [];
  try {
    const g = gestes(page, { vignette: cheminVignette, voix, debutVideo });
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
 * catalogue.json : tous les scénarios, rangés par public, avec les fichiers
 * déjà tournés (vidéo WebM, MP4 s'il existe, image d'aperçu, durée). Un
 * scénario pas encore tourné y figure sans vidéo : la page l'annonce « à venir ».
 */
async function ecrireCatalogue() {
  const existe = async f => stat(join(SORTIES, f)).then(() => true, () => false);
  const videos = [];
  for (const fichier of tous) {
    const s = (await import(`./scenarios/${fichier}`)).default;
    const nom = fichier.replace(/\.mjs$/, '');
    const tournee = await existe(`${nom}.webm`);
    let duree = null, texte = [], sonore = false;
    if (tournee && await existe(`${nom}.json`)) {
      ({ duree, texte = [], sonore = false } = JSON.parse(await readFile(join(SORTIES, `${nom}.json`), 'utf8')));
    }
    videos.push({
      id: s.id, titre: s.titre, public: s.public, resume: s.resume,
      format: s.format ?? 'telephone',
      webm: tournee ? `${nom}.webm` : null,
      mp4: await existe(`${nom}.mp4`) ? `${nom}.mp4` : null,
      vignette: await existe(`${nom}.jpg`) ? `${nom}.jpg` : null,
      duree, texte, voix: sonore, compte: s.compte
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
  for (const rubrique of PUBLICS) {
    const liste = videos.filter(v => v.public === rubrique);
    if (liste.length === 0) continue;
    lignes.push(`## ${rubrique}`, '');
    for (const v of liste) {
      const format = v.format === 'ordinateur' ? 'ordinateur' : 'téléphone';
      lignes.push(`### ${v.id} — ${v.titre}`, '', v.resume, '',
        `Compte : \`${v.compte}\` · format ${format}` + (v.duree ? ` · ${v.duree} s` : ''), '');
      if (v.texte.length === 0) {
        lignes.push('_Pas encore tournée : le texte viendra au premier enregistrement._', '');
      } else {
        v.texte.forEach((t, i) => lignes.push(`${i + 1}. ${t}`));
        lignes.push('');
      }
    }
  }
  await writeFile(join(ICI, 'SCENARIOS.md'), lignes.join('\n'));
}
