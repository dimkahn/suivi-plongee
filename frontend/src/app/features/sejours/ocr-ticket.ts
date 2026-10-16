import { NoteLue, RegleLecture } from './sejour-api';
import { analyserTicket } from './lecture-ticket';

/**
 * Lit la photo d'une note sur le téléphone même, sans intelligence
 * artificielle ni service extérieur : Tesseract (reconnaissance de
 * caractères, logiciel libre) en tire le texte, `analyserTicket` y trouve le
 * total, la date et la catégorie. La photo ne quitte pas l'appareil.
 *
 * Le programme et le dictionnaire français (~4,6 Mo, servis par l'appli
 * sous /ocr/, voir angular.json) ne sont téléchargés qu'à la première
 * lecture, puis gardés par le navigateur.
 *
 * Rend aussi le texte lu, gardé le temps de la saisie pour apprendre des
 * corrections (`leconDuTicket`) ; il n'est jamais envoyé.
 */
export async function lireTicketSurLeTelephone(photo: Blob, regles: RegleLecture[]):
  Promise<{ note: NoteLue; texte: string }> {
  const { createWorker, OEM } = await import('tesseract.js');
  const lecteur = await createWorker('fra', OEM.LSTM_ONLY, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/coeur',
    langPath: '/ocr/langue'
  });
  try {
    const { data } = await lecteur.recognize(photo);
    return { note: analyserTicket(data.text, regles), texte: data.text };
  } finally {
    await lecteur.terminate();
  }
}
