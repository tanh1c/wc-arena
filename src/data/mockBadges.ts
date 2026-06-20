import type { Badge } from '../types/domain';

export const mockBadges: Badge[] = [
  { id: 'exact-score-merchant', name: 'Exact Score Merchant', description: 'Call five exact scores.', category: 'skill', rarity: 'rare', progressCurrent: 1, progressTarget: 5 },
  { id: 'hot-streak', name: 'Hot Streak', description: 'Hit three correct outcomes in a row.', category: 'streak', rarity: 'common', unlockedAt: '2026-06-13T17:05:00Z', progressCurrent: 3, progressTarget: 3 },
  { id: 'risk-taker', name: 'Risk Taker', description: 'Score points with a risk pick.', category: 'risk', rarity: 'epic', progressCurrent: 1, progressTarget: 3 },
  { id: 'first-pick', name: 'First Pick', description: 'Submit your first match prediction.', category: 'skill', rarity: 'common', progressCurrent: 1, progressTarget: 1 },
  { id: 'outcome-master', name: 'Outcome Master', description: 'Call ten match outcomes correctly.', category: 'skill', rarity: 'rare', progressCurrent: 2, progressTarget: 10 },
  { id: 'group-stage', name: 'Group Stage Grinder', description: 'Submit predictions across the group stage.', category: 'event', rarity: 'common', progressCurrent: 5, progressTarget: 12 },
  { id: 'knockout', name: 'Knockout Specialist', description: 'Score points during the knockout rounds.', category: 'event', rarity: 'epic', progressCurrent: 0, progressTarget: 4 },
  { id: 'finals', name: 'Finals Oracle', description: 'Submit predictions for the final match window.', category: 'event', rarity: 'legendary', progressCurrent: 0, progressTarget: 1 },
  { id: 'top-ranker', name: 'Top Ranker', description: 'Reach a top leaderboard tier.', category: 'rank', rarity: 'legendary', progressCurrent: 0, progressTarget: 1 },
  { id: 'daily-return', name: 'Daily Return', description: 'Come back on multiple matchdays to keep predicting.', category: 'social', rarity: 'common', progressCurrent: 2, progressTarget: 7 },
  { id: 'league-player', name: 'League Player', description: 'Join a league and compete with other players.', category: 'social', rarity: 'rare', progressCurrent: 1, progressTarget: 1 },
];
