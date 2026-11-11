import { describe, expect, it } from 'vitest';
import { lireEtat, ecrireEtat, terminerLecon, terminerRevision, etatVide, CLE, ANCIENNE_CLE, VERSION, type Stockage } from '../src/lib/stockage/local';

function faux(initial: Record<string, string> = {}): Stockage & { donnees: Record<string, string> } {
  const donnees = { ...initial };
  return { donnees, getItem: (k) => donnees[k] ?? null, setItem: (k, v) => void (donnees[k] = v) };
}

const t0 = Date.parse('2026-11-02T11:00:00Z');

describe('stockage local', () => {
  it('retrouve une progression de l’ancien format après la mise à jour', () => {
    const s = faux({ [ANCIENNE_CLE]: JSON.stringify({ religion: { quiz: 2, bonnes: 15 }, geographie: { quiz: 1, bonnes: 3 } }) });
    const etat = lireEtat(s, t0);
    expect(etat.version).toBe(VERSION);
    expect(etat.conjures).toEqual(['religion', 'geographie']);
    expect(etat.profil.points).toBe(180); // 18 bonnes réponses × 10 points
    // L'état repris est enregistré sous la nouvelle clé, l'ancienne est gardée.
    expect(JSON.parse(s.donnees[CLE]).profil.points).toBe(180);
    expect(s.donnees[ANCIENNE_CLE]).toBeDefined();
  });

  it('préfère le nouveau format quand il existe', () => {
    const nouveau = { ...etatVide(t0), conjures: ['sport'] };
    const s = faux({ [CLE]: JSON.stringify(nouveau), [ANCIENNE_CLE]: JSON.stringify({ religion: { quiz: 1, bonnes: 1 } }) });
    expect(lireEtat(s, t0).conjures).toEqual(['sport']);
  });

  it('part de zéro sans planter si le stockage est vide, illisible ou absent', () => {
    expect(lireEtat(faux(), t0)).toEqual(etatVide(t0));
    expect(lireEtat(faux({ [CLE]: '{pas du json' }), t0)).toEqual(etatVide(t0));
    expect(lireEtat(null, t0)).toEqual(etatVide(t0));
    const casse: Stockage = { getItem: () => { throw new Error('interdit'); }, setItem: () => { throw new Error('interdit'); } };
    expect(lireEtat(casse, t0)).toEqual(etatVide(t0));
    expect(() => ecrireEtat(casse, etatVide(t0))).not.toThrow();
  });

  it('enregistre une leçon terminée : points, série, conjuré, leçon faite, révision', () => {
    const etat = terminerLecon(etatVide(t0), {
      theme: 'religion', leconId: 'religion-1-1', etape: 1, epreuve: false, reussie: true, points: 80, score: 80,
      reponses: { 'rel-a-1': true, 'rel-a-2': false },
    }, t0);
    expect(etat.profil.points).toBe(80);
    expect(etat.profil.serie).toEqual({ jours: 1, dernierJour: '2026-11-02', gels: 0 });
    expect(etat.conjures).toEqual(['religion']);
    expect(etat.leconsFaites['religion-1-1']).toEqual({ meilleurScore: 80, nbParties: 1, derniereFois: '2026-11-02' });
    expect(etat.revision).toEqual({ 'rel-a-2': { boite: 1, aRevoirLe: '2026-11-02' } });
    expect(etat.grades).toEqual({});
  });

  it('ne compte pas une leçon ratée comme faite, et fait monter le grade après une épreuve réussie', () => {
    const rate = terminerLecon(etatVide(t0), {
      theme: 'religion', leconId: 'religion-1-2', etape: 1, epreuve: false, reussie: false, points: 10, score: 20, reponses: {},
    }, t0);
    expect(rate.leconsFaites).toEqual({});
    const epreuve = terminerLecon(rate, {
      theme: 'religion', leconId: 'religion-1-6', etape: 1, epreuve: true, reussie: true, points: 100, score: 90, reponses: {},
    }, t0);
    expect(epreuve.grades).toEqual({ religion: 2 });
  });
});

describe('révision', () => {
  const base = {
    ...etatVide(t0),
    profil: { ...etatVide(t0).profil, vies: { vies: 2, maj: t0 } },
    revision: Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((id) => [id, { boite: 1, aRevoirLe: '2026-11-02' }])),
  };

  it('fait avancer les fiches et rend une bûche après 3 questions', () => {
    const etat = terminerRevision(base, { a: true, b: true, c: false, d: true, e: true }, t0);
    expect(etat.revision.a).toEqual({ boite: 2, aRevoirLe: '2026-11-03' });
    expect(etat.revision.c).toEqual({ boite: 1, aRevoirLe: '2026-11-02' });
    expect(etat.profil.vies.vies).toBe(3);
  });

  it('ne rend pas de bûche en dessous de 3 questions', () => {
    expect(terminerRevision(base, { a: true, b: true }, t0).profil.vies.vies).toBe(2);
  });
});
