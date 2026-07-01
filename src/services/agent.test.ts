import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_UNAVAILABLE_MESSAGE } from './agentMessages';

test('agent unavailable message is user-facing', () => {
  assert.equal(AGENT_UNAVAILABLE_MESSAGE, 'We Speak Football is temporarily unavailable. Please try again later.');
  assert.doesNotMatch(AGENT_UNAVAILABLE_MESSAGE, /python|port|localhost/i);
});
