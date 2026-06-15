import type { Match } from '../types/domain';

export const mockMatches: Match[] = [
  { id: 'm-bra-esp', stage: 'group', group: 'A', matchday: 1, homeTeamId: 'bra', awayTeamId: 'esp', kickoffAt: '2026-06-12T18:00:00Z', lockAt: '2026-06-12T17:45:00Z', stadium: 'MetLife Stadium', city: 'New York, USA', status: 'finished', homeScore: 2, awayScore: 1, resultUpdatedAt: '2026-06-12T20:00:00Z' },
  { id: 'm-fra-arg', stage: 'group', group: 'B', matchday: 1, homeTeamId: 'fra', awayTeamId: 'arg', kickoffAt: '2026-06-12T21:00:00Z', lockAt: '2026-06-12T20:45:00Z', stadium: 'SoFi Stadium', city: 'Los Angeles, USA', status: 'finished', homeScore: 1, awayScore: 1, resultUpdatedAt: '2026-06-12T23:00:00Z' },
  { id: 'm-jpn-mex', stage: 'group', group: 'C', matchday: 1, homeTeamId: 'jpn', awayTeamId: 'mex', kickoffAt: '2026-06-13T15:00:00Z', lockAt: '2026-06-13T14:45:00Z', stadium: 'NRG Stadium', city: 'Houston, USA', status: 'finished', homeScore: 0, awayScore: 2, resultUpdatedAt: '2026-06-13T17:00:00Z' },
  { id: 'm-ger-mar', stage: 'group', group: 'D', matchday: 2, homeTeamId: 'ger', awayTeamId: 'mar', kickoffAt: '2026-06-14T18:00:00Z', lockAt: '2026-06-14T17:45:00Z', stadium: 'AT&T Stadium', city: 'Dallas, USA', status: 'locked' },
  { id: 'm-usa-kor', stage: 'group', group: 'E', matchday: 2, homeTeamId: 'usa', awayTeamId: 'kor', kickoffAt: '2026-06-15T21:00:00Z', lockAt: '2026-06-15T20:45:00Z', stadium: 'Hard Rock Stadium', city: 'Miami, USA', status: 'open' },
  { id: 'm-esp-fra', stage: 'group', group: 'A', matchday: 3, homeTeamId: 'esp', awayTeamId: 'fra', kickoffAt: '2026-06-18T19:00:00Z', lockAt: '2026-06-18T18:45:00Z', stadium: 'Mercedes-Benz Stadium', city: 'Atlanta, USA', status: 'scheduled' },
];

export function getMatchById(matchId: string) {
  return mockMatches.find((match) => match.id === matchId);
}
