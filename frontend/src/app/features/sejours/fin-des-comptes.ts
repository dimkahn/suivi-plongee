import { BilanDecompte, FraisVue, PreuveVirementVue, Remboursement } from './sejour-api';

/**
 * La preuve envoyée pour un remboursement à faire, tant qu'elle attend d'être
 * confirmée : l'écran dit « Preuve envoyée » au lieu de proposer « J'ai payé ».
 * Le club ne rembourse jamais par une preuve (il n'envoie rien).
 */
export function preuveEnAttente(f: FraisVue, r: Remboursement): PreuveVirementVue | undefined {
  if (r.deId === null) return undefined;
  return f.preuves.find(p => p.versementId === null && p.deId === r.deId && p.aId === r.aId);
}

/** Les preuves que celui qui regarde peut confirmer ou refuser (le serveur en décide). */
export function preuvesAConfirmer(f: FraisVue): PreuveVirementVue[] {
  return f.preuves.filter(p => f.droits.preuvesConfirmables.includes(p.id));
}

/** Le compte rendu de l'envoi du décompte, en une phrase par cas. */
export function texteBilanDecompte(b: BilanDecompte): string {
  return [
    b.envoyes.length ? `Décompte envoyé à : ${b.envoyes.join(', ')}.` : 'Aucun e-mail envoyé.',
    b.sansEmail.length ? `Sans e-mail : ${b.sansEmail.join(', ')}.` : '',
    b.echecs.length ? `Échec de l'envoi pour : ${b.echecs.join(', ')}.` : '',
    b.sansFrais.length ? `Aucun frais, rien envoyé : ${b.sansFrais.join(', ')}.` : ''
  ].filter(Boolean).join(' ');
}
