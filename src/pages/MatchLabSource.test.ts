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
