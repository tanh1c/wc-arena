const matchStatLabelKeys = {
  possession: 'ui.statPossession',
  shots: 'ui.statTotalShots',
  shotsOnTarget: 'ui.statShotsOnTarget',
  corners: 'ui.statCorners',
  fouls: 'ui.statFouls',
  yellowCards: 'ui.statYellowCards',
  saves: 'ui.statSaves',
  passAccuracy: 'ui.statPassAccuracy',
} as const;

export type MatchStatKey = keyof typeof matchStatLabelKeys;

export function getMatchStatLabelKey(key: MatchStatKey) {
  return matchStatLabelKeys[key];
}
