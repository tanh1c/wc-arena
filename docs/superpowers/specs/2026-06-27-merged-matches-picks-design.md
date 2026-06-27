# Merged Matches & Picks Design

## Goal

Merge the overlapping `/matches` and `/picks` experiences into one primary match-play page where users can browse fixtures, make quick predictions, and still open full match details.

## Current UX problem

`/matches` is the better fixture browsing page: it has complete stage/status filtering, match schedule rows, match detail navigation, deadline context, and tournament summary stats. `/picks` is the better fast-action page: it lets users enter scores and submit predictions inline, but it duplicates fixture browsing and has a narrower group-stage-oriented UI. Having both in primary navigation makes users choose between two pages that mean almost the same thing.

## Route model

- `/matches` becomes the single primary page for fixtures and quick predictions.
- `/picks` redirects to `/matches?tab=picks` so old links remain useful without preserving a duplicate page.
- `/matches/:matchId` remains the full detail page for users who want ESPN context, community signal, group standings, and deep match analysis.
- `/my-predictions` remains the full history page for submitted predictions and score breakdown navigation.

## Page structure

The unified `/matches` page uses a tabbed hybrid layout:

1. **Schedule** — browse-first view, closest to the current `/matches` page.
2. **Quick Picks** — prediction-first view, closest to the current `/picks` row experience.
3. **My Slip** — compact submitted-prediction summary with a link to `/my-predictions`.

The tabs should be part of the page content, not separate navigation routes. Query param `tab` may initialize the selected tab, especially for `/picks` redirects.

## Shared filters

The stage, matchday, and status filters apply across Schedule and Quick Picks. Status filters should include:

- All
- Open
- Submitted
- Locked
- Live
- Finished

Submitted is user-specific and should match rows where the signed-in user has a prediction for the match. For signed-out users, Submitted should show an empty state or sign-in prompt rather than failing.

## Match card behavior

A single reusable match card should support both browse and prediction modes.

In **Schedule** mode:

- Show kickoff time, teams, status, venue, current/final score when available.
- Primary action is `Details`, linking to `/matches/:matchId`.
- If prediction is open, show a secondary `Quick Pick` action that switches the current tab to Quick Picks and focuses that match if practical.
- If the user has submitted a prediction, show the saved pick compactly on the card.

In **Quick Picks** mode:

- Show the same core match identity information.
- Show inline prediction controls copied from the current `/picks` behavior:
  - exact score vs outcome-only toggle
  - home/away score inputs for exact score
  - outcome buttons for outcome-only
  - submit button
  - saved/error/loading state
  - automatic risk multiplier note
- Keep `Details` available as a secondary action for deeper analysis.
- Locked/live/finished/void matches disable prediction inputs and show their status clearly.

## Sidebar / supporting panels

The unified page keeps the useful right-side context but avoids heavy duplication:

- Next deadline card from the current `/matches` and `/picks` pages.
- My slip summary: submitted count, open match count, estimated max exact-score points.
- Recent submitted predictions, capped to a small number, with `View all` linking to `/my-predictions`.

The current `/picks` mini leaderboard can be removed from this page to keep the unified page lighter and focused on match play.

## Data flow

The unified page loads:

- `listMatches()` for fixture rows.
- `getTeamMap()` for team names/flags/ranks.
- `listCurrentUserPredictions()` only when signed in, for draft initialization and submitted filtering.

Submitting a prediction uses the existing `submitPrediction()` service. After a successful submit, refresh the current user's predictions and update the affected card state.

## Navigation changes

- Remove `/picks` as a separate primary navigation item.
- Keep `/matches` in primary navigation and make its label cover both fixtures and quick picks if needed.
- Update mobile primary paths so there is no duplicate Matches/Picks slot.
- Keep route compatibility by redirecting `/picks` to `/matches?tab=picks`.

## Component boundaries

Avoid making the existing page files larger. Extract focused units while preserving current styling:

- A unified match page container for data loading and tab/filter state.
- A filter/tabs component for stage, matchday, status, and mode.
- A match card component that supports `schedule` and `quick-picks` modes.
- A prediction-controls component for inline score/outcome input and submit handling.
- A compact slip/sidebar component for deadline and user prediction summary.

## Testing and verification

Implementation should verify:

- `/matches` loads for signed-out and signed-in users.
- `/picks` redirects to `/matches?tab=picks`.
- Schedule tab still opens `/matches/:matchId` detail pages.
- Quick Picks tab can submit an exact-score prediction for an open match.
- Submitted status filter uses the current user's predictions.
- Locked/live/finished matches do not allow editing.
- Mobile layout keeps filters, tabs, score inputs, and detail actions usable.
- `npm run lint` and `npm run build` pass.
