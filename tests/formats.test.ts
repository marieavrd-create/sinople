import { describe, expect, it } from 'vitest';
import { estimationJuste, pointsEstimation, pastillesJustes, pointsPastilles, ordreAlphabetique, sansAccents, crans } from '../src/lib/jeu/formats';
import { controlerLecons } from '../src/lib/contenu/controles';

describe('molette et jauge', () => {
  it('sont justes à la tolérance près', () => {
    expect(estimationJuste(1969, 1969, 0)).toBe(true);
    expect(estimationJuste(1970, 1969, 0)).toBe(false);
    expect(estimationJuste(66, 71, 5)).toBe(true);
    expect(estimationJuste(65, 71, 5)).toBe(false);
    expect(pointsEstimation(73, 71, 5)).toBe(10);
    expect(pointsEstimation(50, 71, 5)).toBe(0);
  });

  it('donnent tous les crans de min à max', () => {
    expect(crans(1940, 1945, 1)).toEqual([1940, 1941, 1942, 1943, 1944, 1945]);
    expect(crans(0, 1, 0.25)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});

describe('pastilles', () => {
  it('ne sont justes que sans oubli ni piège', () => {
    expect(pastillesJustes([2, 0], [0, 2])).toBe(true);
    expect(pastillesJustes([0], [0, 2])).toBe(false);
    expect(pastillesJustes([0, 2, 3], [0, 2])).toBe(false);
  });

  it('comptent les points au prorata, un piège annulant une bonne', () => {
    expect(pointsPastilles([0, 1, 2, 3], [0, 1, 2, 3])).toBe(10);
    expect(pointsPastilles([0, 1], [0, 1, 2, 3])).toBe(5);
    expect(pointsPastilles([0, 1, 5], [0, 1, 2, 3])).toBe(3);
    expect(pointsPastilles([5, 6], [0, 1, 2, 3])).toBe(0);
  });
});

describe('registre', () => {
  it('range à la française et cherche sans accents', () => {
    expect(ordreAlphabetique(['Perth', 'Adélaïde', 'Auckland', 'Éphèse'])).toEqual(['Adélaïde', 'Auckland', 'Éphèse', 'Perth']);
    expect(sansAccents('Adélaïde').includes(sansAccents('ADELA'))).toBe(true);
  });
});

const base = { niveau: 'facile', q: 'Question ?', explication: 'Parce que.', source: 'Une source' };
const lecon = (questions: unknown[]) => [{
  chemin: 'geographie/1-1.json',
  donnees: { id: 'geographie-1-1', theme: 'geographie', etape: 1, lecon: 1, titre: 'Titre', questions },
}];

describe('contrôles des nouveaux formats', () => {
  it('acceptent des questions correctes', () => {
    expect(controlerLecons(lecon([
      { ...base, id: 'a-1', type: 'molette', min: 1900, max: 2000, juste: 1969 },
      { ...base, id: 'a-2', type: 'jauge', juste: 71 },
      { ...base, id: 'a-3', type: 'pastilles', choix: ['A', 'B', 'C', 'D'], justes: [0, 2] },
      { ...base, id: 'a-4', type: 'registre', choix: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], juste: 'C' },
    ]))).toEqual([]);
  });

  it('signalent les erreurs en nommant la question', () => {
    const e = controlerLecons(lecon([
      { ...base, id: 'b-1', type: 'molette', min: 1900, max: 2000, juste: 2010 },
      { ...base, id: 'b-2', type: 'molette', min: 0, max: 100, pas: 10, juste: 15 },
      { ...base, id: 'b-3', type: 'pastilles', choix: ['A', 'B', 'C', 'D'], justes: [0, 9] },
      { ...base, id: 'b-4', type: 'registre', choix: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], juste: 'Z' },
    ])).join('\n');
    expect(e).toMatch(/b-1.*juste doit être entre min et max/);
    expect(e).toMatch(/b-2.*cran/);
    expect(e).toMatch(/b-3.*désigner un choix/);
    expect(e).toMatch(/b-4.*exactement comme un des choix/);
  });

  it('refusent deux pastilles identiques', () => {
    expect(controlerLecons(lecon([{ ...base, id: 'c-1', type: 'pastilles', choix: ['A', 'B', 'a', 'D'], justes: [0, 1] }])))
      .toEqual(['geographie/1-1.json › c-1 : deux choix sont identiques']);
  });
});
