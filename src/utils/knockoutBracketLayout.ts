export type BracketLayoutMatch = {
  id: string;
  stage: string;
  home_team_id: string;
  away_team_id: string;
};

const STAGE_ORDER = ['round32', 'round16', 'quarter', 'semi', 'final', 'third_place'];
const KNOCKOUT_SLOT_RE = /^[WL](\d+)$/;
const MATCH_SOURCES: Record<number, number[]> = {
  89: [74, 77],
  90: [73, 75],
  91: [76, 78],
  92: [79, 80],
  93: [83, 84],
  94: [81, 82],
  95: [86, 88],
  96: [85, 87],
  97: [89, 90],
  98: [93, 94],
  99: [91, 92],
  100: [95, 96],
  101: [97, 98],
  102: [99, 100],
  104: [101, 102],
};

export function buildDependencyBracketColumns<T extends BracketLayoutMatch>(matches: T[]) {
  const matchesByNumber = buildMatchesByNumber(matches);
  const matchesByStage = new Map<string, T[]>();
  matches.forEach((match) => matchesByStage.set(match.stage, [...(matchesByStage.get(match.stage) ?? []), match]));

  return Array.from(matchesByStage.entries())
    .sort(([firstStage], [secondStage]) => getStageIndex(firstStage) - getStageIndex(secondStage))
    .map(([, stageMatches]) => stageMatches.sort((first, second) => getSourceSortKey(first, matchesByNumber) - getSourceSortKey(second, matchesByNumber) || (getMatchNumber(first.id) ?? 0) - (getMatchNumber(second.id) ?? 0)));
}

export function splitDependencyBracketSide<T extends BracketLayoutMatch>(matches: T[], side: 'left' | 'right', allMatches: T[] = matches) {
  const matchesByNumber = buildMatchesByNumber(allMatches);
  const sortedMatches = [...matches].sort((first, second) => getLaneSortKey(first, matchesByNumber) - getLaneSortKey(second, matchesByNumber) || (getMatchNumber(first.id) ?? 0) - (getMatchNumber(second.id) ?? 0));
  const split = Math.ceil(sortedMatches.length / 2);
  return side === 'left' ? sortedMatches.slice(0, split) : sortedMatches.slice(split);
}

function buildMatchesByNumber<T extends BracketLayoutMatch>(matches: T[]) {
  return new Map(matches.map((match) => [getMatchNumber(match.id), match]).filter((entry): entry is [number, T] => entry[0] !== null));
}

function getStageIndex(stage: string) {
  const index = STAGE_ORDER.indexOf(stage);
  return index === -1 ? STAGE_ORDER.length : index;
}

function getLaneSortKey<T extends BracketLayoutMatch>(match: T, matchesByNumber: Map<number, T>) {
  if (getSourceMatches(match, matchesByNumber).length > 0) return getSourceSortKey(match, matchesByNumber);

  const matchNumber = getMatchNumber(match.id);
  const nextMatchNumber = matchNumber ? Number(Object.entries(MATCH_SOURCES).find(([, sourceNumbers]) => sourceNumbers.includes(matchNumber))?.[0]) : NaN;
  return Number.isNaN(nextMatchNumber) ? getSourceSortKey(match, matchesByNumber) : getSourceSortKey(matchesByNumber.get(nextMatchNumber) ?? match, matchesByNumber);
}

function getSourceSortKey<T extends BracketLayoutMatch>(match: T, matchesByNumber: Map<number, T>): number {
  const matchNumber = getMatchNumber(match.id);
  const sourceMatches = getSourceMatches(match, matchesByNumber);

  if (sourceMatches.length === 0) return matchNumber ?? Number.MAX_SAFE_INTEGER;
  return Math.min(...sourceMatches.map((sourceMatch) => getSourceSortKey(sourceMatch, matchesByNumber)));
}

function getSourceMatches<T extends BracketLayoutMatch>(match: T, matchesByNumber: Map<number, T>) {
  const matchNumber = getMatchNumber(match.id);
  const sourceNumbers = [match.home_team_id, match.away_team_id]
    .map((slot) => slot.match(KNOCKOUT_SLOT_RE)?.[1])
    .filter((sourceNumber): sourceNumber is string => Boolean(sourceNumber))
    .map(Number);
  const sources = sourceNumbers.length ? sourceNumbers : matchNumber ? MATCH_SOURCES[matchNumber] ?? [] : [];
  return sources.map((sourceNumber) => matchesByNumber.get(sourceNumber)).filter((sourceMatch): sourceMatch is T => Boolean(sourceMatch));
}

function getMatchNumber(id: string) {
  const match = id.match(/(?:^|-)0*(\d+)$/);
  return match ? Number(match[1]) : null;
}
