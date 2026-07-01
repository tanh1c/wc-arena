import type { TFunction } from 'i18next';
import type { TutorialStep } from './tutorialTour';

export const MATCH_DETAIL_TOUR_ID = 'match-detail';

export function getMatchDetailTutorialSteps(t: TFunction): TutorialStep[] {
  return [
    { element: '[data-tour="match-detail-header"]', popover: { title: t('tutorial.matchDetail.headerTitle'), description: t('tutorial.matchDetail.headerBody'), side: 'bottom', align: 'start' } },
    { element: '[data-tour="match-detail-summary"]', popover: { title: t('tutorial.matchDetail.summaryTitle'), description: t('tutorial.matchDetail.summaryBody'), side: 'bottom', align: 'start' } },
    { element: '[data-tour="match-detail-card"]', popover: { title: t('tutorial.matchDetail.cardTitle'), description: t('tutorial.matchDetail.cardBody'), side: 'top', align: 'center' } },
    { element: '[data-tour="match-detail-prediction"]', popover: { title: t('tutorial.matchDetail.predictionTitle'), description: t('tutorial.matchDetail.predictionBody'), side: 'left', align: 'start' } },
    { element: '[data-tour="match-detail-signals"]', popover: { title: t('tutorial.matchDetail.signalsTitle'), description: t('tutorial.matchDetail.signalsBody'), side: 'top', align: 'start' } },
    { element: '[data-tour="match-detail-context"]', popover: { title: t('tutorial.matchDetail.contextTitle'), description: t('tutorial.matchDetail.contextBody'), side: 'top', align: 'start' } },
    { element: '[data-tour="match-detail-actions"]', popover: { title: t('tutorial.matchDetail.actionsTitle'), description: t('tutorial.matchDetail.actionsBody'), side: 'left', align: 'start' } },
  ];
}
