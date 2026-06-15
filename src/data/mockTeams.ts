import type { Team } from '../types/domain';

export const mockTeams: Team[] = [
  { id: 'bra', name: 'Brazil', shortName: 'BRA', countryCode: 'BR', fifaRank: 5, group: 'A' },
  { id: 'esp', name: 'Spain', shortName: 'ESP', countryCode: 'ES', fifaRank: 3, group: 'A' },
  { id: 'fra', name: 'France', shortName: 'FRA', countryCode: 'FR', fifaRank: 2, group: 'B' },
  { id: 'arg', name: 'Argentina', shortName: 'ARG', countryCode: 'AR', fifaRank: 1, group: 'B' },
  { id: 'jpn', name: 'Japan', shortName: 'JPN', countryCode: 'JP', fifaRank: 18, group: 'C' },
  { id: 'mex', name: 'Mexico', shortName: 'MEX', countryCode: 'MX', fifaRank: 14, group: 'C' },
  { id: 'ger', name: 'Germany', shortName: 'GER', countryCode: 'DE', fifaRank: 10, group: 'D' },
  { id: 'mar', name: 'Morocco', shortName: 'MAR', countryCode: 'MA', fifaRank: 12, group: 'D' },
  { id: 'usa', name: 'United States', shortName: 'USA', countryCode: 'US', fifaRank: 16, group: 'E' },
  { id: 'kor', name: 'South Korea', shortName: 'KOR', countryCode: 'KR', fifaRank: 23, group: 'E' },
];

export function getTeamById(teamId: string) {
  return mockTeams.find((team) => team.id === teamId);
}
