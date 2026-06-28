export type BracketTeamRow = {
  id: string;
  name: string;
  short_name: string;
  country_code: string;
  group_code: string | null;
};

export type BracketMatchRow = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  stage: string;
  group_code: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  espn_home_winner: boolean | null;
  espn_away_winner: boolean | null;
};

export type BracketAdvanceUpdate = {
  matchId: string;
  home_team_id?: string;
  away_team_id?: string;
};

type StandingRow = {
  team: BracketTeamRow;
  played: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

const KNOCKOUT_STAGES = new Set(['round32', 'round16', 'quarter', 'semi', 'third_place', 'final']);
const GROUP_SLOT_RE = /^([12])([A-L])$/;
const THIRD_PLACE_SLOT_RE = /^3([A-L](?:\/[A-L])+)$|^3([A-L])$/;
const KNOCKOUT_SLOT_RE = /^([WL])(\d+)$/;

export function buildConfirmedBracketAdvancement(matches: BracketMatchRow[], teams: Map<string, BracketTeamRow>): BracketAdvanceUpdate[] {
  const standingsByGroup = buildStandingsByGroup(matches, Array.from(teams.values()));
  const completeGroups = buildCompleteGroupSet(matches);
  const thirdPlaceRows = allGroupsComplete(matches) ? buildThirdPlaceRows(standingsByGroup) : [];
  const usedThirdPlaceTeamIds = new Set<string>();
  const matchesByNumber = new Map(matches.map((match) => [getMatchNumber(match.id), match]).filter((entry): entry is [number, BracketMatchRow] => entry[0] !== null));
  const updates: BracketAdvanceUpdate[] = [];

  matches
    .filter((match) => KNOCKOUT_STAGES.has(match.stage))
    .sort((first, second) => (getMatchNumber(first.id) ?? 0) - (getMatchNumber(second.id) ?? 0))
    .forEach((match) => {
      const homeTeamId = resolveConfirmedSlot(match.home_team_id, teams, standingsByGroup, completeGroups, thirdPlaceRows, usedThirdPlaceTeamIds, matchesByNumber);
      const awayTeamId = resolveConfirmedSlot(match.away_team_id, teams, standingsByGroup, completeGroups, thirdPlaceRows, usedThirdPlaceTeamIds, matchesByNumber);
      const update: BracketAdvanceUpdate = { matchId: match.id };

      if (homeTeamId && homeTeamId !== match.home_team_id) {
        update.home_team_id = homeTeamId;
        match.home_team_id = homeTeamId;
      }
      if (awayTeamId && awayTeamId !== match.away_team_id) {
        update.away_team_id = awayTeamId;
        match.away_team_id = awayTeamId;
      }
      if (update.home_team_id || update.away_team_id) updates.push(update);
    });

  return updates;
}

function resolveConfirmedSlot(
  slot: string,
  teams: Map<string, BracketTeamRow>,
  standingsByGroup: Map<string, StandingRow[]>,
  completeGroups: Set<string>,
  thirdPlaceRows: { groupCode: string; row: StandingRow }[],
  usedThirdPlaceTeamIds: Set<string>,
  matchesByNumber: Map<number, BracketMatchRow>,
) {
  const label = teams.get(slot)?.short_name ?? slot;
  const groupSlot = label.match(GROUP_SLOT_RE);
  if (groupSlot) {
    const [, rank, groupCode] = groupSlot;
    if (!completeGroups.has(groupCode)) return null;
    return standingsByGroup.get(groupCode)?.[Number(rank) - 1]?.team.id ?? null;
  }

  const thirdPlaceSlot = label.match(THIRD_PLACE_SLOT_RE);
  if (thirdPlaceSlot) {
    const allowedGroups = new Set((thirdPlaceSlot[1] ?? thirdPlaceSlot[2]).split('/'));
    const team = thirdPlaceRows.find((candidate) => allowedGroups.has(candidate.groupCode) && !usedThirdPlaceTeamIds.has(candidate.row.team.id))?.row.team;
    if (team) usedThirdPlaceTeamIds.add(team.id);
    return team?.id ?? null;
  }

  const knockoutSlot = label.match(KNOCKOUT_SLOT_RE);
  if (knockoutSlot) {
    const [, direction, sourceNumber] = knockoutSlot;
    const sourceMatch = matchesByNumber.get(Number(sourceNumber));
    return sourceMatch ? getKnockoutResultTeamId(sourceMatch, direction as 'W' | 'L', teams) : null;
  }

  return null;
}

function buildStandingsByGroup(matches: BracketMatchRow[], teams: BracketTeamRow[]) {
  const groupCodes = Array.from(new Set(teams.map((team) => team.group_code).filter((value): value is string => Boolean(value))));
  return new Map(groupCodes.map((groupCode) => [groupCode, buildGroupStandings(matches, groupCode, teams.filter((team) => team.group_code === groupCode))]));
}

function buildGroupStandings(matches: BracketMatchRow[], groupCode: string, teams: BracketTeamRow[]) {
  const rows = new Map(teams.map((team) => [team.id, emptyStanding(team)]));

  for (const match of matches) {
    if (!isCompletedGroupMatch(match, groupCode)) continue;
    const home = rows.get(match.home_team_id);
    const away = rows.get(match.away_team_id);
    if (!home || !away || typeof match.home_score !== 'number' || typeof match.away_score !== 'number') continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += match.home_score;
    home.goalsAgainst += match.away_score;
    away.goalsFor += match.away_score;
    away.goalsAgainst += match.home_score;

    if (match.home_score > match.away_score) home.points += 3;
    else if (match.away_score > match.home_score) away.points += 3;
    else {
      home.points += 1;
      away.points += 1;
    }
  }

  for (const row of rows.values()) row.goalDifference = row.goalsFor - row.goalsAgainst;
  return Array.from(rows.values()).sort(compareStandingRows);
}

function emptyStanding(team: BracketTeamRow): StandingRow {
  return { team, played: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 };
}

function isCompletedGroupMatch(match: BracketMatchRow, groupCode: string) {
  return match.stage === 'group'
    && match.group_code === groupCode
    && match.status === 'finished'
    && typeof match.home_score === 'number'
    && typeof match.away_score === 'number';
}

function compareStandingRows(first: StandingRow, second: StandingRow) {
  return second.points - first.points
    || second.goalDifference - first.goalDifference
    || second.goalsFor - first.goalsFor
    || first.goalsAgainst - second.goalsAgainst
    || first.team.short_name.localeCompare(second.team.short_name)
    || first.team.name.localeCompare(second.team.name)
    || first.team.id.localeCompare(second.team.id);
}

function buildCompleteGroupSet(matches: BracketMatchRow[]) {
  const groupMatches = matches.filter((match) => match.stage === 'group' && match.group_code);
  const groupCodes = new Set(groupMatches.map((match) => match.group_code as string));
  return new Set(Array.from(groupCodes).filter((groupCode) => groupMatches.filter((match) => match.group_code === groupCode).every((match) => isCompletedGroupMatch(match, groupCode))));
}

function allGroupsComplete(matches: BracketMatchRow[]) {
  const groupMatches = matches.filter((match) => match.stage === 'group' && match.group_code);
  return groupMatches.length > 0 && groupMatches.every((match) => isCompletedGroupMatch(match, match.group_code as string));
}

function buildThirdPlaceRows(groupStandings: Map<string, StandingRow[]>) {
  // ponytail: confirmed advancement uses app standings order; add FIFA head-to-head/fair-play/drawing-lots if exact official tie-breaks are required.
  return Array.from(groupStandings.entries())
    .flatMap(([groupCode, rows]) => rows[2] ? [{ groupCode, row: rows[2] }] : [])
    .sort((first, second) => compareStandingRows(first.row, second.row));
}

function getKnockoutResultTeamId(match: BracketMatchRow, direction: 'W' | 'L', teams: Map<string, BracketTeamRow>) {
  if (match.status !== 'finished') return null;

  const homeTeamId = isPlaceholderTeam(match.home_team_id, teams) ? null : match.home_team_id;
  const awayTeamId = isPlaceholderTeam(match.away_team_id, teams) ? null : match.away_team_id;
  if (!homeTeamId || !awayTeamId) return null;

  if (match.espn_home_winner === true) return direction === 'W' ? homeTeamId : awayTeamId;
  if (match.espn_away_winner === true) return direction === 'W' ? awayTeamId : homeTeamId;
  if (typeof match.home_score !== 'number' || typeof match.away_score !== 'number' || match.home_score === match.away_score) return null;

  const homeWon = match.home_score > match.away_score;
  if (direction === 'W') return homeWon ? homeTeamId : awayTeamId;
  return homeWon ? awayTeamId : homeTeamId;
}

function isPlaceholderTeam(teamId: string, teams: Map<string, BracketTeamRow>) {
  return Boolean((teams.get(teamId)?.short_name ?? teamId).match(GROUP_SLOT_RE)
    || (teams.get(teamId)?.short_name ?? teamId).match(THIRD_PLACE_SLOT_RE)
    || (teams.get(teamId)?.short_name ?? teamId).match(KNOCKOUT_SLOT_RE));
}

function getMatchNumber(id: string) {
  const match = id.match(/(?:^|-)0*(\d+)$/);
  return match ? Number(match[1]) : null;
}
