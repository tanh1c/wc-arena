import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEAGUES_TOUR_ID, getLeaguesTutorialSteps } from './leaguesTutorial';

const t = ((key: string) => key) as never;

test('leagues tour uses stable id and page anchors', () => {
  const steps = getLeaguesTutorialSteps(t);

  assert.equal(LEAGUES_TOUR_ID, 'leagues');
  assert.deepEqual(steps.map((step) => step.element), [
    '[data-tour="leagues-header"]',
    '[data-tour="leagues-summary"]',
    '[data-tour="leagues-directory"]',
    '[data-tour="leagues-create"]',
    '[data-tour="leagues-card"]',
    '[data-tour="leagues-join-code"]',
    '[data-tour="leagues-safety"]',
  ]);
});
