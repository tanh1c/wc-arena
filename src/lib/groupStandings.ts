import type { MatchRow } from '../services/matches';
import type { TeamRow } from '../services/teams';

export type GroupStandingRow = {
  team: TeamRow;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

export function isCompletedGroupStageMatch(match: MatchRow) {
  return match.stage === 'group'
    && match.status === 'finished'
    && typeof match.home_score === 'number'
    && typeof match.away_score === 'number';
}

export function getRecentCompletedGroupMatchesForTeams(matches: MatchRow[], homeTeamId: string, awayTeamId: string, limit = 6) {
  return matches
    .filter((match) => {
      if (!isCompletedGroupStageMatch(match)) return false;
      return match.home_team_id === homeTeamId
        || match.away_team_id === homeTeamId
        || match.home_team_id === awayTeamId
        || match.away_team_id === awayTeamId;
    })
    .sort((first, second) => new Date(second.kickoff_at).getTime() - new Date(first.kickoff_at).getTime())
    .slice(0, limit);
}

export function buildGroupStandings(matches: MatchRow[], groupCode: string | null | undefined, teams: TeamRow[]) {
  if (!groupCode || teams.length === 0) return [];

  const rows = new Map<string, GroupStandingRow>();

  teams.forEach((team) => {
    rows.set(team.id, {
      team,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  });

  matches
    .filter((match) => isCompletedGroupStageMatch(match) && match.group_code === groupCode)
    .forEach((match) => {
      const home = rows.get(match.home_team_id);
      const away = rows.get(match.away_team_id);
      if (!home || !away || typeof match.home_score !== 'number' || typeof match.away_score !== 'number') return;

      home.played += 1;
      away.played += 1;
      home.goalsFor += match.home_score;
      home.goalsAgainst += match.away_score;
      away.goalsFor += match.away_score;
      away.goalsAgainst += match.home_score;

      if (match.home_score > match.away_score) {
        home.wins += 1;
        home.points += 3;
        away.losses += 1;
      } else if (match.home_score < match.away_score) {
        away.wins += 1;
        away.points += 3;
        home.losses += 1;
      } else {
        home.draws += 1;
        away.draws += 1;
        home.points += 1;
        away.points += 1;
      }
    });

  rows.forEach((row) => {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
  });

  return Array.from(rows.values()).sort(compareGroupStandingRows);
}

export function compareGroupStandingRows(first: GroupStandingRow, second: GroupStandingRow) {
  return second.points - first.points
    || second.goalDifference - first.goalDifference
    || second.goalsFor - first.goalsFor
    || first.goalsAgainst - second.goalsAgainst
    || first.team.short_name.localeCompare(second.team.short_name)
    || first.team.name.localeCompare(second.team.name)
    || first.team.id.localeCompare(second.team.id);
}
