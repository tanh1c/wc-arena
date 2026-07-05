import { Activity, Award, Bot, BarChart3, Gift, IdCard, Medal, ScrollText, Star, Trophy, User, Users } from 'lucide-react';

export type NavigationItem = {
  labelKey: string;
  shortLabelKey?: string;
  to: string;
  icon?: typeof Trophy;
};

export type NavigationGroup = {
  labelKey: string;
  items: NavigationItem[];
};

export const publicNavigation: NavigationItem[] = [
  { labelKey: 'nav.public.matches', to: '/matches' },
  { labelKey: 'nav.public.leaderboard', to: '/leaderboard' },
  { labelKey: 'nav.public.rules', to: '/rules' },
  { labelKey: 'nav.public.pointsGuide', to: '/points-guide' },
];

export const headerNavigation: NavigationItem[] = [
  { labelKey: 'nav.items.matches', shortLabelKey: 'nav.items.matches', to: '/matches', icon: Trophy },
  { labelKey: 'nav.items.leaderboard', shortLabelKey: 'nav.items.rank', to: '/leaderboard', icon: Award },
  { labelKey: 'nav.items.leagues', to: '/leagues', icon: Users },
];

export const appNavigationGroups: NavigationGroup[] = [
  {
    labelKey: 'nav.groups.play',
    items: [
      { labelKey: 'nav.items.matches', shortLabelKey: 'nav.items.matches', to: '/matches', icon: Trophy },
      { labelKey: 'nav.items.agent', shortLabelKey: 'nav.items.agentShort', to: '/agent', icon: Bot },
      { labelKey: 'nav.items.leaderboard', shortLabelKey: 'nav.items.rank', to: '/leaderboard', icon: Award },
      { labelKey: 'nav.items.rules', shortLabelKey: 'nav.items.rulesShort', to: '/rules', icon: ScrollText },
      { labelKey: 'nav.items.pointsGuide', shortLabelKey: 'nav.items.points', to: '/points-guide', icon: Gift },
      { labelKey: 'nav.items.cards', shortLabelKey: 'nav.items.cardsShort', to: '/cards', icon: IdCard },
      { labelKey: 'nav.items.myPredictions', shortLabelKey: 'nav.items.predicts', to: '/my-predictions', icon: Medal },
    ],
  },
  {
    labelKey: 'nav.groups.social',
    items: [
      { labelKey: 'nav.items.leagues', to: '/leagues', icon: Users },
      { labelKey: 'nav.items.squadGallery', to: '/squad-gallery', icon: Users },
      { labelKey: 'nav.items.statistics', to: '/stats', icon: BarChart3 },
      { labelKey: 'nav.items.activity', to: '/activity', icon: Activity },
      { labelKey: 'nav.items.badges', to: '/badges', icon: Medal },
      { labelKey: 'nav.items.achievements', to: '/achievements', icon: Trophy },
    ],
  },
  {
    labelKey: 'nav.groups.account',
    items: [
      { labelKey: 'nav.items.profile', to: '/profile', icon: User },
      { labelKey: 'nav.items.rewards', to: '/rewards', icon: Star },
    ],
  },
];

const headerNavigationPaths = new Set(headerNavigation.map((item) => item.to));

export const secondaryHeaderNavigationGroups: NavigationGroup[] = appNavigationGroups
  .map((group) => ({
    ...group,
    items: group.items.filter((item) => !headerNavigationPaths.has(item.to)),
  }))
  .filter((group) => group.items.length > 0);

export const mobileNavigation = appNavigationGroups[0].items;
