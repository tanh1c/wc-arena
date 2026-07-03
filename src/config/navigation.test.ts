import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appNavigationGroups, headerNavigation, secondaryHeaderNavigationGroups } from './navigation';

test('header navigation keeps only the three primary user destinations', () => {
  assert.deepEqual(headerNavigation.map((item) => item.to), ['/matches', '/leaderboard', '/leagues']);
});

test('secondary header navigation keeps non-primary destinations discoverable', () => {
  const paths = secondaryHeaderNavigationGroups.flatMap((group) => group.items.map((item) => item.to));

  assert.deepEqual(paths, [
    '/agent',
    '/rules',
    '/points-guide',
    '/cards',
    '/my-predictions',
    '/squad-gallery',
    '/stats',
    '/activity',
    '/badges',
    '/achievements',
    '/profile',
    '/rewards',
  ]);
});

test('admin routes stay out of app navigation groups', () => {
  const paths = appNavigationGroups.flatMap((group) => group.items.map((item) => item.to));

  assert.equal(paths.includes('/admin'), false);
  assert.equal(paths.includes('/admin/audit'), false);
});
