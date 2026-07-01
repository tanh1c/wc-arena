export type LeagueJoinPolicy = 'auto' | 'approval';
export type LeagueVisibility = 'public' | 'private';

export function getLeagueJoinPolicyLabelKey(joinPolicy: LeagueJoinPolicy) {
  return joinPolicy === 'approval' ? 'ui.joinPolicyApproval' : 'ui.joinPolicyOpen';
}

export function getLeagueVisibilityLabelKey(visibility: LeagueVisibility) {
  return visibility === 'private' ? 'ui.privateLabel' : 'ui.publicLabel';
}
