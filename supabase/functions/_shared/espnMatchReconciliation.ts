export type EspnTeamLike = {
  homeKeys: Set<string>;
  awayKeys: Set<string>;
};

export type ReconciliationTeamRow = {
  id: string;
  name?: string | null;
  short_name?: string | null;
  country_code?: string | null;
};

export type ReconciliationUpdate = {
  home_team_id?: string;
  away_team_id?: string;
};

const fifaAliases: Record<string, string[]> = {
  BIH: ['bosnia-herzegovina', 'bosnia-and-herzegovina'],
  CIV: ['cote-divoire', 'cote-d-ivoire', 'ivory-coast'],
  COD: ['congo-dr', 'dr-congo', 'drc'],
  CPV: ['cabo-verde', 'cape-verde'],
  CZE: ['czechia', 'czech-republic'],
  ENG: ['england'],
  IRN: ['ir-iran', 'iran'],
  KOR: ['korea-republic', 'south-korea'],
  NED: ['netherlands', 'holland'],
  RSA: ['south-africa'],
  SCO: ['scotland'],
  SUI: ['switzerland'],
  TUR: ['turkiye', 'turkey'],
  USA: ['usa', 'united-states', 'united-states-of-america'],
};

export function normalizeEspnTeamKey(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function teamKeys(team: ReconciliationTeamRow) {
  const keys = new Set([team.id, team.short_name, team.name, team.country_code].map(normalizeEspnTeamKey).filter(Boolean));
  for (const alias of fifaAliases[(team.short_name ?? team.country_code ?? '').toUpperCase()] ?? []) keys.add(alias);
  return keys;
}

function overlaps(left: Set<string>, right: Set<string>) {
  for (const value of left) if (right.has(value)) return true;
  return false;
}

function resolveCandidateTeam(candidateKeys: Set<string>, teamMap: Map<string, ReconciliationTeamRow>) {
  const matches = Array.from(teamMap.values()).filter((team) => overlaps(teamKeys(team), candidateKeys));
  return matches.length === 1 ? matches[0].id : null;
}

export function reconcileMatchTeamsFromEspn<TMatch extends { home_team_id: string; away_team_id: string }>(match: TMatch, candidate: EspnTeamLike, teamMap: Map<string, ReconciliationTeamRow>): ReconciliationUpdate {
  const homeTeamId = resolveCandidateTeam(candidate.homeKeys, teamMap);
  const awayTeamId = resolveCandidateTeam(candidate.awayKeys, teamMap);
  if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) return {};

  const update: ReconciliationUpdate = {};
  if (match.home_team_id !== homeTeamId) update.home_team_id = homeTeamId;
  if (match.away_team_id !== awayTeamId) update.away_team_id = awayTeamId;
  return update;
}
