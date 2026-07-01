import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MATCH_DETAIL_TOUR_ID, getMatchDetailTutorialSteps } from './matchDetailTutorial';

const t = ((key: string) => key) as never;

test('match detail tour uses stable id and page anchors', () => {
  const steps = getMatchDetailTutorialSteps(t);

  assert.equal(MATCH_DETAIL_TOUR_ID, 'match-detail');
  assert.deepEqual(steps.map((step) => step.element), [
    '[data-tour="match-detail-header"]',
    '[data-tour="match-detail-summary"]',
    '[data-tour="match-detail-card"]',
    '[data-tour="match-detail-prediction"]',
    '[data-tour="match-detail-signals"]',
    '[data-tour="match-detail-context"]',
    '[data-tour="match-detail-actions"]',
  ]);
});
