import type { Badge } from '../types/domain';

export const mockBadges: Badge[] = [
  { id: 'exact-score-merchant', name: 'Exact Score Merchant', description: 'Call five exact scores.', category: 'skill', rarity: 'rare', progressCurrent: 1, progressTarget: 5 },
  { id: 'hot-streak', name: 'Hot Streak', description: 'Hit three correct outcomes in a row.', category: 'streak', rarity: 'common', unlockedAt: '2026-06-13T17:05:00Z', progressCurrent: 3, progressTarget: 3 },
  { id: 'risk-taker', name: 'Risk Taker', description: 'Score points with a risk pick.', category: 'risk', rarity: 'epic', progressCurrent: 1, progressTarget: 3 },
];
