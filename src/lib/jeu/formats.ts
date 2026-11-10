// Les formats « molette », « jauge », « pastilles » et « registre » : est-ce juste, et combien de points.
import { regles } from './regles';

const P = regles.points;

/** Molette et jauge : juste si la valeur choisie tombe à « tolerance » près de la bonne. */
export function estimationJuste(valeur: number, juste: number, tolerance: number): boolean {
  return Math.abs(valeur - juste) <= tolerance + 1e-9;
}

export function pointsEstimation(valeur: number, juste: number, tolerance: number): number {
  return estimationJuste(valeur, juste, tolerance) ? P.estimation_juste : 0;
}

/** Pastilles : juste seulement si toutes les bonnes sont cochées et aucun piège. */
export function pastillesJustes(cochees: number[], justes: number[]): boolean {
  const c = new Set(cochees);
  return c.size === justes.length && justes.every((k) => c.has(k));
}

/** Pastilles : points au prorata des bonnes trouvées, moins un cran par piège coché (jamais en dessous de 0). */
export function pointsPastilles(cochees: number[], justes: number[]): number {
  const j = new Set(justes);
  const c = [...new Set(cochees)];
  const bonnes = c.filter((k) => j.has(k)).length;
  const pieges = c.length - bonnes;
  return Math.round((P.pastilles_max * Math.max(0, bonnes - pieges)) / justes.length);
}

/** Registre : les choix rangés par ordre alphabétique, à la française (É avec les E). */
export function ordreAlphabetique(choix: string[]): string[] {
  return [...choix].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
}

/** Pour chercher sans se soucier des accents ni des majuscules. */
export function sansAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr');
}

/** Les crans d'une molette, de min à max. */
export function crans(min: number, max: number, pas: number): number[] {
  const n = Math.round((max - min) / pas);
  return Array.from({ length: n + 1 }, (_, i) => Number((min + i * pas).toFixed(6)));
}
