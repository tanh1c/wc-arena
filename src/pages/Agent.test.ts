import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const currentDir = dirname(fileURLToPath(import.meta.url));

test('agent page does not render LangGraph diagnostic metadata below assistant answers', () => {
  const source = readFileSync(join(currentDir, 'Agent.tsx'), 'utf8');

  assert.doesNotMatch(source, /message\.intent/);
  assert.doesNotMatch(source, /message\.usedTools/);
});
