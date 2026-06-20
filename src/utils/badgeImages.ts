import dailyReturnBadge from '@/badge_png/daily-return.png';
import exactScoreBadge from '@/badge_png/exact-score.png';
import finalsBadge from '@/badge_png/finals.png';
import firstPickBadge from '@/badge_png/first-pick.png';
import groupStageBadge from '@/badge_png/group-stage.png';
import knockoutBadge from '@/badge_png/knockout.png';
import leaguePlayerBadge from '@/badge_png/league-player.png';
import outcomeMasterBadge from '@/badge_png/outcome-master.png';
import riskPickBadge from '@/badge_png/risk-pick.png';
import streakFireBadge from '@/badge_png/streak-fire.png';
import topRankerBadge from '@/badge_png/top-ranker.png';

const badgeImages: Record<string, string> = {
  'daily-return': dailyReturnBadge,
  'exact-score': exactScoreBadge,
  'exact-score-merchant': exactScoreBadge,
  finals: finalsBadge,
  'first-pick': firstPickBadge,
  'group-stage': groupStageBadge,
  knockout: knockoutBadge,
  'league-player': leaguePlayerBadge,
  'outcome-master': outcomeMasterBadge,
  'risk-pick': riskPickBadge,
  'risk-taker': riskPickBadge,
  'streak-fire': streakFireBadge,
  'hot-streak': streakFireBadge,
  'top-ranker': topRankerBadge,
};

function normalizeBadgeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getBadgeImageSrc(badge: { id: string; name?: string | null; icon_path?: string | null }) {
  if (badge.icon_path) return badge.icon_path;

  return badgeImages[badge.id] ?? (badge.name ? badgeImages[normalizeBadgeKey(badge.name)] : undefined);
}
