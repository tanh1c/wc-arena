import assert from 'node:assert/strict';
import test from 'node:test';

import { installGoogleAnalytics, trackGoogleAnalyticsPageView } from './googleAnalytics';

test('queues gtag setup before loading the remote script', () => {
  const calls: string[] = [];
  const win = {} as Window;
  const doc = {
    createElement(tag: string) {
      calls.push(`create:${tag}`);
      return {} as HTMLScriptElement;
    },
    head: {
      append(script: HTMLScriptElement) {
        calls.push(`append:${script.src}`);
      },
    },
  } as Document;

  installGoogleAnalytics('G-TEST', win, doc);

  assert.deepEqual(calls, ['create:script', 'append:https://www.googletagmanager.com/gtag/js?id=G-TEST']);
  assert.equal(typeof win.gtag, 'function');
  assert.deepEqual(win.dataLayer?.map((entry) => Array.from(entry)), [
    ['js', win.dataLayer?.[0][1]],
    ['config', 'G-TEST', { send_page_view: false }],
  ]);
});

test('sends SPA page views to the configured measurement id', () => {
  const events: unknown[][] = [];
  const win = { gtag: (...args: unknown[]) => events.push(args) } as unknown as Window;

  trackGoogleAnalyticsPageView('G-TEST', '/', 'We Know Ball', 'https://weknowball.pro/', win);

  assert.deepEqual(events, [
    ['event', 'page_view', {
      send_to: 'G-TEST',
      page_title: 'We Know Ball',
      page_location: 'https://weknowball.pro/',
      page_path: '/',
    }],
  ]);
});
