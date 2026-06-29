export type StageFilter = 'group' | 'round32' | 'round16' | 'quarter' | 'semi' | 'third_place' | 'final';

type MatchStageLike = {
  stage: string;
  status: string;
  lock_at: string;
};

const stages = new Set<StageFilter>(['group', 'round32', 'round16', 'quarter', 'semi', 'third_place', 'final']);

function effectiveStatus(match: MatchStageLike, now: Date) {
  if (['finished', 'live', 'postponed', 'cancelled'].includes(match.status)) return match.status;
  return new Date(match.lock_at) <= now ? 'locked' : match.status;
}

export function getDefaultStageFilter(matches: MatchStageLike[], now = new Date()): StageFilter {
  const validMatches = matches.filter((match): match is MatchStageLike & { stage: StageFilter } => stages.has(match.stage as StageFilter));
  const liveMatch = validMatches.find((match) => effectiveStatus(match, now) === 'live');
  if (liveMatch) return liveMatch.stage;

  const upcomingMatch = validMatches.find((match) => ['open', 'scheduled', 'locked'].includes(effectiveStatus(match, now)));
  if (upcomingMatch) return upcomingMatch.stage;

  return [...validMatches].reverse().find((match) => effectiveStatus(match, now) === 'finished')?.stage ?? 'group';
}
