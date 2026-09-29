// Tourne une ou plusieurs vidéos. Chaque scénario est un fichier de
// scenarios/ ; sa vidéo (WebM, sans son) arrive dans sorties/.
//
//   node enregistrer.mjs              tous les scénarios
//   node enregistrer.mjs M03 M04      seulement ceux-là
//   RYTHME=1.5 node enregistrer.mjs   pauses 50 % plus longues
//
// Prérequis : backend en profil dev redémarré, puis `node preparer-donnees.mjs`,
// frontend sur http://localhost:4200. Certains scénarios écrivent (notes,
// présences, réponse au planning) : pour retourner une vidéo, repartir d'un
// backend redémarré et relancer la préparation.

import { readdir, rename, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ouvrirTournage, gestes } from './commun.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const SORTIES = join(ICI, 'sorties');

const demandes = process.argv.slice(2).map(a => a.toUpperCase());
const fichiers = (await readdir(join(ICI, 'scenarios')))
  .filter(f => f.endsWith('.mjs'))
  .filter(f => demandes.length === 0 || demandes.some(d => f.toUpperCase().startsWith(d)))
  .sort();

if (fichiers.length === 0) {
  console.error(`Aucun scénario ne correspond à : ${demandes.join(', ')}`);
  process.exit(1);
}

await mkdir(SORTIES, { recursive: true });
let echecs = 0;

for (const fichier of fichiers) {
  const scenario = (await import(`./scenarios/${fichier}`)).default;
  const nom = fichier.replace(/\.mjs$/, '');
  const brouillon = join(SORTIES, `.${nom}`);
  process.stdout.write(`${scenario.id} — ${scenario.titre}… `);

  const { navigateur, contexte, page } = await ouvrirTournage({
    compte: scenario.compte, connecte: scenario.connecte ?? true, dossier: brouillon
  });
  try {
    await scenario.jouer(gestes(page));
    await contexte.close(); // termine l'écriture de la vidéo
    const [video] = await readdir(brouillon);
    await rename(join(brouillon, video), join(SORTIES, `${nom}.webm`));
    console.log(`sorties/${nom}.webm`);
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

process.exit(echecs ? 1 : 0);
