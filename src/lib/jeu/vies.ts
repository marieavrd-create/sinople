// Vies (les bûches du feu) : 5 au maximum, une revient toutes les 30 minutes.
// Calcul « paresseux » : on garde le nombre de vies et la date du dernier calcul, sans minuterie.
import { regles } from './regles';

const { max, recharge_minutes, regagnee_par_revision, questions_min_revision } = regles.vies;
const RECHARGE_MS = recharge_minutes * 60_000;

/** `maj` : date (en ms) à partir de laquelle court la recharge en cours. */
export type EtatVies = { vies: number; maj: number };

export function viesDeDepart(maintenant: number): EtatVies {
  return { vies: max, maj: maintenant };
}

/** Vies disponibles maintenant, en comptant celles revenues depuis `maj`. La recharge entamée est conservée. */
export function viesActuelles(etat: EtatVies, maintenant: number): EtatVies {
  if (etat.vies >= max) return { vies: max, maj: maintenant };
  const revenues = Math.floor(Math.max(0, maintenant - etat.maj) / RECHARGE_MS);
  if (etat.vies + revenues >= max) return { vies: max, maj: maintenant };
  return { vies: etat.vies + revenues, maj: etat.maj + revenues * RECHARGE_MS };
}

/** Une mauvaise réponse brûle une bûche (jamais en dessous de 0). */
export function perdreVie(etat: EtatVies, maintenant: number): EtatVies {
  const a = viesActuelles(etat, maintenant);
  return { vies: Math.max(0, a.vies - 1), maj: a.vies >= max ? maintenant : a.maj };
}

/** Une révision d'au moins 3 questions rend une vie. */
export function viesApresRevision(etat: EtatVies, nbQuestions: number, maintenant: number): EtatVies {
  const a = viesActuelles(etat, maintenant);
  if (nbQuestions < questions_min_revision) return a;
  const vies = Math.min(max, a.vies + regagnee_par_revision);
  return { vies, maj: vies >= max ? maintenant : a.maj };
}

/** Millisecondes avant la prochaine vie ; 0 si toutes les vies sont là. */
export function prochaineVieDans(etat: EtatVies, maintenant: number): number {
  const a = viesActuelles(etat, maintenant);
  return a.vies >= max ? 0 : a.maj + RECHARGE_MS - maintenant;
}
