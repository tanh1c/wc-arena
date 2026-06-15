import type { User } from '../types/domain';

export const currentUserId = 'user-you';

export const mockUsers: User[] = [
  { id: currentUserId, username: 'YourName', email: 'you@predict2026.test', countryCode: 'US', fanClubTeamId: 'usa', role: 'user', points: 8, rank: 124, accuracy: 67, exactScores: 1, currentStreak: 2, bestStreak: 3, createdAt: '2026-05-01T12:00:00Z' },
  { id: 'user-goalguru', username: 'GoalGuru', email: 'goalguru@predict2026.test', avatarUrl: 'https://i.pravatar.cc/150?u=1', countryCode: 'BR', fanClubTeamId: 'bra', role: 'user', points: 2450, rank: 1, accuracy: 78, exactScores: 41, currentStreak: 7, bestStreak: 11, createdAt: '2026-04-20T09:00:00Z' },
  { id: 'user-netbuster', username: 'NetBuster', email: 'netbuster@predict2026.test', avatarUrl: 'https://i.pravatar.cc/150?u=2', countryCode: 'ES', fanClubTeamId: 'esp', role: 'user', points: 2120, rank: 2, accuracy: 73, exactScores: 34, currentStreak: 5, bestStreak: 9, createdAt: '2026-04-22T09:00:00Z' },
  { id: 'user-pitchwizard', username: 'PitchWizard', email: 'pitchwizard@predict2026.test', avatarUrl: 'https://i.pravatar.cc/150?u=3', countryCode: 'FR', fanClubTeamId: 'fra', role: 'user', points: 1980, rank: 3, accuracy: 70, exactScores: 32, currentStreak: 4, bestStreak: 8, createdAt: '2026-04-23T09:00:00Z' },
];

export function getUserById(userId: string) {
  return mockUsers.find((user) => user.id === userId);
}
