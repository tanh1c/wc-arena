import test from 'node:test';
import assert from 'node:assert/strict';
import { resources } from '../i18n/resources';
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

test('agent page copy stays compact and clear about selected-match context', () => {
  assert.equal(resources.en.translation.appPages.agent.subtitle, 'AI match helper');
  assert.equal(resources.en.translation.appPages.agent.emptyIntro, 'Pick a match, then ask for a preview, score idea, or team context.');
  assert.equal(resources.en.translation.appPages.agent.selectedMatch, 'Selected match');
  assert.equal(resources.en.translation.appPages.agent.selectedMatchHint, 'Used as context for your next question.');
  assert.equal(resources.en.translation.appPages.agent.signInCta, 'Sign in');
  assert.equal(resources.en.translation.appPages.agent.inputPlaceholderSignedOut, 'Sign in to ask We Speak Football');
  assert.equal(resources.en.translation.appPages.agent.quickPrompts.matchPreview, 'Preview the selected match');
  assert.doesNotMatch(resources.en.translation.appPages.agent.quickPrompts.matchPreview, /this match/i);

  assert.equal(resources.vi.translation.appPages.agent.subtitle, 'Trợ lý trận đấu AI');
  assert.equal(resources.vi.translation.appPages.agent.emptyIntro, 'Chọn một trận, rồi hỏi nhận định, gợi ý tỉ số hoặc bối cảnh đội bóng.');
  assert.equal(resources.vi.translation.appPages.agent.selectedMatch, 'Trận đã chọn');
  assert.equal(resources.vi.translation.appPages.agent.selectedMatchHint, 'Dùng làm bối cảnh cho câu hỏi tiếp theo.');
  assert.equal(resources.vi.translation.appPages.agent.signInCta, 'Đăng nhập');
  assert.equal(resources.vi.translation.appPages.agent.inputPlaceholderSignedOut, 'Đăng nhập để hỏi We Speak Football');
  assert.equal(resources.vi.translation.appPages.agent.quickPrompts.matchPreview, 'Nhận định trận đã chọn');
  assert.doesNotMatch(resources.vi.translation.appPages.agent.quickPrompts.matchPreview, /trận này/i);
});
