import test from 'node:test';
import assert from 'node:assert/strict';
import { appendAgentPromptText, getAgentMatchSelectionPrompt } from './agentPrompt';

test('match selection prompt contains only the fixture label', () => {
  const prompt = getAgentMatchSelectionPrompt(
    {
      home_team_id: 'bra',
      away_team_id: 'arg',
    },
    new Map([
      ['bra', { short_name: 'Brazil' }],
      ['arg', { short_name: 'Argentina' }],
    ]),
  );

  assert.equal(prompt, 'Brazil vs Argentina');
  assert.doesNotMatch(prompt, /Phân tích|analyze|preview/i);
});

test('appends suggestion text without replacing the current input', () => {
  assert.equal(appendAgentPromptText('', 'Brazil vs Argentina'), 'Brazil vs Argentina');
  assert.equal(appendAgentPromptText('So sánh', 'Brazil vs Argentina'), 'So sánh Brazil vs Argentina');
  assert.equal(appendAgentPromptText('So sánh   ', 'Brazil vs Argentina'), 'So sánh Brazil vs Argentina');
});
