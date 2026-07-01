import type { TFunction } from 'i18next';
import type { TutorialStep } from './tutorialTour';

export const LEAGUES_TOUR_ID = 'leagues';

export function getLeaguesTutorialSteps(t: TFunction): TutorialStep[] {
  return [
    { element: '[data-tour="leagues-header"]', popover: { title: t('tutorial.leagues.headerTitle'), description: t('tutorial.leagues.headerBody'), side: 'bottom', align: 'start' } },
    { element: '[data-tour="leagues-summary"]', popover: { title: t('tutorial.leagues.summaryTitle'), description: t('tutorial.leagues.summaryBody'), side: 'bottom', align: 'start' } },
    { element: '[data-tour="leagues-directory"]', popover: { title: t('tutorial.leagues.directoryTitle'), description: t('tutorial.leagues.directoryBody'), side: 'top', align: 'start' } },
    { element: '[data-tour="leagues-create"]', popover: { title: t('tutorial.leagues.createTitle'), description: t('tutorial.leagues.createBody'), side: 'bottom', align: 'end' } },
    { element: '[data-tour="leagues-card"]', popover: { title: t('tutorial.leagues.cardTitle'), description: t('tutorial.leagues.cardBody'), side: 'top', align: 'start' } },
    { element: '[data-tour="leagues-join-code"]', popover: { title: t('tutorial.leagues.joinCodeTitle'), description: t('tutorial.leagues.joinCodeBody'), side: 'left', align: 'start' } },
    { element: '[data-tour="leagues-safety"]', popover: { title: t('tutorial.leagues.safetyTitle'), description: t('tutorial.leagues.safetyBody'), side: 'left', align: 'start' } },
  ];
}
