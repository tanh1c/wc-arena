import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTourStorageKey, getAvailableTourSteps, shouldAutoRunTour } from './tutorialTour';

test('builds stable tour storage keys', () => {
  assert.equal(buildTourStorageKey('matches'), 'wc26.tour.matches.seen');
});

test('auto-runs only after loading succeeds and before the tour is seen', () => {
  assert.equal(shouldAutoRunTour({ loading: false, error: null, seen: false }), true);
  assert.equal(shouldAutoRunTour({ loading: true, error: null, seen: false }), false);
  assert.equal(shouldAutoRunTour({ loading: false, error: 'failed', seen: false }), false);
  assert.equal(shouldAutoRunTour({ loading: false, error: null, seen: true }), false);
});

test('filters out steps whose target element is not in the DOM', () => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    querySelector: (selector: string) => selector === '[data-tour="present"]' ? {} : null,
  } as Document;

  const steps = getAvailableTourSteps([
    { element: '[data-tour="present"]', popover: { title: 'Present', description: 'Exists' } },
    { element: '[data-tour="missing"]', popover: { title: 'Missing', description: 'Gone' } },
    { popover: { title: 'Fallback', description: 'No target needed' } },
  ]);

  assert.equal(steps.length, 2);
  assert.equal(steps[0].popover?.title, 'Present');
  assert.equal(steps[1].popover?.title, 'Fallback');

  globalThis.document = originalDocument;
});
