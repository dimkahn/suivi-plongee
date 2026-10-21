import { RelanceCaciVue } from './modeles';
import { normaliser } from './seance-lieu';

/**
 * Les envois de l'historique des relances CACI où figure chacun des mots
 * cherchés (casse et accents ignorés) : dans le destinataire (nom, prénom,
 * adresse) ou dans une même personne concernée. « Tom Vidal » retrouve
 * l'envoi qui cite Vidal Tom ; l'ordre de la liste est gardé.
 */
export function filtrerTraceRelances(trace: RelanceCaciVue[], recherche: string): RelanceCaciVue[] {
  const mots = normaliser(recherche).split(/\s+/).filter(m => m);
  if (mots.length === 0) return trace;
  const contientTout = (champs: string[]) => {
    const texte = champs.map(normaliser).join(' ');
    return mots.every(m => texte.includes(m));
  };
  return trace.filter(e =>
    contientTout([e.destinataireNom, e.destinatairePrenom, e.destinataireEmail])
    || e.personnes.some(p => contientTout([p.nom, p.prenom])));
}
