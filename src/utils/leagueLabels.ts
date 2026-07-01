export type LeagueJoinPolicy = 'auto' | 'approval';

export function getLeagueJoinPolicyLabelKey(joinPolicy: LeagueJoinPolicy) {
  return joinPolicy === 'approval' ? 'ui.joinPolicyApproval' : 'ui.joinPolicyOpen';
}
