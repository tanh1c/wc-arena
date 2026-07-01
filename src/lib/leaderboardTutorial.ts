import type { TFunction } from 'i18next';
import type { TutorialStep } from './tutorialTour';

export const LEADERBOARD_TOUR_ID = 'leaderboard';

export function getLeaderboardTutorialSteps(t: TFunction): TutorialStep[] {
  return [
    { element: '[data-tour="leaderboard-summary"]', popover: { title: t('tutorial.leaderboard.summaryTitle'), description: t('tutorial.leaderboard.summaryBody'), side: 'bottom', align: 'start' } },
    { element: '[data-tour="leaderboard-mode-tabs"]', popover: { title: t('tutorial.leaderboard.modesTitle'), description: t('tutorial.leaderboard.modesBody'), side: 'bottom', align: 'start' } },
    { element: '[data-tour="leaderboard-list"]', popover: { title: t('tutorial.leaderboard.listTitle'), description: t('tutorial.leaderboard.listBody'), side: 'top', align: 'start' } },
    { element: '[data-tour="leaderboard-podium"]', popover: { title: t('tutorial.leaderboard.podiumTitle'), description: t('tutorial.leaderboard.podiumBody'), side: 'top', align: 'center' } },
    { element: '[data-tour="leaderboard-current-player"]', popover: { title: t('tutorial.leaderboard.currentPlayerTitle'), description: t('tutorial.leaderboard.currentPlayerBody'), side: 'top', align: 'start' } },
    { element: '[data-tour="leaderboard-stats"]', popover: { title: t('tutorial.leaderboard.statsTitle'), description: t('tutorial.leaderboard.statsBody'), side: 'left', align: 'start' } },
    { element: '[data-tour="leaderboard-recognition"]', popover: { title: t('tutorial.leaderboard.recognitionTitle'), description: t('tutorial.leaderboard.recognitionBody'), side: 'left', align: 'start' } },
  ];
}
