/**
 * Tags NFC collés sur le matériel. Ils portent la même adresse que le QR
 * code de l'étiquette (`origine` + `/materiel/{id}`) : n'importe quel
 * téléphone qui lit le tag ouvre la fiche, et le scanner de l'appli la
 * retrouve par le même appel que pour un QR code.
 */

/** Un enregistrement NDEF tel que le donne `NDEFReader` (Web NFC, Chrome sur Android). */
export interface EnregistrementNfc {
  recordType: string;
  data?: DataView;
  encoding?: string;
}

const TYPES_LUS = ['url', 'absolute-url', 'text'];

/** L'adresse ou la référence écrite sur le tag ; null pour un tag vierge ou illisible. */
export function contenuTagNfc(enregistrements: readonly EnregistrementNfc[]): string | null {
  for (const e of enregistrements) {
    if (!TYPES_LUS.includes(e.recordType) || !e.data) continue;
    const texte = new TextDecoder(e.encoding || 'utf-8').decode(e.data).trim();
    if (texte) return texte;
  }
  return null;
}

/** Ce que l'appli écrit sur un tag : l'id, pas la référence, pour la corriger sans reprogrammer. */
export function adresseFicheEquipement(origine: string, equipementId: number): string {
  return `${origine.replace(/\/+$/, '')}/materiel/${equipementId}`;
}

/** Lecteur NFC du navigateur (Web NFC) : Chrome sur Android seulement, en HTTPS. */
export interface LecteurNfc extends EventTarget {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  write(message: { records: { recordType: string; data: string }[] },
        options?: { signal?: AbortSignal; overwrite?: boolean }): Promise<void>;
  /** Irréversible : le tag ne pourra plus jamais être réécrit. */
  makeReadOnly(options?: { signal?: AbortSignal }): Promise<void>;
}

/** Un tag lu : l'événement `reading` de `NDEFReader`. */
export interface LectureNfc extends Event {
  message: { records: readonly EnregistrementNfc[] };
}

/** Un lecteur NFC, ou null quand le navigateur n'en a pas (iPhone, Firefox, ordinateur). */
export function lecteurNfc(): LecteurNfc | null {
  const Lecteur = (globalThis as unknown as { NDEFReader?: new () => LecteurNfc }).NDEFReader;
  return Lecteur ? new Lecteur() : null;
}

export const NFC_DISPONIBLE = 'NDEFReader' in globalThis;

/** ECRIT : réinscriptible ; VERROUILLE : définitif ; NON_VERROUILLE : écrit et lisible, mais le verrou a échoué. */
export type ResultatProgrammation = 'ECRIT' | 'VERROUILLE' | 'NON_VERROUILLE';

/**
 * Écrit l'adresse de la fiche sur le tag puis, si demandé, le verrouille
 * (tant que le tag est contre le téléphone). Une écriture ratée ou une
 * annulation remonte ; un verrou raté n'empêche pas le tag de servir.
 */
export async function programmerTag(lecteur: LecteurNfc, adresse: string, verrouiller: boolean,
                                    signal?: AbortSignal): Promise<ResultatProgrammation> {
  await lecteur.write({ records: [{ recordType: 'url', data: adresse }] }, { signal });
  if (!verrouiller) return 'ECRIT';
  try {
    await lecteur.makeReadOnly({ signal });
    return 'VERROUILLE';
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') throw err;
    return 'NON_VERROUILLE';
  }
}
