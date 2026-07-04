import assert from 'node:assert/strict';
import test from 'node:test';

import { getFunctionErrorMessage } from './functionErrors';

test('reads user-facing error message from Supabase function JSON response', async () => {
  const message = await getFunctionErrorMessage({
    message: 'Edge Function returned a non-2xx status code',
    context: new Response(JSON.stringify({ error: 'Daily pack already opened today.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }),
  });

  assert.equal(message, 'Daily pack already opened today.');
});
