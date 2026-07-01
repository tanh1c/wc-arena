import { driver, type DriveStep } from 'driver.js';

export type TutorialStep = DriveStep;

export function buildTourStorageKey(tourId: string) {
  return `wc26.tour.${tourId}.seen`;
}

export function hasSeenTour(tourId: string) {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(buildTourStorageKey(tourId)) === 'true';
}

export function markTourSeen(tourId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(buildTourStorageKey(tourId), 'true');
}

export function getAvailableTourSteps(steps: TutorialStep[]) {
  if (typeof document === 'undefined') return steps.filter((step) => !step.element);
  return steps.filter((step) => !step.element || document.querySelector(String(step.element)));
}

export function shouldAutoRunTour({ loading, error, seen }: { loading: boolean; error: unknown; seen: boolean }) {
  return !loading && !error && !seen;
}

export function startTutorialTour(tourId: string, steps: TutorialStep[]) {
  const availableSteps = getAvailableTourSteps(steps);
  if (availableSteps.length === 0) return;

  const tour = driver({
    animate: true,
    allowClose: true,
    showProgress: true,
    showButtons: ['next', 'previous', 'close'],
    popoverClass: 'wc26-driver-popover',
    onDestroyed: () => markTourSeen(tourId),
    steps: availableSteps,
  });

  tour.drive();
}
