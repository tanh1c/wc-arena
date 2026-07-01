import type { TFunction } from 'i18next';
import type { TutorialStep } from './tutorialTour';

export const MATCHES_TOUR_ID = 'matches';

export function getMatchesTutorialSteps(t: TFunction): TutorialStep[] {
  return [
    { element: '[data-tour="matches-summary"]', popover: { title: t('tutorial.matches.summaryTitle'), description: t('tutorial.matches.summaryBody'), side: 'bottom', align: 'start' } },
    { element: '[data-tour="matches-stage-tabs"]', popover: { title: t('tutorial.matches.stagesTitle'), description: t('tutorial.matches.stagesBody'), side: 'bottom', align: 'start' } },
    { element: '[data-tour="matches-filters"]', popover: { title: t('tutorial.matches.filtersTitle'), description: t('tutorial.matches.filtersBody'), side: 'bottom', align: 'start' } },
    { element: '[data-tour="matches-list"]', popover: { title: t('tutorial.matches.listTitle'), description: t('tutorial.matches.listBody'), side: 'top', align: 'start' } },
    { element: '[data-tour="matches-deadline"]', popover: { title: t('tutorial.matches.deadlineTitle'), description: t('tutorial.matches.deadlineBody'), side: 'left', align: 'start' } },
    { element: '[data-tour="matches-slip"]', popover: { title: t('tutorial.matches.slipTitle'), description: t('tutorial.matches.slipBody'), side: 'left', align: 'start' } },
    { element: '[data-tour="matches-how-to-play"]', popover: { title: t('tutorial.matches.howToPlayTitle'), description: t('tutorial.matches.howToPlayBody'), side: 'top', align: 'center' } },
  ];
}
