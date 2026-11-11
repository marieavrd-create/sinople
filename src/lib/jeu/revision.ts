// Révision espacée (système de Leitner à 6 boîtes). Une question ratée entre en boîte 1, révisable le jour même ;
// chaque bonne réponse la fait passer à la boîte suivante, revue de plus en plus tard (0, 1, 2, 4, 8, 16 jours).
import { regles } from './regles';
import { joursEntre } from './serie';

const delais = regles.revision.delais_jours;

/** `aRevoirLe` : date AAAA-MM-JJ (heure de Paris). */
export type Fiche = { boite: number; aRevoirLe: string };

function ajouterJours(jour: string, n: number): string {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Nouvelle fiche après une réponse, donnée le `jour` (AAAA-MM-JJ).
 * Une question jamais ratée et bien répondue n'entre pas en révision : renvoie `null`.
 */
export function apresReponse(fiche: Fiche | null, juste: boolean, jour: string): Fiche | null {
  if (!juste) return { boite: 1, aRevoirLe: ajouterJours(jour, delais[0]) };
  if (!fiche) return null;
  const boite = Math.min(delais.length, fiche.boite + 1);
  return { boite, aRevoirLe: ajouterJours(jour, delais[boite - 1]) };
}

/** Identifiants des questions à revoir ce `jour`, les plus en retard d'abord. */
export function aReviser(fiches: Record<string, Fiche>, jour: string): string[] {
  return Object.entries(fiches)
    .filter(([, f]) => joursEntre(f.aRevoirLe, jour) >= 0)
    .sort(([, a], [, b]) => a.aRevoirLe.localeCompare(b.aRevoirLe) || a.boite - b.boite)
    .map(([id]) => id);
}
