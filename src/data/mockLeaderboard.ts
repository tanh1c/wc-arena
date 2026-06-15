import type { LeaderboardEntry } from '../types/domain';

export const mockLeaderboard: LeaderboardEntry[] = [
  { userId: 'user-goalguru', rank: 1, previousRank: 1, points: 2450, exactScores: 41, accuracy: 78, streak: 7 },
  { userId: 'user-netbuster', rank: 2, previousRank: 3, points: 2120, exactScores: 34, accuracy: 73, streak: 5 },
  { userId: 'user-pitchwizard', rank: 3, previousRank: 2, points: 1980, exactScores: 32, accuracy: 70, streak: 4 },
  { userId: 'user-you', rank: 124, previousRank: 139, points: 8, exactScores: 1, accuracy: 67, streak: 2 },
];
