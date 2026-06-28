import { buildGroupStandings, compareGroupStandingRows, type GroupStandingRow } from './groupStandings';
import type { MatchRow } from '../services/matches';
import type { TeamRow } from '../services/teams';

export type ProjectedMatchSide = {
  teamId: string;
  slot: string;
  projected: boolean;
};

export type ProjectedMatchTeams = {
  home: ProjectedMatchSide;
  away: ProjectedMatchSide;
};

const KNOCKOUT_STAGES = new Set(['round32', 'round16', 'quarter', 'semi', 'third_place', 'final']);
const GROUP_SLOT_RE = /^([12])([A-L])$/;
const THIRD_PLACE_SLOT_RE = /^3([A-L](?:\/[A-L])+)$/;
const KNOCKOUT_SLOT_RE = /^([WL])(\d+)$/;

export function buildKnockoutTeamProjection(matches: MatchRow[], teams: Map<string, TeamRow>): Map<string, ProjectedMatchTeams> {
  const rows = Array.from(teams.values());
  const groupStandings = buildStandingsByGroup(matches, rows);
  const thirdPlaceRows = buildThirdPlaceRows(groupStandings);
  const matchesByNumber = new Map(matches.map((match) => [getMatchNumber(match.id), match]).filter((entry): entry is [number, MatchRow] => entry[0] !== null));
  const usedThirdPlaceTeamIds = new Set<string>();
  const projection = new Map<string, ProjectedMatchTeams>();

  matches
    .filter((match) => KNOCKOUT_STAGES.has(match.stage))
    .sort((first, second) => Number(first.id.replace(/\D/g, '')) - Number(second.id.replace(/\D/g, '')))
    .forEach((match) => {
      const home = resolveSlot(match.home_team_id, groupStandings, thirdPlaceRows, matchesByNumber, usedThirdPlaceTeamIds, teams);
      const away = resolveSlot(match.away_team_id, groupStandings, thirdPlaceRows, matchesByNumber, usedThirdPlaceTeamIds, teams);
      projection.set(match.id, { home, away });
    });

  return projection;
}

function buildStandingsByGroup(matches: MatchRow[], teams: TeamRow[]) {
  const groupCodes = Array.from(new Set(teams.map((team) => team.group_code).filter((value): value is string => Boolean(value))));
  return new Map(groupCodes.map((groupCode) => [groupCode, buildGroupStandings(matches, groupCode, teams.filter((team) => team.group_code === groupCode))]));
}

function buildThirdPlaceRows(groupStandings: Map<string, GroupStandingRow[]>) {
  // ponytail: current projections use app standings order; add FIFA head-to-head/fair-play/drawing-lots if exact official tie-breaks are required.
  return Array.from(groupStandings.entries())
    .flatMap(([groupCode, rows]) => rows[2] ? [{ groupCode, row: rows[2] }] : [])
    .sort((first, second) => compareGroupStandingRows(first.row, second.row));
}

function resolveSlot(
  slot: string,
  groupStandings: Map<string, GroupStandingRow[]>,
  thirdPlaceRows: { groupCode: string; row: GroupStandingRow }[],
  matchesByNumber: Map<number, MatchRow>,
  usedThirdPlaceTeamIds: Set<string>,
  teams: Map<string, TeamRow>,
): ProjectedMatchSide {
  const label = teams.get(slot)?.short_name ?? slot;
  const groupSlot = label.match(GROUP_SLOT_RE);
  if (groupSlot) {
    const [, rank, groupCode] = groupSlot;
    const team = groupStandings.get(groupCode)?.[Number(rank) - 1]?.team;
    return { teamId: team?.id ?? slot, slot: label, projected: true };
  }

  const thirdPlaceSlot = label.match(THIRD_PLACE_SLOT_RE);
  if (thirdPlaceSlot) {
    const allowedGroups = new Set(thirdPlaceSlot[1].split('/'));
    const team = thirdPlaceRows.find((candidate) => allowedGroups.has(candidate.groupCode) && !usedThirdPlaceTeamIds.has(candidate.row.team.id))?.row.team;
    if (team) usedThirdPlaceTeamIds.add(team.id);
    return { teamId: team?.id ?? slot, slot: label, projected: true };
  }

  const knockoutSlot = label.match(KNOCKOUT_SLOT_RE);
  if (knockoutSlot) {
    const [, direction, sourceNumber] = knockoutSlot;
    const sourceMatch = matchesByNumber.get(Number(sourceNumber));
    const teamId = sourceMatch ? getKnockoutResultTeamId(sourceMatch, direction as 'W' | 'L') : null;
    return { teamId: teamId ?? slot, slot: label, projected: true };
  }

  return { teamId: slot, slot: label, projected: false };
}

function getKnockoutResultTeamId(match: MatchRow, direction: 'W' | 'L') {
  if (match.status !== 'finished') return null;

  if (match.espn_home_winner === true) return direction === 'W' ? match.home_team_id : match.away_team_id;
  if (match.espn_away_winner === true) return direction === 'W' ? match.away_team_id : match.home_team_id;
  if (typeof match.home_score !== 'number' || typeof match.away_score !== 'number' || match.home_score === match.away_score) return null;

  const homeWon = match.home_score > match.away_score;
  if (direction === 'W') return homeWon ? match.home_team_id : match.away_team_id;
  return homeWon ? match.away_team_id : match.home_team_id;
}

function getMatchNumber(id: string) {
  const match = id.match(/(?:^|-)0*(\d+)$/);
  return match ? Number(match[1]) : null;
}
