export type BracketLayoutMatch = {
  id: string;
  stage: string;
  home_team_id: string;
  away_team_id: string;
};

const STAGE_ORDER = ['round32', 'round16', 'quarter', 'semi', 'final', 'third_place'];
const KNOCKOUT_SLOT_RE = /^[WL](\d+)$/;

export function buildDependencyBracketColumns<T extends BracketLayoutMatch>(matches: T[]) {
  const matchesByNumber = new Map(matches.map((match) => [getMatchNumber(match.id), match]).filter((entry): entry is [number, T] => entry[0] !== null));
  const matchesByStage = new Map<string, T[]>();
  matches.forEach((match) => matchesByStage.set(match.stage, [...(matchesByStage.get(match.stage) ?? []), match]));

  return Array.from(matchesByStage.entries())
    .sort(([firstStage], [secondStage]) => getStageIndex(firstStage) - getStageIndex(secondStage))
    .map(([, stageMatches]) => stageMatches.sort((first, second) => getSourceSortKey(first, matchesByNumber) - getSourceSortKey(second, matchesByNumber) || (getMatchNumber(first.id) ?? 0) - (getMatchNumber(second.id) ?? 0)));
}

function getStageIndex(stage: string) {
  const index = STAGE_ORDER.indexOf(stage);
  return index === -1 ? STAGE_ORDER.length : index;
}

function getSourceSortKey<T extends BracketLayoutMatch>(match: T, matchesByNumber: Map<number, T>): number {
  const sourceMatches = [match.home_team_id, match.away_team_id]
    .map((slot) => slot.match(KNOCKOUT_SLOT_RE)?.[1])
    .map((sourceNumber) => sourceNumber ? matchesByNumber.get(Number(sourceNumber)) : undefined)
    .filter((sourceMatch): sourceMatch is T => Boolean(sourceMatch));

  if (sourceMatches.length === 0) return getMatchNumber(match.id) ?? Number.MAX_SAFE_INTEGER;
  return Math.min(...sourceMatches.map((sourceMatch) => getSourceSortKey(sourceMatch, matchesByNumber)));
}

function getMatchNumber(id: string) {
  const match = id.match(/(?:^|-)0*(\d+)$/);
  return match ? Number(match[1]) : null;
}
