// Montage des vidéos tournées : pose la voix off (les phrases de
// sorties/voix/, chacune à l'instant noté au tournage dans sorties/<nom>.json)
// sur la vidéo WebM, puis en tire le MP4, que l'iPhone lit mieux.
//
//   node monter.mjs            toutes les vidéos de sorties/ pas encore montées
//   FFMPEG=/chemin/ffmpeg node monter.mjs
//
// Lancé par tourner.sh après l'enregistrement. Une vidéo déjà montée (MP4
// plus récent que le WebM) est laissée telle quelle.

import { readdir, readFile, writeFile, rename, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const SORTIES = join(ICI, 'sorties');
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const executer = promisify(execFile);

const date = async f => stat(f).then(s => s.mtimeMs, () => 0);
const ffmpeg = args => executer(FFMPEG, ['-loglevel', 'error', '-y', ...args], { maxBuffer: 1 << 24 });

let echecs = 0;
for (const fichier of (await readdir(SORTIES)).filter(f => f.endsWith('.webm') && !f.startsWith('.')).sort()) {
  const nom = fichier.replace(/\.webm$/, '');
  const webm = join(SORTIES, fichier);
  const mp4 = join(SORTIES, `${nom}.mp4`);
  const cheminJson = join(SORTIES, `${nom}.json`);
  const infos = JSON.parse(await readFile(cheminJson, 'utf8').catch(() => '{}'));
  const pistes = infos.voix ?? [];
  const aSonoriser = pistes.length > 0 && !infos.sonore;
  if (!aSonoriser && await date(mp4) > await date(webm)) continue;

  try {
    if (aSonoriser) {
      // Chaque phrase décalée à son instant, puis toutes mélangées. Ni apad
      // ni -shortest : le WebM de Playwright n'annonce pas sa durée et ffmpeg
      // ne s'arrêterait jamais. Le tournage attend la fin de la dernière
      // phrase, la voix ne dépasse donc jamais l'image.
      const entrees = pistes.flatMap(p => ['-i', join(SORTIES, 'voix', basename(p.fichier))]);
      const decalages = pistes.map((p, i) => `[${i + 1}:a]adelay=delays=${p.debut}:all=1[v${i}]`);
      const melange = `${pistes.map((_, i) => `[v${i}]`).join('')}amix=inputs=${pistes.length}:normalize=0,aresample=48000[voix]`;
      const provisoire = join(SORTIES, `.${nom}.son.webm`);
      await ffmpeg(['-i', webm, ...entrees, '-filter_complex', [...decalages, melange].join(';'),
        '-map', '0:v', '-map', '[voix]', '-c:v', 'copy', '-c:a', 'libopus', '-b:a', '64k', provisoire]);
      await rename(provisoire, webm);
      await writeFile(cheminJson, JSON.stringify({ ...infos, sonore: true }));
    }
    // H.264 exige des dimensions paires (839 points de haut sur téléphone).
    await ffmpeg(['-i', webm, '-map', '0:v', '-map', '0:a?', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-b:a', '96k',
      '-movflags', '+faststart', mp4]);
    console.log(`${nom}.mp4${aSonoriser ? ' (voix off)' : ''}`);
  } catch (e) {
    echecs++;
    console.log(`${nom} : ÉCHEC du montage\n  ${String(e.stderr || e.message).trim().split('\n')[0]}`);
  }
}
process.exit(echecs ? 1 : 0);
