import { BilanEnvoiParametres } from '../../core/modeles';

/** Le compte rendu, en une phrase par cas, de l'envoi des paramètres de plongée aux participants cochés. */
export function texteBilanParametres(b: BilanEnvoiParametres): string {
  return [
    b.envoyes.length
      ? `Paramètres envoyés à : ${b.envoyes
        .map(d => `${d.nom} (${d.nombrePlongees} plongée${d.nombrePlongees > 1 ? 's' : ''})`).join(', ')}.`
      : 'Aucun e-mail envoyé.',
    b.sansPlongee.length ? `Dans aucune palanquée des fiches de sécurité : ${b.sansPlongee.join(', ')}.` : '',
    b.sansEmail.length ? `Sans e-mail : ${b.sansEmail.join(', ')}.` : '',
    b.echecs.length ? `Échec de l'envoi pour : ${b.echecs.join(', ')}.` : ''
  ].filter(Boolean).join(' ');
}
