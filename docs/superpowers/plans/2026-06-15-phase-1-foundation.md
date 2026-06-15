# Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Predict 2026 from page-state static UI into a frontend-only routed app with shared foundation, domain types, mock data, scoring helpers, and a `/my-predictions` route.

**Architecture:** Keep existing pages and brutalist visual system intact while adding a thin route/layout/data foundation around them. Use React Router for URL routes, shared layout primitives only where repeated across existing pages, typed mock data in `src/data`, domain types in `src/types`, and pure scoring helpers in `src/lib`.

**Tech Stack:** React 19, Vite 6, TypeScript 5.8, Tailwind CSS v4, lucide-react, country-flag-icons, react-router-dom.

---

## File Structure

- Modify `package.json` / `package-lock.json`: add `react-router-dom`.
- Modify `src/App.tsx`: own theme state, apply body classes, define routes.
- Create `src/types/domain.ts`: User, Team, Match, Prediction, status unions, leaderboard, badge, prize, league, scoring types.
- Create `src/data/mockTeams.ts`: reusable teams.
- Create `src/data/mockMatches.ts`: reusable World Cup match fixtures/results.
- Create `src/data/mockUsers.ts`: reusable users.
- Create `src/data/mockLeaderboard.ts`: reusable leaderboard rows.
- Create `src/data/mockPrizePool.ts`: reusable prize tiers and prize summary.
- Create `src/data/mockPredictions.ts`: reusable current-user prediction history.
- Create `src/lib/scoring.ts`: pure scoring helpers.
- Create `src/components/layout/AppShell.tsx`: shared outer page shell, Mac frame, nav, settings, wallet button.
- Create `src/components/ui/StatCard.tsx`: reusable stat card for 3+ pages.
- Create `src/components/ui/Panel.tsx`: reusable brutal panel container.
- Create `src/components/ui/StatusPill.tsx`: reusable status badge.
- Create `src/components/ui/PageHero.tsx`: reusable page title block.
- Create `src/pages/MyPredictions.tsx`: prediction history route.
- Create `src/pages/PlaceholderPage.tsx`: lightweight styled placeholders for required unimplemented routes if any page is absent.
- Modify existing page imports/exports only as needed to route correctly and link to `/my-predictions`.

---

### Task 1: Add React Router and Route Foundation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.tsx`

- [ ] **Step 1: Install React Router**

Run:
```bash
npm install react-router-dom
```
Expected: `package.json` includes `react-router-dom`, and `package-lock.json` updates.

- [ ] **Step 2: Replace page-state routing in `src/App.tsx`**

Use this shape:
```tsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Landing from './Landing';
import Picks from './Picks';
import Leaderboard from './Leaderboard';
import Rules from './Rules';
import PrizePool from './PrizePool';
import Login from './Login';
import Register from './Register';
import Onboarding from './Onboarding';
import Fixtures from './Fixtures';
import MyPredictions from './pages/MyPredictions';
import PlaceholderPage from './pages/PlaceholderPage';

export type ThemeControls = {
  isVintage: boolean;
  setIsVintage: (value: boolean) => void;
  isDark: boolean;
  setIsDark: (value: boolean) => void;
  isRounded: boolean;
  setIsRounded: (value: boolean) => void;
  hasShadow: boolean;
  setHasShadow: (value: boolean) => void;
};

export default function App() {
  const [isVintage, setIsVintage] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [isRounded, setIsRounded] = useState(false);
  const [hasShadow, setHasShadow] = useState(true);

  useEffect(() => {
    let cls = 'bg-page text-main min-h-screen';
    if (isVintage) cls += ' theme-vintage';
    if (isDark) cls += ' theme-dark';
    if (isRounded) cls += ' theme-rounded';
    if (!hasShadow) cls += ' theme-no-shadow';
    document.body.className = cls;
  }, [isVintage, isDark, isRounded, hasShadow]);

  const themeControls: ThemeControls = {
    isVintage,
    setIsVintage,
    isDark,
    setIsDark,
    isRounded,
    setIsRounded,
    hasShadow,
    setHasShadow,
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing {...themeControls} />} />
        <Route path="/login" element={<Login {...themeControls} />} />
        <Route path="/register" element={<Register {...themeControls} />} />
        <Route path="/onboarding" element={<Onboarding {...themeControls} />} />
        <Route path="/matches" element={<Fixtures {...themeControls} />} />
        <Route path="/picks" element={<Picks {...themeControls} />} />
        <Route path="/my-predictions" element={<MyPredictions themeControls={themeControls} />} />
        <Route path="/leaderboard" element={<Leaderboard {...themeControls} />} />
        <Route path="/rules" element={<Rules {...themeControls} />} />
        <Route path="/prize-pool" element={<PrizePool {...themeControls} />} />
        <Route path="/matches/:matchId" element={<PlaceholderPage title="Match Detail" description="Detailed match predictions and score breakdowns arrive in the next phase." themeControls={themeControls} />} />
        <Route path="/predictions/:predictionId" element={<PlaceholderPage title="Prediction Breakdown" description="Transparent scoring details arrive in the next phase." themeControls={themeControls} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Update old page prop typing to allow optional navigation during transition**

For existing root page files, update prop type from required `onNavigate` to optional or replace call sites with URL navigation later. Minimal safe transition:
```ts
type LegacyPageProps = ThemeControls & {
  onNavigate?: (page: string) => void;
};
```
Then inside each page, provide:
```ts
const navigateTo = (page: string) => {
  const path = page === 'landing' ? '/' : `/${page}`;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};
