// Fin d'une leçon jouée dans le navigateur : calcule le bilan et l'enregistre sur l'appareil.
import { bilanLecon, pointsQcm, type Bilan } from '../lib/jeu/points';
import { serieDuJour } from '../lib/jeu/serie';
import { lireEtat, ecrireEtat, stockageNavigateur, terminerLecon, terminerRevision } from '../lib/stockage/local';
import { viesActuelles } from '../lib/jeu/vies';
import { compterPartie, idVisiteur } from '../lib/stats/compteur';

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
}): { bilan: Bilan; gradeAvant: number; gradeApres: number } {
  const maintenant = Date.now();
  const stockage = stockageNavigateur();
  const etat = lireEtat(stockage, maintenant);
  const resultats = Object.entries(fin.reponses).map(([id, juste]) => ({ juste, points: fin.points?.[id] ?? pointsQcm(juste) }));
  const bilan = bilanLecon(resultats, { epreuve: fin.epreuve, joursSerie: serieDuJour(etat.profil.serie, maintenant) });
  const score = bilan.total ? Math.round((bilan.bonnes / bilan.total) * 100) : 0;
  const apres = terminerLecon(
    etat,
    { ...fin, reponses: fin.reviser === false ? {} : fin.reponses, reussie: bilan.reussie, points: bilan.totalPoints, score },
    maintenant,
  );
  ecrireEtat(stockage, apres);
  // Pour les stats du site : le thème, la leçon et le score, sans rien d'autre sur le joueur.
  void compterPartie({ theme: fin.theme, lecon: fin.leconId, score, reussie: bilan.reussie, visiteur: idVisiteur(stockage) });
  return { bilan, gradeAvant: etat.grades[fin.theme] ?? 1, gradeApres: apres.grades[fin.theme] ?? 1 };
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
