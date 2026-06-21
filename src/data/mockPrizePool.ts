import type { PrizeTier } from '../types/domain';

export const mockPrizePoolSummary = {
  totalAmount: 25000,
  sponsorFundedAmount: 22000,
  communityBackedAmount: 3000,
  currency: 'USD',
  eligiblePlayers: 0,
};

export const mockPrizeTiers: PrizeTier[] = [
  { id: 'tier-1', label: '1st Place', amount: 10000, rankStart: 1, rankEnd: 1, sponsorFunded: true },
  { id: 'tier-2', label: '2nd Place', amount: 5000, rankStart: 2, rankEnd: 2, sponsorFunded: true },
  { id: 'tier-3', label: '3rd Place', amount: 2500, rankStart: 3, rankEnd: 3, sponsorFunded: true },
  { id: 'tier-4-10', label: '4th - 10th Place', amount: 1000, rankStart: 4, rankEnd: 10, sponsorFunded: true },
  { id: 'tier-11-100', label: '11th - 100th Place', amount: 250, rankStart: 11, rankEnd: 100, sponsorFunded: true },
  { id: 'tier-101-1000', label: '101st - 1000th Place', amount: 50, rankStart: 101, rankEnd: 1000, sponsorFunded: false },
];
