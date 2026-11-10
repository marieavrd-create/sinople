// Réglages du jeu (vies, points, réussite, série, révision…), lus dans src/data/regles.json.
// Pour ajuster la difficulté, on modifie ce fichier JSON, pas le code.
import donnees from '../../data/regles.json';

export interface Regles {
  vies: { max: number; recharge_minutes: number; regagnee_par_revision: number; questions_min_revision: number };
  points: {
    qcm_juste: number;
    carte_max: number;
    saisie_max: number;
    estimation_juste: number;
    pastilles_max: number;
    bonus_sans_faute_par_question: number;
    bonus_serie_pourcent: number;
    bonus_serie_plafond_pourcent: number;
  };
  reussite: { lecon: number; epreuve: number };
  serie: { fuseau: string; jours_par_gel: number; gels_max: number };
  revision: { delais_jours: number[]; questions_par_seance: number };
  grades: { max: number };
  saisie: { fautes_tolerees: number; lettres_min_pour_tolerance: number; articles_ignores: string[]; part_pour_juste: number };
  garde_fous: { secondes_min_par_question: number; parties_max_par_heure: number };
  ligues: { taille_groupe: number; montent: number; descendent: number };
}

export const regles: Regles = donnees;
