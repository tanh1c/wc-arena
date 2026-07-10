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
  assert.doesNotMatch(source, /sendAgentMessage|openCardPack|forgePlayerCard|Rewards/);
});
