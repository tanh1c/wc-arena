import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resources } from '../i18n/resources';
import { getLeagueJoinPolicyLabelKey } from './leagueLabels';

test('league join policies use user-facing label keys', () => {
  assert.equal(getLeagueJoinPolicyLabelKey('auto'), 'ui.joinPolicyOpen');
  assert.equal(getLeagueJoinPolicyLabelKey('approval'), 'ui.joinPolicyApproval');
});

test('league UX copy explains user questions instead of technical policy names', () => {
  assert.equal(resources.en.translation.ui.joinPolicy, 'Who can join?');
  assert.equal(resources.en.translation.ui.postJoinScoring, 'Scores after you join');
  assert.equal(resources.en.translation.ui.noCashPrize, 'Free · virtual points');
  assert.equal(resources.en.translation.ui.leagueSafetyBody, 'Free game · virtual points only.');
  assert.equal(resources.en.translation.ui.joinPolicyOpen, 'Open to join');
  assert.equal(resources.en.translation.ui.joinPolicyApproval, 'Request approval');

  assert.equal(resources.vi.translation.ui.joinPolicy, 'Ai được vào?');
  assert.equal(resources.vi.translation.ui.postJoinScoring, 'Điểm từ lúc tham gia');
  assert.equal(resources.vi.translation.ui.noCashPrize, 'Miễn phí · điểm ảo');
  assert.equal(resources.vi.translation.ui.leagueSafetyBody, 'Miễn phí · chỉ dùng điểm ảo.');
  assert.equal(resources.vi.translation.ui.joinPolicyOpen, 'Vào ngay');
  assert.equal(resources.vi.translation.ui.joinPolicyApproval, 'Cần chủ giải duyệt');
});
