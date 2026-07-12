import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync('src/pages/MatchLab.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

test('match lab is a lazy experimental signed-in route', () => {
  assert.match(app, /lazy\(\(\) => import\('\.\/pages\/MatchLab'\)\)/);
  assert.match(app, /path="\/match-lab"/);
  assert.match(source, /useAuth\(\)/);
  assert.match(source, /Navigate to="\/login"/);
  assert.match(source, /Experimental match simulation/);
});

test('match lab uses its own service and excludes reward flow', () => {
  assert.match(source, /runMatchLab/);
  assert.match(source, /validateMatchLabSquad/);
  assert.match(source, /Starter/);
  assert.match(source, /Pressing Academy/);
  assert.match(source, /Defensive Wall/);
  assert.match(source, /Debug/);
  assert.match(source, /getMatchLabBotXi/);
  assert.match(source, /getFormationSlots/);
  assert.match(source, /cancelled/);
  assert.doesNotMatch(source, /Bot XI is revealed and ready for matchup inspection/);
  assert.match(source, /Personal report history/);
  assert.match(source, /Retry \/ resume/);
  assert.match(source, /Abandon/);
  assert.match(source, /Fun/);
  assert.match(source, /Clarity/);
  assert.match(source, /Fairness/);
  assert.match(source, /SquadPitchBuilder/);
  assert.match(source, /matchLabFormationKeys/);
  assert.match(source, /availableFormations=\{matchLabFormationKeys\}/);
  assert.match(source, /event\.summary \?\? event\.type\.toUpperCase\(\)/);
  assert.match(source, /aria-expanded/);
  assert.match(source, /hotspot_summaries/);
  assert.doesNotMatch(source, /JSON\.stringify\(result\.debug/);
  assert.doesNotMatch(source, /formationKeys/);
  assert.match(source, /listSavedSquadFormations/);
  assert.match(source, /pruneAssignmentsForOwnedCards/);
  assert.match(source, /relative z-10 flex min-h-0 flex-col gap-3 p-3 sm:p-4 lg:gap-6 lg:p-6/);
  assert.doesNotMatch(source, /max-w-7xl/);
  assert.doesNotMatch(source, /sendAgentMessage|openCardPack|forgePlayerCard|Rewards/);
});

test('match lab continues running checkpoints and keeps real pauses manual', () => {
  assert.match(source, /result\?\.status !== 'running'/);
  assert.match(source, /resumeMatchLabRun\(result\.id, debug\)/);
  assert.match(source, /next\.status === 'running' && next\.hotspot_index <= previousHotspot/);
  assert.match(source, /Simulating hot spot/);
  assert.match(source, /result\.status === 'abandoned'/);
  assert.match(source, /Abandoned run/);
  assert.match(source, /requestGeneration/);
  assert.match(source, /cancelled/);
  assert.match(source, /run\.status === 'running'/);
  assert.match(source, /run\.status === 'paused'/);
  assert.doesNotMatch(source, /resolver_state/);
});
