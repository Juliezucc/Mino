/**
 * Screenshots used by the guide.
 *
 * They are generated from the running app by `scripts/capture-guide.mjs`, not
 * drawn: a guide illustrated with mockups drifts the first time a button moves,
 * and a parent following a picture that no longer matches their screen gives
 * up. Re-run the script after changing any screen the guide covers.
 */
export const SCREENS = {
  accueil: require('../../assets/guide/accueil.webp'),
  qui: require('../../assets/guide/qui.webp'),
  enfantAccueil: require('../../assets/guide/enfant-accueil.webp'),
  enfantMissions: require('../../assets/guide/enfant-missions.webp'),
  enfantMission: require('../../assets/guide/enfant-mission.webp'),
  enfantAttente: require('../../assets/guide/enfant-attente.webp'),
  enfantTemps: require('../../assets/guide/enfant-temps.webp'),
  enfantCelebration: require('../../assets/guide/enfant-celebration.webp'),
  parentAccueil: require('../../assets/guide/parent-accueil.webp'),
  parentMissions: require('../../assets/guide/parent-missions.webp'),
  parentRoutine: require('../../assets/guide/parent-routine.webp'),
  parentNouvelleMission: require('../../assets/guide/parent-nouvelle-mission.webp'),
  parentEnfants: require('../../assets/guide/parent-enfants.webp'),
  parentReglages: require('../../assets/guide/parent-reglages.webp'),
  parentAppareils: require('../../assets/guide/parent-appareils.webp'),
  parentAbonnement: require('../../assets/guide/parent-abonnement.webp'),
  parentParrainage: require('../../assets/guide/parent-parrainage.webp'),
} as const;

export type ScreenKey = keyof typeof SCREENS;