```
Prefer replacing buttons with React Router navigation in Task 2, but this step keeps TypeScript green during routing.

- [ ] **Step 4: Run type check for routing baseline**

Run:
```bash
npm run lint
```
Expected: it may fail only because new referenced pages/components do not exist yet. Continue to Task 2.

---

### Task 2: Shared Layout Components

**Files:**
- Create: `src/components/layout/AppShell.tsx`
- Create: `src/components/ui/PageHero.tsx`
- Create: `src/components/ui/StatCard.tsx`
- Create: `src/components/ui/Panel.tsx`
- Create: `src/components/ui/StatusPill.tsx`
- Create: `src/pages/PlaceholderPage.tsx`

- [ ] **Step 1: Create `AppShell`**

`src/components/layout/AppShell.tsx`:
```tsx
import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ChevronDown, Settings, Wallet } from 'lucide-react';
import type { ThemeControls } from '../../App';

type AppShellProps = {
  children: React.ReactNode;
  themeControls: ThemeControls;
  fullHeight?: boolean;
};

const navItems = [
  { label: 'Matches', to: '/matches' },
  { label: 'My Picks', to: '/picks' },
  { label: 'My Predictions', to: '/my-predictions' },
  { label: 'Leaderboard', to: '/leaderboard' },
  { label: 'Rules', to: '/rules' },
  { label: 'Prize Pool', to: '/prize-pool' },
];

