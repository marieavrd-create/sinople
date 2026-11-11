// Fin d'une leçon jouée dans le navigateur : calcule le bilan et l'enregistre sur l'appareil.
import { bilanLecon, pointsQcm, type Bilan } from '../lib/jeu/points';
import { serieDuJour, jourParis } from '../lib/jeu/serie';
import { aReviser } from '../lib/jeu/revision';
import { lireEtat, ecrireEtat, stockageNavigateur, terminerLecon, terminerRevision } from '../lib/stockage/local';
import { viesActuelles } from '../lib/jeu/vies';

export function enregistrerFin(fin: {
  theme: string;
  leconId: string;
  etape: number;
  epreuve: boolean;
  reponses: Record<string, boolean>;
  /** Points gagnés par question (une liste à taper rapporte au prorata) ; à défaut, les points d'un QCM. */
  points?: Record<string, number>;
  /** Faux pour le quiz d'exemple, dont les questions n'entrent pas en révision. */
  reviser?: boolean;
  /** Vrai quand le feu s'est éteint en cours de partie : on garde ce qui a été joué, mais la leçon est ratée. */
  interrompue?: boolean;
}): { bilan: Bilan; gradeAvant: number; gradeApres: number; aReviser: number } {
  const maintenant = Date.now();
  const stockage = stockageNavigateur();
  const etat = lireEtat(stockage, maintenant);
  const resultats = Object.entries(fin.reponses).map(([id, juste]) => ({ juste, points: fin.points?.[id] ?? pointsQcm(juste) }));
  const bilan = bilanLecon(resultats, { epreuve: fin.epreuve, joursSerie: serieDuJour(etat.profil.serie, maintenant) });
  if (fin.interrompue) bilan.reussie = false;
  const score = bilan.total ? Math.round((bilan.bonnes / bilan.total) * 100) : 0;
  const apres = terminerLecon(
    etat,
    { ...fin, reponses: fin.reviser === false ? {} : fin.reponses, reussie: bilan.reussie, points: bilan.totalPoints, score },
    maintenant,
  );
  ecrireEtat(stockage, apres);
  return {
    bilan,
    gradeAvant: etat.grades[fin.theme] ?? 1,
    gradeApres: apres.grades[fin.theme] ?? 1,
    aReviser: aReviser(apres.revision, jourParis(maintenant)).length,
  };
}

/** Fin d'une révision : met à jour les fiches et rend une bûche si assez de questions ont été revues. */
export function enregistrerRevision(reponses: Record<string, boolean>): { viesAvant: number; viesApres: number } {
  const maintenant = Date.now();
  const stockage = stockageNavigateur();
  const etat = lireEtat(stockage, maintenant);
  const apres = terminerRevision(etat, reponses, maintenant);
  ecrireEtat(stockage, apres);
  return { viesAvant: viesActuelles(etat.profil.vies, maintenant).vies, viesApres: apres.profil.vies.vies };
}
