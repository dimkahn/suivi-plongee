// Sert outils/videos/sorties/ sur http://localhost:4300, pour voir la page
// /videos en développement : ng serve relaie /medias/videos vers ce port
// (frontend/proxy.conf.json), comme Caddy le fait en production.
//
//   node outils/videos/apercu.mjs

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const SORTIES = join(dirname(fileURLToPath(import.meta.url)), 'sorties');
const PORT = Number(process.env.PORT ?? 4300);
const TYPES = { '.json': 'application/json', '.webm': 'video/webm', '.mp4': 'video/mp4', '.jpg': 'image/jpeg' };

createServer(async (req, res) => {
  // /medias/videos/M04.webm → sorties/M04.webm ; rien d'autre n'est servi.
  const nom = basename(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const type = TYPES[extname(nom)];
  const chemin = join(SORTIES, nom);
  const infos = type ? await stat(chemin).catch(() => null) : null;
  if (!infos) {
    res.writeHead(404).end();
    return;
  }
  // Les navigateurs lisent une vidéo par morceaux (en-tête Range).
  const plage = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (plage) {
    const debut = plage[1] ? Number(plage[1]) : 0;
    const fin = plage[2] ? Number(plage[2]) : infos.size - 1;
    res.writeHead(206, {
      'Content-Type': type, 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${debut}-${fin}/${infos.size}`, 'Content-Length': fin - debut + 1
    });
    createReadStream(chemin, { start: debut, end: fin }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': infos.size });
    createReadStream(chemin).pipe(res);
  }
}).listen(PORT, () => console.log(`Vidéos de ${SORTIES} sur http://localhost:${PORT} (page : http://localhost:4200/videos)`));