export default function AppShell({ children, themeControls, fullHeight = false }: AppShellProps) {
  const [showSettings, setShowSettings] = useState(false);
  const { isVintage, setIsVintage, isDark, setIsDark, isRounded, setIsRounded, hasShadow, setHasShadow } = themeControls;

  return (
    <div className={`${fullHeight ? 'h-[100dvh]' : 'min-h-screen'} bg-page p-3 sm:p-4 lg:p-6 flex flex-col font-sans relative`}>
      <div className={`w-full max-w-[1600px] border-4 border-main rounded-lg shadow-[8px_8px_0px_var(--color-shadow)] sm:shadow-[16px_16px_0px_var(--color-shadow)] overflow-hidden flex flex-col mx-auto transition-all relative bg-card ${fullHeight ? 'flex-1 min-h-0' : ''}`}>
        <div className="w-full h-8 border-b-4 border-main bg-main flex items-center px-4 gap-2 relative z-30 shrink-0">
          <div className="w-3 h-3 rounded-full bg-c5" />
          <div className="w-3 h-3 rounded-full bg-c1" />
          <div className="w-3 h-3 rounded-full bg-c3" />
        </div>
        <nav className="flex items-center justify-between border-b-4 border-main px-6 py-4 bg-card z-30 relative shrink-0">
          <Link to="/" className="text-xl md:text-3xl font-black uppercase tracking-tighter">PREDICT 2026</Link>
          <div className="hidden xl:flex space-x-8 font-bold uppercase text-sm tracking-wide">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => isActive ? 'text-c2 border-b-4 border-c2 pb-1' : 'hover:text-c2 transition-colors pb-1'}>
                {item.label}
              </NavLink>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button type="button" onClick={() => setShowSettings(!showSettings)} className="w-10 md:w-11 h-10 md:h-11 border-2 border-main flex items-center justify-center hover:bg-muted transition-colors bg-card shadow-[2px_2px_0_0_var(--color-shadow)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none">
                <Settings size={20} className="text-main" />
              </button>
              {showSettings && (
                <div className="absolute right-0 top-14 bg-card border-4 border-main p-4 w-52 shadow-[4px_4px_0_0_var(--color-shadow)] z-50 flex flex-col gap-2">
                  <div className="font-bold uppercase text-xs text-main">Settings</div>
                  <label className="flex items-center justify-between cursor-pointer border-t-2 border-main pt-2"><span className="text-sm font-bold text-main">Vintage Mode</span><input type="checkbox" checked={isVintage} onChange={(event) => setIsVintage(event.target.checked)} className="w-4 h-4 border-2 border-main accent-main cursor-pointer" /></label>
                  <label className="flex items-center justify-between cursor-pointer border-t-2 border-main pt-2"><span className="text-sm font-bold text-main">Dark Mode</span><input type="checkbox" checked={isDark} onChange={(event) => setIsDark(event.target.checked)} className="w-4 h-4 border-2 border-main accent-main cursor-pointer" /></label>
                  <label className="flex items-center justify-between cursor-pointer border-t-2 border-main pt-2"><span className="text-sm font-bold text-main">Rounded Corners</span><input type="checkbox" checked={isRounded} onChange={(event) => setIsRounded(event.target.checked)} className="w-4 h-4 border-2 border-main accent-main cursor-pointer" /></label>
                  <label className="flex items-center justify-between cursor-pointer border-t-2 border-main pt-2"><span className="text-sm font-bold text-main">Shadows</span><input type="checkbox" checked={hasShadow} onChange={(event) => setHasShadow(event.target.checked)} className="w-4 h-4 border-2 border-main accent-main cursor-pointer" /></label>
                </div>
              )}
            </div>
            <Link to="/login" className="bg-c2 hover:opacity-80 transition-opacity text-inv font-black py-2 px-4 border-2 border-main flex items-center gap-3 transform active:scale-95 shadow-[4px_4px_0_0_var(--color-shadow)]">
              <Wallet size={18} strokeWidth={2.5} />
              <div className="flex-col items-start leading-[1.1] hidden sm:flex">
                <span className="text-[10px] uppercase font-bold opacity-80">Account</span>
                <span className="text-sm">Sign in</span>
              </div>
              <ChevronDown size={18} className="ml-1 hidden sm:block" />
            </Link>
          </div>
        </nav>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create UI primitives**

`src/components/ui/PageHero.tsx`:
```tsx
import React from 'react';

type PageHeroProps = {
  title: string;
  description: string;
  children?: React.ReactNode;
};

export default function PageHero({ title, description, children }: PageHeroProps) {
  return (
    <div className="bg-card border-4 border-main p-4 lg:p-6 flex flex-col gap-4 shadow-[8px_8px_0_0_var(--color-shadow)]">
      <div>
        <h1 className="text-4xl lg:text-6xl font-black uppercase tracking-tighter mb-2 text-main">{title}</h1>
        <p className="font-bold text-sm lg:text-lg text-main max-w-2xl leading-snug">{description}</p>
      </div>
      {children}
    </div>
  );
}
```

`src/components/ui/StatCard.tsx`:
```tsx
import React from 'react';

type StatCardProps = {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  tone: 'lime' | 'blue' | 'green' | 'orange' | 'red' | 'neutral';
};

const toneClasses = {
  lime: 'bg-c1 text-main',
  blue: 'bg-c2 text-inv',
  green: 'bg-c3 text-main',
  orange: 'bg-c4 text-main',
  red: 'bg-c5 text-inv',
  neutral: 'bg-card text-main',
};

export default function StatCard({ label, value, subtitle, icon, tone }: StatCardProps) {
  return (
    <div className={`flex border-4 border-main p-3 lg:p-4 shadow-[4px_4px_0_0_var(--color-shadow)] items-center ${toneClasses[tone]}`}>
      <div className="shrink-0 mr-3 lg:mr-4">{icon}</div>
      <div className="flex flex-col justify-center">
        <div className="text-[10px] lg:text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90">{label}</div>
        <div className="text-2xl lg:text-3xl font-black leading-none tracking-tight">{value}</div>
        {subtitle && <div className="text-[9px] lg:text-[10px] font-bold uppercase mt-1">{subtitle}</div>}
      </div>
    </div>
  );
}
```

`src/components/ui/Panel.tsx`:
```tsx
import React from 'react';

type PanelProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export default function Panel({ title, children, className = '' }: PanelProps) {
  return (
    <section className={`bg-card border-4 border-main flex flex-col shadow-[4px_4px_0_0_var(--color-shadow)] ${className}`}>
      {title && <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-xs border-b-4 border-main">{title}</div>}
      {children}
    </section>
  );
}
```

`src/components/ui/StatusPill.tsx`:
```tsx
import type { PredictionDisplayStatus } from '../../types/domain';

type StatusPillProps = {
  status: PredictionDisplayStatus;
};

const statusClasses: Record<PredictionDisplayStatus, string> = {
  pending: 'bg-card text-main',
  locked: 'bg-muted text-main',
  exact: 'bg-c1 text-main',
  correct: 'bg-c3 text-main',
  missed: 'bg-c5 text-inv',
};

const statusLabels: Record<PredictionDisplayStatus, string> = {
  pending: 'Pending',
  locked: 'Locked',
  exact: 'Exact Score',
  correct: 'Correct',
  missed: 'Missed',
};

export default function StatusPill({ status }: StatusPillProps) {
  return <span className={`inline-flex border-2 border-main px-2 py-1 text-[10px] font-black uppercase shadow-[2px_2px_0_var(--color-shadow)] ${statusClasses[status]}`}>{statusLabels[status]}</span>;
}
```

- [ ] **Step 3: Create placeholder page**

`src/pages/PlaceholderPage.tsx`:
```tsx
import AppShell from '../components/layout/AppShell';
import PageHero from '../components/ui/PageHero';
import Panel from '../components/ui/Panel';
import type { ThemeControls } from '../App';

type PlaceholderPageProps = {
  title: string;
  description: string;
  themeControls: ThemeControls;
};

export default function PlaceholderPage({ title, description, themeControls }: PlaceholderPageProps) {
  return (
    <AppShell themeControls={themeControls}>
      <div className="relative z-10 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 bg-page flex-1">
        <PageHero title={title} description={description} />
        <Panel title="Coming Next">
          <div className="p-6 bg-card font-bold text-sm text-subtle">
            This route is wired for the frontend foundation pass. The full feature UI will be built in a later phase.
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
```

---

### Task 3: Domain Types and Mock Data Layer

**Files:**
- Create: `src/types/domain.ts`
- Create: `src/data/mockTeams.ts`
- Create: `src/data/mockMatches.ts`
- Create: `src/data/mockUsers.ts`
- Create: `src/data/mockLeaderboard.ts`
- Create: `src/data/mockPrizePool.ts`
- Create: `src/data/mockPredictions.ts`

- [ ] **Step 1: Create domain types**

`src/types/domain.ts`:
```ts
export type MatchStatus = 'scheduled' | 'open' | 'locked' | 'live' | 'finished' | 'postponed' | 'cancelled';
export type PredictionStatus = 'draft' | 'submitted' | 'locked' | 'scored' | 'void';
export type PredictionDisplayStatus = 'pending' | 'locked' | 'exact' | 'correct' | 'missed';
export type MatchStage = 'group' | 'round16' | 'quarter' | 'semi' | 'final';
export type MatchOutcome = 'home' | 'away' | 'draw';

export type User = {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  countryCode?: string;
  fanClubTeamId?: string;
  role: 'user' | 'admin';
  points: number;
  rank?: number;
  accuracy?: number;
  exactScores: number;
  currentStreak: number;
  bestStreak: number;
  createdAt: string;
};

export type Team = {
  id: string;
  name: string;
  shortName: string;
  countryCode: string;
  fifaRank?: number;
  group?: string;
};

export type Match = {
  id: string;
  stage: MatchStage;
  group?: string;
  matchday?: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string;
  lockAt: string;
  stadium: string;
  city: string;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  resultUpdatedAt?: string;
};

export type Prediction = {
  id: string;
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  confidence: number;
  isRiskPick: boolean;
  createdAt: string;
  updatedAt: string;
  lockedAt?: string;
  status: PredictionStatus;
  revision: number;
};

export type MatchResult = {
  homeScore: number;
  awayScore: number;
};

export type ScoreBreakdown = {
  predictionId: string;
  exactScore: number;
  correctOutcome: number;
  streakBonus: number;
  riskMultiplier: number;
  underdogBonus: number;
  total: number;
  scoringVersion: string;
  calculatedAt: string;
};

export type LeaderboardEntry = {
  userId: string;
  rank: number;
  previousRank?: number;
  points: number;
  exactScores: number;
  accuracy: number;
  streak: number;
};

export type Badge = {
  id: string;
  name: string;
  description: string;
  category: 'skill' | 'streak' | 'risk' | 'rank' | 'social' | 'event';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  iconPath?: string;
  unlockedAt?: string;
  progressCurrent?: number;
  progressTarget?: number;
};

export type PrizeTier = {
  id: string;
  label: string;
  amount: number;
  rankStart: number;
  rankEnd: number;
  sponsorFunded: boolean;
};

export type League = {
  id: string;
  name: string;
  slug: string;
  creatorId: string;
  visibility: 'private' | 'public';
  inviteCode: string;
  memberCount: number;
  scoringMode: 'global' | 'custom';
  prizeMode: 'none' | 'symbolic' | 'sponsor' | 'manual';
  createdAt: string;
};
```

- [ ] **Step 2: Create mock data files**

Create realistic shared data using these exported names:
```ts
// src/data/mockTeams.ts
import type { Team } from '../types/domain';

export const mockTeams: Team[] = [
  { id: 'bra', name: 'Brazil', shortName: 'BRA', countryCode: 'BR', fifaRank: 5, group: 'A' },
  { id: 'esp', name: 'Spain', shortName: 'ESP', countryCode: 'ES', fifaRank: 3, group: 'A' },
  { id: 'fra', name: 'France', shortName: 'FRA', countryCode: 'FR', fifaRank: 2, group: 'B' },
  { id: 'arg', name: 'Argentina', shortName: 'ARG', countryCode: 'AR', fifaRank: 1, group: 'B' },
  { id: 'jpn', name: 'Japan', shortName: 'JPN', countryCode: 'JP', fifaRank: 18, group: 'C' },
  { id: 'mex', name: 'Mexico', shortName: 'MEX', countryCode: 'MX', fifaRank: 14, group: 'C' },
  { id: 'ger', name: 'Germany', shortName: 'GER', countryCode: 'DE', fifaRank: 10, group: 'D' },
  { id: 'mar', name: 'Morocco', shortName: 'MAR', countryCode: 'MA', fifaRank: 12, group: 'D' },
  { id: 'usa', name: 'United States', shortName: 'USA', countryCode: 'US', fifaRank: 16, group: 'E' },
  { id: 'kor', name: 'South Korea', shortName: 'KOR', countryCode: 'KR', fifaRank: 23, group: 'E' },
];

export function getTeamById(teamId: string) {
  return mockTeams.find((team) => team.id === teamId);
}
```

```ts
// src/data/mockMatches.ts
import type { Match } from '../types/domain';

export const mockMatches: Match[] = [
  { id: 'm-bra-esp', stage: 'group', group: 'A', matchday: 1, homeTeamId: 'bra', awayTeamId: 'esp', kickoffAt: '2026-06-12T18:00:00Z', lockAt: '2026-06-12T17:45:00Z', stadium: 'MetLife Stadium', city: 'New York, USA', status: 'finished', homeScore: 2, awayScore: 1, resultUpdatedAt: '2026-06-12T20:00:00Z' },
  { id: 'm-fra-arg', stage: 'group', group: 'B', matchday: 1, homeTeamId: 'fra', awayTeamId: 'arg', kickoffAt: '2026-06-12T21:00:00Z', lockAt: '2026-06-12T20:45:00Z', stadium: 'SoFi Stadium', city: 'Los Angeles, USA', status: 'finished', homeScore: 1, awayScore: 1, resultUpdatedAt: '2026-06-12T23:00:00Z' },
  { id: 'm-jpn-mex', stage: 'group', group: 'C', matchday: 1, homeTeamId: 'jpn', awayTeamId: 'mex', kickoffAt: '2026-06-13T15:00:00Z', lockAt: '2026-06-13T14:45:00Z', stadium: 'NRG Stadium', city: 'Houston, USA', status: 'finished', homeScore: 0, awayScore: 2, resultUpdatedAt: '2026-06-13T17:00:00Z' },
  { id: 'm-ger-mar', stage: 'group', group: 'D', matchday: 2, homeTeamId: 'ger', awayTeamId: 'mar', kickoffAt: '2026-06-14T18:00:00Z', lockAt: '2026-06-14T17:45:00Z', stadium: 'AT&T Stadium', city: 'Dallas, USA', status: 'locked' },
  { id: 'm-usa-kor', stage: 'group', group: 'E', matchday: 2, homeTeamId: 'usa', awayTeamId: 'kor', kickoffAt: '2026-06-15T21:00:00Z', lockAt: '2026-06-15T20:45:00Z', stadium: 'Hard Rock Stadium', city: 'Miami, USA', status: 'open' },
];

export function getMatchById(matchId: string) {
  return mockMatches.find((match) => match.id === matchId);
}
```

Also create users, leaderboard, prize tiers, predictions with the type names from `domain.ts`.

---

### Task 4: Scoring Engine Skeleton

**Files:**
- Create: `src/lib/scoring.ts`

- [ ] **Step 1: Implement pure scoring helpers**

`src/lib/scoring.ts`:
```ts
import type { MatchOutcome, MatchResult, Prediction, ScoreBreakdown } from '../types/domain';

export type ScoringOptions = {
  streakBonus?: number;
  riskMultiplier?: number;
  underdogBonus?: number;
  calculatedAt?: string;
};

export function getOutcome(score: MatchResult): MatchOutcome {
  if (score.homeScore > score.awayScore) return 'home';
  if (score.homeScore < score.awayScore) return 'away';
  return 'draw';
}

export function getPredictionOutcome(prediction: Pick<Prediction, 'homeScore' | 'awayScore'>, matchResult: MatchResult): 'exact' | 'correct' | 'missed' {
  const exact = prediction.homeScore === matchResult.homeScore && prediction.awayScore === matchResult.awayScore;
  if (exact) return 'exact';
  return getOutcome(prediction) === getOutcome(matchResult) ? 'correct' : 'missed';
}

export function calculatePredictionScore(prediction: Prediction, matchResult: MatchResult, options: ScoringOptions = {}): ScoreBreakdown {
  const outcome = getPredictionOutcome(prediction, matchResult);
  const exactScore = outcome === 'exact' ? 3 : 0;
  const correctOutcome = outcome === 'correct' ? 1 : 0;
  const streakBonus = options.streakBonus ?? 0;
  const riskMultiplier = options.riskMultiplier ?? 1;
  const underdogBonus = options.underdogBonus ?? 0;
  const baseTotal = exactScore + correctOutcome + streakBonus + underdogBonus;

  return {
    predictionId: prediction.id,
    exactScore,
    correctOutcome,
    streakBonus,
    riskMultiplier,
    underdogBonus,
    total: baseTotal * riskMultiplier,
    scoringVersion: 'mvp-2026-06-15',
    calculatedAt: options.calculatedAt ?? new Date().toISOString(),
  };
}

export function calculateAccuracy(items: Array<{ prediction: Prediction; result?: MatchResult }>): number {
  const scored = items.filter((item) => item.result);
  if (scored.length === 0) return 0;
  const correct = scored.filter((item) => item.result && getPredictionOutcome(item.prediction, item.result) !== 'missed').length;
  return Math.round((correct / scored.length) * 100);
}

export function calculateStreak(items: Array<{ prediction: Prediction; result?: MatchResult }>): number {
  let streak = 0;
  for (const item of [...items].reverse()) {
    if (!item.result) continue;
    if (getPredictionOutcome(item.prediction, item.result) === 'missed') break;
    streak += 1;
  }
  return streak;
}
```

- [ ] **Step 2: Run lint**

Run:
```bash
npm run lint
```
Expected: no errors from `src/lib/scoring.ts`; continue fixing any import/path errors from unfinished page work.

---

### Task 5: My Predictions Route

**Files:**
- Create: `src/pages/MyPredictions.tsx`
- Uses: `src/data/mockPredictions.ts`, `src/data/mockMatches.ts`, `src/data/mockTeams.ts`, `src/lib/scoring.ts`

- [ ] **Step 1: Build `/my-predictions` UI**

`src/pages/MyPredictions.tsx` should:
- Render inside `AppShell`.
- Show stat cards: total picks, exact scores, accuracy, current streak.
- Show a prediction history table.
- Compute status badges from shared scoring helpers:
  - no result + `submitted` = pending
  - no result + `locked` = locked
  - exact result = exact
  - correct outcome = correct
  - wrong outcome = missed
- Show points from `calculatePredictionScore`.
- Include a disabled/button placeholder labelled `View Breakdown`.

- [ ] **Step 2: Use typed mock data only**

Do not define predictions/matches inline in the page. Import from data files:
```ts
import { mockPredictions } from '../data/mockPredictions';
import { getMatchById } from '../data/mockMatches';
import { getTeamById } from '../data/mockTeams';
```

- [ ] **Step 3: Run lint**

Run:
```bash
npm run lint
```
Expected: pass or only reveal route/page prop errors to fix in Task 6.

---

### Task 6: Route Link Compatibility and Existing Page Cleanup

**Files:**
- Modify: `src/Landing.tsx`
- Modify: `src/Picks.tsx`
- Modify: `src/Fixtures.tsx`
- Modify: `src/Leaderboard.tsx`
- Modify: `src/Rules.tsx`
- Modify: `src/PrizePool.tsx`
- Modify: `src/Login.tsx`
- Modify: `src/Register.tsx`
- Modify: `src/Onboarding.tsx`

- [ ] **Step 1: Replace `onNavigate` with router navigation where touched**

Use:
```tsx
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
const goTo = (page: string) => navigate(page === 'landing' ? '/' : `/${page}`);
```
Then replace `onNavigate('picks')` with `goTo('picks')` and similar.

- [ ] **Step 2: Preserve theme props**

Keep existing theme props on pages for now so the duplicated settings menus keep working until later cleanup. Do not remove current page layouts.

- [ ] **Step 3: Fix nav labels to include My Predictions where easy**

At minimum, ensure shared `AppShell` has `/my-predictions`. Existing pages can keep their nav until a later refactor if changing them risks large churn.

---

### Task 7: Final Verification

**Files:**
- All touched files

- [ ] **Step 1: Run TypeScript lint**

Run:
```bash
npm run lint
```
Expected: `tsc --noEmit` exits successfully.

- [ ] **Step 2: Run production build**

Run:
```bash
npm run build
```
Expected: Vite build exits successfully and writes `dist`.

- [ ] **Step 3: Inspect changed files**

Run:
```bash
git status --short
```
Expected: changed files include router, layout/ui components, domain/data/lib files, My Predictions, and package updates.

- [ ] **Step 4: Report summary**

Report:
- Current app structure summary.
- Changed files.
- `npm run lint` result.
- `npm run build` result.

---

## Self-Review

- Spec coverage: Required routes are covered through real pages plus placeholder support; domain/data/scoring and `/my-predictions` are explicitly covered; lint/build verification is covered.
- Placeholder scan: Placeholder route page is intentional for unimplemented route details; no plan step leaves implementation unspecified for Phase 1 deliverables.
- Type consistency: Status/type names are defined once in `src/types/domain.ts` and reused by scoring/UI/data tasks.
