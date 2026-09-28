/** Assez pour lire un numéro de série ou voir une déchirure, sans dépasser la limite du serveur (5 Mo). */
const COTE_MAX = 1600;
const POIDS_MAX_OCTETS = 1_500_000;

/**
 * Réduit une photo prise au téléphone (souvent 4 à 8 Mo) avant l'envoi :
 * plus grand côté ramené à {@link COTE_MAX}, JPEG, qualité baissée tant que
 * le fichier dépasse {@link POIDS_MAX_OCTETS}. L'orientation EXIF est
 * appliquée (une photo prise en portrait reste en portrait).
 */
export async function reduirePhoto(fichier: File): Promise<File> {
  const image = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * echelle);
  canvas.height = Math.round(image.height * echelle);
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();

  let qualite = 0.85;
  let blob = await versBlob(canvas, qualite);
  while (blob.size > POIDS_MAX_OCTETS && qualite > 0.4) {
    qualite -= 0.1;
    blob = await versBlob(canvas, qualite);
  }
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
}

function versBlob(canvas: HTMLCanvasElement, qualite: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Échec de la compression')), 'image/jpeg', qualite);
  });
}
