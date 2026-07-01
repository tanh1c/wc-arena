import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resources } from '../i18n/resources';
import { getMatchStatLabelKey } from './matchStatLabels';

test('match stat labels use translation keys', () => {
  assert.equal(getMatchStatLabelKey('possession'), 'ui.statPossession');
  assert.equal(getMatchStatLabelKey('passAccuracy'), 'ui.statPassAccuracy');
});

test('match stat labels have English and Vietnamese copy', () => {
  assert.equal(resources.en.translation.ui.statPossession, 'Possession');
  assert.equal(resources.en.translation.ui.statShotsOnTarget, 'Shots on Target');
  assert.equal(resources.vi.translation.ui.statPossession, 'Kiểm soát bóng');
  assert.equal(resources.vi.translation.ui.statShotsOnTarget, 'Sút trúng đích');
});
