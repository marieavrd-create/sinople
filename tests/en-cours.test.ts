import { describe, expect, it } from 'vitest';
import { ecrireEnCours, lireEnCours, effacerEnCours, CLE_EN_COURS, DUREE_EN_COURS_MS, type Stockage } from '../src/lib/stockage/local';

function faux(): Stockage & { donnees: Record<string, string> } {
  const donnees: Record<string, string> = {};
  return { donnees, getItem: (k) => donnees[k] ?? null, setItem: (k, v) => void (donnees[k] = v), removeItem: (k) => void delete donnees[k] };
}

const t0 = Date.parse('2026-11-13T13:00:00Z');
const ids = ['q1', 'q2', 'q3', 'q4'];
const enCours = { leconId: 'geographie-1-1', suivante: 2, reponses: { q1: true, q2: false }, points: { q1: 10, q2: 0 }, le: t0 };

describe('leçon en cours', () => {
  it('reprend une leçon interrompue à la question suivante', () => {
    const s = faux();
    ecrireEnCours(s, enCours);
    expect(lireEnCours(s, 'geographie-1-1', ids, t0 + 60_000)).toEqual(enCours);
  });

  it('ne reprend pas une autre leçon, une leçon trop ancienne ou dont les questions ont changé', () => {
    const s = faux();
    ecrireEnCours(s, enCours);
    expect(lireEnCours(s, 'geographie-1-2', ids, t0)).toBeNull();
    expect(lireEnCours(s, 'geographie-1-1', ids, t0 + DUREE_EN_COURS_MS + 1)).toBeNull();
    expect(lireEnCours(s, 'geographie-1-1', ['q1', 'autre', 'q3', 'q4'], t0)).toBeNull();
    expect(lireEnCours(s, 'geographie-1-1', ['q1', 'q2'], t0)).toBeNull(); // plus rien à jouer
  });

  it('oublie la leçon une fois finie, et supporte un stockage illisible', () => {
    const s = faux();
    ecrireEnCours(s, enCours);
    effacerEnCours(s);
    expect(s.donnees[CLE_EN_COURS]).toBeUndefined();
    s.donnees[CLE_EN_COURS] = '{pas du json';
    expect(lireEnCours(s, 'geographie-1-1', ids, t0)).toBeNull();
    expect(lireEnCours(null, 'geographie-1-1', ids, t0)).toBeNull();
  });
});
